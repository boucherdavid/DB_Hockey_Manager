# Python scripts

Ce dossier centralise le pipeline de donnees utilise par l'application.

## Scripts principaux

- `scrape_puckpedia.py`: script principal pour lancer le scraping PuckPedia
- `import_supabase.py`: script principal pour importer les joueurs et contrats vers Supabase

## Dossiers

- `source/`: fichiers CSV d'entree pour les equipes a scraper
- `teams_offline/`: exports CSV par equipe
- `diagnostics/`: HTML sauvegardes pendant le scraping pour debogage
- `archive/legacy/`: anciennes sorties et references non executables

## Fichiers de sortie

- `PuckPedia_update.csv`: fichier fusionne principal pour l'import
- `PuckPedia_offline.csv`: sortie offline agregee du scraping

## Utilisation

Depuis `python_script/`:

```bash
python scrape_puckpedia.py
python import_supabase.py
```

## Notes

- Le fichier `.env` local est utilise par `import_supabase.py`.
- Les dossiers `venv/`, `chrome-win64/` et autres artefacts externes n'ont pas ete rapatries ici.
