# Audit mobile SCIO — connexion obligatoire, démo et plan complet

**Date de l’audit :** 11 août 2026
**Périmètre :** Expo SDK 57 (`/mobile`), copie Expo Go SDK 54 (`/mobile-sdk54`), backend Next.js, worker et configuration de déploiement
**Méthode :** inspection statique en lecture seule, introspection Expo, vérification des politiques officielles en vigueur, aucun compte Store ni produit créé
**Modèle produit demandé :** connexion obligatoire → démo limitée pour un compte sans plan → expérience complète avec abonnement

## 1. Verdict exécutif

**SCIO n’est pas prêt pour une publication publique App Store ou Google Play avec ce modèle.**

L’application éducative existe et son socle natif est crédible : React Native, progression, exercices, révisions, lecteur YouTube limité à la vidéo et validations métier. En revanche, quatre fondations indispensables sont absentes :

1. identité applicative Google/Apple vérifiée par le serveur ;
2. sessions SCIO individuelles, expirables et révocables ;
3. données pédagogiques isolées par utilisateur ;
4. abonnement Store et entitlement `demo/full` contrôlé côté serveur.

L’état actuel est mono-utilisateur : le mobile peut monter directement les onglets et les données de démonstration, puis échange tardivement un identifiant Basic contre un Bearer global partagé lorsqu’il souhaite créer un parcours. Ce mécanisme technique ne constitue ni un compte SCIO, ni une autorisation par utilisateur, ni une preuve de plan.

### Décision recommandée

- **Continuer le développement : oui.**
- **Ouvrir une bêta interne technique : oui, avec avertissement et données non sensibles.**
- **Publier publiquement : non, tant que les P0 ne sont pas terminés et vérifiés sur des builds signés.**
- **Source canonique de release : Expo SDK 57 uniquement.** SDK 54 doit rester un canal Expo Go temporaire, pas une deuxième implémentation de sécurité.

## 2. Modèle d’accès cible

| État serveur | Surface autorisée | Comportement |
|---|---|---|
| Session absente ou invalide | Connexion, Confidentialité, Conditions, Aide | Aucun contenu de démonstration ni donnée pédagogique ne monte |
| Session valide, entitlement absent confirmé | Démo | Une leçon, un exercice, deux cartes ; progression conservée |
| Session valide, entitlement `active` | Complet | Parcours personnalisés, toutes les activités, synchronisation |
| Entitlement expiré/révoqué | Démo | Aucun effacement de progression ; premium verrouillé |
| Session ou entitlement indéterminable | Échec fermé | `401` ou `503`, jamais de déverrouillage implicite |

La démo doit être **limitée mais honnête** : quatre leçons peuvent être visibles pour montrer la profondeur du produit, mais seule la première est activable. La création d’un parcours personnel doit ouvrir un paywall contextuel, pas l’ancien écran « Connecter le moteur ».

## 3. Preuves dans le produit actuel

### P0 — Accès anonyme encore possible

- `mobile/src/app/_layout.tsx` monte `DataProvider` et la navigation sans `AuthProvider`.
- `mobile/src/app/(tabs)/_layout.tsx` expose immédiatement Accueil, Cours, Exercices, Révisions et Profil.
- `mobile/src/providers/data-provider.tsx` initialise la source en `demo` et accepte plusieurs fallbacks vers `demoData` sans identité.
- `mobile/eas.json` active `EXPO_PUBLIC_DEMO_MODE=true` pour la preview : ce flag de build n’est pas un entitlement utilisateur.

### P0 — Authentification partagée, pas d’identité utilisateur

- `app/src/app/api/mobile/session/route.ts` renvoie un `MOBILE_API_TOKEN` global après le contrôle Basic du proxy.
- `mobile/src/lib/engine-api.ts` stocke ce Bearer partagé dans SecureStore.
- `mobile/src/services/api.ts` n’ajoute aucune session utilisateur aux lectures et mutations ordinaires.
- Le schéma SQL ne contient ni `users`, ni `user_identities`, ni `sessions`, ni `entitlements`, ni `store_transactions`.

