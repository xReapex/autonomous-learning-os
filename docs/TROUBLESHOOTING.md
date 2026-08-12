# Dépannage

Le premier réflexe, dans tous les cas :

```bash
bash scripts/05-verify.sh
```

Il enchaîne curriculum → tests → build → cinq écrans en HTTP → secrets, et dit
exactement où ça casse. La deuxième source de vérité est `/api/health`, qui donne
l'état réel du stockage, du mode IA et du curriculum.

---

## Le setup

### `app/.env.local absent`

```bash
bash scripts/01-scaffold.sh
```

### Le script se bloque sans rien afficher

Il attend une réponse sur un `stdin` qui n'est pas un terminal. Les scripts
prennent le défaut automatiquement dans ce cas — si ça bloque quand même,
passe les valeurs en options :

```bash
bash scripts/02-configure.sh --subject "Finance" --provider claude-code --minutes 30
```

### `00-detect-stack.sh` dit qu'une CLI n'est pas authentifiée alors qu'elle l'est

Le script teste une vraie commande (`supabase projects list`, `railway whoami`).
Si elle échoue, c'est que la session a expiré dans ce shell. Relance
`supabase login` / `railway login`, puis le script.

---

## Le curriculum

### `Fichier introuvable`

Il n'y a pas encore de curriculum : lance la deep research (`research/PROMPTS.md`)
ou repars de l'exemple livré.

### `champ requis manquant : embedUrl`

Une source `kind: "video"` sans embed. Sans lui, ni le découpage ni la reprise ne
marchent. Deux issues :

- trouver l'ID YouTube et écrire `https://www.youtube-nocookie.com/embed/<ID>` ;
- basculer la source en `kind: "reading"` avec le lien direct.

### `la capsule dépasse la durée totale`

`minutes` est plus grand que `totalMinutes`. La capsule est le segment du jour,
pas la ressource entière : ramène-la entre 5 et 20.

### `verifiedAt est dans le futur`

Une date fabriquée. Ouvre le lien, confirme qu'il répond, mets la date du jour.

### `id de leçon dupliqué`

Deux modules portent le même identifiant, souvent après une fusion de branches de
recherche. Les ids doivent être uniques dans tout le document — ils servent de clé
de progression.

### L'avertissement « au-delà de 5 matières »

**Il n'y a aucune limite** — ni dans le schéma, ni dans l'app, ni dans les tests.
L'avertissement dit juste que 3 à 5 matières actives est ce qui tient le mieux
quand le temps quotidien est limité, parce que la file de révision se remplit
plus vite qu'elle ne se vide.

Si c'est un choix assumé, ignore-le : le validateur sort en succès, et l'app
charge autant de matières que le curriculum en contient.

---

## L'app

### Le lecteur ne reprend pas où je m'étais arrêté

Dans l'ordre :

1. L'URL d'embed est-elle bien `youtube-nocookie.com/embed/…` ? Un lien
   `watch?v=` ne peut pas être piloté.
2. La console montre-t-elle une erreur d'origine ? Seuls `youtube.com` et
   `youtube-nocookie.com` sont acceptés — c'est volontaire.
3. `GET /api/progress/<lessonId>` renvoie-t-il quelque chose ? Un 404 signifie
   qu'aucune progression n'a encore été écrite.
4. Un bloqueur de contenu peut empêcher l'iframe de répondre aux `postMessage`.

### La vidéo ne s'affiche pas du tout

La CSP n'autorise que YouTube en `frame-src`. Si tu as changé de plateforme
vidéo, ajoute son domaine dans `next.config.ts` — sinon le navigateur bloque
l'iframe silencieusement.

### Ma progression ne suit pas d'un appareil à l'autre

Tu es en stockage fichier. **Réglages → Stockage** affiche le pilote réel.
`bash scripts/03-database.sh supabase` pour brancher un Postgres.

### Les notes ne se sauvegardent pas

Elles partent 700 ms après la dernière frappe. Vérifie `PUT /api/notes` dans
l'onglet réseau. Une note de plus de 40 000 caractères est refusée (413).

### « Réponse trop courte » sur un exercice

En dessous de 20 mots, la correction n'a rien à corriger et le feedback devient
générique. C'est une limite volontaire, dans `app/src/app/api/coach/route.ts`.

### La correction affiche un prompt au lieu de corriger

C'est le mode `claude-code`, et c'est le comportement attendu : aucune clé n'est
utilisée, tu donnes le prompt à ton agent. Pour automatiser, passe en `cli` ou
`api` — voir [AI-PROVIDERS.md](AI-PROVIDERS.md).

### `Impossible de lancer « claude »`

Le binaire de `AI_CLI_BIN` n'est pas dans le `PATH` du serveur Next. `which claude`
te donne le chemin ; mets-le en absolu si nécessaire.

### La CLI ne répond pas en 2 minutes

L'appel est tué après ce délai. Teste-la directement :

```bash
echo "Dis bonjour en un mot." | claude -p
```

Si ça reste bloqué là aussi, c'est la CLI qui attend une authentification
interactive.

---

## Base de données

Table complète des erreurs Postgres dans [DATABASE.md](DATABASE.md#dépannage).
Les trois plus fréquentes :

| Erreur | Correction |
|---|---|
| `self signed certificate` | `PGSSL=require` dans `.env.local` |
| `too many connections` | Passe sur le pooler Supabase (port 6543) |
| `password authentication failed` | Encode le mot de passe en URL (`@` → `%40`) |

---

## Telegram

Table complète dans [TELEGRAM.md](TELEGRAM.md#dépannage). Le piège numéro un :

> Telegram ne révèle ton `chat_id` **qu'après** que tu aies écrit au bot. Envoie
> un message, puis relance `scripts/04-telegram.sh`.

Pour voir l'erreur exacte : `cd app && npm run telegram:daily`.

---

## Build et déploiement

### `npm run build` échoue sur du TypeScript

Le build fait le typecheck. Le message nomme le fichier et la ligne — c'est une
vraie erreur, pas un faux positif de configuration.

### Le build passe, mais une page renvoie 500 en production

Le rendu statique n'exécute pas les routes API. Lance le smoke test, qui démarre
un vrai serveur :

```bash
bash scripts/05-verify.sh
```

### Le stockage disparaît après un déploiement serverless direct

Ce mode de déploiement n’est pas pris en charge : Postgres ne remplace ni la
Basic Auth globale, ni l’injection serveur du secret de mutation, ni le
confinement réseau. Déploie exclusivement avec le contrat auditable de
[`deploy/`](../deploy/), puis choisis le stockage dans cette frontière sécurisée.

---

## Secrets

### `check-secrets.sh` trouve quelque chose

Regarde le fichier et la ligne indiqués. Le script n'affiche jamais la valeur —
c'est délibéré, réimprimer un secret dans un log le fuite une seconde fois.

**Si le secret est déjà committé et poussé :** révoque-le d'abord chez son
fournisseur, réécris l'historique ensuite. Dans l'autre ordre, la clé reste
valide et publique le temps que tu nettoies.

### Il ne trouve rien alors que je viens d'ajouter une clé

Il ne scanne que les fichiers **suivis par git ou non ignorés**. Une clé dans
`app/.env.local` est correctement ignorée — c'est le comportement voulu.

---

## Rien de tout ça

Ouvre une issue avec :

- la sortie complète de `bash scripts/05-verify.sh` ;
- le contenu de `/api/health` (il ne contient aucun secret) ;
- ta version de Node (`node --version`).

Ne colle jamais ton `.env.local` dans une issue.
