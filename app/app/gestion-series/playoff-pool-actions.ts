'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

// ─── Helpers ─────────────────────────────────────────────────────────────────

// "2026-PO" → "2025-26"  (format utilisé dans player_contracts.season)
function toNhlSeason(poolSeason: string): string {
  const year = parseInt(poolSeason)
  return `${year - 1}-${String(year).slice(-2)}`
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type PlayoffPoolSaison = {
  id: number
  season: string
  poolCap: number
  submissionDeadline: string | null
  maxChanges: number
  maxElimChanges: number
  maxF: number
  maxD: number
  maxG: number
  gestionOuverte: boolean
}

export type PlayoffPoolEntry = {
  id: number
  playerId: number
  positionSlot: 'F' | 'D' | 'G'
  firstName: string
  lastName: string
  position: string | null
  teamCode: string | null
  teamId: number | null
  nhlId: number | null
  capNumber: number | null
  teamEliminated: boolean
  addedAt: string
}

export type PlayoffPoolPlayerResult = {
  id: number
  firstName: string
  lastName: string
  position: string | null
  teamCode: string | null
  teamId: number | null
  nhlId: number | null
  capNumber: number | null
  teamEliminated: boolean
}

export type PlayoffChangeCounts = {
  voluntary: number
  elimination: number
}

export type PlayoffPoolStanding = {
  poolerId: string
  poolerName: string
  totalPoints: number
  players: {
    playerId: number
    nhlId: number | null
    firstName: string
    lastName: string
    teamCode: string | null
    positionSlot: 'F' | 'D' | 'G'
    goals: number
    assists: number
    goalieWins: number
    goalieOtl: number
    goalieShutouts: number
    points: number
    isActive: boolean
  }[]
}

// ─── Read actions ─────────────────────────────────────────────────────────────

export async function getPlayoffPoolSaisonAction(): Promise<PlayoffPoolSaison | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('pool_seasons')
    .select('id, season, pool_cap, playoff_submission_deadline, playoff_max_changes, playoff_max_elim_changes, playoff_max_f, playoff_max_d, playoff_max_g, gestion_effectifs_ouvert')
    .eq('is_active', true)
    .eq('is_playoff', true)
    .single()
  if (!data) return null
  return {
    id: data.id,
    season: data.season,
    poolCap: Number(data.pool_cap),
    submissionDeadline: data.playoff_submission_deadline ?? null,
    maxChanges: data.playoff_max_changes ?? 5,
    maxElimChanges: data.playoff_max_elim_changes ?? 5,
    maxF: data.playoff_max_f ?? 5,
    maxD: data.playoff_max_d ?? 3,
    maxG: data.playoff_max_g ?? 1,
    gestionOuverte: data.gestion_effectifs_ouvert ?? true,
  }
}

export async function getPlayoffPoolRosterAction(
  poolerId: string,
  poolSeasonId: number,
  season: string,
): Promise<PlayoffPoolEntry[]> {
  const supabase = await createClient()
  const db = createAdminClient()
  const [{ data: entries }, { data: elims }, { data: participating }] = await Promise.all([
    supabase
      .from('playoff_pool_rosters')
      .select('id, player_id, position_slot, added_at, players(first_name, last_name, position, nhl_id, teams(id, code), player_contracts(season, cap_number))')
      .eq('pooler_id', poolerId)
      .eq('pool_season_id', poolSeasonId)
      .eq('is_active', true),
    db.from('playoff_eliminations').select('team_id').eq('pool_season_id', poolSeasonId),
    db.from('playoff_participating_teams').select('team_id').eq('pool_season_id', poolSeasonId),
  ])
  const eliminatedIds = new Set((elims ?? []).map((e: any) => e.team_id))
  const participatingIds = new Set((participating ?? []).map((e: any) => e.team_id))
  // Une équipe est "éliminée" si explicitement dans playoff_eliminations,
  // ou si des équipes participantes sont configurées et que la sienne n'en fait plus partie.
  const isEliminated = (teamId: number | undefined) =>
    !!teamId && (eliminatedIds.has(teamId) || (participatingIds.size > 0 && !participatingIds.has(teamId)))
  return (entries ?? []).map((r: any) => ({
    id: r.id,
    playerId: r.player_id,
    positionSlot: r.position_slot as 'F' | 'D' | 'G',
    firstName: r.players?.first_name ?? '',
    lastName: r.players?.last_name ?? '',
    position: r.players?.position ?? null,
    teamCode: r.players?.teams?.code ?? null,
    teamId: r.players?.teams?.id ?? null,
    nhlId: r.players?.nhl_id ?? null,
    capNumber: r.players?.player_contracts?.find((c: any) => c.season === toNhlSeason(season))?.cap_number ?? null,
    teamEliminated: isEliminated(r.players?.teams?.id),
    addedAt: r.added_at,
  }))
}

