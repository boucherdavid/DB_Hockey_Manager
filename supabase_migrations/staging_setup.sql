-- =============================================
-- STAGING SETUP — Migrations manquantes
-- À exécuter dans le SQL Editor du projet staging
-- après avoir appliqué schema.sql
-- =============================================

-- Fonction is_admin() utilisée dans certaines policies RLS
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM poolers WHERE id = auth.uid() AND is_admin = true);
$$ LANGUAGE sql SECURITY DEFINER;

-- ── teams ─────────────────────────────────────────────────────────────────────
ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS conference VARCHAR(10);

UPDATE teams SET conference = 'Est'
  WHERE code IN ('BOS','BUF','CAR','CBJ','DET','FLA','MTL','NJD','NYI','NYR','OTT','PHI','PIT','TBL','TOR','WSH');
UPDATE teams SET conference = 'Ouest'
  WHERE code IN ('ANA','CGY','CHI','COL','DAL','EDM','LAK','MIN','NSH','SEA','SJS','STL','UTA','VAN','VGK','WPG');

-- ── player_contracts ──────────────────────────────────────────────────────────
ALTER TABLE player_contracts
  ADD COLUMN IF NOT EXISTS is_elc BOOLEAN NOT NULL DEFAULT false;

-- ── pool_seasons ──────────────────────────────────────────────────────────────
ALTER TABLE pool_seasons
  ADD COLUMN IF NOT EXISTS is_playoff                  BOOLEAN      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS presaison_draft_order       JSONB,
  ADD COLUMN IF NOT EXISTS delai_reactivation_jours    INTEGER      NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS max_signatures_al           INTEGER      NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS max_signatures_ltir         INTEGER      NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS gestion_effectifs_ouvert    BOOLEAN      NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS playoff_submission_deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS playoff_max_changes         INTEGER,
  ADD COLUMN IF NOT EXISTS playoff_max_elim_changes    INTEGER,
  ADD COLUMN IF NOT EXISTS playoff_max_f               INTEGER,
  ADD COLUMN IF NOT EXISTS playoff_max_d               INTEGER,
  ADD COLUMN IF NOT EXISTS playoff_max_g               INTEGER,
  ADD COLUMN IF NOT EXISTS indicator_streak_chaud      INTEGER,
  ADD COLUMN IF NOT EXISTS indicator_streak_froid      INTEGER,
  ADD COLUMN IF NOT EXISTS indicator_fenetre_tendance  INTEGER,
  ADD COLUMN IF NOT EXISTS next_nhl_cap                DECIMAL(12,2);

-- ── poolers ───────────────────────────────────────────────────────────────────
ALTER TABLE poolers
  ADD COLUMN IF NOT EXISTS phone       VARCHAR(20),
  ADD COLUMN IF NOT EXISTS notif_email BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_sms   BOOLEAN NOT NULL DEFAULT false;

-- ── pool_draft_picks ──────────────────────────────────────────────────────────
ALTER TABLE pool_draft_picks
  ADD COLUMN IF NOT EXISTS draft_order INTEGER;

-- ── pooler_rosters ────────────────────────────────────────────────────────────
ALTER TABLE pooler_rosters
  ADD COLUMN IF NOT EXISTS draft_pick_id   INTEGER REFERENCES pool_draft_picks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pool_draft_year INTEGER,
  ADD COLUMN IF NOT EXISTS rookie_type     VARCHAR(20) CHECK (rookie_type IN ('repeche', 'agent_libre'));

ALTER TABLE pooler_rosters DROP CONSTRAINT IF EXISTS pooler_rosters_player_type_check;
ALTER TABLE pooler_rosters ADD CONSTRAINT pooler_rosters_player_type_check
  CHECK (player_type IN ('actif', 'reserviste', 'recrue', 'ltir'));

