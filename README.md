<div align="center">

<img src="https://img.shields.io/badge/AGENTIC-LEARNING-12A594?style=flat-square&labelColor=12A594&color=1A1A1A" alt="AGENTIC · LEARNING">

# Autonomous Learning OS

### Hand this repo to your agent. It builds you a school.

```
  ____  _       ___  ____     __   _     _____    _    ____  _   _
 | __ )(_)_____/ _ \/ ___|    \ \ | |   | ____|  / \  |  _ \| \ | |
 |  _ \| |_  / | | \___ \  ____\ \| |   |  _|   / _ \ | |_) |  \| |
 | |_) | |/ /| |_| |___) ||_____/ | |___| |___ / ___ \|  _ <| |\  |
 |____/|_/___|\___/|____/      /_/|_____|_____/_/   \_\_| \_\_| \_|
```

You answer six questions.<br>Sub-agents go hunt down the best sources in the world on your subject.<br>You walk away with your own learning dashboard — deployable, and yours.

<br>

<a href="https://bizos.cc">
<img src="https://img.shields.io/badge/BizOS-build%20autonomous%20companies-0A0A0A?style=for-the-badge&labelColor=0A0A0A" alt="BizOS — build autonomous companies">
</a>

<br><br>

<a href="https://x.com/gauthierthiry"><img src="https://img.shields.io/badge/@gauthierthiry-0A0A0A?style=flat-square&logo=x&logoColor=white" alt="X"></a>
<a href="https://youtube.com/@gquthier"><img src="https://img.shields.io/badge/@gquthier-FF0000?style=flat-square&logo=youtube&logoColor=white" alt="YouTube"></a>

<br>

<sub>Multi-agent deep research · active recall · spaced repetition · BizOS design · Telegram · zero shared keys</sub>

</div>

---

`autonomous-learning-os` is a **conversational skill**: clone the repo, open it with Claude Code (or Codex, or Cursor), and your agent runs the setup interview itself, launches the source research, generates your curriculum, and hands you a Next.js dashboard that is **fully functional on first launch**.

No API key is bundled, requested by a third party, or sent anywhere but your own machine. The default mode needs **no key at all**.

> **A note on language.** The interface, the setup skill and the docs are written in French — that's the language the tooling was built and tested in. The code, the schema and every identifier are in English, and your agent will happily run the whole setup in whatever language you speak.

## Quick start

```bash
git clone https://github.com/gquthier/autonomous-learning-os.git
cd autonomous-learning-os
claude
```

Then, in the conversation:

```
Read SKILL.md and run the setup.
```

Your agent will:

1. **Interview you** — what you want to learn, where you're starting from, how much time you actually have.
2. **Scan your machine** — which of `supabase`, `railway`, `vercel`, `gh`, `codex`, `psql` are installed *and authenticated*.
3. **Ask how you want to wire the AI** — Claude Code itself, your local CLI, or your own API key.
4. **Run the deep research** — parallel sub-agents comb university courses, YouTube channels, open textbooks and papers for your exact subject.
5. **Write your curriculum** — `app/content/curriculum.json`, validated against a schema.
6. **Start your dashboard** — `npm run dev`, live on `localhost:3000`.
7. **(Optional) Wire up Telegram** — a daily brief on your subject, sent by your own bot.

Budget 10 to 20 minutes, most of it spent on research.

---

## What you get

<table>
<tr><td width="50%" valign="top">

**A learning dashboard**

- Sessions calibrated to the time you actually have (15 → 180 min).
- A video player that **resumes at the exact second** you left off.
- Automatic segmentation: you never watch a 90-minute lecture "by default".
- Open-ended exercises, graded by your AI — or by your agent, with no key.
- SM-2 spaced repetition: every card comes back when forgetting becomes likely.
- Per-subject notes, saved locally.

</td><td width="50%" valign="top">

**The BizOS design**

- The V9 workspace: full-bleed wallpaper, white panels with a 1px rule and a hard 5px shadow, Inria Serif throughout.
- Strictly monochrome — black, white, grey. Square corners, flat buttons, nothing moves on hover.
- A built-in **wallpaper gallery** with an opacity dial — 12 procedural backgrounds shipped, plus your own.
- Every rule tracked against the V9 brief on `bizos-saas@main`, not an older doc.

</td></tr>
</table>

---

## The six setup questions

| # | Question | What it decides |
|---|----------|-----------------|
| 1 | **What do you want to learn?** | The subject, the domain, the outcome. One topic or a multi-subject track. |
| 2 | **Where are you now, where do you want to be?** | Your real starting point and a **verifiable** target ("derive a model", "read a balance sheet"). |
| 3 | **How long per day, over how many weeks?** | The shape of your sessions and the depth of the curriculum. |
| 4 | **How do we wire the AI?** | `claude-code` (no key) · `cli` (your local CLI) · `api` (your key) — see [docs/AI-PROVIDERS.md](docs/AI-PROVIDERS.md). |
| 5 | **Where does your progress live?** | A local file, or your existing stack — the agent detects Supabase / Railway / Neon. See [docs/DATABASE.md](docs/DATABASE.md). |
| 6 | **Do you want a Telegram brief?** | If yes, the agent walks you through BotFather and wires the cron. See [docs/TELEGRAM.md](docs/TELEGRAM.md). |

