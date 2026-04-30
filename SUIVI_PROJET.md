# Suivi du projet Hockey Pool App

Derniere mise a jour: 2026-04-29

## Role du fichier

Ce fichier sert de memoire de travail entre nos sessions.
Je l'utiliserai pour:
- resumer l'etat courant du projet;
- noter les decisions importantes;
- consigner les modifications effectuees;
- lister les prochains chantiers et les points en suspens.

## Instantane actuel

- Le projet est organise en deux blocs:
  - `app/`: application Next.js 16 + React 19 + TypeScript + Tailwind 4
  - `python_script/`: scripts Python pour preparation/import des donnees
- La base de donnees ciblee est Supabase/PostgreSQL.
- Le dossier racine ne contient pas de depot git detecte a ce stade.
- Un fichier de contexte existe deja: `CLAUDE.md`.
- Des dependances installees sont presentes localement dans `app/node_modules/` et `python_script/venv/`.

## Structure utile

- `app/app/page.tsx`: page d'accueil, lecture de la saison active et de la liste des poolers
- `app/app/layout.tsx`: layout global avec `Navbar`
- `app/app/admin/page.tsx`: acces admin avec verification `is_admin`
- `app/lib/supabase/server.ts` et `app/lib/supabase/client.ts`: clients Supabase
- `python_script/scrape_puckpedia.py`: scraping PuckPedia
- `python_script/import_supabase.py`: import CSV vers Supabase
- `schema.sql`: schema de base de donnees

## Contraintes deja identifiees

- Next.js 16: utiliser `proxy.ts`, pas `middleware.ts`
- Supabase: le contexte existant mentionne l'usage de la legacy anon key
- RLS: une fonction `is_admin()` en `SECURITY DEFINER` est signalee comme sensible

## Resume fonctionnel actuel

- Pages publiques/utilisateur:
  - `/`
  - `/login`
  - `/joueurs`
  - `/poolers`
  - `/poolers/[id]`
  - `/dashboard`
- Pages admin:
  - `/admin`
  - `/admin/joueurs`
  - `/admin/joueurs/nouveau`
  - `/admin/joueurs/[id]`
  - `/admin/poolers`
  - `/admin/rosters`

## Journal des sessions

### 2026-04-29 (session 3)

**Chantier B — snapshots dans `submitTransactionAction` (commit)**
- `app/app/admin/transactions/actions.ts` : intégration complète des snapshots fire-and-forget à chaque changement de statut actif. Le `nhl_id` est maintenant inclus dans les rosters virtuels de validation. Couvre tous les types : `transfer`, `promote`, `sign`, `reactivate`, `release`, `type_change`.

**Type `ballotage` — réclamation sans contrepartie**
- `ActionType` étendu avec `'ballotage'` : même logique que `transfer` joueur (déplacement de roster + snapshots activation/désactivation).
- `TransactionBuilder.tsx` : bouton "Ballotage" orange à côté de "Donner" dans chaque liste de joueurs. Section dédiée dans le résumé de transaction.
- `TransactionsClient.tsx` : nouvel onglet "Ballotage" (fond orange) entre Échanges et Signatures, classification et description propres.

**Menu Admin accessible partout**
- `Navbar.tsx` : dropdown "Admin" avec badge bleu ajouté dans la barre desktop pour les admins. Accès direct aux 9 sous-menus : Transactions, Rosters, Recrues, Pré-saison, Joueurs, Poolers, Configuration, Suivi, Boîte de réception. Menu hamburger mobile étendu de même. Liens admin retirés du dropdown de profil (doublons).

**Tri par points dans le pool des séries**
- `app/app/series/page.tsx` : dans `ConfTable`, les joueurs de chaque groupe (F/D/G) sont maintenant triés par `poolPoints` décroissant — les plus performants apparaissent en premier.

---

### 2026-04-29 (suite)

**Page `/transactions` — onglets par type de mouvement**

Remplacement du split grossier Échanges/Ajustements par 5 onglets avec compteur badge :
- **Tous** — toutes les transactions
- **Échanges** — transactions contenant au moins un item `transfer`
- **Signatures** — transactions `sign`
- **LTIR** — transactions `reactivate` ou `type_change` impliquant ltir
- **Gestion** — le reste (`promote`, `release`, `type_change` autres)

Couleurs par type : bleu (échanges), vert (signatures), ambré (LTIR), gris (gestion). Dans l'onglet Tous, chaque carte est colorée selon son type classifié.

Fichiers modifiés :
- `app/app/transactions/TransactionsClient.tsx` : nouveau composant client avec les onglets, logique de classification et rendu des cartes.
- `app/app/transactions/page.tsx` : simplifié au fetch Supabase uniquement, délègue à `TransactionsClient`.

**Nettoyage `docs/brainstorm.md`**
- Les deux idées (Chantier I — fiche joueur, Chantier J — classement en direct) retirées du brainstorm, déjà intégrées à la feuille de route.

---

### 2026-04-29

**Classement mobile — vue simplifiée**
- `app/app/classement/ClassementTable.tsx` : section "Détail par pooler" masquée sur mobile (`hidden sm:block`). Le `SummaryTable` suffit sur mobile (rang + nom + PTS).
- `app/components/SummaryTable.tsx` : converti en composant client. Toute la ligne du tableau est maintenant cliquable sur mobile (`onClick` → `router.push(/poolers/[id])`). Feedback tactile `active:bg-gray-100`.

**Calendrier LNH — refonte complète (`/calendrier`)**

Remplacement de la vue semaine + calendrier mensuel par deux onglets :

- **Onglet Matchs** (défaut) : vue journée avec navigation ← / Aujourd'hui / →, date picker, affichage de tous les matchs NHL du jour avec badges joueurs actifs. Navigation client-side dans la semaine chargée, URL (`?jour=YYYY-MM-DD`) uniquement aux frontières de semaine. Toggle Saison/Séries si pool des séries actif.
- **Onglet Analyse** : sélecteur d'horizon 2J–7J avec plage de dates affichée, filtre par type (Tous / Actifs / Réservistes / Recrues), grille de tous les joueurs de l'organisation triés par matchs dans l'horizon. Code couleur vert (5+), bleu (3-4), gris (1-2), pâle (0).

Fichiers modifiés :
- `app/app/calendrier/page.tsx` : `?jour=` remplace `?semaine=`, fetch 3 semaines (jour courant + today + today+7). Construit `schedule7` (7 jours depuis aujourd'hui) pour l'onglet Analyse. Fetch `allOrgPlayers` (actifs + réservistes + recrues) ; `myRoster` dérivé côté serveur.
- `app/app/calendrier/CalendrierClient.tsx` : réécriture complète avec les deux onglets.
- `app/app/calendrier/actions.ts` : supprimé (vue calendrier mensuel retirée).

**Idées ajoutées à la feuille de route**
- **Chantier I — Fiche joueur** : panneau slide-over accessible partout dans le site au clic sur un nom de joueur. Stats de carrière via `api-web.nhle.com/v1/player/{nhl_id}/landing`. Dépend de Chantier B (nhl_id intégré).
- **Chantier J — Classement en direct** : section page d'accueil avec revalidation 15 min (`revalidate: 900`), optionnellement `router.refresh()` toutes les 15 min côté client. Dépend de Chantier B.

**Constat — Chantier B déjà complet**
Tout le code du Chantier B est en place depuis une session précédente non documentée. La séquence en cours est donc à l'étape 3 (saisie des transactions historiques).

**Analyse — module transactions et préparation saisie historique**

Problème identifié : `submitTransactionAction` modifie les `pooler_rosters` mais **ne prend aucun snapshot**. Seul `admin/rosters/actions.ts` le fait. Les transactions saisies via `TransactionBuilder` (échanges, signatures, libérations) ne génèrent donc pas de snapshots → calcul de points par période incorrect pour ces mouvements.

Amélioration identifiée pour la page publique `/transactions` : découpage en onglets par type de mouvement au lieu du split grossier Échanges/Ajustements actuel :
- **Échanges** : `transfer` entre poolers (joueurs ou picks)
- **Signatures** : `sign` (agents libres)
- **LTIR** : `reactivate` + `type_change` impliquant ltir
- **Gestion de joueurs** : `promote`, `release`, `type_change` (autres)
- **Ballotage** : futur

**Snapshots dans `submitTransactionAction` — complété**

`app/app/admin/transactions/actions.ts` :
- `nhl_id` ajouté à la query roster et à la query `signPlayerMap`.
- `VEntry` enrichi avec `nhl_id: number | null`.
- `SnapshotTask` type ajouté (playerId, nhlId, poolerId, snapshotType).
- Collecte des tâches pendant la simulation : snapshot `activation` quand un joueur **devient actif**, snapshot `deactivation` quand il **quitte actif**, pour chaque `action_type` (`transfer`, `promote`, `sign`, `reactivate`, `release`, `type_change`).
- Exécution fire-and-forget après l'apply (ne bloque pas la réponse).
- Import de `takeSnapshot` depuis `@/lib/snapshot`.
- Paramètre `season` inutilisé retiré de `validateFinalRoster`.

---

### 2026-04-28 (suite 2)

**Chantier C — Page Calendrier LNH (`/calendrier`)**

Fichiers créés/modifiés :
- `app/app/calendrier/page.tsx` : server component. Fetch parallèle : semaine de navigation + 2 semaines pour l'analyse 7 jours. Calcul `next7Days: Record<teamCode, count>`. Roster actif du pooler connecté.
- `app/app/calendrier/CalendrierClient.tsx` : client component complet.
  - **Vue semaine** (défaut) : navigation prev/next semaine, filtre équipe (liste complète 32 équipes), badges joueurs actifs sur chaque match.
  - **Vue calendrier mensuel** : activée via toggle quand un filtre équipe est sélectionné. Charge la saison complète via server action (`club-schedule-season/{abbrev}/{saison}`). Grille 7 colonnes (lun–dim), score final avec indicateur V/D, heure si à venir, indicateur "En cours". Cellules du pooler connecté surlignées en bleu.
  - **Sélecteur de date** : `<input type="date">` — navigue à la semaine (vue semaine) ou au mois (vue calendrier).
  - **Section analyse** : bloc bleu affiché si roster non vide — une carte par joueur actif avec badge équipe, nom, position, nombre de matchs dans les 7 prochains jours (code couleur vert ≥4, bleu ≥2, gris 0).
- `app/app/calendrier/actions.ts` : server action `fetchTeamSeasonSchedule(abbrev)` → `api-web.nhle.com/v1/club-schedule-season`, cache 5 min.
- `app/components/Navbar.tsx` : lien "Calendrier" ajouté desktop (entre Repêchage et Pool Séries) et mobile (section Autre).

---

### 2026-04-28 (suite)

**Pool des séries — verrouillage des choix après comptabilisation**

Migration SQL exécutée :
```sql
ALTER TABLE playoff_seasons ADD COLUMN IF NOT EXISTS picks_locked BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE playoff_seasons SET picks_locked = TRUE WHERE scoring_start_at IS NOT NULL;
```

Comportement :
- Démarrage comptabilisation (`startScoringAction`) → `picks_locked = true` automatiquement.
- Avancement de ronde (`advanceRoundAction`) → `picks_locked = false` + `scoring_start_at = null` (réouverture auto pour la nouvelle ronde).
- `savePicksAction` : bloque avec message d'erreur si `picks_locked = true`.
- `togglePicksLockAction` : action admin pour basculer le verrou manuellement.
- `PicksManager` : bannière ambre + bouton "Modifier" masqué quand verrouillé.
- `SeriesAdmin` : bouton "Rouvrir les choix" / "Verrouiller les choix" visible dès que la comptabilisation est démarrée.

---

### 2026-04-28

**Suivi de l'activité — lien navbar + filtres**
- `Navbar.tsx` : lien "Suivi de l'activité" ajouté dans le dropdown profil (desktop) et menu hamburger (mobile), admin uniquement, juste sous "Boîte de réception".
- `admin/suivi/SuiviTable.tsx` (nouveau) : composant client avec onglets Tous / Alignement / Transaction / Séries (avec compteurs) et sélecteur de période 7j / 30j / Tout. Défaut : 30 derniers jours, tous types.
- `admin/suivi/page.tsx` : simplifié, délègue l'affichage et le filtrage à `SuiviTable`.

**Bugfix pipeline — FK violation `playoff_rosters` dans `_merge`**
- `import_supabase.py` : ajout de `playoff_rosters` dans `_merge()` avant la suppression du doublon. Évite la violation de contrainte FK quand un doublon est référencé dans le pool des séries.

**Idées traitées depuis brainstorm.md (2026-04-28) :**
- Suivi de l'activité dans le menu → implémenté
- Filtres par type et par date dans le suivi → implémenté

---

### 2026-04-26 (suite 2)

**Statistiques LNH — mode Séries adapté au pool des séries**

En mode "Séries", la colonne indicateur de disponibilité est remplacée par les initiales des poolers participants qui ont sélectionné ce joueur (plusieurs badges possibles, car plusieurs poolers peuvent choisir le même joueur). Le filtre "Disponibles" devient "Libres" (joueurs non sélectionnés par aucun participant). Le badge Recrue est masqué en mode séries. Le mode saison régulière est inchangé.

Fichiers modifiés :
- `app/app/statistiques/page.tsx` : ajout de `fetchPlayoffPicksMap()` — query `playoff_rosters` de la saison playoffs active, retourne `Record<string, string[]>` (nom normalisé → liste de poolers). Appelé uniquement en mode séries.
- `app/app/statistiques/StatsTable.tsx` : nouveau composant `PoolerBadges`, prop optionnel `playoffPicksMap`, logique `isAvailable`/`getPickedBy` adaptée selon le `gameMode`.

**Bug Jérôme — notifications push non reçues**

Subscription confirmée en BD (endpoint FCM valide). Cause probable : paramètres Android bloquant les notifications pour l'app PWA (canal de notification de l'app installée désactivé dans les réglages Android). Étapes suggérées à Jérôme : Paramètres → Applications → Chrome/DB Hockey Manager → Notifications → activer, et retirer l'app de l'optimisation de batterie.

