# Le design — BizOS × Learning

L'app est rendue comme un **bureau** : canvas crème, grain papier, fenêtres à
bordure épaisse qui projettent une ombre dure violette, tout en monospace.

C'est le langage visuel de [BizOS](https://bizos.cc), repris ici pour que
l'espace d'apprentissage se sente comme une pièce du même système. Le wordmark
`BizOS × Learning` en haut à gauche dit exactement ça.

---

## Trois règles qui ne se négocient pas

1. **`--radius: 0`.** Rien n'arrondit. Jamais.
2. **Aucune ombre floue.** `6px 6px 0 #8b6df0` et rien d'autre. Pas de `blur`, pas
   de dégradé sur une surface.
3. **Une seule teinte d'accent.** Le violet signifie *actif*. L'ochre signifie
   *attention*, la brique *destructif*. Pas de quatrième couleur.

Enfreindre l'une des trois casse le bureau : la surface devient une carte
Material, et tout le reste suit.

---

## La palette

| Token | Valeur | Usage |
|---|---|---|
| `--bg` | `#ece5d6` | Le bureau, crème mat |
| `--surface` | `#f4eee0` | Fenêtres, menubar, rail |
| `--surface-2` | `#e8e0cf` | Ligne active dans une liste |
| `--ink` | `#1f1a2e` | Encre navy-noir — **toutes** les bordures, 2 px |
| `--ink-soft` | `#5b5448` | Texte secondaire, taupe chaud |
| `--hairline` | `#ddd3bf` | Séparateur fin, survol |
| `--purple` | `#8b6df0` | Accent : actif, CTA, grands chiffres, ombres |
| `--purple-deep` | `#6e52d4` | Texte violet : liens, libellés, titres de fenêtre |
| `--purple-hover` | `#7959e0` | Survol d'un bouton violet |
| `--ochre` | `#c8862b` | Attention, en pause |
| `--brick` | `#c4452e` | Destructif, STOP |
| `--teal` | `#2f7d68` | Terminé |

Sur un fond sombre, `data-surface="dark"` inverse l'encre en crème et fonce les
surfaces. **Le violet ne bouge pas** — c'est ce qui garde l'identité d'un thème à
l'autre.

Le basculement est automatique : `isDarkWallpaper()` calcule la luminance perçue
du fond choisi. Sans ça, l'encre navy sur du navy devient illisible.

---

## La typographie

Tout est monospace. Il n'y a pas de couple serif/sans.

```css
--mono: ui-monospace, "SF Mono", "Courier Prime", "Courier New", Courier, monospace;
```

Pile système délibérée : pas de `next/font`, donc pas d'appel réseau au build, et
l'app se construit hors ligne.

| Rôle | Traitement |
|---|---|
| Corps, tableaux, horodatages | Mono, poids normal |
| Titres de fenêtre, libellés, boutons | **Gras + MAJUSCULES + `letter-spacing: 1–2px`** |
| Grands chiffres (KPI, chrono) | Mono gras, grande taille, **violet** |
| Sur-titres (`.bx-overline`) | 10 px, gras, 2 px de tracking, violet foncé |

`font-feature-settings: "tnum"` partout : les chiffres restent alignés d'une ligne
à l'autre, ce qui compte sur un chrono et une file de révision.

---

## La fenêtre

Toute surface de contenu est une fenêtre. Le composant `<Win>`
(`src/components/window.tsx`) est le seul chemin — c'est ce qui empêche la dérive
vers un panneau arrondi.

```
┌─────────────────────────────────────┐╲
│ ■ TITRE EN MAJUSCULES      contexte │ ╲  ombre dure violette
├─────────────────────────────────────┤  │  6px 6px 0, aucun flou
│                                     │  │
│  contenu                            │  │
│                                     │  │
└─────────────────────────────────────┘  │
 ╲_________________________________________╲
```

- Surface `#f4eee0`, bordure 2 px `#1f1a2e`, coins nets.
- Barre de titre 30 px : carré violet à bordure navy, titre mono majuscule,
  contexte à droite en taupe, règle 2 px en dessous.
