#!/usr/bin/env bash
# shellcheck source=./colors.sh
. "$(dirname "${BASH_SOURCE[0]}")/colors.sh"

log_title() { printf '\n%s%s%s\n' "${C_BOLD}${C_PURPLE}" "$*" "$C_RESET"; }
log_step()  { printf '%s▸%s %s\n' "$C_PURPLE" "$C_RESET" "$*"; }
log_ok()    { printf '%s✓%s %s\n' "$C_TEAL" "$C_RESET" "$*"; }
log_warn()  { printf '%s!%s %s\n' "$C_OCHRE" "$C_RESET" "$*"; }
log_err()   { printf '%s✗%s %s\n' "$C_BRICK" "$C_RESET" "$*" >&2; }
log_dim()   { printf '%s  %s%s\n' "$C_DIM" "$*" "$C_RESET"; }

die() { log_err "$*"; exit 1; }
