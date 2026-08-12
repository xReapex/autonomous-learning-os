# Analyse des dépendances mobiles — 12 août 2026

## Résultat mécanique

- Expo SDK 57 : `npm audit --omit=dev` signale 22 éléments (8 modérés, 14 élevés).
- Expo SDK 54 preview : `npm audit --omit=dev` signale 22 éléments (10 modérés, 12 élevés).
- Backend Next : 0 vulnérabilité runtime.
- `npx expo install --check` : dépendances à jour pour les deux SDK.

## Qualification

Les chaînes signalées proviennent des dépendances directes `expo`, `react-native`, `react-native-reanimated` et `react-native-worklets`, puis de leurs outils de build/configuration : Expo CLI/config plugins, Metro, `image-size`, `xcode`, `uuid` et, pour SDK 54, PostCSS. `npm --omit=dev` ne les retire pas car Expo publie ces outils sous sa dépendance runtime racine, mais ils servent principalement au bundling, au prebuild et au développement, pas aux flux métier SCIO exécutés par le bundle JavaScript.

Aucune correction compatible n’est proposée par `expo install --check`. Les remplacements automatiques exigeraient des versions hors du couple Expo/React Native validé et ne doivent pas être appliqués avec `npm audit fix --force`.

## Décision

- ne pas forcer les mises à jour ;
- conserver SDK 57 comme candidat canonique et SDK 54 uniquement pour Expo Go ;
- réévaluer à chaque patch Expo 57 compatible ;
- protéger le pipeline : aucun média ou projet non fiable n’est traité par Metro/prebuild ;
- considérer les advisories `image-size`/PostCSS comme risque d’outillage de build, distinct du risque runtime appareil ;
- vérifier le vrai binaire signé avant soumission.

Artefacts JSON locaux :

- `/home/ubuntu/.cache/scio-mobile57-audit-runtime.json`;
- `/home/ubuntu/.cache/scio-mobile54-audit-runtime.json`;
- `/home/ubuntu/.cache/scio-app-audit-runtime.json`.
