-- Permet de journaliser le transfert d'un choix de repêchage dans roster_change_log,
-- en plus des mouvements de joueurs (onglet Historique — "Échange entre poolers" avec picks).
-- player_id devient optionnel : une ligne de journal représente soit un joueur (player_id
-- rempli, pick_id null), soit un choix de repêchage (pick_id rempli, player_id null).
-- Déjà appliqué en staging et prod le 2026-07-16.
ALTER TABLE roster_change_log ALTER COLUMN player_id DROP NOT NULL;
ALTER TABLE roster_change_log ADD COLUMN IF NOT EXISTS pick_id INTEGER REFERENCES pool_draft_picks(id) ON DELETE SET NULL;
