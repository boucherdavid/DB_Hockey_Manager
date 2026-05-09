-- Rendre les seuils EN FORME et EN CRISE configurables indépendamment
ALTER TABLE pool_seasons
  ADD COLUMN IF NOT EXISTS indicator_streak_forme  INTEGER,
  ADD COLUMN IF NOT EXISTS indicator_streak_crise  INTEGER;
