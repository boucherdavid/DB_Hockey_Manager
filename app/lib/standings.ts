import { fetchNhlSkatersByNhlId, fetchNhlGoaliesByNhlId, fetchNhlSkaters, fetchNhlGoalies, normName } from './nhl-stats'

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
    s.goals          * pts.goal +
    s.assists        * pts.assist +
    s.goalie_wins    * pts.goalie_win +
    s.goalie_otl     * pts.goalie_otl +
    s.goalie_shutouts * pts.goalie_shutout
  )
}

function subtractStats(end: StatBlock, start: StatBlock): StatBlock {
  return {
    goals:           Math.max(0, end.goals           - start.goals),
    assists:         Math.max(0, end.assists         - start.assists),
    goalie_wins:     Math.max(0, end.goalie_wins     - start.goalie_wins),
    goalie_otl:      Math.max(0, end.goalie_otl      - start.goalie_otl),
    goalie_shutouts: Math.max(0, end.goalie_shutouts - start.goalie_shutouts),
  }
}

const ZERO: StatBlock = { goals: 0, assists: 0, goalie_wins: 0, goalie_otl: 0, goalie_shutouts: 0 }

/**
 * Calcule les stats accumulées d'un joueur via ses snapshots.
 * currentStats : stats NHL actuelles si le joueur est encore actif, null sinon.
 * Fallback : si aucun snapshot d'activation, retourne currentStats brutes (transition).
 */
