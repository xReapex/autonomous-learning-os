# SCIO mobile

Application React Native construite avec Expo SDK 57 et Expo Router pour iOS et Android. L’interface applicative est native ; la seule WebView est confinée au lecteur YouTube intégré. Le produit web/desktop de première classe reste l’application Next.js dans `../app`.

## Démarrage

```bash
npm install
npm start
```

Sans `EXPO_PUBLIC_API_URL`, SCIO affiche un jeu de données local et une bannière **Mode démonstration**. Ne configurez une URL qu’après mise en place d’un endpoint compatible et d’une authentification applicative ; la valeur doit être une base HTTPS et ne contenir ni identifiant ni secret.

## Ressources et langue

Les ressources pédagogiques sont exclusivement des vidéos YouTube. La langue système est détectée au premier lancement avec `expo-localization`; le choix explicite dans **Profil → Langue** est persisté dans AsyncStorage sous `scio:locale` et reste prioritaire. Chaque leçon sélectionne uniquement la vidéo de cette langue. Si elle manque, SCIO affiche une indisponibilité explicite et ne bascule jamais silencieusement vers l’autre langue.

Le shell natif mesure le temps réellement passé en état `playing`. Une navigation, l’ouverture de la carte ou un simple lancement ne débloquent ni complétion ni récompense.

## Contrat API prévu

Le client contient encore l’adaptateur historique suivant, mais il reste désactivé tant que le backend SCIO et son authentification mobile ne l’exposent pas :

- `GET /curriculum`, `GET /cards`, `GET /progress` (`/curriculum` ou `/cards` peut fournir les exercices) ;
- `PATCH /progress` pour une leçon terminée ou un exercice réussi ;
- `PATCH /cards/:cardId` pour le rappel d’une carte ;
- `POST /notes` pour une note de leçon.

Le client n’envoie aucun en-tête d’authentification et n’embarque aucun secret. Il est interdit de contourner le 401 du desktop en intégrant des identifiants Basic Auth à l’application. En cas de perte du réseau, le dernier contenu API compatible est relu depuis le cache local ; à défaut, le contenu local reste utilisable et l’état hors ligne est clairement affiché.

Les récompenses locales utilisent `scio:rewards` et ne sont accordées qu’après `lesson_completed`, `exercise_passed` ou `review_recalled`, avec un `eventId` idempotent.

## Qualité et livraison

```bash
npm test
npm run lint
npm run typecheck
npm run export
```

`eas.json` fournit les profils `preview` (distribution interne, APK Android) et `production`. Aucun credential n’est stocké dans le dépôt.
