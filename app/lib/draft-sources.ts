export type DraftSourceKey =
  | 'elite_prospects' | 'tsn_button' | 'tsn_peters' | 'mckeens' | 'thn_ferrari' | 'thn_kennedy'
  | 'daily_faceoff' | 'flohockey_peters' | 'central_scouting_na' | 'central_scouting_eu'
  | 'draft_prospects_hockey' | 'sportsnet_cosentino' | 'sportsnet_bukala'
  | 'smaht_scouting' | 'dobber_prospects' | 'hpr_malloy'

export type DraftSource = { key: DraftSourceKey; label: string; infoOnly?: true }

// infoOnly : source exclue du rang moyen (listes par catégorie NA/EU, pas un classement global)
export const DRAFT_SOURCES: DraftSource[] = [
  { key: 'elite_prospects',        label: 'EliteProspects.com' },
  { key: 'tsn_button',             label: 'TSN / Craig Button' },
  { key: 'tsn_peters',             label: 'TSN / Chris Peters' },
  { key: 'mckeens',                label: "McKeen's Hockey" },
  { key: 'thn_ferrari',            label: 'THN / Ferrari' },
  { key: 'thn_kennedy',            label: 'THN / Kennedy' },
  { key: 'daily_faceoff',          label: 'Daily Faceoff' },
  { key: 'flohockey_peters',       label: 'FloHockey / Chris Peters' },
  { key: 'draft_prospects_hockey', label: 'Draft Prospects Hockey' },
  { key: 'sportsnet_cosentino',    label: 'Sportsnet / Cosentino' },
  { key: 'sportsnet_bukala',       label: 'Sportsnet / Bukala' },
  { key: 'smaht_scouting',         label: 'Smaht Scouting' },
  { key: 'dobber_prospects',       label: 'DobberProspects' },
  { key: 'hpr_malloy',             label: 'HPR / Malloy' },
  { key: 'central_scouting_na',    label: 'NHL Central Scouting (NA)', infoOnly: true },
  { key: 'central_scouting_eu',    label: 'NHL Central Scouting (EU)', infoOnly: true },
]

export const DRAFT_SOURCES_RANKED  = DRAFT_SOURCES.filter(s => !s.infoOnly)
export const DRAFT_SOURCES_INFOONLY = DRAFT_SOURCES.filter(s => s.infoOnly)

export const DRAFT_SOURCE_LABELS: Record<string, string> =
  Object.fromEntries(DRAFT_SOURCES.map(s => [s.key, s.label]))
