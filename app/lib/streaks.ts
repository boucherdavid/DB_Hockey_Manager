import { NHL_SEASON } from './nhl-stats'

export type BadgeType =
  | 'en_feu'
  | 'en_forme'
  | 'en_froid'
  | 'en_crise'
  | 'en_hausse'
  | 'en_baisse'
  | null

export type StreakInfo = {
  badge: BadgeType
  count: number    // matchs consécutifs dans la séquence chaude ou froide
  tendance: number // pts/match récents − pts/match précédents (positif = hausse)
}

export type IndicatorConfig = {
  streakChaud: number      // min matchs consécutifs avec pts pour EN FEU
  streakFroid: number      // min matchs consécutifs sans pts pour EN FROID
  fenetreTendance: number  // taille fenêtre pour le calcul de tendance
}

export const DEFAULT_INDICATOR_CONFIG: IndicatorConfig = {
  streakChaud: 3,
  streakFroid: 5,
  fenetreTendance: 5,
}

async function fetchGameLog(nhlId: number, gameType: 2 | 3): Promise<unknown[]> {
  try {
    const res = await fetch(
      `https://api-web.nhle.com/v1/player/${nhlId}/game-log/${NHL_SEASON}/${gameType}`,
      { next: { revalidate: 1800 } },
    )
    if (!res.ok) return []
    const data = await res.json()
    return data.gameLog ?? []
  } catch {
    return []
  }
}

function gamePts(g: Record<string, unknown>, isGoalie: boolean): number {
  if (isGoalie) {
    const wins     = typeof g.wins === 'number' ? g.wins : (g.decision === 'W' ? 1 : 0)
    const otLosses = typeof g.otLosses === 'number' ? g.otLosses : (g.decision === 'O' ? 1 : 0)
    const shutouts = typeof g.shutouts === 'number' ? g.shutouts : 0
    return wins * 2 + otLosses + shutouts * 2
  }
  return (typeof g.goals === 'number' ? g.goals : 0)
       + (typeof g.assists === 'number' ? g.assists : 0)
}

function computeIndicator(
  log: unknown[],
  isGoalie: boolean,
  config: IndicatorConfig,
): StreakInfo {
  const games = (log as Record<string, unknown>[]).slice().reverse() // du plus récent au plus ancien

  if (games.length === 0) return { badge: null, count: 0, tendance: 0 }

  // Streak
  const firstPts = gamePts(games[0], isGoalie)
  const isHot = firstPts >= 1
  let count = 0
  for (const g of games) {
    const pts = gamePts(g, isGoalie)
    if (isHot && pts >= 1) count++
    else if (!isHot && pts === 0) count++
    else break
  }

  // Tendance : fenêtre récente vs fenêtre précédente
  const { fenetreTendance } = config
  const recent   = games.slice(0, fenetreTendance)
  const previous = games.slice(fenetreTendance, fenetreTendance * 2)
  const avgRecent   = recent.length   > 0 ? recent.reduce((s, g)   => s + gamePts(g, isGoalie), 0) / recent.length   : 0
  const avgPrevious = previous.length > 0 ? previous.reduce((s, g) => s + gamePts(g, isGoalie), 0) / previous.length : 0
  const tendance = previous.length > 0 ? avgRecent - avgPrevious : 0

  // Badge — priorité : streak > tendance
  let badge: BadgeType = null
  if (isHot) {
    if (count >= config.streakChaud) badge = 'en_feu'
    else if (count >= 2)             badge = 'en_forme'
  } else {
    if (count >= config.streakFroid + 3) badge = 'en_crise'
    else if (count >= config.streakFroid) badge = 'en_froid'
  }
  if (badge === null) {
    if (tendance >= 0.5)       badge = 'en_hausse'
    else if (tendance <= -0.5) badge = 'en_baisse'
  }

  return { badge, count, tendance }
}

export async function fetchStreak(
  nhlId: number,
  isGoalie: boolean,
  gameType: 2 | 3,
  config: IndicatorConfig = DEFAULT_INDICATOR_CONFIG,
): Promise<StreakInfo> {
  const log = await fetchGameLog(nhlId, gameType)
  return computeIndicator(log, isGoalie, config)
}

export async function fetchStreaks(
  players: { nhlId: number | null; isGoalie: boolean }[],
  gameType: 2 | 3,
  config: IndicatorConfig = DEFAULT_INDICATOR_CONFIG,
): Promise<Map<number, StreakInfo>> {
  const valid = players.filter((p): p is { nhlId: number; isGoalie: boolean } => p.nhlId !== null)
  const results = await Promise.all(valid.map(p => fetchStreak(p.nhlId, p.isGoalie, gameType, config)))
  const map = new Map<number, StreakInfo>()
  valid.forEach((p, i) => map.set(p.nhlId, results[i]))
  return map
}
