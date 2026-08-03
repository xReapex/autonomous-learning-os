# L'app

Le dashboard qui tourne. Next.js 16, React 19, CSS pur, zéro dépendance
optionnelle.

```bash
npm install
npm run dev       # http://localhost:3000
npm test          # 48 tests, ~200 ms
npm run build
```

Aucune clé n'est requise pour démarrer : l'app tourne sur le curriculum livré et
le stockage fichier.

## Les cinq écrans

| Route | Ce qu'on y fait |
|---|---|
| `/` | La session du jour : source, segment, chrono, cartes dues |
| `/learning` | Le cours, les notes, le mode focus |
| `/exercises` | L'exercice de transfert et sa correction |
| `/reviews` | La file de révision espacée |
| `/settings` | Fonds d'écran, stockage, mode IA, Telegram, sources |

## Ce qui se configure

Tout est dans `.env.local` (copié depuis `.env.example`) :

| Variable | Effet |
|---|---|
| `NEXT_PUBLIC_LEARNING_SUBJECT` | Le sujet affiché sous le wordmark |
| `NEXT_PUBLIC_DEFAULT_SESSION_MINUTES` | La durée de session par défaut |
| `NEXT_PUBLIC_DEFAULT_WALLPAPER` | Le fond au premier lancement |
| `STORAGE_DRIVER` | `file` ou `postgres` |
| `AI_PROVIDER` | `claude-code`, `cli` ou `api` |
| `TELEGRAM_ENABLED` | Le brief quotidien |

Détails : [`../docs/DATABASE.md`](../docs/DATABASE.md),
[`../docs/AI-PROVIDERS.md`](../docs/AI-PROVIDERS.md),
[`../docs/TELEGRAM.md`](../docs/TELEGRAM.md).

## Le curriculum

`content/curriculum.json` est la seule source de vérité du contenu. Il est écrit
par la deep research, validé par un schéma, et éditable à la main.

```bash
npm run curriculum:check
```

## Tes fonds d'écran

Dépose tes images dans `public/wallpapers/` — elles apparaissent dans
**Réglages → Apparence** au rechargement. Le dossier est git-ignoré.

Les douze fonds livrés sont procéduraux (`src/lib/wallpapers.ts`) : du SVG écrit à
la main, aucun asset binaire.

## Déployer

```bash
vercel          # ajoute DATABASE_URL, sinon rien ne persiste
railway up      # Postgres provisionné, DATABASE_URL injectée
```

Sur une app déployée, `CRON_SECRET` devient obligatoire si Telegram est actif —
sans lui, `/api/telegram` est publique.
