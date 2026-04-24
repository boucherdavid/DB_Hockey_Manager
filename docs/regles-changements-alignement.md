# Règles de changements d'alignement

Ce document décrit les règles métier encadrant les activations et désactivations de joueurs dans les rosters des poolers. Il sert de référence pour l'implémentation du Chantier B et des fonctionnalités connexes.

**Note :** Une fois chaque fonctionnalité implémentée, les règles correspondantes doivent être ajoutées dans la section Règlements de `/aide` (`app/app/aide/page.tsx`) pour que les poolers puissent s'y référer.

---

## Règles générales

### 1. Correction admin des dates
L'admin peut modifier rétroactivement la date/heure effective d'un changement (et donc du snapshot associé) pour corriger une erreur ou accommoder un pooler qui n'avait pas accès à l'application au bon moment.

### 2. Limite horaire pour les changements pooler
- La fenêtre de changement se ferme à l'heure du **premier match de la journée** impliquant l'un ou l'autre des joueurs concernés par le swap.
- Option simplifiée (si trop complexe) : fermeture à l'heure du **premier match de la journée**, toutes équipes confondues.
- Si la fenêtre est dépassée au moment de la soumission :
  - Le joueur encore actif **reste actif pour la journée** (ses stats comptent)
  - Le joueur entrant commence l'accumulation de points **le lendemain**
  - Les deux snapshots (désactivation / activation) sont pris **le lendemain**
- Un job planifié (ex. 2h AM) exécute les snapshots différés de la veille.

### 3. Fenêtre de changements active
Les changements d'alignement sont possibles tant que la saison en cours n'est pas clôturée et que la nouvelle saison n'est pas démarrée par l'admin. Une fois la transition de saison déclenchée (Chantier TRANSITION), les rosters sont figés pour la copie.

### 4. Période de gel après désactivation
- Durée configurable par l'admin (valeur globale, s'applique à tous les joueurs).
- Un joueur désactivé ne peut pas être réactivé avant la fin de cette période.
- Il n'apparaît pas comme sélectionnable dans l'interface pooler pendant le gel.
- S'applique aux joueurs en **réserviste** et en **banque de recrues**.
- **Ne s'applique pas à la LTIR** (règles distinctes, voir section suivante).
- L'admin peut outrepasser ce délai manuellement.
- Stocké séparément de `scoring_config`.

---

## LTIR

### 4. Conditions d'éligibilité
Un joueur peut être mis sur la LTIR si au moins une condition est remplie :
- Il est sur la IR ou LTIR de son équipe dans la vraie vie.
- Son absence est documentée comme étant de plus de 2 semaines.
- Il est absent "au jour le jour" depuis au moins 2 semaines.

Les conditions 1 et 3 ont un potentiel d'automatisation via NHL API (statut blessure, game logs). La condition 2 est subjective — gestion admin pour l'instant.

### 5. Processus de mise sur LTIR — Phase 1 (Option D)
Toute mise sur LTIR est soumise à **approbation admin** avant d'être effective. Le pooler soumet une demande, l'admin valide après vérification manuelle.

**Migration prévue vers Option C** (après consultation poolers) :
1. Vérification NHL API au moment de la demande (joueur sur IR/LTIR en vrai ?)
2. Fenêtre de 24h avant que le remplacement soit disponible
3. Si le joueur joue pendant ces 24h → LTIR annulé automatiquement, admin notifié
4. L'admin conserve un droit d'override manuel

### 6. Durée minimale LTIR
- Nombre de jours configurable (décidé entre poolers, ex. 21 jours).
- Le joueur ne peut pas être réactivé avant la date prévue.
- L'admin peut outrepasser manuellement pour les cas exceptionnels.
- Stocké séparément de `scoring_config`.

### 7. Options de remplacement d'un joueur sur la LTIR

**Option A — Réserviste disponible**
- Condition : le pooler a 3 réservistes ou plus.
- Un réserviste monte dans l'alignement actif.
- Le minimum de 2 réservistes reste respecté.

**Option B — Activation d'une recrue**
- Condition : le pooler a seulement 2 réservistes.
- Une recrue de la banque peut être activée (en actif ou en réserviste).
- **Exception protection recrue** : si la recrue est repêchée, encore protégée mais hors ELC, elle conserve le droit d'être remise dans la banque de recrues une fois la situation LTIR résolue. Cette option doit être clairement indiquée dans l'interface au moment de l'activation.

**Option C — Signature d'un agent libre**
- Condition : le pooler a seulement 2 réservistes.
- Compteurs configurables par l'admin, stockés séparément de `scoring_config` :
  - **Signatures libres** : X par saison, utilisables librement (valeur actuelle : 2)
  - **Signatures LTIR** : Y supplémentaires, réservées au contexte LTIR (valeur actuelle : 2, pour un total de 4)
- Les deux compteurs sont distincts et configurables indépendamment.

**Option D — Réclamation au ballotage**
- Condition : le pooler a seulement 2 réservistes.
- Dépendance : Chantier G (ballotage).

