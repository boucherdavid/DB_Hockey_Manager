export type DraftSourceKey =
  | 'elite_prospects' | 'tsn_button' | 'tsn_peters' | 'mckeens' | 'thn_ferrari' | 'thn_kennedy'
  | 'daily_faceoff' | 'flohockey_peters' | 'central_scouting_na' | 'central_scouting_eu'
  | 'draft_prospects_hockey' | 'sportsnet_cosentino' | 'sportsnet_bukala'
  | 'smaht_scouting' | 'dobber_prospects' | 'hpr_malloy'

export type DraftSource = { key: DraftSourceKey; label: string; abbr: string; infoOnly?: true }

// infoOnly : source exclue du rang moyen (listes par catégorie NA/EU, pas un classement global)
export const DRAFT_SOURCES: DraftSource[] = [
  { key: 'elite_prospects',        abbr: 'EP',    label: 'EliteProspects.com' },
  { key: 'tsn_button',             abbr: 'TSN-B', label: 'TSN / Craig Button' },
  { key: 'tsn_peters',             abbr: 'TSN-P', label: 'TSN / Chris Peters' },
  { key: 'mckeens',                abbr: 'MK',    label: "McKeen's Hockey" },
  { key: 'thn_ferrari',            abbr: 'THN-F', label: 'THN / Ferrari' },
  { key: 'thn_kennedy',            abbr: 'THN-K', label: 'THN / Kennedy' },
  { key: 'daily_faceoff',          abbr: 'DF',    label: 'Daily Faceoff' },
  { key: 'flohockey_peters',       abbr: 'FHO',   label: 'FloHockey / Chris Peters' },
  { key: 'draft_prospects_hockey', abbr: 'DPH',   label: 'Draft Prospects Hockey' },
  { key: 'sportsnet_cosentino',    abbr: 'SN-C',  label: 'Sportsnet / Cosentino' },
  { key: 'sportsnet_bukala',       abbr: 'SN-B',  label: 'Sportsnet / Bukala' },
  { key: 'smaht_scouting',         abbr: 'SM',    label: 'Smaht Scouting' },
  { key: 'dobber_prospects',       abbr: 'DBR',   label: 'DobberProspects' },
  { key: 'hpr_malloy',             abbr: 'HPR',   label: 'HPR / Malloy' },
  { key: 'central_scouting_na',    abbr: 'CS-NA', label: 'NHL Central Scouting (NA)', infoOnly: true },
  { key: 'central_scouting_eu',    abbr: 'CS-EU', label: 'NHL Central Scouting (EU)', infoOnly: true },
]

export const DRAFT_SOURCES_RANKED  = DRAFT_SOURCES.filter(s => !s.infoOnly)
export const DRAFT_SOURCES_INFOONLY = DRAFT_SOURCES.filter(s => s.infoOnly)

export const DRAFT_SOURCE_LABELS: Record<string, string> =
  Object.fromEntries(DRAFT_SOURCES.map(s => [s.key, s.label]))
