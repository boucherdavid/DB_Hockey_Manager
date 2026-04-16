/**
 * Utilitaire partagé — fetch des stats joueurs depuis l'API NHL publique.
 * Utilisé par /classement et /pool-series (playoffs).
 */

const NHL_REST = 'https://api.nhle.com/stats/rest/en'
export const NHL_SEASON = '20252026'

export type NhlSkaterStat = {
  playerId: number
  firstName: string
  lastName: string
  teamAbbrev: string
  position: string
  gamesPlayed: number
  goals: number
  assists: number
}

export type NhlGoalieStat = {
  playerId: number
  firstName: string
  lastName: string
  teamAbbrev: string
  gamesStarted: number
  wins: number
  otLosses: number
  goals: number
  assists: number
}

export function normName(s: string): string {
  return s.toLowerCase().replace(/-/g, ' ').trim()
}

function splitName(full: string): { firstName: string; lastName: string } {
  const i = full.indexOf(' ')
  if (i < 0) return { firstName: full, lastName: '' }
  return { firstName: full.slice(0, i), lastName: full.slice(i + 1) }
}

type Row = Record<string, unknown>

function buildUrl(type: 'skater' | 'goalie', gameType: number): string {
  const cayenne = `gameTypeId=${gameType} and seasonId<=${NHL_SEASON} and seasonId>=${NHL_SEASON}`
  return (
    `${NHL_REST}/${type}/summary` +
    `?isAggregate=false&isGame=false` +
    `&start=0&limit=-1` +
    `&factCayenneExp=${encodeURIComponent('gamesPlayed>=1')}` +
    `&cayenneExp=${encodeURIComponent(cayenne)}`
  )
}

/** Retourne une map normName → stats pour tous les patineurs de la saison. */
export async function fetchNhlSkaters(gameType = 2): Promise<Map<string, NhlSkaterStat>> {
  try {
    const res = await fetch(buildUrl('skater', gameType), { cache: 'no-store' })
    if (!res.ok) return new Map()
    const rows = ((await res.json()).data as Row[]) ?? []

    const byPlayer = new Map<number, Row[]>()
    for (const p of rows) {
      const id = Number(p.playerId)
      if (!byPlayer.has(id)) byPlayer.set(id, [])
      byPlayer.get(id)!.push(p)
    }

    const result = new Map<string, NhlSkaterStat>()
    for (const entries of byPlayer.values()) {
      entries.sort((a, b) => Number(b.gamesPlayed ?? 0) - Number(a.gamesPlayed ?? 0))
      const main = entries[0]!
      const { firstName, lastName } = splitName(String(main.skaterFullName ?? ''))
      const key = normName(`${firstName} ${lastName}`)
      result.set(key, {
        playerId: Number(main.playerId),
        firstName,
        lastName,
        teamAbbrev: entries.length > 1 ? `${entries.length} TM` : String(main.teamAbbrevs ?? ''),
        position: String(main.positionCode ?? ''),
        gamesPlayed: entries.reduce((s, e) => s + Number(e.gamesPlayed ?? 0), 0),
        goals: entries.reduce((s, e) => s + Number(e.goals ?? 0), 0),
        assists: entries.reduce((s, e) => s + Number(e.assists ?? 0), 0),
      })
    }
    return result
  } catch {
    return new Map()
  }
}

/** Retourne une map normName → stats pour tous les gardiens de la saison. */
export async function fetchNhlGoalies(gameType = 2): Promise<Map<string, NhlGoalieStat>> {
  try {
    const res = await fetch(buildUrl('goalie', gameType), { cache: 'no-store' })
    if (!res.ok) return new Map()
    const rows = ((await res.json()).data as Row[]) ?? []

    const byPlayer = new Map<number, Row[]>()
    for (const p of rows) {
      const id = Number(p.playerId)
      if (!byPlayer.has(id)) byPlayer.set(id, [])
      byPlayer.get(id)!.push(p)
    }

    const result = new Map<string, NhlGoalieStat>()
    for (const entries of byPlayer.values()) {
      entries.sort((a, b) => Number(b.gamesStarted ?? 0) - Number(a.gamesStarted ?? 0))
      const main = entries[0]!
      const { firstName, lastName } = splitName(String(main.goalieFullName ?? ''))
      const key = normName(`${firstName} ${lastName}`)
      result.set(key, {
        playerId: Number(main.playerId),
        firstName,
        lastName,
        teamAbbrev: entries.length > 1 ? `${entries.length} TM` : String(main.teamAbbrevs ?? ''),
        gamesStarted: entries.reduce((s, e) => s + Number(e.gamesStarted ?? 0), 0),
        wins: entries.reduce((s, e) => s + Number(e.wins ?? 0), 0),
        otLosses: entries.reduce((s, e) => s + Number(e.otLosses ?? 0), 0),
        goals: entries.reduce((s, e) => s + Number(e.goals ?? 0), 0),
        assists: entries.reduce((s, e) => s + Number(e.assists ?? 0), 0),
      })
    }
    return result
  } catch {
    return new Map()
  }
}

/** Formate un total de points pool : entier si .0, sinon 1 décimale. */
export function fmtPts(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(1)
}
