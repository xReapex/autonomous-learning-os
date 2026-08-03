# Sur quoi repose la boucle

Une séance ne se mesure pas au temps passé devant une vidéo. Elle doit laisser
une trace vérifiable : une réponse rappelée sans support, une application à une
situation nouvelle, une erreur identifiée, une carte programmée.

D'où la boucle : **rappel → capsule → pratique → bilan → espacement**.

Ce document relie chaque décision produit à ce qui la soutient — **et à ce qu'elle
ne prouve pas**. Un effet moyen positif en méta-analyse n'est pas une garantie
pour chaque format ni pour chaque personne.

---

## Les décisions, et ce qui les soutient

| Décision | Ce que fait l'app | Niveau de preuve, et sa limite |
|---|---|---|
| **Rappel avant tout** | Les cartes dues et une question ouverte passent avant la source. | Méta-analyse sur 222 études : effet moyen positif du *practice testing* (g ≈ 0,50). Ce n'est pas uniforme selon les formats de test ni les publics. [Yang et al., 2021](https://pubmed.ncbi.nlm.nih.gov/33683913/) |
| **Révision espacée** | SM-2 : l'intervalle vient de la difficulté ressentie, pas du calendrier. | Méta-analyse en classe : bénéfice moyen de la pratique espacée (d ≈ 0,54). L'intervalle optimal dépend du délai de rétention visé — il n'y a pas de recette universelle. [Nunn et al., 2025](https://pubmed.ncbi.nlm.nih.gov/40564553/) · [Cepeda et al., 2006](https://doi.org/10.1037/0033-2909.132.3.354) |
| **Capsules segmentées** | Une source est découpée en 5 à 20 min, suivie d'une consigne. | Le découpage du multimédia aide en moyenne, mais **la qualité de la tâche qui suit est déterminante** : segmenter sans rien demander derrière n'apporte pas grand-chose. [Rey et al., 2019](https://doi.org/10.1007/s10648-018-9456-4) |
| **Explication et transfert** | Les exercices demandent un exemple, une limite ou une hypothèse — jamais une définition. | L'auto-explication montre un effet moyen favorable (g ≈ 0,55). [Bisra et al., 2018](https://eric.ed.gov/?id=EJ1186664) |
| **Feedback exploitable** | La correction dit ce qui manque et **quoi faire au prochain essai**, pas juste juste/faux. | Le feedback est globalement utile (d ≈ 0,48), mais sa qualité et son moment comptent autant que sa présence. [Wisniewski, Zierer & Hattie, 2020](https://pubmed.ncbi.nlm.nih.gov/32038429/) |
| **Entrelacement raisonné** | Les révisions alternent des types de problèmes proches, une fois les bases posées. | Effet moyen positif, plus net sur les tâches de catégorisation et de discrimination que sur tous les contenus. [Brunmair & Richter, 2019](https://pubmed.ncbi.nlm.nih.gov/31556629/) |

---

## Les règles opérationnelles qui en découlent

1. **3 à 5 matières actives — recommandé, pas imposé.** Au-delà, la file de
   révision se remplit plus vite qu'elle ne se vide, et on confond l'ouverture de
   plusieurs cursus avec la progression dans un seul.

   C'est un **compromis, pas une loi** : quelqu'un qui dispose de deux heures par
   jour tient huit matières là où quelqu'un qui en a vingt minutes n'en tient pas
   trois. Le validateur affiche un avertissement au-delà de cinq ; il ne bloque
   rien, et l'app charge autant de matières que le curriculum en contient. Le
   backlog est une option, pas une obligation.

2. **Une carte atomique.** Une idée, une réponse récupérable, et si possible un
   exemple ou une condition de validité. Le recto est une **question**, jamais un
   titre : « La plasticité cérébrale » n'est pas une carte, « Ce que la plasticité
   ne promet pas » en est une.

3. **Une source, un auteur, une date.** Chaque source affiche son institution, sa
   date de vérification et la raison de sa sélection. Les vulgarisations business
   ne sont jamais présentées comme un résultat scientifique.

4. **Les durées sont des budgets, pas des scores.** L'app ne déclare jamais un
   concept « acquis » parce que le chrono est arrivé à zéro.

5. **Rien n'est écrasé rétroactivement.** Une leçon terminée le reste, avec sa
   date. Un curriculum regénéré ne supprime pas l'historique.

---

## L'allocation par durée

| Temps | Rappel | Capsule | Pratique | Bilan | Pause |
|---:|---:|---:|---:|---:|---:|
| 15 min | 3 | 7 | 3 | 2 | — |
| 30 min | 7 | 10 | 8 | 5 | — |
| 45 min | 10 | 15 | 14 | 6 | — |
| 60 min | 12 | 20 | 20 | 8 | — |
| 90 min | 15 | 25 | 30 | 15 | 5 |
| 120 min | 18 | 34 | 42 | 20 | 6 |
| 180 min | 25 | 50 | 65 | 30 | 10 |

Deux choses à lire dans ce tableau :

- **La boucle est complète à toutes les durées.** Même 15 minutes contiennent les
  quatre temps. C'est vérifié par un test.
- **Au-delà d'une heure, le temps supplémentaire va dans la pratique**, pas dans
  la vidéo. Produire, résoudre et vérifier laisse une trace ; regarder plus
  longtemps, beaucoup moins.

Quand la file de révision déborde (plus de 24 cartes dues, sessions ≥ 45 min),
l'app prend 3 minutes **à la capsule**, jamais à la pratique : mieux vaut
consolider ce qui est déjà là que d'empiler du neuf par-dessus.

---

## Comment SM-2 est implémenté ici

`app/src/lib/scheduler.ts`, fonction pure et testée.

- **Quatre notes** — « À revoir », « Difficile », « Correct », « Facile » — au lieu
  des six de SM-2 d'origine. Quatre boutons, c'est ce qu'un humain distingue de
  façon fiable ; six invitent à sur-réfléchir la note au lieu de réviser.
- **Un échec remet tout à zéro** : intervalle à 1 jour, quel que soit
  l'historique. Une carte à 60 jours qu'on rate ne doit pas revenir dans deux mois.
- **La pénalité d'ease survit** à la remise à zéro : les cartes chroniquement
  ratées reviennent plus souvent que les autres.
- **Les deux premiers intervalles sont fixes** (1 jour, puis 6) : SM-2 n'a pas
  encore assez de signal pour calculer quoi que ce soit d'utile.
- **Plancher d'ease à 1,3**, comme SM-2 d'origine.

L'interface annonce l'intervalle que chaque bouton produirait, avant le clic.
Voir la décision, c'est la comprendre.

---

## Ce qu'on ne prétend pas

- **Il n'y a pas de « style d'apprentissage »** visuel/auditif/kinesthésique à
  respecter. C'est un neuro-mythe robuste ; l'app ne l'implémente pas.
- **La plasticité cérébrale ne veut pas dire** qu'une compétence se construit
  instantanément. C'est un changement dépendant de l'expérience, pas une
  optimisation magique.
- **Les effets ci-dessus sont des moyennes.** Sur ton cas précis, la seule mesure
  qui compte est celle que tu produis : est-ce que tu récupères l'idée sans
  support, une semaine plus tard, et est-ce que tu peux l'appliquer ailleurs ?