---

### 2026-04-26 (suite)

**Navbar — Boîte de réception admin avec badge**
- `app/app/layout.tsx` : fetch du count de messages `nouveau` pour les admins, passé comme `initialUnreadCount` au Navbar.
- `app/components/Navbar.tsx` : lien "Boîte de réception" ajouté dans le dropdown profil (desktop) et le menu hamburger (mobile), visible uniquement pour les admins. Badge rouge affiche le nombre de messages non lus.

**Boîte de réception — bouton "Copier ce message" par carte**
- `FeedbackAdminView.tsx` : chaque carte a maintenant un bouton qui copie le type, pooler, date et description dans le presse-papier pour faciliter le transfert vers Claude.

**Fix — Suivi de l'activité : soumissions séries manquantes**
- Cause : `playoff_rosters` n'avait pas de colonne `created_at` — la requête retournait vide silencieusement.
- Migration SQL exécutée : `ALTER TABLE playoff_rosters ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();`
- `admin/suivi/page.tsx` : requête corrigée (sans FK hint, filtre `created_at not null`). Les soumissions futures apparaîtront correctement dans le fil d'activité.

**Fix — Cache bracket NHL réduit à 5 minutes**
- `series/picks/page.tsx` : `revalidate: 3600` → `revalidate: 300`. Les équipes éliminées sont retirées du sélecteur au plus tard 5 min après la mise à jour de l'API NHL.

**Notification push — soumission retour pooler**
- `app/signaler/actions.ts` : push aux admins quand un pooler soumet un bug, suggestion ou commentaire (nom du pooler + type + 80 premiers caractères).

---

### 2026-04-26

**Boîte de réception — refonte du flux de traitement des retours poolers**

Migration SQL exécutée dans Supabase :
```sql
ALTER TABLE feedback DROP CONSTRAINT feedback_status_check;
ALTER TABLE feedback ADD CONSTRAINT feedback_status_check
  CHECK (status IN ('nouveau', 'traité', 'archivé'));
UPDATE feedback SET status = 'traité' WHERE status IN ('lu', 'résolu');
```

Fichiers supprimés : `docs/retours-bruts.md` et `docs/retours-poolers.md` — remplacés par le flux dans l'app.

`app/app/admin/feedback/actions.ts` (nouveau) :
- `updateFeedbackStatusAction(id, status)` — change le statut d'un message.
- `deleteFeedbackAction(id)` — supprime définitivement un message (avec confirmation UI).

`app/app/admin/feedback/FeedbackAdminView.tsx` (réécrit) :
- 4 onglets : Nouveau / Traité / Archivé / Tous, avec compteur par onglet.
- Boutons par message selon le statut : Marquer traité, Rouvrir, Archiver, Supprimer.
- Export .md et Copier s'appliquent uniquement aux messages visibles (filtre actif).
- Bordure colorée par statut : bleu = nouveau, vert = traité, gris = archivé.

`app/app/admin/feedback/page.tsx` : renommé "Boîte de réception", affiche le sous-titre avec le nombre de nouveaux.

`app/app/admin/page.tsx` : carte renommée "Boîte de réception" + badge rouge avec le nombre de messages nouveaux.

**Workflow documentaire recommandé :**
1. Notification push reçue → ouvrir `/admin/feedback`.
2. Lire et traiter le message (code, note, réponse).
3. Cliquer "Marquer traité".
4. Pour les bugs réglés → documenter dans `SUIVI_PROJET.md`.
5. Périodiquement → archiver les messages traités.

---

### 2026-04-25 (suite 2)

**Bugfix — Activation notifications impossible pour les poolers non-admins**

Symptôme rapporté par Jérôme : `new row violates row-level security policy for table "push_subscriptions"` en tentant d'activer les notifications.

Cause : la table `push_subscriptions` avait été créée avec une policy RLS admin-only. Les poolers ordinaires ne pouvaient pas insérer leur propre abonnement.

Correction dans `app/app/compte/push-actions.ts` : utilisation de `createAdminClient()` dans `subscribePushAction`, `unsubscribePushAction` et `getSubscriptionStatusAction`. L'authentification de l'utilisateur est vérifiée avant chaque opération — le bypass RLS est sûr dans ce contexte serveur.

---

### 2026-04-25 (suite)

**Chantier H — Notifications push + page /admin/suivi**

`app/lib/push.ts` :
- `sendPushToAdmins` corrigé : filtre maintenant par `is_admin = true` (bug : envoyait à tous les abonnés).
- `sendPushToUser(userId, payload)` : nouvelle fonction pour envoyer un push ciblé à un pooler spécifique.
- Refactorisé avec helper interne `sendToSubscriptions` pour éviter la duplication.

`app/app/admin/rosters/actions.ts` :
- `addPlayerAction` → push pooler : "Dupont, Jean ajouté (actif)".
- `removePlayerAction` → push pooler : "Dupont, Jean retiré de votre alignement".
- `changeTypeAction` → push pooler : "Dupont, Jean : actif → LTIR".
- `submitRosterAction` → push synthèse : "L'admin a modifié votre alignement : 2 ajouts, 1 retrait".
- Les push sont fire-and-forget (`.catch(() => {})`) — ne bloquent jamais l'action principale.

`app/app/admin/suivi/page.tsx` (nouveau) :
- Fil d'activité chronologique pour l'admin.
- Trois sources : `roster_change_log` (100 derniers), `transactions` (50 dernières), `playoff_rosters` (100 derniers picks, regroupés par session pooler+ronde+minute).
- Tableau avec colonnes Date / Catégorie (point coloré) / Pooler / Action (badge) / Détail.
- Lien ajouté dans `admin/page.tsx`.

**Notifications pool des séries ajoutées dans `app/app/series/actions.ts` :**
- `advanceRoundAction` → push général à tous : "Ronde X démarrée — soumettez vos nouveaux choix !" + push ciblé aux poolers dont un pick est d'une équipe éliminée : "Action requise — mettez à jour vos choix".
- `startScoringAction` → push général à tous : "La comptabilisation des points de la ronde X est démarrée !".
- `lib/push.ts` : ajout de `sendPushToAll(payload)` pour les envois à tous les abonnés.

**Page `/aide` mise à jour :**
- Guide — Pool des séries : détection automatique des picks éliminés décrite (blocage de sauvegarde), participation optionnelle mentionnée.
- Règlements — Pool des séries : participation optionnelle ajoutée, blocage automatique décrit.
- Guide — Notifications : nouvelle section (activation par appareil, liste des 4 événements couverts).

**Règle métier notée :** La participation au pool des séries est optionnelle — tous les poolers ne participent pas nécessairement. Les notifications séries ciblent uniquement les poolers avec des picks actifs dans la saison playoffs courante.

