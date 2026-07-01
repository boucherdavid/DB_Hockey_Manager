-- Migration : DraftCenter v2 — retrait recruit_scouting de la contrainte source
-- À exécuter dans Supabase SQL Editor

ALTER TABLE draft_prospect_rankings
  DROP CONSTRAINT draft_prospect_rankings_source_check;

ALTER TABLE draft_prospect_rankings
  ADD CONSTRAINT draft_prospect_rankings_source_check
  CHECK (source IN (
    'elite_prospects', 'tsn_button', 'tsn_peters', 'mckeens', 'thn_ferrari', 'thn_kennedy',
    'daily_faceoff', 'flohockey_peters', 'central_scouting_na', 'central_scouting_eu',
    'draft_prospects_hockey', 'sportsnet_cosentino', 'sportsnet_bukala',
    'smaht_scouting', 'dobber_prospects', 'hpr_malloy'
  ));