-- ── player_stat_snapshots ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS player_stat_snapshots (
  id             SERIAL PRIMARY KEY,
  player_id      INTEGER  NOT NULL REFERENCES players(id),
  pooler_id      UUID     NOT NULL REFERENCES poolers(id),
  pool_season_id INTEGER  NOT NULL REFERENCES pool_seasons(id),
  snapshot_type  VARCHAR(20) NOT NULL CHECK (snapshot_type IN ('activation', 'deactivation', 'season_end', 'deadline_baseline')),
  taken_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  goals          INTEGER NOT NULL DEFAULT 0,
  assists        INTEGER NOT NULL DEFAULT 0,
  goalie_wins    INTEGER NOT NULL DEFAULT 0,
  goalie_otl     INTEGER NOT NULL DEFAULT 0,
  goalie_shutouts INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE player_stat_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lecture publique snapshots" ON player_stat_snapshots FOR SELECT USING (true);
CREATE POLICY "admin modifie snapshots"    ON player_stat_snapshots FOR ALL
  USING (EXISTS (SELECT 1 FROM poolers WHERE id = auth.uid() AND is_admin = true));

-- ── playoff_participating_teams ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS playoff_participating_teams (
  id             SERIAL PRIMARY KEY,
  pool_season_id INTEGER NOT NULL REFERENCES pool_seasons(id) ON DELETE CASCADE,
  team_id        INTEGER NOT NULL REFERENCES teams(id),
  UNIQUE (pool_season_id, team_id)
);
ALTER TABLE playoff_participating_teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lecture publique playoff_participating_teams" ON playoff_participating_teams
  FOR SELECT USING (true);
CREATE POLICY "admin modifie playoff_participating_teams"    ON playoff_participating_teams
  FOR ALL USING (is_admin());

-- ── playoff_pool_rosters ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS playoff_pool_rosters (
  id             SERIAL PRIMARY KEY,
  pooler_id      UUID    NOT NULL REFERENCES poolers(id),
  player_id      INTEGER NOT NULL REFERENCES players(id),
  pool_season_id INTEGER NOT NULL REFERENCES pool_seasons(id),
  position_slot  VARCHAR(1) NOT NULL CHECK (position_slot IN ('F', 'D', 'G')),
  is_active      BOOLEAN NOT NULL DEFAULT true,
  added_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  removed_at     TIMESTAMPTZ,
  removal_reason VARCHAR(20) CHECK (removal_reason IN ('voluntary', 'elimination'))
);
ALTER TABLE playoff_pool_rosters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lecture publique playoff_pool_rosters" ON playoff_pool_rosters
  FOR SELECT USING (true);
CREATE POLICY "admin modifie playoff_pool_rosters" ON playoff_pool_rosters
  FOR ALL USING (is_admin());
CREATE POLICY "pooler modifie ses picks séries" ON playoff_pool_rosters
  FOR ALL USING (pooler_id = auth.uid() OR is_admin());

-- ── notification_log ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_log (
  id      BIGSERIAL PRIMARY KEY,
  title   TEXT        NOT NULL,
  body    TEXT        NOT NULL,
  url     TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ
);
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_only" ON notification_log FOR ALL USING (is_admin());

-- ── playoff_eliminations ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS playoff_eliminations (
  id                  SERIAL PRIMARY KEY,
  pool_season_id      INTEGER NOT NULL REFERENCES pool_seasons(id) ON DELETE CASCADE,
  team_id             INTEGER NOT NULL REFERENCES teams(id),
  eliminated_in_round INTEGER,
  UNIQUE (pool_season_id, team_id)
);
ALTER TABLE playoff_eliminations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lecture publique playoff_eliminations" ON playoff_eliminations
  FOR SELECT USING (true);
CREATE POLICY "admin modifie playoff_eliminations" ON playoff_eliminations
  FOR ALL USING (is_admin());

-- ── scoring_config : ajout gwg si absent ─────────────────────────────────────
INSERT INTO scoring_config (stat_key, label, points, points_playoffs, scope)
VALUES ('gwg', 'But gagnant (attaquant)', 0.0, 1.0, 'both')
ON CONFLICT (stat_key) DO NOTHING;
