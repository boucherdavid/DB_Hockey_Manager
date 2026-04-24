'use server'

import { createClient } from '@/lib/supabase/server'
import { fetchPlayerStatsById } from './nhl-snapshot'

export type SnapshotType = 'activation' | 'deactivation' | 'season_end'

type SnapshotParams = {
  playerId: number
  nhlId: number | null
  poolerId: string
  poolSeasonId: number
  snapshotType: SnapshotType
  takenAt?: Date
  gameType?: number
}

/**
 * Prend un snapshot des stats NHL d'un joueur et l'insère dans player_stat_snapshots.
 * Si nhlId est null ou que l'appel NHL échoue, les stats sont à zéro (joueur sans matchs).
 */
export async function takeSnapshot({
  playerId,
  nhlId,
  poolerId,
  poolSeasonId,
  snapshotType,
  takenAt,
  gameType = 2,
}: SnapshotParams): Promise<{ error?: string }> {
  const supabase = await createClient()

  const stats = nhlId ? await fetchPlayerStatsById(nhlId, gameType) : {
    goals: 0, assists: 0, goalie_wins: 0, goalie_otl: 0, goalie_shutouts: 0,
  }

  const { error } = await supabase.from('player_stat_snapshots').insert({
    player_id:      playerId,
    pooler_id:      poolerId,
    pool_season_id: poolSeasonId,
    snapshot_type:  snapshotType,
    taken_at:       (takenAt ?? new Date()).toISOString(),
    ...stats,
  })

  return error ? { error: error.message } : {}
}

/**
 * Prend un snapshot season_end pour tous les joueurs actifs d'une saison.
 * À appeler par l'admin en fin de saison via une action dédiée.
 */
export async function takeSeasonEndSnapshots(
  poolSeasonId: number,
): Promise<{ count: number; errors: string[] }> {
  const supabase = await createClient()

  const { data: actifs } = await supabase
    .from('pooler_rosters')
    .select('player_id, pooler_id, players(nhl_id)')
    .eq('pool_season_id', poolSeasonId)
    .eq('player_type', 'actif')
    .eq('is_active', true)

  let count = 0
  const errors: string[] = []

  for (const row of actifs ?? []) {
    const nhlId = (row.players as any)?.nhl_id ?? null
    const result = await takeSnapshot({
      playerId:      row.player_id,
      nhlId,
      poolerId:      row.pooler_id,
      poolSeasonId,
      snapshotType:  'season_end',
    })
    if (result.error) {
      errors.push(`player ${row.player_id}: ${result.error}`)
    } else {
      count++
    }
  }

  return { count, errors }
}