**Ce qui reste pour Chantier H (phases futures) :**
- Préférences de notification par pooler (opt-out par type).
- Notifications poolers pour ballotage (bloquant, quand ballotage sera codé).
- Canal courriel en complément du push.

---

### 2026-04-25

**Pool des séries — Blocage des picks d'équipes éliminées**

Quand la comptabilisation n'est pas encore démarrée (`scoring_start_at = null`) et qu'une série est terminée, les joueurs des équipes éliminées sont désormais détectés et bloqués.

Comportement :
- Si un pick existant appartient à une équipe éliminée : mode édition forcé à l'ouverture + banner rouge + joueur barré avec badge "Éliminé" dans le panel + bouton Sauvegarder désactivé.
- Validation serveur dans `savePicksAction` : fetch du bracket NHL API, vérification de chaque joueur soumis — si un appartient à une équipe éliminée, la sauvegarde échoue avec message d'erreur.
- Le filtre UI existant (sélecteur de joueurs limité aux équipes actives) reste inchangé.

Fichiers modifiés :
- `app/app/series/picks/page.tsx` : ajout de `scoring_start_at` dans la query + prop `scoringStarted` passée.
- `app/app/series/picks/PicksManager.tsx` : calcul `eliminatedIds`, banner, mise en évidence dans `RosterPanel`, blocage de sauvegarde.
- `app/app/series/actions.ts` : validation côté serveur via bracket NHL.

---

### 2026-04-24 (suite)

**Bugfix — Doublons joueurs lors d'un changement d'équipe (`import_supabase.py`)**

Symptôme : `run_pipeline.py` créait 6 nouveaux enregistrements (ids 2508-2513 : Cam Fowler, Joonas Korpisalo, Jason Dickinson, Connor Ingram, Erik Karlsson, Nate Schmidt) pour des joueurs ayant changé d'équipe, puis `backfill_nhl_ids.py` échouait avec une violation de contrainte UNIQUE sur `nhl_id` (le bon enregistrement avait déjà un `nhl_id`).

Cause racine : le lookup utilisait `nom|équipe` comme clé primaire. Si l'équipe avait changé entre deux imports, aucun match → insertion d'un nouveau record. Le dict `existing_by_name` (par nom seul) était construit mais jamais utilisé.

Corrections apportées dans `python_script/import_supabase.py` :
- **Lookup (prévention)** : ajout d'un 3e fallback via `existing_by_name` quand ni `nom+équipe` ni `nom+null` ne matchent. Si un seul joueur porte ce nom en BD (non-ambigu), on met à jour au lieu d'insérer. La clé est aussi ajoutée à `existing_map` pour que la boucle contrats suive correctement.
- **`deduplicate_players` Cas 3 (nettoyage)** : détecte les paires avec le même nom, équipes différentes, un seul `nhl_id` → le record sans `nhl_id` est le doublon, fusionné dans l'autre. Nettoie les 6 doublons existants au prochain run.
- **`_merge`** : ajout de `roster_change_log` et `player_stat_snapshots` aux tables réassignées lors d'une fusion (évite les références orphelines vers les nouvelles tables).

Les homonymes (ex: deux Sebastian Aho avec deux `nhl_id` distincts) ne sont pas affectés : `len(existing_by_name[key]) > 1` → pas de fallback.

**Documentation maintenance**
- Nouveau fichier `docs/maintenance.md` : ordre des scripts Python, description de chaque étape, procédure SQL, tableau résumé.

---

### 2026-04-24

**Documentation — Règles métier et templates**
- Nouveau fichier `docs/regles-changements-alignement.md` : règles complètes des changements d'alignement (limite horaire, gel post-désactivation, LTIR, ballotage, club école, journalisation, notifications).
- Nouveau dossier `docs/templates/` + `invitation-pool-series.md` : template courriel d'invitation au pool des séries.
- Chantier H (Notifications + Suivi admin) ajouté à la feuille de route.
- Chantier G (Ballotage) enrichi avec les règles de processus et de priorité.

**Supabase — nouvelles tables**
- `player_stat_snapshots` : confirmée déjà existante (créée session précédente).
- `roster_change_log` : créée (player_id, pooler_id, pool_season_id, change_type, old_type, new_type, changed_at, changed_by). RLS activé.

**Chantier B — Classement + points saison (complété)**

Étape 1 — `app/lib/nhl-snapshot.ts` :
- `fetchPlayerStatsById(nhlId, gameType)` via `api-web.nhle.com/v1/player/{id}/landing`.
- Retourne `{ goals, assists, goalie_wins, goalie_otl, goalie_shutouts }` ou zéros si indisponible.

Étape 2 — `app/lib/snapshot.ts` :
- `takeSnapshot({ playerId, nhlId, poolerId, poolSeasonId, snapshotType, takenAt })` : fetch NHL + insert Supabase.
- `takeSeasonEndSnapshots(poolSeasonId)` : snapshot `season_end` pour tous les actifs.

Étape 3 — Journalisation automatique dans `roster_change_log` :
- `detectChangeType(oldType, newType, isRemoval)` : type détecté automatiquement.
- Types supportés : `activation`, `deactivation`, `ajout_reserviste`, `ajout_recrue`, `retrait`, `ltir`, `retour_ltir`, `changement_type`, `signature_agent_libre`.

Étape 4 — `app/app/admin/rosters/actions.ts` :
- Snapshots + journalisation intégrés dans `addPlayerAction`, `removePlayerAction`, `changeTypeAction`, `submitRosterAction`.
- `changed_by = null` (admin); champ prévu pour self-service pooler futur.

Étape 5 — `app/lib/standings.ts` refactorisé :
- Calcul par snapshots : points = Σ(deactivation − activation) par période.
- Période ouverte (joueur encore actif) : stats NHL actuelles − dernier snapshot d'activation.
- Fallback stats brutes si aucun snapshot d'activation (joueurs activés avant le système).
- `app/lib/nhl-stats.ts` : ajout de `fetchNhlSkatersByNhlId()` et `fetchNhlGoaliesByNhlId()` (map par nhl_id). Refactorisé pour éviter la duplication de code.

Étape 6 — `app/app/poolers/[id]/PoolerPageTabs.tsx` :
- Troisième onglet "Historique" ajouté.
- Compteurs agents libres (libres / LTIR) avec limites affichées.
- Tableau chronologique des changements avec badge coloré par type.
- `page.tsx` : query `roster_change_log` ajoutée et passée en props.

Étape 7 — `app/app/admin/config/SeasonEndSync.tsx` :
- Bouton admin avec confirmation, appel `seasonEndSyncAction`, affichage résultat (count + erreurs).
- `seasonEndSyncAction` ajoutée dans `admin/config/actions.ts`.
- Intégré dans `admin/config/page.tsx` (colonne droite, sous ScoringConfig).

**Prochaine étape**
- **AVANT les prochains chantiers** : amélioration pool des séries (voir ci-dessous).
- Étape 3 de la séquence : saisie manuelle des transactions historiques 2025-26 via l'interface existante.
- Valider que les rosters correspondent à la réalité de fin de saison.

**Modification pool des séries à faire en priorité**
Quand la comptabilisation des points d'une ronde n'est pas encore commencée ET qu'une série est terminée, les joueurs des deux équipes éliminées doivent devenir indisponibles pour la ronde en cours. Les poolers ayant déjà sélectionné un de ces joueurs doivent obligatoirement ajuster leur choix.
- Détecter les équipes éliminées via l'API NHL (bracket playoffs).
- Filtrer les joueurs disponibles dans le sélecteur de la ronde active.
- Afficher un avertissement aux poolers concernés et bloquer la sauvegarde si un joueur éliminé est encore dans leur sélection.

### 2026-04-23 (suite)

**Étape 1 — Scoring config (complétée)**
- Table `scoring_config` confirmée existante en Supabase avec 6 stats : goal, assist, goalie_win, goalie_otl, goalie_shutout, gwg.
- UI `ScoringConfig.tsx` et action `updateScoringAction` déjà en place — rien à coder.
- `schema.sql` mis à jour pour documenter la table et ses données initiales.

**Préalable Chantier B — nhl_id sur players**
- Décision : ajouter `nhl_id INTEGER UNIQUE` sur la table `players` pour un matching fiable (vs matching par nom).
- Migration SQL exécutée dans Supabase : `ALTER TABLE players ADD COLUMN IF NOT EXISTS nhl_id INTEGER UNIQUE`.
- `schema.sql` mis à jour.
- Nouveau script `python_script/backfill_nhl_ids.py` : utilise l'API stats NHL (même source que `nhl-stats.ts`) — 2 appels bulk au lieu d'un appel par joueur.
- Résultat du backfill : 639 nhl_id enregistrés, 7 doublons détectés (joueurs échangés) et fusionnés via SQL, 354 sans match (prospects/blessés — se rempliront au premier match LNH).
- `run_pipeline.py` : étape 4 ajoutée (`backfill_nhl_ids.py`, optionnelle — ne bloque pas le pipeline).
- `import_supabase.py` : ajout de la logique `is_available = False` pour les joueurs absents du run courant (rachetés, retraités, salaires retenus).
- `series/picks/page.tsx` : filtre `.eq('is_available', true)` ajouté sur la requête players.

**Prochaine étape — Chantier B (à reprendre)**
- Créer table `player_stat_snapshots` dans Supabase (SQL prêt, non encore exécuté) :
  ```sql
  CREATE TABLE player_stat_snapshots (
    id SERIAL PRIMARY KEY,
    player_id INTEGER NOT NULL REFERENCES players(id),
    pooler_id UUID NOT NULL REFERENCES poolers(id),
    pool_season_id INTEGER NOT NULL REFERENCES pool_seasons(id),
    snapshot_type VARCHAR(20) NOT NULL CHECK (snapshot_type IN ('activation', 'deactivation', 'season_end')),
    taken_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    goals INTEGER NOT NULL DEFAULT 0,
    assists INTEGER NOT NULL DEFAULT 0,
    goalie_wins INTEGER NOT NULL DEFAULT 0,
    goalie_otl INTEGER NOT NULL DEFAULT 0,
    goalie_shutouts INTEGER NOT NULL DEFAULT 0
  );
  ALTER TABLE player_stat_snapshots ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "lecture publique snapshots" ON player_stat_snapshots FOR SELECT USING (true);
  CREATE POLICY "admin modifie snapshots" ON player_stat_snapshots FOR ALL
    USING (EXISTS (SELECT 1 FROM poolers WHERE id = auth.uid() AND is_admin = true));
  ```
