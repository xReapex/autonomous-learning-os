#!/usr/bin/env bash
# Écrit les réponses de l'entretien dans app/.env.local.
#
# Aucune clé API n'est demandée ici : le mode `api` écrit la variable vide et
# l'utilisateur renseigne lui-même sa clé. Rien de secret ne transite par ce
# script ni par l'historique du shell.
#
# Usage : 02-configure.sh [--subject "…"] [--provider claude-code|cli|api]
#                         [--cli claude|codex] [--minutes 30] [--wallpaper id]

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=lib/ask.sh
. "$ROOT/scripts/lib/ask.sh"

ENV_FILE="$ROOT/app/.env.local"
[ -f "$ENV_FILE" ] || die "app/.env.local absent — lance d'abord scripts/01-scaffold.sh"

SUBJECT=""; PROVIDER=""; CLI_BIN=""; MINUTES=""; WALLPAPER=""

while [ $# -gt 0 ]; do
  case "$1" in
    --subject)   SUBJECT="${2:-}"; shift 2 ;;
    --provider)  PROVIDER="${2:-}"; shift 2 ;;
    --cli)       CLI_BIN="${2:-}"; shift 2 ;;
    --minutes)   MINUTES="${2:-}"; shift 2 ;;
    --wallpaper) WALLPAPER="${2:-}"; shift 2 ;;
    *) die "Option inconnue : $1" ;;
  esac
done

log_title "Configuration"

[ -n "$SUBJECT" ]   || SUBJECT="$(ask_text "Sujet affiché sous le wordmark" "Apprentissage")"
[ -n "$PROVIDER" ]  || PROVIDER="$(ask_text "Mode IA (claude-code|cli|api)" "claude-code")"
[ -n "$MINUTES" ]   || MINUTES="$(ask_text "Durée de session par défaut (minutes)" "30")"
[ -n "$WALLPAPER" ] || WALLPAPER="$(ask_text "Fond d'écran par défaut" "desk")"

case "$PROVIDER" in
  claude-code|cli|api) ;;
  *) die "Mode IA invalide : $PROVIDER (attendu claude-code, cli ou api)" ;;
esac

if [ "$PROVIDER" = "cli" ] && [ -z "$CLI_BIN" ]; then
  CLI_BIN="$(ask_text "Binaire CLI à appeler (claude|codex)" "claude")"
fi

# set_env <clé> <valeur> — remplace la ligne si elle existe, l'ajoute sinon.
set_env() {
  local key="$1" value="$2" tmp
  tmp="$(mktemp)"
  grep -v "^${key}=" "$ENV_FILE" > "$tmp" 2>/dev/null || true
  printf '%s=%s\n' "$key" "$value" >> "$tmp"
  mv "$tmp" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
}

set_env NEXT_PUBLIC_LEARNING_SUBJECT "$SUBJECT"
set_env NEXT_PUBLIC_DEFAULT_SESSION_MINUTES "$MINUTES"
set_env NEXT_PUBLIC_DEFAULT_WALLPAPER "$WALLPAPER"
set_env AI_PROVIDER "$PROVIDER"
[ -n "$CLI_BIN" ] && set_env AI_CLI_BIN "$CLI_BIN"

log_ok "Sujet : $SUBJECT"
log_ok "Mode IA : $PROVIDER${CLI_BIN:+ ($CLI_BIN)}"
log_ok "Session par défaut : $MINUTES min · fond : $WALLPAPER"

if [ "$PROVIDER" = "api" ]; then
  log_warn "Mode api : ouvre app/.env.local et renseigne TOI-MÊME ta clé."
  log_dim "ANTHROPIC_API_KEY=…  (ou OPENAI_API_KEY=… avec AI_API_VENDOR=openai)"
  log_dim "Le fichier est en chmod 600 et git-ignoré. Ne colle jamais ta clé dans un chat."
fi
