import StatsTable from './StatsTable'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'Statistiques LNH' }
export const dynamic = 'force-dynamic'

const NHL_SEASON = '20252026'
const GAME_TYPE = 2
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

/** "EDM" → "EDM" | "EDM,TOR" → "2 TM" */
function teamLabel(abbrevs: unknown, fallback?: unknown): string {
  const raw = abbrevs ?? fallback
  if (!raw) return ''
  const teams = String(raw).split(',').map(t => t.trim()).filter(Boolean)
  return teams.length > 1 ? `${teams.length} TM` : (teams[0] ?? '')
}

/** "Connor McDavid" → { firstName: "Connor", lastName: "McDavid" } */
function splitName(full: string): { firstName: string; lastName: string } {
  const i = full.indexOf(' ')
  if (i < 0) return { firstName: full, lastName: '' }
  return { firstName: full.slice(0, i), lastName: full.slice(i + 1) }
}

function buildUrl(type: 'skater' | 'goalie', sortProp: string): string {
  const cayenne = `gameTypeId=${GAME_TYPE} and seasonId<=${NHL_SEASON} and seasonId>=${NHL_SEASON}`
  const sort = JSON.stringify([{ property: sortProp, direction: 'DESC' }])
  return (
    `${REST}/${type}/summary` +
    `?isAggregate=true&isGame=false` +
    `&sort=${encodeURIComponent(sort)}` +
    `&start=0&limit=-1` +
    `&factCayenneExp=${encodeURIComponent('gamesPlayed>=1')}` +
    `&cayenneExp=${encodeURIComponent(cayenne)}`
  )
}

type Row = Record<string, unknown>

async function fetchSkaters(): Promise<SkaterStat[]> {
  try {
    const res = await fetch(buildUrl('skater', 'points'), { cache: 'no-store' })
    if (!res.ok) return []
    const data = await res.json()
    return (data.data as Row[] ?? []).map(p => {
      const { firstName, lastName } = splitName(String(p.skaterFullName ?? ''))
      return {
        id: Number(p.playerId),
        firstName,
        lastName,
        teamAbbrev: teamLabel(p.teamAbbrevs, p.teamAbbrev),
        position: String(p.positionCode ?? ''),
        gamesPlayed: Number(p.gamesPlayed ?? 0),
        goals: Number(p.goals ?? 0),
        assists: Number(p.assists ?? 0),
        points: Number(p.points ?? 0),
        toi: parseTOI(p.timeOnIcePerGame),
      }
    })
  } catch {
    return []
  }
}

async function fetchGoalies(): Promise<GoalieStat[]> {
  try {
    const res = await fetch(buildUrl('goalie', 'wins'), { cache: 'no-store' })
    if (!res.ok) return []
    const data = await res.json()
    return (data.data as Row[] ?? []).map(p => {
      const { firstName, lastName } = splitName(String(p.goalieFullName ?? ''))
      return {
        id: Number(p.playerId),
        firstName,
        lastName,
        teamAbbrev: teamLabel(p.teamAbbrevs, p.teamAbbrev),
        gamesStarted: Number(p.gamesStarted ?? 0),
        wins: Number(p.wins ?? 0),
        losses: Number(p.losses ?? 0),
        otLosses: Number(p.otLosses ?? 0),
        shutouts: Number(p.shutouts ?? 0),
        goals: Number(p.goals ?? 0),
        assists: Number(p.assists ?? 0),
        savePct: Number(p.savePct ?? 0),
        gaa: Number(p.goalsAgainstAverage ?? 0),
      }
    })
  } catch {
    return []
  }
}

/** Noms normalisés des joueurs déjà dans un pool (saison active) */
function normName(s: string) {
  return s.toLowerCase().replace(/-/g, ' ').trim()
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

export default async function StatistiquesPage() {
  const [skaters, goalies, takenNames] = await Promise.all([
    fetchSkaters(),
    fetchGoalies(),
    fetchTakenNames(),
  ])

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <StatsTable skaters={skaters} goalies={goalies} takenNames={takenNames} />
    </div>
  )
}
