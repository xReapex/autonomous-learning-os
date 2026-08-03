<div align="center">

<img src="https://img.shields.io/badge/AGENTIC-LEARNING-12A594?style=flat-square&labelColor=12A594&color=1A1A1A" alt="AGENTIC · LEARNING">

# Autonomous Learning OS

### Donne ce repo à ton agent. Il te construit ton école.

```
  ____  _       ___  ____     __   _     _____    _    ____  _   _
 | __ )(_)_____/ _ \/ ___|    \ \ | |   | ____|  / \  |  _ \| \ | |
 |  _ \| |_  / | | \___ \  ____\ \| |   |  _|   / _ \ | |_) |  \| |
 | |_) | |/ /| |_| |___) ||_____/ | |___| |___ / ___ \|  _ <| |\  |
 |____/|_/___|\___/|____/      /_/|_____|_____/_/   \_\_| \_\_| \_|
```

Tu réponds à six questions.<br>Des sous-agents partent chercher les meilleures sources du monde sur ton sujet.<br>Tu repars avec ton propre dashboard d'apprentissage, déployable, à toi.

<br>

<a href="https://bizos.cc">
<img src="https://img.shields.io/badge/BizOS-build%20autonomous%20companies-0A0A0A?style=for-the-badge&labelColor=0A0A0A" alt="BizOS — build autonomous companies">
</a>

<br><br>

<a href="https://x.com/gauthierthiry"><img src="https://img.shields.io/badge/@gauthierthiry-0A0A0A?style=flat-square&logo=x&logoColor=white" alt="X"></a>
<a href="https://youtube.com/@gquthier"><img src="https://img.shields.io/badge/@gquthier-FF0000?style=flat-square&logo=youtube&logoColor=white" alt="YouTube"></a>

<br>

<sub>Deep research multi-agents · rappel actif · répétition espacée · design BizOS · Telegram · zéro clé partagée</sub>

</div>

---

`autonomous-learning-os` est un **skill conversationnel** : tu clones le repo, tu l'ouvres avec Claude Code (ou Codex, ou Cursor), et ton agent conduit lui-même l'entretien de setup, lance la recherche de sources, génère ton curriculum et te livre un dashboard Next.js **100 % fonctionnel dès le premier lancement**.

Aucune clé API n'est fournie, demandée par un tiers, ni transmise ailleurs que sur ta machine. Le mode par défaut ne nécessite **aucune clé du tout**.

## Quick start

```bash
git clone https://github.com/gquthier/autonomous-learning-os.git
cd autonomous-learning-os
claude
```

Puis, dans la conversation :

```
Lis SKILL.md et lance le setup.
```

L'agent va :

1. **T'interviewer** — ce que tu veux apprendre, ton niveau, ton temps par jour, ton horizon.
2. **Scanner ta machine** — `supabase`, `railway`, `vercel`, `gh`, `codex`, `psql` déjà installés et connectés.
3. **Te demander comment brancher l'IA** — Claude Code lui-même, ta CLI locale, ou ta propre clé API.
4. **Lancer la deep research** — des sous-agents parallèles ratissent cours universitaires, chaînes YouTube, manuels ouverts et papiers pour ton sujet exact.
5. **Écrire ton curriculum** — `app/content/curriculum.json`, validé contre un schéma.
6. **Démarrer ton dashboard** — `npm run dev`, et c'est en ligne sur `localhost:3000`.
7. **(Optionnel) Câbler Telegram** — un brief quotidien sur ton sujet, envoyé par ton bot.

Compte 10 à 20 minutes, dont l'essentiel en recherche.

---

## Ce que tu obtiens

<table>
<tr><td width="50%" valign="top">

**Un dashboard d'apprentissage**

- Session calibrée sur le temps dont tu disposes vraiment (15 → 180 min).
- Lecteur vidéo qui **reprend à la seconde exacte** où tu t'es arrêté.
- Découpage automatique : tu ne regardes jamais un cours de 90 minutes « par défaut ».
- Exercices ouverts, corrigés par ton IA — ou par ton agent, sans clé.
- Révision espacée SM-2 : chaque carte revient quand l'oubli devient probable.
- Notes par matière, sauvegardées localement.

</td><td width="50%" valign="top">

**Le design BizOS**

- Bureau crème, grain papier, fenêtres à ombre dure violette, tout en monospace.
- Wordmark `BizOS × Learning`.
- **Galerie de fonds d'écran** intégrée, avec réglage d'opacité — 12 fonds procéduraux livrés, plus les tiens.
- Coins nets, bordures 2 px, zéro dégradé, zéro flou.

</td></tr>
</table>

---

## Les six questions du setup

| # | Question | Ce que ça détermine |
|---|----------|---------------------|
| 1 | **Qu'est-ce que tu veux apprendre ?** | Le sujet, le domaine, l'objectif de sortie. Sujet unique ou cursus multi-matières. |
| 2 | **Où tu en es, et où tu veux aller ?** | Le niveau de départ et le résultat vérifiable visé (« savoir dériver un modèle », « lire un bilan »). |
| 3 | **Combien de temps par jour, sur combien de semaines ?** | La forme des sessions et la profondeur du curriculum. |
| 4 | **Comment on branche l'IA ?** | `claude-code` (aucune clé) · `cli` (ta CLI locale) · `api` (ta clé) — voir [docs/AI-PROVIDERS.md](docs/AI-PROVIDERS.md). |
| 5 | **Où stocker ta progression ?** | Fichier local, ou ta stack existante — l'agent détecte Supabase / Railway / Neon. Voir [docs/DATABASE.md](docs/DATABASE.md). |
| 6 | **Tu veux un brief Telegram ?** | Si oui, l'agent te guide sur BotFather et câble le cron. Voir [docs/TELEGRAM.md](docs/TELEGRAM.md). |

