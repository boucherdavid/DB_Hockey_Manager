# Suivi du projet Hockey Pool App

Derniere mise a jour: 2026-04-03

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
