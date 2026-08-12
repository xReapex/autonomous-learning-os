import type { CurriculumDocument } from "@/lib/curriculum";
import {
  MAX_INTERVIEW_MESSAGE_CHARS,
  MAX_INTERVIEW_MESSAGES,
  MAX_INTERVIEW_STATE_CHARS,
  validateInterviewResponse,
  type InterviewRequest,
  type InterviewResponse,
  type InterviewTurn,
} from "@/lib/curriculum-interview";

export const INTERVIEW_SESSION_STORAGE_KEY = "scio:curriculum-interview:v2";
const MAX_STORED_INTERVIEW_CHARS = 512_000;
export type CurriculumSaveState = "saved" | "editing" | "saving" | "error";

export function interviewStreamedErrorMessage(value: unknown): string | null {
  if (!value || typeof value !== "object" || !("error" in value)) return null;
  const error = (value as { error?: unknown }).error;
  if (!error || typeof error !== "object") return "Le service d’entretien est indisponible. Réessaie dans un instant.";
  const code = "code" in error ? (error as { code?: unknown }).code : null;
  return code === "worker_busy" ? "Codex est déjà occupé. Réessaie dans quelques secondes." : "Le service d’entretien est indisponible. Réessaie dans un instant.";
}

type InterviewRequestLock = { current: boolean };

export function acquireInterviewRequestLock(lock: InterviewRequestLock): boolean {
  if (lock.current) return false;
  lock.current = true;
  return true;
}

export function releaseInterviewRequestLock(lock: InterviewRequestLock): void {
  lock.current = false;
}

export function autosaveStatusAfterSuccess(savedDraftVersion: number, currentDraftVersion: number): "saved" | "editing" {
  return savedDraftVersion === currentDraftVersion ? "saved" : "editing";
}

export function isCurrentSaveAttempt(attempt: number, latestAttempt: number): boolean {
  return attempt === latestAttempt;
}

export function shouldReplaceDraftAfterInterviewApply(startDraftVersion: number, currentDraftVersion: number): boolean {
  return startDraftVersion === currentDraftVersion;
}

export function isJsonEditorDisabled(curriculumMutationsInFlight: number): boolean {
  return curriculumMutationsInFlight > 0;
}

export function isInterviewProposalApplied(
  response: InterviewResponse | null,
  activeSource: "delivered" | "override",
  activeDocument: CurriculumDocument,
): boolean {
  return activeSource === "override"
    && response?.phase === "proposal"
    && JSON.stringify(response.document) === JSON.stringify(activeDocument);
}

export function shouldStartCurriculumAutosave(input: {
  saveState: CurriculumSaveState;
  draftEqualsActive: boolean;
  valid: boolean;
  conflict: boolean;
  interviewProposalPending: boolean;
}): boolean {
  return input.saveState !== "saving"
    && input.saveState !== "error"
    && !input.draftEqualsActive
    && input.valid
    && !input.conflict
    && !input.interviewProposalPending;
}

