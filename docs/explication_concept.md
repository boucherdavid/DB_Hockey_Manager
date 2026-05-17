# Explication des concepts ou fondements

Ce fichier sert de base pour expliquer certains concepts ou donner des exemples pour permettre une meilleure compréhension de la vision de l'administrateur du pool dans ce qu'il veut comme implémentations. Ce fichier est en évolution et ce qui est couvert dans les différents sujets peut-être questionné par Claude pour soumettre de meilleurs idées ou concept.

---

<!-- Ajoute tes concepts/exemples ci-dessous, avec la date si possible -->
2026-05-16

## Comment comptabiliser les points
- S'applique pour la saison régulière et les séries (parfois faire le parallèle des concepts). Lorsqu'il y a un point ambigü, SVP validez avant d'implémenter quelque chose.
- Un joueur est considéré actif lorsque le pooler le met actif dans son alignement avant le match de son équipe.
- Ses points sont comptés à partir de la date de son activation (par défaut en début de saison, la date d'activation correspond à la date du premier match au calendrier de la LNH. Pour le pool des séries en temps normal ça l'aurait été la date de la première partie des séries mais dans le cas présent, on a mis manuel car on a débuté après le début des séries.) jusqu'à ce qu'il soit désactivé (possible que ce soit jamais si le pooler le laisse actif toute la saison ou toutes les séries).
- Les activations et désactivations peuvent être soumises à certaines règles, comme un délai d'activation lorsqu'un joueur est désactivé, il ne peut être réactivé avant un nombre X de jours (déterminé par consensus parmi ls poolers).
 
 ## Exemple fictive de comptabilisation de points basé sur la saison régulière 2025-2026 qui s'est terminée en Avril.
- La saison régulière débute le 7 octobre 2025.
- Tous les joueurs des alignements actifs des poolers (12 attaquants, 6 défenseurs et 3 gardiens) ont le 7 octobre 2025 comme date d'activation.
- Le 1er novembre 2025 pendant sa partie, Lane Hutson de mon alignement se blesse.
- Le 2 novembre 2025, je désactive Lane Hutson et j'active Logan Mailloux.
    - Lane Hutson a donc 1 première période active du 7 octobre 2025 au 1er novembre 2025. Pendant cette période, il fait 15 points.
    - Logan Mailloux devient actif le 2 novembre 2025.
- Le 29 novembre 2025 Lane Hutson revient au jeu et fait 3 points lors de cette partie. Je na savais pas que Hutson revenait au jeu et donc en voyant ces résultats, je le réactive le 30 novembre 2025. Cependant, je désactive Rasmus Dahlin car c'est lui qui est maintenant blessé et Logan Mailloux reste dans mes joueurs actifs.
    - La nouvelle période d'activité de Hutson débute le 30 novembre 2025 et les 3 points de la veille ne doive pas apparaitre dans son total de points qu'il apporte à mon pool.
    - La période d'activité de Rasmus Dahlin est du 7 octobre 2025 au 29 novembre 2025 puisqu'il a été désactive le 30 novembre 2025 avant le match de Buffalo (son équipe).
    - La période d'activité de Logan Mailloux se poursuit encore.
- Le 3 mars 2026 j'apprend que Rasmus Dahlin revient au jeu. Je le réactive à 17h avant le match de son équipe qui est à 19h. Cette fois-ci, je désactive Logan Mailloux et vu que le match de Mailloux n'est pas débuté à 17h, le changement est effectif le jour même.
    - La période d'activité de Dahlin recommence donc le 3 mars 2026.
    - La période d'activité et de comptabilisation des points de Mailloux est donc du 2 novembre 2025 au 2 mars 2026.
