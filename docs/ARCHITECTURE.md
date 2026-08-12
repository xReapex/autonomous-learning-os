# Architecture

Deux moitiés qui ne se ressemblent pas : un **skill de setup** que l'agent lit une
fois, et une **app** qui tourne ensuite tous les jours.

```
autonomous-learning-os/
│
├── SKILL.md ─────────────► ce que l'agent lit en premier
├── setup.sh ─────────────► le même parcours, non interactif
│
├── scripts/              LE SETUP — s'exécute une fois
│   ├── 00-detect-stack.sh    lit la machine, écrit .setup/stack.json
│   ├── 01-scaffold.sh        .env.local, .data/, npm install
│   ├── 02-configure.sh       écrit les réponses de l'entretien
│   ├── 03-database.sh        file | supabase | railway | url
│   ├── 04-telegram.sh        token → chat ID → test d'envoi
│   ├── 05-verify.sh          LE GATE : curriculum, tests, build, HTTP, secrets
│   ├── validate-curriculum.mjs
│   └── check-secrets.sh
│
├── research/             LA RECHERCHE — s'exécute une fois par cursus
│   ├── PROMPTS.md            4 sous-agents + règles de fusion
│   └── curriculum.schema.json
│
└── app/                  L'APP — tourne tous les jours
    ├── content/curriculum.json   ← la seule sortie de la recherche
    ├── sql/001_schema.sql
    └── src/
        ├── lib/          logique pure, testée
        ├── components/   le design BizOS
        └── app/          routes et API
```

---

## Le point de jonction

Tout se rejoint sur **un seul fichier** : `app/content/curriculum.json`.

```
    entretien ──┐
                ├──► 4 sous-agents ──► fusion ──► curriculum.json ──► l'app
    recherche ──┘                                       ▲
                                                        │
                                        validate-curriculum.mjs
                                        (schéma + règles métier)
```

C'est délibéré. Le curriculum est une **donnée**, pas du code : on peut l'éditer
à la main, le regénérer, le versionner, en avoir plusieurs. L'app ne sait rien de
la façon dont il a été produit.

---

## L'app, couche par couche

### `src/lib/` — la logique pure

Aucun accès réseau, aucun DOM, aucune date implicite. C'est ce qui la rend
testable : 48 tests couvrent cette couche, et ils tournent en 200 ms.

| Module | Responsabilité | Décision qui compte |
|---|---|---|
| `curriculum.ts` | Charge et normalise le JSON | Import statique : le curriculum ne change pas pendant une session |
| `study-plan.ts` | La forme d'une session | Le temps change les **volumes**, jamais la boucle |
| `scheduler.ts` | SM-2 | Notes 0-3 plutôt que 0-5 : quatre boutons, c'est ce qu'un humain distingue |
| `lesson-progress.ts` | Reprise de lecture | Contrôle d'origine sur les messages du lecteur |
| `format.ts` | Affichage | — |
| `wallpapers.ts` | Le catalogue de fonds | Entièrement procédural, aucun binaire |

### `src/lib/storage/` — deux pilotes, une interface

```
        getStorage()
             │
     ┌───────┴────────┐
     ▼                ▼
file-storage    postgres-storage
 .data/*.json      pg + pool
```

Le choix se fait une fois, au premier appel, depuis `STORAGE_DRIVER`. Si
`postgres` est demandé sans `DATABASE_URL`, l'app **retombe sur le fichier avec un
avertissement** plutôt que de refuser de démarrer : une app qui étudie en local
vaut mieux qu'une app morte.

Détails : [DATABASE.md](DATABASE.md).

### `src/lib/ai/` — trois modes, une interface

```
runPrompt(prompt)
   ├── claude-code → { status: "manual", prompt }   aucun appel sortant
   ├── cli         → spawn(claude|codex), stdin     aucune clé stockée
   └── api         → fetch Anthropic|OpenAI         la clé de l'utilisateur
```

Le mode `manual` n'est pas une erreur : c'est un résultat légitime que l'interface
sait afficher. Détails : [AI-PROVIDERS.md](AI-PROVIDERS.md).

### `src/app/api/` — les routes

