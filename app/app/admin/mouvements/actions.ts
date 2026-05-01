'use server'

import { createClient } from '@/lib/supabase/server'
import { takeSnapshot } from '@/lib/snapshot'
import { sendPushToUser } from '@/lib/push'

export type PlayerType = 'actif' | 'reserviste' | 'ltir' | 'recrue'

export type RosterEntry = {
  id: number
  playerId: number
  playerType: PlayerType
  firstName: string
  lastName: string
  position: string | null
  teamCode: string | null
  nhlId: number | null
}

export type RosterForPooler = {
  actifs: RosterEntry[]
  reservistes: RosterEntry[]
  ltir: RosterEntry[]
  recrues: RosterEntry[]
}

export type ActionType =
  | 'swap'            // Ajustement d'alignement (actif ↔ réserviste)
  | 'activate_rookie' // Activation recrue (recrue → actif)
  | 'ltir'            // Mise sur LTIR
  | 'return_ltir'     // Retour LTIR
  | 'ltir_sign'       // Agent libre + LTIR
  | 'sign'            // Signature agent libre
  | 'release'         // Libération

export type MouvementInput = {
  poolerId: string
  saisonId: number
  actionType: ActionType
  date: string               // YYYY-MM-DD
  swapActifId?: number       // roster entry id
  swapReservisteId?: number  // roster entry id
  recrueEntryId?: number     // roster entry id
  deactivateActifId?: number // roster entry id (actif → réserviste)
  ltirEntryId?: number       // roster entry id
  returnLtirEntryId?: number // roster entry id
  newPlayerId?: number       // players table id
  newPlayerType?: 'actif' | 'reserviste'
  releaseEntryId?: number    // roster entry id
}

export async function getPoolerRosterAction(
  poolerId: string,
  saisonId: number,
): Promise<RosterForPooler> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('pooler_rosters')
    .select('id, player_id, player_type, players (first_name, last_name, position, nhl_id, teams (code))')
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
  }))

  return {
    actifs:     entries.filter(e => e.playerType === 'actif'),
    reservistes: entries.filter(e => e.playerType === 'reserviste'),
    ltir:       entries.filter(e => e.playerType === 'ltir'),
    recrues:    entries.filter(e => e.playerType === 'recrue'),
  }
}

export async function searchPlayersAction(query: string): Promise<{
  id: number; firstName: string; lastName: string
  position: string | null; teamCode: string | null
}[]> {
  if (query.length < 2) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from('players')
    .select('id, first_name, last_name, position, teams (code)')
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
  }))
}

export async function checkEffectiveDateAction(
  nhlIds: (number | null)[],
): Promise<{ isToday: boolean; warning: string | null }> {
  const valid = nhlIds.filter((id): id is number => id !== null)
  if (valid.length === 0) return { isToday: true, warning: null }

  try {
    const today = new Intl.DateTimeFormat('fr-CA', { timeZone: 'America/Toronto' }).format(new Date())
    const res = await fetch(`https://api-web.nhle.com/v1/schedule/${today}`, { next: { revalidate: 60 } })
    if (!res.ok) return { isToday: true, warning: null }

    const data = await res.json()
    const todayGames = (data.gameWeek ?? []).find((d: any) => d.date === today)?.games ?? []

    const supabase = await createClient()
    const { data: players } = await supabase
      .from('players')
      .select('nhl_id, teams (code)')
      .in('nhl_id', valid)
    const teamCodes = new Set((players ?? []).map((p: any) => p.teams?.code).filter(Boolean) as string[])

    const playedGame = todayGames.find((g: any) => {
      const hasTeam = teamCodes.has(g.awayTeam?.abbrev) || teamCodes.has(g.homeTeam?.abbrev)
      const started = !['FUT', 'PRE'].includes(g.gameState ?? '')
      return hasTeam && started
    })

    if (playedGame) {
      const involved = [playedGame.awayTeam?.abbrev, playedGame.homeTeam?.abbrev]
        .filter((t): t is string => !!t && teamCodes.has(t)).join(', ')
      return {
        isToday: false,
        warning: `${involved} a déjà joué aujourd'hui — le changement sera effectif demain`,
      }
    }
  } catch { /* ignore */ }

  return { isToday: true, warning: null }
}

