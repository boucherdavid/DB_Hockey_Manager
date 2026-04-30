import { NHL_SEASON } from './nhl-stats'

export type StreakType = 'hot' | 'cold' | null

export type StreakInfo = {
  type: StreakType
  count: number  // matchs consécutifs dans la séquence
}

const MIN_STREAK = 3  // minimum pour afficher l'indicateur

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

function computeFromLog(log: unknown[], isGoalie: boolean): StreakInfo {
  const games = (log as Record<string, unknown>[]).slice().reverse()  // du plus récent au plus ancien
  if (games.length === 0) return { type: null, count: 0 }

  const firstPts = gamePts(games[0], isGoalie)
  const isHot = firstPts >= 1

  let count = 0
  for (const g of games) {
    const pts = gamePts(g, isGoalie)
    if (isHot && pts >= 1) count++
    else if (!isHot && pts === 0) count++
    else break
  }

  if (count < MIN_STREAK) return { type: null, count }
  return { type: isHot ? 'hot' : 'cold', count }
}

export async function fetchStreak(
  nhlId: number,
  isGoalie: boolean,
  gameType: 2 | 3,
): Promise<StreakInfo> {
  const log = await fetchGameLog(nhlId, gameType)
  return computeFromLog(log, isGoalie)
}

export async function fetchStreaks(
  players: { nhlId: number | null; isGoalie: boolean }[],
  gameType: 2 | 3,
): Promise<Map<number, StreakInfo>> {
  const valid = players.filter((p): p is { nhlId: number; isGoalie: boolean } => p.nhlId !== null)
  const results = await Promise.all(valid.map(p => fetchStreak(p.nhlId, p.isGoalie, gameType)))
  const map = new Map<number, StreakInfo>()
  valid.forEach((p, i) => map.set(p.nhlId, results[i]))
  return map
}