export async function getPlayoffChangeCountsAction(
  poolerId: string,
  poolSeasonId: number,
): Promise<PlayoffChangeCounts> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('playoff_pool_rosters')
    .select('removal_reason')
    .eq('pooler_id', poolerId)
    .eq('pool_season_id', poolSeasonId)
    .not('removed_at', 'is', null)
  const rows = data ?? []
  return {
    voluntary: rows.filter((r: any) => r.removal_reason === 'voluntary').length,
    elimination: rows.filter((r: any) => r.removal_reason === 'elimination').length,
  }
}

export async function getAvailablePlayoffPlayersAction(
  poolSeasonId: number,
  season: string,
): Promise<PlayoffPoolPlayerResult[]> {
  const supabase = await createClient()
  const db = createAdminClient()
  const nhlSeason = toNhlSeason(season)

  // playoff_participating_teams a RLS sans politique — utiliser le client admin
  const [{ data: participating }, { data: elims }] = await Promise.all([
    db.from('playoff_participating_teams').select('team_id').eq('pool_season_id', poolSeasonId),
    db.from('playoff_eliminations').select('team_id').eq('pool_season_id', poolSeasonId),
  ])

  const teamIds = (participating ?? []).map((r: any) => r.team_id)
  const eliminatedIds = new Set((elims ?? []).map((e: any) => e.team_id))

  // Charger les joueurs : si équipes participantes configurées, filtrer par équipe
  // (is_available inutile ici — le filtre team_id est suffisant)
  // sinon retourner tous les joueurs disponibles (is_available comme garde-fou)
  let query = supabase
    .from('players')
    .select('id, first_name, last_name, position, nhl_id, teams(id, code), player_contracts(season, cap_number)')
  if (teamIds.length > 0) {
    query = query.in('team_id', teamIds)
  } else {
    query = query.eq('is_available', true)
  }

  const { data: players } = await query

  return (players ?? [])
    .map((p: any) => ({
      id: p.id,
      firstName: p.first_name,
      lastName: p.last_name,
      position: p.position ?? null,
      teamCode: p.teams?.code ?? null,
      teamId: p.teams?.id ?? null,
      nhlId: p.nhl_id ?? null,
      capNumber: (p.player_contracts as any[])?.find((c: any) => c.season === nhlSeason)?.cap_number ?? null,
      teamEliminated: eliminatedIds.has(p.teams?.id),
    }))
    .filter(p => p.nhlId !== null)
    .sort((a, b) => {
      const teamCmp = (a.teamCode ?? 'zzz').localeCompare(b.teamCode ?? 'zzz')
      if (teamCmp !== 0) return teamCmp
      const capA = a.capNumber ?? -1
      const capB = b.capNumber ?? -1
      if (capB !== capA) return capB - capA
      return a.lastName.localeCompare(b.lastName)
    })
}

export async function searchPlayoffPoolPlayersAction(
  query: string,
  poolSeasonId: number,
  season: string,
): Promise<PlayoffPoolPlayerResult[]> {
  if (query.length < 2) return []
  const supabase = await createClient()
  const [{ data: players }, { data: elims }] = await Promise.all([
    supabase
      .from('players')
      .select('id, first_name, last_name, position, nhl_id, teams(id, code), player_contracts(season, cap_number)')
      .or(`last_name.ilike.%${query}%,first_name.ilike.%${query}%`)
      .eq('is_available', true)
      .limit(30),
    supabase
      .from('playoff_eliminations')
      .select('team_id')
      .eq('pool_season_id', poolSeasonId),
  ])
  const eliminatedIds = new Set((elims ?? []).map((e: any) => e.team_id))
  return (players ?? []).map((p: any) => ({
    id: p.id,
    firstName: p.first_name,
    lastName: p.last_name,
    position: p.position ?? null,
    teamCode: p.teams?.code ?? null,
    teamId: p.teams?.id ?? null,
    nhlId: p.nhl_id ?? null,
    capNumber: p.player_contracts?.find((c: any) => c.season === toNhlSeason(season))?.cap_number ?? null,
    teamEliminated: eliminatedIds.has(p.teams?.id),
  }))
  .sort((a, b) => {
    const teamCmp = (a.teamCode ?? 'zzz').localeCompare(b.teamCode ?? 'zzz')
    if (teamCmp !== 0) return teamCmp
    const capA = a.capNumber ?? -1
    const capB = b.capNumber ?? -1
    if (capB !== capA) return capB - capA
    return a.lastName.localeCompare(b.lastName)
  })
}