- Ombre `6px 6px 0 var(--purple)` — `3px 3px` pour les éléments compacts.

---

## Le bureau et ses fonds

Trois couches empilées, `WallpaperLayer` :

1. La couleur pleine du fond.
2. Le motif ou l'image, à l'opacité choisie.
3. Le **grain** — le `feTurbulence fractalNoise` de BizOS, à 0,06 d'opacité,
   repris verbatim pour que la texture soit exactement la même.

Le contenu passe au-dessus en `z-index: 1`.

### Les douze fonds livrés

Tous **procéduraux** : du SVG en data-URI écrit à la main, dans
`src/lib/wallpapers.ts`. Quelques kilo-octets, aucun asset binaire.

C'est un choix qui a une raison : ce dépôt est public. Redistribuer des images —
même générées — de personnes réelles ou d'œuvres protégées poserait un problème
de droits à chaque personne qui clone.

| Groupe | Fonds | Pour |
|---|---|---|
| Bureau | Bureau, Papier, Liège | Le défaut, et les sujets qui s'écrivent |
| Grilles | Grille, Blueprint, Points | Ingénierie, systèmes |
| Matières | Synapse, Registre, Orbite, Relief | Cognition, finance, astro, vivant |
| Nuit | Minuit, Ciel | Sessions tardives |

Chaque fond porte une `suggestedDim` : l'opacité à laquelle il reste **derrière**
le contenu. Elle s'applique au changement de fond ; l'utilisateur reste libre de
l'ajuster ensuite.

### Les fonds de l'utilisateur

Déposés dans `app/public/wallpapers/`, listés par `/api/wallpapers`, visibles au
rechargement. Le dossier est git-ignoré : les images restent chez leur
propriétaire et ne partent pas dans un fork.

---

## Les commandes

**Boutons** (`.bx-btn`) — rectangulaires, bordure 2 px, mono majuscule, ombre
dure. Le retour tactile est la micro-interaction principale :

| État | Transform | Ombre |
|---|---|---|
| Repos | — | `3px 3px` |
| Survol | `translate(-1px, -1px)` | `4px 4px` |
| Pressé | `translate(2px, 2px)` | `1px 1px` |
| Sélectionné (`aria-pressed`) | pressé, en permanence | `1px 1px` + fond violet |

Variantes : `default` (crème), `bx-btn-accent` (violet plein), `bx-btn-danger`
(brique), `bx-btn-ghost` (sans bordure).

**Focus** — double `box-shadow` violet, décalé de 2 px du bord. Un utilisateur
clavier doit le voir sans le chercher.

**Mouvement** — 100 à 150 ms, mécanique. Coupé entièrement sous
`prefers-reduced-motion`.

---

## Ce qu'on ne fait pas

- Pas d'ombre floue, pas de coin arrondi, pas de dégradé sur une surface.
- Pas de serif, pas de sans — le bureau est mono uniquement.
- Pas de nouvelle teinte d'accent. On étend avec violet / ochre / brique.
- Pas d'emoji couleur dans l'interface. Les icônes de matières sont des glyphes
  monospace : `↗ ◌ ◐ ✦ ⌁ △ ≋ ✣ ◇ ◎`.
- Pas de grands aplats violets. Le violet est précieux : il marque *l'action
  principale en vue*, et une seule à la fois.

---

## Le personnaliser

Sans toucher au CSS :

| Quoi | Où |
|---|---|
| Sujet affiché sous le wordmark | `NEXT_PUBLIC_LEARNING_SUBJECT` |
| Fond par défaut | `NEXT_PUBLIC_DEFAULT_WALLPAPER` |
| Durée de session par défaut | `NEXT_PUBLIC_DEFAULT_SESSION_MINUTES` |
| Icônes de matières | `icon` dans `curriculum.json` |

En touchant au CSS : tout part des variables en tête de
`src/app/globals.css`. Changer `--purple` retourne l'identité complète — ombres,
accents, focus, chiffres — en une ligne.
