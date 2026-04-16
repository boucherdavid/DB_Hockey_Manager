import StatsTable from './StatsTable'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'Statistiques LNH' }
export const dynamic = 'force-dynamic'

const NHL_SEASON = '20252026'
const REST = 'https://api.nhle.com/stats/rest/en'

export type SkaterStat = {
  id: number
  firstName: string
  lastName: string
  teamAbbrev: string   // "MTL", "2 TM", etc.
  position: string
  gamesPlayed: number
  goals: number
  assists: number
  points: number
  toi: number          // secondes par match
}

export type GoalieStat = {
  id: number
  firstName: string
  lastName: string
  teamAbbrev: string
  gamesStarted: number
  wins: number
  losses: number
  otLosses: number
  shutouts: number
  goals: number
  assists: number
  savePct: number      // ex: 0.920
  gaa: number          // buts alloués par match
}

/** "20:45" ou "20:45.123" → secondes */
function parseTOI(val: unknown): number {
  if (!val) return 0
  if (typeof val === 'number') return val
  const parts = String(val).split(':')
  if (parts.length === 2) return parseInt(parts[0]) * 60 + parseFloat(parts[1])
  return 0
}


/** "Connor McDavid" → { firstName: "Connor", lastName: "McDavid" } */
function splitName(full: string): { firstName: string; lastName: string } {
  const i = full.indexOf(' ')
  if (i < 0) return { firstName: full, lastName: '' }
  return { firstName: full.slice(0, i), lastName: full.slice(i + 1) }
}

// isAggregate=false → une ligne par joueur par équipe → on garde le code équipe
// puis on agrège manuellement pour les joueurs échangés en cours de saison
function buildUrl(type: 'skater' | 'goalie', gameType: number): string {
  const cayenne = `gameTypeId=${gameType} and seasonId<=${NHL_SEASON} and seasonId>=${NHL_SEASON}`
  return (
    `${REST}/${type}/summary` +
    `?isAggregate=false&isGame=false` +
    `&start=0&limit=-1` +
    `&factCayenneExp=${encodeURIComponent('gamesPlayed>=1')}` +
    `&cayenneExp=${encodeURIComponent(cayenne)}`
  )
}

type Row = Record<string, unknown>

async function fetchSkaters(gameType: number): Promise<SkaterStat[]> {
  try {
    const res = await fetch(buildUrl('skater', gameType), { cache: 'no-store' })
    if (!res.ok) return []
    const rows = ((await res.json()).data as Row[]) ?? []

    // Grouper par playerId pour agréger les joueurs échangés
    const byPlayer = new Map<number, Row[]>()
    for (const p of rows) {
      const id = Number(p.playerId)
      if (!byPlayer.has(id)) byPlayer.set(id, [])
      byPlayer.get(id)!.push(p)
    }

    return Array.from(byPlayer.values())
      .map(entries => {
        // Entrée principale = celle avec le plus de matchs joués
        entries.sort((a, b) => Number(b.gamesPlayed ?? 0) - Number(a.gamesPlayed ?? 0))
        const main = entries[0]!
        const { firstName, lastName } = splitName(String(main.skaterFullName ?? ''))

        const totalGP    = entries.reduce((s, e) => s + Number(e.gamesPlayed ?? 0), 0)
        const totalGoals = entries.reduce((s, e) => s + Number(e.goals ?? 0), 0)
        const totalAst   = entries.reduce((s, e) => s + Number(e.assists ?? 0), 0)
        const totalPts   = entries.reduce((s, e) => s + Number(e.points ?? 0), 0)
        // TOI pondéré par matchs joués
        const totalTOI   = entries.reduce(
          (s, e) => s + parseTOI(e.timeOnIcePerGame) * Number(e.gamesPlayed ?? 0), 0,
        )

        const teamAbbrev = entries.length > 1
          ? `${entries.length} TM`
          : String(main.teamAbbrevs ?? '')

        return {
          id: Number(main.playerId),
          firstName,
          lastName,
          teamAbbrev,
          position: String(main.positionCode ?? ''),
          gamesPlayed: totalGP,
          goals: totalGoals,
          assists: totalAst,
          points: totalPts,
          toi: totalGP > 0 ? totalTOI / totalGP : 0,
        }
      })
      .sort((a, b) => b.points - a.points || b.goals - a.goals || a.lastName.localeCompare(b.lastName))
  } catch {
    return []
  }
}

