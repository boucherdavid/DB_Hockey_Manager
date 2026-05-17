-- Migration : table player_game_logs
-- Remplace le système de snapshots (player_stat_snapshots) pour le calcul des points.
-- Les points sont calculés en agrégeant les game-logs dans les fenêtres d'activation
-- (playoff_pool_rosters.added_at → removed_at, ou pooler_rosters.activated_at → deactivated_at).
--
-- Règle d'activation :
--   - Les stats d'un match comptent si le joueur était activé AVANT l'heure de mise en jeu
--     (added_at < game_start_time) ET non encore désactivé (removed_at IS NULL OR removed_at >= game_start_time).
--
-- À exécuter dans Supabase SQL Editor.

-- ── player_game_logs ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS player_game_logs (
  id               SERIAL       PRIMARY KEY,
  player_id        INTEGER      NOT NULL REFERENCES players(id),
  nhl_id           INTEGER      NOT NULL,
  game_date        DATE         NOT NULL,
  game_start_time  TIMESTAMPTZ  NOT NULL,   -- heure UTC de mise en jeu (pour comparaison avec added_at)
  season           INTEGER      NOT NULL,   -- ex: 20252026
  game_type        INTEGER      NOT NULL,   -- 2 = saison régulière, 3 = séries
  goals            INTEGER      NOT NULL DEFAULT 0,
  assists          INTEGER      NOT NULL DEFAULT 0,
  goalie_wins      INTEGER      NOT NULL DEFAULT 0,
  goalie_otl       INTEGER      NOT NULL DEFAULT 0,
  goalie_shutouts  INTEGER      NOT NULL DEFAULT 0,
  UNIQUE(player_id, game_date, season, game_type)
);

-- Index pour les jointures fréquentes dans le calcul des standings
CREATE INDEX IF NOT EXISTS idx_game_logs_player_season_type
  ON player_game_logs(player_id, season, game_type);

CREATE INDEX IF NOT EXISTS idx_game_logs_date
  ON player_game_logs(game_date);

-- RLS
ALTER TABLE player_game_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lecture publique game_logs"
  ON player_game_logs FOR SELECT USING (true);

CREATE POLICY "admin modifie game_logs"
  ON player_game_logs FOR ALL
  USING (EXISTS (SELECT 1 FROM poolers WHERE id = auth.uid() AND is_admin = true));


-- ── Suppression de player_stat_snapshots (à exécuter après validation) ───────
-- Une fois que les standings sont validés avec player_game_logs, lancer :
--
--   DROP TABLE IF EXISTS player_stat_snapshots CASCADE;
--
-- Ne pas lancer immédiatement — garder en parallèle le temps de valider.