export async function getAllPlayoffPoolRostersAction(
  poolSeasonId: number,
  season: string,
): Promise<{ poolerId: string; poolerName: string; entries: PlayoffPoolEntry[] }[]> {
  const supabase = await createClient()
  const [{ data: entries }, { data: elims }, { data: poolers }] = await Promise.all([
    supabase
      .from('playoff_pool_rosters')
      .select('pooler_id, player_id, position_slot, added_at, players(first_name, last_name, position, nhl_id, teams(id, code), player_contracts(season, cap_number))')
      .eq('pool_season_id', poolSeasonId)
      .eq('is_active', true),
    supabase.from('playoff_eliminations').select('team_id').eq('pool_season_id', poolSeasonId),
    supabase.from('poolers').select('id, name').order('name'),
  ])
  const eliminatedIds = new Set((elims ?? []).map((e: any) => e.team_id))
  const grouped = new Map<string, PlayoffPoolEntry[]>()
  for (const r of entries ?? []) {
    if (!grouped.has(r.pooler_id)) grouped.set(r.pooler_id, [])
    grouped.get(r.pooler_id)!.push({
      id: 0,
      playerId: r.player_id,
      positionSlot: r.position_slot as 'F' | 'D' | 'G',
      firstName: (r.players as any)?.first_name ?? '',
      lastName: (r.players as any)?.last_name ?? '',
      position: (r.players as any)?.position ?? null,
      teamCode: (r.players as any)?.teams?.code ?? null,
      teamId: (r.players as any)?.teams?.id ?? null,
      nhlId: (r.players as any)?.nhl_id ?? null,
      capNumber: (r.players as any)?.player_contracts?.find((c: any) => c.season === toNhlSeason(season))?.cap_number ?? null,
      teamEliminated: eliminatedIds.has((r.players as any)?.teams?.id),
      addedAt: r.added_at,
    })
  }
  return (poolers ?? []).map(p => ({
    poolerId: p.id,
    poolerName: p.name,
    entries: grouped.get(p.id) ?? [],
  }))
}

// ─── Change action ────────────────────────────────────────────────────────────

