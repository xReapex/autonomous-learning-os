# SCIO web/desktop

SCIO réunit cours, exercices, révisions espacées et Curriculum Studio dans une
interface Next.js 16 / React 19. Le web n’embarque aucun runtime Capacitor :
l’application mobile Expo vit séparément dans `../mobile/`.

```bash
npm install
npm run dev       # http://localhost:3000
npm test
npm run lint
npx tsc --noEmit
npm run build
```

Aucune clé n’est requise pour démarrer : SCIO utilise le curriculum livré, le
stockage fichier et le mode de correction manuel.

## Interface et langues

Toute l’interface est disponible en français et en anglais. Au premier
chargement, SCIO détecte la langue du navigateur. Le choix explicite effectué
dans **Réglages → Langue de l’interface** est conservé sous
`localStorage["scio:locale"]`; l’attribut `html lang` reste synchronisé.

Les contenus ne sont jamais traduits artificiellement par l’interface. Le lecteur n’accepte toutefois qu’une vidéo YouTube dont `source.language` correspond à la langue active. En l’absence de vidéo correspondante, SCIO reste fermé et demande de créer/valider un curriculum localisé dans Curriculum Studio ; aucune substitution interlangue n’est silencieuse. La locale active est aussi transmise à l’entretien Codex dès sa première question.

| Route | Usage |
|---|---|
| `/` | Session du jour et synthèse XP/maîtrise/série |
| `/learning` | Cours, notes et mode focus |
| `/exercises` | Exercice de transfert et correction |
| `/reviews` | File de révision espacée |
| `/settings` | Langue, services, sources et Curriculum Studio |

## Récompenses

Les récompenses sont calculées et persistées côté serveur. Un `eventId`
idempotent empêche toute double attribution, y compris lors d’un retry :

- première complétion d’une leçon : 100 XP, 20 maîtrise ;
- correction d’exercice produite avec succès : 60 XP, 12 maîtrise ;
- rappel réussi (`grade >= 2`) : 25 XP, 5 maîtrise.

La série tolère un seul jour manqué avant de se réinitialiser. Les `GET`, le
montage des composants et la navigation n’accordent jamais de récompense.

## Configuration

Copie `.env.example` vers `.env.local`.

| Variable | Effet |
|---|---|
| `NEXT_PUBLIC_DEFAULT_SESSION_MINUTES` | Durée de session par défaut |
| `STORAGE_DRIVER` | `file` ou `postgres` |
| `LEARNING_DATA_DIR` | Répertoire des JSON en mode fichier |
| `DATABASE_URL` / `PGSSL` | Connexion PostgreSQL |
| `AI_PROVIDER` | `claude-code`, `cli` ou `api` |
| `TELEGRAM_ENABLED` | Brief quotidien optionnel |

En mode fichier, les données vivent dans `.data/`. En mode PostgreSQL, SCIO
crée les tables nécessaires, dont `reward_state` et `reward_events`.

## Curriculum Studio

`content/curriculum.json` reste la source livrée. Curriculum Studio peut
enregistrer une surcharge atomique avec les contrats `ETag` / `If-Match` ; la
lecture ne déclenche aucune sauvegarde passive.

```bash
npm run curriculum:check
```

Le profil hébergé reste fail-closed : les mutations runtime nécessitent la
frontière d’authentification et le secret serveur décrits dans `../deploy/`.
