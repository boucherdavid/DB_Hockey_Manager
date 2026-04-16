-- Migration : scoring_config
-- À exécuter dans Supabase SQL Editor

CREATE TABLE scoring_config (
  id SERIAL PRIMARY KEY,
  stat_key VARCHAR(30) UNIQUE NOT NULL,
  label VARCHAR(100) NOT NULL,
  points DECIMAL(5,2) NOT NULL DEFAULT 1,
  scope VARCHAR(20) NOT NULL DEFAULT 'both'
    CHECK (scope IN ('regular', 'playoffs', 'both'))
);

INSERT INTO scoring_config (stat_key, label, points, scope) VALUES
  ('goal',       'But',                                      1, 'both'),
  ('assist',     'Passe',                                    1, 'both'),
  ('goalie_win', 'Victoire (gardien)',                       2, 'both'),
  ('goalie_otl', 'Défaite en prol./fusillade (gardien)',     1, 'both');
