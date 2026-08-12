# Métadonnées Store et checklist de soumission

> **BROUILLON — NE PAS SOUMETTRE**
> Les textes sont des candidats factuels, pas une promesse d’acceptation. Tous les champs entre accolades doivent être remplis depuis les comptes et artefacts réels.

## Métadonnées candidates

### Français

- **Nom :** SCIO
- **Sous-titre / description courte :** Apprendre, pratiquer, réviser
- **Description :**
  SCIO réunit vos cours, exercices, notes et révisions dans un parcours d’apprentissage personnel. Suivez votre progression, reprenez une leçon et révisez avec des cartes. Certaines versions permettent aussi de créer un curriculum à partir d’un entretien guidé. Une connexion et un accès réseau sont nécessaires pour synchroniser les données et utiliser les services en ligne.
- **Mots-clés candidats :** apprentissage,révision,cours,exercices,notes,cartes
- **Support :** `https://learning-os.141.227.152.154.nip.io/support`
- **Confidentialité :** `https://learning-os.141.227.152.154.nip.io/privacy`
- **Conditions :** `https://learning-os.141.227.152.154.nip.io/terms`
- **Suppression de compte :** `https://learning-os.141.227.152.154.nip.io/account-deletion`

### English

- **Name:** SCIO
- **Subtitle / short description:** Learn, practise, review
- **Description:**
  SCIO brings courses, exercises, notes and reviews into a personal learning journey. Track progress, resume a lesson and review with cards. Some versions also let you create a curriculum through a guided interview. Sign-in and network access are required to synchronize data and use online services.
- **Candidate keywords:** learning,study,courses,exercises,notes,flashcards
- **Support:** `https://learning-os.141.227.152.154.nip.io/support`
- **Privacy:** `https://learning-os.141.227.152.154.nip.io/privacy`
- **Terms:** `https://learning-os.141.227.152.154.nip.io/terms`
- **Account deletion:** `https://learning-os.141.227.152.154.nip.io/account-deletion`

Ne pas mentionner abonnement, essai, achat, synchronisation multi-appareils, disponibilité hors ligne, certification, IA précise ou fournisseur social tant que le parcours correspondant n’est pas fonctionnel dans le build soumis.

## Identité et contacts — À CONFIRMER AVANT SOUMISSION

- [ ] Nom légal / seller name : `{LEGAL_PUBLISHER_NAME}`
- [ ] Adresse requise par le compte Store : `{LEGAL_ADDRESS_IN_CONSOLE_ONLY_OR_PUBLIC_IF_REQUIRED}`
- [ ] Adresse support surveillée : `{SUPPORT_EMAIL}` et `NEXT_PUBLIC_SCIO_SUPPORT_EMAIL`
- [ ] Téléphone de revue si demandé : `{PRIVATE_REVIEW_PHONE}`
- [x] Domaine HTTPS technique : `https://learning-os.141.227.152.154.nip.io`
- [ ] Responsable des demandes de confidentialité : `{PRIVACY_CONTACT}`

Ces valeurs restent dans le dossier tant qu’elles sont inconnues ; ne pas inventer de société, d’adresse ou de représentant sur les pages publiques.

## Checklist produit et URLs

- [ ] `/privacy`, `/terms`, `/support` et `/account-deletion` répondent en HTTPS sans login, redirection privée ni erreur.
- [ ] Les quatre pages sont liées depuis l’app avant connexion ou depuis Profil selon le parcours validé.
- [ ] La suppression in-app est visible pour tout type de compte réellement créable.
- [ ] La suppression efface compte et données actives, et la politique décrit honnêtement marqueur, logs et sauvegardes.
- [ ] L’adresse support configurée reçoit et traite réellement les demandes FR/EN.
- [ ] Les liens utilisent l’origine de production, sans `localhost`, IP privée ni placeholder.

## Checklist Google Play

- [ ] AAB release identifié : `{VERSION_NAME}` / `{VERSION_CODE}` / SHA-256 `{AAB_SHA256}`.
- [ ] Manifeste fusionné et permissions vérifiés ; aucune permission transitive inexpliquée.
- [ ] Data Safety relu depuis `data-safety.md` et le trafic réel.
- [ ] URL de suppression saisie : `https://learning-os.141.227.152.154.nip.io/account-deletion`.
- [ ] Instructions reviewer privées préparées, sans secret dans la description publique.
- [ ] Classification de contenu, cible d’âge et présence de YouTube évaluées.
- [ ] Identité Google, empreintes de signature et Play App Signing testées si ce login est livré.

## Checklist Apple App Store

- [ ] Archive identifiée : `{MARKETING_VERSION}` / `{BUILD_NUMBER}` / SHA-256 `{IPA_SHA256}`.
- [ ] Privacy Report, `PrivacyInfo.xcprivacy`, Required Reason APIs et SDK signatures vérifiés.
- [ ] App Privacy relu depuis `app-privacy.md` et le trafic réel.
- [ ] Privacy Policy URL et Support URL configurées.
- [ ] Sign in with Apple fonctionnel si livré ; identité Google évaluée avec le parcours iOS final.
- [ ] Suppression initiable dans l’app et vérifiée sur compte réel de test.
- [ ] ATS, export compliance, droits YouTube/contenus et notes de revue complétés.

## Checklist preuves et cohérence

- [ ] Captures FR/EN prises sur le build exact, sans données personnelles ni fonctions futures.
- [ ] Aucun écran ne promet « local uniquement » alors que les données atteignent le serveur.
- [ ] aucun SDK publicitaire, analytics ou crash reporting ajouté depuis l’inventaire ; sinon refaire les déclarations.
- [ ] Destinations réseau documentées : serveur SCIO, YouTube/Google, Apple, worker et infrastructure.
- [ ] `retention.md` ne contient plus de décision ouverte pour la production.
- [ ] Relecture croisée fiche ↔ pages publiques ↔ formulaires ↔ binaire effectuée et datée : `{REVIEW_DATE}`.
- [ ] Captures/export des formulaires archivés avec commit `{GIT_COMMIT}`.
