# SCIO — actions externes restantes avant Stores

**État au 12 août 2026 : NO-GO Stores.** Cette liste contient uniquement les preuves impossibles à produire localement sur le VPS. Ne cocher qu’avec un identifiant d’artefact, une capture console ou un test appareil réel.

## Identité légale et support

- [ ] Nom légal et seller name confirmés.
- [ ] Adresse éditeur requise par les consoles confirmée.
- [ ] E-mail support FR/EN réellement surveillé fourni et publié.
- [ ] Contact confidentialité fourni.
- [ ] Politique et conditions relues par le responsable légal.
- [ ] Sous-traitants, régions de traitement et règles de sauvegarde validés.

## Google / Android

- [ ] Compte Play Console et application `io.scio.app` créés.
- [ ] Client OAuth serveur Google créé pour Credential Manager.
- [ ] Package et empreintes SHA-256 de la clé d’upload configurés.
- [ ] Empreinte SHA-256 de la clé **Play App Signing** configurée après activation.
- [ ] Variable privée `SCIO_GOOGLE_SERVER_CLIENT_ID` (client OAuth Web/server, pas le client Android) fournie au build et au backend, sans `EXPO_PUBLIC_*`.
- [ ] AAB release signé produit; version/versionCode/SHA-256 archivés.
- [ ] Manifeste fusionné, target SDK et permissions de l’AAB inspectés.
- [ ] Google Sign-In testé sur appareil depuis le build Play.
- [ ] Logout, réauthentification, suppression de compte et révocation fournisseur officielle testés.
- [ ] Track Internal Testing puis artefact généré par Play testé.
- [ ] Data Safety saisi depuis le trafic réel et le SDK Index.
- [ ] Content rating, target audience, accès reviewer et App Access remplis.

## Apple / iOS

- [ ] Team Apple Developer et App ID `io.scio.app` confirmés.
- [ ] Capability Sign in with Apple activée sur l’App ID et le profil.
- [ ] Certificat et provisioning profile valides fournis à EAS/Xcode.
- [ ] Archive/IPA release signée produite; version/build/SHA-256 archivés.
- [ ] Privacy Report Xcode lu; Required Reason APIs et signatures SDK validées.
- [ ] ATS et destinations réseau contrôlés dans l’archive.
- [ ] Sign in with Apple testé sur iPhone/iPad.
- [ ] Réauthentification et révocation Apple officielle testées avec authorization code/client secret.
- [ ] Suppression de compte réelle testée bout en bout.
- [ ] TestFlight installé et validé sur au moins un iPhone et un iPad si support tablette conservé.
- [ ] App Privacy, export compliance, content rights et notes reviewer remplis.

## Tests appareils communs

- [ ] TalkBack et VoiceOver sur les parcours auth, cours, exercices, profil et suppression.
- [ ] Dynamic Type / taille police maximale sans contenu bloquant ni débordement horizontal.
- [ ] Clavier, safe areas, rotation tablette et predictive back Android.
- [ ] Reprise après arrière-plan, arrêt complet, coupure réseau et changement Wi-Fi/mobile.
- [ ] Job de génération créé, worker interrompu/repris, mobile redémarré, résultat activé puis acquitté.
- [ ] YouTube en FR et EN, origine WebView, lien externe et fallback indisponible.
- [ ] Expiration 401, logout, suppression et réinstallation.
- [ ] Captures Store FR/EN prises depuis les binaires exacts sans donnée personnelle.

## Gate finale

La décision peut passer à GO seulement lorsque : AAB et IPA sont signés, les deux identités sociales et leurs révocations sont prouvées sur appareil, les formulaires correspondent au trafic réel, les pages juridiques ont une identité/contact définitifs et tous les tests matériels ci-dessus sont documentés.
