-- Rondes de repêchage configurables par saison
ALTER TABLE pool_seasons
  ADD COLUMN IF NOT EXISTS draft_rounds INTEGER NOT NULL DEFAULT 4;

-- Retirer la contrainte fixe (round BETWEEN 1 AND 4)
ALTER TABLE pool_draft_picks
  DROP CONSTRAINT IF EXISTS pool_draft_picks_round_check;

ALTER TABLE pool_draft_picks
  ADD CONSTRAINT pool_draft_picks_round_check CHECK (round >= 1);
