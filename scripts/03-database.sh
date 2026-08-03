#!/usr/bin/env bash
# Branche la progression sur un Postgres, si l'utilisateur en veut un.
#
#   03-database.sh file      → stockage fichier (défaut, rien à provisionner)
#   03-database.sh supabase  → projet Supabase lié, schéma appliqué
#   03-database.sh railway   → Postgres Railway provisionné, schéma appliqué
#   03-database.sh url       → une URL Postgres existante, saisie sans écho
#
# L'URL n'est jamais affichée ni passée en argument : elle est lue en mode
# secret et écrite directement dans app/.env.local (chmod 600).

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=lib/ask.sh
. "$ROOT/scripts/lib/ask.sh"

ENV_FILE="$ROOT/app/.env.local"
SCHEMA="$ROOT/app/sql/001_schema.sql"
MODE="${1:-file}"

[ -f "$ENV_FILE" ] || die "app/.env.local absent — lance d'abord scripts/01-scaffold.sh"

set_env() {
  local key="$1" value="$2" tmp
  tmp="$(mktemp)"
  grep -v "^${key}=" "$ENV_FILE" > "$tmp" 2>/dev/null || true
  printf '%s=%s\n' "$key" "$value" >> "$tmp"
  mv "$tmp" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
}

apply_schema() {
  local url="$1"
  command -v psql >/dev/null 2>&1 || {
    log_warn "psql absent : le schéma n'a pas été appliqué."
    log_dim "L'app crée les tables au premier démarrage — ou applique app/sql/001_schema.sql à la main."
    return 0
  }
  log_step "Application du schéma"
  if psql "$url" -v ON_ERROR_STOP=1 -q -f "$SCHEMA"; then
    log_ok "Schéma appliqué"
  else
    log_warn "psql a refusé le schéma. L'app le rejouera au démarrage (CREATE TABLE IF NOT EXISTS)."
  fi
}

log_title "Stockage de la progression"

case "$MODE" in
  file)
    set_env STORAGE_DRIVER file
    mkdir -p "$ROOT/app/.data"
    log_ok "Stockage fichier : app/.data/ (git-ignoré, ne quitte pas ta machine)"
    ;;

  supabase)
    command -v supabase >/dev/null 2>&1 || die "La CLI supabase n'est pas installée."
    supabase projects list >/dev/null 2>&1 || die "CLI supabase non authentifiée — lance 'supabase login'."
    log_step "Projets Supabase disponibles"
    supabase projects list || true
    log_dim "Récupère l'URI de connexion : Dashboard → Project Settings → Database → Connection string (URI)."
    log_dim "Prends bien le pooler (port 6543) si tu déploies en serverless."
    url="$(ask_secret "Colle la connection string Postgres (masquée) :")"
    [ -n "$url" ] || die "Aucune URL saisie."
    set_env STORAGE_DRIVER postgres
    set_env DATABASE_URL "$url"
    set_env PGSSL require
    apply_schema "$url"
    log_ok "Supabase branché"
    ;;

  railway)
    command -v railway >/dev/null 2>&1 || die "La CLI railway n'est pas installée."
    railway whoami >/dev/null 2>&1 || die "CLI railway non authentifiée — lance 'railway login'."
    log_step "Lien du projet Railway"
    railway status >/dev/null 2>&1 || railway link
    log_dim "Si aucun Postgres n'existe : railway add --database postgres"
    url="$(railway variables --json 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const v=JSON.parse(s);process.stdout.write(v.DATABASE_URL||v.POSTGRES_URL||"")}catch{process.stdout.write("")}})' || true)"
    if [ -z "$url" ]; then
      log_warn "DATABASE_URL introuvable dans les variables Railway."
      url="$(ask_secret "Colle-la manuellement (masquée) :")"
    else
      log_ok "DATABASE_URL récupérée depuis Railway"
    fi
    [ -n "$url" ] || die "Aucune URL disponible."
    set_env STORAGE_DRIVER postgres
    set_env DATABASE_URL "$url"
    apply_schema "$url"
    log_ok "Railway branché"
    ;;

  url)
    url="$(ask_secret "Colle ton URL Postgres (masquée) :")"
    [ -n "$url" ] || die "Aucune URL saisie."
    case "$url" in postgres://*|postgresql://*) ;; *) die "Ça ne ressemble pas à une URL Postgres." ;; esac
    set_env STORAGE_DRIVER postgres
    set_env DATABASE_URL "$url"
    apply_schema "$url"
    log_ok "Postgres branché"
    ;;

  *)
    die "Mode inconnu : $MODE (attendu file, supabase, railway ou url)"
    ;;
esac
