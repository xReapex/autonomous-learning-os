#!/usr/bin/env node
// Envoie le brief du jour sans démarrer Next.
//
// C'est ce qu'on met dans un cron : `npm run telegram:daily`. Le script lit
// .env.local lui-même, parce qu'un cron n'hérite pas de l'environnement du
// shell interactif.

import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Parseur .env minimal : suffisant pour KEY=value, ignore commentaires et
// lignes vides, ne gère pas les valeurs multi-lignes (on n'en a pas).
function loadEnv(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnv(resolve(appDir, ".env.local"));

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

if (process.env.TELEGRAM_ENABLED !== "true" || !token || !chatId) {
  console.error("✗ Telegram non configuré. Lance : bash scripts/04-telegram.sh");
  process.exit(1);
}

const curriculum = JSON.parse(readFileSync(resolve(appDir, "content/curriculum.json"), "utf8"));

// Rotation quotidienne des matières, même règle que la route API : sur un
// cursus multi-matières, répéter la même chaque matin tue l'ouverture.
const dayIndex = Math.floor(Date.now() / 86_400_000);
const subject = curriculum.subjects[dayIndex % curriculum.subjects.length];
const lesson = subject.lessons[0];
const source = lesson.source;
const appUrl = process.env.APP_URL || "http://localhost:3000";

const text = [
  `BizOS × Learning — ${curriculum.subject}`,
  "",
  `Aujourd'hui : ${lesson.title}`,
  `Objectif : ${lesson.objective}`,
  "",
  `Source : ${source.title} — ${source.provider}`,
  `À regarder : ${source.minutes} min (${source.segmentLabel})`,
  "",
  `Question de rappel : ${lesson.prompt}`,
  "",
  appUrl,
].join("\n");

const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
});

if (!response.ok) {
  // Ne jamais réimprimer l'URL : elle contient le token du bot.
  console.error(`✗ Telegram a répondu ${response.status}`);
  console.error(await response.text().catch(() => ""));
  process.exit(1);
}

console.log(`✓ Brief envoyé — ${subject.title} · ${lesson.title}`);
