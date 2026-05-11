# Hockey Pool App — Référence Projet

Ce fichier sert de référence stable pour Claude Code.
Le suivi des changements, des décisions récentes et de l'état courant va dans `SUIVI_PROJET.md`.

---

## 1. Contexte du projet

Application web pour gérer un pool de hockey long terme, en remplacement d'un fichier Excel.

**Règles métier de base :**
- 8 poolers
- Alignement par pooler et par saison : 12 attaquants, 6 défenseurs, 2 gardiens (actifs) + minimum 2 réservistes
- Cap du pool = cap NHL × facteur (configurable, typiquement 1.24–1.25), arrondi au million supérieur
- La banque de recrues et les joueurs LTIR ne comptent pas dans la masse salariale
- Transactions gérées côté admin
- Historique conservé dans `transactions` et `transaction_items`
- Protection recrue : 5 saisons pour les repêchages, durée ELC pour les agents libres

**Stack :**
- Frontend : Next.js 16, React 19, TypeScript, Tailwind CSS 4
- Backend : Supabase (PostgreSQL, Auth, RLS)
- Hébergement : Vercel (`https://db-hockeypool-manager.vercel.app/`)

---

## 2. Commandes essentielles

```powershell
# Démarrer l'application (depuis la racine)
./start_app.ps1

# Ou manuellement
cd app && npm run dev

# Arrêter l'application
./stop_app.ps1
```

```bash
# Pipeline Python complet
cd python_script
python run_pipeline.py

# Sans scraping (import seul)
python run_pipeline.py --no-scrape

# Étapes individuelles
python scrape_puckpedia.py     # 1. Scraping PuckPedia → CSV
python import_supabase.py      # 2. Import joueurs/contrats → Supabase
python import_drafts.py        # 3. Import repêchages NHL (5 dernières saisons)
```

---

## 3. Structure du projet

```text
Hockey_Pool_App/
├── CLAUDE.md                  ← Ce fichier (référence stable)
├── SUIVI_PROJET.md            ← Journal de bord actif (à mettre à jour chaque session)
├── schema.sql                 ← Schéma de référence de la base de données
├── start_app.ps1              ← Démarrer l'app localement
├── stop_app.ps1               ← Arrêter l'app localement
├── .mcp.json                  ← Configuration MCP pour Claude Code
├── .gitignore
├── .claude/
│   ├── settings.json
│   └── settings.local.json
├── .github/
│   └── workflows/
│       └── import.yml         ← Pipeline auto (lundi 6h UTC + manuel)
├── app/                       ← Application Next.js
│   ├── CLAUDE.md              ← Règles spécifiques Next.js/TypeScript
│   ├── AGENTS.md
│   ├── proxy.ts               ← Auth middleware (PAS middleware.ts)
│   ├── next.config.ts
│   ├── app/                   ← Pages et composants
│   │   ├── components/
│   │   └── lib/
│   └── ...
├── python_script/             ← Pipeline de données
│   ├── run_pipeline.py        ← Point d'entrée principal
│   ├── scrape_puckpedia.py
│   ├── import_supabase.py
│   ├── import_drafts.py
│   ├── source/                ← CSV générés par le scraping
│   ├── teams_offline/
│   ├── diagnostics/
│   └── archive/
└── supabase_migrations/       ← Migrations SQL historiques
```

---

## 4. Base de données

**Tables principales :**
- `teams`, `players`, `player_contracts`
- `pool_seasons`, `poolers`, `pooler_rosters`
- `roster_changes`, `pool_draft_picks`
- `transactions`, `transaction_items`
- `scoring_config`
- `push_subscriptions` (notifications push)
- `player_stat_snapshots` (snapshots pour classements)
- `series_round_rosters` (pool des séries)

**Conventions :**
- Statuts joueurs : `ELC`, `RFA`, `UFA`
- Types de roster : `actif`, `reserviste`, `recrue`, `ltir`
- Types de recrue (`rookie_type`) : `repeche`, `agent_libre`
- `pool_seasons.is_playoff = true` → saison des séries active

---

## 5. Routes applicatives

**Utilisateur :**
`/` `/login` `/joueurs` `/statistiques` `/repechage` `/calendrier`
`/poolers` `/poolers/[id]` `/transactions` `/classement`
`/series` `/series/picks` `/compte` `/aide`

**Admin :**
`/admin` `/admin/joueurs` `/admin/poolers` `/admin/rosters`
`/admin/recrues` `/admin/transactions` `/admin/presaison`
`/admin/config` `/admin/series`

---

## 6. Contraintes techniques

