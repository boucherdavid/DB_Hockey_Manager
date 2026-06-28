-- Migration : DraftCenter (rankings de prospects repêchage LNH)
-- À exécuter dans Supabase SQL Editor

CREATE TABLE draft_prospects (
  id            SERIAL PRIMARY KEY,
  draft_year    INT          NOT NULL,
  first_name    VARCHAR(60)  NOT NULL,
  last_name     VARCHAR(60)  NOT NULL,
  position      VARCHAR(10),
  team          VARCHAR(100), -- équipe + ligue, ex: "Penn State Univ., NCAA"
  games_played  INT,
  goals         INT,
  assists       INT,
  points        INT,
  pim           INT,
  notes         TEXT
);

CREATE TABLE draft_prospect_rankings (
  id           SERIAL PRIMARY KEY,
  prospect_id  INT          NOT NULL REFERENCES draft_prospects(id) ON DELETE CASCADE,
  source       VARCHAR(40)  NOT NULL
    CHECK (source IN (
      'elite_prospects', 'tsn_button', 'tsn_peters', 'mckeens', 'thn_ferrari', 'thn_kennedy',
      'daily_faceoff', 'flohockey_peters', 'central_scouting_na', 'central_scouting_eu',
      'draft_prospects_hockey', 'sportsnet_cosentino', 'sportsnet_bukala', 'recruit_scouting',
      'smaht_scouting', 'dobber_prospects', 'hpr_malloy'
    )),
  source_url   TEXT,
  rank         INT          NOT NULL,
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE(prospect_id, source)
);

CREATE INDEX idx_draft_prospects_year ON draft_prospects(draft_year);
CREATE INDEX idx_draft_prospect_rankings_prospect ON draft_prospect_rankings(prospect_id);

-- RLS
ALTER TABLE draft_prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_prospect_rankings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "draft_prospects_read" ON draft_prospects
  FOR SELECT USING (true);

CREATE POLICY "draft_prospects_admin" ON draft_prospects
  FOR ALL USING (is_admin());

CREATE POLICY "draft_prospect_rankings_read" ON draft_prospect_rankings
  FOR SELECT USING (true);

CREATE POLICY "draft_prospect_rankings_admin" ON draft_prospect_rankings
  FOR ALL USING (is_admin());
