import { fetchNhlSkaters, fetchNhlGoalies, normName } from './nhl-stats'

export type PlayerContrib = {
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function buildStandings(supabase: any, seasonId: string): Promise<PoolerStanding[]> {
  const [{ data: rosterRows }, { data: scoringRows }, skatersMap, goaliesMap] = await Promise.all([
    supabase
      .from('pooler_rosters')
      .select('player_type, poolers(id, name), players(first_name, last_name, position)')
      .eq('pool_season_id', seasonId)
      .eq('is_active', true)
      .in('player_type', ['actif', 'reserviste', 'ltir']),
    supabase.from('scoring_config').select('stat_key, points').in('scope', ['regular', 'both']),
    fetchNhlSkaters(),
    fetchNhlGoalies(),
  ])

  const scoring: Record<string, number> = {}
  for (const r of scoringRows ?? []) scoring[r.stat_key] = Number(r.points)
  const pts = {
    goal:           scoring.goal           ?? 1,
    assist:         scoring.assist         ?? 1,
    goalie_win:     scoring.goalie_win     ?? 2,
    goalie_otl:     scoring.goalie_otl     ?? 1,
    goalie_shutout: scoring.goalie_shutout ?? 2,
  }

  const poolerMap = new Map<string, { name: string; players: PlayerContrib[] }>()

  for (const row of rosterRows ?? []) {
    const pooler = row.poolers as unknown as { id: string; name: string } | null
    const player = row.players as unknown as { first_name: string; last_name: string; position: string } | null
    if (!pooler || !player) continue

    if (!poolerMap.has(pooler.id)) poolerMap.set(pooler.id, { name: pooler.name, players: [] })

    const isGoalie = player.position === 'G'
    const key = normName(`${player.first_name} ${player.last_name}`)

    let contrib: PlayerContrib
    if (isGoalie) {
      const stat = goaliesMap.get(key)
      contrib = {
        firstName: player.first_name, lastName: player.last_name,
        position: 'G', playerType: row.player_type,
        teamAbbrev: stat?.teamAbbrev ?? '—',
        gamesPlayed: stat?.gamesStarted ?? 0,
        goals: stat?.goals ?? 0, assists: stat?.assists ?? 0,
        goalieWins: stat?.wins ?? 0, goalieOtl: stat?.otLosses ?? 0,
        goalieShutouts: stat?.shutouts ?? 0,
        poolPoints:
          (stat?.wins     ?? 0) * pts.goalie_win +
          (stat?.otLosses ?? 0) * pts.goalie_otl +
          (stat?.shutouts ?? 0) * pts.goalie_shutout +
          (stat?.goals    ?? 0) * pts.goal +
          (stat?.assists  ?? 0) * pts.assist,
      }
    } else {
      const stat = skatersMap.get(key)
      contrib = {
        firstName: player.first_name, lastName: player.last_name,
        position: stat?.position ?? player.position, playerType: row.player_type,
        teamAbbrev: stat?.teamAbbrev ?? '—',
        gamesPlayed: stat?.gamesPlayed ?? 0,
        goals: stat?.goals ?? 0, assists: stat?.assists ?? 0,
        goalieWins: 0, goalieOtl: 0, goalieShutouts: 0,
        poolPoints: (stat?.goals ?? 0) * pts.goal + (stat?.assists ?? 0) * pts.assist,
      }
    }

    poolerMap.get(pooler.id)!.players.push(contrib)
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
