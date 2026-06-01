-- Migration : suppression des vieilles tables du pool des séries
-- Supersédées par pool_seasons (is_playoff=true) + playoff_pool_rosters
-- Plus aucune référence dans le code (vérifié 2026-06-01)
-- À exécuter dans Supabase SQL Editor

-- playoff_rosters en premier (FK vers playoff_seasons)
DROP TABLE IF EXISTS playoff_rosters CASCADE;
DROP TABLE IF EXISTS playoff_seasons CASCADE;
