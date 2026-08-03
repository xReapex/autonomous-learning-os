#!/usr/bin/env bash
# Le gate avant de dire « c'est prêt ».
#
# Valide le curriculum, joue les tests, construit, démarre le serveur et vérifie
# que les cinq écrans répondent. Un build vert n'est pas une preuve que l'app
# s'affiche : le smoke test HTTP l'est un peu plus.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=lib/log.sh
. "$ROOT/scripts/lib/log.sh"

APP="$ROOT/app"
PORT="${PORT:-3123}"
FAILED=0

step() {
  local label="$1"; shift
  log_step "$label"
  if "$@"; then log_ok "$label"; else log_err "$label a échoué"; FAILED=1; fi
}

log_title "Vérification"

step "Curriculum valide" node "$ROOT/scripts/validate-curriculum.mjs"
step "Tests unitaires"   bash -c "cd '$APP' && npm test --silent"
step "Build production"  bash -c "cd '$APP' && npm run build"

if [ "$FAILED" -eq 0 ]; then
  log_step "Smoke test HTTP sur les cinq écrans"
  (cd "$APP" && PORT="$PORT" npm run start >/tmp/learning-os-verify.log 2>&1) &
  SERVER_PID=$!
  # Le serveur Next met une seconde ou deux à écouter ; on sonde plutôt que d'attendre à l'aveugle.
  READY=0
  for _ in $(seq 1 40); do
    if curl -fsS -o /dev/null "http://127.0.0.1:${PORT}/api/health" 2>/dev/null; then READY=1; break; fi
    sleep 0.5
  done

  if [ "$READY" -eq 1 ]; then
    for route in / /learning /exercises /reviews /settings; do
      code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${PORT}${route}")"
      if [ "$code" = "200" ]; then
        log_ok "GET $route → 200"
      else
        log_err "GET $route → $code"
        FAILED=1
      fi
    done
  else
    log_err "Le serveur n'a pas répondu sur le port $PORT — voir /tmp/learning-os-verify.log"
    FAILED=1
  fi

  kill "$SERVER_PID" 2>/dev/null || true
  wait "$SERVER_PID" 2>/dev/null || true
fi

log_step "Secrets"
if bash "$ROOT/scripts/check-secrets.sh" >/dev/null 2>&1; then
  log_ok "Aucun secret committable"
else
  log_err "check-secrets.sh a trouvé quelque chose — lance-le pour le détail"
  FAILED=1
fi

if [ "$FAILED" -eq 0 ]; then
  log_title "Tout est vert."
  log_dim "cd app && npm run dev  →  http://localhost:3000"
  exit 0
fi

log_title "Il reste des erreurs."
exit 1
