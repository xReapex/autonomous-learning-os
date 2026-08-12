# État de conformité mobile SCIO — candidat Expo

**Date technique :** 12 août 2026
**Source canonique :** `mobile/`, Expo SDK 57 / React Native 0.86.2
**Preview Expo Go :** `mobile-sdk54/`, Expo SDK 54 / React Native 0.81.5
**Verdict :** **NO-GO Stores**, malgré un candidat local techniquement stabilisé.

Ce document remplace l’ancien audit de l’architecture Capacitor abandonnée. SCIO est maintenant une application Expo/React Native avec projets Android/iOS générables par prebuild. Le statut NO-GO ne vient plus d’une absence de client mobile, mais des preuves externes encore impossibles sans comptes, signatures et appareils.

## 1. Ce qui est implémenté et vérifié localement

### Identité et sessions

- Google Android passe par un module Expo local fondé sur Android Credential Manager.
- Apple iOS passe par `expo-apple-authentication`.
- Les deux parcours utilisent un nonce court serveur consommable une seule fois.
- Les JWT fournisseurs sont vérifiés côté worker : signature/JWKS, issuer, audience, nonce, sujet et expiration.
- L’identité métier est strictement `provider/sub`; le nom et l’e-mail ne sont ni demandés à Apple ni utilisés comme clé.
- Le mobile persiste uniquement une session SCIO opaque ; les ID tokens fournisseurs ne deviennent jamais des sessions métier.
- TTL par défaut de la session SCIO : 24 heures.
- Un HTTP 401 purge session et données locales, puis ramène à l’authentification.
- La déconnexion révoque d’abord la session SCIO serveur, puis purge l’état Credential Manager disponible et les données locales.
- La suppression exige une réauthentification sociale récente, puis supprime jobs, données, compte, sessions et liens d’identité.
- Une réussite serveur ne peut pas être inversée par l’échec d’un nettoyage local : tous les nettoyages sont tentés et la session locale est toujours purgée.

### Données et génération

- Données partitionnées par identifiant SCIO.
- Écritures atomiques, verrou interprocessus, tombstones anti-restauration et prévention des mutations tardives.
- Jobs de génération persistants sur disque, idempotence, quotas, tentatives bornées, reprise après interruption, annulation et acquittement.
- Stores production et preview séparés.
- Preuve locale E2E : création → runner → persistance → réouverture simulant un redémarrage → lecture → acquittement, avec isolation entre environnements.
- Résultats terminaux conservés au plus 7 jours, ou supprimés plus tôt après acquittement/suppression du compte.

### Confidentialité et sécurité

- Quatre pages publiques FR/EN : `/privacy`, `/terms`, `/support`, `/account-deletion`.
- Android `allowBackup=false`; permissions de stockage héritées et overlay bloqués.
- Privacy manifest iOS généré par config plugin.
- Aucune publicité, analytics, crash reporting, localisation, contacts, photos, audio, santé ou paiement dans le code inspecté.
- WebView YouTube limitée aux origines attendues; domaines YouTube légitimes ouverts à l’extérieur, hôtes arbitraires bloqués.
- Sessions, challenges, payloads et sorties bornés; rate limiting Nginx sur les jobs.
- Journaux systemd bornés à 14 jours / 1 Gio persistant / 256 Mio runtime; rotation Nginx 14 archives.
- Aucune sauvegarde applicative automatisée observée; Android backup désactivé.

### Qualité mobile

- Dynamic Type, lecteurs d’écran, contraste, clavier, safe areas, reduced motion et états vides couverts par contrats.
- Une seule source canonique SDK 57; SDK 54 reçoit la logique métier compatible mais reste uniquement une preview Expo Go.
- Les exports Android/iOS des deux SDK sont non vides et ne contiennent aucun ancien mode démo, jeton moteur, Basic Auth applicative ou ancienne marque.

## 2. Gates locales du candidat

- Backend : 250 tests verts, ESLint vert, TypeScript vert, curriculum valide, build Next vert, audit runtime 0 vulnérabilité.
- Worker : 38 tests verts, dont séparation des stores et preuve jobs E2E.
- SDK 57 : 28 contrats verts, lint/typecheck verts, Expo Doctor 20/20, dépendances Expo compatibles.
- SDK 54 : 24 contrats verts, lint/typecheck verts, Expo Doctor 18/18, dépendances Expo compatibles.
- Nginx et les trois unités systemd passent leur validation syntaxique.
- Les advisories npm mobiles sont qualifiés dans `store/dependency-risk.md`; ils proviennent de l’écosystème Expo/Metro/prebuild et ne justifient pas une mise à jour forcée incompatible.

## 3. Limites techniques honnêtes

### Révocation fournisseur

La déconnexion révoque la session SCIO et purge l’état Credential Manager local. Cela **n’est pas** une révocation OAuth distante :

- Apple exige le flux de révocation officiel avec authorization code/token et client secret signé;
- Google exige un access token ou refresh token révocable.

Le client actuel n’obtient qu’un ID token pour l’échange d’identité. Aucun faux appel de révocation n’est ajouté. Le parcours fournisseur final doit être conçu et testé avec les credentials réels.

### Privacy manifest

Le manifest généré déclare actuellement aucune Required Reason API propre à SCIO et aucun tracking. Seuls le Privacy Report Xcode et l’archive finale peuvent agréger et confirmer les manifests des SDK transitifs. Ne pas soumettre cette déclaration sans lire ce rapport.

## 4. Bloqueurs externes avant toute soumission

1. **Google Cloud / Play**
   - créer et valider le client serveur Google Android;
   - associer package, empreintes de clé d’upload et de clé Play App Signing;
   - produire un AAB signé et inspecter son manifeste fusionné;
   - tester Google Sign-In, logout, réauthentification, suppression et révocation fournisseur sur appareil;
   - remplir Data Safety depuis le trafic réel et le SDK Index.

2. **Apple Developer / App Store Connect**
   - confirmer Team ID, App ID `io.scio.app`, capability Sign in with Apple et credentials;
   - produire une archive/IPA signée sous Xcode;
   - lire Privacy Report, Required Reason APIs, signatures SDK et ATS;
   - tester Apple Sign-In, réauthentification et révocation officielle sur iPhone/iPad;
   - remplir App Privacy depuis le binaire et le trafic réels.

3. **Éditeur et juridique**
   - fournir nom légal, adresse, contact confidentialité et e-mail support réellement surveillé;
   - faire valider les pages et conditions par le responsable légal;
   - fixer les décisions contractuelles sur sous-traitants, régions et sauvegardes;
   - ne pas présenter les brouillons techniques comme conseil juridique.

4. **Appareils et distribution**
   - tester TalkBack/VoiceOver, Dynamic Type maximal, clavier, safe areas, predictive back, arrière-plan, reprise réseau, WebView YouTube et suppression;
   - tester l’AAB généré par Play sur Internal Testing et l’archive via TestFlight;
   - créer captures FR/EN à partir des binaires exacts;
   - confirmer notes reviewer et accès de test.

## 5. Règle de décision

SCIO ne devient « prêt pour les stores » qu’après réussite simultanée des gates locales, des builds signés, des tests appareils, de la validation juridique et des formulaires consoles. Expo Go, un export Metro, un prebuild ou un test automatisé ne remplace jamais ces preuves.
