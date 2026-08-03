#!/usr/bin/env bash
# Refuse de laisser un secret partir dans un dépôt public.
#
# Scanne les fichiers suivis par git (plus ceux non ignorés s'il n'y a pas
# encore de commit) à la recherche de clés vivantes. Les placeholders
# documentaires (.env.example, docs) passent tant qu'ils ne portent pas de
# vraie valeur.
#
# Les correspondances sont affichées en fichier:ligne — jamais avec la valeur
# trouvée. Réimprimer un secret dans un log, c'est le fuiter une seconde fois.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=lib/log.sh
. "$ROOT/scripts/lib/log.sh"

cd "$ROOT" || exit 1
FOUND=0

LIST="$(mktemp)"
trap 'rm -f "$LIST"' EXIT

if git rev-parse --git-dir >/dev/null 2>&1; then
  git ls-files --cached --others --exclude-standard > "$LIST"
else
  find . -type f -not -path './.git/*' -not -path '*/node_modules/*' -not -path '*/.next/*' \
    | sed 's|^\./||' > "$LIST"
fi

# On écarte les binaires : un JPEG contient statistiquement n'importe quelle
# suite d'octets, y compris des motifs qui ressemblent à une clé.
FILTERED="$(mktemp)"
trap 'rm -f "$LIST" "$FILTERED"' EXIT
grep -viE '\.(png|jpe?g|gif|webp|avif|ico|woff2?|ttf|pdf|zip|mp4|mov)$' "$LIST" > "$FILTERED" || true

# Un placeholder de documentation porte des chevrons : <mot-de-passe>, <ref>, <ID>.
# Aucune vraie valeur n'en contient — `<` et `>` ne sont pas des caractères
# valides dans un userinfo d'URL non encodé, ni dans une clé d'API. C'est le
# seul assouplissement du scan, et il est volontairement étroit : « xxx »,
# « CHANGEME » ou « exemple » ne suffisent PAS à faire passer une ligne.
PLACEHOLDER='<[A-Za-z0-9_.-]+>'

# check <libellé> <regex>
check() {
  local label="$1" pattern="$2" hits=""

  while IFS= read -r file; do
    [ -f "$file" ] || continue
    local matches
    matches="$(grep -nE "$pattern" "$file" 2>/dev/null | grep -vE "$PLACEHOLDER" | cut -d: -f1)" || continue
    [ -n "$matches" ] || continue
    while IFS= read -r line; do
      [ -n "$line" ] && hits="${hits}    ${file}:${line}"$'\n'
    done <<< "$matches"
  done < "$FILTERED"

  if [ -n "$hits" ]; then
    log_err "$label"
    printf '%s' "$hits"
    FOUND=1
  fi
}

log_title "Contrôle des secrets"

check "Clé Anthropic"              'sk-ant-[A-Za-z0-9_-]{20,}'
check "Clé OpenAI"                 'sk-(proj-)?[A-Za-z0-9]{32,}'
check "Token Slack"                'xox[baprs]-[A-Za-z0-9-]{10,}'
check "Token de bot Telegram"      '[0-9]{8,10}:AA[A-Za-z0-9_-]{30,}'
check "Postgres avec mot de passe" 'postgres(ql)?://[^:@/[:space:]]+:[^@[:space:]]{6,}@'
check "Clé privée"                 'BEGIN (RSA |EC |OPENSSH |PGP )?PRIVATE KEY'
check "AWS access key"             'AKIA[0-9A-Z]{16}'
check "Token GitHub"               'gh[pousr]_[A-Za-z0-9]{30,}'
check "JWT (Supabase, autres)"     'eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}'

# Un .env réel ne doit jamais être suivi, quelle que soit sa forme.
tracked_env="$(grep -E '(^|/)\.env(\.local|\.production|\.development)?$' "$LIST" || true)"
if [ -n "$tracked_env" ]; then
  log_err "Fichier d'environnement dans l'index git"
  printf '%s\n' "$tracked_env" | sed 's/^/    /'
  FOUND=1
fi

if [ "$FOUND" -eq 0 ]; then
  log_ok "Rien à signaler — le dépôt est publiable."
  exit 0
fi

log_err "Corrige avant de committer."
log_dim "Si un secret est déjà parti : révoque-le D'ABORD, réécris l'historique ensuite."
exit 1
