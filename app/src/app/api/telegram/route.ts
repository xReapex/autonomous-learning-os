import { NextResponse } from "next/server";

import { dailyCards } from "@/lib/curriculum";
import { dueCards, newCardState } from "@/lib/scheduler";
import { getStorage } from "@/lib/storage";
import { buildDailyBrief, sendTelegramMessage, telegramConfig } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ configured: telegramConfig() !== null });
}

/**
 * Envoie le brief du jour.
 *
 * Protégée par CRON_SECRET quand la variable existe : sans ça, une app déployée
 * exposerait un endpoint que n'importe qui peut déclencher pour spammer le
 * Telegram de son propriétaire. En local, l'absence de secret laisse la route
 * ouverte — c'est le comportement voulu pour tester.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const header = request.headers.get("authorization");
    if (header !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
    }
  }

  if (!telegramConfig()) {
    return NextResponse.json(
      { error: "Telegram n'est pas configuré. Lance scripts/04-telegram.sh." },
      { status: 400 },
    );
  }

  const stored = await getStorage().getCardStates();
  const byId = new Map(stored.map((state) => [state.cardId, state]));
  const states = dailyCards.map((card) => byId.get(card.id) ?? newCardState(card.id));

  // Le sujet tourne d'un jour à l'autre : sur un cursus multi-matières, un
  // brief qui répète la même matière tous les matins est ignoré au bout de trois
  // jours.
  const dayIndex = Math.floor(Date.now() / 86_400_000);

  const text = buildDailyBrief({ subjectIndex: dayIndex, dueCards: dueCards(states).length });
  const result = await sendTelegramMessage(text);

  if (!result.sent) return NextResponse.json({ error: result.error }, { status: 502 });
  return NextResponse.json({ sent: true, preview: text });
}
