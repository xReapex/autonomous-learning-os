"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
  type SetStateAction,
} from "react";

import type {
  CurriculumDocument,
  CurriculumSource,
} from "@/lib/curriculum";
import { validateCurriculumDocument } from "@/lib/curriculum-validation";
import {
  validateInterviewResponse,
  type InterviewRequest,
  type InterviewResponse,
  type InterviewTurn,
} from "@/lib/curriculum-interview";
import {
  acquireInterviewRequestLock,
  autosaveStatusAfterSuccess,
  canRetryInterviewProposal,
  createGuidedCurriculum,
  duplicateSubject,
  INTERVIEW_SESSION_STORAGE_KEY,
  isCurrentSaveAttempt,
  isInterviewProposalApplied,
  isJsonEditorDisabled,
  interviewStreamedErrorMessage,
  nextEditorMode,
  parseStoredInterviewSession,
  releaseInterviewRequestLock,
  requiresFreshInterviewAfterSaveError,
  serializeInterviewSession,
  shouldApplyInterviewProposal,
  shouldReplaceDraftAfterInterviewApply,
  shouldStartCurriculumAutosave,
  slugifyCurriculumId,
  type CurriculumEditorMode,
  type GuidedCurriculumInput,
} from "./curriculum-editor-helpers";
import { CurriculumApiError, useCurriculum } from "./curriculum-context";
import { useLocale } from "./locale-context";
import { Status } from "./window";

const MAX_IMPORT_BYTES = 1024 * 1024;
const SESSION_MINUTES = [15, 30, 45, 60, 90, 120, 180] as const;

const EDITOR_MODES: CurriculumEditorMode[] = ["guide", "visual", "json", "interview"];
type SaveState = "saved" | "editing" | "saving" | "error";
type GuideForm = Omit<GuidedCurriculumInput, "takeaways"> & { takeawaysText: string };

