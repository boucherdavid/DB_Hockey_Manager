-- Sauvegarde des choix de repêchage en cours (avant soumission)
ALTER TABLE pool_draft_picks
  ADD COLUMN IF NOT EXISTS pending_player_id INTEGER REFERENCES players(id) ON DELETE SET NULL;