export async function submitPlayoffPoolChangeAction(input: {
  poolerId: string
  poolSeasonId: number
  season: string
  removeEntryId: number | null
  removePlayerId: number | null
  removeNhlId: number | null
  addPlayerId: number | null
  addNhlId: number | null
  addPositionSlot: 'F' | 'D' | 'G' | null
  isEliminationReplacement: boolean
}): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  const { data: poolerSelf } = await supabase.from('poolers').select('is_admin').eq('id', user.id).single()
  const isAdmin = poolerSelf?.is_admin ?? false
  if (!isAdmin && user.id !== input.poolerId) return { error: 'Non autorisé' }

  const db = createAdminClient()

  // Fetch season config
  const { data: saisonRow } = await db
    .from('pool_seasons')
    .select('playoff_submission_deadline, playoff_max_changes, playoff_max_elim_changes')
    .eq('id', input.poolSeasonId)
    .single()
  if (!saisonRow) return { error: 'Saison introuvable' }

  const deadline = saisonRow.playoff_submission_deadline ? new Date(saisonRow.playoff_submission_deadline) : null
  const isLocked = deadline ? new Date() > deadline : false

  // Validate change budget after deadline (non-admin)
  if (isLocked && !isAdmin) {
    const { data: history } = await db
      .from('playoff_pool_rosters')
      .select('removal_reason')
      .eq('pooler_id', input.poolerId)
      .eq('pool_season_id', input.poolSeasonId)
      .not('removed_at', 'is', null)
    const used = history ?? []
    const voluntaryUsed = used.filter((r: any) => r.removal_reason === 'voluntary').length
    const elimUsed = used.filter((r: any) => r.removal_reason === 'elimination').length

    if (input.isEliminationReplacement) {
      if (elimUsed >= (saisonRow.playoff_max_elim_changes ?? 5)) {
        return { error: `Limite de ${saisonRow.playoff_max_elim_changes} changements d'élimination atteinte.` }
      }
      // Verify the removed player is actually on an eliminated team (same dual logic as client)
      if (input.removePlayerId) {
        const { data: pTeam } = await db.from('players').select('teams(id)').eq('id', input.removePlayerId).single()
        const tid = (pTeam?.teams as any)?.id
        if (tid) {
          const [{ data: elimRow }, { data: participating }] = await Promise.all([
            db.from('playoff_eliminations').select('id').eq('pool_season_id', input.poolSeasonId).eq('team_id', tid).maybeSingle(),
            db.from('playoff_participating_teams').select('team_id').eq('pool_season_id', input.poolSeasonId),
          ])
          const participatingIds = new Set((participating ?? []).map((e: any) => e.team_id))
          const isEliminated = !!elimRow || (participatingIds.size > 0 && !participatingIds.has(tid))
          if (!isEliminated) return { error: "Ce joueur n'est pas sur une équipe éliminée." }
        }
      }
    } else {
      if (voluntaryUsed >= (saisonRow.playoff_max_changes ?? 5)) {
        return { error: `Limite de ${saisonRow.playoff_max_changes} changements volontaires atteinte.` }
      }
    }
  }

  const { fetchPlayerStatsById, EMPTY_STATS } = await import('@/lib/nhl-snapshot')
  const now = new Date().toISOString()

  // Remove player
  if (input.removeEntryId) {
    // Avant la deadline, les changements sont libres et ne comptent pas dans le budget —
    // removal_reason reste null pour qu'ils soient ignorés par getPlayoffChangeCountsAction.
    const reason = !isLocked ? null : input.isEliminationReplacement ? 'elimination' : 'voluntary'
    const { error } = await db
      .from('playoff_pool_rosters')
      .update({ is_active: false, removed_at: now, removal_reason: reason })
      .eq('id', input.removeEntryId)
    if (error) return { error: error.message }

    // Deactivation snapshot
    if (input.removeNhlId) {
      const stats = (await fetchPlayerStatsById(input.removeNhlId, 3)) ?? EMPTY_STATS
      await db.from('player_stat_snapshots').insert({
        player_id: input.removePlayerId,
        pooler_id: input.poolerId,
        pool_season_id: input.poolSeasonId,
        snapshot_type: 'deactivation',
        taken_at: now,
        ...stats,
      })
    }
  }

  // Add player
  if (input.addPlayerId && input.addPositionSlot) {
    const existing = await db.from('playoff_pool_rosters')
      .select('id, is_active')
      .eq('pooler_id', input.poolerId)
      .eq('player_id', input.addPlayerId)
      .eq('pool_season_id', input.poolSeasonId)
      .maybeSingle()

    if (existing.data) {
      const { error } = await db.from('playoff_pool_rosters')
        .update({ is_active: true, added_at: now, removed_at: null, removal_reason: null, position_slot: input.addPositionSlot })
        .eq('id', existing.data.id)
      if (error) return { error: error.message }
    } else {
      const { error } = await db.from('playoff_pool_rosters').insert({
        pooler_id: input.poolerId,
        player_id: input.addPlayerId,
        pool_season_id: input.poolSeasonId,
        position_slot: input.addPositionSlot,
        is_active: true,
        added_at: now,
      })
      if (error) return { error: error.message }
    }

    // Activation snapshot
    if (input.addNhlId) {
      const stats = (await fetchPlayerStatsById(input.addNhlId, 3)) ?? EMPTY_STATS
      await db.from('player_stat_snapshots').insert({
        player_id: input.addPlayerId,
        pooler_id: input.poolerId,
        pool_season_id: input.poolSeasonId,
        snapshot_type: 'activation',
        taken_at: now,
        ...stats,
      })
    }
  }

  // Notifier l'admin seulement après la deadline (changements avec budget)
  // Avant la deadline : la confirmation d'alignement envoie la notification
  if (!isAdmin && isLocked) {
    const { data: poolerRow } = await db.from('poolers').select('name').eq('id', input.poolerId).single()
    const { sendPushToAdmins } = await import('@/lib/push')
    sendPushToAdmins({
      title: 'Pool des séries — Changement d\'alignement',
      body: `${poolerRow?.name ?? 'Un pooler'} a modifié ses choix.`,
      url: '/admin/series',
    }, user.id).catch(() => {})
  }

  revalidatePath('/gestion-series')
  revalidatePath('/admin/series')
  revalidatePath('/classement-series')
  return {}
}

// ─── Batch change action ──────────────────────────────────────────────────────

export type SeriesBatchItem = {
  type: 'elimination' | 'voluntary' | 'add'
  removeEntryId: number | null
  removePlayerId: number | null
  removeNhlId: number | null
  addPlayerId: number
  addNhlId: number | null
  addPositionSlot: 'F' | 'D' | 'G'
}

