'use server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export type HistRosterEntry = {
  id: number
  playerId: number
  name: string
  position: string | null
  teamCode: string | null
  playerType: string
  addedAt: string
}

export async function getHistRosterAction(
  poolerId: string,
  poolSeasonId: number,
): Promise<HistRosterEntry[]> {
  const db = createAdminClient()
  const { data } = await db
    .from('pooler_rosters')
    .select('id, player_id, player_type, added_at, players(first_name, last_name, position, teams(code))')
    .eq('pooler_id', poolerId)
    .eq('pool_season_id', poolSeasonId)
    .is('removed_at', null)
    .order('player_type')
  return (data ?? []).map((r: any) => ({
    id: r.id,
    playerId: r.player_id,
    name: `${r.players?.first_name ?? ''} ${r.players?.last_name ?? ''}`.trim(),
    position: r.players?.position ?? null,
    teamCode: r.players?.teams?.code ?? null,
    playerType: r.player_type,
    addedAt: r.added_at,
  }))
}

export type HistPlayerResult = {
  id: number
  name: string
  position: string | null
  teamCode: string | null
}

export async function searchHistPlayersAction(query: string): Promise<HistPlayerResult[]> {
  if (query.trim().length < 2) return []
  const db = createAdminClient()
  const { data } = await db
    .from('players')
    .select('id, first_name, last_name, position, teams(code)')
    .or(`last_name.ilike.%${query}%,first_name.ilike.%${query}%`)
    .limit(15)
  return (data ?? []).map((p: any) => ({
    id: p.id,
    name: `${p.first_name} ${p.last_name}`,
    position: p.position ?? null,
    teamCode: p.teams?.code ?? null,
  }))
}

export type HistTxType = 'swap' | 'trade' | 'ajout' | 'retrait'

export type HistChangeInput = {
  poolSeasonId: number
  date: string            // YYYY-MM-DD
  txType: HistTxType
  // Côté A — toujours requis
  poolerAId: string
  playerOutAId: number | null   // joueur qui quitte le pooler A
  playerInAId: number | null    // joueur qui arrive chez le pooler A
  playerInAType: 'actif' | 'reserviste'
  // Côté B — trade seulement
  poolerBId: string | null
  playerInBType: 'actif' | 'reserviste'
}

export async function submitHistChangeAction(
  input: HistChangeInput,
): Promise<{ error?: string }> {
  const db = createAdminClient()
  const ts = `${input.date}T12:00:00Z`
  const changeType = `hist_${input.txType}`

  async function log(playerId: number, poolerId: string, newType: string | null, oldType: string | null = null) {
    await db.from('roster_change_log').insert({
      player_id: playerId, pooler_id: poolerId, pool_season_id: input.poolSeasonId,
      change_type: changeType, old_type: oldType, new_type: newType,
      changed_by: null, changed_at: ts, is_admin_override: true,
    })
  }

  // Retirer le joueur du pooler A
  if (input.playerOutAId) {
    const { error } = await db
      .from('pooler_rosters')
      .update({ is_active: false, removed_at: ts })
      .eq('pooler_id', input.poolerAId)
      .eq('player_id', input.playerOutAId)
      .eq('pool_season_id', input.poolSeasonId)
      .is('removed_at', null)
    if (error) return { error: `Retrait A : ${error.message}` }
    await log(input.playerOutAId, input.poolerAId, null)
  }

  // Ajouter un joueur chez le pooler A
  if (input.playerInAId) {
    const { error } = await db.from('pooler_rosters').insert({
      pooler_id: input.poolerAId,
      player_id: input.playerInAId,
      pool_season_id: input.poolSeasonId,
      player_type: input.playerInAType,
      is_active: true,
      added_at: ts,
    })
    if (error) return { error: `Ajout A : ${error.message}` }
    await log(input.playerInAId, input.poolerAId, input.playerInAType)
  }

  // Échange entre poolers : côté B
  // playerOutA va chez B, playerInA vient de B (donc playerInA quitte B)
  if (input.txType === 'trade' && input.poolerBId) {
    // Retirer playerInA du pooler B (il part vers A)
    if (input.playerInAId) {
      const { error } = await db
        .from('pooler_rosters')
        .update({ is_active: false, removed_at: ts })
        .eq('pooler_id', input.poolerBId)
        .eq('player_id', input.playerInAId)
        .eq('pool_season_id', input.poolSeasonId)
        .is('removed_at', null)
      if (error) return { error: `Retrait B : ${error.message}` }
      await log(input.playerInAId, input.poolerBId, null)
    }
    // Ajouter playerOutA chez le pooler B (il arrive de A)
    if (input.playerOutAId) {
      const { error } = await db.from('pooler_rosters').insert({
        pooler_id: input.poolerBId,
        player_id: input.playerOutAId,
        pool_season_id: input.poolSeasonId,
        player_type: input.playerInBType,
        is_active: true,
        added_at: ts,
      })
      if (error) return { error: `Ajout B : ${error.message}` }
      await log(input.playerOutAId, input.poolerBId, input.playerInBType)
    }
  }

  revalidatePath('/admin/historique')
  revalidatePath('/admin/effectifs')
  return {}
}

export type HistLogEntry = {
  txType: HistTxType
  poolerName: string
  playerName: string
  teamCode: string | null
  newType: string | null
  effectiveDate: string   // changed_at — date du mouvement dans le pool
  loggedAt: string        // created_at — moment réel de la saisie
}

export async function getHistLogAction(poolSeasonId: number): Promise<HistLogEntry[]> {
  const db = createAdminClient()
  const { data } = await db
    .from('roster_change_log')
    .select('change_type, new_type, changed_at, created_at, players(first_name, last_name, teams(code)), poolers(name)')
    .eq('pool_season_id', poolSeasonId)
    .like('change_type', 'hist_%')
    .order('created_at', { ascending: false })
    .limit(100)

  return ((data ?? []) as any[]).map(r => ({
    txType: (r.change_type as string).replace('hist_', '') as HistTxType,
    poolerName: r.poolers?.name ?? '',
    playerName: `${r.players?.first_name ?? ''} ${r.players?.last_name ?? ''}`.trim(),
    teamCode: r.players?.teams?.code ?? null,
    newType: r.new_type,
    effectiveDate: r.changed_at,
    loggedAt: r.created_at,
  }))
}
