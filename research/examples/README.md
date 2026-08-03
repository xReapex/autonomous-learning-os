# Exemples

## `curriculum.example.json`

La forme exacte qu'un curriculum doit avoir, en version minimale : une matière,
une leçon, une source principale, une source de repli, trois cartes.

**Copie la structure, pas le contenu.** Les sources citées valent pour la finance
quantitative ; un curriculum sur autre chose n'a rien à en tirer.

Ce qu'il montre en particulier :

- Un `goal` **vérifiable** — « lire un prospectus et calculer soi-même », pas
  « comprendre la finance ».
- Un `segmentStartSeconds` non nul : la capsule commence à 28 min de la vidéo,
  là où la notion est traitée.
- Un `why` qui dit pourquoi *cette* source dans *cet* ordre, pas qu'elle est bonne.
- Une `alternative` qui a un rôle distinct — les exercices corrigés que le cours
  filmé n'a pas — plutôt qu'un doublon.
- Une carte `Erreur classique` : la file de révision doit contenir les confusions,
  pas seulement les définitions.

```bash
node scripts/validate-curriculum.mjs research/examples/curriculum.example.json
```
