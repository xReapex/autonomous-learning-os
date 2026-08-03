import { NextResponse } from "next/server";

import { dailyCards } from "@/lib/curriculum";
import { dueCards, gradeCard, newCardState, upcomingLoad, type ReviewGrade } from "@/lib/scheduler";
import { getStorage } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * La file de révision du jour.
 * Une carte du curriculum sans état stocké est une carte jamais vue : elle est
 * due immédiatement. C'est ce qui fait qu'un curriculum fraîchement généré a
 * une file pleine dès le premier jour.
 */
export async function GET() {
  const storage = getStorage();
  const stored = await storage.getCardStates();
  const byId = new Map(stored.map((state) => [state.cardId, state]));

  const states = dailyCards.map((card) => byId.get(card.id) ?? newCardState(card.id));
  const due = dueCards(states);

  return NextResponse.json({
    due: due.map((state) => {
      const card = dailyCards.find((item) => item.id === state.cardId)!;
      return { ...card, state };
    }),
    total: states.length,
    upcoming: upcomingLoad(states),
  });
}

/** Note une carte et renvoie son nouvel état SM-2. */
export async function POST(request: Request) {
  let body: { cardId?: unknown; grade?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête illisible." }, { status: 400 });
  }

  const cardId = typeof body.cardId === "string" ? body.cardId : "";
  const grade = Number(body.grade);

  if (!dailyCards.some((card) => card.id === cardId)) {
    return NextResponse.json({ error: "Carte inconnue dans ce curriculum." }, { status: 404 });
  }
  if (![0, 1, 2, 3].includes(grade)) {
    return NextResponse.json({ error: "La note doit valoir 0, 1, 2 ou 3." }, { status: 400 });
  }

  const storage = getStorage();
  const existing = (await storage.getCardStates()).find((state) => state.cardId === cardId);
  const next = gradeCard(existing ?? newCardState(cardId), grade as ReviewGrade);

  return NextResponse.json(await storage.saveCardState(next));
}
