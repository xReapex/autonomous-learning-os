import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { lessonById } from "@/lib/curriculum";
import { currentProvider, providerLabel, runPrompt } from "@/lib/ai";
import { buildCorrectionPrompt } from "@/lib/ai/prompt";
import { getStorage } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * Corrige un exercice.
 *
 * En mode `claude-code`, la route ne parle à aucun modèle : elle rend le prompt
 * pour que l'utilisateur le passe à son agent. La réponse est enregistrée dans
 * tous les cas — c'est la trace d'apprentissage, indépendamment de qui corrige.
 */
export async function POST(request: Request) {
  let body: { lessonId?: unknown; answer?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête illisible." }, { status: 400 });
  }

  const lessonId = typeof body.lessonId === "string" ? body.lessonId : "";
  const answer = typeof body.answer === "string" ? body.answer.trim() : "";

  const entry = lessonById(lessonId);
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

  const outcome = await runPrompt(prompt);
  const provider = currentProvider();

  await getStorage().appendAnswer({
    id: randomUUID(),
    lessonId,
    subjectId: entry.subject.id,
    question: entry.lesson.prompt,
    answer,
    feedback: outcome.status === "completed" ? outcome.text : null,
    provider,
    createdAt: new Date().toISOString(),
  });

  if (outcome.status === "completed") {
    return NextResponse.json({ status: "completed", feedback: outcome.text, provider: providerLabel(provider) });
  }

  if (outcome.status === "manual") {
    return NextResponse.json({
      status: "manual",
      prompt: outcome.prompt,
      provider: providerLabel(provider),
      hint: "Copie ce prompt dans ton agent. Ta réponse est déjà enregistrée dans ton historique.",
    });
  }

  return NextResponse.json({ status: "failed", error: outcome.error, provider: providerLabel(provider) }, { status: 502 });
}

/** L'historique des exercices, le plus récent d'abord. */
export async function GET() {
  return NextResponse.json({ answers: await getStorage().listAnswers(30) });
}
