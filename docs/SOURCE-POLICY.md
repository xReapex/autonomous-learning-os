# Politique de sources

Ce que la deep research a le droit de mettre dans ton curriculum, et ce qu'elle
doit refuser.

---

## Les trois règles qui font échouer une source

Elles ne sont pas des préférences. Une source qui en viole une est écartée, pas
amendée.

### 1. Elle doit être gratuitement accessible

Pas de paywall, pas de certificat obligatoire pour accéder au contenu. Un
certificat payant **optionnel** est acceptable — il doit alors être signalé dans
`accessNote`.

`access` vaut toujours `"free"`. Le schéma n'accepte rien d'autre.

### 2. Elle doit être vérifiée

L'agent ouvre le lien. Si l'accès ne peut pas être confirmé aujourd'hui, la
source ne rentre pas. `verifiedAt` porte la **date du jour**, jamais une
estimation.

L'app affiche cette date sur chaque source, précisément pour qu'un curriculum qui
vieillit se voie.

### 3. Elle doit porter une raison

`why` explique pourquoi **cette** ressource pour **cette** notion à **ce**
niveau. « C'est un excellent cours » est refusé par revue, et sa longueur
minimale par le schéma.

Une bonne raison ressemble à :

> « Susskind commence par des systèmes délibérément trop simples pour être réels,
> et explique pourquoi c'est le bon point de départ. Le raisonnement sur ce qu'un
> modèle a le droit d'ignorer se transfère hors de la physique. »

---

## L'ordre de préférence

1. **Cours et contenus institutionnels** — MIT OCW, Open Yale Courses, Stanford
   Online, Harvard Online, CORE Econ, IBM Quantum, Collège de France, France
   Université Numérique, et équivalents.
2. **Manuels ouverts, revues, institutions publiques** — OpenStax, Stanford
   Encyclopedia of Philosophy, arXiv là où le papier est la référence,
   documentation officielle pour les sujets techniques, NIST, INSEE, Our World in
   Data.
3. **Conférences de praticiens reconnus** — acceptables, **explicitement
   étiquetées** comme retour d'expérience et non comme preuve académique.

Le prestige ne prime pas sur le niveau : un cours de master brillant proposé à un
débutant est une mauvaise source pour lui.

---

## Contraintes techniques

Pour une source `kind: "video"` :

- `embedUrl` **obligatoire**, de la forme
  `https://www.youtube-nocookie.com/embed/<ID>`. Sans lui, ni le découpage ni la
  reprise ne fonctionnent — le validateur refuse.
- Le domaine `youtube-nocookie` plutôt que `youtube` : pas de cookie de suivi
  déposé tant que la lecture n'a pas démarré.
- Vérifier que la vidéo **autorise l'intégration**. Certaines la bloquent : dans
  ce cas, `kind: "reading"` avec le lien direct est un repli acceptable. Un lecteur
  cassé ne l'est pas.
- La chaîne **officielle**, jamais un re-upload.

Le découpage est ce qui fait le produit :

| Champ | Sens |
|---|---|
| `totalMinutes` | Durée réelle de la ressource |
| `segmentStartSeconds` | Où commence le passage qui porte la notion |
| `minutes` | Combien de minutes regarder à partir de là (5 à 20) |
| `segmentLabel` | Ce que couvre exactement ce passage |

---

## Ce qui est interdit

- **Inventer une URL.** Un lien mort dans le livrable est un échec du setup, pas un
  détail.
- **Deviner un timestamp.** Si l'agent n'a pas pu situer le passage, il met
  `segmentStartSeconds: 0` et le dit — il ne fabrique pas une valeur crédible.
- **Copier ou héberger le contenu.** On pointe vers la source officielle, on ne la
  duplique pas.
- **Présenter une extrapolation business comme un résultat scientifique.** C'est
  la faute la plus fréquente sur les sujets « cerveau » et « performance ».
- **Remplacer rétroactivement une leçon terminée.** On garde la version, on
  signale la mise à jour.

---

## Entretenir un curriculum

Un curriculum vieillit : des cours sont retirés, des vidéos passent en privé, des
chaînes disparaissent.

- L'app affiche `verifiedAt` sur chaque source, et la plus ancienne vérification
  dans **Réglages → Curriculum**.
- Le validateur avertit au-delà d'un certain âge.
- Pour rafraîchir : relance la recherche **sur les notions concernées uniquement**
  (les rendus bruts sont dans `.setup/research/`), et mets `verifiedAt` à jour.

```bash
node scripts/validate-curriculum.mjs
```

Tant que ce n'est pas vert, le curriculum n'existe pas.

---

## Le cas des sujets qui bougent

Sur un domaine en mouvement rapide — IA, biotech, réglementation — croise toute
annonce avec une publication, une université ou une institution publique avant de
l'intégrer. Un billet de blog d'entreprise annonçant sa propre percée n'est pas
une source, c'est une communication.

Si aucune source institutionnelle n'existe encore sur une notion, mieux vaut
retirer la notion du curriculum que de l'appuyer sur du vent.