export async function submitSeriesBatchAction(input: {
  poolerId: string
  poolSeasonId: number
  season: string
  items: SeriesBatchItem[]
}): Promise<{ error?: string }> {
  if (!input.items.length) return {}

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  const { data: poolerSelf } = await supabase.from('poolers').select('is_admin').eq('id', user.id).single()
  const isAdmin = poolerSelf?.is_admin ?? false
  if (!isAdmin && user.id !== input.poolerId) return { error: 'Non autorisé' }

  const db = createAdminClient()

  const { data: saisonRow } = await db
    .from('pool_seasons')
    .select('playoff_submission_deadline, playoff_max_changes, playoff_max_elim_changes, pool_cap')
    .eq('id', input.poolSeasonId)
    .single()
  if (!saisonRow) return { error: 'Saison introuvable' }

  const deadline = saisonRow.playoff_submission_deadline ? new Date(saisonRow.playoff_submission_deadline) : null
  const isLocked = deadline ? new Date() > deadline : false
  const poolCap: number = Number(saisonRow.pool_cap ?? 0)

  const elimItems = input.items.filter(i => i.type === 'elimination')
  const voluntaryItems = input.items.filter(i => i.type === 'voluntary')

  if (isLocked && !isAdmin) {
    const { data: history } = await db
      .from('playoff_pool_rosters')
      .select('removal_reason')
      .eq('pooler_id', input.poolerId)
      .eq('pool_season_id', input.poolSeasonId)
      .not('removed_at', 'is', null)
    const used = history ?? []
    const voluntaryUsed = used.filter((r: any) => r.removal_reason === 'voluntary').length
    const elimUsed = used.filter((r: any) => r.removal_reason === 'elimination').length
    const maxElim = saisonRow.playoff_max_elim_changes ?? 5
    const maxVoluntary = saisonRow.playoff_max_changes ?? 5

    if (elimUsed + elimItems.length > maxElim) {
      return { error: `Ce panier dépasserait la limite de ${maxElim} remplacements d'élimination (${elimUsed} déjà utilisés).` }
    }
    if (voluntaryUsed + voluntaryItems.length > maxVoluntary) {
      return { error: `Ce panier dépasserait la limite de ${maxVoluntary} changements volontaires (${voluntaryUsed} déjà utilisés).` }
    }

    // Verify eliminated players (dual logic: playoff_eliminations OR hors participating)
    if (elimItems.length > 0) {
      const [{ data: eliminations }, { data: participating }] = await Promise.all([
        db.from('playoff_eliminations').select('team_id').eq('pool_season_id', input.poolSeasonId),
        db.from('playoff_participating_teams').select('team_id').eq('pool_season_id', input.poolSeasonId),
      ])
      const elimTeamIds = new Set((eliminations ?? []).map((e: any) => e.team_id))
      const participatingIds = new Set((participating ?? []).map((e: any) => e.team_id))
      const isEliminated = (tid: number) =>
        elimTeamIds.has(tid) || (participatingIds.size > 0 && !participatingIds.has(tid))

      for (const item of elimItems) {
        if (!item.removePlayerId) continue
        const { data: pTeam } = await db.from('players').select('teams(id)').eq('id', item.removePlayerId).single()
        const tid = (pTeam?.teams as any)?.id
        if (tid && !isEliminated(tid)) {
          return { error: "Un joueur marqué 'élimination' n'est pas sur une équipe éliminée." }
        }
      }
    }
  }

  // Validate projected cap
  if (poolCap > 0) {
    const { data: currentRoster } = await db
      .from('playoff_pool_rosters')
      .select('player_id, players(player_contracts(season, cap_number))')
      .eq('pooler_id', input.poolerId)
      .eq('pool_season_id', input.poolSeasonId)
      .eq('is_active', true)

    const removePlayerIds = new Set(input.items.filter(i => i.removePlayerId).map(i => i.removePlayerId!))
    let projectedCap = 0
    for (const r of (currentRoster ?? []) as any[]) {
      if (removePlayerIds.has(r.player_id)) continue
      const c = (r.players?.player_contracts ?? []).find((c: any) => c.season === toNhlSeason(input.season))
      projectedCap += c?.cap_number ?? 0
    }
    for (const item of input.items) {
      const { data: p } = await db.from('players').select('player_contracts(season, cap_number)').eq('id', item.addPlayerId).single()
      const c = ((p as any)?.player_contracts ?? []).find((c: any) => c.season === toNhlSeason(input.season))
      projectedCap += c?.cap_number ?? 0
    }
    if (projectedCap > poolCap) {
      const fmt = (n: number) => new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
      return { error: `Ce panier dépasse la masse salariale (${fmt(projectedCap)} / ${fmt(poolCap)}).` }
    }
  }

  const { fetchPlayerStatsById, EMPTY_STATS } = await import('@/lib/nhl-snapshot')
  const now = new Date().toISOString()

  for (const item of input.items) {
    if (item.removeEntryId) {
      const reason = !isLocked ? null : item.type === 'elimination' ? 'elimination' : 'voluntary'
      const { error } = await db
        .from('playoff_pool_rosters')
        .update({ is_active: false, removed_at: now, removal_reason: reason })
        .eq('id', item.removeEntryId)
      if (error) return { error: error.message }

      if (item.removeNhlId && item.removePlayerId) {
        const stats = (await fetchPlayerStatsById(item.removeNhlId, 3)) ?? EMPTY_STATS
        await db.from('player_stat_snapshots').insert({
          player_id: item.removePlayerId, pooler_id: input.poolerId,
          pool_season_id: input.poolSeasonId, snapshot_type: 'deactivation', taken_at: now, ...stats,
        })
      }
    }

    const existing = await db.from('playoff_pool_rosters')
      .select('id')
      .eq('pooler_id', input.poolerId)
      .eq('player_id', item.addPlayerId)
      .eq('pool_season_id', input.poolSeasonId)
      .maybeSingle()

    if (existing.data) {
      const { error } = await db.from('playoff_pool_rosters')
        .update({ is_active: true, added_at: now, removed_at: null, removal_reason: null, position_slot: item.addPositionSlot })
        .eq('id', existing.data.id)
      if (error) return { error: error.message }
    } else {
      const { error } = await db.from('playoff_pool_rosters').insert({
        pooler_id: input.poolerId, player_id: item.addPlayerId,
        pool_season_id: input.poolSeasonId, position_slot: item.addPositionSlot,
        is_active: true, added_at: now,
      })
      if (error) return { error: error.message }
    }

    if (item.addNhlId && item.addPlayerId) {
      const stats = (await fetchPlayerStatsById(item.addNhlId, 3)) ?? EMPTY_STATS
      await db.from('player_stat_snapshots').insert({
        player_id: item.addPlayerId, pooler_id: input.poolerId,
        pool_season_id: input.poolSeasonId, snapshot_type: 'activation', taken_at: now, ...stats,
      })
    }
  }

  if (!isAdmin && isLocked) {
    const { data: poolerRow } = await db.from('poolers').select('name').eq('id', input.poolerId).single()
    const { sendPushToAdmins } = await import('@/lib/push')
    const n = input.items.length
    sendPushToAdmins({
      title: 'Pool des séries — Changement d\'alignement',
      body: n === 1
        ? `${poolerRow?.name ?? 'Un pooler'} a modifié son alignement.`
        : `${poolerRow?.name ?? 'Un pooler'} a soumis ${n} changements.`,
      url: '/admin/series',
    }, user.id).catch(() => {})
  }

  revalidatePath('/gestion-series')
  revalidatePath('/admin/series')
  revalidatePath('/classement-series')
  return {}
}

