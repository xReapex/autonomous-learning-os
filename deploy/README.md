# Déploiement sécurisé de Learning OS

L’éditeur runtime n’est **pas** conçu pour être exposé par un `next start`
non protégé ou un hébergement applicatif serverless direct. L’application ne
possède volontairement aucun faux `APP_PASSWORD` : la frontière d’accès est un
reverse proxy authentifié.

## Invariants obligatoires

- Next.js écoute uniquement sur `127.0.0.1:4310`.
- Nginx impose Basic Auth sur toutes les pages et API desktop. Les seules
  exceptions sont `/api/mobile/auth/*`, `/api/mobile/data/*` et
  `/api/mobile/curriculum/interview`, protégées par le contrat de session SCIO.
- Le fournisseur `development` est disponible uniquement sur le virtual host
  preview, avec `SCIO_DEPLOYMENT_ENV=preview` et `SCIO_AUTH_MODE=development`.
  La production le refuse systématiquement.
- La production sociale exige `SCIO_AUTH_MODE=social` et les audiences
  `SCIO_GOOGLE_SERVER_CLIENT_ID` / `SCIO_APPLE_CLIENT_ID`. Le client Google est
  l’identifiant OAuth Web/server attendu par Credential Manager et comme audience
  de l’ID token. Le serveur émet un
  challenge one-shot, vérifie signature, issuer, audience, expiration et nonce,
  puis échange la preuve Google/Apple contre une session SCIO opaque. Aucun
  secret fournisseur n'est exposé dans le bundle mobile.
- Après validation du fournisseur, le serveur émet une session SCIO opaque,
  expirante et révocable ; seul son hash est persisté. Toutes les routes métier
  résolvent `user_id` et l’entitlement côté serveur.
- Progression, notes, révisions et curriculum personnalisé sont partitionnés par
  `user_id`. La suppression du compte révoque ses sessions et purge ces données.
- `HOSTED_SAFE_MODE=true`, Telegram désactivé, stockage local privé et réseau
  sortant du service bloqué.
- `/var/lib/autonomous-learning-os` appartient à `learningos:learningos` en 0700.
- Le worker communique avec Next uniquement par la socket Unix privée
  `/run/learningos-codex/worker.sock`, sous `learningos-codex`, avec son OAuth
  dans `/var/lib/learningos-codex/auth.json`. Il n’a aucun accès à
  `/var/lib/autonomous-learning-os`, au dépôt applicatif ou au réseau privé ;
  le modèle Codex ne reçoit aucun outil local.
- Les secrets `CURRICULUM_MUTATION_SECRET` et `CODEX_INTERVIEW_WORKER_SECRET`
  sont distincts, aléatoires et longs d’au moins 32 caractères.

## Fichiers fournis

- `autonomous-learning-os.service` → `/etc/systemd/system/`
- `learningos-codex.service` → `/etc/systemd/system/`
- `codex-worker.env.example` → `/etc/autonomous-learning-os/codex-worker.env`
- `runtime.env.example` → `/etc/autonomous-learning-os/runtime.env`
- `scio-preview.service` → `/etc/systemd/system/`
- `scio-preview.env.example` → `/etc/scio-preview/runtime.env`
- `nginx-scio-preview.conf` → `/etc/nginx/sites-available/scio-preview`
- `nginx-limits.conf` → `/etc/nginx/conf.d/autonomous-learning-os-limits.conf`
- `nginx-autonomous-learning-os.conf` → `/etc/nginx/sites-available/`
- `nginx-mutation-secret.conf.example` →
  `/etc/nginx/snippets/autonomous-learning-os-mutation-secret.conf`

Adapter le nom d’hôte et les chemins du certificat dans les copies installées.
Créer le secret avec `openssl rand -hex 32`, puis placer exactement la même
valeur dans les deux fichiers sensibles. Les fichiers sensibles doivent être
`root:root` en mode `0600` et ne doivent jamais être affichés dans les journaux.

Créer les identités sans connexion, puis autoriser uniquement Next à joindre la
socket privée :

```bash
sudo groupadd --system learningos-codex-client
sudo useradd --system --home /var/lib/learningos-codex --shell /usr/sbin/nologin learningos-codex
sudo usermod --append --groups learningos-codex-client learningos
sudo install -d -o learningos-codex -g learningos-codex-client -m 0700 /var/lib/learningos-codex
```

Installer l’OAuth Codex existant comme `/var/lib/learningos-codex/auth.json`,
propriétaire `learningos-codex:learningos-codex-client`, mode `0600`, sans en
afficher le contenu. Le modèle est appelé par Responses API avec `tool_choice`
à `none` pendant l’entretien. Seule la recherche web hébergée est activée après
confirmation pour choisir ou réparer automatiquement les sources ; aucun outil
local n’est déclaré.

## Validation avant bascule

```bash
sudo systemd-analyze verify deploy/autonomous-learning-os.service
sudo nginx -t
npm test -- --run
npm run lint
npx tsc --noEmit
npm run build
```

Après installation, vérifier que la mutation directe sur `127.0.0.1:4310` est
refusée, que HTTPS sans Basic Auth retourne `401`, qu’une session authentifiée
peut sauvegarder, qu’un ETag périmé retourne `412`, et que la restauration ne
supprime que `/var/lib/autonomous-learning-os/curriculum.json`.

## Développement local

`npm run dev` reste adapté à la consultation et au développement des écrans.
Les mutations du curriculum échouent volontairement avec `403` sans passer par
une frontière authentifiée qui injecte le secret. Pour tester l’écriture locale,
utiliser ce même modèle Nginx sur loopback ; ne jamais placer le secret dans le
JavaScript client.
