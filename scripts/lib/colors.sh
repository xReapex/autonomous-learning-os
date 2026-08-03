#!/usr/bin/env bash
# Palette partagée. Se désactive toute seule quand la sortie n'est pas un TTY
# (CI, pipe, capture par un agent) — les codes ANSI dans un log sont du bruit.

if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  C_RESET=$'\033[0m'
  C_DIM=$'\033[2m'
  C_BOLD=$'\033[1m'
  C_PURPLE=$'\033[38;5;99m'
  C_TEAL=$'\033[38;5;37m'
  C_OCHRE=$'\033[38;5;178m'
  C_BRICK=$'\033[38;5;167m'
else
  C_RESET='' C_DIM='' C_BOLD='' C_PURPLE='' C_TEAL='' C_OCHRE='' C_BRICK=''
fi

export C_RESET C_DIM C_BOLD C_PURPLE C_TEAL C_OCHRE C_BRICK
