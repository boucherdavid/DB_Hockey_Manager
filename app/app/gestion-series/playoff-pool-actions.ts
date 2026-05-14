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

  const { fetchPlayerStatsSafe } = await import('@/lib/nhl-snapshot')
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

    // Deactivation snapshot — stats courantes du joueur sortant
    if (input.removeNhlId) {
      const stats = await fetchPlayerStatsSafe(input.removeNhlId, 3)
      await db.from('player_stat_snapshots').upsert({
        player_id: input.removePlayerId,
        pooler_id: input.poolerId,
        pool_season_id: input.poolSeasonId,
        snapshot_type: 'deactivation',
        taken_at: now,
        ...stats,
      }, { onConflict: 'pooler_id,player_id,pool_season_id,snapshot_type' })
    }
  }

  // Add player
  if (input.addPlayerId && input.addPositionSlot) {
    const { data: existingRows } = await db.from('playoff_pool_rosters')
      .select('id')
      .eq('pooler_id', input.poolerId)
      .eq('player_id', input.addPlayerId)
      .eq('pool_season_id', input.poolSeasonId)
      .order('added_at', { ascending: false })
      .limit(1)
    const existingRow = existingRows?.[0] ?? null

    if (existingRow) {
      const { error } = await db.from('playoff_pool_rosters')
        .update({ is_active: true, added_at: now, removed_at: null, removal_reason: null, position_slot: input.addPositionSlot })
        .eq('id', existingRow.id)
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

    // Activation snapshot — game-log jusqu'à minuit demain → matchs du jour inclus dans la baseline
    // upsert pour gérer les réactivations d'un joueur déjà présent cette saison
    if (input.addNhlId) {
      const stats = await fetchPlayerStatsSafe(input.addNhlId, 3)
      await db.from('player_stat_snapshots').upsert({
        player_id: input.addPlayerId,
        pooler_id: input.poolerId,
        pool_season_id: input.poolSeasonId,
        snapshot_type: 'activation',
        taken_at: now,
        ...stats,
      }, { onConflict: 'pooler_id,player_id,pool_season_id,snapshot_type' })
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

// ─── Batch change action (retraits + ajouts découplés) ───────────────────────

export type SeriesBatchRemoval = {
  entryId: number
  playerId: number
  nhlId: number | null
  removalType: 'elimination' | 'voluntary' | 'free' // 'free' = avant deadline
}

export type SeriesBatchAddition = {
  playerId: number
  nhlId: number | null
  positionSlot: 'F' | 'D' | 'G'
}

export async function submitSeriesBatchAction(input: {
  poolerId: string
  poolSeasonId: number
  season: string
  removals: SeriesBatchRemoval[]
  additions: SeriesBatchAddition[]
}): Promise<{ error?: string }> {
  if (!input.removals.length && !input.additions.length) return {}

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

  const elimRemovals = input.removals.filter(r => r.removalType === 'elimination')
  const voluntaryRemovals = input.removals.filter(r => r.removalType === 'voluntary')

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

    if (elimUsed + elimRemovals.length > maxElim) {
      return { error: `Ce panier dépasserait la limite de ${maxElim} remplacements d'élimination (${elimUsed} déjà utilisés).` }
    }
    if (voluntaryUsed + voluntaryRemovals.length > maxVoluntary) {
      return { error: `Ce panier dépasserait la limite de ${maxVoluntary} changements volontaires (${voluntaryUsed} déjà utilisés).` }
    }

    // Vérifier que les retraits 'élimination' sont bien sur des équipes éliminées
    if (elimRemovals.length > 0) {
      const [{ data: eliminations }, { data: participating }] = await Promise.all([
        db.from('playoff_eliminations').select('team_id').eq('pool_season_id', input.poolSeasonId),
        db.from('playoff_participating_teams').select('team_id').eq('pool_season_id', input.poolSeasonId),
      ])
      const elimTeamIds = new Set((eliminations ?? []).map((e: any) => e.team_id))
      const participatingIds = new Set((participating ?? []).map((e: any) => e.team_id))
      const isEliminated = (tid: number) =>
        elimTeamIds.has(tid) || (participatingIds.size > 0 && !participatingIds.has(tid))

      for (const r of elimRemovals) {
        const { data: pTeam } = await db.from('players').select('teams(id)').eq('id', r.playerId).single()
        const tid = (pTeam?.teams as any)?.id
        if (tid && !isEliminated(tid)) {
          return { error: "Un joueur marqué 'élimination' n'est pas sur une équipe éliminée." }
        }
      }
    }
  }

  // Validation cap globale sur l'ensemble retraits + ajouts
  if (poolCap > 0) {
    const { data: currentRoster } = await db
      .from('playoff_pool_rosters')
      .select('player_id, players(player_contracts(season, cap_number))')
      .eq('pooler_id', input.poolerId)
      .eq('pool_season_id', input.poolSeasonId)
      .eq('is_active', true)

    const removePlayerIds = new Set(input.removals.map(r => r.playerId))
    let projectedCap = 0
    for (const r of (currentRoster ?? []) as any[]) {
      if (removePlayerIds.has(r.player_id)) continue
      const c = (r.players?.player_contracts ?? []).find((c: any) => c.season === toNhlSeason(input.season))
      projectedCap += c?.cap_number ?? 0
    }
    for (const a of input.additions) {
      const { data: p } = await db.from('players').select('player_contracts(season, cap_number)').eq('id', a.playerId).single()
      const c = ((p as any)?.player_contracts ?? []).find((c: any) => c.season === toNhlSeason(input.season))
      projectedCap += c?.cap_number ?? 0
    }
    if (projectedCap > poolCap) {
      const fmt = (n: number) => new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
      return { error: `Ce panier dépasse la masse salariale (${fmt(projectedCap)} / ${fmt(poolCap)}).` }
    }
  }

  const { fetchPlayerStatsSafe } = await import('@/lib/nhl-snapshot')
  const now = new Date().toISOString()

  // Appliquer les retraits
  for (const r of input.removals) {
    // Enforcement côté serveur : si la deadline est passée, le reason ne peut pas être null
    // (protège contre un client qui enverrait 'free' si saison.submissionDeadline n'était pas chargée)
    const reason = !isLocked ? null : r.removalType === 'elimination' ? 'elimination' : 'voluntary'
    const { error } = await db
      .from('playoff_pool_rosters')
      .update({ is_active: false, removed_at: now, removal_reason: reason })
      .eq('id', r.entryId)
    if (error) return { error: error.message }

    if (r.nhlId) {
      const stats = await fetchPlayerStatsSafe(r.nhlId, 3)
      await db.from('player_stat_snapshots').upsert({
        player_id: r.playerId, pooler_id: input.poolerId,
        pool_season_id: input.poolSeasonId, snapshot_type: 'deactivation', taken_at: now, ...stats,
      }, { onConflict: 'pooler_id,player_id,pool_season_id,snapshot_type' })
    }
  }

  // Appliquer les ajouts
  for (const a of input.additions) {
    // .limit(1) évite PGRST116 si plusieurs lignes historiques existent pour ce joueur
    const { data: existingRows } = await db.from('playoff_pool_rosters')
      .select('id')
      .eq('pooler_id', input.poolerId)
      .eq('player_id', a.playerId)
      .eq('pool_season_id', input.poolSeasonId)
      .order('added_at', { ascending: false })
      .limit(1)
    const existingRow = existingRows?.[0] ?? null

    if (existingRow) {
      const { error } = await db.from('playoff_pool_rosters')
        .update({ is_active: true, added_at: now, removed_at: null, removal_reason: null, position_slot: a.positionSlot })
        .eq('id', existingRow.id)
      if (error) return { error: error.message }
    } else {
      const { error } = await db.from('playoff_pool_rosters').insert({
        pooler_id: input.poolerId, player_id: a.playerId,
        pool_season_id: input.poolSeasonId, position_slot: a.positionSlot,
        is_active: true, added_at: now,
      })
      if (error) return { error: error.message }
    }

    // Activation snapshot — effectif demain (game-log jusqu'à minuit demain)
    // upsert pour gérer les réactivations d'un joueur déjà présent cette saison
    if (a.nhlId) {
      const stats = await fetchPlayerStatsSafe(a.nhlId, 3)
      await db.from('player_stat_snapshots').upsert({
        player_id: a.playerId, pooler_id: input.poolerId,
        pool_season_id: input.poolSeasonId, snapshot_type: 'activation', taken_at: now, ...stats,
      }, { onConflict: 'pooler_id,player_id,pool_season_id,snapshot_type' })
    }
  }

  if (!isAdmin && isLocked) {
    const { data: poolerRow } = await db.from('poolers').select('name').eq('id', input.poolerId).single()
    const { sendPushToAdmins } = await import('@/lib/push')
    const n = input.removals.length + input.additions.length
    sendPushToAdmins({
      title: 'Pool des séries — Changement d\'alignement',
      body: n <= 2
        ? `${poolerRow?.name ?? 'Un pooler'} a modifié son alignement.`
        : `${poolerRow?.name ?? 'Un pooler'} a soumis ${Math.max(input.removals.length, input.additions.length)} changements.`,
      url: '/admin/series',
    }, user.id).catch(() => {})
  }

  revalidatePath('/gestion-series')
  revalidatePath('/admin/series')
  revalidatePath('/classement-series')
  return {}
}

// ─── Admin : recalcul snapshots post-deadline ─────────────────────────────────
// Corrige les snapshots d'activation pour les joueurs ajoutés après la deadline
// dont le snapshot était à zéro (ex: bug fetchPlayerStatsById gardiens).

export async function recalcPostDeadlineSnapshotsAction(
  poolSeasonId: number,
): Promise<{ fixed: number; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { fixed: 0, error: 'Non authentifié' }
  const { data: poolerSelf } = await supabase.from('poolers').select('is_admin').eq('id', user.id).single()
  if (!poolerSelf?.is_admin) return { fixed: 0, error: 'Non autorisé' }

  const db = createAdminClient()
  const { data: saisonRow } = await db
    .from('pool_seasons')
    .select('playoff_submission_deadline, season')
    .eq('id', poolSeasonId)
    .single()
  if (!saisonRow?.playoff_submission_deadline) return { fixed: 0, error: 'Deadline introuvable' }

  const deadline = new Date(saisonRow.playoff_submission_deadline)

  // Entrées actives ou retirées ajoutées APRÈS la deadline
  const { data: postDeadlineEntries } = await db
    .from('playoff_pool_rosters')
    .select('id, player_id, pooler_id, added_at, players(nhl_id)')
    .eq('pool_season_id', poolSeasonId)
    .gt('added_at', deadline.toISOString())

  if (!postDeadlineEntries?.length) return { fixed: 0 }

  const { fetchPlayerStatsAsOfDate } = await import('@/lib/nhl-snapshot')

  // Pour chaque entrée post-deadline : recalculer le snapshot d'activation
  // via fetchPlayerStatsAsOfDate(addedAt) — stats strictement avant la date d'ajout.
  // Plus correct que fetchPlayerStatsById (stats actuelles) pour un recalcul rétroactif :
  // le joueur peut avoir accumulé des stats après son retrait du pool.
  let fixed = 0
  for (const entry of postDeadlineEntries) {
    const nhlId = (entry.players as any)?.nhl_id
    if (!nhlId) continue

    const stats = await fetchPlayerStatsAsOfDate(nhlId, 3, new Date(entry.added_at))

    const { error } = await db.from('player_stat_snapshots').upsert({
      player_id: entry.player_id,
      pooler_id: entry.pooler_id,
      pool_season_id: poolSeasonId,
      snapshot_type: 'activation',
      taken_at: entry.added_at,
      ...stats,
    }, { onConflict: 'pooler_id,player_id,pool_season_id,snapshot_type' })

    if (!error) fixed++
  }

  revalidatePath('/classement-series')
  revalidatePath('/admin/series')
  return { fixed }
}

// ─── Admin : recalcul des snapshots de désactivation ─────────────────────────
// Recalcule les deactivation snapshots pour tous les retraits post-deadline.
// Corrige les snapshots à zéro causés par un échec de fetchPlayerStatsById au
// moment du retrait (ex: API NHL indisponible lors d'un batch de changements).

export async function recalcDeactivationSnapshotsAction(
  poolSeasonId: number,
): Promise<{ fixed: number; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { fixed: 0, error: 'Non authentifié' }
  const { data: poolerSelf } = await supabase.from('poolers').select('is_admin').eq('id', user.id).single()
  if (!poolerSelf?.is_admin) return { fixed: 0, error: 'Non autorisé' }

  const db = createAdminClient()
  const { data: saisonRow } = await db
    .from('pool_seasons')
    .select('playoff_submission_deadline')
    .eq('id', poolSeasonId)
    .single()
  if (!saisonRow?.playoff_submission_deadline) return { fixed: 0, error: 'Deadline introuvable' }

  const deadline = new Date(saisonRow.playoff_submission_deadline)

  // Tous les retraits post-deadline (voluntary + elimination) avec leur date de retrait.
  // Utilise .or() car .in() sur removal_reason est peu fiable avec certaines versions Supabase.
  const { data: postDeadlineRemovals, error: removalErr } = await db
    .from('playoff_pool_rosters')
    .select('player_id, pooler_id, removed_at, players(nhl_id)')
    .eq('pool_season_id', poolSeasonId)
    .or('removal_reason.eq.voluntary,removal_reason.eq.elimination')
    .not('removed_at', 'is', null)
    .gt('removed_at', deadline.toISOString())

  if (removalErr) return { fixed: 0, error: removalErr.message }
  if (!postDeadlineRemovals?.length) return { fixed: 0 }

  const { fetchPlayerStatsAsOfDate, fetchPlayerStatsSafe } = await import('@/lib/nhl-snapshot')
  let fixed = 0

  for (const entry of postDeadlineRemovals as any[]) {
    const nhlId = entry.players?.nhl_id
    if (!nhlId || !entry.removed_at) continue

    // Stats au moment du retrait (avant la journée du retrait).
    // Si le game-log retourne tout à zéro (échec API), on tente fetchPlayerStatsSafe
    // en fallback (donne les stats totales actuelles — correct pour équipes éliminées).
    let stats = await fetchPlayerStatsAsOfDate(nhlId, 3, new Date(entry.removed_at))
    const isAllZero = !stats.goals && !stats.assists && !stats.goalie_wins && !stats.goalie_otl && !stats.goalie_shutouts
    if (isAllZero) stats = await fetchPlayerStatsSafe(nhlId, 3)

    const { error } = await db.from('player_stat_snapshots').upsert({
      player_id: entry.player_id,
      pooler_id: entry.pooler_id,
      pool_season_id: poolSeasonId,
      snapshot_type: 'deactivation',
      taken_at: entry.removed_at,
      ...stats,
    }, { onConflict: 'pooler_id,player_id,pool_season_id,snapshot_type' })

    if (!error) fixed++
  }

  revalidatePath('/classement-series')
  revalidatePath('/admin/series')
  return { fixed }
}

// ─── Admin : recalcul des baselines deadline manquantes ───────────────────────
// Crée les deadline_baseline pour tous les joueurs (actifs ou retirés post-deadline)
// qui n'en ont pas encore. Corrige aussi les removal_reason = null pour des retraits
// survenus après la deadline (bug: client envoyait 'free' si deadline pas chargée).

export async function recalcMissingBaselinesAction(
  poolSeasonId: number,
): Promise<{ fixed: number; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { fixed: 0, error: 'Non authentifié' }
  const { data: poolerSelf } = await supabase.from('poolers').select('is_admin').eq('id', user.id).single()
  if (!poolerSelf?.is_admin) return { fixed: 0, error: 'Non autorisé' }

  const db = createAdminClient()
  const { data: saisonRow } = await db
    .from('pool_seasons')
    .select('playoff_submission_deadline')
    .eq('id', poolSeasonId)
    .single()
  if (!saisonRow?.playoff_submission_deadline) return { fixed: 0, error: 'Deadline introuvable' }

  const deadline = new Date(saisonRow.playoff_submission_deadline)

  // Corriger les retraits post-deadline dont removal_reason est null (bug client)
  const { data: wrongReasonEntries } = await db
    .from('playoff_pool_rosters')
    .select('id')
    .eq('pool_season_id', poolSeasonId)
    .is('removal_reason', null)
    .not('removed_at', 'is', null)
    .gt('removed_at', deadline.toISOString())
  for (const entry of wrongReasonEntries ?? []) {
    await db.from('playoff_pool_rosters')
      .update({ removal_reason: 'voluntary' })
      .eq('id', entry.id)
  }

  // Tous les joueurs actifs + retraits post-deadline (y compris ceux qu'on vient de corriger)
  const [{ data: allEntries }, { data: existingRows }] = await Promise.all([
    db.from('playoff_pool_rosters')
      .select('player_id, pooler_id, removal_reason, is_active, players(nhl_id)')
      .eq('pool_season_id', poolSeasonId)
      .or('is_active.eq.true,removal_reason.eq.voluntary,removal_reason.eq.elimination'),
    db.from('player_stat_snapshots')
      .select('pooler_id, player_id')
      .eq('pool_season_id', poolSeasonId)
      .eq('snapshot_type', 'deadline_baseline'),
  ])

  const existingSet = new Set(
    (existingRows ?? []).map((e: any) => `${e.pooler_id}:${e.player_id}`),
  )
  const needingBaseline = (allEntries ?? []).filter((e: any) =>
    !existingSet.has(`${e.pooler_id}:${e.player_id}`),
  )

  if (needingBaseline.length === 0) return { fixed: 0 }

  const { fetchPlayerStatsAsOfDate } = await import('@/lib/nhl-snapshot')
  const statsCache = new Map<number, any>()
  let fixed = 0

  for (const entry of needingBaseline as any[]) {
    const nhlId = entry.players?.nhl_id
    if (!nhlId) continue
    if (!statsCache.has(nhlId)) {
      statsCache.set(nhlId, await fetchPlayerStatsAsOfDate(nhlId, 3, deadline))
    }
    const { error } = await db.from('player_stat_snapshots').upsert({
      player_id: entry.player_id,
      pooler_id: entry.pooler_id,
      pool_season_id: poolSeasonId,
      snapshot_type: 'deadline_baseline',
      taken_at: deadline.toISOString(),
      ...statsCache.get(nhlId),
    }, { onConflict: 'pooler_id,player_id,pool_season_id,snapshot_type' })
    if (!error) fixed++
  }

  revalidatePath('/classement-series')
  revalidatePath('/admin/series')
  return { fixed }
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

// ─── Change log (admin) ───────────────────────────────────────────────────────

export type PlayoffChangeLogEntry = {
  poolerName: string
  action: 'ajout' | 'retrait'
  playerName: string
  teamCode: string | null
  positionSlot: 'F' | 'D' | 'G' | null
  removalReason: 'elimination' | 'voluntary' | null
  changedAt: string
}

export async function getPlayoffChangeLogAction(
  poolSeasonId: number,
  limit = 50,
): Promise<PlayoffChangeLogEntry[]> {
  const db = createAdminClient()

  const { data } = await db
    .from('playoff_pool_rosters')
    .select('pooler_id, player_id, position_slot, is_active, added_at, removed_at, removal_reason, poolers(name), players(first_name, last_name, teams(code))')
    .eq('pool_season_id', poolSeasonId)
    .not('removal_reason', 'is', null)  // seulement les changements post-deadline
    .order('removed_at', { ascending: false })
    .limit(limit)

  const log: PlayoffChangeLogEntry[] = []
  for (const r of (data ?? []) as any[]) {
    const playerName = `${r.players?.last_name ?? ''}, ${r.players?.first_name ?? ''}`
    const poolerName: string = r.poolers?.name ?? r.pooler_id
    const teamCode: string | null = r.players?.teams?.code ?? null

    // Retrait (joueur sorti)
    log.push({
      poolerName,
      action: 'retrait',
      playerName,
      teamCode,
      positionSlot: r.position_slot as 'F' | 'D' | 'G',
      removalReason: r.removal_reason,
      changedAt: r.removed_at,
    })
  }

  // Ajouts post-deadline : entrées dont added_at > deadline (pas de deadline_baseline)
  const { data: saisonRow } = await db
    .from('pool_seasons')
    .select('playoff_submission_deadline')
    .eq('id', poolSeasonId)
    .single()
  const deadline = saisonRow?.playoff_submission_deadline

  if (deadline) {
    const { data: additions } = await db
      .from('playoff_pool_rosters')
      .select('pooler_id, player_id, position_slot, added_at, poolers(name), players(first_name, last_name, teams(code))')
      .eq('pool_season_id', poolSeasonId)
      .gt('added_at', deadline)
      .order('added_at', { ascending: false })
      .limit(limit)

    for (const r of (additions ?? []) as any[]) {
      const playerName = `${r.players?.last_name ?? ''}, ${r.players?.first_name ?? ''}`
      log.push({
        poolerName: r.poolers?.name ?? r.pooler_id,
        action: 'ajout',
        playerName,
        teamCode: r.players?.teams?.code ?? null,
        positionSlot: r.position_slot as 'F' | 'D' | 'G',
        removalReason: null,
        changedAt: r.added_at,
      })
    }
  }

  return log.sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime()).slice(0, limit)
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
      .select('pooler_id, player_id, position_slot, is_active, removal_reason, added_at, players(first_name, last_name, nhl_id, teams(code))')
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

  const deadlinePassed = saisonRow?.playoff_submission_deadline
    ? new Date() > new Date(saisonRow.playoff_submission_deadline)
    : false
  const deadline = saisonRow?.playoff_submission_deadline
    ? new Date(saisonRow.playoff_submission_deadline)
    : null

  if (deadlinePassed && deadline) {
    const db = createAdminClient()

    // 1. Auto-création des baselines manquantes — uniquement pour les joueurs ajoutés
    // AVANT la deadline. Les ajouts post-deadline utilisent activation comme référence.
    const existingBaselines = new Set(
      (snapshots ?? [])
        .filter((s: any) => s.snapshot_type === 'deadline_baseline')
        .map((s: any) => `${s.pooler_id}:${s.player_id}`),
    )
    const needingBaseline = (rosters ?? []).filter((r: any) =>
      (r.is_active || r.removal_reason === 'voluntary' || r.removal_reason === 'elimination')
      && !existingBaselines.has(`${r.pooler_id}:${r.player_id}`)
      && (!r.added_at || new Date(r.added_at) <= deadline),
    )

    if (needingBaseline.length > 0) {
      const { fetchPlayerStatsAsOfDate } = await import('@/lib/nhl-snapshot')
      const statsCache = new Map<number, any>()
      const newBaselines: any[] = []

      for (const r of needingBaseline as any[]) {
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
        for (const b of newBaselines) {
          if (!snapMap.has(b.pooler_id)) snapMap.set(b.pooler_id, new Map())
          const pm = snapMap.get(b.pooler_id)!
          if (!pm.has(b.player_id)) pm.set(b.player_id, {})
          pm.get(b.player_id)!.deadline_baseline = b
        }
      }
    }

    // 2. Auto-correction des snapshots d'activation à zéro pour les ajouts post-deadline.
    // Symptôme : activation=0 + live_cache non-vide → bug API lors de l'ajout.
    // Correction : activation = live_cache (le joueur n'a pas encore contribué depuis son ajout).
    const brokenActivations: any[] = []
    for (const r of rosters ?? []) {
      if (!r.added_at || new Date(r.added_at) <= deadline) continue
      const pm = snapMap.get(r.pooler_id)
      const snaps = pm?.get(r.player_id)
      if (!snaps?.activation || !snaps?.live_cache) continue
      const actZero = !snaps.activation.goals && !snaps.activation.assists && !snaps.activation.goalie_wins && !snaps.activation.goalie_otl && !snaps.activation.goalie_shutouts
      const lcNonZero = !!(snaps.live_cache.goals || snaps.live_cache.assists || snaps.live_cache.goalie_wins || snaps.live_cache.goalie_otl || snaps.live_cache.goalie_shutouts)
      if (!actZero || !lcNonZero) continue
      snaps.activation = { ...snaps.activation, goals: snaps.live_cache.goals, assists: snaps.live_cache.assists, goalie_wins: snaps.live_cache.goalie_wins, goalie_otl: snaps.live_cache.goalie_otl, goalie_shutouts: snaps.live_cache.goalie_shutouts }
      brokenActivations.push({ player_id: r.player_id, pooler_id: r.pooler_id, pool_season_id: poolSeasonId, snapshot_type: 'activation', taken_at: r.added_at, goals: snaps.live_cache.goals, assists: snaps.live_cache.assists, goalie_wins: snaps.live_cache.goalie_wins, goalie_otl: snaps.live_cache.goalie_otl, goalie_shutouts: snaps.live_cache.goalie_shutouts })
    }
    if (brokenActivations.length > 0) {
      await db.from('player_stat_snapshots').upsert(brokenActivations, { onConflict: 'pooler_id,player_id,pool_season_id,snapshot_type' })
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
      // Ajouts post-deadline : activation seulement (pas de deadline_baseline — ils n'étaient pas là)
      // Ajouts pré-deadline : deadline_baseline en priorité, fallback activation
      const isPostDeadlineEntry = deadlinePassed && deadline && r.added_at && new Date(r.added_at) > deadline
      const reference = isPostDeadlineEntry
        ? snaps.activation
        : (snaps.deadline_baseline ?? snaps.activation)
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