Le déroulé exact, question par question, est dans [`SKILL.md`](SKILL.md).

---

## La deep research

C'est le cœur. Plutôt que de te servir un curriculum générique, l'agent lance **quatre sous-agents en parallèle** :

```
                       ┌──────────────────────────┐
                       │  Ton sujet + ton niveau  │
                       └────────────┬─────────────┘
                                    │
       ┌────────────────┬───────────┴──────┬────────────────────┐
       ▼                ▼                  ▼                    ▼
┌─────────────┐  ┌─────────────┐   ┌──────────────┐   ┌──────────────────┐
│ ACADEMIC    │  │ VIDEO       │   │ PRACTITIONER │   │ SYLLABUS         │
│ cours OCW,  │  │ chaînes,    │   │ retours de   │   │ ordre des        │
│ manuels     │  │ segments    │   │ terrain,     │   │ notions,         │
│ ouverts,    │  │ horodatés,  │   │ études de    │   │ prérequis,       │
│ papiers     │  │ playlists   │   │ cas          │   │ progression      │
└──────┬──────┘  └──────┬──────┘   └──────┬───────┘   └────────┬─────────┘
       └────────────────┴──────────┬───────┴────────────────────┘
                                   ▼
                      ┌────────────────────────┐
                      │  curriculum.json       │
                      │  validé + daté +       │
                      │  chaque source sourcée │
                      └────────────────────────┘
```

Chaque source retenue doit passer la [politique de sources](docs/SOURCE-POLICY.md) : accessible gratuitement, auteur et institution identifiés, date de vérification, et une raison pédagogique explicite. Les prompts complets sont dans [`research/PROMPTS.md`](research/PROMPTS.md), le schéma dans [`research/curriculum.schema.json`](research/curriculum.schema.json).

---

## Architecture

```
autonomous-learning-os/
├── SKILL.md                   ← l'agent lit ça en premier
├── setup.sh                   ← bootstrap non-interactif (CI / relance)
├── scripts/                   ← détection de stack, scaffold, DB, Telegram, vérif
├── research/                  ← prompts des sous-agents + schéma du curriculum
├── docs/                      ← une doc par décision de setup
└── app/                       ← ton dashboard Next.js (c'est ce qui tourne)
    ├── content/curriculum.json    ← écrit par la deep research
    ├── src/lib/storage/           ← fichier | Postgres, même interface
    ├── src/lib/ai/                ← claude-code | cli | api, même interface
    └── src/components/            ← le design BizOS
```

Détail complet dans [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Sécurité : ce que ce repo ne fait pas

- **Il ne contient aucune clé.** `.env` est ignoré partout, `.env.example` ne porte que des placeholders.
- **Il n'envoie rien à un serveur tiers.** Les seuls appels sortants sont ceux que tu configures : ton fournisseur IA, ton Postgres, ton bot Telegram.
- **Il ne partage pas nos clés.** Le mode par défaut (`claude-code`) n'utilise aucune clé API : c'est ton agent, déjà authentifié chez toi, qui fait le travail.
- **Il refuse de committer un secret.** `scripts/check-secrets.sh` bloque le commit si un fichier ressemble à une clé (`sk-`, `xoxb-`, token Telegram, URL Postgres avec mot de passe).

```bash
bash scripts/check-secrets.sh   # à lancer avant tout push
```

---

## Développement de l'app

```bash
cd app
npm install
npm run dev       # http://localhost:3000
npm test          # vitest — plan de session, SM-2, parsing du curriculum
npm run build
```

Zéro clé requise pour que ça tourne : l'app démarre sur le curriculum d'exemple et le stockage fichier.

---

## Déploiement

| Cible | Commande | Note |
|---|---|---|
| **Vercel** | `cd app && vercel` | Ajoute `DATABASE_URL` si tu veux la progression persistée entre appareils. |
| **Railway** | `cd app && railway up` | Postgres provisionné en un clic, `DATABASE_URL` injectée. |
| **Local seul** | `npm run build && npm start` | Stockage fichier dans `app/.data/`, rien ne sort de ta machine. |

---

## Troubleshooting

Voir [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) :

- La vidéo ne reprend pas → l'embed doit être `youtube-nocookie.com/embed/...` avec `enablejsapi=1`.
- `curriculum.json` rejeté → `node scripts/validate-curriculum.mjs` donne la ligne fautive.
- Telegram muet → le chat ID doit être obtenu **après** avoir écrit au bot.
- Postgres refuse la connexion → SSL requis sur Supabase/Neon, voir `docs/DATABASE.md`.

---

## Crédits & fondations

La boucle pédagogique (rappel → capsule → pratique → bilan → espacement) est documentée avec ses sources dans [docs/LEARNING-SCIENCE.md](docs/LEARNING-SCIENCE.md). Chaque décision produit y est reliée à une méta-analyse, avec ses limites — pas de neuro-mythe.

## License

MIT — voir [`LICENSE`](LICENSE).

Built by [Gauthier](https://github.com/gquthier).

---

<div align="center">

<br>

### Tu construis quelque chose qui tourne tout seul ?

**[bizos.cc](https://bizos.cc)** — build autonomous companies.

<br>

<a href="https://x.com/gauthierthiry"><img src="https://img.shields.io/badge/@gauthierthiry-0A0A0A?style=flat-square&logo=x&logoColor=white" alt="X"></a>
<a href="https://youtube.com/@gquthier"><img src="https://img.shields.io/badge/@gquthier-FF0000?style=flat-square&logo=youtube&logoColor=white" alt="YouTube"></a>

<br><br>

<sub>Par <a href="https://x.com/gauthierthiry">Gauthier Thiry</a></sub>

</div>