**Next.js 16 :**
- Utiliser `proxy.ts`, PAS `middleware.ts`
- Rester compatible avec les conventions Next.js 16

**Supabase :**
- La legacy anon key est plus fiable que `sb_publishable_`
- La logique RLS autour de `is_admin()` est sensible — modifier avec prudence

**Python :**
- `csv_path` doit être relatif à `BASE_DIR` (requis pour GitHub Actions)
- L'environnement virtuel est dans `python_script/venv/` (ne pas committer)

---

## 7. Standards de code

- TypeScript strict — pas de `any` sans justification
- Tailwind CSS uniquement pour le style (pas de CSS inline)
- Composants Server par défaut; `"use client"` seulement si nécessaire
- `async/await` — pas de `.then()` chaîné
- Nommage : composants en PascalCase, fonctions/variables en camelCase, fichiers en kebab-case

---

## 8. Responsive (mobile)

Les pages **admin** sont desktop-only — pas de responsive requis.

Les pages de **consultation publique** doivent être utilisables sur mobile.
Règle : quand on touche une page de consultation, on la rend responsive en même temps.

- `overflow-x-auto` sur tous les conteneurs de `<table>`
- Masquer les colonnes secondaires sur mobile : `hidden sm:table-cell`
- Pas de layout en colonnes côte à côte sur mobile (`flex-wrap` ou `grid-cols-1`)

Pages de consultation : `/`, `/joueurs`, `/statistiques`, `/repechage`,
`/poolers`, `/poolers/[id]`, `/transactions`, `/series`, `/series/picks`, `/aide`

---

## 9. Page Aide (`/aide`)

`app/app/aide/page.tsx` contient trois sections :
- **Installation** : instructions PWA (ordinateur, iPhone, Android)
- **Guide d'utilisation** : instructions par fonctionnalité (à compléter au fil des livraisons)
- **Règlements** : règles métier du pool visibles par les poolers

**Règle :** lors de l'ajout ou modification d'une fonctionnalité accessible aux poolers,
évaluer si `/aide` (Guide ou Règlements) doit être mis à jour.

---

## 10. Workflow Git (automatique)

Après chaque tâche complétée, exécuter **sans demander confirmation** :

```bash
# 1. Mettre à jour SUIVI_PROJET.md (voir section 11)
# 2. Stager tous les changements
git add -A
# 3. Committer avec message conventionnel
git commit -m "type(scope): description en français"
# 4. Pousser
git push
```

**Format des commits :**
```
type(scope): description courte en français

Types : feat | fix | docs | refactor | style | chore | test
Exemples :
  feat(rosters): ajout filtre par saison
  fix(admin): correction calcul du cap
  docs(aide): mise à jour guide notifications
  refactor(standings): extraction buildStandings vers lib/standings.ts
```

**Exceptions** (demander confirmation avant de committer) :
- Conflit Git détecté
- Changements dans `schema.sql` ou migrations Supabase
- Modifications de `.env.local` ou variables d'environnement

---

## 11. Documentation automatique

À chaque fin de tâche, mettre à jour `SUIVI_PROJET.md` avec :

```markdown
### AAAA-MM-JJ

**[Type] — description courte** (`fichier/modifie.tsx`, `autre/fichier.ts`) :
- Ce qui a été fait et pourquoi
- Décisions importantes ou compromis
- Commit : `[hash]`
```

**Règles :**
- Ne jamais laisser une session se terminer sans mettre à jour `SUIVI_PROJET.md`
- Si une route, composant ou règle métier change → évaluer si `CLAUDE.md` doit aussi être mis à jour
- `CLAUDE.md` ne change que si une information de **référence stable** change (architecture, stack, conventions, règles métier)

---

## 12. Fichiers importants à connaître

| Fichier | Rôle |
|---|---|
| `app/app/layout.tsx` | Layout global + Navbar |
| `app/app/page.tsx` | Page d'accueil (classement + matchs du jour) |
| `app/components/Navbar.tsx` | Navigation principale (dropdowns) |
| `app/lib/supabase/server.ts` | Client Supabase côté serveur |
| `app/lib/supabase/client.ts` | Client Supabase côté client |
| `app/lib/standings.ts` | Logique classement (`buildStandings`) |
| `app/lib/streaks.ts` | Indicateurs de séquence (badges 🔥✅🧊) |
| `app/proxy.ts` | Auth + redirections (remplace middleware.ts) |
| `python_script/run_pipeline.py` | Point d'entrée pipeline de données |
| `schema.sql` | Schéma de référence BD |
| `supabase_migrations/` | Migrations SQL historiques |

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
