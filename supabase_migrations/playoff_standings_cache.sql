-- Cache du classement du pool des séries par pooler
-- Mis à jour à chaque visite de /classement-series (fetchLive=true)
-- Permet à la page d'accueil de lire les standings sans appels API NHL
CREATE TABLE IF NOT EXISTS playoff_pool_standings_cache (
  pool_season_id INTEGER NOT NULL REFERENCES pool_seasons(id) ON DELETE CASCADE,
  pooler_id      UUID    NOT NULL REFERENCES poolers(id)      ON DELETE CASCADE,
  total_pts      INTEGER NOT NULL DEFAULT 0,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (pool_season_id, pooler_id)
);
