# Apple App Privacy (brouillon)

> **BROUILLON — NE PAS SOUMETTRE**
> Mapping candidat du code inspecté le 12 août 2026. La taxonomie App Store Connect et le trafic du binaire signé restent autoritaires.

## Position générale

- **Data Used to Track You :** aucune logique de tracking inter-app/site observée ; répondre « non » seulement après contrôle des SDK et de YouTube dans l’archive finale.
- **Data Linked to You :** oui pour les données SCIO stockées sous l’identifiant interne du compte.
- **Data Not Linked to You :** journaux agrégés/anonymisés non prouvés ; ne rien déclarer ici sans preuve de la chaîne de production.

## Types candidats

| Catégorie Apple candidate | Donnée | Liée à l’utilisateur | Finalité candidate | Réserve |
|---|---|---:|---|---|
| **Identifiers — User ID** | identifiant SCIO et lien d’identité fournisseur transformé | Oui | App Functionality, Account Management, Security | Pas d’identifiant publicitaire observé. |
| **User Content — Other User Content** | notes, texte d’entretien et curriculum personnel | Oui | App Functionality | L’entretien peut atteindre le worker de génération. |
| **Usage Data — Product Interaction** | progression, leçons/exercices terminés, résultats de cartes | Oui | App Functionality | Pas d’usage analytics observé. |
| **Diagnostics — Other Diagnostic Data** | journaux serveur/hébergeur possibles | **À CONFIRMER AVANT SOUMISSION** | App Functionality, Security, ou Analytics selon usage réel | Inspecter la production avant de choisir la catégorie exacte. |

## Tiers et collecte directe

- **YouTube/Google** reçoit des requêtes lorsque la vidéo est chargée. Vérifier les pratiques du SDK/WebView exact et les réponses requises dans App Privacy.
- **Google et Apple** interviennent dans les flux de connexion. Le backend vérifie un jeton d’identité ; SCIO conserve le fournisseur et une identité transformée. Aucun scope nom/e-mail n’est demandé à Apple et les claims correspondants sont ignorés.
- Le **worker de génération** reçoit le texte de l’entretien lorsqu’un utilisateur lance cette fonction.
- L’**hébergeur**, le proxy, PostgreSQL et les sauvegardes peuvent traiter les données pour fournir le service.

Aucun SDK publicitaire, SDK d’analytics ou SDK de crash reporting n’est observé dans le code inspecté. **À CONFIRMER AVANT SOUMISSION** dans le Privacy Report Xcode, les manifests de confidentialité agrégés et l’archive signée.

## URLs App Store Connect

- Privacy Policy URL : `https://learning-os.141.227.152.154.nip.io/privacy`
- Support URL : `https://learning-os.141.227.152.154.nip.io/support`
- Terms : `https://learning-os.141.227.152.154.nip.io/terms`
- Account deletion information : `https://learning-os.141.227.152.154.nip.io/account-deletion`

## Contrôle archive iOS

- [ ] Générer le Privacy Report Xcode de l’archive release.
- [ ] Inspecter `PrivacyInfo.xcprivacy`, Required Reason APIs et manifests/signatures des SDK.
- [ ] Vérifier ATS et toutes les destinations réseau sur appareil réel.
- [ ] Confirmer qu’aucun e-mail, donnée d’achat, diagnostic ou identifiant appareil supplémentaire n’est traité.
- [ ] Aligner chaque finalité choisie sur l’usage réel, pas sur une intention future.
- [ ] Vérifier que suppression et liens légaux sont accessibles dans le parcours soumis.
