export type DraftSourceKey =
  | 'elite_prospects' | 'tsn_button' | 'tsn_peters' | 'mckeens' | 'thn_ferrari' | 'thn_kennedy'
  | 'daily_faceoff' | 'flohockey_peters' | 'central_scouting_na' | 'central_scouting_eu'
  | 'draft_prospects_hockey' | 'sportsnet_cosentino' | 'sportsnet_bukala' | 'recruit_scouting'
  | 'smaht_scouting' | 'dobber_prospects' | 'hpr_malloy'

export const DRAFT_SOURCES: { key: DraftSourceKey; label: string }[] = [
  { key: 'elite_prospects',        label: 'EliteProspects.com' },
  { key: 'tsn_button',             label: 'TSN / Craig Button' },
  { key: 'tsn_peters',             label: 'TSN / Chris Peters' },
  { key: 'mckeens',                label: "McKeen's Hockey" },
  { key: 'thn_ferrari',            label: 'THN / Ferrari' },
  { key: 'thn_kennedy',            label: 'THN / Kennedy' },
  { key: 'daily_faceoff',          label: 'Daily Faceoff' },
  { key: 'flohockey_peters',       label: 'FloHockey / Chris Peters' },
  { key: 'central_scouting_na',    label: 'NHL Central Scouting (NA)' },
  { key: 'central_scouting_eu',    label: 'NHL Central Scouting (EU)' },
  { key: 'draft_prospects_hockey', label: 'Draft Prospects Hockey' },
  { key: 'sportsnet_cosentino',    label: 'Sportsnet / Cosentino' },
  { key: 'sportsnet_bukala',       label: 'Sportsnet / Bukala' },
  { key: 'recruit_scouting',       label: 'Recruit Scouting' },
  { key: 'smaht_scouting',         label: 'Smaht Scouting' },
  { key: 'dobber_prospects',       label: 'DobberProspects' },
  { key: 'hpr_malloy',             label: 'HPR / Malloy' },
]

export const DRAFT_SOURCE_LABELS: Record<string, string> =
  Object.fromEntries(DRAFT_SOURCES.map(s => [s.key, s.label]))
