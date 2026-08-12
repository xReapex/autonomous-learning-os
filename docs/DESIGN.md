---
version: alpha
name: SCIO
description: Une interface d'apprentissage calme, tactile et éditoriale pour progresser avec précision.
colors:
  primary: "#17221C"
  secondary: "#667069"
  tertiary: "#C44329"
  neutral: "#F4F1E9"
  surface: "#FFFEFA"
  surfaceMuted: "#ECEFEA"
  border: "#D9DDD7"
  textInverse: "#FFFFFF"
  danger: "#A22C23"
typography:
  display:
    fontFamily: Newsreader
    fontSize: 2rem
    fontWeight: 600
    lineHeight: 1.08
    letterSpacing: "-0.025em"
  heading:
    fontFamily: Manrope
    fontSize: 1.25rem
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  body:
    fontFamily: Manrope
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: Manrope
    fontSize: 0.75rem
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.02em"
rounded:
  sm: 10px
  md: 16px
  lg: 22px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.textInverse}"
    rounded: "{rounded.md}"
    height: 48px
    padding: 16px
  button-primary-hover:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.textInverse}"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.lg}"
    padding: 20px
  tab-active:
    backgroundColor: "{colors.surfaceMuted}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
  app-shell:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.primary}"
  divider:
    backgroundColor: "{colors.border}"
    size: 1px
  error-text:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.danger}"
---

# Overview

**SCIO** associe la chaleur d’un carnet de travail à la précision d’un système de progression. L’identité est directe : le wordmark, le monogramme et les métadonnées disent SCIO, sans sous-marque parallèle. L’interface ne reproduit ni Linear, ni Notion, ni le bureau BizOS V9 historique.

La priorité est l'action d'apprentissage suivante. Chaque écran doit répondre immédiatement à une question : continuer, pratiquer, réviser ou régler.

# Colors

La palette est principalement ivoire et encre forestière. Le corail est un signal d'action rare, jamais un remplissage décoratif généralisé.

- **Encre (`primary`)** : texte, boutons principaux et navigation active.
- **Ivoire (`neutral`)** : fond continu de l'application.
- **Papier (`surface`)** : surfaces de travail.
- **Corail (`tertiary`)** : progression et action ponctuelle.
- Les statuts restent toujours écrits ; la couleur seule ne porte aucune information.

# Typography

- **Newsreader** est réservée aux titres de leçon et aux moments éditoriaux.
- **Manrope** porte toute l'interface, les boutons et le corps.
- Les polices sont auto-hébergées via `next/font`; aucun appel Google n'est effectué au runtime.
- Les capitales espacées ne sont pas une voix générale.

# Layout

## Mobile

- En-tête compact dans le flux, sans faux bureau ni wallpaper.
- Une colonne, marges de 16 px.
- Barre de cinq onglets fixe en bas avec icône, texte et safe-area iOS.
- Chaque cible principale mesure au moins 44 × 44 px.
- Une seule action principale par surface.

## Desktop

- Barre latérale de 232 px avec la même navigation.
- Contenu centré, largeur maximale de 1180 px.
- Grille asymétrique 2/1 pour garder la tâche principale dominante.
- La barre mobile n'est jamais rendue visuellement sur desktop.

# Elevation & Depth

Les surfaces se distinguent par une bordure claire et une légère variation de fond. Pas d'ombre dure, pas de fausse fenêtre flottante, pas de wallpaper visible derrière des panneaux.

# Shapes

Les rayons de 10, 16 et 22 px forment une famille souple mais structurée. Les pilules sont réservées aux statuts courts ; elles ne servent pas de contenant universel.

# Components

- **Carte** : surface papier, bordure douce, rayon 22 px, en-tête sans carré décoratif.
- **Bouton principal** : 48 px minimum, encre sur blanc inversé ; le corail apparaît au survol ou comme signal ponctuel.
- **Ligne** : toute la ligne est tactile, 48 px minimum, séparateurs légers.
- **Sélecteur** : un contrôle unique remplace les groupes de nombreux petits boutons.
- **Navigation mobile** : cinq zones de largeur égale, icône filaire originale et libellé visible.
- **Synthèse SCIO** : XP, maîtrise et série restent lisibles dans l’en-tête et le dashboard ; le palier est écrit en toutes lettres.
- **Feedback de gain** : message sobre annoncé avec `aria-live="polite"`, sans confetti ni animation concurrente.

# Internationalization

- L’interface entière possède des dictionnaires français et anglais de même forme, contrôlés par TypeScript et les tests.
- Le premier choix suit les langues du navigateur ; un choix explicite est prioritaire et persiste dans `scio:locale`.
- `html lang` suit immédiatement la langue d’interface.
- Le contenu n’est jamais traduit artificiellement par l’interface. Le changer de langue relève de Curriculum Studio et de l’entretien Codex localisé.
- Toutes les ressources sont des vidéos YouTube. `source.language` doit correspondre à la locale active ; sinon le lecteur, les liens et le mode focus restent fermés avec une explication visible.
- Aucune ressource de lecture, interactive ou interlangue ne sert de fallback silencieux.

# Rewards

- Les gains proviennent exclusivement de mutations d’apprentissage explicites : première complétion, correction réussie, rappel noté au moins 2.
- Navigation, montage et requêtes `GET` sont passifs.
- Chaque événement porte un `eventId` idempotent dans les stockages fichier et PostgreSQL.
- La série possède un unique jour de grâce ; XP, maîtrise et paliers sont calculés dans un domaine serveur typé.

# Accessibility

- Toute cible interactive mesure au moins 44 × 44 px.
- Le focus clavier est visible sur boutons, liens, champs, sélecteurs, résumés et panneaux.
- Les labels et noms accessibles suivent la langue d’interface.
- Les chronomètres ne sont pas annoncés à chaque seconde ; `aria-live` est réservé aux feedbacks utiles et aux réponses asynchrones significatives.

# Do's and Don'ts

## À faire

- Montrer d'abord la prochaine action.
- Replier les explications secondaires avec `details`.
- Conserver toutes les fonctions métier derrière une hiérarchie plus simple.
- Tester à 360, 390, 768, 1024 et 1440 px.
- Respecter les safe areas Android/iOS et le clavier logiciel.

## À éviter

- Ne pas reprendre le shell, les ombres ou le wallpaper BizOS V9.
- Ne pas copier l'agencement exact d'un produit tiers.
- Ne pas transformer le mobile en simple version empilée du desktop.
- Ne pas cacher une fonction essentielle uniquement au survol.
- Ne pas demander de permission native sans nécessité fonctionnelle.
