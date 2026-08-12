# Google Play — Data Safety (brouillon)

> **BROUILLON — NE PAS SOUMETTRE**
> Candidat fondé sur le code du 12 août 2026. Vérifier les définitions et le formulaire Play en vigueur au jour de la soumission.

## Réponses de niveau application

| Question | Réponse candidate | Preuve / réserve |
|---|---|---|
| L’app collecte-t-elle ou partage-t-elle des données utilisateur ? | **Oui — collecte** | Identité SCIO et données d’apprentissage quittent l’appareil vers le serveur. |
| Données chiffrées en transit ? | **Oui, sous condition** | Le client mobile refuse une URL d’API non HTTPS. **À CONFIRMER AVANT SOUMISSION** sur tout le trafic de l’artefact et les redirections. |
| Mécanisme de suppression ? | **Oui** | Suppression dans Profil et ressource `/account-deletion`; endpoint authentifié serveur. |
| Évaluation de sécurité indépendante ? | **Non déclarée** | Ne pas cocher sans certification/audit admissible réel. |

## Catégories candidates

La colonne « partage » reste à valider selon le rôle contractuel de chaque destinataire et la définition Play applicable.

| Type Play candidat | Exemples réellement observés | Collecté | Partagé | Finalité candidate | Obligatoire / facultatif |
|---|---|---:|---:|---|---|
| **Identifiants utilisateur** | identifiant SCIO ; identité fournisseur transformée en empreinte côté stockage auth | Oui | **À CONFIRMER AVANT SOUMISSION** | authentification, sécurité, isolation des données | requis |
| **Activité dans l’application — interactions** | leçons/exercices terminés, résultats de cartes, progression | Oui | Non observé hors prestataires opérant le service ; confirmer | fonctionnalité, gestion du compte | requis pour la synchronisation |
| **Contenu utilisateur — autres contenus** | notes et curriculum personnel | Oui | Conditionnel : worker de génération pour le texte d’entretien | fonctionnalité | notes facultatives ; génération facultative |
| **Diagnostics / données réseau** | IP, route, statut et journaux possibles de l’hébergeur/serveur | Probable en production | **À CONFIRMER AVANT SOUMISSION** | sécurité, prévention des abus, diagnostic | automatique selon infrastructure |

## Flux tiers à qualifier

- **YouTube/Google** : le lecteur vidéo contacte YouTube. Capturer le trafic d’un build release et qualifier les données reçues directement par ce tiers.
- **Google Sign-In / Apple Sign-In** : le jeton d’identité est envoyé au backend pour vérification ; SCIO stocke un lien d’identité transformé. Le client ne demande aucun scope nom/e-mail à Apple et le backend ignore ces claims s’ils existent.
- **Worker de génération** : l’entretien de curriculum est envoyé au worker configuré. Déterminer son sous-traitant réel, sa région et sa rétention.
- **Hébergeur, proxy, PostgreSQL et sauvegardes** : documenter opérateur, localisation, journaux et rôle contractuel.
- La version web auto-hébergée peut activer IA ou Telegram ; ne les déclarer pour le binaire mobile que si le trafic de release les atteint réellement.

## Ce qui n’est pas observé

- aucun SDK publicitaire ;
- aucun SDK d’analytics ou de crash reporting ;
- aucune collecte de localisation précise, contacts, photos, audio, santé ou informations financières par le code mobile inspecté ;
- aucun identifiant publicitaire ni finalité publicitaire observés.

Ces constats ne remplacent pas l’inspection du manifeste fusionné, des SDK transitifs et du trafic réel.

## Validation avant saisie

- [ ] Inspecter le manifeste Android release fusionné et le Data Safety SDK Index.
- [ ] Capturer les destinations réseau sur connexion, vidéo, synchronisation, notes, génération et suppression.
- [x] Le nom et l’e-mail ne sont pas demandés à Apple et sont ignorés par le vérificateur SCIO.
- [ ] Décider « partagé » pour YouTube, identité sociale, worker et hébergeur selon les définitions Play actuelles.
- [ ] Fixer les durées dans `retention.md` et la politique publique.
- [ ] Vérifier que les quatre URLs publiques répondent sans authentification.