| Route | Verbe | Rôle |
|---|---|---|
| `/api/health` | GET | État réel : stockage, mode IA, curriculum |
| `/api/progress/[lessonId]` | GET, PUT | Position de lecture |
| `/api/cards` | GET, POST | File de révision, notation SM-2 |
| `/api/notes` | GET, PUT | Notes par matière |
| `/api/coach` | GET, POST | Correction d'exercice + historique |
| `/api/telegram` | GET, POST | Brief quotidien |
| `/api/wallpapers` | GET | Fonds déposés dans `public/wallpapers/` |

Règle commune : **l'identité vient du curriculum, jamais du client**. `PUT
/api/progress/x` reprend l'URL de source depuis `curriculum.json` et ignore celle
du corps de requête — une progression ne doit pas pouvoir pointer ailleurs que
sur la leçon qu'elle nomme.

### `src/components/` — le bureau

```
layout.tsx
  └── WallpaperProvider        fond + opacité, persistés en localStorage
        └── StudyProvider      durée, chrono, matière, notes
              └── LearningShell   menubar + rail + page
                    └── <page>
```

Le chrono vit dans le provider, pas dans la page : changer d'onglet ne doit pas
remettre la session à zéro.

Détails visuels : [DESIGN.md](DESIGN.md).

---

## Le lecteur vidéo

C'est la pièce la moins évidente, et celle qui fait revenir.

YouTube n'expose pas d'API de progression sans charger son SDK. On parle donc
directement à l'iframe :

```
   app                              iframe YouTube
    │  postMessage {listening}  ──────────►
    │  postMessage {getCurrentTime} ─────►   (toutes les 2 s)
    │  ◄──────── {event:"infoDelivery", info:{currentTime,…}}
    │
    └─► PUT /api/progress/<lesson>          (toutes les 5 s, si ça a bougé)
```

Quatre garde-fous :

1. **Contrôle d'origine** — seuls `youtube.com` et `youtube-nocookie.com` sont
   acceptés. Sans ça, n'importe quelle page ouverte pourrait falsifier la
   progression.
2. **Écriture conditionnelle** — moins de 2 s d'écart, on n'écrit pas.
3. **Sauvegarde forcée** sur pause, passage en arrière-plan et démontage. C'est ce
   qui évite de perdre les dernières minutes quand on ferme l'onglet d'un coup.
4. **Refs plutôt qu'état** pour ce que lisent les timers : un `setInterval`
   capturerait sinon la valeur du rendu où il a été créé.

Le curriculum impose `embedUrl` sur toute source vidéo, et le validateur le
refuse s'il manque : sans embed, ni le découpage ni la reprise ne fonctionnent.

---

## Sécurité

- **CSP stricte** (`next.config.ts`) : `frame-src` autorise YouTube et rien
  d'autre, `connect-src 'self'`, pas de CDN de script, pas de police distante.
- **Aucune clé dans le dépôt.** `check-secrets.sh` scanne neuf motifs et refuse
  qu'un `.env` entre dans l'index git. Il est testé dans les deux sens.
- **Le token Telegram ne sort jamais dans un log** — il est dans l'URL de l'API,
  donc les erreurs ne réimpriment jamais l'URL.
- **`/api/telegram` exige `CRON_SECRET`** dès qu'il est défini. Sur une app
  déployée sans lui, n'importe qui pourrait déclencher des envois.
- **`robots: noindex`** — l'app est personnelle.

---

## Ce qui n'est pas là, et pourquoi

| Absent | Raison |
|---|---|
| Authentification native | L'app reste mono-utilisateur. En ligne, l'authentification obligatoire est assurée par le reverse proxy documenté dans `deploy/`; aucun `APP_PASSWORD` applicatif trompeur n'est accepté. |
| Multi-utilisateur | Change le modèle de données de fond en comble. Ce n'est pas ce produit. |
| Tailwind | Une feuille CSS de 700 lignes lisible bat une chaîne de build pour ce volume. |
| Police web | `next/font` demande le réseau au build. L'app doit se construire hors ligne. |
| SDK IA | Deux dépendances pour deux requêtes POST. |
| Tests de composants | Le smoke test HTTP de `05-verify.sh` vérifie ce qui compte : que les pages répondent. Le reste serait du test de framework. |
