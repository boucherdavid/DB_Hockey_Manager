-- Ajouter le type 'live_cache' pour les snapshots mis à jour par le pipeline GitHub Action
ALTER TABLE player_stat_snapshots
  DROP CONSTRAINT IF EXISTS player_stat_snapshots_snapshot_type_check;

ALTER TABLE player_stat_snapshots
  ADD CONSTRAINT player_stat_snapshots_snapshot_type_check
  CHECK (snapshot_type IN ('activation', 'deactivation', 'season_end', 'deadline_baseline', 'live_cache'));
