# Hockey Pool App - Reference Projet

Ce fichier sert de reference stable pour le projet.
Le suivi des changements, des decisions recentes et de l'etat courant doit aller dans `SUIVI_PROJET.md`.

## Objectif

Application web pour gerer un pool de hockey long terme a la place d'un fichier Excel.

Regles metier de base:
- 8 poolers
- un alignement par pooler et par saison: 12 attaquants, 6 defenseurs, 2 gardiens (actifs); minimum 2 reservistes
- cap du pool = cap NHL x facteur (configurable, typiquement 1.24-1.25), arrondi au million superieur
- la banque de recrues et les joueurs LTIR ne comptent pas dans la masse salariale
- transactions gerees cote admin
- historique conserve dans `transactions` et `transaction_items`
- protection recrue: 5 saisons pour les repechages, duree ELC pour les agents libres

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
- `pool_draft_picks`
- `transactions`
- `transaction_items`
- `scoring_config`

Conventions utiles:
- statuts joueurs: `ELC`, `RFA`, `UFA`
- types de roster: `actif`, `reserviste`, `recrue`, `ltir`
- types de recrue (`rookie_type`): `repeche`, `agent_libre`

## Routes applicatives

Routes utilisateur:
- `/`
- `/login`
- `/joueurs`
- `/statistiques`
- `/repechage`
- `/poolers`
- `/poolers/[id]`
- `/transactions`
- `/classement`

Routes admin:
- `/admin`
- `/admin/joueurs`
- `/admin/poolers`
- `/admin/rosters`
- `/admin/recrues`
- `/admin/transactions`
- `/admin/presaison`
- `/admin/config`

## Pipeline Python

Ordre d'execution:
1. `python_script/scrape_puckpedia.py`: recupere les donnees PuckPedia et produit les CSV
2. `python_script/import_supabase.py`: importe joueurs et contrats dans Supabase
3. `python_script/import_drafts.py`: importe les repechages des 5 dernieres annees (NHL API)

Raccourci: `python_script/run_pipeline.py` enchaîne les 3 etapes. Option `--no-scrape` pour sauter le scraping.

Automatisation: `.github/workflows/import.yml` — chaque lundi 6h UTC + declenchement manuel.

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

Pages de consultation: `/`, `/joueurs`, `/statistiques`, `/repechage`, `/poolers`, `/poolers/[id]`, `/transactions`, `/aide`.

## Page Aide (`/aide`)

`app/app/aide/page.tsx` contient trois sections:
- **Installation** : instructions PWA pour ordinateur, iPhone et Android.
- **Guide d'utilisation** : instructions par fonctionnalité (section en construction, à compléter au fur et à mesure).
- **Règlements** : règles métier du pool visibles par les poolers.

Règle : lors de l'ajout ou de la modification d'une fonctionnalité accessible aux poolers, évaluer si la section "Guide d'utilisation" ou "Règlements" de `/aide` doit être mise à jour.

## Regle de maintenance

Modifier `CLAUDE.md` seulement si une information de reference change vraiment:
- architecture
- stack
- conventions stables
- regles metier

Pour tout le reste, utiliser `SUIVI_PROJET.md`.