function calcFromSnapshots(
  snapshots: (StatBlock & { snapshot_type: string })[],
  currentStats: StatBlock | null,
): StatBlock {
  let activation: StatBlock | null = null
  let accumulated: StatBlock = { ...ZERO }

  for (const snap of snapshots) {
    if (snap.snapshot_type === 'activation') {
      activation = snap
    } else if ((snap.snapshot_type === 'deactivation' || snap.snapshot_type === 'season_end') && activation) {
      const delta = subtractStats(snap, activation)
      accumulated = {
        goals:           accumulated.goals           + delta.goals,
        assists:         accumulated.assists         + delta.assists,
        goalie_wins:     accumulated.goalie_wins     + delta.goalie_wins,
        goalie_otl:      accumulated.goalie_otl      + delta.goalie_otl,
        goalie_shutouts: accumulated.goalie_shutouts + delta.goalie_shutouts,
      }
      activation = null
    }
  }

  // Période ouverte : joueur encore actif
  if (activation && currentStats) {
    const delta = subtractStats(currentStats, activation)
    accumulated = {
      goals:           accumulated.goals           + delta.goals,
      assists:         accumulated.assists         + delta.assists,
      goalie_wins:     accumulated.goalie_wins     + delta.goalie_wins,
      goalie_otl:      accumulated.goalie_otl      + delta.goalie_otl,
      goalie_shutouts: accumulated.goalie_shutouts + delta.goalie_shutouts,
    }
  }

  // Fallback : pas de snapshot d'activation → utiliser stats brutes actuelles (joueur activé avant le système)
  const hasActivation = snapshots.some(s => s.snapshot_type === 'activation')
  if (!hasActivation && currentStats) {
    return currentStats
  }

  return accumulated
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function buildStandings(supabase: any, seasonId: string): Promise<PoolerStanding[]> {
  const [
    { data: rosterRows },
    { data: scoringRows },
    { data: snapshotRows },
    skatersById,
    goaliesById,
    skatersByName,
    goaliesByName,
  ] = await Promise.all([
    supabase
      .from('pooler_rosters')
      .select('player_type, poolers(id, name), players(id, first_name, last_name, position, nhl_id)')
      .eq('pool_season_id', seasonId)
      .eq('is_active', true)
      .in('player_type', ['actif', 'reserviste', 'ltir']),
    supabase.from('scoring_config').select('stat_key, points').in('scope', ['regular', 'both']),
    supabase
      .from('player_stat_snapshots')
      .select('player_id, pooler_id, snapshot_type, goals, assists, goalie_wins, goalie_otl, goalie_shutouts, taken_at')
      .eq('pool_season_id', seasonId)
      .order('taken_at', { ascending: true }),
    fetchNhlSkatersByNhlId(),
    fetchNhlGoaliesByNhlId(),
    fetchNhlSkaters(),
    fetchNhlGoalies(),
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

  // Index snapshots par player_id + pooler_id
  type SnapRow = {
    player_id: number
    pooler_id: string
    snapshot_type: string
    goals: number
    assists: number
    goalie_wins: number
    goalie_otl: number
    goalie_shutouts: number
  }
  const snapshotIndex = new Map<string, SnapRow[]>()
  for (const snap of (snapshotRows ?? []) as SnapRow[]) {
    const key = `${snap.player_id}:${snap.pooler_id}`
    if (!snapshotIndex.has(key)) snapshotIndex.set(key, [])
    snapshotIndex.get(key)!.push(snap)
  }

  const poolerMap = new Map<string, { name: string; players: PlayerContrib[] }>()

  for (const row of (rosterRows ?? []) as any[]) {
    const pooler = row.poolers as { id: string; name: string } | null
    const player = row.players as { id: number; first_name: string; last_name: string; position: string; nhl_id: number | null } | null
    if (!pooler || !player) continue

    if (!poolerMap.has(pooler.id)) poolerMap.set(pooler.id, { name: pooler.name, players: [] })

    const isGoalie = player.position === 'G'
    const isActive = row.player_type === 'actif'

    // Stats NHL actuelles (pour période ouverte ou fallback)
    let currentStats: StatBlock | null = null
    let teamAbbrev = '—'
    let gamesPlayed = 0

    if (player.nhl_id) {
      if (isGoalie) {
        const s = goaliesById.get(player.nhl_id)
        if (s) {
          currentStats = { goals: s.goals, assists: s.assists, goalie_wins: s.wins, goalie_otl: s.otLosses, goalie_shutouts: s.shutouts }
          teamAbbrev = s.teamAbbrev
          gamesPlayed = s.gamesStarted
        }
      } else {
        const s = skatersById.get(player.nhl_id)
        if (s) {
          currentStats = { goals: s.goals, assists: s.assists, goalie_wins: 0, goalie_otl: 0, goalie_shutouts: 0 }
          teamAbbrev = s.teamAbbrev
          gamesPlayed = s.gamesPlayed
        }
      }
    } else {
      // Fallback matching par nom si nhl_id absent
      const key = normName(`${player.first_name} ${player.last_name}`)
      if (isGoalie) {
        const s = goaliesByName.get(key)
        if (s) {
          currentStats = { goals: s.goals, assists: s.assists, goalie_wins: s.wins, goalie_otl: s.otLosses, goalie_shutouts: s.shutouts }
          teamAbbrev = s.teamAbbrev
          gamesPlayed = s.gamesStarted
        }
      } else {
        const s = skatersByName.get(key)
        if (s) {
          currentStats = { goals: s.goals, assists: s.assists, goalie_wins: 0, goalie_otl: 0, goalie_shutouts: 0 }
          teamAbbrev = s.teamAbbrev
          gamesPlayed = s.gamesPlayed
        }
      }
    }

    const snapshots = snapshotIndex.get(`${player.id}:${pooler.id}`) ?? []
    const earned = calcFromSnapshots(snapshots, isActive ? currentStats : null)
    const poolPoints = calcPoints(earned, pts)

    poolerMap.get(pooler.id)!.players.push({
      nhlId:          player.nhl_id,
      firstName:      player.first_name,
      lastName:       player.last_name,
      position:       player.position,
      playerType:     row.player_type,
      teamAbbrev,
      gamesPlayed,
      goals:          earned.goals,
      assists:        earned.assists,
      goalieWins:     earned.goalie_wins,
      goalieOtl:      earned.goalie_otl,
      goalieShutouts: earned.goalie_shutouts,
      poolPoints,
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
