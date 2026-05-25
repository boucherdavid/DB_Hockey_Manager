-- Date de début de saison pour le comptage des points.
-- Tant que NOW() < saison_start_date, on est en mode pré-saison :
--   - added_at dans pooler_rosters = saison_start_date
--   - aucune entrée dans roster_change_log
ALTER TABLE pool_seasons
  ADD COLUMN IF NOT EXISTS saison_start_date DATE;

-- Indicateur d'override de date par l'admin dans l'historique.
-- Mis à true quand l'admin utilise le toggle "Forcer une date effective".
ALTER TABLE roster_change_log
  ADD COLUMN IF NOT EXISTS is_admin_override BOOLEAN DEFAULT false;
