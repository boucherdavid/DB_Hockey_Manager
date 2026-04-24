/**
 * Fetch des stats cumulatives d'un joueur par nhl_id via l'API web NHL.
 * Utilisé pour la prise de snapshots lors des activations/désactivations.
 */

const NHL_WEB = 'https://api-web.nhle.com'

// Doit correspondre à NHL_SEASON dans nhl-stats.ts
const NHL_SEASON_ID = 20252026

export type SnapshotStats = {
  goals: number
  assists: number
  goalie_wins: number
  goalie_otl: number
  goalie_shutouts: number
}

const EMPTY_STATS: SnapshotStats = {
  goals: 0,
  assists: 0,
  goalie_wins: 0,
  goalie_otl: 0,
  goalie_shutouts: 0,
}

/**
 * Retourne les stats cumulatives NHL d'un joueur pour la saison en cours.
 * gameType: 2 = saison régulière, 3 = séries
 * Retourne des zéros si le joueur n'a pas encore joué ou si l'appel échoue.
 */
export async function fetchPlayerStatsById(
  nhlId: number,
  gameType = 2,
): Promise<SnapshotStats> {
  try {
    const res = await fetch(`${NHL_WEB}/v1/player/${nhlId}/landing`, {
      cache: 'no-store',
    })
    if (!res.ok) return EMPTY_STATS

    const data = await res.json()
    const seasonTotals: Record<string, unknown>[] = data.seasonTotals ?? []

    const current = seasonTotals.find(
      s => Number(s.season) === NHL_SEASON_ID && Number(s.gameTypeId) === gameType,
    )

    if (!current) return EMPTY_STATS

    return {
      goals:          Number(current.goals    ?? 0),
      assists:        Number(current.assists   ?? 0),
      goalie_wins:    Number(current.wins      ?? 0),
      goalie_otl:     Number(current.otLosses  ?? 0),
      goalie_shutouts: Number(current.shutouts ?? 0),
    }
  } catch {
    return EMPTY_STATS
  }
}
