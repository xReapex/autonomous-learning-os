# Dossier Store SCIO

> **BROUILLON — NE PAS SOUMETTRE**
> État du dépôt examiné le 12 août 2026. Ce dossier prépare les réponses mais ne prouve ni la configuration de production, ni le contenu d’un AAB/IPA signé, ni une déclaration déjà effectuée.

## Objet

Les documents décrivent le flux mobile SCIO actuellement visible dans le dépôt : compte individuel, session serveur, curriculum, progression, cartes, notes, génération de curriculum et vidéos YouTube. Ils évitent de qualifier comme actif ce qui n’est encore que configurable.

- [`data-safety.md`](data-safety.md) — brouillon Google Play Data Safety ;
- [`app-privacy.md`](app-privacy.md) — brouillon Apple App Privacy ;
- [`retention.md`](retention.md) — durées prouvées, suppressions et inconnues ;
- [`metadata-checklist.md`](metadata-checklist.md) — textes FR/EN, URLs et contrôle avant soumission.

## URLs publiques à publier

Origine HTTPS actuellement livrée :

- `https://learning-os.141.227.152.154.nip.io/privacy`
- `https://learning-os.141.227.152.154.nip.io/terms`
- `https://learning-os.141.227.152.154.nip.io/support`
- `https://learning-os.141.227.152.154.nip.io/account-deletion`

Les routes existent sans segment de langue et chaque page contient le texte FR/EN. Elles doivent rester accessibles sans session ni Basic Auth dans la configuration de production.

## Règle d’utilisation

1. Inspecter l’artefact signé, les permissions/SDK finaux et le trafic réseau réel.
2. Faire compléter toutes les lignes **À CONFIRMER AVANT SOUMISSION** par le responsable de la release.
3. Remplacer les placeholders de ce dossier ; ils sont intentionnels et ne doivent jamais apparaître sur les pages publiques.
4. Reporter les réponses dans Play Console/App Store Connect sans copier les notes conditionnelles.
5. Conserver une capture datée des formulaires soumis et la version de l’artefact correspondant.

## Résumé prudent

Le code observé utilise un serveur SCIO et ne permet donc pas de répondre « aucune collecte ». Il ne contient actuellement **aucun SDK publicitaire**, aucun SDK d’analytics et aucune logique de tracking inter-app observée. YouTube, Google/Apple Sign-In, l’hébergeur et le worker de génération restent des flux à contrôler sur la release et dans les contrats/configurations réels.
