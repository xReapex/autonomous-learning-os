# Où stocker ta progression

Deux pilotes, une seule interface (`app/src/lib/storage/types.ts`). Passer de
l'un à l'autre ne change pas une ligne de page.

| Pilote | `STORAGE_DRIVER` | Quand | Ce qui sort de ta machine |
|---|---|---|---|
| **Fichier** *(défaut)* | `file` | Solo, une machine | rien |
| **Postgres** | `postgres` | Plusieurs appareils, ou app déployée | tes données, vers ton serveur |

---

## Fichier — le défaut

Rien à configurer. Quatre fichiers JSON dans `app/.data/`, créés au premier
écrit, git-ignorés.

```
app/.data/
├── progress.json   position de lecture par leçon
├── cards.json      état SM-2 de chaque carte
├── notes.json      tes notes par matière
└── answers.json    l'historique de tes exercices (500 derniers)
```

Deux détails d'implémentation qui évitent la corruption :

- **Écriture atomique** — fichier temporaire puis `rename()`. Une coupure ne
  laisse jamais un JSON tronqué.
- **File par fichier** — deux requêtes simultanées sur la même leçon se
  sérialisent. Sans ça, un cycle lecture-modification-écriture perdrait une des
  deux écritures.

Sauvegarde : copie le dossier. Migration vers une autre machine : copie le
dossier. C'est tout.

---

## Postgres

Utile dès que tu veux la progression sur le portable **et** le fixe, ou que tu
déploies l'app.

### Supabase

```bash
bash scripts/03-database.sh supabase
```

Le script liste tes projets et demande la connection string. Va la chercher dans
**Dashboard → Project Settings → Database → Connection string (URI)**.

Prends le **pooler, port 6543**, pas la connexion directe 5432 : en serverless,
chaque invocation ouvre une connexion, et le direct sature vite.

```
postgresql://postgres.<ref>:<mot-de-passe>@aws-0-<region>.pooler.supabase.com:6543/postgres
```

### Railway

```bash
bash scripts/03-database.sh railway
```

Le script lie le projet et lit `DATABASE_URL` dans ses variables. Si aucun
Postgres n'existe :

```bash
railway add --database postgres
```

### Neon

```bash
neonctl connection-string --project-id <id>
bash scripts/03-database.sh url
```

Neon exige `?sslmode=require` dans l'URL, ou `PGSSL=require` dans l'env.

### Un Postgres à toi

```bash
bash scripts/03-database.sh url
```

L'URL est saisie masquée et n'apparaît ni à l'écran, ni dans l'historique du
shell, ni dans la liste des processus.

---

## Le schéma

Quatre tables, dans `app/sql/001_schema.sql` :

| Table | Contenu | Clé |
|---|---|---|
| `lesson_progress` | Position, durée, achèvement par leçon | `lesson_id` |
| `card_states` | État SM-2 : ease, intervalle, échéance | `card_id` |
| `subject_notes` | Tes notes par matière | `subject_id` |
| `exercise_answers` | Historique append-only des exercices | `id` |

Tout est `IF NOT EXISTS` : le script l'applique, et l'app le rejoue au premier
appel si `psql` manquait. Relançable sans risque.

Deux règles inscrites dans le SQL plutôt que dans le code :

- `duration_seconds` ne fait que **croître** (`GREATEST`) — un lecteur qui
  rapporte 0 une seconde ne doit pas effacer une durée connue.
- `completed_at` est **conservé** (`COALESCE`) — une leçon terminée le reste, et
  garde sa première date.

---

## SSL

Supabase, Neon et Railway servent des certificats que Node ne valide pas contre
son magasin par défaut. Le pilote applique `rejectUnauthorized: false` quand
l'URL vient d'un de ces hébergeurs ou quand `PGSSL=require`.

Ça **chiffre le transport** sans exiger la chaîne — c'est la posture documentée
par ces trois fournisseurs. Sur un Postgres que tu administres avec un certificat
valide, laisse `PGSSL` vide.

---

## Migrer fichier → Postgres

Il n'y a pas de script d'import : les volumes sont minuscules et un import
automatique qui écrase silencieusement une base existante ferait plus de dégâts
qu'il n'en évite.

```bash
# 1. Provisionne
bash scripts/03-database.sh supabase

# 2. Repars de zéro (le plus simple) — ou réinjecte à la main depuis .data/
#    en lisant progress.json et cards.json.
```

Pour réinjecter, `app/.data/cards.json` mappe directement sur `card_states` :
les noms de champs passent de `camelCase` à `snake_case`, rien d'autre.

---

## Dépannage

| Symptôme | Cause | Correction |
|---|---|---|
| `STORAGE_DRIVER=postgres sans DATABASE_URL` dans les logs | Variable vide | L'app est retombée en mode fichier — renseigne l'URL |
| `self signed certificate` | SSL non déclaré | `PGSSL=require` |
| `too many connections` | Connexion directe en serverless | Passe sur le pooler (port 6543) |
| `password authentication failed` | Caractères spéciaux non encodés | Encode le mot de passe en URL (`@` → `%40`) |
| Timeout à la connexion | IP non autorisée | Vérifie les restrictions réseau du fournisseur |
| Progression qui ne suit pas d'un appareil à l'autre | Toujours en mode fichier | **Réglages → Stockage** affiche le pilote réel |

L'état réel est visible dans l'interface (**Réglages → Stockage**) et sur
`/api/health`.
