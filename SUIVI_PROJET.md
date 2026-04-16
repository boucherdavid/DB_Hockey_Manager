# Suivi du projet Hockey Pool App

Derniere mise a jour: 2026-04-15

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
