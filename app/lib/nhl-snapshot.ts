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

export const EMPTY_STATS: SnapshotStats = {
  goals: 0,
  assists: 0,
  goalie_wins: 0,
  goalie_otl: 0,
  goalie_shutouts: 0,
}

/**
 * Retourne les stats cumulatives NHL d'un joueur pour les matchs joués
 * STRICTEMENT AVANT la date deadline (comparaison sur YYYY-MM-DD).
 * Utilisé pour créer des baselines correctes à l'heure exacte de la deadline.
 */
export async function fetchPlayerStatsAsOfDate(
  nhlId: number,
  gameType: 2 | 3,
  deadline: Date,
): Promise<SnapshotStats> {
  try {
    const res = await fetch(
      `${NHL_WEB}/v1/player/${nhlId}/game-log/${NHL_SEASON_ID}/${gameType}`,
      { cache: 'no-store' },
    )
    if (!res.ok) return EMPTY_STATS
    const data = await res.json()
    const log: Record<string, unknown>[] = data.gameLog ?? []

    const deadlineDateStr = deadline.toISOString().split('T')[0] // YYYY-MM-DD
    let goals = 0, assists = 0, wins = 0, otLosses = 0, shutouts = 0
    for (const g of log) {
      const gameDate = String(g.gameDate ?? '')
      if (!gameDate || gameDate >= deadlineDateStr) continue
      goals    += typeof g.goals    === 'number' ? g.goals    : 0
      assists  += typeof g.assists  === 'number' ? g.assists  : 0
      wins     += typeof g.wins     === 'number' ? g.wins     : (g.decision === 'W' ? 1 : 0)
      otLosses += typeof g.otLosses === 'number' ? g.otLosses : (g.decision === 'O' ? 1 : 0)
      shutouts += typeof g.shutouts === 'number' ? g.shutouts : 0
    }
    return { goals, assists, goalie_wins: wins, goalie_otl: otLosses, goalie_shutouts: shutouts }
  } catch {
    return EMPTY_STATS
  }
}

/**
 * Retourne les stats cumulatives NHL d'un joueur pour la saison en cours.
 * gameType: 2 = saison régulière, 3 = séries
 * Retourne des zéros si le joueur n'a pas encore joué ou si l'appel échoue.
 */
export async function fetchPlayerStatsById(
  nhlId: number,
  gameType = 2,
): Promise<SnapshotStats | null> {
  try {
    const res = await fetch(`${NHL_WEB}/v1/player/${nhlId}/landing`, {
      cache: 'no-store',
    })
    // null = échec réseau/API — ne pas confondre avec "0 stats légitimes"
    if (!res.ok) return null

    const data = await res.json()
    const seasonTotals: Record<string, unknown>[] = data.seasonTotals ?? []

    const current = seasonTotals.find(
      s => Number(s.season) === NHL_SEASON_ID && Number(s.gameTypeId) === gameType,
    )

    // Joueur sans stats pour ce gameType (ex: pas encore joué en playoffs) → 0 légitimes
    if (!current) return EMPTY_STATS

    return {
      goals:           Number(current.goals    ?? 0),
      assists:         Number(current.assists   ?? 0),
      goalie_wins:     Number(current.wins      ?? 0),
      goalie_otl:      Number(current.otLosses  ?? 0),
      goalie_shutouts: Number(current.shutouts  ?? 0),
    }
  } catch {
    // Exception (timeout, parse error) → null, pas des zéros
    return null
  }
}