### P0 — Risque de mélange entre comptes

- `scio:data-cache`, `scio:generated-data` et `scio:rewards` sont des clés globales.
- Les données fichier et PostgreSQL ne sont pas partitionnées par `user_id`.
- Une simple connexion sociale ajoutée devant l’interface exposerait potentiellement au nouveau compte les données du précédent.

### P0 — Aucun plan ni achat Store

Aucune dépendance Google/Apple Auth, RevenueCat, StoreKit ou Play Billing n’est présente. Aucun paywall, restauration, traitement de renouvellement, révocation ou remboursement n’existe. Les abonnements qui déverrouillent du contenu et des fonctions numériques doivent normalement passer par les mécanismes de paiement des Stores concernés.[2][9]

### Points déjà solides

- cibles tactiles de 48 px ;
- rôles et états d’accessibilité sur les principaux contrôles ;
- vrais écrans React Native, pas une WebView enveloppant un site ;
- lecteur YouTube isolé à la vidéo ;
- vérification de progression et mutations durables ;
- URLs de build HTTPS et secrets interdits dans les variables publiques ;
- mode démonstration interdit sur le profil de production actuel.

## 4. Architecture sûre recommandée

### 4.1 Connexion

1. Le mobile appelle `POST /api/v1/auth/challenge`.
2. Le serveur émet un nonce/state court, unique et atomiquement consommable.
3. Android lance Google ; iOS lance Sign in with Apple.
4. Le mobile transmet le résultat à `POST /api/v1/auth/social`.
5. Le serveur vérifie signature, algorithme, issuer, audience, `azp`, expiration, nonce et `sub`.
6. L’identité stable est `provider + sub`, jamais l’e-mail seul.
7. Le serveur émet une session SCIO opaque.

Sur iOS, Sign in with Apple doit être configuré nativement. Si un autre fournisseur social est ultérieurement présenté sur iOS, Apple impose généralement une option de connexion équivalente respectant sa règle 4.8.[9][15]

### 4.2 Session SCIO

- access token opaque aléatoire de courte durée ;
- refresh token opaque rotatif ;
- seules les empreintes sont stockées en base ;
- détection de réutilisation et révocation de toute la famille ;
- secrets uniquement dans SecureStore côté appareil ;
- `Cache-Control: no-store` sur les réponses d’authentification ;
- aucune session dans URL, AsyncStorage, log ou `EXPO_PUBLIC_*`.

### 4.3 Données et worker

Chaque table et chaque mutation pédagogique doit porter le `user_id` issu de la session serveur. Les états d’entretien du worker doivent être liés au propriétaire afin qu’un autre utilisateur ne puisse pas les poursuivre. L’entretien et la génération doivent vérifier `full` **avant** de consommer une ressource IA.

### 4.4 Entitlement et abonnements

Le chemin minimal recommandé est RevenueCat au-dessus de StoreKit et Google Play Billing :

- le mobile achète/restaure via le Store ;
- RevenueCat reçoit et normalise les événements ;
- un webhook authentifié et idempotent informe SCIO ;
- le backend relit l’état vérifié avant d’accorder `full` ;
- le client ne peut jamais envoyer `full=true` ou une date d’expiration autoritaire.

États à conserver : `demo`, `active`, `grace`, `billing_retry`, `expired`, `revoked`, `unknown`. Seuls les états explicitement décidés par le produit accordent le complet.

## 5. Parcours UX recommandé

### 5.1 Premier lancement

- Splash SCIO.
- « Vérification de votre session… ».
- Si aucune session : écran de connexion unique.
- Android : **Continuer avec Google**.
- iOS : **Continuer avec Apple**.
- Conditions et Confidentialité accessibles avant la connexion.
- Aucun bouton « Continuer sans compte ».

Un mur de connexion iOS doit être justifié par des fonctions significatives liées au compte : progression synchronisée, restauration multi-appareils et gestion du plan. Sans ces fonctions réellement actives, le mur resterait un risque de revue.[9]

