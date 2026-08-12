import type { CurriculumDocument } from "./curriculum";
import { validateCurriculumDocument } from "./curriculum-validation";

export const MAX_INTERVIEW_MESSAGES = 24;
export const MAX_INTERVIEW_MESSAGE_CHARS = 2_000;
export const MAX_INTERVIEW_STATE_CHARS = 56_000;
export const MAX_INTERVIEW_BODY_BYTES = 64 * 1024;

export type InterviewMessage = { role: "user" | "assistant"; content: string };
export type InterviewRequest =
  | Record<string, never>
  | { locale: "fr" | "en" }
  | { state: string; answer: string }
  | { state: string; action: "confirm" }
  | { state: string; action: "revise"; answer: string };
export type InterviewResponse =
  | { phase: "question"; message: string; choices: string[]; progress: number; document: null; state: string }
  | { phase: "confirmation"; message: string; choices: []; progress: number; document: null; state: string }
  | { phase: "proposal"; message: string; choices: []; progress: 100; document: CurriculumDocument; state: string };

export type InterviewTurn = {
  kind: "question" | "confirmation";
  question: string;
  choices: string[];
  answer?: string;
  stateBeforeAnswer: string;
  progress: number;
};

type Result<T> = { ok: true; value: T } | { ok: false };
const plainObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const exactKeys = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
const QUESTION_MESSAGES = new Set([
  "Quel sujet précis veux-tu apprendre ?",
  "Comment apprends-tu actuellement ce sujet ?",
  "Que sais-tu déjà faire concrètement dans ce domaine ?",
  "Quel résultat vérifiable veux-tu atteindre ?",
  "Quel temps total peux-tu consacrer chaque semaine ?",
  "À quelle échéance veux-tu atteindre cet objectif ?",
  "Quel format d’apprentissage t’aide le plus ?",
  "Quelle contrainte importante dois-je respecter ?",
  "What exactly do you want to learn?",
  "How do you currently learn this subject?",
  "What can you already do concretely in this area?",
  "What verifiable outcome do you want to achieve?",
  "How much total time can you spend each week?",
  "By when do you want to reach this goal?",
  "Which learning format helps you most?",
  "What important constraint should I respect?",
]);
const CONFIRMATION_MARKER = "[CONFIRMATION_EXPLICITE_VALIDÉE_PAR_LE_SERVEUR]";
const QUESTION_MARK_PATTERN = /[\u003F\u00BF\u037E\u055E\u061F\u0706\u07F9\u0839-\u083B\u1367\u1945\u1AA7\u203D\u2047-\u2049\u225F\u2370\u2753\u2754\u2A7B\u2A7C\u2CFA\u2CFB\u2E18\u2E2E\u2E54\u3244\uA60F\uA6F7\uFE16\uFE56\uFF1F\u{10A56}\u{110BE}\u{11143}\u{1144B}\u{1144C}\u{115C2}\u{115C3}\u{11641}\u{11FFF}\u{1E95F}\u{1F679}-\u{1F67B}\u{1FBC4}\u{E003F}]/u;
const validDeclarativeSummary = (value: string) => {
  const normalized = value.normalize("NFKC");
  return !QUESTION_MARK_PATTERN.test(value) && !QUESTION_MARK_PATTERN.test(normalized);
};
const normalizeAnswer = (value: string) => value.normalize("NFKC").replace(/[\p{Cf}\p{Cc}]/gu, "").trim();
const meaningfulAnswer = (value: unknown): value is string => {
  if (typeof value !== "string" || value.length > MAX_INTERVIEW_MESSAGE_CHARS) return false;
  const normalized = normalizeAnswer(value);
  return normalized !== CONFIRMATION_MARKER && (normalized.match(/[\p{L}\p{N}]/gu)?.length ?? 0) >= 2;
};

export function validateInterviewRequest(value: unknown): Result<InterviewRequest> {
  if (!plainObject(value)) return { ok: false };
  if (exactKeys(value, [])) return { ok: true, value: value as InterviewRequest };
  if (exactKeys(value, ["locale"]) && (value.locale === "fr" || value.locale === "en")) return { ok: true, value: { locale: value.locale } };
  const validState = typeof value.state === "string" && value.state.length >= 40 && value.state.length <= MAX_INTERVIEW_STATE_CHARS;
  const validAnswer = meaningfulAnswer(value.answer);
  if (!validState) return { ok: false };
  if (exactKeys(value, ["state", "answer"]) && validAnswer) return { ok: true, value: { state: value.state as string, answer: normalizeAnswer(value.answer as string) } };
  if (exactKeys(value, ["state", "action"]) && value.action === "confirm") return { ok: true, value: value as InterviewRequest };
  if (exactKeys(value, ["state", "action", "answer"]) && value.action === "revise" && validAnswer) return { ok: true, value: { state: value.state as string, action: "revise", answer: normalizeAnswer(value.answer as string) } };
  return { ok: false };
}

export function validateInterviewResponse(value: unknown): Result<InterviewResponse> {
  if (!plainObject(value) || !exactKeys(value, ["phase", "message", "choices", "progress", "document", "state"]) || typeof value.message !== "string" || value.message.trim().length < 1 || value.message.length > MAX_INTERVIEW_MESSAGE_CHARS || !Array.isArray(value.choices) || typeof value.state !== "string" || value.state.length < 40 || value.state.length > MAX_INTERVIEW_STATE_CHARS || !Number.isInteger(value.progress) || (value.progress as number) < 0 || (value.progress as number) > 100) return { ok: false };
  const choices = value.choices.map((choice) => typeof choice === "string" ? normalizeAnswer(choice) : "");
  const choicesValid = choices.every((choice) => meaningfulAnswer(choice) && choice.length <= 160) && new Set(choices.map((choice) => choice.toLocaleLowerCase())).size === choices.length;
  if (value.phase === "question" && choices.length >= 3 && choices.length <= 5 && choicesValid && QUESTION_MESSAGES.has(value.message) && value.document === null && (value.progress as number) < 100) return { ok: true, value: { ...value, choices } as InterviewResponse };
  if (choices.length !== 0) return { ok: false };
  if (value.phase === "confirmation" && validDeclarativeSummary(value.message) && value.document === null && (value.progress as number) < 100) return { ok: true, value: value as InterviewResponse };
  if (value.phase === "proposal" && value.progress === 100 && validateCurriculumDocument(value.document).ok) return { ok: true, value: value as InterviewResponse };
  return { ok: false };
}

export function appendInterviewMessage(transcript: InterviewMessage[], message: InterviewMessage): InterviewMessage[] {
  return [...transcript, message].slice(-MAX_INTERVIEW_MESSAGES);
}