**Option E — Transaction avec un autre pooler**
- Le joueur reçu peut intégrer le roster conditionnel à la mise sur LTIR du joueur blessé.
- L'outil de transactions doit permettre de lier les deux opérations.

**Option F — Scénario multi-opérations**
- Exemple : agent libre + échange + mise sur LTIR en une seule transaction.
- Le TransactionBuilder doit supporter plusieurs ajustements simultanés dans une même soumission.

---

## Ballotage

### 8. Joueur libéré pour raison de performance
Quand un pooler libère un joueur (remplacement d'agent libre ou changement de performance), le joueur est automatiquement soumis au ballotage.

### 9. Processus de ballotage

**Notifications**
- Tous les poolers sont notifiés immédiatement (courriel + push) dès qu'un joueur est soumis.
- Chaque pooler déclare son intérêt ou son refus.

**Ordre de priorité**
- Avant le **1er novembre** (date paramétrable par l'admin) : ordre basé sur le classement final de la saison précédente, modifiable manuellement par l'admin.
- Après le **1er novembre** : ordre basé sur le classement au moment exact de la soumission au ballotage.
- Dans les deux cas : dernier au classement = première priorité.
- Le pooler qui soumet le joueur est exclu de la réclamation.

**Résolution**
- Dès que tous les poolers prioritaires ont refusé, le premier pooler ayant déclaré son intérêt obtient le joueur.
- Ce pooler dispose d'un délai configurable par l'admin (ex. 2 jours) pour ajuster son alignement.
- Sans action dans ce délai → il perd son droit, le suivant sur la liste intéressée prend le relais.

**Ajustements possibles lors d'une réclamation**
- Aucun ajustement si le pooler a l'espace sur sa masse salariale.
- Mettre un de ses joueurs au ballotage.
- Remettre une recrue de l'alignement dans la banque de recrues.
- Mettre un joueur éligible sur la LTIR.
- Tout autre changement documenté dans ce fichier.

### 10. Club école *(à valider avec les poolers avant implémentation)*
Alternative au ballotage standard : un pooler peut choisir d'envoyer un joueur dans son "club école" plutôt que de le libérer complètement.

**Fonctionnement**
- Le joueur passe quand même par le ballotage d'abord.
- Si personne ne le réclame → le joueur atterrit dans le club école du pooler.
- Le joueur est **hors cap** pendant son séjour au club école.
- Le pooler peut rappeler le joueur plus tard.

**Limites configurables par l'admin**
- Nombre maximum de joueurs dans le club école (ex. 3).
- Masse salariale maximale des joueurs dans le club école (ex. 20M$).

**À déterminer**
- Quand un joueur est rappelé du club école, repasse-t-il par le ballotage ou non ?

---

## Historique des changements et indicateurs pooler

### 11. Journalisation automatique
Chaque changement d'alignement est journalisé automatiquement dans l'historique. Le type de changement (activation, désactivation, signature agent libre, remplacement LTIR, etc.) est **détecté automatiquement** selon les conditions — le pooler n'a pas à le sélectionner.

### 12. Onglet historique sur la page pooler (`/poolers/[id]`)
Un onglet dédié affiche :
- Liste chronologique des changements (date, type détecté, joueur entrant/sortant)
- Indicateurs de restrictions actives (ex. "Joueur X gelé jusqu'au 2 mai")
- Compteurs de signatures d'agents libres restantes (ex. "1/2 libres · 2/2 LTIR")
- Visible par le pooler concerné et l'admin

Les transactions inter-poolers restent dans `/transactions` et n'apparaissent pas dans cet onglet.

---

## Notifications

### 13. Notifications admin
- L'admin est notifié de **tous** les changements sans exception.
- Une section `/admin/suivi` (boîte de messages chronologique) offre une vue d'ensemble de toute l'activité du pool.
- Canal : push + courriel.

### 14. Notifications poolers
**Obligatoire (non désactivable)**
- Joueur soumis au ballotage — implique une décision active, désavantage compétitif si manqué.

**Activées par défaut, désactivables par type dans les préférences du pooler**
- Agent libre signé par n'importe quel pooler (pour informer que le marché bouge).
- Transaction inter-poolers effectuée (même si le pooler n'est pas impliqué).

**Mise en évidence page d'accueil**
- Les mêmes événements sont mis en évidence sur `/` pour les poolers qui ne souhaitent pas de notifications push.

---

## Fonctionnalités planifiées (versions futures)

### Changements conditionnels *(à implémenter après stabilisation du Chantier B)*
Le pooler peut soumettre un changement conditionnel :
- Exemple : "Désactiver Y, activer X — conditionnel à ce que Y joue ce soir"
- Le système vérifie via NHL API si Y a effectivement joué après sa partie.
- Si Y a joué → swap exécuté avec snapshot au moment approprié.
- Si Y n'a pas joué → aucun changement, Y reste actif.
- Utile particulièrement pour les gardiens (partant souvent inconnu à l'avance).
- Nécessite une table `pending_roster_changes` et une résolution par le job de nuit.
- La règle de limite horaire (section 2) s'applique : le conditionnel doit être soumis avant la première partie de la journée.