- À la fin de la saison on a :
    - Lane Hutson
        - Actif du 7 octobre 2025 au 1er novembre 2025 = 15 points
        - Actif du 30 novembre 2025 à la fin de la saison = 60 points
        - Son cumulatif doit être de 75 points
        - Même si son total réel est 78 points seulement les points lors de ses périodes actives comptent.
    - Logan Mailloux
        - Actif du 2 novembre 2025 au 2 mars 2026 = 30 points
        - Son cumulatif doit être 30 points
        - Même si son total réel est de 45 points seulement les points lors des périodes actives comptent.
    - Rasmus Dahlin
        - Actif du 7 octobre 2025 au 29 novembre = 35 points
        - Actif du 3 mars à la fin de la saison = 15 points
        - Son cumulatif sera de 50 points.
        - Son total réel est de 50 points ce qui correspond à mon cumulatif car j'ai été capable de synchroniser ses périodes d'activités
          avec les matchs qui l'a joués.

## Système que j'avais en tête si c'était possible
- À chaque jour de la saison régulière, selon l'exemple ci-haut, à partir de 7 octobre 2025, on stocke les gamelogs dans une table pour savoir qui a fait des points à quelle date.
- Chaque activation d'un joueur fait en sorte qu'on va regarder dans cette table à chaque jour si des points ce sont ajoutés pour ce joeur. Le total est calculé à chaque jour pendant l'activation. Une période d'activation par joueur est stockée dans une table avec une date (Jour/mois/année HH:MM) de début et une date de fin (Jour/mois/année HH::MM). Les HH:MM détermine si l'activation a été fait avant la première partie des joueurs concernés par la gestion d'effectif. Pour chaque période d'activation on a également le pooler associé évidemment car si des échanges, ballotage ou autre sont survenus, les périodes d'activation ne sont pas toujours associées au même pooler.
- Le total au classement pour un joueur par pooler correspond au total des points cumulés lors des périodes d'activations pour le joueur concerné. Comme les périodes d'activation on un pooler_Id associé et que les points sont récoltés à chaque jour. Avec les dates d'activation et de désactivation, il est supposé ne pas trop être compliqué de faire le suivi des points par périodes.
- Le système pour l'accumulation des points au classement général, n'a pas besoin d'être en direct, si on peut mettre à jour les points de chaque joueur, une fois par jour, à 4AM (par exemple) c'est acceptable.

## Réflexion sur la construction de la BD
- Pas certain du nombre de table que l'on doit avoir pour la BD.
- Ce que j'imaginais peut-être, une table qui contient les gamelogs, une table par pooler qui contient les changements (activation, désactivation, LTIR, Agent libre, etc ...) avec les périodes d'activation (date de début -> activated_at et une date de fin -> deactivated_at ) et le nombre de points ammassés (buts, passes pour les patineurs et victoires, défaites, blanchissage pour les gardiens) durant la période (lookup vers la table de gamaelog). Ainsi, pour un joueur avec un nhl_id, il peut y avoir plusieurs lignes dans la table mais avec des dates différentes
- Même si les gamelog de la saison courante seraient tous sauvegardés, à la fin de la saison, lorsqu'on a les totaux et qu'on transitionne vers la prochaine saison, les gamelogs ne seraient plus nécessaires puisqu'on aurait les totaux et donc un refresh pourrait être fait. Si ce n'est pa trop volumineux, on pourrait les garder (à évaluer pour peut-être monter un outil d'analyse de statisitique). En ayant le total et le classement final de la saison, on peut quand même garder l'historique de saison en saison pour voir la vue d'ensemble de qui a gagné et avec combien de points.

## Réflexion sur le fonctionnement actuel.
- J'ai l'impression que les erreurs surviennent car il y a trop d'éléments dynamique, ce qui induit des erreurs dans la logique par moment. Par exemple, ce n'est pas normal de se retrouvé avec des résultats négatifs.
- La connexion constante a l'API pour aller chercher les stats (à part pour le classement en direct) n'est pas nécessaire. J'ai l'impression qu'en ayant tous les gamelogs de tous les joueurs pendant la saison et en utilisant ça et en allant chercher les bonnes dates pour cumuler les points, ce serait moins compliqués