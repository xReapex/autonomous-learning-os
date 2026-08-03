# Brief Telegram

Un message chaque matin : le module du jour, la source exacte à ouvrir, la durée
et la question de rappel. Optionnel — l'app fonctionne sans.

**Le bot est le tien.** Le token vit dans ton `app/.env.local`, git-ignoré, et ne
quitte jamais ta machine. Ce dépôt ne fournit aucun bot partagé : un bot commun
verrait les messages de tout le monde.

---

## 1. Créer le bot

Ton agent ne peut pas faire cette étape à ta place — BotFather parle à un compte
Telegram, pas à une API.

1. Dans Telegram, cherche **@BotFather**.
2. Envoie `/newbot`.
3. Donne un nom d'affichage (« Mon Learning OS ») puis un identifiant qui se
   termine par `bot` (`gauthier_learning_bot`).
4. BotFather répond avec un token de la forme `1234567890:AAH...`.

**Ce token permet de lire et d'écrire tous les messages de ton bot.** Ne le colle
ni dans un chat, ni dans un commit, ni dans une capture d'écran. S'il fuit :
`/revoke` chez BotFather, et tu en reçois un neuf.

## 2. Écrire au bot

Ouvre la conversation avec ton bot et envoie-lui n'importe quoi — « salut »
suffit.

C'est obligatoire : Telegram ne révèle ton `chat_id` qu'après un message entrant.
C'est aussi ce qui empêche un bot d'écrire à quelqu'un qui ne l'a pas sollicité.

## 3. Câbler

```bash
bash scripts/04-telegram.sh
```

Le script demande le token en saisie masquée, vérifie qu'il répond, résout le
`chat_id` depuis `getUpdates`, écrit les trois variables dans `app/.env.local`
(chmod 600) et envoie un message de test.

Tu dois recevoir le message de confirmation dans Telegram. Sinon, va au
dépannage plus bas.

---

## 4. Choisir quand ça part

### En local, avec cron

```bash
crontab -e
```

```cron
0 8 * * * cd /chemin/vers/autonomous-learning-os/app && /usr/local/bin/npm run telegram:daily >> /tmp/learning-telegram.log 2>&1
```

Le chemin absolu vers `npm` est nécessaire : cron n'hérite pas de ton `PATH`.
`which npm` te le donne.

### En local, avec launchd (macOS, survit au redémarrage)

`~/Library/LaunchAgents/com.bizos.learning-brief.plist` :

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.bizos.learning-brief</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>-lc</string>
    <string>cd ~/autonomous-learning-os/app &amp;&amp; npm run telegram:daily</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict><key>Hour</key><integer>8</integer><key>Minute</key><integer>0</integer></dict>
  <key>StandardErrorPath</key><string>/tmp/learning-brief.err.log</string>
</dict>
</plist>
```

```bash
launchctl load ~/Library/LaunchAgents/com.bizos.learning-brief.plist
```

### Sur Vercel

`app/vercel.json` :

```json
{
  "crons": [{ "path": "/api/telegram", "schedule": "0 8 * * *" }]
}
```

Vercel n'envoie que des GET sur les crons alors que la route attend un POST :
ajoute une petite fonction relais, ou utilise plutôt un cron externe qui fait le
POST avec le header d'autorisation.

**Sur une app déployée, `CRON_SECRET` est obligatoire.** Sans lui, la route
`/api/telegram` est publique et n'importe qui peut déclencher des envois vers ton
compte.

```bash
# une valeur aléatoire, dans les variables d'environnement Vercel
openssl rand -hex 32
```

L'appelant doit alors envoyer `Authorization: Bearer <CRON_SECRET>`.

---

## Ce que contient le message

Construit sans appel à un modèle — un brief quotidien ne doit pas coûter un
token :

```
BizOS × Learning — Apprendre à apprendre

Aujourd'hui : Se tester bat relire
Objectif : Distinguer la sensation de savoir de la capacité réelle à récupérer.

Source : Human Behavioral Biology — Stanford / Robert Sapolsky
À regarder : 11 min (Pourquoi les catégories simples trompent)
Cartes dues : 6

Question de rappel : Prends une notion que tu crois maîtriser…

http://localhost:3000
```

Sur un cursus à plusieurs matières, la matière **tourne d'un jour à l'autre** :
un brief qui répète la même chose tous les matins est ignoré au bout de trois
jours.

### Le personnaliser

Le texte est construit à deux endroits — garde-les cohérents :

- `app/src/lib/telegram.ts` → `buildDailyBrief()`, pour la route API.
- `app/scripts/telegram-daily.mjs`, pour le cron hors serveur.

Si tu veux un brief **rédigé par un modèle** plutôt que gabarité,
`buildDailyBriefPrompt()` dans `app/src/lib/ai/prompt.ts` fournit le prompt.
Sache que ça transforme un cron gratuit en cron facturé.

---

## Dépannage

| Symptôme | Cause | Correction |
|---|---|---|
| `Telegram rejette ce token` | Token tronqué à la copie, ou révoqué | Recopie-le entier depuis BotFather, sans espace en fin |
| `Aucun message reçu` au chat ID | Tu n'as pas écrit au bot | Envoie-lui un message, puis relance le script |
| Le script trouve le mauvais chat ID | Plusieurs conversations en attente | Écris un message frais, relance ; le script prend le plus récent |
| Envoi 403 | Tu as bloqué le bot | Débloque-le dans Telegram |
| Envoi 400 « chat not found » | Chat ID d'un groupe dont le bot est sorti | Réinvite le bot, ou repasse en conversation directe |
| Rien à 8 h avec cron | `PATH` incomplet | Chemin absolu vers `npm` dans la crontab |
| Rien à 8 h sur Vercel | Cron GET vs route POST | Voir la section Vercel |

Pour envoyer un brief à la demande et voir l'erreur exacte :

```bash
cd app && npm run telegram:daily
```

Ou depuis l'interface : **Réglages → Brief Telegram → Envoyer maintenant**.

---

## Le désactiver

```bash
# dans app/.env.local
TELEGRAM_ENABLED=false
```

Vide aussi `TELEGRAM_BOT_TOKEN` et `TELEGRAM_CHAT_ID`, et retire l'entrée cron.
Si tu ne comptes plus jamais l'utiliser, `/deletebot` chez BotFather ferme le
sujet proprement.
