#!/usr/bin/env bash
# Bootstrap non interactif — le même parcours que le skill, sans l'entretien.
#
# À utiliser pour relancer un setup, en CI, ou pour démarrer tout de suite avec
# le curriculum d'exemple et regarder à quoi ça ressemble.
#
# Le vrai parcours, celui qui construit un curriculum SUR MESURE, passe par un
# agent qui lit SKILL.md : c'est l'entretien et la deep research qui font la
# valeur, et ni l'un ni l'autre ne se scriptent en bash.
#
# Usage :
#   bash setup.sh
#   bash setup.sh --subject "Finance quantitative" --minutes 45 --wallpaper ledger

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/lib/log.sh
. "$ROOT/scripts/lib/log.sh"

SUBJECT="Apprentissage"
PROVIDER="claude-code"
MINUTES="30"
WALLPAPER="desk"

while [ $# -gt 0 ]; do
  case "$1" in
    --subject)   SUBJECT="${2:-}"; shift 2 ;;
    --provider)  PROVIDER="${2:-}"; shift 2 ;;
    --minutes)   MINUTES="${2:-}"; shift 2 ;;
    --wallpaper) WALLPAPER="${2:-}"; shift 2 ;;
    -h|--help)
      printf 'Usage: bash setup.sh [--subject "…"] [--provider claude-code|cli|api] [--minutes 30] [--wallpaper desk]\n'
      exit 0 ;;
    *) die "Option inconnue : $1 (voir --help)" ;;
  esac
done

command -v node >/dev/null 2>&1 || die "node est requis. Installe-le, puis relance."
command -v npm  >/dev/null 2>&1 || die "npm est requis. Installe-le, puis relance."

printf '\n'
log_title "BizOS × Learning — bootstrap"
log_dim "Pour un curriculum sur mesure, ouvre ce dossier avec ton agent et demande-lui de lire SKILL.md."
printf '\n'

bash "$ROOT/scripts/00-detect-stack.sh"
bash "$ROOT/scripts/01-scaffold.sh"
bash "$ROOT/scripts/02-configure.sh" \
  --subject "$SUBJECT" --provider "$PROVIDER" --minutes "$MINUTES" --wallpaper "$WALLPAPER"
bash "$ROOT/scripts/03-database.sh" file

log_title "Prêt."
log_dim "cd app && npm run dev  →  http://localhost:3000"
printf '\n'
log_step "Ce qui reste à faire pour que ce soit VRAIMENT à toi"
log_dim "1. Ouvre ce dossier avec ton agent : « Lis SKILL.md et lance le setup. »"
log_dim "2. Il t'interviewe, lance la deep research, et remplace le curriculum d'exemple."
log_dim "3. Optionnel : scripts/03-database.sh (multi-appareils) · scripts/04-telegram.sh (brief quotidien)"
printf '\n'
