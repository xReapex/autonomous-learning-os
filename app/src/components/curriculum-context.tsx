"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  normalizeCurriculumDocument,
  type Curriculum,
  type CurriculumDocument,
} from "@/lib/curriculum";
import type { ActiveCurriculum } from "@/lib/curriculum-store";

export type CurriculumClientState = ActiveCurriculum & {
  curriculum: Curriculum;
};

export function makeCurriculumClientState(active: ActiveCurriculum): CurriculumClientState {
  return {
    ...active,
    document: structuredClone(active.document),
    curriculum: normalizeCurriculumDocument(active.document),
  };
}

export class CurriculumApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly issues: string[];

  constructor(status: number, code: string, message: string, issues: string[] = []) {
    super(message);
    this.name = "CurriculumApiError";
    this.status = status;
    this.code = code;
    this.issues = issues;
  }
}

type CurriculumContextValue = CurriculumClientState & {
  save: (document: CurriculumDocument) => Promise<CurriculumClientState>;
  reset: () => Promise<CurriculumClientState>;
  refresh: () => Promise<CurriculumClientState>;
};

const CurriculumContext = createContext<CurriculumContextValue | null>(null);

export function createSerializedCurriculumMutationQueue() {
  let tail: Promise<void> = Promise.resolve();
  return function enqueue<T>(mutation: () => Promise<T>): Promise<T> {
    const result = tail.then(mutation, mutation);
    tail = result.then(() => undefined, () => undefined);
    return result;
  };
}

async function responseBody(response: Response): Promise<ActiveCurriculum> {
  const body = await response.json() as ActiveCurriculum & {
    error?: { code?: string; message?: string; issues?: string[] };
  };
  if (!response.ok) {
    throw new CurriculumApiError(
      response.status,
      body.error?.code ?? "curriculum_error",
      body.error?.message ?? "Le serveur a refusé le curriculum.",
      body.error?.issues ?? [],
    );
  }
  return body;
}

export function CurriculumProvider({
  initial,
  children,
}: {
  initial: ActiveCurriculum;
  children: ReactNode;
}) {
  const [state, setState] = useState(() => makeCurriculumClientState(initial));
  const revisionRef = useRef(state.revision);
  const mutationQueueRef = useRef<ReturnType<typeof createSerializedCurriculumMutationQueue> | null>(null);
  if (mutationQueueRef.current === null) mutationQueueRef.current = createSerializedCurriculumMutationQueue();
  const enqueueMutation = mutationQueueRef.current;

  const apply = useCallback((active: ActiveCurriculum) => {
    const next = makeCurriculumClientState(active);
    revisionRef.current = next.revision;
    setState(next);
    return next;
  }, []);

  const refresh = useCallback(() => enqueueMutation(async () => {
    const response = await fetch("/api/curriculum", { cache: "no-store" });
    return apply(await responseBody(response));
  }), [apply, enqueueMutation]);

  const save = useCallback((document: CurriculumDocument) => {
    const body = JSON.stringify(document);
    return enqueueMutation(async () => {
      const response = await fetch("/api/curriculum", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "If-Match": `"${revisionRef.current}"`,
        },
        body,
      });
      return apply(await responseBody(response));
    });
  }, [apply, enqueueMutation]);

  const reset = useCallback(() => enqueueMutation(async () => {
    const response = await fetch("/api/curriculum", {
      method: "DELETE",
      headers: { "If-Match": `"${revisionRef.current}"` },
    });
    return apply(await responseBody(response));
  }), [apply, enqueueMutation]);

  const value = useMemo<CurriculumContextValue>(() => ({
    ...state,
    save,
    reset,
    refresh,
  }), [refresh, reset, save, state]);

  return <CurriculumContext.Provider value={value}>{children}</CurriculumContext.Provider>;
}

export function useCurriculum(): CurriculumContextValue {
  const value = useContext(CurriculumContext);
  if (!value) throw new Error("useCurriculum doit être utilisé dans CurriculumProvider");
  return value;
}
