import { createAdminClient } from '@/lib/supabase/admin'

export type PlayerContrib = {
  nhlId: number | null
  firstName: string
  lastName: string
  position: string
  playerType: string
  teamAbbrev: string
  gamesPlayed: number
  goals: number
  assists: number
  goalieWins: number
  goalieOtl: number
  goalieShutouts: number
  poolPoints: number
}

export type PoolerStanding = {
  poolerId: string
  poolerName: string
  totalPoints: number
  players: PlayerContrib[]
}

type StatBlock = {
  goals: number
  assists: number
  goalie_wins: number
  goalie_otl: number
  goalie_shutouts: number
}

type ScoringPts = {
  goal: number
  assist: number
  goalie_win: number
  goalie_otl: number
  goalie_shutout: number
}

function calcPoints(s: StatBlock, pts: ScoringPts): number {
  return (
    s.goals           * pts.goal +
    s.assists         * pts.assist +
    s.goalie_wins     * pts.goalie_win +
    s.goalie_otl      * pts.goalie_otl +
    s.goalie_shutouts * pts.goalie_shutout
  )
}

/** "2025-26" → 20252026 */
function toNhlSeasonInt(season: string): number {
  const startYear = parseInt(season.split('-')[0])
  return startYear * 10000 + (startYear + 1)
}

type GameLogRow = {
  player_id: number
  game_start_time: string
  goals: number
  assists: number
  goalie_wins: number
  goalie_otl: number
  goalie_shutouts: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function buildStandings(supabase: any, seasonId: string | number): Promise<PoolerStanding[]> {
  const [
    { data: rosterRows },
    { data: scoringRows },
    { data: seasonRow },
  ] = await Promise.all([
    supabase
      .from('pooler_rosters')
      .select('player_type, added_at, removed_at, poolers(id, name), players(id, first_name, last_name, position, nhl_id, teams(code))')
      .eq('pool_season_id', seasonId)
      .not('player_type', 'eq', 'recrue'),
    supabase.from('scoring_config').select('stat_key, points').in('scope', ['regular', 'both']),
    supabase.from('pool_seasons').select('season').eq('id', seasonId).single(),
  ])

  const scoring: Record<string, number> = {}
  for (const r of scoringRows ?? []) scoring[r.stat_key] = Number(r.points)
  const pts: ScoringPts = {
    goal:           scoring.goal           ?? 1,
    assist:         scoring.assist         ?? 1,
    goalie_win:     scoring.goalie_win     ?? 2,
    goalie_otl:     scoring.goalie_otl     ?? 1,
    goalie_shutout: scoring.goalie_shutout ?? 2,
  }

  const nhlSeason = seasonRow?.season ? toNhlSeasonInt(seasonRow.season) : null
  if (!nhlSeason) return []

  // IDs uniques des joueurs dans le pool
  const playerIds = [...new Set(
    (rosterRows ?? []).map((r: any) => r.players?.id).filter(Boolean) as number[]
  )]
  if (playerIds.length === 0) return []

  // Game logs saison régulière — pagination pour dépasser la limite Supabase
  const admin = createAdminClient()
  const PAGE = 1000
  const gameLogRows: GameLogRow[] = []
  let offset = 0
  while (true) {
    const { data: page } = await admin
      .from('player_game_logs')
      .select('player_id, game_start_time, goals, assists, goalie_wins, goalie_otl, goalie_shutouts')
      .in('player_id', playerIds)
      .eq('season', nhlSeason)
      .eq('game_type', 2)
      .range(offset, offset + PAGE - 1)
    if (!page || page.length === 0) break
    gameLogRows.push(...(page as GameLogRow[]))
    if (page.length < PAGE) break
    offset += PAGE
  }

  // Index par player_id
  const logsByPlayer = new Map<number, GameLogRow[]>()
  for (const gl of (gameLogRows ?? []) as GameLogRow[]) {
    if (!logsByPlayer.has(gl.player_id)) logsByPlayer.set(gl.player_id, [])
    logsByPlayer.get(gl.player_id)!.push(gl)
  }

  const poolerMap = new Map<string, { name: string; players: PlayerContrib[] }>()

  for (const row of (rosterRows ?? []) as any[]) {
    const pooler = row.poolers as { id: string; name: string } | null
    const player = row.players as {
      id: number
      first_name: string
      last_name: string
      position: string
      nhl_id: number | null
      teams: { code: string } | null
    } | null
    if (!pooler || !player) continue

    if (!poolerMap.has(pooler.id)) poolerMap.set(pooler.id, { name: pooler.name, players: [] })

    const addedAt  = row.added_at  ? new Date(row.added_at)  : null
    const removedAt = row.removed_at ? new Date(row.removed_at) : null

    // Sommer les game logs dans la fenêtre d'activation de ce joueur
    const logs = logsByPlayer.get(player.id) ?? []
    const earned: StatBlock = { goals: 0, assists: 0, goalie_wins: 0, goalie_otl: 0, goalie_shutouts: 0 }
    let gamesPlayed = 0

    for (const gl of logs) {
      const gameTime = new Date(gl.game_start_time)
      // Règle : le match doit avoir commencé APRÈS l'activation et AVANT (ou pendant) la désactivation
      if (!addedAt || gameTime <= addedAt) continue
      if (removedAt && gameTime > removedAt) continue

      earned.goals           += gl.goals
      earned.assists         += gl.assists
      earned.goalie_wins     += gl.goalie_wins
      earned.goalie_otl      += gl.goalie_otl
      earned.goalie_shutouts += gl.goalie_shutouts
      gamesPlayed++
    }

    poolerMap.get(pooler.id)!.players.push({
      nhlId:          player.nhl_id,
      firstName:      player.first_name,
      lastName:       player.last_name,
      position:       player.position,
      playerType:     row.player_type,
      teamAbbrev:     player.teams?.code ?? '—',
      gamesPlayed,
      goals:          earned.goals,
      assists:        earned.assists,
      goalieWins:     earned.goalie_wins,
      goalieOtl:      earned.goalie_otl,
      goalieShutouts: earned.goalie_shutouts,
      poolPoints:     calcPoints(earned, pts),
    })
  }

  return Array.from(poolerMap.entries())
    .map(([poolerId, { name, players }]) => ({
      poolerId,
      poolerName: name,
      totalPoints: players
        .filter(p => p.playerType === 'actif')
        .reduce((s, p) => s + p.poolPoints, 0),
      players,
    }))
    .sort((a, b) => b.totalPoints - a.totalPoints || a.poolerName.localeCompare(b.poolerName))
}
