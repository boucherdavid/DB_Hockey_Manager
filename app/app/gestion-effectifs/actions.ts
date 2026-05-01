'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { takeSnapshot } from '@/lib/snapshot'
import { sendPushToUser } from '@/lib/push'

export type PlayerType = 'actif' | 'reserviste' | 'ltir' | 'recrue'

export type ActionType =
  | 'swap'
  | 'activate_rookie'
  | 'ltir'
  | 'return_ltir'
  | 'ltir_sign'
  | 'sign'
  | 'release'

export type RosterEntry = {
  id: number
  playerId: number
  playerType: PlayerType
  firstName: string
  lastName: string
  position: string | null
  teamCode: string | null
  nhlId: number | null
  capNumber: number | null
}

export type RosterForPooler = {
  actifs: RosterEntry[]
  reservistes: RosterEntry[]
  ltir: RosterEntry[]
  recrues: RosterEntry[]
}

export type PlayerSearchResult = {
  id: number
  firstName: string
  lastName: string
  position: string | null
  teamCode: string | null
  nhlId: number | null
  capNumber: number | null
}

export type SaisonInfo = {
  id: number
  season: string
  poolCap: number
}

export type BatchActionInput = {
  type: ActionType
  swapActifId?: number
  swapReservisteId?: number
  recrueEntryId?: number
  deactivateActifId?: number
  ltirEntryId?: number
  returnLtirEntryId?: number
  newPlayerId?: number
  newPlayerType?: 'actif' | 'reserviste'
  releaseEntryId?: number
}

export async function getActiveSaisonAction(): Promise<SaisonInfo | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('pool_seasons')
    .select('id, season, pool_cap')
    .eq('is_active', true)
    .single()
  if (!data) return null
  return { id: data.id, season: data.season, poolCap: Number(data.pool_cap) }
}

export async function getPoolerRosterAction(
  poolerId: string,
  saisonId: number,
  season: string,
): Promise<RosterForPooler> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('pooler_rosters')
    .select(`
      id, player_id, player_type,
      players (
        first_name, last_name, position, nhl_id,
        teams (code),
        player_contracts (season, cap_number)
      )
    `)
    .eq('pooler_id', poolerId)
    .eq('pool_season_id', saisonId)
    .eq('is_active', true)
    .order('player_type')

  const entries: RosterEntry[] = (data ?? []).map((r: any) => ({
    id: r.id,
    playerId: r.player_id,
    playerType: (r.player_type === 'agent_libre' ? 'reserviste' : r.player_type) as PlayerType,
    firstName: r.players?.first_name ?? '',
    lastName: r.players?.last_name ?? '',
    position: r.players?.position ?? null,
    teamCode: r.players?.teams?.code ?? null,
    nhlId: r.players?.nhl_id ?? null,
    capNumber: r.players?.player_contracts?.find((c: any) => c.season === season)?.cap_number ?? null,
  }))

  return {
    actifs:      entries.filter(e => e.playerType === 'actif'),
    reservistes: entries.filter(e => e.playerType === 'reserviste'),
    ltir:        entries.filter(e => e.playerType === 'ltir'),
    recrues:     entries.filter(e => e.playerType === 'recrue'),
  }
}

export async function searchPlayersAction(
  query: string,
  season: string,
): Promise<PlayerSearchResult[]> {
  if (query.length < 2) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from('players')
    .select('id, first_name, last_name, position, nhl_id, teams (code), player_contracts (season, cap_number)')
    .or(`last_name.ilike.%${query}%,first_name.ilike.%${query}%`)
    .eq('is_available', true)
    .order('last_name')
    .limit(20)
  return (data ?? []).map((p: any) => ({
    id: p.id,
    firstName: p.first_name,
    lastName: p.last_name,
    position: p.position ?? null,
    teamCode: p.teams?.code ?? null,
    nhlId: p.nhl_id ?? null,
    capNumber: p.player_contracts?.find((c: any) => c.season === season)?.cap_number ?? null,
  }))
}