export type StoredInterviewSession = {
  version: 1;
  turns: InterviewTurn[];
  result: InterviewResponse;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function validStoredTurn(value: unknown): value is InterviewTurn {
  if (!isPlainObject(value)) return false;
  const keys = Object.keys(value);
  if (keys.length !== 5 && keys.length !== 6) return false;
  if (!["kind", "question", "choices", "stateBeforeAnswer", "progress"].every((key) => Object.hasOwn(value, key))) return false;
  if (keys.length === 6 && !Object.hasOwn(value, "answer")) return false;
  if (!Array.isArray(value.choices)) return false;
  const choicesValid = value.choices.every((choice) => typeof choice === "string" && choice.trim().length >= 2 && choice.length <= 160 && /[\p{L}\p{N}]/u.test(choice))
    && new Set(value.choices.map((choice) => choice.toLocaleLowerCase())).size === value.choices.length;
  return (value.kind === "question" || value.kind === "confirmation")
    && (value.kind === "question" ? value.choices.length >= 3 && value.choices.length <= 5 && choicesValid : value.choices.length === 0)
    && typeof value.question === "string" && value.question.length > 0 && value.question.length <= MAX_INTERVIEW_MESSAGE_CHARS
    && (value.answer === undefined || (typeof value.answer === "string" && value.answer.length <= MAX_INTERVIEW_MESSAGE_CHARS))
    && typeof value.stateBeforeAnswer === "string" && value.stateBeforeAnswer.length >= 40 && value.stateBeforeAnswer.length <= MAX_INTERVIEW_STATE_CHARS
    && Number.isInteger(value.progress) && (value.progress as number) >= 0 && (value.progress as number) <= 100;
}

export function shouldApplyInterviewProposal(request: InterviewRequest, response: InterviewResponse): boolean {
  return "action" in request && request.action === "confirm" && response.phase === "proposal";
}

export function canRetryInterviewProposal(
  response: InterviewResponse,
  networkValidated: boolean,
): response is Extract<InterviewResponse, { phase: "proposal" }> {
  return networkValidated && response.phase === "proposal";
}

export function requiresFreshInterviewAfterSaveError(status: number): boolean {
  return status === 412;
}

export function serializeInterviewSession(turns: InterviewTurn[], result: InterviewResponse): string {
  return JSON.stringify({ version: 1, turns, result } satisfies StoredInterviewSession);
}

export function parseStoredInterviewSession(raw: string | null): StoredInterviewSession | null {
  if (!raw || raw.length > MAX_STORED_INTERVIEW_CHARS) return null;
  try {
    const value = JSON.parse(raw) as unknown;
    if (!isPlainObject(value) || Object.keys(value).length !== 3 || value.version !== 1 || !Array.isArray(value.turns)
      || value.turns.length > MAX_INTERVIEW_MESSAGES || !value.turns.every(validStoredTurn)) return null;
    const result = validateInterviewResponse(value.result);
    if (!result.ok) return null;
    return { version: 1, turns: value.turns, result: result.value };
  } catch {
    return null;
  }
}

export type GuidedCurriculumInput = {
  subject: string;
  goal: string;
  level: "debutant" | "intermediaire" | "avance";
  sessionMinutes: 15 | 30 | 45 | 60 | 90 | 120 | 180;
  language: "fr" | "en";
  subjectTitle: string;
  subjectIcon: string;
  subjectLevel: string;
  lessonTitle: string;
  objective: string;
  prompt: string;
  takeaways: string[];
  sourceTitle: string;
  provider: string;
  sourceUrl: string;
  minutes: number;
  why: string;
  accessNote: string;
  segmentLabel: string;
};

export function slugifyCurriculumId(value: string, fallback: string, maxLength = 40): string {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
  const candidate = normalized.length >= 2 ? normalized : fallback;
  return candidate.slice(0, maxLength);
}

const EDITOR_MODES = ["guide", "visual", "json", "interview"] as const;
export type CurriculumEditorMode = (typeof EDITOR_MODES)[number];

export function nextEditorMode(
  current: CurriculumEditorMode,
  key: string,
): CurriculumEditorMode | undefined {
  if (key === "Home") return EDITOR_MODES[0];
  if (key === "End") return EDITOR_MODES[EDITOR_MODES.length - 1];
  if (key !== "ArrowLeft" && key !== "ArrowRight") return undefined;
  const direction = key === "ArrowRight" ? 1 : -1;
  const index = EDITOR_MODES.indexOf(current);
  return EDITOR_MODES[(index + direction + EDITOR_MODES.length) % EDITOR_MODES.length];
}

export function duplicateSubject(document: CurriculumDocument, subjectIndex: number): CurriculumDocument {
  const next = structuredClone(document);
  const original = next.subjects[subjectIndex];
  if (!original) return next;

  const subjectIds = new Set(next.subjects.map((subject) => subject.id));
  const lessonIds = new Set(next.subjects.flatMap((subject) => subject.lessons.map((lesson) => lesson.id)));
  const uniqueId = (base: string, used: Set<string>, maxLength: number) => {
    let suffix = "-copie";
    let candidate = `${base.slice(0, maxLength - suffix.length)}${suffix}`;
    let index = 2;
    while (used.has(candidate)) {
      suffix = `-${index}`;
      candidate = `${base.slice(0, maxLength - suffix.length)}${suffix}`;
      index += 1;
    }
    used.add(candidate);
    return candidate;
  };

  const copy = structuredClone(original);
  copy.id = uniqueId(original.id, subjectIds, 40);
  copy.title = `${original.title} — copie`;
  copy.progress = 0;
  copy.lessons = copy.lessons.map((lesson) => ({
    ...lesson,
    id: uniqueId(lesson.id, lessonIds, 60),
  }));
  next.subjects.splice(subjectIndex + 1, 0, copy);
  return next;
}

export function createGuidedCurriculum(
  input: GuidedCurriculumInput,
  now = new Date(),
): CurriculumDocument {
  const subjectId = slugifyCurriculumId(input.subjectTitle, "matiere");
  const lessonId = slugifyCurriculumId(`${subjectId}-${input.lessonTitle}`, "lecon-guidee", 60);
  const date = now.toISOString().slice(0, 10);
  const english = input.language === "en";
  const cardId = (suffix: string) => `${subjectId.slice(0, 39 - suffix.length)}-${suffix}`;
  let videoId = "";
  try {
    const url = new URL(input.sourceUrl.trim());
    videoId = url.hostname === "youtu.be"
      ? url.pathname.split("/").filter(Boolean)[0] ?? ""
      : url.searchParams.get("v") ?? url.pathname.split("/").filter(Boolean).at(-1) ?? "";
  } catch {
    // Le validateur affichera l'URL invalide dans l'assistant.
  }

  return {
    version: 1,
    subject: input.subject.trim(),
    goal: input.goal.trim(),
    level: input.level,
    sessionMinutes: input.sessionMinutes,
    generatedAt: date,
    language: input.language,
    subjects: [
      {
        id: subjectId,
        icon: input.subjectIcon.trim(),
        title: input.subjectTitle.trim(),
        level: input.subjectLevel.trim(),
        progress: 0,
        lessons: [
          {
            id: lessonId,
            title: input.lessonTitle.trim(),
            objective: input.objective.trim(),
            keyTakeaways: input.takeaways.map((takeaway) => takeaway.trim()).filter(Boolean),
            prompt: input.prompt.trim(),
            source: {
              title: input.sourceTitle.trim(),
              provider: input.provider.trim(),
              kind: "video",
              language: input.language,
              url: input.sourceUrl.trim(),
              embedUrl: videoId ? `https://www.youtube-nocookie.com/embed/${videoId}` : "",
              totalMinutes: input.minutes,
              minutes: input.minutes,
              why: input.why.trim(),
              access: "free",
              accessNote: input.accessNote.trim(),
              verifiedAt: date,
              segmentLabel: input.segmentLabel.trim(),
              segmentStartSeconds: 0,
            },
            alternatives: [],
          },
        ],
      },
    ],
    cards: [
      {
        id: cardId("objectif"),
        type: english ? "Goal" : "Objectif",
        front: english
          ? `What concrete outcome does “${input.lessonTitle.trim()}” target?`
          : `Quel résultat concret vise « ${input.lessonTitle.trim()} » ?`,
        back: input.objective.trim(),
        subjectId,
        lessonId,
      },
      {
        id: cardId("source"),
        type: english ? "Source choice" : "Choix de source",
        front: english
          ? `Why is “${input.sourceTitle.trim()}” a good fit for this lesson?`
          : `Pourquoi « ${input.sourceTitle.trim()} » est-elle adaptée à cette leçon ?`,
        back: input.why.trim(),
        subjectId,
        lessonId,
      },
      {
        id: cardId("transfert"),
        type: english ? "Transfer" : "Transfert",
        front: english
          ? `What practice transfers the lesson “${input.lessonTitle.trim()}” to a new situation?`
          : `Quelle pratique permet de transférer la leçon « ${input.lessonTitle.trim()} » ?`,
        back: input.prompt.trim(),
        subjectId,
        lessonId,
      },
    ],
  };
}
