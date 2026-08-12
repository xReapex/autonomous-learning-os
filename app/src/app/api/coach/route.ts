import { NextResponse } from "next/server";

import { lessonById, normalizeCurriculumDocument } from "@/lib/curriculum";
import { automaticAiAllowedForCurriculum, currentProvider, providerLabel, runPrompt, type AiOutcome } from "@/lib/ai";
import { buildCorrectionPrompt } from "@/lib/ai/prompt";
import { loadActiveCurriculum, type ActiveCurriculum } from "@/lib/curriculum-store";
import { getStorage } from "@/lib/storage";
import type { Storage } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const MAX_COACH_BODY_BYTES = 32 * 1024;

class CoachBodyTooLargeError extends Error {}

type CoachDependencies = {
  storage: () => Storage;
  loadCurriculum: () => Promise<ActiveCurriculum>;
  correct: (prompt: string, active: ActiveCurriculum) => Promise<AiOutcome>;
  now: () => Date;
};

async function readBoundedCoachJson(request: Request): Promise<unknown> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_COACH_BODY_BYTES) {
    throw new CoachBodyTooLargeError();
  }
  if (!request.body) throw new SyntaxError("empty body");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_COACH_BODY_BYTES) {
      await reader.cancel();
      throw new CoachBodyTooLargeError();
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
}

/**
 * Corrige un exercice.
 *
 * En mode `claude-code`, la route ne parle à aucun modèle : elle rend le prompt
 * pour que l'utilisateur le passe à son agent. La réponse est enregistrée dans
 * tous les cas — c'est la trace d'apprentissage, indépendamment de qui corrige.
 */
async function coachPost(request: Request, dependencies: CoachDependencies) {
  let parsed: unknown;
  try {
    parsed = await readBoundedCoachJson(request);
  } catch (error) {
    if (error instanceof CoachBodyTooLargeError) {
      return NextResponse.json({ error: "Corps de requête trop volumineux." }, { status: 413 });
    }
    return NextResponse.json({ error: "Corps de requête illisible." }, { status: 400 });
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return NextResponse.json({ error: "Le corps doit être un objet JSON." }, { status: 400 });
  }
  const body = parsed as { lessonId?: unknown; answer?: unknown; eventId?: unknown };

  const lessonId = typeof body.lessonId === "string" ? body.lessonId : "";
  const answer = typeof body.answer === "string" ? body.answer.trim() : "";
  const requestedEventId = typeof body.eventId === "string" ? body.eventId.trim() : "";
  if (!requestedEventId || requestedEventId.length > 200) {
    return NextResponse.json({ error: "Un eventId valide est requis pour corriger un exercice." }, { status: 400 });
  }

  const activeCurriculum = await dependencies.loadCurriculum();
  const curriculum = normalizeCurriculumDocument(activeCurriculum.document);
  const entry = lessonById(lessonId, curriculum);
  if (!entry) {
    return NextResponse.json({ error: "Leçon inconnue dans ce curriculum." }, { status: 404 });
  }

  // La barre des 20 mots n'est pas de la pédanterie : en dessous, la correction
  // n'a rien à corriger et le feedback devient générique.
  const wordCount = answer.split(/\s+/).filter(Boolean).length;
  if (wordCount < 20) {
    return NextResponse.json(
      { error: "Réponse trop courte. Ajoute un exemple concret, puis dis où ton explication pourrait échouer." },
      { status: 422 },
    );
  }
  if (answer.length > 20_000) {
    return NextResponse.json({ error: "Réponse trop longue (max 20 000 caractères)." }, { status: 413 });
  }

  const prompt = buildCorrectionPrompt({
    subjectTitle: entry.subject.title,
    lessonTitle: entry.lesson.title,
    question: entry.lesson.prompt,
    keyTakeaways: entry.lesson.keyTakeaways,
    answer,
  });

  const outcome = await dependencies.correct(prompt, activeCurriculum);
  const provider = outcome.provider;
  const eventId = requestedEventId;
  const now = dependencies.now();
  const storage = dependencies.storage();

  await storage.appendAnswer({
    id: eventId,
    lessonId,
    subjectId: entry.subject.id,
    question: entry.lesson.prompt,
    answer,
    feedback: outcome.status === "completed" ? outcome.text : null,
    provider,
    createdAt: now.toISOString(),
  });

  if (outcome.status === "completed") {
    const reward = await storage.awardReward({
      eventId,
      kind: "exercise_succeeded",
      occurredAt: now.toISOString(),
      subjectId: entry.subject.id,
      itemId: lessonId,
    });
    return NextResponse.json({ status: "completed", feedback: outcome.text, provider: providerLabel(provider), reward });
  }

  if (outcome.status === "manual") {
    return NextResponse.json({
      status: "manual",
      prompt: outcome.prompt,
      provider: providerLabel(provider),
      hint: "Copie ce prompt dans ton agent. Ta réponse est déjà enregistrée dans ton historique.",
      reward: null,
    });
  }

  return NextResponse.json({ status: "failed", error: outcome.error, provider: providerLabel(provider), reward: null }, { status: 502 });
}

export function createCoachHandlers(overrides: Partial<CoachDependencies> = {}) {
  const dependencies: CoachDependencies = {
    storage: getStorage,
    loadCurriculum: loadActiveCurriculum,
    correct: async (prompt, active) => {
      const configuredProvider = currentProvider();
      return automaticAiAllowedForCurriculum(active.source, configuredProvider)
        ? runPrompt(prompt)
        : { status: "manual", prompt, provider: "claude-code" };
    },
    now: () => new Date(),
    ...overrides,
  };

  return {
    POST: (request: Request) => coachPost(request, dependencies),
    /** L'historique des exercices, le plus récent d'abord. */
    GET: async () => NextResponse.json({ answers: await dependencies.storage().listAnswers(30) }),
  };
}

export const { POST, GET } = createCoachHandlers();
