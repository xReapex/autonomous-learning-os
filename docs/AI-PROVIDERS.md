# Brancher l'IA

Trois modes, une seule interface côté app. **Aucun ne partage une clé** : ce
dépôt n'en contient aucune et n'en demande aucune qui ne soit la tienne.

| Mode | `AI_PROVIDER` | Clé requise | Coût | Marche hors ligne |
|---|---|---|---|---|
| **Ton agent** *(défaut)* | `claude-code` | aucune | 0 | oui |
| **Ta CLI locale** | `cli` | aucune dans un fichier | ton abonnement CLI | non |
| **Ta clé API** | `api` | la tienne | à l'usage | non |

---

## `claude-code` — ton agent corrige

C'est le mode par défaut, et ce n'est pas un repli au rabais.

L'app ne parle à aucun modèle. Quand tu envoies un exercice, elle assemble le
prompt de correction — la question, les points de contrôle de la leçon, ta
réponse — et te l'affiche avec un bouton **Copier**. Tu le colles dans l'agent
que tu as déjà ouvert, tu récupères la correction.

Ce que ça donne :

- Aucune clé à créer, aucun budget à surveiller.
- L'app fonctionne dans un avion : la génération du prompt est locale.
- Ta réponse est enregistrée dans ton historique quoi qu'il arrive, corrigée ou
  non — c'est la trace d'apprentissage qui compte.
- Ton agent a du contexte que l'app n'a pas : il te connaît, il a lu ton code, il
  sait sur quoi tu bloques.

Ce que ça coûte : un aller-retour manuel. Si ça te freine, passe en `cli`.

```bash
AI_PROVIDER=claude-code
```

---

## `cli` — l'app appelle ta CLI locale

L'app lance un sous-processus sur ta machine et lui passe le prompt par
`stdin`. L'authentification est celle de la CLI : rien n'est stocké dans l'app.

```bash
AI_PROVIDER=cli
AI_CLI_BIN=claude    # ou codex
```

| Binaire | Commande construite | Pré-requis |
|---|---|---|
| `claude` | `claude -p` | Claude Code installé et connecté |
| `codex` | `codex exec --` | Codex CLI installé et connecté |

Détails d'implémentation qui comptent :

- Le prompt part par **stdin**, jamais en argument de ligne de commande. Il
  contient ta réponse, et les arguments d'un processus sont lisibles par `ps`.
- Un appel qui dépasse **2 minutes** est tué, avec une erreur explicite. Un
  sous-processus zombie bloquerait la route.
- Un binaire introuvable renvoie un message qui nomme `AI_CLI_BIN` plutôt qu'un
  `ENOENT` opaque.

Pour vérifier que ta CLI répond bien en mode non interactif :

```bash
echo "Dis bonjour en un mot." | claude -p
```

---

## `api` — ta clé, ton compte

L'app appelle Anthropic ou OpenAI en HTTP direct (pas de SDK : deux dépendances
de moins pour deux requêtes POST).

```bash
AI_PROVIDER=api
AI_API_VENDOR=anthropic        # ou openai
ANTHROPIC_API_KEY=…            # que tu écris toi-même
AI_MODEL=                      # vide = défaut du fournisseur
```

### Où mettre la clé

Dans `app/.env.local`, que tu édites **toi-même**. Le fichier est en `chmod 600`
et git-ignoré.

Ne colle jamais ta clé dans une conversation avec un agent, ni dans une commande
que tu tapes au clavier — l'historique du shell la conserve. Si tu dois le faire
en ligne de commande :

```bash
# l'espace en début de ligne évite l'historique sur la plupart des shells
 printf 'ANTHROPIC_API_KEY=%s\n' "$MA_CLE" >> app/.env.local
```

### Modèles

| Fournisseur | Défaut | Pourquoi |
|---|---|---|
| Anthropic | `claude-sonnet-4-5-20250929` | Bon rapport qualité/coût sur de la correction de texte |
| OpenAI | `gpt-4.1` | Équivalent chez OpenAI |

Pour en changer, mets l'identifiant exact dans `AI_MODEL`. Un identifiant inconnu
renvoie une 404 du fournisseur, remontée telle quelle dans l'interface.

### Ce que ça coûte

Une correction fait environ 800 à 1 200 tokens de sortie sur 1 500 d'entrée. À
une correction par jour, c'est quelques centimes par mois. Ce n'est pas le coût
qui doit décider — c'est de savoir si tu veux la boucle automatique ou pas.

---

## Changer d'avis

Édite `AI_PROVIDER` dans `app/.env.local` et redémarre le serveur. Rien d'autre
ne bouge : l'historique des exercices, la progression et les cartes sont
indépendants du mode.

L'écran **Réglages → Correction IA** affiche le mode actif et ce qu'il implique.

---

## Ce que l'app n'envoie jamais

Quel que soit le mode :

- Ta progression vidéo, tes notes et ton état de révision ne sortent pas. Le
  prompt de correction contient la question, les points de contrôle et **ta
  réponse** — rien d'autre.
- Aucune télémétrie. Il n'y a pas de serveur de collecte dans ce projet.
- En mode `claude-code`, il n'y a **aucun appel sortant**.
