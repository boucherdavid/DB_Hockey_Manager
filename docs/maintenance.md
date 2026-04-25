# Guide de maintenance — Hockey Pool App

Ce document décrit les opérations manuelles à effectuer pour maintenir l'application à jour : scripts Python et migrations SQL.

---

## Scripts Python

### Pipeline automatique (recommandé)

Le script `run_pipeline.py` enchaîne toutes les étapes dans le bon ordre :

```bash
cd python_script

# Pipeline complet (scraping + import + backfill)
python run_pipeline.py

# Import seulement, sans scraping (plus rapide, si PuckPedia n'a pas changé)
python run_pipeline.py --no-scrape
```

Le pipeline s'arrête automatiquement si une étape obligatoire échoue.

---

### Scripts individuels (ordre à respecter)

#### Étape 1 — `scrape_puckpedia.py`
**Quand :** En début de saison, après des transactions majeures dans la LNH, ou quand les contrats ont changé.
**Nécessite :** Chrome installé (Selenium).
**Produit :** Fichiers CSV dans `python_script/source/` et `python_script/teams_offline/`.

```bash
python scrape_puckpedia.py
```

#### Étape 2 — `import_supabase.py`
**Quand :** Après chaque scraping, ou directement si les CSV sont à jour.
**Dépend de :** Étape 1 (fichiers CSV présents dans `source/`).
**Effet :** Met à jour joueurs, contrats et statuts dans Supabase. Les joueurs absents du run courant sont marqués `is_available = False`.

```bash
python import_supabase.py
```

#### Étape 3 — `import_drafts.py`
**Quand :** Après chaque import Supabase. Obligatoire si de nouveaux joueurs repêchés doivent apparaître dans la banque de recrues.
**Dépend de :** Étape 2 (joueurs déjà en base pour que PuckPedia ait la priorité).
**Effet :** Synchronise les repêchages des 5 dernières saisons depuis l'API NHL. Ajoute `draft_year/round/overall` et `is_rookie = True`.

```bash
python import_drafts.py
```

#### Étape 4 — `backfill_nhl_ids.py` *(optionnelle)*
**Quand :** Après un import si de nouveaux joueurs ont été ajoutés et n'ont pas encore de `nhl_id`. Utile en début de saison ou après le repêchage.
**Effet :** Associe les identifiants NHL officiels (`nhl_id`) aux joueurs sans correspondance. Les `nhl_id` sont essentiels pour les snapshots de stats du classement.

```bash
# Prévisualiser sans modifier la BD
python backfill_nhl_ids.py --dry-run

# Appliquer les corrections
python backfill_nhl_ids.py
```

---

### Scripts ponctuels (à la demande)

#### `fix_null_positions.py`
**Quand :** Si des joueurs ont `position = NULL` après un import (le scraper PuckPedia échoue parfois à détecter la position). À vérifier après chaque import.
**Effet :** Cherche la position via l'API NHL et met à jour la BD.

```bash
# Prévisualiser sans modifier la BD
python fix_null_positions.py --dry-run

# Appliquer les corrections
python fix_null_positions.py
```

---

### Automatisation (GitHub Actions)

Le pipeline complet s'exécute automatiquement **chaque lundi à 6h UTC** via `.github/workflows/import.yml`.
Il peut aussi être déclenché manuellement depuis l'onglet Actions du dépôt GitHub.

Les secrets suivants doivent être configurés dans GitHub :
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`

---

## Migrations SQL

Les migrations SQL sont à exécuter **manuellement dans le SQL Editor de Supabase** lorsqu'une nouvelle fonctionnalité modifie la structure de la base de données.

> L'état cible de toutes les tables est documenté dans `schema.sql` à la racine du projet.
> Les migrations déjà exécutées y sont listées en commentaire dans la section `-- MIGRATIONS`.

### Migrations déjà exécutées

Toutes les migrations listées dans `schema.sql` ont été appliquées. La base Supabase est à jour.

### Comment appliquer une nouvelle migration

1. Ouvrir [Supabase](https://app.supabase.com) → projet → **SQL Editor**
2. Coller le SQL de la migration
3. Exécuter
4. Mettre à jour `schema.sql` pour refléter le nouvel état
5. Documenter la migration dans `SUIVI_PROJET.md`

---

## Résumé — ordre d'opérations typique en début/milieu de saison

| Ordre | Opération | Fréquence |
|-------|-----------|-----------|
| 1 | `run_pipeline.py` (ou étapes 1→4 séparément) | Hebdomadaire (automatisé lundi) |
| 2 | `fix_null_positions.py` si positions NULL détectées | Au besoin après import |
| 3 | Migrations SQL si une nouvelle fonctionnalité est déployée | À chaque mise à jour qui modifie le schéma |
| 4 | Sync fin de saison via bouton `/admin/config` | Une fois en fin de saison régulière |