export async function submitBatchAction(input: {
  poolerId: string
  saisonId: number
  actions: BatchActionInput[]
  forcedDate?: string
}): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { data: poolerSelf } = await supabase
    .from('poolers').select('is_admin').eq('id', user.id).single()
  const isAdmin = poolerSelf?.is_admin ?? false

  if (!isAdmin && user.id !== input.poolerId) return { error: 'Non autorisé' }
  if (input.actions.length === 0) return { error: 'Aucune action à soumettre' }

  const db = createAdminClient()
  const changedAt = input.forcedDate
    ? `${input.forcedDate}T12:00:00Z`
    : new Date().toISOString()
  const changedBy = isAdmin ? null : user.id

  async function getEntry(entryId: number) {
    const { data } = await db
      .from('pooler_rosters')
      .select('player_id, player_type, players (nhl_id)')
      .eq('id', entryId)
      .single()
    return data as { player_id: number; player_type: string; players: { nhl_id: number | null } | null } | null
  }

  async function log(playerId: number, changeType: string, oldType: string | null, newType: string | null) {
    await db.from('roster_change_log').insert({
      player_id: playerId, pooler_id: input.poolerId, pool_season_id: input.saisonId,
      change_type: changeType, old_type: oldType, new_type: newType,
      changed_by: changedBy, changed_at: changedAt,
    })
  }

  async function snap(playerId: number, nhlId: number | null, type: 'activation' | 'deactivation') {
    await takeSnapshot({ playerId, nhlId, poolerId: input.poolerId, poolSeasonId: input.saisonId, snapshotType: type })
  }

  async function deactivate(entryId: number, toType: 'reserviste' | 'ltir') {
    const e = await getEntry(entryId)
    if (!e) throw new Error('Entrée introuvable')
    await db.from('pooler_rosters').update({ player_type: toType }).eq('id', entryId)
    await log(e.player_id, toType === 'ltir' ? 'ltir' : 'deactivation', e.player_type, toType)
    await snap(e.player_id, e.players?.nhl_id ?? null, 'deactivation')
  }

  async function activate(entryId: number, fromType: string) {
    const e = await getEntry(entryId)
    if (!e) throw new Error('Entrée introuvable')
    await db.from('pooler_rosters').update({ player_type: 'actif' }).eq('id', entryId)
    const changeType = fromType === 'ltir' ? 'retour_ltir' : 'activation'
    await log(e.player_id, changeType, fromType, 'actif')
    await snap(e.player_id, e.players?.nhl_id ?? null, 'activation')
  }

  async function addNewPlayer(playerId: number, playerType: 'actif' | 'reserviste') {
    const { data: existing } = await db
      .from('pooler_rosters').select('id')
      .eq('pooler_id', input.poolerId).eq('player_id', playerId)
      .eq('pool_season_id', input.saisonId).maybeSingle()
    if (existing) {
      await db.from('pooler_rosters')
        .update({ is_active: true, player_type: playerType, removed_at: null }).eq('id', existing.id)
    } else {
      await db.from('pooler_rosters').insert({
        pooler_id: input.poolerId, player_id: playerId,
        pool_season_id: input.saisonId, player_type: playerType, is_active: true,
      })
    }
    const { data: p } = await db.from('players').select('nhl_id').eq('id', playerId).single()
    await log(playerId, 'signature_agent_libre', null, playerType)
    if (playerType === 'actif') await snap(playerId, p?.nhl_id ?? null, 'activation')
  }

  try {
    for (const action of input.actions) {
      switch (action.type) {
        case 'swap':
          if (!action.swapActifId || !action.swapReservisteId) throw new Error('Joueurs manquants (échange)')
          await deactivate(action.swapActifId, 'reserviste')
          await activate(action.swapReservisteId, 'reserviste')
          break

        case 'activate_rookie':
          if (!action.recrueEntryId || !action.deactivateActifId) throw new Error('Joueurs manquants (activation recrue)')
          await deactivate(action.deactivateActifId, 'reserviste')
          await activate(action.recrueEntryId, 'recrue')
          break

        case 'ltir':
          if (!action.ltirEntryId) throw new Error('Joueur manquant (LTIR)')
          await deactivate(action.ltirEntryId, 'ltir')
          break

        case 'return_ltir':
          if (!action.returnLtirEntryId || !action.deactivateActifId) throw new Error('Joueurs manquants (retour LTIR)')
          await deactivate(action.deactivateActifId, 'reserviste')
          await activate(action.returnLtirEntryId, 'ltir')
          break

        case 'ltir_sign':
          if (!action.ltirEntryId || !action.newPlayerId) throw new Error('Joueurs manquants (LTIR + signature)')
          await deactivate(action.ltirEntryId, 'ltir')
          await addNewPlayer(action.newPlayerId, 'actif')
          break

        case 'sign':
          if (!action.newPlayerId || !action.newPlayerType) throw new Error('Joueur manquant (signature)')
          await addNewPlayer(action.newPlayerId, action.newPlayerType)
          break

        case 'release': {
          if (!action.releaseEntryId) throw new Error('Joueur manquant (libération)')
          const e = await getEntry(action.releaseEntryId)
          if (!e) throw new Error('Entrée introuvable (libération)')
          if (e.player_type === 'actif') await snap(e.player_id, e.players?.nhl_id ?? null, 'deactivation')
          await log(e.player_id, e.player_type === 'actif' ? 'deactivation' : 'retrait', e.player_type, null)
          await db.from('pooler_rosters')
            .update({ is_active: false, removed_at: changedAt }).eq('id', action.releaseEntryId)
          break
        }

        default:
          throw new Error(`Action inconnue`)
      }
    }

    if (isAdmin) {
      const n = input.actions.length
      sendPushToUser(input.poolerId, {
        title: 'DB Hockey Manager — Mouvements',
        body: n === 1
          ? "Votre alignement a été modifié par l'admin."
          : `${n} mouvements ont été appliqués à votre alignement.`,
        url: `/poolers/${input.poolerId}`,
      }).catch(() => {})
    }

    return {}
  } catch (e: any) {
    return { error: e?.message ?? 'Erreur inconnue' }
  }
}
