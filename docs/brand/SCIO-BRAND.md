# SCIO — système de marque

Version 4.0 · août 2026

## Idée directrice

**SCIO** vient du latin *sciō* : « je sais ». La marque accompagne le passage d’une intention à une maîtrise durable : **Apprendre. Pratiquer. Savoir.** / **Learn. Practice. Know.**

L’identité repose sur un mot-symbole éditorial `SCIO` en capitales et sur un monogramme secondaire `SC`. Les deux signes proviennent du même dessin à empattements : ils expriment la connaissance par la précision typographique plutôt que par un symbole illustratif ou un marqueur d’IA.

## Personnalité

Calme, cultivée, exigeante et contemporaine. SCIO privilégie une hiérarchie éditoriale nette, des contrastes sobres et des corrections optiques discrètes.

## Palette

| Rôle | Nom | Hex | Usage |
| --- | --- | --- | --- |
| Texte | Encre | `#10231F` | Mot-symbole, texte, structure |
| Primaire | Pétrole | `#0F766E` | Actions, sélection, progression |
| Primaire sombre | Pétrole sombre | `#0B5D57` | Fond de l’icône, états pressés, contrastes renforcés |
| Primaire douce | Brume pétrole | `#DDF3EF` | Sélections et surfaces informatives |
| Fond de marque | Papier | `#F4F1E9` | Monogramme dans l’icône |
| Toile produit | Toile | `#F5F7F6` | Arrière-plan de l’application |
| Surface | Blanc | `#FFFFFF` | Cartes et surfaces élevées |
| Secondaire | Ardoise | `#5F6F69` | Texte secondaire |
| Séparateur | Ligne | `#D9E2DE` | Bordures et séparateurs |

Le corail historique `#E85D3F` peut subsister comme accent fonctionnel rare dans l’interface, mais il ne fait plus partie du logo et ne doit jamais être ajouté au monogramme ou au mot-symbole.

## Fichiers maîtres

Source reproductible : `artifacts/brand/v3/generate_logos.py`.

- `artifacts/brand/v3/scio-wordmark-v4.svg` — mot-symbole Encre en tracés.
- `artifacts/brand/v3/scio-wordmark-reverse-v4.svg` — version Papier sur fond sombre.
- `artifacts/brand/v3/scio-icon-v4.svg` — icône carrée opaque Pétrole sombre/Papier.
- `artifacts/brand/v3/scio-adaptive-foreground-v4.svg` — foreground Android transparent.
- `artifacts/brand/v3/scio-adaptive-monochrome-v4.svg` — masque Android monochrome.
- `app/public/scio-mark.svg` — monogramme Pétrole transparent pour le web.
- `app/public/scio-mark-mono.svg` — monogramme Encre transparent.
- `app/public/scio-wordmark.svg` et `scio-wordmark-reverse.svg` — mots-symboles web.
- `app/public/scio-lockup.svg` — composition autonome monogramme + mot-symbole.
- `mobile*/assets/brand/` — rasters Expo iOS, Android, splash et favicon.

Tous les SVG livrés utilisent des tracés autonomes : aucune fonte, image externe, ombre, dégradé, filtre ou ressource réseau à l’exécution.

## Construction et corrections optiques

La base typographique est **Instrument Serif Regular**, convertie en tracés SVG avec FontTools. Le mot-symbole utilise un `I` condensé à 92 % et un espacement `IO` corrigé. Dans le monogramme, le `C` est condensé à 94 % afin d’équilibrer visuellement le `S` aux petites tailles.

Ne jamais retaper `SCIO` avec une fonte installée pour remplacer le fichier maître. Ne pas modifier séparément l’approche des lettres ni les proportions du monogramme.

## Zone de protection et tailles minimales

- Monogramme d’interface : **24 px** recommandé ; 16 px seulement en monochrome et après contrôle visuel.
- Mot-symbole : **88 px** de large minimum à l’écran.
- Lockup : **160 px** de large minimum.
- Impression : monogramme **8 mm**, lockup **36 mm**.
- Zone de protection : au moins la largeur d’un fût du `I` autour du signe.
- Icône iOS/Expo : master RGB opaque 1024 × 1024, sans coins pré-arrondis.
- Android adaptatif : le foreground utilise un fit central de 600 × 600 dans un canvas 1024 × 1024 pour résister aux masques circulaires, squircle et goutte.

## Répartition des rôles

- `SC` : icône d’application, favicon, avatar et petite surface carrée.
- `SCIO` : splash, en-tête éditorial, onboarding et communication.
- Lockup : contexte où le nom doit être explicite et le monogramme visible.
- Les icônes fonctionnelles restent distinctes de la marque.

## Système d’icônes fonctionnelles

L’application utilise exclusivement **Lucide React Native** à travers `src/components/app-icon.tsx`.

- trait par défaut : 2 px avec `absoluteStrokeWidth` ;
- onglet inactif : 1,8 px ; onglet actif : 2,4 px ;
- taille courante : 20–24 px dans un conteneur tactile d’au moins 44–48 px ;
- une même action conserve le même pictogramme sur tous les écrans ;
- les actions icon-only exigent un `accessibilityLabel` ;
- la couleur n’est jamais l’unique différence entre deux états.

Les symboles décoratifs ou ambigus (`Sparkles`, baguette magique, ampoule pour une erreur, base de données dans un écran utilisateur) sont interdits. Utiliser les concepts produit réels : parcours, récompense, progression, synchronisation, révision ou validation.

## Usages à éviter

- Ne pas réintroduire l’ancien S monoline ni son point corail.
- Ne pas étirer, incliner, contourer ou recomposer les lettres.
- Ne pas appliquer d’ombre, dégradé, transparence décorative ou effet 3D.
- Ne pas pré-arrondir les coins du master d’icône mobile.
- Ne pas employer le monogramme `SC` comme pictogramme fonctionnel.
- Ne pas mélanger Lucide avec `@expo/vector-icons`, des emoji ou des symboles Unicode.

## Licence de la fonte source

Les métadonnées de `InstrumentSerif-Regular.ttf` indiquent la **SIL Open Font License 1.1** (`https://scripts.sil.org/OFL`). Les livrables SCIO sont convertis en tracés et ne chargent pas cette fonte à l’exécution. Conserver la fonte source et sa licence avec les fichiers de production de marque ; refaire une vérification juridique lors de la livraison commerciale finale.

## Accessibilité

Encre sur Toile et Encre sur Blanc offrent un contraste élevé. Pétrole sombre sur Blanc est réservé aux usages lisibles. Les états combinent libellé, forme et icône ; aucune information n’est portée uniquement par une couleur ou par la marque.