- Puis : capture de snapshot dans `submitTransactionAction` lors des changements actif/désactivation.
- Puis : mise à jour de `buildStandings()` pour utiliser les deltas snapshot.

### 2026-04-23

- Sécurité : suite à la brèche Vercel du 19 avril 2026, vérification des variables d'environnement locales (`app/.env.local`, `python_script/.env`) — non commitées, donc non exposées via git.
- Sécurité : email Supabase signalant RLS désactivé sur `transactions` et `transaction_items` (tables créées en avril 2026 sans activation du RLS).
- Correction : RLS activé sur les deux tables via SQL Editor Supabase (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`).
- Les policies de lecture publique et d'écriture admin existaient déjà.
- `schema.sql` mis à jour pour refléter l'état réel (RLS + policies déplacés dans la section sécurité).
- Nouvelle page `/aide` créée avec 3 onglets : Installation PWA (ordinateur, iPhone, Android), Guide d'utilisation (Mon équipe, Pool des séries, Classement, Transactions, Statistiques LNH), Règlements (alignement, cap, recrues, transactions, séries).
- Barre de recherche transversale : recherche sur l'ensemble du contenu de la page, affiche les résultats de tous les onglets avec une étiquette indiquant la section source.
- Lien « Aide & Règlements » ajouté dans le dropdown profil de la Navbar (desktop + mobile).
- Note de maintenance ajoutée dans `CLAUDE.md` : évaluer une mise à jour de `/aide` lors de chaque ajout de fonctionnalité pooler.
- Confirmé : nom de connexion (email) et nom d'affichage dans le classement (`poolers.name`) sont indépendants — déjà en place.
- Confirmé : Pool des séries non bloqué par le Chantier B — utilise les stats NHL API en temps réel.
- Correction pool des séries : filtre `years_remaining > 0` remplacé par `years_remaining == null || years_remaining > 0` — les contrats en fin de saison avec `years_remaining = null` n'étaient plus visibles dans le sélecteur.
- Onglet Alignement dans `/poolers/[id]` : placeholder remplacé par la vraie table MJ/B/A/V/DP/BL/PTS via `buildStandings()`, symétrique avec la vue détail du classement.
- Page `/aide` refaite en 3 onglets (Installation / Guide d'utilisation / Règlements) avec barre de recherche transversale — composant client `AideTabs.tsx`.
- Guide d'utilisation complété : Mon équipe, Pool des séries, Classement, Transactions, Statistiques LNH.
- Règlements : plafond salarial précisé — cap fixé et ajustable par l'admin.
- Idée future notée dans la feuille de route (Chantier A) : indicateurs joueurs dans Organisation et Alignement — joue ce soir, statut blessure, séquence chaude/froide (game-log NHL API, seuil N configurable selon feedback poolers).
- Rotation des clés Supabase non effectuée : projet non affecté par la brèche Vercel confirmé (aucun email reçu).

### 2026-04-01

- Prise de connaissance initiale du projet.
- Verification de la structure generale du depot.
- Constat: pas de depot git detecte a la racine.
- Creation de `SUIVI_PROJET.md` pour centraliser le contexte de travail et le suivi des modifications.
- Rapatriement du contenu utile de `C:\Users\david\OneDrive\Bureau\Projet_Python\PuckPedia_Update\` vers `python_script/`.
- Nouvelle organisation Python:
  - `source/` pour les CSV d'entree
  - `diagnostics/` pour les HTML de debug
  - `teams_offline/` pour les exports par equipe
  - `archive/legacy/` pour les anciens scripts et sorties conserves en reference
- Ajout de `python_script/README.md`, `python_script/requirements.txt` et `python_script/scrape_puckpedia.py`.
- Duplication des scripts vers des noms plus explicites:
  - `scrape_puckpedia.py` pour le scraping
  - `import_supabase.py` pour l'import Supabase
- Deplacement du projet hors de OneDrive vers `C:\Projet_Codex\Hockey_Pool_App`.
- Suppression des anciens scripts Python redondants (`main_BS.py`, `upload_supabase.py`, `archive/legacy/*.py`) dans le nouveau dossier.
- Correction de la logique des doublons dans `python_script/import_supabase.py`:
  - les doublons sont regroupes par joueur PuckPedia quand le lien joueur peut etre retrouve dans `diagnostics/`, ce qui evite de fusionner de vrais homonymes comme les deux Sebastian Aho;
  - on privilegie la ligne de l'equipe actuelle quand elle est connue via l'API NHL;
  - on somme les fragments de contrat quand ils correspondent a une retention salariale et que cela reproduit le `Cap Hit` de la page joueur PuckPedia;
  - on conserve seulement la ligne principale quand les doublons ressemblent plutot a un buyout ou a des lignes non additives.
- Validation locale des cas sensibles:
  - Erik Karlsson -> `11 500 000`
  - Seth Jones -> `9 500 000`
  - Matt Duchene -> `4 500 000`
  - Oliver Ekman-Larsson -> `3 500 000`
  - les deux Sebastian Aho restent distincts.
- Reimport complet vers Supabase execute avec succes depuis `python_script/import_supabase.py`:
  - `1591` joueurs mis a jour;
  - `4824` contrats upserted.

## Prochains sujets possibles

- valider visuellement dans l'application quelques cas de retained salary et de buyout apres le reimport;
- auditer plus finement certains doublons atypiques encore detectes lors de l'import complet;
- gestion admin des échanges de choix de repêchage (modifier `current_owner_id` dans `pool_draft_picks`) — sera couvert par le chantier 3 (transactions).

## Regle de maintenance

Lors de chaque modification importante, ajouter ici:
- la date;
- ce qui a ete change;
- les fichiers principaux touches;
- les decisions prises;
- les points a reprendre plus tard.

### 2026-04-03 (session 2)

- Refonte des regles d'alignement pour correspondre aux contraintes du pool.
- La structure du roster est maintenant:
  - `actif`
  - `reserviste`
  - `recrue` (banque de recrues seulement)
- Les contraintes d'alignement actif sont explicites:
  - `12` attaquants
  - `6` defenseurs
  - `2` gardiens
- La masse salariale compte uniquement les joueurs `actif` et `reserviste`.
- La banque de recrues n'entre pas dans la masse salariale.
- Un joueur recrue peut tout de meme etre place comme `actif` ou `reserviste`; dans ce cas, il compte bien dans la masse salariale.
- Les anciennes entrees `agent_libre` sont normalisees en `reserviste` dans l'affichage et les calculs.
- Fichiers principaux ajustes:
  - `app/app/admin/rosters/RosterManager.tsx`
  - `app/app/poolers/[id]/page.tsx`
  - `app/app/admin/poolers/page.tsx`

### 2026-04-03 (session 3)

Correction des points d'attention identifies lors de l'analyse initiale:

1. **Saison NHL hardcodee** (`python_script/import_supabase.py`):
   - Ajout d'une constante `NHL_SEASON = '20252026'` en haut du fichier.
   - La variable locale `saison = '20242025'` dans `charger_rosters_nhl()` utilise desormais cette constante.
   - Pour la prochaine saison, modifier uniquement `NHL_SEASON`.

2. **Contrainte CHECK `agent_libre`** (`schema.sql`):
   - Le CHECK sur `pooler_rosters.player_type` est corrige: `'agent_libre'` remplace par `'reserviste'`.
   - Une migration SQL commentee est ajoutee dans `schema.sql` (section MIGRATIONS) pour mise a jour de la base existante dans Supabase.
   - A executer manuellement dans le SQL Editor Supabase.

3. **Validation serveur du RosterManager**:
   - Creation de `app/app/admin/rosters/actions.ts` (Server Actions Next.js).
   - Les trois mutations (ajout, retrait, changement de type) passent desormais par le serveur.
   - Les regles metier (limite recrue, limites positionnelles 12F/6D/2G) sont verifiees cote serveur avant ecriture en base.
   - Le RosterManager conserve la validation cote client pour le feedback immediat (UX), mais le serveur est l'arbitre final.

4. **Error Boundary**:
   - Creation de `app/components/ErrorBoundary.tsx` (composant de classe React).
   - Applique sur `app/app/admin/rosters/page.tsx` autour du `RosterManager`.

5. **Fichiers morts supprimes**:
   - `app/app/admin/joueurs/PlayerActions.tsx` (non importe nulle part depuis la desactivation des routes manuelles).
   - `app/app/admin/joueurs/PlayerForm.tsx` (idem).
   - Les routes `/admin/joueurs/nouveau` et `/admin/joueurs/[id]` redirigent toujours vers `/admin/joueurs` et sont conservees comme filets de securite.

### 2026-04-03 (session 4)

Bug: contrainte CHECK en base (`pooler_rosters_player_type_check`) pas encore migree dans Supabase.
- La migration SQL est documentee dans `schema.sql` (section MIGRATIONS).
- A executer manuellement dans le SQL Editor Supabase.
- En attendant, les inserts de type `reserviste` echouent (l'ancienne contrainte avait `agent_libre` a la place).

Nouvelle page `/admin/recrues`:
- Creation de `app/app/admin/recrues/page.tsx` et `BanqueRecruesManager.tsx`.
- Interface dediee a la gestion de la banque de recrues, separee de la gestion des alignements.
- Affiche les recrues (`is_rookie = true`) disponibles, permet d'assigner/retirer par pooler.
- Reutilise les Server Actions `addPlayerAction` et `removePlayerAction` depuis `../rosters/actions`.
- Lien ajoute dans le panneau admin (`/admin/page.tsx`), grille passee a 4 colonnes.

### 2026-04-03 (session 5)

Deux types de recrues eligibles a la banque de recrues:
1. **Repêchés (proteges)**: eligibles 5 saisons a partir de l'annee de repechage, meme sans contrat PuckPedia.
2. **ELC agent libre**: eligibles uniquement pendant leur ELC, pas proteges.
PuckPedia a priorite sur les donnees du repechage (contrat, equipe, position). L'annee de repechage est preservee.

Changements schema (`schema.sql` + migration Supabase a executer):
- `players.draft_year INTEGER`
- `players.draft_round INTEGER`
- `players.draft_overall INTEGER`

Nouveau script `python_script/import_drafts.py`:
- Fetch les repechages des 5 dernieres annees depuis `records.nhl.com/site/api/draft`.
- Fenetre calculee dynamiquement selon la saison courante.
- Pour un joueur deja en base: ajoute `draft_year/round/overall` + `is_rookie=True` si pas encore renseigne.
- Pour un joueur absent de PuckPedia: cree un enregistrement minimal (nom, position, equipe, draft info).
- A executer APRES `import_supabase.py` pour que PuckPedia ait la priorite.

Mise a jour `python_script/import_supabase.py`:
- `existing_map` stocke maintenant `{id, draft_year}` au lieu du seul `id`.
- Logique `is_rookie`: `status == 'ELC'` OU `draft_year` deja present en base.
- PuckPedia ne peut plus ecraser `is_rookie=True` d'un repêché n'ayant plus de statut ELC.

### 2026-04-05 (session 6)

Corrections UI suite aux ajustements de la banque de recrues:

1. **`/joueurs` — JoueursTable.tsx**:
   - Les joueurs sans contrat (`player_contracts` vide) et `is_rookie=true` sont exclus du tableau principal.
   - Une section accordion "Prospects repêchés sans contrat" est ajoutée en bas de page.
   - Cette section affiche: nom, equipe, position, annee de repechage, ronde, rang global.
   - Tri: annee DESC, ronde ASC, rang ASC.
   - La recherche par nom s'applique aussi aux prospects.
   - Type `PlayerRow` enrichi avec `draft_year`, `draft_round`, `draft_overall`.

2. **`/admin/recrues` — BanqueRecruesManager.tsx**:
   - Filtre par equipe ajouté (comme le RosterManager).
   - Tri des recrues disponibles: annee de repechage DESC, ronde ASC, rang ASC.
   - Affichage de l'annee de repechage (`2024 R1 #3`) dans la liste disponible et dans la banque.
   - Banque triée selon le même ordre.
   - Requête `fetchBank` enrichie pour inclure `draft_year, draft_round, draft_overall`.
   - Requête page.tsx: suppression du `.order('last_name')` remplacé par le tri côté client.

### 2026-04-06 (session 7)

Infos de repêchage dans les vues d'alignement:
- `poolers/[id]/page.tsx`: requête enrichie (`draft_year/round/overall`); `RosterTable` accepte `showDraft`; la banque de recrues affiche colonne "Rep." au lieu de "Cap".
- `admin/rosters/RosterManager.tsx`: types enrichis, requête fetch mise à jour, `draftLabel` affiché en vert pour les recrues dans l'alignement.
- `admin/rosters/page.tsx`: sélection `draft_year/round/overall` ajoutée dans la requête joueurs.

Nouvelle page `/repechage` (publique):
- Fichiers: `app/app/repechage/page.tsx` + `RepechageTable.tsx`.
- Données: tous les joueurs avec `draft_year` en base, croisées avec les banques de recrues actives.
- Affichage groupé par année (DESC) puis ronde (ASC), trié par rang dans la ronde.
- Badge pooler en vert si protégé, "Non protégé" sinon.
- Filtres: année, ronde, protégé/non-protégé, recherche texte.
- Lien "Repêchage" ajouté dans la Navbar (entre Joueurs LNH et Poolers).

### 2026-04-12 (session 9)

Chantier 2 — Création et gestion des saisons:
- `/admin/config` restructuré: liste de toutes les saisons à gauche, formulaire cap à droite.
- Nouveau composant `SeasonsManager.tsx`: créer une saison, voir toutes les saisons, activer une saison.
- `createSeasonAction`: crée la saison demandée + les 2 suivantes comme placeholders (même cap estimé, inactives).
- Les picks de repêchage (4 rondes × N poolers) sont générés pour les 3 saisons à la création.
- `activateSeasonAction`: désactive toutes les saisons, active la cible.
- `poolers/[id]`: picks groupés par saison, badge "Active" sur la saison courante; les picks des saisons futures sont visibles dès maintenant (échangeables avant la saison).
- Migration SQL ajoutée dans `schema.sql` (section MIGRATIONS): `draft_pick_id` sur `pooler_rosters`.

Ordre d'execution recommande du pipeline complet:
1. `scrape_puckpedia.py`
2. `import_supabase.py`
3. `import_drafts.py`

### 2026-04-13 (session 10)

Mise en place du versionnement Git et de la sauvegarde distante:
- Creation d'un depot Git local a la racine de `C:\Projet_Codex\Hockey_Pool_App`.
- Ajout d'un `.gitignore` racine pour exclure notamment:
  - `app/node_modules/`
  - `app/.next/`
  - `app/.env*`
  - `python_script/venv/`
  - `python_script/.env*`
  - `python_script/diagnostics/`
- Configuration d'un remote GitHub:
  - `origin = git@github.com:boucherdavid/DB_Hockey_Manager.git`
- Generation d'une cle SSH locale sans mot de passe pour GitHub:
  - `C:\Users\david\.ssh\id_ed25519`
  - remote Git bascule de HTTPS vers SSH
- Premier commit cree localement:
  - `8ce2b56` - `Initial commit`
- Branche par defaut renommee en `main`.
- Push force effectue vers le depot GitHub pour aligner le remote avec l'etat local courant.

Impact:
- le projet est maintenant historise localement avec Git;
- le code est sauvegarde sur GitHub;
- les prochains `git push` peuvent se faire via SSH sans repasser par l'authentification HTTPS.

Configuration locale GitHub completee:
- `GitHub CLI (gh)` installe sur la machine.
- Authentification `gh` validee avec le compte `boucherdavid`.
- Protocole Git confirme en `ssh`.
- L'environnement local permet maintenant:
  - `git push` via SSH;
  - usage de `gh` pour consulter le repo, les PR, les issues et les workflows.

### 2026-04-13 (session 11)

Mise a jour du suivi pour refleter l'etat reel du code dans `app/`:

Chantier 3 - Transactions admin et historique public:
- Nouvelle page admin `app/app/admin/transactions/page.tsx`.
- Nouveau composant `app/app/admin/transactions/TransactionBuilder.tsx`.
- Nouvelles Server Actions `app/app/admin/transactions/actions.ts`.
- Nouvelle page publique `app/app/transactions/page.tsx`.
- Lien `Transactions` visible dans la Navbar publique.

Fonctionnellement, le module transactions permet maintenant:
- d'effectuer des echanges de joueurs entre deux poolers;
- d'effectuer des transferts de choix de repechage;
- de promouvoir une recrue vers `actif` ou `reserviste`;
- de reactiver un joueur `ltir`;
- de signer un agent libre;
- de liberer un joueur;
- de changer le type d'un joueur dans le roster.

Validation cote serveur du builder de transactions:
- reconstitution d'un roster virtuel par pooler avant application;
- validation des limites `12F / 6D / 2G`;
- validation du minimum de `2` reservistes;
- validation de la masse salariale par rapport au `pool_cap`;
- verification de la possession des picks avant transfert;
- persistance de la transaction dans `transactions` et `transaction_items`.

Historique public des transactions:
- affichage des transactions de la saison active;
- separation entre:
  - `Echanges`
  - `Ajustements`

Extension du chantier saisons:
- `app/app/admin/config/actions.ts` contient maintenant des actions supplementaires de transition de saison:
  - `previewTransitionAction`
  - `transitionSeasonAction`
  - `deleteSeasonAction`
- `app/app/admin/config/SeasonsManager.tsx` permet maintenant:
  - de previsualiser la copie des rosters de la saison active vers une saison future;
  - d'identifier les joueurs sans contrat dans la saison cible;
  - de confirmer la transition;
  - de supprimer une saison non active.

Note de suivi:
- ces fonctionnalites etaient deja presentes dans le code mais n'etaient pas encore documentees dans `SUIVI_PROJET.md`;
- le suivi est maintenant aligne avec l'etat applicatif observe localement.

### 2026-04-09 (session 8)

Toutes les migrations SQL en attente exécutées dans Supabase:
- `players`: colonnes `draft_year`, `draft_round`, `draft_overall` ajoutées.
- `pooler_rosters`: contrainte CHECK mise à jour pour inclure `actif`, `reserviste`, `recrue`, `ltir`.
- `player_contracts`: colonne `is_elc BOOLEAN NOT NULL DEFAULT false` ajoutée.
- `pooler_rosters`: colonnes `rookie_type` et `pool_draft_year` ajoutées.
- `pool_seasons`: colonne `cap_multiplier DECIMAL(5,4) DEFAULT 1.24` ajoutée; `pool_cap` recréé comme colonne générée `CEIL(nhl_cap * cap_multiplier / 1000000) * 1000000`; `nhl_cap` de la saison 2025-26 corrigé à `95 500 000`.

Nouvelle table `pool_draft_picks` (choix de repêchage échangeables):
- Colonnes: `pool_season_id`, `original_owner_id`, `current_owner_id`, `round` (1-4), `is_used`.
- FK avec `ON DELETE SET NULL` sur les deux colonnes pooler (pas de blocage si pooler retiré).
- Contrainte UNIQUE `(pool_season_id, original_owner_id, round)`.
- RLS activé: lecture publique, écriture admin seulement.
- Trigger `trigger_picks_on_new_pooler`: tout nouveau pooler reçoit automatiquement 4 choix pour chaque saison active.
- Seed exécuté pour les poolers existants (4 rondes × N poolers).
- Affichage dans `/poolers/[id]`: section "Choix de repêchage" avec badge par ronde; affiche "Propre" ou "De: [nom]" si choix reçu en échange.

Refonte du RosterManager en mode "brouillon + soumission":
- Les ajouts, retraits et changements de type modifient uniquement le state local (aucune écriture BD).
- Nouveaux joueurs non soumis marqués d'une bordure bleue.
- Bouton "Soumettre" envoie le diff complet à `submitRosterAction` (Server Action).
- `submitRosterAction` reconstitue l'état final, valide toutes les règles (min 2 réservistes, limites 12F/6D/2G), puis applique en BD.
- Bouton "Annuler" remet le state à l'état BD.
- Changement de pooler avec modifications en cours demande confirmation.
- Règle minimum 2 réservistes : visible dans le widget de conformité, bloquante uniquement à la soumission.

Toutes les migrations SQL en attente exécutées dans Supabase:
- `players`: colonnes `draft_year`, `draft_round`, `draft_overall` ajoutées.
- `pooler_rosters`: contrainte CHECK mise à jour pour inclure `actif`, `reserviste`, `recrue`, `ltir`.
- `player_contracts`: colonne `is_elc BOOLEAN NOT NULL DEFAULT false` ajoutée.
- `pooler_rosters`: colonnes `rookie_type` et `pool_draft_year` ajoutées.
- `pool_seasons`: colonne `cap_multiplier DECIMAL(5,4) DEFAULT 1.24` ajoutée; `pool_cap` recréé comme colonne générée `CEIL(nhl_cap * cap_multiplier / 1000000) * 1000000`; `nhl_cap` de la saison 2025-26 corrigé à `95 500 000`.
- Note: la base contenait déjà une ligne `ltir` (test), ce qui a nécessité d'adapter le script pour inclure `ltir` dès la recréation de la contrainte.

### 2026-04-13 (session 12)

Correctifs module transactions (`app/app/admin/transactions/`):

1. **Atomicité**: l'enregistrement `transactions` + `transaction_items` est maintenant inséré AVANT la boucle de mutations afin que la trace d'audit existe même si une mutation échoue partiellement. (Vrai atomicité nécessiterait une fonction PostgreSQL RPC.)
2. **Unicité des signatures**: vérification serveur avant simulation — si un joueur signé est déjà actif dans un roster cette saison, la transaction est refusée.
3. **Filtre pooler dans le builder**: correction d'un bug UI où changer le pooler A ne retirait pas les items déjà associés à l'ancien pooler. L'ID précédent est capturé avant la mise à jour du state.
4. **Corruption de l'historique lors d'un transfert**: `UPDATE pooler_rosters` de désactivation manquait `.eq('is_active', true)`, ce qui pouvait désactiver d'anciennes lignes d'un joueur ayant changé de pooler. Corrigé.

Fichiers touchés: `actions.ts`, `TransactionBuilder.tsx`.

Nouveau module pré-saison (`app/app/admin/presaison/`):

Fichiers créés:
- `types.ts`: types `PoolerCapInfo`, `RosterEntry` et constante `FREE_AGENT_THRESHOLD = 500_000`. Séparé de `actions.ts` car `'use server'` interdit les exports non-async.
- `actions.ts`: Server Actions — `loadPresaisonDataAction`, `resetLtirToActifAction`, `saveDraftOrderAction`, `resetPresaisonDraftAction`.
- `page.tsx`: page serveur avec garde admin, chargement de la liste des saisons.
- `PresaisonManager.tsx`: composant client principal.

Logique de `loadPresaisonDataAction`:
- Les recrues protégées sont **exclues** du calcul de masse et de l'affichage:
  - `rookie_type = 'draft'`: protégée si `(seasonStartYear - pool_draft_year) < 5`.
  - `rookie_type = 'elc'`: protégée si `is_elc = true` sur le contrat courant.
- Les recrues dont la protection est expirée sont traitées comme `actif`.
- Les joueurs `ltir` sont inclus dans le roster (ils peuvent être remis sur LTIR manuellement).

Fonctionnalités du `PresaisonManager`:
- **Aperçu des rosters**: joueurs groupés par position (Attaquants / Défenseurs / Gardiens / Réservistes / LTIR). Libération multi-sélection par cases à cocher. Changement de type joueur par joueur.
- **Remise LTIR → Actif en lot**: bouton pour remettre tous les joueurs LTIR de la saison en `actif` d'un seul coup (`resetLtirToActifAction`). Utile en début de saison.
- **Ordre du repêchage**: glisser-déposer (ou liste ordonnée) des poolers; sauvegardé dans `pool_seasons.presaison_draft_order` (JSONB).
- **Draft actif**: file rotative — le pooler courant signe un agent libre, puis passe en fin de file s'il reste éligible (espace cap ≥ 500 000 $). Les poolers sous le seuil sont retirés automatiquement. L'admin peut clore manuellement.
- **Zone de test — Réinitialiser le repêchage**: annule toutes les transactions `'Repêchage pré-saison'` de la saison, désactive les joueurs signés dans `pooler_rosters`, supprime les items et transactions. Protégé par `window.confirm`.

Lien ajouté dans `app/app/admin/page.tsx` vers `/admin/presaison`.

Migration SQL exécutée dans Supabase:
```sql
ALTER TABLE pool_seasons ADD COLUMN IF NOT EXISTS presaison_draft_order JSONB;
```

Transition de saison — correction dans `transitionSeasonAction` (`admin/config/actions.ts`):
- Les joueurs en `ltir` dans la saison source sont copiés comme `actif` dans la saison cible (règle métier: LTIR se remet à actif en début de saison).

### 2026-04-15 (session 13)

**Page Statistiques LNH** (`app/app/statistiques/`):
- Nouveau fichier `page.tsx`: fetch des stats depuis l'API publique NHL (`api.nhle.com/stats/rest`).
  - Patineurs triés par points, gardiens par victoires.
  - Croisement avec les noms de la saison active pour marquer les joueurs déjà dans un pool.
- Nouveau composant `StatsTable.tsx`: tableau client interactif, tri par colonne, filtre texte.
- Lien "Statistiques" ajouté dans la `Navbar` (entre "Contrats LNH" et "Repêchage").
- Nouveau fichier `app/lib/nhl-colors.ts`: palettes de couleurs primaire + secondaire pour les 32 équipes NHL.

**Page Contrats LNH — refonte visuelle** (`app/app/joueurs/JoueursTable.tsx`):
- Renommée "Joueurs LNH" → "Contrats LNH" (titre et lien Navbar).
- En-têtes d'équipes colorées avec dégradé aux couleurs NHL (via `teamColor`).
- Sous-groupement par position dans chaque équipe : Attaquants → Défenseurs → Gardiens.
- Point de couleur de l'équipe dans la colonne équipe.
- Tri ajusté : équipe → position (F/D/G) → cap DESC → nom.

**RosterManager — améliorations** (`app/app/admin/rosters/`):
- Nouvelle prop `allTakenPlayerIds` passée depuis `page.tsx` : un joueur déjà dans le roster d'un autre pooler disparaît de la liste de recherche.
- Sous-groupement par position (Attaquants / Défenseurs / Gardiens) dans la section "Actif", triée par cap DESC.
- Auto-détection du `rookie_type` (`'repcheche'` si `draft_year` présent, sinon `'agent_libre'`) à l'ajout d'un joueur recrue.
- Sélecteur `rookie_type` inline sous chaque recrue dans le roster; persistance immédiate via `updateRookieTypeAction`.

**Module pré-saison — Décisions ELC** (`app/app/admin/presaison/`):
- Nouveau type `ElcDecisionEntry` dans `types.ts`.
- `loadPresaisonDataAction` détecte les recrues repêchées placées en `actif`/`reserviste` dont le contrat ELC est échu.
- Nouvelle action `resolveElcDecisionAction` : deux options par joueur concerné :
  - **Garder actif** : efface `rookie_type` et `pool_draft_year` — le joueur devient actif permanent.
  - **Mettre en banque** : change `player_type` en `'recrue'` — retour à la banque pour le début de saison.
- Section dédiée dans `PresaisonManager.tsx` avec bandeau violet et boutons par joueur.
- Correction terminologie interne `rookie_type` : `'draft'` → `'repcheche'`, `'elc'` → `'agent_libre'`.
- Correction bug : `setDraftQueue` → `setQueue` dans le reset du draft.

**Scripts Python** (`python_script/`):
- Normalisation des noms dans `import_supabase.py` et `import_drafts.py` : ajout de `.replace('-', ' ')` pour gérer les noms avec tiret (ex: Marc-Édouard Vlasic).
- `existing_map` dans `import_supabase.py` utilise maintenant les noms normalisés comme clé (évite les doublons causés par les accents + tirets).
- `is_rookie` dans `import_supabase.py` : uniquement `status == 'ELC'`; les repêchés sans contrat ELC sont gérés exclusivement par `import_drafts.py`.
- `import_drafts.py` : la synchronisation `is_rookie=True` exclut désormais les joueurs `RFA`/`UFA` (statut établi → plus recrue éligible).

### 2026-04-16 (session 15)

**Toggle Saison régulière / Séries dans Statistiques LNH**:
- `statistiques/page.tsx`: `buildUrl`, `fetchSkaters`, `fetchGoalies` acceptent maintenant un paramètre `gameType` (2 = saison régulière, 3 = séries).
- Le `gameType` est déterminé par le search param `?saison=series` dans l'URL.
- `statistiques/StatsTable.tsx`: toggle "Saison régulière / Séries" ajouté dans le coin supérieur droit du titre. Navigation via `useRouter` vers `?saison=series` ou sans paramètre.
- La disponibilité (point vert) et le badge recrue (R) restent fonctionnels dans les deux modes.
- À tester lorsque les séries débuteront.

---

### 2026-04-16 (session 16)

**Chantier INIT — finalisation**:
- Nouveau composant `app/app/admin/config/InitTabs.tsx`: regroupe `PicksEditor` et `RookieOverrideManager` dans un panneau à onglets ("Choix de repêchage" / "Banque de recrues").
- Les deux composants enfants perdent leur propre `bg-white rounded-lg shadow`; le wrapper est maintenant dans `InitTabs`.
- `page.tsx` mis à jour pour utiliser `InitTabs` à la place des deux composants séparés.

**Décisions d'architecture — validées en session**:

Pool des séries (Chantier E) et Bracket (Chantier F) ajoutés à la feuille de route:
- **Pool des séries**: 3 attaquants, 2 défenseurs, 1 gardien par ronde; cap ~25 M$; self-service pooler; réassignation obligatoire si équipe éliminée; points via scoring_config.
- **Bracket**: picks entre chaque ronde (équipes pas connues d'avance); 2 pts bon gagnant + 1 pt bon nombre de matchs; bris d'égalité sur le total de buts par ronde.

Scoring configurable (transversal):
- Le scoring s'applique à la saison régulière ET aux séries via la même table `scoring_config`.
- Stats: `goal`, `assist`, `goalie_win`, `goalie_otl`; scope: `regular | playoffs | both`.

Stats joueurs — architecture snapshots retenue:
- Jamais de game-by-game logs en BD.
- Table `player_stat_snapshots` (player_id, date, goals, assists, goalie_wins, goalie_otl): snapshot cumulatif NHL capturé automatiquement à chaque activation/désactivation admin.
- Points pooler = snapshot_désactivation − snapshot_activation.
- Fin de saison = sync finale pour tous les joueurs actifs.
- Cette mécanique est nécessaire pour gérer correctement les transactions intra-saison dans le classement.

Séquence de travail avant transition:
1. Scoring config ✓ (cette session)
2. Chantier B — Classement + NHL API + snapshots
3. Saisie des transactions historiques 2025-26
4. Validation classement vs outil Excel
5. Chantier TRANSITION

**Scoring config — implémentation**:
- Migration SQL: `supabase_migrations/scoring_config.sql` (à exécuter dans Supabase).
- Valeurs par défaut: but=1 pt, passe=1 pt, victoire gardien=2 pts, défaite prol./fusillade=1 pt.
- Nouveau composant `app/app/admin/config/ScoringConfig.tsx`: formulaire d'édition des points par stat.
- Nouvelle action `updateScoringAction` dans `actions.ts`.
- `page.tsx`: query `scoring_config` ajoutée, `ScoringConfig` affiché sous `ConfigForm` dans la colonne droite.

**Migration à exécuter dans Supabase**:
```sql
-- Fichier: supabase_migrations/scoring_config.sql
CREATE TABLE scoring_config (
  id SERIAL PRIMARY KEY,
  stat_key VARCHAR(30) UNIQUE NOT NULL,
  label VARCHAR(100) NOT NULL,
  points DECIMAL(5,2) NOT NULL DEFAULT 1,
  scope VARCHAR(20) NOT NULL DEFAULT 'both'
    CHECK (scope IN ('regular', 'playoffs', 'both'))
);
INSERT INTO scoring_config (stat_key, label, points, scope) VALUES
  ('goal', 'But', 1, 'both'),
  ('assist', 'Passe', 1, 'both'),
  ('goalie_win', 'Victoire (gardien)', 2, 'both'),
  ('goalie_otl', 'Défaite en prol./fusillade (gardien)', 1, 'both');
```

### 2026-04-20 (sessions 17-18)

**Corrections diverses et chantier cap N+1**

**Correctifs techniques**:
- `app/lib/nhl-stats.ts`: `normName` enrichi avec décomposition NFD + suppression des diacritiques — corrige les points manquants pour les joueurs avec accents (ex: Stützle dans la base sans accent).
- `app/app/statistiques/page.tsx` et `StatsTable.tsx`: même normalisation appliquée pour le croisement noms NHL API ↔ base.
- `python_script/import_supabase.py`: deuxième appel `deduplicate_players()` ajouté APRÈS tous les inserts — corrige les doublons créés lors de l'import (ex: Simashev).
- `.github/workflows/import.yml`: `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true` ajouté au niveau workflow — supprime l'avertissement de dépréciation Node.js 20.

**Typo `repcheche` → `repeche`** (renommage complet):
- Fichiers code corrigés: `actions.ts`, `RookieOverrideManager.tsx`, `BanqueRecruesManager.tsx`, `RosterManager.tsx`, `poolers/[id]/page.tsx`, `schema.sql` et tous les `actions.ts` concernés.
- Migration SQL exécutée dans Supabase:
  ```sql
  ALTER TABLE pooler_rosters DROP CONSTRAINT IF EXISTS pooler_rosters_rookie_type_check;
  UPDATE pooler_rosters SET rookie_type = 'repeche' WHERE rookie_type = 'repcheche';
  ALTER TABLE pooler_rosters ADD CONSTRAINT pooler_rosters_rookie_type_check CHECK (rookie_type IN ('repeche', 'agent_libre'));
  ```

**Page Repêchage — correction "Non protégé"**:
- Requête filtrée sur `rookie_type IS NOT NULL` (au lieu de `player_type = 'recrue'`) pour inclure les recrues actives (ex: Schaefer promu `actif`).
- Fallback nom ajouté: si le joueur trouvé par `draft_year/overall` n'est pas dans un roster, on tente la correspondance par nom normalisé.
- `export const dynamic = 'force-dynamic'` ajouté pour éviter le cache Next.js.

**PWA — bannière d'installation**:
- `InstallBanner.tsx`: texte corrigé de "Hockey Pool" à "DB Hockey Manager".

**Page Classement** (`app/app/classement/`):
- Nouveau composant `SummaryTable`: tableau récapitulatif toujours visible (rang, pooler cliquable, PTS, B, A, V, DP, BL).
- Noms des poolers cliquables vers `/poolers/[id]` dans la table résumé ET dans l'accordéon.
- `type Mode = 'saison'` en place comme base pour les futurs modes (mensuel, journée, série).

**Page alignement pooler** (`app/app/poolers/[id]/page.tsx`):
- `getYearsRemaining`: filtre `cap_number > 0` pour exclure les lignes RFA/UFA du compte d'années.
- Recrues triées par année de repêchage ASC puis alphabétique dans toutes les vues (alignement, RosterManager, BanqueRecruesManager).
- Joueurs LTIR: `salaryCounts={true}` — le salaire est affiché mais n'est pas comptabilisé dans la masse.
- Note de bas de page mise à jour pour mentionner LTIR.

**Chantier cap N+1** — nouveau champ plafond saison suivante:

Migration SQL à exécuter dans Supabase (si pas encore fait):
```sql
ALTER TABLE pool_seasons ADD COLUMN IF NOT EXISTS next_nhl_cap DECIMAL(12,2);
```

Fichiers modifiés:
- `app/app/admin/config/actions.ts`: `updateCapAction` accepte maintenant `nextNhlCap?` en 4e paramètre.
- `app/app/admin/config/page.tsx`: `next_nhl_cap` ajouté à la requête select.
- `app/app/admin/config/ConfigForm.tsx`: redesign complet en 2 colonnes (saison active | saison suivante). Chaque colonne affiche plafond NHL (input), facteur effectif (% du cap NHL), et cap du pool calculé. La colonne N+1 met à jour son aperçu en temps réel quand le facteur change.
- `app/app/poolers/[id]/page.tsx`:
  - Colonne "Cap N+1" ajoutée dans la table Banque de recrues (et Activation obligatoire).
  - Barre de masse salariale N+1 affichée sous la barre courante si `next_nhl_cap` est configuré.
  - Badge "⚠ Dépassement" visible si la somme des salaires N+1 (actifs + réservistes) dépasse le cap N+1 du pool.

### 2026-04-21 (sessions 22-23)

**Widget "Joueurs en action" — refonte complète**:
- Remplace l'affichage per-pooler par un tableau avec TOUS les poolers : Pooler | Nb | Détail (2A · 1D · 1G).
- Trié par nombre de joueurs décroissant; le pooler connecté est mis en évidence (fond bleu + "(toi)").
- Fonctionne en mode Saison (depuis `standings`) et en mode Séries (depuis `playoff_rosters` avec join `teams.code`).
- Visible uniquement s'il y a des matchs ce soir.
- Composants séparés : `ScheduleList` et `ActivityTable`.

**Switcher de pooler dans l'alignement**:
- Nouveau `app/components/PoolerSwitcher.tsx`: `<select>` client-side, navigue vers `/poolers/{id}` via `useRouter`.
- `poolers/[id]/page.tsx`: fetch de tous les poolers ajouté; `PoolerSwitcher` affiché dans l'en-tête (flex row avec le nom du pooler).
- Visible uniquement si 2+ poolers existent.

**Refonte Navbar — menu Classement séparé**:
- `Classement` extrait du dropdown "Pool Saison" et transformé en son propre dropdown.
- Entrées: "Saison complète" (actif), Hebdomadaire / Mensuel / Meilleurs disponibles (badges "À venir").
- "Pool Saison" conserve seulement: Mon alignement, Transactions.
- Menu mobile mis à jour avec la section "Classement" correspondante.

**Page d'accueil — refonte complète**:
- Remplace les cartes de liens par: classement compact + calendrier du soir + tableau d'activité des poolers.
- Détection automatique du mode (Saison / Séries) selon les saisons actives.
- Toggle Saison/Séries affiché uniquement si les deux sont actives simultanément.
- `ScheduleList`: matchs du jour via `api-web.nhle.com/v1/schedule/now`.
- `ActivityTable`: tous les poolers avec nombre de joueurs ce soir au format "2A · 1D · 1G".
- `app/lib/standings.ts`: nouveau fichier partagé avec `buildStandings()` et types `PlayerContrib`/`PoolerStanding`.
- `app/components/SummaryTable.tsx`: tableau compact partagé (utilisé par accueil et `/classement`).

**Pool des Séries — corrections**:
- Tri des joueurs dans le sélecteur: équipe ASC puis salaire DESC.
- Correction conférence NULL: fallback statique `EASTERN_TEAMS` pour les joueurs dont `teams.conference` est vide en BD.
- Correction filtre `position IS NULL`: le filtre `!p.position` est retiré pour ne plus exclure les joueurs sans position.
- Types `Player`, `ActivePick`, `PickInput` mis à jour pour accepter `position: string | null`.
- `posGroup()` dans `PicksManager.tsx` gère `null` (retourne `'F'` par défaut).
- Correction limite 1000 rangées Supabase: `fetchAllPages` appliqué sur `player_contracts` (1575 contrats en 2025-26). Johnston/DAL, Schmaltz/UTA, Wedgewood/COL maintenant visibles dans le sélecteur.

**Diagnostic positions NULL**:
- 24 joueurs avec `position IS NULL` et contrat actif en 2025-26 identifiés.
- Cause: le scraper `scrape_puckpedia.py` échoue à détecter la position pour certains joueurs (section HTML différente sur PuckPedia).
- Constat: `teams_offline/MTL.csv` avait Jakub Dobes (id=713) en 1ère ligne avant l'en-tête, le rendant invisible à `fusionner_equipes()`. Corrigé manuellement en BD.
- Nouveau script `python_script/fix_null_positions.py`:
  - Requête Supabase: tous les joueurs `position IS NULL` avec contrat actif.
  - Recherche par nom via `search.d3.nhle.com/api/v1/search/player`.
  - Mapping des codes NHL (`C/L/R/LW/RW` → `F`, `D/LD/RD` → `D`, `G` → `G`).
  - Option `--dry-run` pour prévisualiser sans modifier la BD.
  - Loggue les joueurs sans résultat NHL pour correction manuelle.
- Script lancé avec succès; positions corrigées en BD.

**PWA — Notifications push**:
- Nouveau `app/lib/push.ts`: `sendPushToAdmins(payload)` — envoie une notification Web Push à tous les admins abonnés. Supprime automatiquement les subscriptions invalides (410/404).
- Nouvelles Server Actions `app/app/compte/push-actions.ts`: `subscribePushAction`, `unsubscribePushAction`, `getSubscriptionStatusAction`.
- Nouveau composant client `app/app/compte/PushToggle.tsx`: toggle d'abonnement/désabonnement dans la page "Mon compte".
- `app/public/sw.js` mis à jour (v4): handlers `push` et `notificationclick` ajoutés.
- `app/app/series/actions.ts`: `sendPushToAdmins` appelé après soumission des choix séries.
- Table `push_subscriptions` créée dans Supabase (endpoint, p256dh, auth; RLS admin only).
- Package `web-push` installé (`npm install web-push`); variables d'env `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` à configurer dans Vercel.

**Contraste — suppression du mode sombre**:
- `app/app/globals.css`: bloc `@media (prefers-color-scheme: dark)` supprimé.
- Fond et texte forcés en blanc/noir, les titres restent lisibles sur mobile.

**Restructuration `/poolers/[id]` — Mon Équipe**:
- Nouveau `app/app/poolers/[id]/PoolerPageTabs.tsx`: composant client avec deux onglets — "Organisation" (contenu actuel) et "Alignement" (placeholder pour Chantier B — points séries).
- `page.tsx` mis à jour: le contenu de la page devient `organisationContent` dans `PoolerPageTabs`.
- Navbar: "Mon alignement" → "Mon équipe" (desktop + mobile).

**Pool des Séries — correctifs sélecteur (session suivante)**:
- `posGroup` gère maintenant les positions composées (ex: `"LD,RD"`, `"C,RW"`): split sur virgule + vérification par partie. Lane Hutson (`"LD,RD"`) classé correctement comme défenseur.
- Positions attaquants explicites: `C`, `LW`, `RW`, `W`, `F` vérifiés individuellement (symétrie avec D et G).
- Retrait du `slice(0, 150)` dans la liste de sélection: la liste défile maintenant jusqu'au bout.

**Pool des Séries — filtre équipes actives (bracket NHL)**:
- `picks/page.tsx`: fetch `api-web.nhle.com/v1/playoff-bracket/{année}` au chargement (année dérivée de `ps.season`, ex: `"2025-26"` → 2026).
- Équipes actives = toutes les équipes du bracket dont l'ID n'est pas un `losingTeamId` dans une série terminée.
- Filtre appliqué côté serveur avant de passer la liste à `PicksManager`.
- Fallback silencieux si l'API est indisponible (liste complète affichée sans filtre).
- `PicksManager`: affiche «N équipes actives» dans le sous-titre si le filtre est actif.
- Cache de 1h (`revalidate: 3600`) sur la réponse du bracket.

Commits: `a3c0311` (corrections séries/positions), `263c820` (restructuration Mon Équipe), `17a33ad` / `a997c77` (posGroup + défilement), `d5c22f5` (filtre équipes actives).

---

### 2026-04-21 (session 21)

**Navbar — Classement en dropdown indépendant**:
- `Classement` retiré du sous-menu `Pool Saison`; `Pool Saison` conserve seulement `Mon alignement` et `Transactions`.
- Nouveau dropdown `Classement` avec: `Saison complète` (→ /classement) + `Hebdomadaire`, `Mensuel`, `Meilleurs disponibles` (badges "À venir").
- Même structure dans le menu mobile.

**Page d'accueil — Toggle Saison/Séries**:
- Mode détecté via `?mode=saison` ou `?mode=series`; défaut = Séries si `playoff_season` active, sinon Saison.
- Toggle Saison/Séries affiché uniquement quand les deux modes sont actifs simultanément.
- **Mode Saison**: classement régulier (`SummaryTable`) + widget matchs du jour + joueurs actifs.
- **Mode Séries**: classement playoff compact (rang/nom/pts) OU état "en attente" si `scoring_start_at` null + widget matchs + picks actifs.
- Widget "joueurs en action" reformaté: `2A · 1D · 1G` (comptage par position, sans pastilles d'équipes). Noms listés en dessous.
- `buildPlayoffStandingsCompact()` inline dans page.tsx: utilise `fetchNhlSkaters(3)/fetchNhlGoalies(3)` + snapshots pour calculer les pts séries.

**Architecture répondue (non implémentée)**:
- Bloquant si pas tous les poolers participent aux séries: non — poolers sans picks ont 0 pts, pas d'erreur.
- Vues classement futures (hebdo, mensuel, meilleurs pointeurs disponibles) → dépendent du Chantier B (snapshots); dropdown navbar prêt.

Commit: `bb3db48`.

---

### 2026-04-21 (session 20)

**Page d'accueil — refonte**:
- Suppression des cartes de liens (Joueurs LNH, Alignements, Mon équipe) et de la grille des poolers.
- Nouveau layout 2 colonnes (desktop): classement compact à gauche, widget matchs du jour à droite.
- Widget matchs du jour: fetch `api-web.nhle.com/v1/schedule/now`, date en heure de l'Est, badge "En cours/Terminé" ou heure de début.
- Widget joueurs actifs: pour le pooler connecté, liste les joueurs actifs dont l'équipe joue ce soir + badge bleu avec compte.

**Refactoring classement**:
- Nouveau `app/lib/standings.ts`: types `PoolerStanding` + `PlayerContrib` + fonction `buildStandings()`. Partagé par home, `/classement` et `/poolers`.
- Nouveau `app/components/SummaryTable.tsx`: table résumé du classement (rang, nom cliquable, pts, B/A/V/DP/BL). Partagée par home et classement.
- `app/app/classement/ClassementTable.tsx`: retire la définition locale de `SummaryTable`, importe le composant partagé.
- `app/app/classement/page.tsx` et `app/app/poolers/page.tsx`: simplifiés pour utiliser `buildStandings()`.

**Pool des séries — corrections**:
- `series/picks/page.tsx`: tri des joueurs dans le sélecteur = équipe ASC puis salaire DESC (cohérent avec les autres pages).
- Fallback statique Est/Ouest via `EASTERN_TEAMS` set: les joueurs dont la colonne `conference` est vide en BD (ex: Dobes MTL) apparaissent maintenant correctement.

**Vision classement (future, non implémenté)**:
- Classement de la soirée précédente, classement mensuel, meilleurs pointeurs des poolers, meilleurs pointeurs disponibles avec filtres position/équipe/recrue.
- Dépend du Chantier B (snapshots), planifié à l'Étape 2 de la séquence de validation.

Commit: `984d652`.

---

### 2026-04-21 (session 19)

**Refonte Navbar — menus déroulants groupés**:
- `app/components/Navbar.tsx`: restructuration complète avec 3 menus déroulants + 2 liens directs.
  - **Pool Saison** → Mon alignement (`/dashboard`), Classement (`/poolers`), Transactions (`/transactions`)
  - **Statistiques** → LNH (`/statistiques`), AHL (badge "À venir")
  - **Contrats LNH** → lien direct `/joueurs`
  - **Repêchage** → lien direct `/repechage`
  - **Pool Séries** → Mes choix (`/series/picks`), Classement (`/series`)
- Composant `Chevron` ajouté (flèche animée dans les boutons de menu).
- `DropdownKey` union type pour gérer quel menu est ouvert (`pool-saison | statistiques | series | profile | null`).
- `navRef` unique sur `<nav>` pour fermer tous les dropdowns au clic externe (remplace `profileRef`).
- Menu mobile: sections nommées correspondant aux groupes desktop.
- Commit: `193a77a`.

**Mémo de collaboration**: mise à jour automatique de `SUIVI_PROJET.md` en fin de session dorénavant, sans attendre la demande explicite.

---

### 2026-04-15 (session 14)

**Responsive mobile — pages de consultation**:
- `Navbar.tsx`: menu hamburger sur mobile, liens desktop cachés (`hidden md:flex`), fermeture automatique au changement de route.
- `poolers/[id]/page.tsx`: `overflow-x-auto` sur tous les conteneurs de tables `RosterTable`.
- `repechage/RepechageTable.tsx`: `overflow-x-auto` sur les tables de rondes et ELC.
- `statistiques/StatsTable.tsx`: colonnes secondaires masquées sur mobile (`hidden sm:table-cell`) — Tps/M, Pts/MJ pour patineurs; D, DP, B, A pour gardiens.
- Règle responsive documentée dans `CLAUDE.md`: pages admin desktop-only, pages consultation responsive.

**Déploiement Vercel**:
- App déployée sur `https://db-hockeypool-manager.vercel.app/`.
- Toutes les pages protégées derrière une connexion obligatoire via `proxy.ts` (Next.js 16).
- `proxy.ts`: redirection vers `/login` si non connecté, redirection vers `/` si connecté sur `/login`.
- `layout.tsx`: fetch de l'utilisateur côté serveur, état auth passé en props à `Navbar` (élimine le flash "Connexion" au premier chargement).
- Navbar: déconnexion via `window.location.href` pour forcer un rechargement complet et vider les cookies de session.

**Améliorations UI — Statistiques et Contrats LNH**:
- `StatsTable.tsx`: filtre Attaquants / Défenseurs / Tous ajouté pour l'onglet Patineurs.
- `JoueursTable.tsx`: bandeaux de position (Attaquants/Défenseurs/Gardiens) en pleine largeur avec couleur secondaire de l'équipe (repli sur primaire si trop pâle). Point de disponibilité déplacé à gauche du nom du joueur; colonne "Dispo" supprimée.
- Inputs et selects des filtres: ajout de `text-gray-800 bg-white` pour lisibilité sur mobile.

**Pipeline Python — corrections et automatisation**:
- `scrape_puckpedia.py`: les sections "Buyout & Cap Charges" sont ignorées au scraping (joueurs rachetés non actifs). Les sections "Retained Salary" sont conservées pour reconstituer le cap hit complet des joueurs échangés avec rétention.
- `import_supabase.py`: `csv_path` rendu relatif à `BASE_DIR` (fix GitHub Actions).
- Nouveau script `run_pipeline.py`: lance scrape → import_supabase → import_drafts en séquence. Option `--no-scrape` pour import seul.
- Nouveau workflow `.github/workflows/import.yml`: import automatique chaque lundi 6h UTC + déclenchement manuel. Requiert les secrets `SUPABASE_URL` et `SUPABASE_SERVICE_KEY` dans GitHub.
