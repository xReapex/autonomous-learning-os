#!/usr/bin/env bash
# Câble le brief quotidien Telegram.
#
# Le bot appartient à l'utilisateur : c'est lui qui le crée chez @BotFather.
# Ce script fait la partie mécanique — résoudre le chat ID, écrire le .env,
# envoyer un message de test.
#
# Prérequis (docs/TELEGRAM.md) :
#   1. /newbot chez @BotFather → token
#   2. ÉCRIRE au bot depuis ton compte (sinon le chat ID n'existe pas)

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=lib/ask.sh
. "$ROOT/scripts/lib/ask.sh"

ENV_FILE="$ROOT/app/.env.local"
[ -f "$ENV_FILE" ] || die "app/.env.local absent — lance d'abord scripts/01-scaffold.sh"
command -v curl >/dev/null 2>&1 || die "curl est requis."
command -v node >/dev/null 2>&1 || die "node est requis."

set_env() {
  local key="$1" value="$2" tmp
  tmp="$(mktemp)"
  grep -v "^${key}=" "$ENV_FILE" > "$tmp" 2>/dev/null || true
  printf '%s=%s\n' "$key" "$value" >> "$tmp"
  mv "$tmp" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
}

# Extrait un champ JSON sans dépendre de jq.
json_get() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const o=JSON.parse(s);const p=process.argv[1].split(".");let v=o;for(const k of p)v=v?.[k];process.stdout.write(v==null?"":String(v))}catch{process.stdout.write("")}})' "$1"; }

log_title "Brief Telegram"

TOKEN="${TELEGRAM_BOT_TOKEN:-}"
if [ -z "$TOKEN" ]; then
  log_dim "Token obtenu via @BotFather → /newbot. Il ressemble à 1234567890:AA…"
  TOKEN="$(ask_secret "Colle le token de TON bot (masqué) :")"
fi
[ -n "$TOKEN" ] || die "Aucun token saisi."

log_step "Vérification du bot"
BOT_JSON="$(curl -fsS "https://api.telegram.org/bot${TOKEN}/getMe" || true)"
BOT_NAME="$(printf '%s' "$BOT_JSON" | json_get result.username)"
[ -n "$BOT_NAME" ] || die "Telegram rejette ce token. Vérifie-le chez @BotFather."
log_ok "Bot @${BOT_NAME} authentifié"

CHAT_ID="${TELEGRAM_CHAT_ID:-}"
if [ -z "$CHAT_ID" ]; then
  log_step "Résolution du chat ID"
  log_dim "Ouvre Telegram, cherche @${BOT_NAME}, et envoie-lui n'importe quel message."
  if [ -t 0 ]; then read -r -p "$(printf '  Appuie sur Entrée quand c'"'"'est fait… ')" _; fi
  UPDATES="$(curl -fsS "https://api.telegram.org/bot${TOKEN}/getUpdates" || true)"
  CHAT_ID="$(printf '%s' "$UPDATES" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const o=JSON.parse(s);const u=(o.result||[]).filter(x=>x.message?.chat?.id).pop();process.stdout.write(u?String(u.message.chat.id):"")}catch{process.stdout.write("")}})')"
fi

if [ -z "$CHAT_ID" ]; then
  log_warn "Aucun message reçu — Telegram ne peut pas révéler ton chat ID tant que tu n'as pas écrit au bot."
  CHAT_ID="$(ask_text "Chat ID (si tu le connais)" "")"
fi
[ -n "$CHAT_ID" ] || die "Chat ID introuvable. Écris au bot, puis relance ce script."
log_ok "Chat ID : $CHAT_ID"

set_env TELEGRAM_BOT_TOKEN "$TOKEN"
set_env TELEGRAM_CHAT_ID "$CHAT_ID"
set_env TELEGRAM_ENABLED "true"

log_step "Message de test"
SUBJECT="$(grep '^NEXT_PUBLIC_LEARNING_SUBJECT=' "$ENV_FILE" | cut -d= -f2- || true)"
TEST_TEXT="BizOS × Learning est câblé.
Sujet suivi : ${SUBJECT:-ton cursus}.
Tu recevras ici ton module du jour, la source à ouvrir et ta question de rappel."

curl -fsS -X POST "https://api.telegram.org/bot${TOKEN}/sendMessage" \
  --data-urlencode "chat_id=${CHAT_ID}" \
  --data-urlencode "text=${TEST_TEXT}" >/dev/null \
  && log_ok "Message envoyé — vérifie ton Telegram." \
  || die "L'envoi a échoué. Vérifie le token et le chat ID."

log_step "Envoi quotidien"
log_dim "Manuel     : cd app && npm run telegram:daily"
log_dim "Cron 8h    : 0 8 * * *  cd $ROOT/app && npm run telegram:daily >> /tmp/learning-telegram.log 2>&1"
log_dim "Vercel     : ajoute le cron dans app/vercel.json (voir docs/TELEGRAM.md)"
