-- Date de fin de saison pour le filtrage de l'historique des changements.
-- Les entrées roster_change_log dont changed_at > saison_end_date
-- n'apparaissent pas dans l'onglet Historique du pooler.
ALTER TABLE pool_seasons
  ADD COLUMN IF NOT EXISTS saison_end_date DATE;
