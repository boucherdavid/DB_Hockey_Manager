-- Migration : conférence NHL par équipe + conférence dans playoff_rosters
-- À exécuter dans Supabase SQL Editor

ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS conference VARCHAR(10);

UPDATE teams SET conference = 'Est'   WHERE code IN ('BOS','BUF','CAR','CBJ','DET','FLA','MTL','NJD','NYI','NYR','OTT','PHI','PIT','TBL','TOR','WSH');
UPDATE teams SET conference = 'Ouest' WHERE code IN ('ANA','CGY','CHI','COL','DAL','EDM','LAK','MIN','NSH','SEA','SJS','STL','UTA','VAN','VGK','WPG');

ALTER TABLE playoff_rosters
  ADD COLUMN IF NOT EXISTS conference VARCHAR(10);