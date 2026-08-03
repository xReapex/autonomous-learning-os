#!/usr/bin/env bash
# Prépare app/ pour un premier lancement : .env.local, .data/, dépendances.
# Idempotent — relançable autant de fois que nécessaire, n'écrase aucune valeur
# déjà renseignée.

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=lib/log.sh
. "$ROOT/scripts/lib/log.sh"

APP="$ROOT/app"
[ -d "$APP" ] || die "app/ est introuvable — tu n'es pas à la racine du repo."

log_title "Montage de l'app"

if [ ! -f "$APP/.env.local" ]; then
  cp "$APP/.env.example" "$APP/.env.local"
  log_ok "app/.env.local créé depuis .env.example"
else
  log_dim "app/.env.local existe déjà — conservé tel quel."
fi

mkdir -p "$APP/.data"
log_ok "app/.data/ prêt (stockage fichier par défaut, git-ignoré)"

mkdir -p "$APP/public/wallpapers"

if [ ! -d "$APP/node_modules" ]; then
  log_step "npm install"
  (cd "$APP" && npm install --no-audit --no-fund)
  log_ok "Dépendances installées"
else
  log_dim "node_modules présent — install sautée."
fi

log_ok "Prêt. Prochaine étape : scripts/02-configure.sh"
