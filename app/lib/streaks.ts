import { NHL_SEASON } from './nhl-stats'

export type StreakType = 'hot' | 'cold' | null

export type StreakInfo = {
  type: StreakType
  pts: number  // total pts dans les derniers N matchs
  gp: number   // matchs joués dans la fenêtre
}

const N = 3  // fenêtre de matchs

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

function computeFromLog(log: unknown[], isGoalie: boolean): StreakInfo {
  const recent = (log as Record<string, unknown>[]).slice(-N)
  if (recent.length === 0) return { type: null, pts: 0, gp: 0 }

  const pts = recent.reduce((sum, g) => {
    if (isGoalie) {
      const wins     = typeof g.wins === 'number' ? g.wins : (g.decision === 'W' ? 1 : 0)
      const otLosses = typeof g.otLosses === 'number' ? g.otLosses : (g.decision === 'O' ? 1 : 0)
      const shutouts = typeof g.shutouts === 'number' ? g.shutouts : 0
      return sum + wins * 2 + otLosses + shutouts * 2
    }
    return sum + (typeof g.goals === 'number' ? g.goals : 0)
               + (typeof g.assists === 'number' ? g.assists : 0)
  }, 0)

  const gp = recent.length
  // Chaud : ≥ 1 pt/match en moyenne ; Froid : ≤ 0.33 pt/match (≤ 1 pt sur 3 matchs)
  const type: StreakType = pts / gp >= 1 ? 'hot' : pts <= 1 ? 'cold' : null
  return { type, pts, gp }
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
