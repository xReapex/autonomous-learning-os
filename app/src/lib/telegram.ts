// Le brief quotidien Telegram.
//
// Le bot appartient à l'utilisateur : token et chat ID viennent de son
// .env.local et ne quittent jamais sa machine. Sans configuration, tout est
// silencieusement désactivé — aucune erreur, aucun appel réseau.

import { curriculum, subjects } from "./curriculum";
import { formatMinutes } from "./format";

export type TelegramConfig = { token: string; chatId: string };

export function telegramConfig(): TelegramConfig | null {
  if (process.env.TELEGRAM_ENABLED !== "true") return null;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return null;
  return { token, chatId };
}

export async function sendTelegramMessage(text: string): Promise<{ sent: boolean; error?: string }> {
  const config = telegramConfig();
  if (!config) return { sent: false, error: "Telegram n'est pas configuré (voir docs/TELEGRAM.md)." };

  try {
    const response = await fetch(`https://api.telegram.org/bot${config.token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: config.chatId,
        text,
        // Pas de parse_mode : un titre de cours contenant un `_` ou un `*`
        // casserait le Markdown de Telegram et ferait échouer l'envoi entier.
        disable_web_page_preview: true,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      // Le token est dans l'URL : on ne réimprime jamais l'URL dans une erreur.
      return { sent: false, error: `Telegram a répondu ${response.status}. ${detail.slice(0, 200)}` };
    }
    return { sent: true };
  } catch (error) {
    return { sent: false, error: (error as Error).message };
  }
}

/**
 * Le message du jour, construit à partir du curriculum.
 * Volontairement déterministe : pas d'appel à un modèle pour envoyer un
 * message, sinon un cron quotidien devient une dépendance payante.
 */
export function buildDailyBrief(options: {
  subjectIndex?: number;
  dueCards: number;
  appUrl?: string;
}): string {
  const subject = subjects[(options.subjectIndex ?? 0) % subjects.length];
  const lesson = subject.lesson;
  const source = lesson.source;
  const url = options.appUrl || process.env.APP_URL || "http://localhost:3000";

  return [
    `BizOS × Learning — ${curriculum.subject}`,
    "",
    `Aujourd'hui : ${lesson.title}`,
    `Objectif : ${lesson.objective}`,
    "",
    `Source : ${source.title} — ${source.provider}`,
    `À regarder : ${formatMinutes(source.minutes)} (${source.segmentLabel})`,
    options.dueCards > 0 ? `Cartes dues : ${options.dueCards}` : "Aucune carte due aujourd'hui.",
    "",
    `Question de rappel : ${lesson.prompt}`,
    "",
    url,
  ].join("\n");
}