### 5.2 Compte sans plan

Accueil avec badge discret **Démo** :

> Essayez une leçon, un exercice et deux cartes. Passez au plan complet pour créer vos propres parcours.

- CTA principal : **Commencer la leçon d’essai**.
- CTA secondaire : **Voir le plan complet**.
- Les éléments premium restent visibles, verrouillés et expliqués.
- La démo ne doit ni expirer artificiellement, ni couper une activité commencée.

### 5.3 Paywall

- bénéfices concrets, sans compte à rebours ni prix artificiellement barré ;
- tarifs, périodes et essais fournis directement par le Store ;
- CTA : `Continuer — {prix}/{période}` ;
- actions visibles : Restaurer les achats, Gérer le plan, Conditions, Confidentialité ;
- fermeture explicite vers la démo ;
- après activation, retour à l’action qui avait déclenché le paywall.

### 5.4 Profil / Compte

Ajouter :

- identité et fournisseur connecté ;
- statut Démo ou Plan complet ;
- gérer le plan ;
- restaurer les achats ;
- se déconnecter ;
- supprimer mon compte.

La gestion du plan doit renvoyer vers la surface Store appropriée et rester cohérente avec les abonnements auto-renouvelables configurés dans App Store Connect.[14]

Remplacer « Source des données » par une information utilisateur telle que « Progression synchronisée » ou « Disponible hors ligne ».

## 6. Store et conformité

### Bloquant avant publication

1. **Achats numériques :** StoreKit/IAP sur iOS et Play Billing sur Android sont les mécanismes techniques à intégrer. Les politiques des Stores encadrent le déverrouillage d’abonnements et de fonctions numériques.[2][8][9]
2. **Suppression :** initiation dans l’app sur iOS ; chemin dans l’app et ressource web publique sur Google Play.[3][11]
3. **Confidentialité :** politique HTTPS accessible avant connexion et déclarations cohérentes App Privacy/Data Safety incluant identité, progression, notes, abonnements, logs, YouTube et IA.[4][10][16]
4. **Accès reviewer :** backend actif et instructions permettant de tester compte sans plan, complet, restauration et suppression.[5][9]
5. **Artefacts :** AAB/IPA signés, manifests/entitlements finaux et builds Store réels. Google annonce API 36 pour les nouveaux envois à partir du 31 août 2026 ; Apple annonce Xcode 26 et iOS 26 SDK pour les envois depuis le 28 avril 2026.[1][12]

Pour Android, la livraison doit également prouver l’Android App Bundle et la séparation entre clé d’upload et clé détenue par Play App Signing.[6][7]

### Risques natifs observés

- l’introspection Expo produit actuellement `NSAllowsArbitraryLoads=true` ; l’archive finale doit retirer l’exception globale ou la justifier précisément ;
- l’introspection Android expose plusieurs permissions malgré `permissions: []` ; seul le merged manifest release fera foi ;
- les privacy manifests existent dans certaines dépendances, mais leur agrégation et les exigences applicables aux SDK tiers doivent être prouvées dans Xcode.[13]
- aucune archive iOS ne peut être certifiée depuis cet hôte Linux.

## 7. Plan d’action priorisé

### P0 — avant toute publication

1. Désigner SDK 57 comme source canonique.
2. Créer PostgreSQL multi-utilisateur et partitionner toutes les données par `user_id`.
3. Implémenter challenges, validation Google/Apple et sessions opaques rotatives.
4. Monter `AuthProvider` avant `DataProvider` et supprimer tout fallback anonyme.
5. Mettre le Bearer SCIO sur toutes les APIs mobiles.
6. Implémenter l’entitlement serveur et protéger toutes les fonctions premium.
7. Intégrer les achats/restaurations Store et la vérification serveur.
8. Ajouter compte, logout, gestion du plan et suppression.
9. Publier Confidentialité, Conditions et ressource web de suppression.
10. Exécuter les tests négatifs d’isolation, replay, expiration, révocation et panne DB.

