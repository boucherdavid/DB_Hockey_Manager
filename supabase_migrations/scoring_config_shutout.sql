-- Migration : ajout du blanchissage dans scoring_config
INSERT INTO scoring_config (stat_key, label, points, scope) VALUES
  ('goalie_shutout', 'Blanchissage (gardien)', 2, 'both');