export async function submitMouvementAction(
  input: MouvementInput,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const changedAt = `${input.date}T12:00:00Z`
  const isToday = input.date === new Intl.DateTimeFormat('fr-CA', { timeZone: 'America/Toronto' }).format(new Date())

  async function getEntry(entryId: number) {
    const { data } = await supabase
      .from('pooler_rosters')
      .select('player_id, player_type, players (nhl_id)')
      .eq('id', entryId)
      .single()
    return data as { player_id: number; player_type: string; players: { nhl_id: number | null } | null } | null
  }

  async function log(playerId: number, changeType: string, oldType: string | null, newType: string | null) {
    await supabase.from('roster_change_log').insert({
      player_id: playerId, pooler_id: input.poolerId, pool_season_id: input.saisonId,
      change_type: changeType, old_type: oldType, new_type: newType,
      changed_by: null, changed_at: changedAt,
    })
  }

  async function snap(playerId: number, nhlId: number | null, type: 'activation' | 'deactivation') {
    await takeSnapshot({ playerId, nhlId, poolerId: input.poolerId, poolSeasonId: input.saisonId, snapshotType: type })
  }

  async function deactivate(entryId: number, toType: 'reserviste' | 'ltir') {
    const e = await getEntry(entryId)
    if (!e) throw new Error('Entrée introuvable')
    await supabase.from('pooler_rosters').update({ player_type: toType }).eq('id', entryId)
    await log(e.player_id, toType === 'ltir' ? 'ltir' : 'deactivation', e.player_type, toType)
    await snap(e.player_id, e.players?.nhl_id ?? null, 'deactivation')
    return e
  }

  async function activate(entryId: number, fromType: string) {
    const e = await getEntry(entryId)
    if (!e) throw new Error('Entrée introuvable')
    await supabase.from('pooler_rosters').update({ player_type: 'actif' }).eq('id', entryId)
    const changeType = fromType === 'ltir' ? 'retour_ltir' : 'activation'
    await log(e.player_id, changeType, fromType, 'actif')
    await snap(e.player_id, e.players?.nhl_id ?? null, 'activation')
    return e
  }

  async function addNewPlayer(playerId: number, playerType: 'actif' | 'reserviste') {
    const { data: existing } = await supabase
      .from('pooler_rosters').select('id')
      .eq('pooler_id', input.poolerId).eq('player_id', playerId)
      .eq('pool_season_id', input.saisonId).maybeSingle()
    if (existing) {
      await supabase.from('pooler_rosters')
        .update({ is_active: true, player_type: playerType, removed_at: null }).eq('id', existing.id)
    } else {
      await supabase.from('pooler_rosters').insert({
        pooler_id: input.poolerId, player_id: playerId,
        pool_season_id: input.saisonId, player_type: playerType, is_active: true,
      })
    }
    const { data: p } = await supabase.from('players').select('nhl_id').eq('id', playerId).single()
    await log(playerId, 'signature_agent_libre', null, playerType)
    if (playerType === 'actif') await snap(playerId, p?.nhl_id ?? null, 'activation')
  }

  try {
    switch (input.actionType) {
      case 'swap':
        if (!input.swapActifId || !input.swapReservisteId) return { error: 'Joueurs manquants' }
        await deactivate(input.swapActifId, 'reserviste')
        await activate(input.swapReservisteId, 'reserviste')
        break

      case 'activate_rookie':
        if (!input.recrueEntryId || !input.deactivateActifId) return { error: 'Joueurs manquants' }
        await deactivate(input.deactivateActifId, 'reserviste')
        await activate(input.recrueEntryId, 'recrue')
        break

      case 'ltir':
        if (!input.ltirEntryId) return { error: 'Joueur manquant' }
        await deactivate(input.ltirEntryId, 'ltir')
        break

      case 'return_ltir':
        if (!input.returnLtirEntryId || !input.deactivateActifId) return { error: 'Joueurs manquants' }
        await deactivate(input.deactivateActifId, 'reserviste')
        await activate(input.returnLtirEntryId, 'ltir')
        break

      case 'ltir_sign':
        if (!input.ltirEntryId || !input.newPlayerId) return { error: 'Joueurs manquants' }
        await deactivate(input.ltirEntryId, 'ltir')
        await addNewPlayer(input.newPlayerId, 'actif')
        break

      case 'sign':
        if (!input.newPlayerId || !input.newPlayerType) return { error: 'Joueur manquant' }
        await addNewPlayer(input.newPlayerId, input.newPlayerType)
        break

      case 'release': {
        if (!input.releaseEntryId) return { error: 'Joueur manquant' }
        const e = await getEntry(input.releaseEntryId)
        if (!e) return { error: 'Entrée introuvable' }
        if (e.player_type === 'actif') await snap(e.player_id, e.players?.nhl_id ?? null, 'deactivation')
        await log(e.player_id, e.player_type === 'actif' ? 'deactivation' : 'retrait', e.player_type, null)
        await supabase.from('pooler_rosters')
          .update({ is_active: false, removed_at: changedAt }).eq('id', input.releaseEntryId)
        break
      }

      default:
        return { error: 'Action inconnue' }
    }

    if (isToday) {
      sendPushToUser(input.poolerId, {
        title: 'DB Hockey Manager — Mouvement',
        body: 'Votre alignement a été modifié par l\'admin.',
        url: `/poolers/${input.poolerId}`,
      }).catch(() => {})
    }

    return {}
  } catch (e: any) {
    return { error: e?.message ?? 'Erreur inconnue' }
  }
}
