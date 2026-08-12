"use client";

// L'état de la session en cours : durée choisie, chronomètre, matière active,
// notes. Vit au-dessus des pages pour que le timer survive à la navigation —
// changer d'onglet ne doit pas remettre la session à zéro.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { studyDurations } from "@/lib/study-plan";
import { useCurriculum } from "./curriculum-context";

type ApiState = "checking" | "ok" | "down";

type StudyValue = {
  duration: number;
  selectedSubjectId: string;
  secondsRemaining: number;
  isRunning: boolean;
  notes: Record<string, string>;
  apiState: ApiState;
  aiLabel: string;
  storageDriver: string;
  chooseDuration: (minutes: number) => void;
  selectSubject: (subjectId: string) => void;
  toggleTimer: () => void;
  resetTimer: () => void;
  setNote: (subjectId: string, value: string) => void;
};

const StudyContext = createContext<StudyValue | null>(null);
const PREFS_KEY = "scio:preferences";

type StoredDurationPreferences = {
  duration?: number;
  durationCustomized?: boolean;
};

export function storedDurationPreference(prefs: StoredDurationPreferences): number | undefined {
  const legacyCustomDuration = prefs.duration !== undefined && prefs.duration !== 30;
  return prefs.duration &&
    (prefs.durationCustomized === true || legacyCustomDuration) &&
    (studyDurations as readonly number[]).includes(prefs.duration)
    ? prefs.duration
    : undefined;
}

export function shouldApplyCurriculumDuration(customized: boolean, running: boolean): boolean {
  return !customized && !running;
}

type CurriculumDurationDecisionInput = {
  customized: boolean;
  running: boolean;
  curriculumChanged: boolean;
  curriculumMinutes: number;
  pendingMinutes: number | null;
};

export function curriculumDurationDecision(input: CurriculumDurationDecisionInput): {
  applyMinutes: number | null;
  pendingMinutes: number | null;
} {
  if (input.customized) return { applyMinutes: null, pendingMinutes: null };
  if (input.curriculumChanged) {
    return input.running
      ? { applyMinutes: null, pendingMinutes: input.curriculumMinutes }
      : { applyMinutes: input.curriculumMinutes, pendingMinutes: null };
  }
  if (!input.running && input.pendingMinutes !== null) {
    return { applyMinutes: input.pendingMinutes, pendingMinutes: null };
  }
  return { applyMinutes: null, pendingMinutes: input.pendingMinutes };
}

