# Le design — BizOS × Learning

L'app suit l'**UX BizOS V9**, la version en production sur
[bizos.cc](https://bizos.cc) : un wallpaper occupe tout l'écran, des panneaux
blancs stricts flottent dessus avec une ombre dure, et tout est écrit en
**Inria Serif**.

La référence est le brief V9 du dépôt `bizos-saas` (branche `main`,
`docs/design/BRIEF-DASHBOARD-BIZOS-V9.md`). L'ancien « Desktop OS » crème et
violet, tout en monospace, appartient au passé — si vous trouvez encore un
`#8b6df0` quelque part, c'est un reliquat à supprimer.

---

## Les règles qui ne se négocient pas

1. **Une seule grammaire visuelle : noir, blanc, gris.** Aucune teinte d'accent.
   Le statut ne repose jamais sur la couleur seule — il s'écrit en toutes lettres.
2. **Inria Serif est la voix du produit.** La monospace se limite aux durées,
   compteurs et identifiants ; elle n'est jamais la voix générale.
3. **L'interface reste carrée.** `--radius: 0`, aucune pilule, aucune lueur,
   aucun dégradé.
4. **L'ombre appartient aux fenêtres, pas aux contrôles.** `5px 5px 0`, dirigée
   en bas à droite, sans flou. **Les boutons sont plats.**
5. **Au survol, les couleurs s'inversent — rien ne bouge.** Pas de `translate`,
   pas d'ombre ajoutée.
6. **Le titre de section n'a jamais de trait en dessous.**

---

## La palette

| Token | Valeur | Usage |
|---|---|---|
| `--ink` | `#111111` | Encre, traits, remplissages actifs |
| `--paper` | `#ffffff` | Fond des cartes |
| `--canvas` | `#e8e8e6` | Le gris de l'espace, sous le wallpaper |
| `--grey-600` | `#6b6b6b` | Métadonnées, texte secondaire |
| `--grey-400` | `#9a9a9a` | Placeholders |
| `--grey-200` | `#d9d9d9` | Traits fins, états désactivés |
| `--grey-100` | `#efefee` | Fonds de champ, séparateurs de lignes |

C'est tout. Il n'y a pas de token d'accent, et il ne faut pas en ajouter.

**Sur un fond sombre**, `data-surface="dark"` inverse **uniquement la chrome
posée directement sur le wallpaper** — wordmark, sous-titre, barre basse. Les
cartes ne changent jamais : blanches, texte noir, trait noir. Le fond apporte le
monde, les panneaux restent stricts.

---

## La typographie

```css
--serif: var(--font-inria), Georgia, "Times New Roman", serif;   /* la voix */
--sans:  var(--font-lexend), "Helvetica Neue", Arial, sans-serif; /* microcopies */
--mono:  ui-monospace, "SF Mono", Menlo, "Courier New", monospace; /* chiffres */
```

Les deux polices viennent de `next/font/google` : elles sont téléchargées au
build puis **auto-hébergées**, donc aucun appel à Google au runtime. Georgia est
un repli très proche si le build se fait hors ligne.

| Rôle | Traitement |
|---|---|
| Titre de section | Inria Serif, `1.3rem`, gras, casse normale, tracking normal |
| Titre de page | Inria Serif, `1.65rem`, gras |
| Corps | Inria Serif, `0.85–0.9rem` |
| Libellés, métadonnées, boutons | Lexend, `0.6–0.68rem`, majuscules, `letter-spacing` `0.12em` |
| Chrono, durées, index | Mono |

Pas de capitales espacées sur toutes les microcopies : uniquement sur les
libellés et les actions.

---

## La carte

```
┌─────────────────────────────────────┐╲
│ ■ Titre de section         contexte │ ╲  ombre dure 5px 5px 0
│                                     │  │  dirigée, sans flou
│   contenu                           │  │
│                                     │  │
└─────────────────────────────────────┘  │
 ╲_________________________________________╲
```

- Fond **blanc**, trait **1 px** noir, coins carrés, `padding: 12px 14px`.
- L'en-tête est **un carré noir de 9 px** suivi du titre en serif. **Aucun trait,
  aucun bord, aucun séparateur en dessous.**
- Une section sans action à droite garde exactement la même hauteur et le même
  alignement qu'une section avec actions.
- Aucun bandeau noir décoratif, aucune carte dans une carte sans raison
  fonctionnelle.

Le composant `<Card>` (`src/components/window.tsx`) est le seul chemin — c'est ce
qui empêche une section ajoutée plus tard d'importer son propre langage visuel.

---

## La composition

```
              BizOS ᴸᴱᴬᴿᴺᴵᴺᴳ          ← wordmark centré, hors des cartes
                 SUJET                ← sous-titre

┌──────────────────┐ ┌──────────┐     ← 3 colonnes, gouttière 11 px
│                  │ │          │
│   colonne large  │ │  cartes  │
│   (span 2)       │ │          │
└──────────────────┘ └──────────┘

   AUJOURD'HUI  COURS  EXERCICES …    ← barre basse persistante
```

- Le wordmark `BizOS` est centré au-dessus de l'espace de travail, **jamais
  répété dans un panneau**.
- Trois colonnes, gouttière de **11 px**, largeur maximale 1320 px.
- La barre basse est fixe ; le workspace réserve la place en dessous
  (`padding-bottom: 62px`) pour que le contenu ne se perde pas derrière elle.
- En dessous de 1180 px on passe à deux colonnes, puis à une pile de cartes sous
  780 px.

---

## Les commandes

**Bouton** — fond noir, texte blanc, trait noir, carré, **sans ombre**. Au survol
et au focus, les couleurs s'inversent ; le bouton ne se déplace pas.
`.bx-btn-ghost` est son négatif. Un `aria-pressed` rend l'état sélectionné.

**Action textuelle** — Inria Serif `0.78rem`, souligné. Le survol change
l'opacité, jamais la position.

**Ligne de ressource** (`.bx-row`) — icône, titre, métadonnée, `Ouvrir →` révélé
au survol **et au focus**. Toute la ligne est cliquable ; au survol elle passe en
noir, texte en blanc. Aucun mouvement vertical.

**Tâche / étape** (`.bx-task`) — noire à texte blanc quand elle est active,
s'inverse au survol. Une étape inactive est grise, et son état est écrit.

**Contrôle segmenté** (`.bx-segmented`) — actif : noir sur blanc inversé ;
inactif : gris à trait noir.

**Focus** — contour de 2 px, décalé de 2 px, sans déplacement. Le focus clavier
révèle exactement les mêmes actions que le survol.

---

## Le wallpaper

Il occupe tout l'écran et reste visible autour des panneaux. **Il n'est pas
atténué par défaut** : ce sont les cartes qui sont opaques.

Les douze fonds livrés sont **procéduraux** — du SVG en data-URI écrit à la main
dans `src/lib/wallpapers.ts`. Ce dépôt étant public, redistribuer des images de
personnes réelles ou d'œuvres protégées poserait un problème de droits à chaque
personne qui clone. Ils sont tous monochromes ou très désaturés : le fond apporte
l'ambiance, jamais un accent coloré.

| Groupe | Fonds |
|---|---|
| Atelier | Atelier, Papier, Toile |
| Grilles | Grille, Blueprint, Points |
| Matières | Synapse, Registre, Orbite, Relief |
| Nuit | Minuit, Ciel |

Les images de l'utilisateur vont dans `app/public/wallpapers/` (git-ignoré) et
apparaissent dans la galerie au rechargement.

---

## Ce qu'on ne fait pas

- Pas de teinte d'accent, pas de gradient, pas de lueur, pas de flou d'ombre.
- Pas de coin arrondi, pas de pilule.
- Pas d'ombre sur un bouton interne.
- Pas de mouvement au survol.
- Pas d'emoji couleur : les icônes de matières sont des glyphes
  (`↗ ◌ ◐ ✦ ⌁ △ ≋ ✣ ◇ ◎`).
- Pas de trait sous un titre de section.
- Pas de monospace comme voix générale.

---

## Le personnaliser

Sans toucher au CSS :

| Quoi | Où |
|---|---|
| Sujet sous le wordmark | `NEXT_PUBLIC_LEARNING_SUBJECT` |
| Fond par défaut | `NEXT_PUBLIC_DEFAULT_WALLPAPER` |
| Durée de session par défaut | `NEXT_PUBLIC_DEFAULT_SESSION_MINUTES` |
| Icônes de matières | `icon` dans `curriculum.json` |

En touchant au CSS : tout part des variables en tête de `src/app/globals.css`.

---

## Checklist avant de livrer un composant

- [ ] Le titre suit le modèle : carré noir de 9 px, serif, **pas de trait dessous**.
- [ ] La palette reste monochrome.
- [ ] Les coins sont carrés, le trait principal fait 1 px.
- [ ] L'ombre de carte est `5px 5px 0`, aucun bouton interne n'a d'ombre.
- [ ] Rien ne bouge au survol.
- [ ] Le focus clavier révèle les mêmes actions que le survol.
- [ ] Aucun état ne repose sur la seule couleur.
- [ ] Vérifié à 1440 × 900, 1280 × 800 et en pile mobile.
