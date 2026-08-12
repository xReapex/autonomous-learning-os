import { NextResponse } from "next/server";

import { loadActiveCurriculum } from "@/lib/curriculum-store";
import { dueCards, gradeCard, newCardState, upcomingLoad, type ReviewGrade } from "@/lib/scheduler";
import { getStorage } from "@/lib/storage";
import type { Storage } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * La file de révision du jour.
 * Une carte du curriculum sans état stocké est une carte jamais vue : elle est
 * due immédiatement. C'est ce qui fait qu'un curriculum fraîchement généré a
 * une file pleine dès le premier jour.
 */
type CardsDependencies = {
  storage: () => Storage;
  loadCurriculum: typeof loadActiveCurriculum;
  now: () => Date;
};

export function createCardsHandlers(overrides: Partial<CardsDependencies> = {}) {
  const dependencies: CardsDependencies = {
    storage: getStorage,
    loadCurriculum: loadActiveCurriculum,
    now: () => new Date(),
    ...overrides,
  };

  return {
    async GET() {
      const dailyCards = (await dependencies.loadCurriculum()).document.cards;
      const storage = dependencies.storage();
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
    },

    /** Note une carte et renvoie son nouvel état SM-2. */
    async POST(request: Request) {
      const dailyCards = (await dependencies.loadCurriculum()).document.cards;
      let body: { cardId?: unknown; grade?: unknown; eventId?: unknown };
      try {
        body = await request.json();
      } catch {
        return NextResponse.json({ error: "Corps de requête illisible." }, { status: 400 });
      }

      const cardId = typeof body.cardId === "string" ? body.cardId : "";
      const grade = Number(body.grade);
      const eventId = typeof body.eventId === "string" ? body.eventId.trim() : "";
      const card = dailyCards.find((item) => item.id === cardId);

      if (!card) {
        return NextResponse.json({ error: "Carte inconnue dans ce curriculum." }, { status: 404 });
      }
      if (![0, 1, 2, 3].includes(grade)) {
        return NextResponse.json({ error: "La note doit valoir 0, 1, 2 ou 3." }, { status: 400 });
      }
      if (grade >= 2 && (!eventId || eventId.length > 200)) {
        return NextResponse.json({ error: "Un eventId valide est requis pour un rappel réussi." }, { status: 400 });
      }

      const storage = dependencies.storage();
      const existing = (await storage.getCardStates()).find((state) => state.cardId === cardId);
      const now = dependencies.now();
      const next = gradeCard(existing ?? newCardState(cardId, now), grade as ReviewGrade, now);
      const saved = await storage.saveCardState(next);
      const reward = grade >= 2
        ? await storage.awardReward({
            eventId,
            kind: "card_recalled",
            occurredAt: now.toISOString(),
            subjectId: card.subjectId ?? "curriculum",
            itemId: cardId,
          })
        : null;

      return NextResponse.json({ ...saved, reward });
    },
  };
}

export const { GET, POST } = createCardsHandlers();
