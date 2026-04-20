-- Migration : pool des séries (Chantier E)
-- À exécuter dans Supabase SQL Editor

CREATE TABLE playoff_seasons (
  id            SERIAL PRIMARY KEY,
  season        VARCHAR(7)     NOT NULL UNIQUE,  -- ex: '2025-26'
  current_round INT            NOT NULL DEFAULT 1,
  is_active     BOOLEAN        NOT NULL DEFAULT false,
  cap_per_round DECIMAL(12,2)  NOT NULL DEFAULT 25000000
);

CREATE TABLE playoff_rosters (
  id                  SERIAL PRIMARY KEY,
  playoff_season_id   INT          NOT NULL REFERENCES playoff_seasons(id) ON DELETE CASCADE,
  pooler_id           UUID         NOT NULL REFERENCES poolers(id),
  player_id           INT          NOT NULL REFERENCES players(id),
  round_added         INT          NOT NULL,
  added_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
  removed_at          TIMESTAMPTZ,
  is_active           BOOLEAN      NOT NULL DEFAULT true,
  -- Snapshot des stats playoff au moment de l'ajout
  snap_goals          INT          NOT NULL DEFAULT 0,
  snap_assists        INT          NOT NULL DEFAULT 0,
  snap_goalie_wins    INT          NOT NULL DEFAULT 0,
  snap_goalie_otl     INT          NOT NULL DEFAULT 0,
  snap_goalie_shutouts INT         NOT NULL DEFAULT 0
);

-- Index pour les requêtes fréquentes
CREATE INDEX idx_playoff_rosters_season_pooler
  ON playoff_rosters(playoff_season_id, pooler_id);

CREATE INDEX idx_playoff_rosters_active
  ON playoff_rosters(playoff_season_id, is_active);

-- RLS
ALTER TABLE playoff_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE playoff_rosters ENABLE ROW LEVEL SECURITY;

-- playoff_seasons : lecture publique, écriture admin
CREATE POLICY "playoff_seasons_read" ON playoff_seasons
  FOR SELECT USING (true);

CREATE POLICY "playoff_seasons_admin" ON playoff_seasons
  FOR ALL USING (is_admin());

-- playoff_rosters : lecture publique, écriture par le pooler lui-même ou admin
CREATE POLICY "playoff_rosters_read" ON playoff_rosters
  FOR SELECT USING (true);

CREATE POLICY "playoff_rosters_write_self" ON playoff_rosters
  FOR ALL USING (pooler_id = auth.uid() OR is_admin());
