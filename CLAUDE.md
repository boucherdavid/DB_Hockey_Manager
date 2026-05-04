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
- `/calendrier`
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

<!-- cce-block-version: 3 -->
## Context Engine (CCE)

This project uses Code Context Engine for intelligent code retrieval and
cross-session memory.

### Searching the codebase

**You MUST use `context_search` instead of reading files directly** when
exploring the codebase, answering questions about code, or understanding how
things work. This is a hard requirement, not a suggestion. `context_search`
returns the most relevant code chunks with confidence scores instead of whole
files, and tracks token savings automatically.

When to use `context_search`:
- Answering questions about the codebase ("how does X work?", "where is Y?")
- Exploring structure or architecture
- Finding related code, functions, or patterns
- Any time you would otherwise read a file just to understand it

When to use `Read` instead:
- You need to edit a specific file (read before editing)
- You need the exact, complete content of a known file path

Other search tools:
- `expand_chunk` — get full source for a compressed result
- `related_context` — find what calls/imports a function

### Cross-session memory — use it actively

This project has persistent memory across Claude Code sessions. **You must
use it both ways: recall before answering, record after deciding.** Memory
that is not recorded is lost; memory that is not recalled does nothing.

**Before answering a non-trivial question, call `session_recall`.**
Especially when:
- The question touches architecture, design, or naming choices
- The user asks "what / why / how did we ..."
- You are about to recommend an approach the team may have already chosen
  or already rejected

Pass a topic phrase, not a single word — e.g. `session_recall("auth flow")`,
not `session_recall("auth")`. Recall is vector-similarity-based, so paraphrases
match. If recall returns relevant entries, lead with them ("Per a prior
decision: ...") instead of re-deriving the answer.

**After making a non-obvious decision, call `record_decision`.** Especially:
- Choosing one library / pattern / approach over another
- Resolving an ambiguity in the spec or requirements
- Establishing a convention the project should follow going forward
- Anything you would not want to re-litigate next session

Format: `record_decision(decision="...", reason="...")`. Keep both fields
short and specific — they are surfaced verbatim at the start of future
sessions.

**After meaningful work in a file, call `record_code_area`.** Especially when:
- You added or substantially modified a function/class
- You traced through a non-obvious flow and want future-you to find it fast

Format: `record_code_area(file_path="...", description="...")`.

Skip recording for trivial reads, formatting changes, or one-off lookups —
the goal is durable signal, not an event log.

### Drilling deeper from a recall hit

`session_recall` results are tagged with the source session id, e.g.
`[turn sid:abc123|n:5]`. To drill in:

- `session_timeline(session_id="abc123")` — walk the per-turn summaries of
  that session in order. Use this when the user asks "what was the
  reasoning?" or "how did we get there?".
- `session_event(event_id=N)` — fetch a specific tool event's raw input
  and output (capped at 4 KB at read time). Use this when a turn summary
  references a tool result you actually need to inspect.

Both are read-only and cheap. Prefer them over re-running tool calls or
asking the user to re-paste context.

## Output Style

Be concise. Lead with the answer or action, not reasoning. Skip filler words,
preamble, and phrases like "I'll help you with that" or "Certainly!". Prefer
fragments over full sentences in explanations. No trailing summaries of what
you just did. One sentence if it fits.

Code blocks, file paths, commands, and error messages are always written in full.
<!-- /cce-block -->
