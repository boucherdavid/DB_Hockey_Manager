-- Date de début de saison pour le comptage des points.
-- Tant que NOW() < saison_start_date, on est en mode pré-saison :
--   - added_at dans pooler_rosters = saison_start_date
--   - aucune entrée dans roster_change_log
ALTER TABLE pool_seasons
  ADD COLUMN IF NOT EXISTS saison_start_date DATE;

-- Création de roster_change_log si elle n'existe pas encore (ex: staging).
CREATE TABLE IF NOT EXISTS roster_change_log (
  id             SERIAL PRIMARY KEY,
  player_id      INTEGER     NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  pooler_id      UUID        NOT NULL REFERENCES poolers(id) ON DELETE CASCADE,
  pool_season_id INTEGER     NOT NULL REFERENCES pool_seasons(id) ON DELETE CASCADE,
  change_type    VARCHAR(50) NOT NULL,
  old_type       VARCHAR(30),
  new_type       VARCHAR(30),
  changed_by     UUID REFERENCES poolers(id) ON DELETE SET NULL,  -- NULL = admin
  changed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_admin_override BOOLEAN  NOT NULL DEFAULT false
);

-- Indicateur d'override de date par l'admin dans l'historique.
-- Ajout conditionnel si la table existait déjà en production.
ALTER TABLE roster_change_log
  ADD COLUMN IF NOT EXISTS is_admin_override BOOLEAN NOT NULL DEFAULT false;

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS roster_change_log_pooler_season
  ON roster_change_log (pooler_id, pool_season_id);

-- RLS (idempotent : ENABLE RLS ne fail pas si déjà activé)
ALTER TABLE roster_change_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "Lecture publique roster_change_log"
    ON roster_change_log FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Admin modifie roster_change_log"
    ON roster_change_log FOR ALL
    USING (
      EXISTS (SELECT 1 FROM poolers WHERE id = auth.uid() AND is_admin = true)
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
