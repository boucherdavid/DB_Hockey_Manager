-- Supprimer la contrainte UNIQUE sur playoff_pool_rosters pour permettre
-- les réactivations multi-période (un joueur peut avoir plusieurs fenêtres
-- added_at → removed_at dans la même saison pour le même pooler).
-- La table utilise INSERT pur (jamais UPSERT) depuis la migration game-logs.
--
-- À exécuter sur prod ET staging si la contrainte existe.

ALTER TABLE playoff_pool_rosters
DROP CONSTRAINT IF EXISTS playoff_pool_rosters_pool_season_id_pooler_id_player_id_key;

CREATE INDEX IF NOT EXISTS idx_playoff_pool_rosters_lookup
ON playoff_pool_rosters (pool_season_id, pooler_id, player_id);
