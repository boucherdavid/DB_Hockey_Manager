# Hockey Pool App - Reference Projet

Ce fichier sert de reference stable pour le projet.
Le suivi des changements, des decisions recentes et de l'etat courant doit aller dans `SUIVI_PROJET.md`.

## Objectif

Application web pour gerer un pool de hockey long terme a la place d'un fichier Excel.

Regles metier de base:
- 8 poolers
- un alignement par pooler et par saison
- cap du pool = 125 % du cap NHL officiel
- transactions gerees cote admin
- historique conserve dans `roster_changes`

## Stack

- Frontend: Next.js 16, React, TypeScript, Tailwind CSS
- Backend: Supabase (PostgreSQL, Auth, RLS)
- Hebergement cible: Vercel

## Contraintes techniques

### Next.js 16

- utiliser `proxy.ts`, pas `middleware.ts`
- rester compatible avec les conventions Next.js 16

### Supabase

- la legacy anon key a deja ete identifiee comme plus fiable ici que `sb_publishable_`
- la logique RLS autour de `is_admin()` est sensible et doit etre modifiee avec prudence

## Structure du projet

```text
Hockey_Pool_App/
|-- app/
|   |-- app/
|   |-- components/
|   `-- lib/
|-- python_script/
|   |-- scrape_puckpedia.py
|   |-- import_supabase.py
|   |-- source/
|   |-- teams_offline/
|   |-- diagnostics/
|   `-- archive/
`-- schema.sql
```

## Base de donnees

Tables principales:
- `teams`
- `players`
- `player_contracts`
- `pool_seasons`
- `poolers`
- `pooler_rosters`
- `roster_changes`

Conventions utiles:
- statuts joueurs: `ELC`, `RFA`, `UFA`
- types de roster: `actif`, `recrue`, `agent_libre`

## Routes applicatives

Routes utilisateur:
- `/`
- `/login`
- `/joueurs`
- `/poolers`
- `/poolers/[id]`
- `/dashboard`

Routes admin:
- `/admin`
- `/admin/joueurs`
- `/admin/joueurs/nouveau`
- `/admin/joueurs/[id]`
- `/admin/poolers`
- `/admin/rosters`

## Pipeline Python

- `python_script/scrape_puckpedia.py`: recupere les donnees PuckPedia et produit les CSV
- `python_script/import_supabase.py`: importe joueurs et contrats dans Supabase

Repertoires associes:
- `python_script/source/`
- `python_script/teams_offline/`
- `python_script/diagnostics/`

## Responsive (mobile)

Les pages admin (RosterManager, PresaisonManager, TransactionBuilder) sont desktop-only — pas de responsive requis.

Les pages de consultation publique doivent etre utilisables sur mobile. Regle: quand on touche une page de consultation, on la rend responsive en meme temps.
- Utiliser `overflow-x-auto` sur tous les conteneurs de `<table>`.
- Masquer les colonnes secondaires sur mobile avec `hidden sm:table-cell` (et l'en-tete correspondant).
- Ne pas utiliser de layout en colonnes cote a cote sur mobile (preferer `flex-wrap` ou `grid-cols-1`).

Pages de consultation: `/`, `/joueurs`, `/statistiques`, `/repechage`, `/poolers`, `/poolers/[id]`, `/transactions`.

## Regle de maintenance

Modifier `CLAUDE.md` seulement si une information de reference change vraiment:
- architecture
- stack
- conventions stables
- regles metier

Pour tout le reste, utiliser `SUIVI_PROJET.md`.
