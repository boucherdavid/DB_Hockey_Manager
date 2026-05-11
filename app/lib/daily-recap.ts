/**
 * Logique partagée pour le récap journalier (séries + saison régulière).
 * Utilisé par la page /resultats et la page d'accueil (colonne HIER).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { NHL_SEASON } from '@/lib/nhl-stats'

// ─── Types ────────────────────────────────────────────────────────────────────

export type RecapPlayer = {
  firstName: string
  lastName: string
  teamCode: string
  positionSlot: string
  goals: number
  assists: number
  goalieWins: number
  goalieOtl: number
  goalieShutouts: number
  pts: number
}

export type RecapPooler = {
  poolerId: string
  poolerName: string
  pts: number
  players: RecapPlayer[]
}

export type DailyRecap = {
  date: string
  poolers: RecapPooler[] // tous les poolers, triés par pts desc (0 inclus)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getYesterdayET(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(Date.now() - 24 * 60 * 60 * 1000))
}

export function getTodayET(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}

export function addDaysToDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d)
}

async function fetchPlayingTeams(dateStr: string): Promise<Set<string>> {
  try {
    const res = await fetch(`https://api-web.nhle.com/v1/schedule/${dateStr}`, { next: { revalidate: 3600 } })
    if (!res.ok) return new Set()
    const data = await res.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dayEntry = (data.gameWeek ?? []).find((d: any) => d.date === dateStr)
    return new Set<string>(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (dayEntry?.games ?? []).flatMap((g: any) =>
        [g.awayTeam?.abbrev, g.homeTeam?.abbrev]
      ).filter(Boolean),
    )
  } catch {
    return new Set()
  }
}

async function fetchPlayerStats(
  nhlId: number,
  gameType: 2 | 3,
  dateStr: string,
  isGoalie: boolean,
  cfg: Record<string, number>,
): Promise<{ goals: number; assists: number; wins: number; otl: number; so: number; pts: number }> {
  try {
    const res = await fetch(
      `https://api-web.nhle.com/v1/player/${nhlId}/game-log/${NHL_SEASON}/${gameType}`,
      { next: { revalidate: 3600 } },
    )
    if (!res.ok) return { goals: 0, assists: 0, wins: 0, otl: 0, so: 0, pts: 0 }
    const data = await res.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const games = ((data.gameLog ?? []) as any[]).filter((g: any) => g.gameDate === dateStr)
    let goals = 0, assists = 0, wins = 0, otl = 0, so = 0
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const g of games as any[]) {
      if (isGoalie) {
        wins += g.decision === 'W' ? 1 : 0
        otl  += g.decision === 'O' ? 1 : 0
        so   += typeof g.shutouts === 'number' ? g.shutouts : 0
      } else {
        goals   += typeof g.goals   === 'number' ? g.goals   : 0
        assists += typeof g.assists === 'number' ? g.assists : 0
      }
    }
    const pts =
      goals * (cfg.goal ?? 1) + assists * (cfg.assist ?? 1) +
      wins  * (cfg.goalie_win ?? 2) + otl * (cfg.goalie_otl ?? 1) +
      so    * (cfg.goalie_shutout ?? 0)
    return { goals, assists, wins, otl, so, pts }
  } catch {
    return { goals: 0, assists: 0, wins: 0, otl: 0, so: 0, pts: 0 }
  }
}

function posGroup(pos: string): 'F' | 'D' | 'G' {
  const p = (pos ?? '').split(',')[0].trim()
  if (p === 'G') return 'G'
  if (['D', 'LD', 'RD'].includes(p)) return 'D'
  return 'F'
}

// ─── Pool des séries ──────────────────────────────────────────────────────────

export async function fetchPlayoffRecapForDate(
  supabase: SupabaseClient,
  poolSeasonId: number,
  dateStr: string,
): Promise<DailyRecap> {
  try {
    const playingTeams = await fetchPlayingTeams(dateStr)

    const [{ data: rosters }, { data: poolerRows }, { data: scoringRows }] = await Promise.all([
      supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from('playoff_pool_rosters').select('pooler_id, position_slot, players(nhl_id, position, first_name, last_name, teams(code))' as any)
        .eq('pool_season_id', poolSeasonId).eq('is_active', true),
      supabase.from('poolers').select('id, name'),
      supabase.from('scoring_config').select('stat_key, points, points_playoffs'),
    ])

    const cfg: Record<string, number> = {}
    for (const row of scoringRows ?? []) cfg[row.stat_key] = row.points_playoffs ?? row.points
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allPoolers: RecapPooler[] = (poolerRows ?? []).map((p: any) => ({
      poolerId: p.id, poolerName: p.name, pts: 0, players: [],
    }))
    const poolerMap = new Map(allPoolers.map(p => [p.poolerId, p]))

    if (playingTeams.size > 0) {
      type PlayerInfo = {
        firstName: string; lastName: string; teamCode: string; isGoalie: boolean
        entries: { poolerId: string; positionSlot: string }[]
      }
      const playerMap = new Map<number, PlayerInfo>()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const r of (rosters ?? []) as any[]) {
        const nhlId: number | null = r.players?.nhl_id
        const teamCode: string | null = r.players?.teams?.code
        if (!nhlId || !teamCode || !playingTeams.has(teamCode)) continue
        if (!playerMap.has(nhlId)) {
          playerMap.set(nhlId, {
            firstName: r.players?.first_name ?? '', lastName: r.players?.last_name ?? '',
            teamCode, isGoalie: (r.players?.position ?? '').toUpperCase() === 'G', entries: [],
          })
        }
        playerMap.get(nhlId)!.entries.push({ poolerId: r.pooler_id, positionSlot: r.position_slot })
      }

      const results = await Promise.all(
        [...playerMap.entries()].map(async ([nhlId, info]) => ({
          info, ...await fetchPlayerStats(nhlId, 3, dateStr, info.isGoalie, cfg),
        })),
      )

      for (const { info, goals, assists, wins, otl, so, pts } of results) {
        if (pts === 0 && goals === 0 && assists === 0 && wins === 0 && otl === 0 && so === 0) continue
        for (const { poolerId, positionSlot } of info.entries) {
          const pooler = poolerMap.get(poolerId)
          if (!pooler) continue
          pooler.pts += pts
          pooler.players.push({
            firstName: info.firstName, lastName: info.lastName, teamCode: info.teamCode,
            positionSlot, goals, assists, goalieWins: wins, goalieOtl: otl, goalieShutouts: so, pts,
          })
        }
      }
    }

    for (const p of allPoolers) p.players.sort((a, b) => b.pts - a.pts)
    return { date: dateStr, poolers: allPoolers.sort((a, b) => b.pts - a.pts) }
  } catch {
    return { date: dateStr, poolers: [] }
  }
}

// ─── Pool saison régulière ────────────────────────────────────────────────────

export async function fetchRegularRecapForDate(
  supabase: SupabaseClient,
  poolSeasonId: number,
  dateStr: string,
): Promise<DailyRecap> {
  try {
    const playingTeams = await fetchPlayingTeams(dateStr)

    const [{ data: rosters }, { data: poolerRows }, { data: scoringRows }] = await Promise.all([
      supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from('pooler_rosters').select('pooler_id, players(nhl_id, position, first_name, last_name, teams(code))' as any)
        .eq('pool_season_id', poolSeasonId).eq('player_type', 'actif'),
      supabase.from('poolers').select('id, name'),
      supabase.from('scoring_config').select('stat_key, points'),
    ])

    const cfg: Record<string, number> = {}
    for (const row of scoringRows ?? []) cfg[row.stat_key] = row.points
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allPoolers: RecapPooler[] = (poolerRows ?? []).map((p: any) => ({
      poolerId: p.id, poolerName: p.name, pts: 0, players: [],
    }))
    const poolerMap = new Map(allPoolers.map(p => [p.poolerId, p]))

    if (playingTeams.size > 0) {
      type PlayerInfo = {
        firstName: string; lastName: string; teamCode: string
        position: string; isGoalie: boolean; poolerIds: string[]
      }
      const playerMap = new Map<number, PlayerInfo>()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const r of (rosters ?? []) as any[]) {
        const nhlId: number | null = r.players?.nhl_id
        const teamCode: string | null = r.players?.teams?.code
        if (!nhlId || !teamCode || !playingTeams.has(teamCode)) continue
        if (!playerMap.has(nhlId)) {
          const pos = r.players?.position ?? ''
          playerMap.set(nhlId, {
            firstName: r.players?.first_name ?? '', lastName: r.players?.last_name ?? '',
            teamCode, position: pos, isGoalie: pos.toUpperCase() === 'G', poolerIds: [],
          })
        }
        playerMap.get(nhlId)!.poolerIds.push(r.pooler_id)
      }

      const results = await Promise.all(
        [...playerMap.entries()].map(async ([nhlId, info]) => ({
          info, ...await fetchPlayerStats(nhlId, 2, dateStr, info.isGoalie, cfg),
        })),
      )

      for (const { info, goals, assists, wins, otl, so, pts } of results) {
        if (pts === 0 && goals === 0 && assists === 0 && wins === 0 && otl === 0 && so === 0) continue
        for (const poolerId of info.poolerIds) {
          const pooler = poolerMap.get(poolerId)
          if (!pooler) continue
          pooler.pts += pts
          pooler.players.push({
            firstName: info.firstName, lastName: info.lastName, teamCode: info.teamCode,
            positionSlot: posGroup(info.position), goals, assists,
            goalieWins: wins, goalieOtl: otl, goalieShutouts: so, pts,
          })
        }
      }
    }

    for (const p of allPoolers) p.players.sort((a, b) => b.pts - a.pts)
    return { date: dateStr, poolers: allPoolers.sort((a, b) => b.pts - a.pts) }
  } catch {
    return { date: dateStr, poolers: [] }
  }
}