// ─── Confirm alignment ────────────────────────────────────────────────────────

export async function confirmPlayoffAlignmentAction(
  poolerId: string,
  poolerName: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.id !== poolerId) return { error: 'Non autorisé' }
  const { sendPushToAdmins } = await import('@/lib/push')
  sendPushToAdmins({
    title: 'Pool des séries — Alignement confirmé',
    body: `${poolerName} a confirmé son alignement.`,
    url: '/admin/series',
  }, user.id).catch(() => {})
  return {}
}

// ─── Standings ────────────────────────────────────────────────────────────────

export async function getPlayoffPoolStandingsAction(
  poolSeasonId: number,
  fetchLive = false,
): Promise<PlayoffPoolStanding[]> {
  const supabase = await createClient()

  const [{ data: snapshots }, { data: rosters }, { data: scoringRows }, { data: poolers }, { data: saisonRow }] = await Promise.all([
    supabase
      .from('player_stat_snapshots')
      .select('pooler_id, player_id, snapshot_type, goals, assists, goalie_wins, goalie_otl, goalie_shutouts')
      .eq('pool_season_id', poolSeasonId),
    supabase
      .from('playoff_pool_rosters')
      .select('pooler_id, player_id, position_slot, is_active, removal_reason, players(first_name, last_name, nhl_id, teams(code))')
      .eq('pool_season_id', poolSeasonId),
    supabase.from('scoring_config').select('stat_key, points, points_playoffs'),
    supabase.from('poolers').select('id, name').order('name'),
    supabase.from('pool_seasons').select('playoff_max_f, playoff_max_d, playoff_max_g, playoff_submission_deadline').eq('id', poolSeasonId).single(),
  ])

  const maxF = saisonRow?.playoff_max_f ?? 5
  const maxD = saisonRow?.playoff_max_d ?? 3
  const maxG = saisonRow?.playoff_max_g ?? 1

  const cfg: Record<string, number> = {}
  for (const row of scoringRows ?? []) {
    cfg[row.stat_key] = row.points_playoffs != null ? row.points_playoffs : row.points
  }

  // Group snapshots: poolerId → playerId → type → stats
  type SnapMap = Map<string, Map<number, { activation?: any; deactivation?: any; deadline_baseline?: any; live_cache?: any }>>
  const snapMap: SnapMap = new Map()
  for (const s of snapshots ?? []) {
    if (!snapMap.has(s.pooler_id)) snapMap.set(s.pooler_id, new Map())
    const pm = snapMap.get(s.pooler_id)!
    if (!pm.has(s.player_id)) pm.set(s.player_id, {})
    pm.get(s.player_id)![s.snapshot_type as 'activation' | 'deactivation' | 'deadline_baseline' | 'live_cache'] = s
  }

  // Auto-création de la baseline deadline si la deadline est passée et aucune baseline n'existe
  const deadlinePassed = saisonRow?.playoff_submission_deadline
    ? new Date() > new Date(saisonRow.playoff_submission_deadline)
    : false
  const hasBaselines = (snapshots ?? []).some((s: any) => s.snapshot_type === 'deadline_baseline')

  if (deadlinePassed && !hasBaselines) {
    const db = createAdminClient()
    const { fetchPlayerStatsAsOfDate } = await import('@/lib/nhl-snapshot')
    const deadline = new Date(saisonRow!.playoff_submission_deadline)
    const statsCache = new Map<number, any>()
    const activeRosters = (rosters ?? []).filter((r: any) => r.is_active)
    const newBaselines: any[] = []

    for (const r of activeRosters) {
      const nhlId = (r.players as any)?.nhl_id
      if (!nhlId) continue
      if (!statsCache.has(nhlId)) {
        statsCache.set(nhlId, await fetchPlayerStatsAsOfDate(nhlId, 3, deadline))
      }
      newBaselines.push({
        player_id: r.player_id,
        pooler_id: r.pooler_id,
        pool_season_id: poolSeasonId,
        snapshot_type: 'deadline_baseline',
        taken_at: deadline.toISOString(),
        ...statsCache.get(nhlId),
      })
    }

    if (newBaselines.length > 0) {
      await db.from('player_stat_snapshots').upsert(newBaselines, {
        onConflict: 'pooler_id,player_id,pool_season_id,snapshot_type',
      })
      // Injecter dans le snapMap pour que ce calcul utilise déjà les bonnes baselines
      for (const b of newBaselines) {
        if (!snapMap.has(b.pooler_id)) snapMap.set(b.pooler_id, new Map())
        const pm = snapMap.get(b.pooler_id)!
        if (!pm.has(b.player_id)) pm.set(b.player_id, {})
        pm.get(b.player_id)!.deadline_baseline = b
      }
    }
  }

  // Fetch live NHL playoff stats for currently active players (one call per unique player)
  const liveMap = new Map<number, any>() // playerId → SnapshotStats
  if (fetchLive) {
    const uniqueActive = new Map<number, number>() // playerId → nhlId
    for (const r of rosters ?? []) {
      if (!r.is_active || uniqueActive.has(r.player_id)) continue
      const nhlId = (r.players as any)?.nhl_id
      if (nhlId) uniqueActive.set(r.player_id, nhlId)
    }
    const { fetchPlayerStatsById } = await import('@/lib/nhl-snapshot')
    await Promise.all(
      [...uniqueActive.entries()].map(([playerId, nhlId]) =>
        fetchPlayerStatsById(nhlId, 3).then(stats => {
          // null = échec API — ne pas ajouter à liveMap pour éviter un delta négatif
          if (stats !== null) liveMap.set(playerId, stats)
        })
      )
    )
  }

  // Group rosters by pooler (all entries, active and inactive)
  const rosterMap = new Map<string, any[]>()
  for (const r of rosters ?? []) {
    if (!rosterMap.has(r.pooler_id)) rosterMap.set(r.pooler_id, [])
    rosterMap.get(r.pooler_id)!.push(r)
  }

  const poolerNames = new Map((poolers ?? []).map(p => [p.id, p.name]))
  const standings: PlayoffPoolStanding[] = []

  for (const [poolerId, rosterEntries] of rosterMap.entries()) {
    // Ne compter que les alignements complets
    const activeEntries = rosterEntries.filter((r: any) => r.is_active)
    const countF = activeEntries.filter((r: any) => r.position_slot === 'F').length
    const countD = activeEntries.filter((r: any) => r.position_slot === 'D').length
    const countG = activeEntries.filter((r: any) => r.position_slot === 'G').length
    if (countF < maxF || countD < maxD || countG < maxG) continue
    const pm = snapMap.get(poolerId) ?? new Map()
    const players: PlayoffPoolStanding['players'] = []
    let total = 0

    // Unique players (a player may have multiple entries if added/removed/re-added)
    // Active entries first, then post-deadline removals, then pre-deadline removals
    const sortedEntries = [...rosterEntries].sort((a: any, b: any) => {
      if (a.is_active !== b.is_active) return a.is_active ? -1 : 1
      if (!!a.removal_reason !== !!b.removal_reason) return a.removal_reason ? -1 : 1
      return 0
    })
    const seen = new Set<number>()
    for (const r of sortedEntries) {
      if (seen.has(r.player_id)) continue
      seen.add(r.player_id)
      // Retrait avant deadline : removal_reason = null → ne pas afficher
      if (!r.is_active && !r.removal_reason) continue

      const snaps = pm.get(r.player_id) ?? {}
      // deadline_baseline prioritaire sur activation (joueurs ajoutés avant deadline)
      // activation seul pour les joueurs ajoutés après deadline (pas de baseline pour eux)
      const reference = snaps.deadline_baseline ?? snaps.activation
      const deactivation = snaps.deactivation
      if (!reference) continue // Jamais eu de snapshot — ignorer

      // Priorité pour les stats courantes :
      // 1. live_cache (snapshot mis à jour par le pipeline GitHub Action)
      // 2. liveMap (appel NHL direct si fetchLive=true et pas de live_cache)
      // 3. deactivation snapshot (joueur retiré)
      // 4. reference (fallback → 0 pts depuis baseline)
      const liveCache = snaps.live_cache
      const end = r.is_active
        ? (liveCache ?? (liveMap.has(r.player_id) ? liveMap.get(r.player_id) : null) ?? deactivation ?? reference)
        : (deactivation ?? reference)
      const isActive = r.is_active

      const delta = {
        goals:          (end.goals ?? 0)          - (reference.goals ?? 0),
        assists:        (end.assists ?? 0)         - (reference.assists ?? 0),
        goalie_wins:    (end.goalie_wins ?? 0)     - (reference.goalie_wins ?? 0),
        goalie_otl:     (end.goalie_otl ?? 0)      - (reference.goalie_otl ?? 0),
        goalie_shutouts:(end.goalie_shutouts ?? 0) - (reference.goalie_shutouts ?? 0),
      }

      const pts =
        delta.goals           * (cfg['goal']          ?? 1) +
        delta.assists         * (cfg['assist']         ?? 1) +
        delta.goalie_wins     * (cfg['goalie_win']     ?? 2) +
        delta.goalie_otl      * (cfg['goalie_otl']     ?? 1) +
        delta.goalie_shutouts * (cfg['goalie_shutout'] ?? 0)

      players.push({
        playerId:       r.player_id,
        nhlId:          (r.players as any)?.nhl_id ?? null,
        firstName:      (r.players as any)?.first_name ?? '',
        lastName:       (r.players as any)?.last_name ?? '',
        teamCode:       (r.players as any)?.teams?.code ?? null,
        positionSlot:   r.position_slot as 'F' | 'D' | 'G',
        goals:          delta.goals,
        assists:        delta.assists,
        goalieWins:     delta.goalie_wins,
        goalieOtl:      delta.goalie_otl,
        goalieShutouts: delta.goalie_shutouts,
        points:         pts,
        isActive,
      })
      total += pts
    }

    standings.push({
      poolerId,
      poolerName: poolerNames.get(poolerId) ?? poolerId,
      totalPoints: total,
      players: players.sort((a, b) =>
        b.points - a.points || (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0)
      ),
    })
  }

  const sorted = standings.sort((a, b) => b.totalPoints - a.totalPoints)

  // Mise à jour du cache BD quand on a des stats live (évite les appels NHL à chaque page load)
  if (fetchLive && sorted.length > 0) {
    const db = createAdminClient()
    await db.from('playoff_pool_standings_cache').upsert(
      sorted.map(s => ({
        pool_season_id: poolSeasonId,
        pooler_id:      s.poolerId,
        total_pts:      s.totalPoints,
        updated_at:     new Date().toISOString(),
      })),
      { onConflict: 'pool_season_id,pooler_id' },
    )
  }

  return sorted
}

/**
 * Lit le classement du pool des séries depuis le cache BD.
 * Rapide (pas d'appel NHL) — mis à jour à chaque visite de /classement-series.
 */
export async function getPlayoffStandingsCached(
  poolSeasonId: number,
): Promise<{ poolerId: string; poolerName: string; totalPoints: number }[]> {
  const supabase = await createClient()
  const [{ data: cache }, { data: poolers }] = await Promise.all([
    supabase
      .from('playoff_pool_standings_cache')
      .select('pooler_id, total_pts')
      .eq('pool_season_id', poolSeasonId)
      .order('total_pts', { ascending: false }),
    supabase.from('poolers').select('id, name'),
  ])
  if (!cache || cache.length === 0) return []
  const nameMap = new Map((poolers ?? []).map(p => [p.id, p.name]))
  return cache.map(row => ({
    poolerId:    row.pooler_id,
    poolerName:  nameMap.get(row.pooler_id) ?? row.pooler_id,
    totalPoints: row.total_pts,
  }))
}
