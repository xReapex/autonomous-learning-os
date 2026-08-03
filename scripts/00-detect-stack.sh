#!/usr/bin/env bash
# Repère ce qui est déjà installé ET connecté sur la machine, pour que l'agent
# propose la stack de l'utilisateur au lieu d'une stack générique.
#
# Écrit .setup/stack.json et affiche un résumé lisible. Ne modifie rien d'autre.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=lib/log.sh
. "$ROOT/scripts/lib/log.sh"

OUT_DIR="$ROOT/.setup"
OUT="$OUT_DIR/stack.json"
mkdir -p "$OUT_DIR"

has() { command -v "$1" >/dev/null 2>&1; }

# version <cmd> <args...> — première ligne de sortie, tronquée, jamais d'échec.
version() {
  local cmd="$1"; shift
  has "$cmd" || { printf ''; return; }
  "$cmd" "$@" 2>/dev/null | head -n 1 | tr -d '\r' | cut -c1-60
}

# Authentification : une commande qui échoue sans session, silencieuse.
authed() {
  if "$@" >/dev/null 2>&1; then printf 'true'; else printf 'false'; fi
}

json_str() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }

log_title "Repérage de la stack"

NODE_V="$(version node --version)"
NPM_V="$(version npm --version)"
PY_V="$(version python3 --version)"

SUPABASE=false;  SUPABASE_AUTH=false
RAILWAY=false;   RAILWAY_AUTH=false
NEON=false;      NEON_AUTH=false
PSQL=false
VERCEL=false;    VERCEL_AUTH=false
GH=false;        GH_AUTH=false
CLAUDE_CLI=false
CODEX_CLI=false

has supabase && { SUPABASE=true; SUPABASE_AUTH="$(authed supabase projects list)"; }
has railway  && { RAILWAY=true;  RAILWAY_AUTH="$(authed railway whoami)"; }
has neonctl  && { NEON=true;     NEON_AUTH="$(authed neonctl projects list)"; }
has psql     && PSQL=true
has vercel   && { VERCEL=true;   VERCEL_AUTH="$(authed vercel whoami)"; }
has gh       && { GH=true;       GH_AUTH="$(authed gh auth status)"; }
has claude   && CLAUDE_CLI=true
has codex    && CODEX_CLI=true

# Clés déjà exportées dans le shell. On note leur PRÉSENCE, jamais leur valeur.
env_present() { [ -n "${!1:-}" ] && printf 'true' || printf 'false'; }
ANTHROPIC_PRESENT="$(env_present ANTHROPIC_API_KEY)"
OPENAI_PRESENT="$(env_present OPENAI_API_KEY)"
DATABASE_PRESENT="$(env_present DATABASE_URL)"

cat > "$OUT" <<JSON
{
  "detectedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "os": "$(json_str "$(uname -s)")",
  "runtimes": {
    "node": "$(json_str "$NODE_V")",
    "npm": "$(json_str "$NPM_V")",
    "python3": "$(json_str "$PY_V")"
  },
  "database": {
    "supabase": { "installed": $SUPABASE, "authenticated": $SUPABASE_AUTH },
    "railway":  { "installed": $RAILWAY,  "authenticated": $RAILWAY_AUTH },
    "neon":     { "installed": $NEON,     "authenticated": $NEON_AUTH },
    "psql":     { "installed": $PSQL }
  },
  "deploy": {
    "vercel": { "installed": $VERCEL, "authenticated": $VERCEL_AUTH },
    "gh":     { "installed": $GH,     "authenticated": $GH_AUTH }
  },
  "ai": {
    "claudeCli": $CLAUDE_CLI,
    "codexCli": $CODEX_CLI,
    "anthropicKeyInEnv": $ANTHROPIC_PRESENT,
    "openaiKeyInEnv": $OPENAI_PRESENT
  },
  "env": {
    "databaseUrlInEnv": $DATABASE_PRESENT
  }
}
JSON

state() { [ "$1" = "true" ] && printf 'oui' || printf 'non'; }

log_step "Runtimes"
log_dim "node ${NODE_V:-absent} · npm ${NPM_V:-absent} · ${PY_V:-python3 absent}"

log_step "Bases de données"
log_dim "supabase installé=$(state "$SUPABASE") connecté=$(state "$SUPABASE_AUTH")"
log_dim "railway  installé=$(state "$RAILWAY")  connecté=$(state "$RAILWAY_AUTH")"
log_dim "neonctl  installé=$(state "$NEON")     connecté=$(state "$NEON_AUTH")"
log_dim "psql     installé=$(state "$PSQL")"

log_step "Déploiement"
log_dim "vercel installé=$(state "$VERCEL") connecté=$(state "$VERCEL_AUTH")"
log_dim "gh     installé=$(state "$GH")     connecté=$(state "$GH_AUTH")"

log_step "IA locale"
log_dim "claude CLI=$(state "$CLAUDE_CLI") · codex CLI=$(state "$CODEX_CLI")"
log_dim "clé Anthropic dans l'env=$(state "$ANTHROPIC_PRESENT") · clé OpenAI=$(state "$OPENAI_PRESENT")"

log_ok "Écrit dans .setup/stack.json"
[ -n "$NODE_V" ] || log_warn "node est requis pour lancer l'app — installe-le avant la phase 3."