The exact flow, question by question, lives in [`SKILL.md`](SKILL.md).

---

## The deep research

This is the core. Rather than serving you a generic curriculum, the agent launches **four sub-agents in parallel**:

```
                       ┌──────────────────────────┐
                       │  Your subject + level    │
                       └────────────┬─────────────┘
                                    │
       ┌────────────────┬───────────┴──────┬────────────────────┐
       ▼                ▼                  ▼                    ▼
┌─────────────┐  ┌─────────────┐   ┌──────────────┐   ┌──────────────────┐
│ ACADEMIC    │  │ VIDEO       │   │ PRACTITIONER │   │ SYLLABUS         │
│ OCW courses,│  │ channels,   │   │ field notes, │   │ order of ideas,  │
│ open        │  │ timestamped │   │ case         │   │ prerequisites,   │
│ textbooks,  │  │ segments,   │   │ studies      │   │ progression      │
│ papers      │  │ playlists   │   │              │   │                  │
└──────┬──────┘  └──────┬──────┘   └──────┬───────┘   └────────┬─────────┘
       └────────────────┴──────────┬───────┴────────────────────┘
                                   ▼
                      ┌────────────────────────┐
                      │  curriculum.json       │
                      │  validated + dated +   │
                      │  every source sourced  │
                      └────────────────────────┘
```

Every source that makes the cut has to pass the [source policy](docs/SOURCE-POLICY.md): freely accessible, named author and institution, a verification date, and an explicit pedagogical reason. Full prompts in [`research/PROMPTS.md`](research/PROMPTS.md), schema in [`research/curriculum.schema.json`](research/curriculum.schema.json).

---

## Architecture

```
autonomous-learning-os/
├── SKILL.md                   ← your agent reads this first
├── setup.sh                   ← non-interactive bootstrap (CI / re-runs)
├── scripts/                   ← stack detection, scaffold, DB, Telegram, verify
├── research/                  ← sub-agent prompts + curriculum schema
├── docs/                      ← one doc per setup decision
└── app/                       ← your Next.js dashboard (this is what runs)
    ├── content/curriculum.json    ← written by the deep research
    ├── src/lib/storage/           ← file | Postgres, same interface
    ├── src/lib/ai/                ← claude-code | cli | api, same interface
    └── src/components/            ← the BizOS design
```

Full breakdown in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Security: what this repo does not do

- **It ships no keys.** `.env` is ignored everywhere; `.env.example` holds nothing but placeholders.
- **It sends nothing to a third-party server.** The only outbound calls are the ones you configure: your AI provider, your Postgres, your Telegram bot.
- **It doesn't share our keys.** The default mode (`claude-code`) uses no API key at all: your own agent, already authenticated on your machine, does the work.
- **It refuses to commit a secret.** `scripts/check-secrets.sh` blocks the commit when a file looks like it holds a key (`sk-`, `xoxb-`, a Telegram token, a Postgres URL with a password).

```bash
bash scripts/check-secrets.sh   # run this before any push
```

---

## Developing the app

```bash
cd app
npm install
npm run dev       # http://localhost:3000
npm test          # vitest — session planning, SM-2, curriculum parsing
npm run build
```

No key needed to get it running: the app boots on the shipped curriculum and file storage.

---

## Deploying

| Target | Command | Note |
|---|---|---|
| **Vercel** | `cd app && vercel` | Add `DATABASE_URL` if you want progress to persist across devices. |
| **Railway** | `cd app && railway up` | Postgres provisioned in one click, `DATABASE_URL` injected. |
| **Local only** | `npm run build && npm start` | File storage in `app/.data/`, nothing leaves your machine. |

---

## Troubleshooting

See [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md):

- Video doesn't resume → the embed must be `youtube-nocookie.com/embed/...` with `enablejsapi=1`.
- `curriculum.json` rejected → `node scripts/validate-curriculum.mjs` points at the offending line.
- Telegram silent → the chat ID only exists **after** you message the bot.
- Postgres refuses to connect → SSL is required on Supabase/Neon, see `docs/DATABASE.md`.

---

## Credits & foundations

The learning loop (recall → capsule → practice → reflect → space) is documented with its sources in [docs/LEARNING-SCIENCE.md](docs/LEARNING-SCIENCE.md). Every product decision there is tied to a meta-analysis, along with its limits — no neuromyths.

## License

MIT — see [`LICENSE`](LICENSE).

Built by [Gauthier](https://github.com/gquthier).

---

<div align="center">

<br>

### Building something that runs on its own?

**[bizos.cc](https://bizos.cc)** — build autonomous companies.

<br>

<a href="https://x.com/gauthierthiry"><img src="https://img.shields.io/badge/@gauthierthiry-0A0A0A?style=flat-square&logo=x&logoColor=white" alt="X"></a>
<a href="https://youtube.com/@gquthier"><img src="https://img.shields.io/badge/@gquthier-FF0000?style=flat-square&logo=youtube&logoColor=white" alt="YouTube"></a>

<br><br>

<sub>By <a href="https://x.com/gauthierthiry">Gauthier Thiry</a></sub>

</div>
