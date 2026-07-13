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

// Vérifie si playerId a été retiré de poolerId il y a moins de delai_reactivation_jours
// par rapport à `date` (comparaison sur les dates effectives, pas l'heure réelle).
export async function checkHistReactivationDelayAction(
  poolerId: string,
  playerId: number,
  poolSeasonId: number,
  date: string,
): Promise<{ warning: string | null }> {
  if (!poolerId || !playerId || !date) return { warning: null }
  const db = createAdminClient()
  const ts = `${date}T12:00:00Z`

  const [{ data: saison }, { data: lastRemoval }] = await Promise.all([
    db.from('pool_seasons').select('delai_reactivation_jours').eq('id', poolSeasonId).single(),
    db.from('pooler_rosters')
      .select('removed_at')
      .eq('pooler_id', poolerId)
      .eq('player_id', playerId)
      .eq('pool_season_id', poolSeasonId)
      .not('removed_at', 'is', null)
      .lte('removed_at', ts)
      .order('removed_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (!lastRemoval?.removed_at) return { warning: null }
  const delai = saison?.delai_reactivation_jours ?? 7
  const days = (new Date(ts).getTime() - new Date(lastRemoval.removed_at).getTime()) / 86_400_000
  if (days < delai) {
    return { warning: `Retiré de ce pooler il y a ${days.toFixed(1)} j (délai de réactivation configuré : ${delai} j).` }
  }
  return { warning: null }
}

export type HistTxType = 'swap' | 'trade' | 'ajout' | 'retrait' | 'type_change'

export type HistPlayerType = 'actif' | 'reserviste' | 'recrue'

export type HistChangeInput = {
  poolSeasonId: number
  date: string            // YYYY-MM-DD
  txType: HistTxType
  // Côté A — toujours requis
  poolerAId: string
  playerOutAId: number | null   // joueur qui quitte le pooler A (ou dont le type change, si type_change)
  playerInAId: number | null    // joueur qui arrive chez le pooler A
  playerInAType: HistPlayerType
  // Côté B — trade seulement
  poolerBId: string | null
  playerInBType: HistPlayerType
  // type_change seulement — nouveau player_type du joueur playerOutAId, sans le retirer du pool
  typeChangeTo: HistPlayerType | null
  // type_change seulement — 2e joueur optionnel, pour un échange (ex: un descend, un monte)
  // dans la même transaction plutôt que 2 saisies séparées
  typeChangeSecondPlayerId: number | null
  typeChangeSecondTo: HistPlayerType | null
  // trade seulement — choix de repêchage échangés (id de pool_draft_picks)
  pickAIds: number[]   // picks de A, transférés vers B
  pickBIds: number[]   // picks de B, transférés vers A
}

export type HistDraftPick = {
  id: number
  round: number
  season: string
  originalOwnerName: string | null
}

export async function getHistDraftPicksAction(poolerId: string): Promise<HistDraftPick[]> {
  if (!poolerId) return []
  const db = createAdminClient()
  const { data } = await db
    .from('pool_draft_picks')
    .select('id, round, pool_seasons(season), original_owner:poolers!original_owner_id(name)')
    .eq('current_owner_id', poolerId)
    .eq('is_used', false)
    .order('pool_season_id')
    .order('round')
  return ((data ?? []) as any[]).map(p => ({
    id: p.id,
    round: p.round,
    season: p.pool_seasons?.season ?? '?',
    originalOwnerName: p.original_owner?.name ?? null,
  }))
}

export async function submitHistChangeAction(
  input: HistChangeInput,
): Promise<{ error?: string }> {
  const db = createAdminClient()
  const ts = `${input.date}T12:00:00Z`
  const changeType = `hist_${input.txType}`

  async function log(playerId: number, poolerId: string, newType: string | null, oldType: string | null = null) {
    const { error } = await db.from('roster_change_log').insert({
      player_id: playerId, pooler_id: poolerId, pool_season_id: input.poolSeasonId,
      change_type: changeType, old_type: oldType, new_type: newType,
      changed_by: null, changed_at: ts, is_admin_override: true,
    })
    if (error) console.error('submitHistChangeAction log:', error.message)
  }

  // Changement de type (actif ↔ réserviste ↔ recrue) sans retrait/ajout — cas à part,
  // le(s) joueur(s) restent dans le pool. Un 2e joueur optionnel permet un échange
  // (un descend, un monte) en une seule transaction.
  if (input.txType === 'type_change') {
    if (!input.playerOutAId || !input.typeChangeTo) return { error: 'Joueur ou type manquant' }

    async function applyTypeChange(playerId: number, newType: string) {
      const { data: existing } = await db
        .from('pooler_rosters')
        .select('player_type')
        .eq('pooler_id', input.poolerAId)
        .eq('player_id', playerId)
        .eq('pool_season_id', input.poolSeasonId)
        .is('removed_at', null)
        .maybeSingle()
      if (!existing) return `Entrée introuvable dans le roster actuel (joueur ${playerId})`
      const { error } = await db
        .from('pooler_rosters')
        .update({ player_type: newType })
        .eq('pooler_id', input.poolerAId)
        .eq('player_id', playerId)
        .eq('pool_season_id', input.poolSeasonId)
        .is('removed_at', null)
      if (error) return `Changement de type : ${error.message}`
      await log(playerId, input.poolerAId, newType, existing.player_type)
      return null
    }

    const err1 = await applyTypeChange(input.playerOutAId, input.typeChangeTo)
    if (err1) return { error: err1 }

    if (input.typeChangeSecondPlayerId && input.typeChangeSecondTo) {
      const err2 = await applyTypeChange(input.typeChangeSecondPlayerId, input.typeChangeSecondTo)
      if (err2) return { error: err2 }
    }

    revalidatePath('/admin/historique')
    revalidatePath('/admin/effectifs')
    return {}
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

    // Choix de repêchage échangés : A → B et B → A
    for (const pickId of input.pickAIds ?? []) {
      const { data: pick } = await db.from('pool_draft_picks').select('current_owner_id, is_used').eq('id', pickId).single()
      if (!pick || pick.is_used || pick.current_owner_id !== input.poolerAId) {
        return { error: `Choix de repêchage (id: ${pickId}) invalide ou n'appartient plus à ce pooler.` }
      }
      const { error } = await db.from('pool_draft_picks').update({ current_owner_id: input.poolerBId }).eq('id', pickId)
      if (error) return { error: `Transfert de pick A→B : ${error.message}` }
    }
    for (const pickId of input.pickBIds ?? []) {
      const { data: pick } = await db.from('pool_draft_picks').select('current_owner_id, is_used').eq('id', pickId).single()
      if (!pick || pick.is_used || pick.current_owner_id !== input.poolerBId) {
        return { error: `Choix de repêchage (id: ${pickId}) invalide ou n'appartient plus à ce pooler.` }
      }
      const { error } = await db.from('pool_draft_picks').update({ current_owner_id: input.poolerAId }).eq('id', pickId)
      if (error) return { error: `Transfert de pick B→A : ${error.message}` }
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
  reactivationWarning: string | null
}

export async function getHistLogAction(poolSeasonId: number): Promise<HistLogEntry[]> {
  const db = createAdminClient()
  // poolers!roster_change_log_pooler_id_fkey : roster_change_log a 2 FK vers poolers
  // (pooler_id et changed_by) — PostgREST refuse un embed "poolers(...)" ambigu.
  const [{ data, error }, { data: saison }, { data: removals }] = await Promise.all([
    db.from('roster_change_log')
      .select('pooler_id, player_id, change_type, new_type, changed_at, created_at, players(first_name, last_name, teams(code)), poolers!roster_change_log_pooler_id_fkey(name)')
      .eq('pool_season_id', poolSeasonId)
      .like('change_type', 'hist_%')
      .order('created_at', { ascending: false })
      .limit(100),
    db.from('pool_seasons').select('delai_reactivation_jours').eq('id', poolSeasonId).single(),
    // Toutes les désactivations de la saison, pour évaluer le délai de réactivation en mémoire
    // plutôt qu'avec une requête par ligne du journal.
    db.from('pooler_rosters')
      .select('pooler_id, player_id, removed_at')
      .eq('pool_season_id', poolSeasonId)
      .not('removed_at', 'is', null),
  ])

  if (error) {
    console.error('getHistLogAction:', error.message)
    return []
  }

  const delai = saison?.delai_reactivation_jours ?? 7

  return ((data ?? []) as any[]).map(r => {
    let reactivationWarning: string | null = null
    if (r.new_type) {
      const priorRemoval = (removals ?? [])
        .filter((x: any) => x.pooler_id === r.pooler_id && x.player_id === r.player_id && x.removed_at <= r.changed_at)
        .sort((a: any, b: any) => (b.removed_at as string).localeCompare(a.removed_at))[0]
      if (priorRemoval) {
        const days = (new Date(r.changed_at).getTime() - new Date(priorRemoval.removed_at).getTime()) / 86_400_000
        if (days < delai) {
          reactivationWarning = `Réactivé ${days.toFixed(1)} j après désactivation (délai configuré : ${delai} j)`
        }
      }
    }
    return {
      txType: (r.change_type as string).replace('hist_', '') as HistTxType,
      poolerName: r.poolers?.name ?? '',
      playerName: `${r.players?.first_name ?? ''} ${r.players?.last_name ?? ''}`.trim(),
      teamCode: r.players?.teams?.code ?? null,
      newType: r.new_type,
      effectiveDate: r.changed_at,
      loggedAt: r.created_at,
      reactivationWarning,
    }
  })
}
