#!/usr/bin/env bash
# Entrées interactives, sûres en non-interactif.
#
# Quand stdin n'est pas un terminal (agent, CI), on ne bloque jamais : on prend
# le défaut. C'est ce qui permet à un agent de lancer les scripts sans se
# retrouver suspendu sur un prompt que personne ne lira.

# shellcheck source=./log.sh
. "$(dirname "${BASH_SOURCE[0]}")/log.sh"

# ask_text <question> <défaut>
ask_text() {
  local question="$1" default="${2:-}" answer=""
  if [ ! -t 0 ]; then printf '%s' "$default"; return 0; fi
  if [ -n "$default" ]; then
    read -r -p "$(printf '%s? %s%s %s[%s]%s ' "$C_PURPLE" "$C_RESET" "$question" "$C_DIM" "$default" "$C_RESET")" answer
  else
    read -r -p "$(printf '%s? %s%s ' "$C_PURPLE" "$C_RESET" "$question")" answer
  fi
  printf '%s' "${answer:-$default}"
}

# ask_secret <question> — ne s'affiche pas, ne se log pas.
ask_secret() {
  local question="$1" answer=""
  if [ ! -t 0 ]; then printf ''; return 0; fi
  read -r -s -p "$(printf '%s? %s%s ' "$C_PURPLE" "$C_RESET" "$question")" answer
  printf '\n' >&2
  printf '%s' "$answer"
}

# ask_yes_no <question> <yes|no>
ask_yes_no() {
  local question="$1" default="${2:-yes}" answer=""
  if [ ! -t 0 ]; then [ "$default" = "yes" ] && return 0 || return 1; fi
  local hint="[O/n]"; [ "$default" = "no" ] && hint="[o/N]"
  read -r -p "$(printf '%s? %s%s %s%s%s ' "$C_PURPLE" "$C_RESET" "$question" "$C_DIM" "$hint" "$C_RESET")" answer
  answer="${answer:-$default}"
  case "$answer" in [oOyY]*) return 0 ;; *) return 1 ;; esac
}