function Field({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={wide ? "bx-editor-field is-wide" : "bx-editor-field"}>
      <span className="bx-label">{label}</span>
      {children}
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  wide,
  disabled,
  type = "text",
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  wide?: boolean;
  disabled?: boolean;
  type?: "text" | "url" | "date" | "number";
}) {
  return (
    <Field label={label} wide={wide}>
      <input
        className="bx-input"
        type={type}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

function AreaField({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <Field label={label} wide>
      <textarea
        className="bx-textarea bx-editor-area"
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

function SourceFields({
  source,
  onChange,
}: {
  source: CurriculumSource;
  onChange: (source: CurriculumSource) => void;
}) {
  const { t } = useLocale();
  const set = (key: keyof CurriculumSource, value: unknown) => {
    onChange({ ...source, [key]: value } as CurriculumSource);
  };

  return (
    <div className="bx-editor-grid">
      <TextField label={t("studio.sourceExactTitle")} value={source.title} onChange={(value) => set("title", value)} wide />
      <TextField label={t("studio.provider")} value={source.provider} onChange={(value) => set("provider", value)} />
      <Field label={t("studio.type")}>
        <output className="bx-input">YouTube · {t("common.video")}</output>
      </Field>
      <TextField label={t("studio.contentLanguage")} value={source.language} onChange={(value) => set("language", value)} />
      <TextField label={t("studio.httpsUrl")} type="url" value={source.url} onChange={(value) => set("url", value)} wide />
      <TextField
        label={t("studio.embedUrl")}
        type="url"
        value={source.embedUrl}
        onChange={(value) => set("embedUrl", value)}
        wide
      />
      <TextField label={t("studio.minutesToday")} type="number" value={source.minutes} onChange={(value) => set("minutes", Number(value))} />
      <TextField
        label={t("studio.totalDuration")}
        type="number"
        value={source.totalMinutes}
        onChange={(value) => set("totalMinutes", Number(value))}
      />
      <TextField
        label={t("studio.segmentStart")}
        type="number"
        value={source.segmentStartSeconds ?? 0}
        onChange={(value) => set("segmentStartSeconds", Number(value))}
      />
      <TextField label={t("studio.verifiedOn")} type="date" value={source.verifiedAt} onChange={(value) => set("verifiedAt", value)} />
      <AreaField label={t("studio.whySource")} value={source.why} onChange={(value) => set("why", value)} />
      <AreaField label={t("studio.freeAccessTerms")} value={source.accessNote} onChange={(value) => set("accessNote", value)} />
      <AreaField label={t("studio.studySegment")} value={source.segmentLabel} onChange={(value) => set("segmentLabel", value)} rows={2} />
    </div>
  );
}

function nextId(base: string, existing: Set<string>, maxLength: number): string {
  const normalized = slugifyCurriculumId(base, "copie", maxLength);
  if (!existing.has(normalized)) return normalized;
  let index = 2;
  while (true) {
    const suffix = `-${index}`;
    const candidate = `${normalized.slice(0, maxLength - suffix.length)}${suffix}`;
    if (!existing.has(candidate)) return candidate;
    index += 1;
  }
}

function moveItem<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function guideFromDocument(document: CurriculumDocument): GuideForm {
  const subject = document.subjects[0];
  const lesson = subject.lessons[0];
  const source = lesson.source;
  return {
    subject: document.subject,
    goal: document.goal,
    level: document.level ?? "debutant",
    sessionMinutes: document.sessionMinutes ?? 30,
    language: document.language === "en" ? "en" : "fr",
    subjectTitle: subject.title,
    subjectIcon: subject.icon,
    subjectLevel: subject.level,
    lessonTitle: lesson.title,
    objective: lesson.objective,
    prompt: lesson.prompt,
    takeawaysText: lesson.keyTakeaways.join("\n"),
    sourceTitle: source.title,
    provider: source.provider,
    sourceUrl: source.url,
    minutes: source.minutes,
    why: source.why,
    accessNote: source.accessNote,
    segmentLabel: source.segmentLabel,
  };
}

export function CurriculumEditor() {
  const active = useCurriculum();
  const { t, locale } = useLocale();
  const activeDocument = active.document;
  const [draft, setDraft] = useState<CurriculumDocument>(() => structuredClone(activeDocument));
  const [mode, setMode] = useState<CurriculumEditorMode>("guide");
  const [guideStep, setGuideStep] = useState(0);
  const [guide, setGuide] = useState<GuideForm>(() => guideFromDocument(activeDocument));
  const [jsonText, setJsonText] = useState(() => JSON.stringify(activeDocument, null, 2));
  const [jsonError, setJsonError] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [curriculumMutationsInFlight, setCurriculumMutationsInFlight] = useState(0);
  const [saveMessage, setSaveMessage] = useState(() => t("studio.saved"));
  const [conflict, setConflict] = useState(false);
  const [unlockIds, setUnlockIds] = useState(false);
  const [interviewTurns, setInterviewTurns] = useState<InterviewTurn[]>([]);
  const [interviewInput, setInterviewInput] = useState("");
  const [interviewResult, setInterviewResult] = useState<InterviewResponse | null>(null);
  const [interviewLoading, setInterviewLoading] = useState(false);
  const [interviewError, setInterviewError] = useState("");
  const [interviewSessionReady, setInterviewSessionReady] = useState(false);
  const [interviewNetworkValidated, setInterviewNetworkValidated] = useState(false);
  const interviewRequestLockRef = useRef(false);
  const draftVersionRef = useRef(0);
  const saveAttemptRef = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);

  const validation = useMemo(() => validateCurriculumDocument(draft), [draft]);
  const serializedDraft = useMemo(() => JSON.stringify(draft), [draft]);
  const serializedActive = useMemo(() => JSON.stringify(activeDocument), [activeDocument]);
  const interviewApplied = isInterviewProposalApplied(interviewResult, active.source, activeDocument);
  const interviewProposalPending = interviewResult?.phase === "proposal" && interviewNetworkValidated && !interviewApplied;

  useEffect(() => {
    const stored = parseStoredInterviewSession(window.localStorage.getItem(INTERVIEW_SESSION_STORAGE_KEY));
    globalThis.queueMicrotask(() => {
      if (stored) {
        setInterviewTurns(stored.turns);
        setInterviewResult(stored.result);
        setInterviewNetworkValidated(false);
      } else {
        window.localStorage.removeItem(INTERVIEW_SESSION_STORAGE_KEY);
      }
      setInterviewSessionReady(true);
    });
  }, []);

  useEffect(() => {
    if (!interviewSessionReady || !interviewResult) return;
    try {
      window.localStorage.setItem(INTERVIEW_SESSION_STORAGE_KEY, serializeInterviewSession(interviewTurns, interviewResult));
    } catch {
      // The server-persisted curriculum remains authoritative if browser storage is full or disabled.
    }
  }, [interviewResult, interviewSessionReady, interviewTurns]);

  const updateDraft = (value: SetStateAction<CurriculumDocument>) => {
    draftVersionRef.current += 1;
    setDraft(value);
  };

  const changeDraft = (mutate: (next: CurriculumDocument) => void) => {
    updateDraft((current) => {
      const next = structuredClone(current);
      mutate(next);
      return next;
    });
    setSaveState("editing");
    setSaveMessage(t("studio.message.localValidation"));
  };

  useEffect(() => {
    if (!shouldStartCurriculumAutosave({
      saveState,
      draftEqualsActive: serializedDraft === serializedActive,
      valid: validation.ok,
      conflict,
      interviewProposalPending,
    })) return;
    const timer = window.setTimeout(() => {
      const savedDraftVersion = draftVersionRef.current;
      const saveAttempt = ++saveAttemptRef.current;
      setSaveState("saving");
      setSaveMessage(t("studio.saving"));
      setCurriculumMutationsInFlight((count) => count + 1);
      void active.save(draft)
        .then(() => {
          if (!isCurrentSaveAttempt(saveAttempt, saveAttemptRef.current)) return;
          setConflict(false);
          const outcome = autosaveStatusAfterSuccess(savedDraftVersion, draftVersionRef.current);
          setSaveState(outcome);
          setSaveMessage(outcome === "saved"
            ? t("studio.message.savedAll")
            : t("studio.message.newerPending"));
        })
        .catch((error: unknown) => {
          if (!isCurrentSaveAttempt(saveAttempt, saveAttemptRef.current)) return;
          setSaveState("error");
          if (error instanceof CurriculumApiError && error.status === 412) {
            setConflict(true);
            void active.refresh().catch(() => undefined);
            setSaveMessage(t("studio.message.conflict"));
          } else {
            setSaveMessage(error instanceof Error ? error.message : t("studio.message.saveFailed"));
          }
        })
        .finally(() => setCurriculumMutationsInFlight((count) => Math.max(0, count - 1)));
    }, 500);
    return () => window.clearTimeout(timer);
  }, [active, conflict, draft, interviewProposalPending, saveState, serializedActive, serializedDraft, t, validation.ok]);

  function switchMode(nextMode: CurriculumEditorMode) {
    if (nextMode === "json") {
      setJsonText(JSON.stringify(draft, null, 2));
      setJsonError("");
    }
    setMode(nextMode);
  }

  function handleModeKeyDown(event: KeyboardEvent<HTMLButtonElement>, current: CurriculumEditorMode) {
    const next = nextEditorMode(current, event.key);
    if (!next) return;
    event.preventDefault();
    switchMode(next);
    window.requestAnimationFrame(() => {
      globalThis.document.getElementById(`curriculum-tab-${next}`)?.focus();
    });
  }

  function createFromGuide() {
    const candidate = createGuidedCurriculum({
      ...guide,
      takeaways: guide.takeawaysText.split("\n").map((item) => item.trim()).filter(Boolean),
    });
    const result = validateCurriculumDocument(candidate);
    if (!result.ok) {
      setSaveState("error");
      setSaveMessage(t("studio.message.guideIncomplete", { error: result.errors[0] }));
      return;
    }
    if (!window.confirm(t("studio.confirm.replaceDraft"))) return;
    updateDraft(candidate);
    setJsonText(JSON.stringify(candidate, null, 2));
    setMode("visual");
    setSaveState("editing");
    setSaveMessage(t("studio.message.guideReady"));
  }

  async function requestInterview(body: InterviewRequest) {
    if (!acquireInterviewRequestLock(interviewRequestLockRef)) return;
    const previousResult = interviewResult;
    setInterviewLoading(true);
    setInterviewError("");
    try {
      const response = await fetch("/api/curriculum/interview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        if (response.status === 410) throw new Error(t("studio.message.sessionExpired"));
        throw new Error(response.status === 429 ? t("studio.message.codexBusy") : t("studio.message.interviewUnavailable"));
      }
      const raw = await response.json() as unknown;
      const streamedError = interviewStreamedErrorMessage(raw);
      if (streamedError) throw new Error(streamedError.includes("occupé") ? t("studio.message.codexBusy") : t("studio.message.interviewUnavailable"));
      const parsed = validateInterviewResponse(raw);
      if (!parsed.ok) throw new Error(t("studio.message.invalidResponse"));
      setInterviewNetworkValidated(true);
      setInterviewResult(parsed.value);
      setInterviewTurns((current) => {
        if (Object.keys(body).length === 0 || "locale" in body) {
          return parsed.value.phase === "question" ? [{ kind: "question", question: parsed.value.message, choices: parsed.value.choices, stateBeforeAnswer: parsed.value.state, progress: parsed.value.progress }] : current;
        }
        let next = [...current];
        if (!("action" in body) && "answer" in body) {
          next = current.map((turn, index) => index === current.length - 1 ? { ...turn, answer: body.answer } : turn);
        } else if ("action" in body && previousResult?.phase === "confirmation") {
          next.push({ kind: "confirmation", question: previousResult.message, choices: [], answer: body.action === "confirm" ? "Résumé confirmé explicitement." : body.answer, stateBeforeAnswer: previousResult.state, progress: previousResult.progress });
        }
        if (parsed.value.phase === "question") next.push({ kind: "question", question: parsed.value.message, choices: parsed.value.choices, stateBeforeAnswer: parsed.value.state, progress: parsed.value.progress });
        return next;
      });
      if (shouldApplyInterviewProposal(body, parsed.value) && parsed.value.phase === "proposal") {
        await applyInterviewDocument(parsed.value.document);
      }
    } catch (error) {
      setInterviewError(error instanceof Error ? error.message : t("studio.message.interviewFailed"));
    } finally {
      releaseInterviewRequestLock(interviewRequestLockRef);
      setInterviewLoading(false);
    }
  }

  function submitInterview() {
    const content = interviewInput.trim();
    const current = interviewTurns.at(-1);
    if (!content || !current || interviewLoading || interviewRequestLockRef.current || interviewResult?.phase === "proposal" || interviewResult?.phase === "confirmation") return;
    setInterviewInput("");
    void requestInterview({ state: current.stateBeforeAnswer, answer: content });
  }

  function confirmInterviewSummary() {
    if (interviewResult?.phase !== "confirmation" || interviewLoading || interviewRequestLockRef.current) return;
    setInterviewInput("");
    void requestInterview({ state: interviewResult.state, action: "confirm" });
  }

  function reviseInterviewSummary() {
    const correction = interviewInput.trim();
    if (interviewResult?.phase !== "confirmation" || !correction || interviewLoading || interviewRequestLockRef.current) return;
    setInterviewInput("");
    setInterviewNetworkValidated(false);
    void requestInterview({ state: interviewResult.state, action: "revise", answer: correction });
  }

  function editInterviewAnswer(index: number) {
    const turn = interviewTurns[index];
    if (!turn?.answer || interviewLoading || interviewRequestLockRef.current) return;
    setInterviewTurns(interviewTurns.slice(0, index + 1).map((item, itemIndex) => itemIndex === index ? { ...item, answer: undefined } : item));
    setInterviewInput(turn.answer);
    setInterviewResult(turn.kind === "question"
      ? { phase: "question", message: turn.question, choices: turn.choices, progress: turn.progress, document: null, state: turn.stateBeforeAnswer }
      : { phase: "confirmation", message: turn.question, choices: [], progress: turn.progress, document: null, state: turn.stateBeforeAnswer });
    setInterviewNetworkValidated(false);
    setInterviewError("");
  }

  function restartInterview() {
    if (interviewRequestLockRef.current) return;
    setInterviewTurns([]);
    setInterviewResult(null);
    setInterviewInput("");
    setInterviewError("");
    setInterviewNetworkValidated(false);
    window.localStorage.removeItem(INTERVIEW_SESSION_STORAGE_KEY);
    void requestInterview({ locale });
  }

  async function applyInterviewDocument(document: CurriculumDocument) {
    const draftVersionAtStart = draftVersionRef.current;
    const saveAttempt = ++saveAttemptRef.current;
    setSaveState("saving");
    setSaveMessage(t("studio.message.applying"));
    setCurriculumMutationsInFlight((count) => count + 1);
    try {
      await active.save(document);
      if (!isCurrentSaveAttempt(saveAttempt, saveAttemptRef.current)) return;
      const replaceDraft = shouldReplaceDraftAfterInterviewApply(draftVersionAtStart, draftVersionRef.current);
      if (replaceDraft) {
        updateDraft(structuredClone(document));
        setJsonText(JSON.stringify(document, null, 2));
      }
      setConflict(false);
      setSaveState(replaceDraft ? "saved" : "editing");
      setSaveMessage(replaceDraft
        ? t("studio.message.appliedAnswers")
        : t("studio.message.savedNewer"));
    } catch (error) {
      if (!isCurrentSaveAttempt(saveAttempt, saveAttemptRef.current)) return;
      setSaveState("error");
      if (error instanceof CurriculumApiError && requiresFreshInterviewAfterSaveError(error.status)) {
        setInterviewNetworkValidated(false);
      }
      if (error instanceof CurriculumApiError && error.status === 412) {
        setConflict(true);
        await active.refresh().catch(() => undefined);
        setSaveMessage(t("studio.message.applyConflict"));
      } else {
        setSaveMessage(error instanceof Error ? error.message : t("studio.message.generatedSaveFailed"));
      }
    } finally {
      setCurriculumMutationsInFlight((count) => Math.max(0, count - 1));
    }
  }

  function useInterviewCurriculum() {
    if (!interviewResult || !canRetryInterviewProposal(interviewResult, interviewNetworkValidated)) {
      setInterviewError(t("studio.message.regenerate"));
      return;
    }
    void applyInterviewDocument(interviewResult.document);
  }

  function applyJson() {
    try {
      const parsed = JSON.parse(jsonText) as unknown;
      const result = validateCurriculumDocument(parsed);
      if (!result.ok) {
        setJsonError(result.errors.slice(0, 8).join("\n"));
        return;
      }
      updateDraft(parsed as CurriculumDocument);
      setJsonError("");
      setSaveState("editing");
      setSaveMessage(t("studio.message.jsonValid"));
    } catch (error) {
      setJsonError(error instanceof Error ? error.message : t("studio.message.jsonInvalid"));
    }
  }

  async function importJson(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      setSaveState("error");
      setSaveMessage(t("studio.message.importLarge"));
      return;
    }
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const result = validateCurriculumDocument(parsed);
      if (!result.ok) {
        setSaveState("error");
        setSaveMessage(t("studio.message.importInvalid", { error: result.errors[0] }));
        return;
      }
      const candidate = parsed as CurriculumDocument;
      const oldSubjectIds = new Set(draft.subjects.map((subject) => subject.id));
      const newSubjectIds = new Set(candidate.subjects.map((subject) => subject.id));
      const oldLessonIds = new Set(draft.subjects.flatMap((subject) => subject.lessons.map((lesson) => lesson.id)));
      const newLessonIds = new Set(candidate.subjects.flatMap((subject) => subject.lessons.map((lesson) => lesson.id)));
      const removedSubjects = [...oldSubjectIds].filter((id) => !newSubjectIds.has(id)).length;
      const removedLessons = [...oldLessonIds].filter((id) => !newLessonIds.has(id)).length;
      if (!window.confirm(t("studio.confirm.import", { subjects: removedSubjects, lessons: removedLessons }))) return;
      updateDraft(candidate);
      setJsonText(JSON.stringify(candidate, null, 2));
      setSaveState("editing");
      setSaveMessage(t("studio.message.importValid"));
    } catch {
      setSaveState("error");
      setSaveMessage(t("studio.message.importInvalid", { error: t("studio.message.jsonInvalid") }));
    }
  }

  function exportJson() {
    const blob = new Blob([`${JSON.stringify(draft, null, 2)}\n`], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = globalThis.document.createElement("a");
    link.href = url;
    link.download = `curriculum-${slugifyCurriculumId(draft.subject, "scio")}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function loadServerVersion() {
    const saveAttempt = ++saveAttemptRef.current;
    setSaveState("saving");
    setSaveMessage(t("studio.message.loadingServer"));
    try {
      const latest = await active.refresh();
      if (!isCurrentSaveAttempt(saveAttempt, saveAttemptRef.current)) return;
      updateDraft(structuredClone(latest.document));
      setGuide(guideFromDocument(latest.document));
      setJsonText(JSON.stringify(latest.document, null, 2));
      setConflict(false);
      setSaveState("saved");
      setSaveMessage(t("studio.message.serverLoaded"));
    } catch (error) {
      if (!isCurrentSaveAttempt(saveAttempt, saveAttemptRef.current)) return;
      setSaveState("error");
      setSaveMessage(error instanceof Error ? error.message : t("studio.message.serverLoadFailed"));
    }
  }

  function overwriteAfterConflict() {
    if (!window.confirm(t("studio.confirm.overwrite"))) return;
    setConflict(false);
    setSaveState("editing");
    setSaveMessage(t("studio.message.overwriteConfirmed"));
  }

  async function restoreDelivered() {
    if (!window.confirm(t("studio.confirm.restore"))) return;
    const saveAttempt = ++saveAttemptRef.current;
    setSaveState("saving");
    setSaveMessage(t("studio.message.restoring"));
    setCurriculumMutationsInFlight((count) => count + 1);
    try {
      const restored = await active.reset();
      if (!isCurrentSaveAttempt(saveAttempt, saveAttemptRef.current)) return;
      updateDraft(structuredClone(restored.document));
      setGuide(guideFromDocument(restored.document));
      setJsonText(JSON.stringify(restored.document, null, 2));
      setConflict(false);
      setSaveState("saved");
      setSaveMessage(t("studio.message.restored"));
    } catch (error) {
      if (!isCurrentSaveAttempt(saveAttempt, saveAttemptRef.current)) return;
      if (error instanceof CurriculumApiError && error.status === 412) {
        setConflict(true);
        void active.refresh().catch(() => undefined);
        setSaveMessage(t("studio.message.conflict"));
      } else {
        setSaveMessage(error instanceof Error ? error.message : t("studio.message.restoreFailed"));
      }
      setSaveState("error");
    } finally {
      setCurriculumMutationsInFlight((count) => Math.max(0, count - 1));
    }
  }

  function updateSubjectId(subjectIndex: number, id: string) {
    changeDraft((next) => {
      const previous = next.subjects[subjectIndex].id;
      next.subjects[subjectIndex].id = id;
      next.cards = next.cards.map((card) => card.subjectId === previous ? { ...card, subjectId: id } : card);
    });
  }

  function updateLessonId(subjectIndex: number, lessonIndex: number, id: string) {
    changeDraft((next) => {
      const previous = next.subjects[subjectIndex].lessons[lessonIndex].id;
      next.subjects[subjectIndex].lessons[lessonIndex].id = id;
      next.cards = next.cards.map((card) => card.lessonId === previous ? { ...card, lessonId: id } : card);
    });
  }

  function duplicateLesson(subjectIndex: number, lessonIndex: number) {
    changeDraft((next) => {
      const ids = new Set(next.subjects.flatMap((subject) => subject.lessons.map((lesson) => lesson.id)));
      const original = next.subjects[subjectIndex].lessons[lessonIndex];
      const copy = structuredClone(original);
      copy.id = nextId(`${original.id}-copie`, ids, 60);
      copy.title = `${original.title} — copie`;
      next.subjects[subjectIndex].lessons.splice(lessonIndex + 1, 0, copy);
    });
  }

  function duplicateCard(cardIndex: number) {
    changeDraft((next) => {
      const ids = new Set(next.cards.map((card) => card.id));
      const copy = structuredClone(next.cards[cardIndex]);
      copy.id = nextId(`${copy.id}-copie`, ids, 40);
      next.cards.splice(cardIndex + 1, 0, copy);
    });
  }

  const statusOn = saveState === "saved" || saveState === "saving";
  const validationMessage = validation.ok
    ? validation.warnings[0]
    : `${validation.errors.length} erreur(s) : ${validation.errors.slice(0, 3).join(" · ")}`;

  return (
    <div className="bx-curriculum-editor">
      <div className="bx-editor-head">
        <div>
          <p className="bx-overline">Curriculum Studio</p>
          <h2>{t("studio.heading")}</h2>
          <p className="bx-muted">{t("studio.intro")}</p>
        </div>
        <div className="bx-editor-status">
          <Status on={statusOn}>{saveState === "saving" ? t("studio.saving") : saveState === "saved" ? t("studio.saved") : saveState === "error" ? t("studio.status.error") : t("studio.status.draft")}</Status>
          <span className="bx-muted">{active.source === "override" ? t("studio.customCurriculum") : t("studio.deliveredCurriculum")}</span>
        </div>
      </div>

      <div className="bx-editor-toolbar">
        <div className="bx-segmented" role="tablist" aria-label={t("studio.modeLabel")}>
          {EDITOR_MODES.map((item) => (
            <button
              key={item}
              id={`curriculum-tab-${item}`}
              type="button"
              role="tab"
              aria-controls={`curriculum-panel-${item}`}
              aria-selected={mode === item}
              tabIndex={mode === item ? 0 : -1}
              onClick={() => switchMode(item)}
              onKeyDown={(event) => handleModeKeyDown(event, item)}
            >
              {item === "guide" ? t("studio.mode.guide") : item === "visual" ? t("studio.mode.visual") : item === "json" ? t("studio.mode.json") : t("studio.mode.interview")}
            </button>
          ))}
        </div>
        <div className="bx-inline">
          <input ref={fileInput} className="bx-file-hidden" type="file" accept="application/json,.json" onChange={(event) => void importJson(event)} />
          <button type="button" className="bx-btn bx-btn-ghost" onClick={() => fileInput.current?.click()}>{t("studio.import")}</button>
          <button type="button" className="bx-btn bx-btn-ghost" onClick={exportJson}>{t("studio.export")}</button>
          <button type="button" className="bx-btn bx-btn-ghost" onClick={() => void restoreDelivered()}>{t("studio.reset")}</button>
        </div>
      </div>

      <div className={validation.ok ? "bx-editor-notice" : "bx-editor-notice is-error"} role="status">
        <strong>{saveMessage}</strong>
        <span>{validationMessage}</span>
        {conflict ? (
          <div className="bx-inline">
            <button type="button" className="bx-btn" onClick={() => void loadServerVersion()}>{t("studio.loadServer")}</button>
            <button type="button" className="bx-btn bx-btn-ghost" onClick={overwriteAfterConflict}>{t("studio.overwriteDraft")}</button>
          </div>
        ) : null}
      </div>

      <div
        className="bx-editor-panel"
        id="curriculum-panel-guide"
        role="tabpanel"
        aria-labelledby="curriculum-tab-guide"
        tabIndex={0}
        hidden={mode !== "guide"}
      >
          <div className="bx-editor-steps" aria-label={t("studio.stepsLabel")}>
            {[t("studio.step.objective"), t("studio.step.lesson"), t("studio.step.validation")].map((label, index) => (
              <button key={label} type="button" className={guideStep === index ? "is-active" : undefined} onClick={() => setGuideStep(index)}>
                <span>0{index + 1}</span>{label}
              </button>
            ))}
          </div>

          {guideStep === 0 ? (
            <div className="bx-editor-grid">
              <TextField label={t("studio.learningSubject")} value={guide.subject} onChange={(value) => setGuide({ ...guide, subject: value })} wide />
              <AreaField label={t("studio.concreteResult")} value={guide.goal} onChange={(value) => setGuide({ ...guide, goal: value })} />
              <Field label={t("studio.levelField")}>
                <select className="bx-select" value={guide.level} onChange={(event) => setGuide({ ...guide, level: event.target.value as GuideForm["level"] })}>
                  <option value="debutant">{t("studio.level.beginner")}</option><option value="intermediaire">{t("studio.level.intermediate")}</option><option value="avance">{t("studio.level.advanced")}</option>
                </select>
              </Field>
              <Field label={t("studio.sessionDuration")}>
                <select className="bx-select" value={guide.sessionMinutes} onChange={(event) => setGuide({ ...guide, sessionMinutes: Number(event.target.value) as GuideForm["sessionMinutes"] })}>
                  {SESSION_MINUTES.map((minutes) => <option key={minutes} value={minutes}>{minutes} minutes</option>)}
                </select>
              </Field>
              <TextField label={t("studio.firstSubject")} value={guide.subjectTitle} onChange={(value) => setGuide({ ...guide, subjectTitle: value })} />
              <TextField label={t("studio.monochromeGlyph")} value={guide.subjectIcon} onChange={(value) => setGuide({ ...guide, subjectIcon: value })} />
              <TextField label={t("studio.levelSubtitle")} value={guide.subjectLevel} onChange={(value) => setGuide({ ...guide, subjectLevel: value })} wide />
            </div>
          ) : null}

          {guideStep === 1 ? (
            <div className="bx-editor-grid">
              <TextField label={t("studio.firstLesson")} value={guide.lessonTitle} onChange={(value) => setGuide({ ...guide, lessonTitle: value })} wide />
              <AreaField label={t("studio.observableGoal")} value={guide.objective} onChange={(value) => setGuide({ ...guide, objective: value })} />
              <AreaField label={t("studio.transferExercise")} value={guide.prompt} onChange={(value) => setGuide({ ...guide, prompt: value })} />
              <AreaField label={t("studio.takeaways")} value={guide.takeawaysText} onChange={(value) => setGuide({ ...guide, takeawaysText: value })} rows={4} />
              <TextField label={t("studio.sourceTitle")} value={guide.sourceTitle} onChange={(value) => setGuide({ ...guide, sourceTitle: value })} />
              <TextField label={t("studio.provider")} value={guide.provider} onChange={(value) => setGuide({ ...guide, provider: value })} />
              <TextField label={t("studio.sourceUrl")} type="url" value={guide.sourceUrl} onChange={(value) => setGuide({ ...guide, sourceUrl: value })} wide />
              <TextField label={t("studio.minutes")} type="number" value={guide.minutes} onChange={(value) => setGuide({ ...guide, minutes: Number(value) })} />
              <AreaField label={t("studio.whySource")} value={guide.why} onChange={(value) => setGuide({ ...guide, why: value })} />
              <AreaField label={t("studio.freeAccess")} value={guide.accessNote} onChange={(value) => setGuide({ ...guide, accessNote: value })} />
              <AreaField label={t("studio.studySegment")} value={guide.segmentLabel} onChange={(value) => setGuide({ ...guide, segmentLabel: value })} />
            </div>
          ) : null}

          {guideStep === 2 ? (
            <div className="bx-editor-review">
              <div className="bx-metric-grid">
                <div className="bx-metric"><span className="bx-metric-value">1</span><span className="bx-metric-label">{t("studio.initialSubject")}</span></div>
                <div className="bx-metric"><span className="bx-metric-value">1</span><span className="bx-metric-label">{t("studio.initialLesson")}</span></div>
                <div className="bx-metric"><span className="bx-metric-value">3</span><span className="bx-metric-label">{t("studio.generatedCards")}</span></div>
              </div>
              <p className="bx-muted">{t("studio.noAi")}</p>
              <button type="button" className="bx-btn" onClick={createFromGuide}>{t("studio.create")}</button>
            </div>
          ) : null}

          <div className="bx-between">
            <button type="button" className="bx-btn bx-btn-ghost" disabled={guideStep === 0} onClick={() => setGuideStep((step) => Math.max(0, step - 1))}>{t("studio.previous")}</button>
            <button type="button" className="bx-btn" disabled={guideStep === 2} onClick={() => setGuideStep((step) => Math.min(2, step + 1))}>{t("studio.continue")}</button>
          </div>
      </div>

      <div
        className="bx-editor-panel"
        id="curriculum-panel-visual"
        role="tabpanel"
        aria-labelledby="curriculum-tab-visual"
        tabIndex={0}
        hidden={mode !== "visual"}
      >
          <div className="bx-between">
            <h3>{t("studio.generalInfo")}</h3>
            <label className="bx-editor-switch"><input type="checkbox" checked={unlockIds} onChange={(event) => setUnlockIds(event.target.checked)} /> {t("studio.unlockIds")}</label>
          </div>
          <div className="bx-editor-grid">
            <TextField label={t("studio.subject")} value={draft.subject} onChange={(value) => changeDraft((next) => { next.subject = value; })} wide />
            <AreaField label={t("studio.goal")} value={draft.goal} onChange={(value) => changeDraft((next) => { next.goal = value; })} />
            <Field label={t("studio.levelField")}>
              <select className="bx-select" value={draft.level ?? "debutant"} onChange={(event) => changeDraft((next) => { next.level = event.target.value as CurriculumDocument["level"]; })}>
                <option value="debutant">{t("studio.level.beginner")}</option><option value="intermediaire">{t("studio.level.intermediate")}</option><option value="avance">{t("studio.level.advanced")}</option>
              </select>
            </Field>
            <Field label={t("studio.sessionDuration")}>
              <select className="bx-select" value={draft.sessionMinutes ?? 30} onChange={(event) => changeDraft((next) => { next.sessionMinutes = Number(event.target.value) as CurriculumDocument["sessionMinutes"]; })}>
                {SESSION_MINUTES.map((minutes) => <option key={minutes} value={minutes}>{minutes} minutes</option>)}
              </select>
            </Field>
            <TextField label={t("studio.curriculumDate")} type="date" value={draft.generatedAt} onChange={(value) => changeDraft((next) => { next.generatedAt = value; })} />
            <TextField label={t("studio.contentLanguage")} value={draft.language ?? "fr"} onChange={(value) => changeDraft((next) => { next.language = value; })} />
          </div>

          <div className="bx-editor-section-head"><h3>{t("studio.subjectsLessons")}</h3><span>{t("studio.subjectCount", { count: draft.subjects.length })}</span></div>
          {draft.subjects.map((subject, subjectIndex) => (
            <details className="bx-editor-details" key={`${subject.id}-${subjectIndex}`} open={subjectIndex === 0}>
              <summary><span>{subject.icon} {subject.title}</span><small>{t("studio.lessonCount", { count: subject.lessons.length })}</small></summary>
              <div className="bx-editor-actions">
                <button type="button" aria-label={t("studio.moveUp")} onClick={() => changeDraft((next) => { next.subjects = moveItem(next.subjects, subjectIndex, -1); })}>↑</button>
                <button type="button" aria-label={t("studio.moveDown")} onClick={() => changeDraft((next) => { next.subjects = moveItem(next.subjects, subjectIndex, 1); })}>↓</button>
                <button type="button" onClick={() => { updateDraft((current) => duplicateSubject(current, subjectIndex)); setSaveState("editing"); setSaveMessage(t("studio.message.duplicated")); }}>{t("common.duplicate")}</button>
                <button type="button" disabled={draft.subjects.length <= 1} onClick={() => {
                  const linked = draft.cards.filter((card) => card.subjectId === subject.id).length;
                  if (!window.confirm(t("studio.confirm.deleteSubject", { cards: linked }))) return;
                  changeDraft((next) => { next.subjects.splice(subjectIndex, 1); next.cards = next.cards.filter((card) => card.subjectId !== subject.id); });
                }}>{t("common.delete")}</button>
              </div>
              <div className="bx-editor-grid">
                <TextField label={t("studio.subjectId")} value={subject.id} disabled={!unlockIds} onChange={(value) => updateSubjectId(subjectIndex, value)} />
                <TextField label={t("studio.glyph")} value={subject.icon} onChange={(value) => changeDraft((next) => { next.subjects[subjectIndex].icon = value; })} />
                <TextField label={t("studio.title")} value={subject.title} onChange={(value) => changeDraft((next) => { next.subjects[subjectIndex].title = value; })} />
                <TextField label={t("studio.level")} value={subject.level} onChange={(value) => changeDraft((next) => { next.subjects[subjectIndex].level = value; })} />
              </div>

              {subject.lessons.map((lesson, lessonIndex) => (
                <details className="bx-editor-details is-nested" key={`${lesson.id}-${lessonIndex}`}>
                  <summary><span>{t("studio.lessonNumber", { count: lessonIndex + 1 })} · {lesson.title}</span><small>{lesson.source.provider}</small></summary>
                  <div className="bx-editor-actions">
                    <button type="button" aria-label={t("studio.moveUp")} onClick={() => changeDraft((next) => { next.subjects[subjectIndex].lessons = moveItem(next.subjects[subjectIndex].lessons, lessonIndex, -1); })}>↑</button>
                    <button type="button" aria-label={t("studio.moveDown")} onClick={() => changeDraft((next) => { next.subjects[subjectIndex].lessons = moveItem(next.subjects[subjectIndex].lessons, lessonIndex, 1); })}>↓</button>
                    <button type="button" onClick={() => duplicateLesson(subjectIndex, lessonIndex)}>{t("common.duplicate")}</button>
                    <button type="button" disabled={subject.lessons.length <= 1} onClick={() => {
                      const linked = draft.cards.filter((card) => card.lessonId === lesson.id).length;
                      if (!window.confirm(t("studio.confirm.deleteLesson", { cards: linked }))) return;
                      changeDraft((next) => { next.subjects[subjectIndex].lessons.splice(lessonIndex, 1); next.cards = next.cards.filter((card) => card.lessonId !== lesson.id); });
                    }}>{t("common.delete")}</button>
                  </div>
                  <div className="bx-editor-grid">
                    <TextField label={t("studio.lessonId")} value={lesson.id} disabled={!unlockIds} onChange={(value) => updateLessonId(subjectIndex, lessonIndex, value)} />
                    <TextField label={t("studio.title")} value={lesson.title} onChange={(value) => changeDraft((next) => { next.subjects[subjectIndex].lessons[lessonIndex].title = value; })} wide />
                    <AreaField label={t("studio.observableGoal")} value={lesson.objective} onChange={(value) => changeDraft((next) => { next.subjects[subjectIndex].lessons[lessonIndex].objective = value; })} />
                    <AreaField label={t("studio.exercisePrompt")} value={lesson.prompt} onChange={(value) => changeDraft((next) => { next.subjects[subjectIndex].lessons[lessonIndex].prompt = value; })} />
                    <AreaField label={t("studio.takeaways")} value={lesson.keyTakeaways.join("\n")} onChange={(value) => changeDraft((next) => { next.subjects[subjectIndex].lessons[lessonIndex].keyTakeaways = value.split("\n"); })} rows={5} />
                  </div>
                  <h4>{t("studio.primarySource")}</h4>
                  <SourceFields source={lesson.source} onChange={(source) => changeDraft((next) => { next.subjects[subjectIndex].lessons[lessonIndex].source = source; })} />
                  <div className="bx-editor-section-head"><h4>{t("studio.fallbackSources")}</h4><button type="button" className="bx-link" disabled={(lesson.alternatives?.length ?? 0) >= 3} onClick={() => changeDraft((next) => { const target = next.subjects[subjectIndex].lessons[lessonIndex]; target.alternatives = [...(target.alternatives ?? []), structuredClone(target.source)]; })}>{t("studio.addSource")}</button></div>
                  {(lesson.alternatives ?? []).map((alternative, alternativeIndex) => (
                    <details className="bx-editor-details is-source" key={`${alternative.url}-${alternativeIndex}`}>
                      <summary><span>{t("studio.fallbackNumber", { count: alternativeIndex + 1 })} · {alternative.title}</span></summary>
                      <button type="button" className="bx-link" onClick={() => changeDraft((next) => { next.subjects[subjectIndex].lessons[lessonIndex].alternatives?.splice(alternativeIndex, 1); })}>{t("studio.deleteSource")}</button>
                      <SourceFields source={alternative} onChange={(source) => changeDraft((next) => { const alternatives = next.subjects[subjectIndex].lessons[lessonIndex].alternatives ?? []; alternatives[alternativeIndex] = source; })} />
                    </details>
                  ))}
                </details>
              ))}
            </details>
          ))}

          <div className="bx-editor-section-head"><h3>{t("studio.reviewCards")}</h3><span>{t("studio.cardCount", { count: draft.cards.length })}</span></div>
          {draft.cards.map((card, cardIndex) => (
            <details className="bx-editor-details is-nested" key={`${card.id}-${cardIndex}`}>
              <summary><span>{card.type} · {card.front}</span></summary>
              <div className="bx-editor-actions">
                <button type="button" aria-label={t("studio.moveUp")} onClick={() => changeDraft((next) => { next.cards = moveItem(next.cards, cardIndex, -1); })}>↑</button>
                <button type="button" aria-label={t("studio.moveDown")} onClick={() => changeDraft((next) => { next.cards = moveItem(next.cards, cardIndex, 1); })}>↓</button>
                <button type="button" onClick={() => duplicateCard(cardIndex)}>{t("common.duplicate")}</button>
                <button type="button" disabled={draft.cards.length <= 3} onClick={() => changeDraft((next) => { next.cards.splice(cardIndex, 1); })}>{t("common.delete")}</button>
              </div>
              <div className="bx-editor-grid">
                <TextField label={t("studio.cardId")} value={card.id} disabled={!unlockIds} onChange={(value) => changeDraft((next) => { next.cards[cardIndex].id = value; })} />
                <TextField label={t("studio.type")} value={card.type} onChange={(value) => changeDraft((next) => { next.cards[cardIndex].type = value; })} />
                <AreaField label={t("studio.question")} value={card.front} onChange={(value) => changeDraft((next) => { next.cards[cardIndex].front = value; })} />
                <AreaField label={t("studio.answer")} value={card.back} onChange={(value) => changeDraft((next) => { next.cards[cardIndex].back = value; })} />
                <Field label={t("studio.linkedSubject")}>
                  <select className="bx-select" value={card.subjectId ?? ""} onChange={(event) => changeDraft((next) => {
                    const nextSubjectId = event.target.value || undefined;
                    const nextSubject = next.subjects.find((item) => item.id === nextSubjectId);
                    next.cards[cardIndex].subjectId = nextSubjectId;
                    if (!nextSubject?.lessons.some((lesson) => lesson.id === next.cards[cardIndex].lessonId)) {
                      next.cards[cardIndex].lessonId = undefined;
                    }
                  })}>
                    <option value="">{t("studio.noneLinked")}</option>{draft.subjects.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                  </select>
                </Field>
                <Field label={t("studio.linkedLesson")}>
                  <select className="bx-select" value={card.lessonId ?? ""} onChange={(event) => changeDraft((next) => { next.cards[cardIndex].lessonId = event.target.value || undefined; })}>
                    <option value="">{t("studio.noneLinked")}</option>{(draft.subjects.find((item) => item.id === card.subjectId)?.lessons ?? []).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                  </select>
                </Field>
              </div>
            </details>
          ))}
      </div>

      <div
        className="bx-editor-panel"
        id="curriculum-panel-json"
        role="tabpanel"
        aria-labelledby="curriculum-tab-json"
        tabIndex={0}
        hidden={mode !== "json"}
      >
          <p className="bx-muted">{t("studio.jsonCopy")}</p>
          <textarea
            className="bx-code bx-json-editor"
            value={jsonText}
            onChange={(event) => setJsonText(event.target.value)}
            disabled={isJsonEditorDisabled(curriculumMutationsInFlight)}
            spellCheck={false}
          />
          {jsonError ? <pre className="bx-editor-json-error">{jsonError}</pre> : null}
          <button type="button" className="bx-btn" onClick={applyJson} disabled={isJsonEditorDisabled(curriculumMutationsInFlight)}>{t("studio.applyDraft")}</button>
      </div>

      <div
        className="bx-editor-panel"
        id="curriculum-panel-interview"
        role="tabpanel"
        aria-labelledby="curriculum-tab-interview"
        tabIndex={0}
        hidden={mode !== "interview"}
      >
        <div className="bx-between">
          <div>
            <h3>{t("studio.adaptiveInterview")}</h3>
            <p className="bx-muted">{t("studio.interviewCopy")}</p>
            <p className="bx-muted">{t("studio.interviewPrivacy")}</p>
          </div>
          <button type="button" className="bx-btn bx-btn-ghost" onClick={restartInterview} disabled={interviewLoading}>{interviewTurns.length ? t("studio.restart") : t("studio.start")}</button>
        </div>
        <div className="bx-interview-progress">
          <label htmlFor="interview-progress">{t("studio.progress")}</label>
          <progress id="interview-progress" max={100} value={interviewResult?.progress ?? 0}>{interviewResult?.progress ?? 0}%</progress>
        </div>
        <div className="bx-interview-chat" aria-live="polite" aria-busy={interviewLoading}>
          {interviewTurns.length === 0 && !interviewLoading ? <p className="bx-muted">{t("studio.startPrompt")}</p> : null}
          {interviewTurns.map((turn, index) => (
            <div className="bx-interview-turn" key={`${index}-${turn.stateBeforeAnswer.slice(-8)}`}>
              <div className="bx-interview-message is-assistant"><strong>Codex</strong><p>{turn.question}</p></div>
              {turn.answer ? <div className="bx-interview-message is-user"><strong>{t("common.you")}</strong><p>{turn.answer}</p><button type="button" className="bx-btn bx-btn-ghost" onClick={() => editInterviewAnswer(index)} disabled={interviewLoading}>{t("studio.editAnswer")}</button></div> : null}
            </div>
          ))}
          {(interviewResult?.phase === "confirmation" || interviewResult?.phase === "proposal") ? <div className="bx-interview-message is-assistant"><strong>Codex</strong><p>{interviewResult.message}</p></div> : null}
          {interviewLoading ? <p role="status">{t("studio.working")}</p> : null}
        </div>
        {interviewError ? <div className="bx-editor-notice is-error" role="alert">{interviewError}</div> : null}
        {interviewResult?.phase === "proposal" ? (
          <div className="bx-editor-review">
            <h3>{interviewApplied ? t("studio.appliedTitle") : t("studio.previewTitle")}</h3>
            <p><strong>{interviewResult.document.subject}</strong> — {interviewResult.document.goal}</p>
            <p className="bx-muted">{t("studio.interviewSummary", { subjects: interviewResult.document.subjects.length, lessons: interviewResult.document.subjects.reduce((total, subject) => total + subject.lessons.length, 0), cards: interviewResult.document.cards.length, minutes: interviewResult.document.sessionMinutes ?? 30 })}</p>
            {interviewResult.document.subjects.map((subject) => (
              <details className="bx-editor-details" key={subject.id}>
                <summary>{subject.icon} {subject.title} · {subject.level} · {t("studio.lessonCount", { count: subject.lessons.length })}</summary>
                {subject.lessons.map((lesson) => (
                  <details className="bx-editor-details is-nested" key={lesson.id}>
                    <summary>{lesson.title}</summary>
                    <p><strong>{t("studio.objectiveLabel")}</strong> {lesson.objective}</p>
                    <p><strong>{t("studio.keyIdeasLabel")}</strong></p>
                    <ul>{lesson.keyTakeaways.map((keyTakeaway) => <li key={keyTakeaway}>{keyTakeaway}</li>)}</ul>
                    <p><strong>{t("studio.transferLabel")}</strong> {lesson.prompt}</p>
                    <div className="bx-editor-notice">
                      <p><strong>{t("studio.sourceLabel")}</strong> <a href={lesson.source.url} target="_blank" rel="noreferrer noopener">{lesson.source.title} · {lesson.source.provider}</a></p>
                      <p>{lesson.source.why}</p>
                      <p><strong>{t("studio.accessLabel")}</strong> {lesson.source.access} — {lesson.source.accessNote}</p>
                      <p><strong>{t("studio.segmentLabel")}</strong> {lesson.source.segmentLabel} · {lesson.source.minutes} min</p>
                    </div>
                    {(lesson.alternatives ?? []).map((source) => (
                      <div className="bx-editor-notice" key={source.url}>
                        <p><strong>{t("studio.backupSourceLabel")}</strong> <a href={source.url} target="_blank" rel="noreferrer noopener">{source.title} · {source.provider}</a></p>
                        <p>{source.why}</p><p>{source.access} — {source.accessNote}</p><p>{source.segmentLabel} · {source.minutes} min</p>
                      </div>
                    ))}
                  </details>
                ))}
              </details>
            ))}
            <details className="bx-editor-details">
              <summary>{t("studio.reviewCardsCount", { count: interviewResult.document.cards.length })}</summary>
              {interviewResult.document.cards.map((card) => (
                <div className="bx-editor-notice" key={card.id}>
                  <p><strong>{card.type} · {t("studio.questionLabel")}</strong> {card.front}</p>
                  <p><strong>{t("studio.answerLabel")}</strong> {card.back}</p>
                  <small>{card.subjectId} · {card.lessonId}</small>
                </div>
              ))}
            </details>
            <details className="bx-editor-details">
              <summary>{t("studio.fullJson")}</summary>
              <pre className="bx-code">{JSON.stringify(interviewResult.document, null, 2)}</pre>
            </details>
            {interviewApplied ? (
              <div className="bx-editor-notice" role="status">{t("studio.applied")}</div>
            ) : canRetryInterviewProposal(interviewResult, interviewNetworkValidated) ? (
              <button type="button" className="bx-btn" onClick={useInterviewCurriculum} disabled={saveState === "saving" || interviewLoading}>{t("studio.retryApply")}</button>
            ) : (
              <div className="bx-editor-notice is-error" role="alert">
                {t("studio.expiredProposal")}
                <button type="button" className="bx-btn" onClick={restartInterview} disabled={interviewLoading}>{t("studio.restartSecure")}</button>
              </div>
            )}
          </div>
        ) : interviewResult?.phase === "confirmation" ? (
          <div className="bx-interview-compose">
            <p>{t("studio.confirmCopy")}</p>
            <button type="button" className="bx-btn" disabled={interviewLoading} onClick={confirmInterviewSummary}>{t("studio.confirm")}</button>
            <label className="bx-label" htmlFor="interview-correction">{t("studio.correction")}</label>
            <textarea id="interview-correction" className="bx-textarea" rows={3} maxLength={2000} value={interviewInput} disabled={interviewLoading} onChange={(event) => setInterviewInput(event.target.value)} />
            <button type="button" className="bx-btn bx-btn-ghost" disabled={interviewLoading || !interviewInput.trim()} onClick={reviseInterviewSummary}>{t("studio.correctSummary")}</button>
          </div>
        ) : interviewTurns.length ? (
          <div className="bx-interview-compose">
            <label className="bx-label" htmlFor="interview-answer">{t("studio.yourAnswer")}</label>
            <textarea id="interview-answer" className="bx-textarea" rows={3} maxLength={2000} value={interviewInput} disabled={interviewLoading} onChange={(event) => setInterviewInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submitInterview(); } }} />
            <button type="button" className="bx-btn" disabled={interviewLoading || !interviewInput.trim()} onClick={submitInterview}>{t("studio.send")}</button>
          </div>
        ) : null}
      </div>

      <p className="bx-editor-footnote">{t("studio.idFootnote")}</p>
    </div>
  );
}