export function StudyProvider({ children, defaultMinutes = 30 }: { children: ReactNode; defaultMinutes?: number }) {
  const { curriculum } = useCurriculum();
  const subjects = curriculum.subjects;
  const curriculumMinutes = curriculum.sessionMinutes ?? defaultMinutes;
  const initialSubjectIds = useRef(new Set(subjects.map((subject) => subject.id)));
  const durationCustomized = useRef(false);
  const [duration, setDuration] = useState<number>(curriculumMinutes);
  const [selectedSubjectId, setSelectedSubjectId] = useState(subjects[0].id);
  const effectiveSubjectId = subjects.some((subject) => subject.id === selectedSubjectId)
    ? selectedSubjectId
    : subjects[0].id;
  const [secondsRemaining, setSecondsRemaining] = useState(curriculumMinutes * 60);
  const [isRunning, setIsRunning] = useState(false);
  const previousCurriculumMinutes = useRef(curriculumMinutes);
  const pendingCurriculumMinutes = useRef<number | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [apiState, setApiState] = useState<ApiState>("checking");
  const [aiLabel, setAiLabel] = useState("—");
  const [storageDriver, setStorageDriver] = useState("file");

  const saveTimers = useRef(new Map<string, number>());

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- client-only localStorage restoration must run after SSR hydration */
    try {
      const prefs = JSON.parse(window.localStorage.getItem(PREFS_KEY) ?? "{}") as StoredDurationPreferences & {
        selectedSubjectId?: string;
      };
      const storedDuration = storedDurationPreference(prefs);
      if (storedDuration) {
        durationCustomized.current = true;
        setDuration(storedDuration);
        setSecondsRemaining(storedDuration * 60);
      }
      if (prefs.selectedSubjectId && initialSubjectIds.current.has(prefs.selectedSubjectId)) {
        setSelectedSubjectId(prefs.selectedSubjectId);
      }
    } catch {
      // Préférences illisibles : on garde les valeurs par défaut.
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    const curriculumChanged = previousCurriculumMinutes.current !== curriculumMinutes;
    previousCurriculumMinutes.current = curriculumMinutes;
    const decision = curriculumDurationDecision({
      customized: durationCustomized.current,
      running: isRunning,
      curriculumChanged,
      curriculumMinutes,
      pendingMinutes: pendingCurriculumMinutes.current,
    });
    pendingCurriculumMinutes.current = decision.pendingMinutes;
    if (decision.applyMinutes !== null) {
      setDuration(decision.applyMinutes);
      setSecondsRemaining(decision.applyMinutes * 60);
    }
  }, [curriculumMinutes, isRunning]);

  useEffect(() => {
    try {
      window.localStorage.setItem(PREFS_KEY, JSON.stringify({
        duration,
        durationCustomized: durationCustomized.current,
        selectedSubjectId: effectiveSubjectId,
      }));
    } catch {
      // Stockage indisponible : la session reste utilisable.
    }
  }, [duration, effectiveSubjectId]);

  // Les notes vivent côté serveur : c'est ce qui les rend disponibles depuis un
  // autre appareil quand on branche Postgres.
  useEffect(() => {
    fetch("/api/notes", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : {}))
      .then((body: Record<string, string>) => setNotes(body))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!isRunning) return;
    const timer = window.setInterval(() => {
      setSecondsRemaining((current) => {
        if (current <= 1) {
          setIsRunning(false);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isRunning]);

  useEffect(() => {
    let active = true;
    async function check() {
      try {
        const response = await fetch("/api/health", { cache: "no-store" });
        const body = await response.json() as {
          ok?: boolean;
          ai?: { label?: string };
          storage?: { driver?: string };
        };
        if (!active) return;
        setApiState(response.ok && body.ok ? "ok" : "down");
        setAiLabel(body.ai?.label ?? "—");
        setStorageDriver(body.storage?.driver ?? "file");
      } catch {
        if (active) setApiState("down");
      }
    }
    void check();
    const interval = window.setInterval(check, 60_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  // Une frappe = une requête serait absurde ; on attend 700 ms de silence.
  const setNote = useCallback((subjectId: string, value: string) => {
    setNotes((current) => ({ ...current, [subjectId]: value }));

    const timers = saveTimers.current;
    const pending = timers.get(subjectId);
    if (pending) window.clearTimeout(pending);

    timers.set(subjectId, window.setTimeout(() => {
      void fetch("/api/notes", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subjectId, body: value }),
      }).catch(() => undefined);
      timers.delete(subjectId);
    }, 700));
  }, []);

  const value = useMemo<StudyValue>(() => ({
    duration,
    selectedSubjectId: effectiveSubjectId,
    secondsRemaining,
    isRunning,
    notes,
    apiState,
    aiLabel,
    storageDriver,
    chooseDuration(minutes) {
      durationCustomized.current = true;
      setDuration(minutes);
      setSecondsRemaining(minutes * 60);
      setIsRunning(false);
    },
    selectSubject(subjectId) {
      if (subjects.some((subject) => subject.id === subjectId)) setSelectedSubjectId(subjectId);
    },
    toggleTimer() {
      // Un chrono à zéro qu'on relance repart pour une session complète : c'est
      // ce que veut dire « Recommencer ».
      if (secondsRemaining === 0) {
        setSecondsRemaining(duration * 60);
        setIsRunning(true);
        return;
      }
      setIsRunning((current) => !current);
    },
    resetTimer() {
      setSecondsRemaining(duration * 60);
      setIsRunning(false);
    },
    setNote,
  }), [aiLabel, apiState, duration, effectiveSubjectId, isRunning, notes, secondsRemaining, setNote, storageDriver, subjects]);

  return <StudyContext.Provider value={value}>{children}</StudyContext.Provider>;
}

export function useStudy() {
  const context = useContext(StudyContext);
  if (!context) throw new Error("useStudy doit être utilisé dans StudyProvider");
  return context;
}
