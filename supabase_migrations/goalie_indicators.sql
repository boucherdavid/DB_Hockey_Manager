-- Indicateurs de performance spécifiques aux gardiens
-- Stockés dans pool_seasons (saison régulière uniquement)
ALTER TABLE pool_seasons
  ADD COLUMN IF NOT EXISTS indicator_goalie_wins_streak INTEGER,      -- min victoires consécutives (départs)
  ADD COLUMN IF NOT EXISTS indicator_goalie_sv_pct      NUMERIC(5,3), -- sv% minimum (0.0–1.0), ex : 0.930
  ADD COLUMN IF NOT EXISTS indicator_goalie_gaa         NUMERIC(4,2), -- GAA maximale, ex : 2.50
  ADD COLUMN IF NOT EXISTS indicator_goalie_min_games   INTEGER;      -- min départs dans la fenêtre sv%/GAA
