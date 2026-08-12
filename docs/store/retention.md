# Rétention et suppression des données SCIO

> **BROUILLON — NE PAS SOUMETTRE**
> Inventaire technique au 12 août 2026. Les durées de production non codées restent à décider et à publier avant release.

## Durées prouvées par le code

| Donnée | Stockage observé | Durée / déclencheur observé | Suppression observée |
|---|---|---|---|
| Challenge de connexion sociale | store auth serveur | expiration à **5 minutes** ; purge opportuniste lors d’un accès au store | consommation unique ou purge après expiration |
| Session SCIO | empreinte du jeton dans le store auth ; jeton dans SecureStore mobile | expiration par défaut à **24 heures** ; purge opportuniste | logout révoque la session courante ; suppression de compte révoque toutes les sessions |
| Profil et lien Google/Apple | store auth serveur | jusqu’à suppression du compte | endpoint authentifié `DELETE /api/mobile/auth/account` |
| Curriculum, progression et notes actifs | espace serveur partitionné par identifiant SCIO | jusqu’à suppression du compte en l’absence d’une autre politique implémentée | répertoire de l’utilisateur supprimé par le même flux |
| Job de génération terminé | store partagé serveur | **7 jours maximum** | suppression après acquittement ou suppression du compte |
| Cache, récompenses et données de session locales | appareil | jusqu’à logout/suppression ou désinstallation | le flux de compte les efface ; la langue est volontairement conservée |
| Marqueur anti-restauration | serveur, identifiant interne + horodatage de suppression | **aucune expiration codée** | conservé pour empêcher une écriture tardive de recréer les données supprimées |

## Journaux et sauvegardes du déploiement actuel

| Élément | Politique appliquée |
|---|---|
| Logs Nginx | rotation quotidienne, 14 archives compressées maximum |
| Journaux systemd | 14 jours maximum, 1 Gio maximum sur disque |
| Données applicatives | aucune sauvegarde applicative automatisée actuellement |
| Logs applicatifs/worker | métadonnées d’événement seulement ; ne pas journaliser jetons, notes ou réponses libres |
| YouTube, Google et Apple | politique propre de ces services, à relire au jour de la soumission |

## Effet actuel de la suppression

Le chemin de suppression authentifié :

1. vérifie la session ;
2. supprime les jobs de génération du profil ;
3. supprime les données d’apprentissage actives du profil ;
4. supprime le profil, toutes ses sessions et ses liens d’identité sociale ;
5. conserve un marqueur anti-restauration avec identifiant interne et date pour empêcher les écritures tardives ;
6. efface la session et les données locales de session dans l’app.

Il ne purge pas directement les logs d’infrastructure ni les copies de sauvegarde. La procédure opérateur doit empêcher qu’une restauration de sauvegarde ne réactive un compte supprimé et réappliquer les marqueurs de suppression.

## Vérifications obligatoires avant release

- [ ] Fixer une durée maximale pour le marqueur anti-restauration ou documenter précisément sa nécessité et son accès.
- [x] Rotation Nginx et journald bornées à 14 jours.
- [x] Absence de sauvegarde applicative automatisée déclarée publiquement.
- [ ] Définir le délai de traitement d’une demande faite hors de l’app, sans annoncer de délai non garanti.
- [ ] Ajouter un registre minimal des demandes sans y recopier notes, jetons ou identité fournisseur brute.
- [ ] Mettre à jour `/privacy` si une durée ou un destinataire change.
- [x] Tester suppression, panne partielle, retry idempotent et absence de recréation tardive.