async function fetchGoalies(gameType: number): Promise<GoalieStat[]> {
  try {
    const res = await fetch(buildUrl('goalie', gameType), { cache: 'no-store' })
    if (!res.ok) return []
    const rows = ((await res.json()).data as Row[]) ?? []

    const byPlayer = new Map<number, Row[]>()
    for (const p of rows) {
      const id = Number(p.playerId)
      if (!byPlayer.has(id)) byPlayer.set(id, [])
      byPlayer.get(id)!.push(p)
    }

    return Array.from(byPlayer.values())
      .map(entries => {
        entries.sort((a, b) => Number(b.gamesStarted ?? 0) - Number(a.gamesStarted ?? 0))
        const main = entries[0]!
        const { firstName, lastName } = splitName(String(main.goalieFullName ?? ''))
        const teamAbbrev = entries.length > 1
          ? `${entries.length} TM`
          : String(main.teamAbbrevs ?? '')

        return {
          id: Number(main.playerId),
          firstName,
          lastName,
          teamAbbrev,
          gamesStarted: entries.reduce((s, e) => s + Number(e.gamesStarted ?? 0), 0),
          wins:         entries.reduce((s, e) => s + Number(e.wins ?? 0), 0),
          losses:       entries.reduce((s, e) => s + Number(e.losses ?? 0), 0),
          otLosses:     entries.reduce((s, e) => s + Number(e.otLosses ?? 0), 0),
          shutouts:     entries.reduce((s, e) => s + Number(e.shutouts ?? 0), 0),
          goals:        entries.reduce((s, e) => s + Number(e.goals ?? 0), 0),
          assists:      entries.reduce((s, e) => s + Number(e.assists ?? 0), 0),
          savePct:      Number(main.savePct ?? 0),
          gaa:          Number(main.goalsAgainstAverage ?? 0),
        }
      })
      .sort((a, b) => b.wins - a.wins || b.shutouts - a.shutouts || a.lastName.localeCompare(b.lastName))
  } catch {
    return []
  }
}

/** Noms normalisés */
function normName(s: string) {
  return s.toLowerCase().replace(/-/g, ' ').trim()
}

/** Noms normalisés des joueurs sur un contrat ELC */
async function fetchRookieNames(): Promise<string[]> {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('players')
      .select('first_name, last_name')
      .eq('status', 'ELC')
    return (data ?? []).map(p => normName(`${p.first_name} ${p.last_name}`))
  } catch {
    return []
  }
}

async function fetchTakenNames(): Promise<string[]> {
  try {
    const supabase = await createClient()
    const { data: season } = await supabase
      .from('pool_seasons')
      .select('id')
      .eq('is_active', true)
      .single()
    if (!season) return []

    const { data: rosters } = await supabase
      .from('pooler_rosters')
      .select('players(first_name, last_name)')
      .eq('pool_season_id', season.id)
    if (!rosters) return []

    return rosters
      .map(r => r.players as unknown as { first_name: string; last_name: string } | null)
      .filter(Boolean)
      .map(p => normName(`${p!.first_name} ${p!.last_name}`))
  } catch {
    return []
  }
}

export default async function StatistiquesPage({
  searchParams,
}: {
  searchParams: Promise<{ saison?: string }>
}) {
  const { saison } = await searchParams
  const gameType = saison === 'series' ? 3 : 2

  const [skaters, goalies, takenNames, rookieNames] = await Promise.all([
    fetchSkaters(gameType),
    fetchGoalies(gameType),
    fetchTakenNames(),
    fetchRookieNames(),
  ])

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <StatsTable
        skaters={skaters}
        goalies={goalies}
        takenNames={takenNames}
        rookieNames={rookieNames}
        gameMode={saison === 'series' ? 'series' : 'regular'}
      />
    </div>
  )
}