### P1 — qualité de lancement

- caches namespacés par utilisateur et purge sûre au logout ;
- liaison Google/Apple explicite, jamais fusion automatique par e-mail ;
- états grâce, billing retry, remboursement et réconciliation ;
- Dynamic Type 200 %, VoiceOver/TalkBack, tab bar adaptative ;
- ATS et permissions Android durcis ;
- comptes sandbox et matrice de tests Store complète.

### P2 — après stabilisation

- visibilité et révocation par appareil ;
- App Attest/DeviceCheck et Play Integrity comme signaux anti-abus ;
- analytics minimales du funnel sans sujets, réponses ni notes ;
- optimisation du mode hors ligne à partir d’un entitlement signé récent.

## 8. Éléments nécessaires pour activer le vrai flux

### Google

- projet Google Cloud ;
- client Android `io.scio.app` ;
- empreintes SHA-1/SHA-256 debug, release et Play App Signing ;
- client serveur/web si le jeton ou code lui est destiné.

### Apple

- Apple Developer Team ID ;
- App ID `io.scio.app` avec Sign in with Apple ;
- Key ID et clé privée `.p8` côté serveur uniquement ;
- Services ID, domaine vérifié et redirect URI pour la suppression web ;
- certificats/provisioning et environnement Xcode/EAS.

### Abonnements

- produits, groupes, prix et offres App Store Connect ;
- produits/base plans/offres Google Play ;
- projet RevenueCat, entitlement `full`, clés SDK publiques par plateforme et secrets serveur/webhook ;
- comptes sandbox et comptes reviewer.

Aucun de ces secrets ne doit être placé dans le dépôt ou une variable `EXPO_PUBLIC_*`.

## 9. Limites de cet audit

Non vérifiables sur cet hôte : connexion sociale réelle, achat/restauration/remboursement sandbox, webhook réel, signature AAB/IPA, Privacy Report Xcode, provisioning Apple, Play App Signing et acceptation par les équipes de revue.

## 10. Explication très simple

Aujourd’hui, SCIO ressemble à une école avec **une seule clé partagée par tout le monde**. Même si l’on peint « Google » ou « Apple » sur la porte, les cahiers des élèves restent mélangés derrière.

Il faut d’abord :

1. donner une clé différente à chaque élève ;
2. ranger ses cahiers dans son propre casier ;
3. demander au magasin Apple ou Google si son abonnement est bien payé ;
4. n’ouvrir les salles premium que lorsque le serveur répond oui.

La démo devient alors une petite salle accessible **après connexion**, tandis que le plan complet ouvre toute l’école.

## Sources

[1] https://support.google.com/googleplay/android-developer/answer/11926878?hl=en — Google Play target API requirements
[2] https://support.google.com/googleplay/android-developer/answer/10281818?hl=en — Understanding Google Play's Payments policy
[3] https://support.google.com/googleplay/android-developer/answer/13327111?hl=en — Google Play app account deletion requirements
[4] https://support.google.com/googleplay/android-developer/answer/10787469?hl=en
[5] https://support.google.com/googleplay/android-developer/answer/9859455?hl=en
[6] https://developer.android.com/guide/app-bundle
[7] https://support.google.com/googleplay/android-developer/answer/9842756?hl=en
[8] https://developer.android.com/google/play/billing/lifecycle/subscriptions
[9] https://developer.apple.com/app-store/review/guidelines
[10] https://developer.apple.com/app-store/app-privacy-details
[11] https://developer.apple.com/support/offering-account-deletion-in-your-app — Offering account deletion in your app
[12] https://developer.apple.com/news/upcoming-requirements — Apple Upcoming Requirements
[13] https://developer.apple.com/support/third-party-SDK-requirements
[14] https://developer.apple.com/help/app-store-connect/manage-subscriptions/offer-auto-renewable-subscriptions
[15] https://docs.expo.dev/versions/latest/sdk/apple-authentication
[16] https://developers.google.com/youtube/terms/developer-policies
