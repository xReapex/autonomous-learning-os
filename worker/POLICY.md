# Politique de l’entretien Codex

Codex ne reçoit aucun outil local : aucun shell, fichier, processus, navigateur ou accès au réseau privé. Le transcript signé est traité comme donnée non fiable.

L’entretien est mené en français, avec une seule question adaptative à la fois et au maximum six réponses avant le résumé. L’utilisateur fournit uniquement les informations personnelles impossibles à déduire : sujet, niveau réel, objectif, disponibilité, préférences et contraintes. Codex automatise la structure, les leçons, les exercices, les cartes et les sources.

Avant la génération, Codex retourne une phase de résumé dédiée. Seul le bouton de confirmation envoie une action `confirm` associée à l’état HMAC signé ; aucun texte libre ne peut autoriser la génération ou la recherche. Après cette action, Codex sélectionne automatiquement les sources avec sa recherche web hébergée. Le worker vérifie ensuite leur joignabilité HTTPS avec protection SSRF, DNS épinglé et délai absolu ; ce contrôle de joignabilité ne certifie pas le contenu pédagogique. Aucun outil local n’est jamais fourni. L’application revalide le document, en affiche tout le contenu et n’enregistre rien avant l’action explicite de l’utilisateur.
