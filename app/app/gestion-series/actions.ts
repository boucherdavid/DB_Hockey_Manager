'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

// ─── Types ────────────────────────────────────────────────────────────────────

export type PlayoffSaison = {
  id: number
  season: string
  poolCap: number
  gestionEffectifsOuvert: boolean
}

export type PlayoffRound = {
  id: number
  poolSeasonId: number
  roundNumber: number
  submissionDeadline: string | null
  maxChanges: number
  isActive: boolean
  isFrozen: boolean
}

export type PlayoffRosterEntry = {
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

export type EliminatedTeam = {
  id: number
  teamId: number
  teamCode: string
  teamName: string
  eliminatedInRound: number
}

export type PlayoffPlayerResult = {
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

export type AllPoolersRosters = {
  poolerId: string
  poolerName: string
  entries: PlayoffRosterEntry[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toRound(data: any): PlayoffRound {
  const deadline = data.submission_deadline ? new Date(data.submission_deadline) : null
  return {
    id: data.id,
    poolSeasonId: data.pool_season_id,
    roundNumber: data.round_number,
    submissionDeadline: data.submission_deadline ?? null,
    maxChanges: data.max_changes ?? 2,
    isActive: data.is_active,
    isFrozen: deadline ? new Date() > deadline : false,
  }
}

// ─── Read actions ─────────────────────────────────────────────────────────────

export async function getActivePlayoffSaisonAction(): Promise<PlayoffSaison | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('pool_seasons')
    .select('id, season, pool_cap, gestion_effectifs_ouvert')
    .eq('is_active', true)
    .eq('is_playoff', true)
    .single()
  if (!data) return null
  return {
    id: data.id,
    season: data.season,
    poolCap: Number(data.pool_cap),
    gestionEffectifsOuvert: data.gestion_effectifs_ouvert ?? true,
  }
}

export async function getAllRoundsAction(poolSeasonId: number): Promise<PlayoffRound[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('playoff_rounds')
    .select('*')
    .eq('pool_season_id', poolSeasonId)
    .order('round_number')
  return (data ?? []).map(toRound)
}

export async function getActiveRoundAction(poolSeasonId: number): Promise<PlayoffRound | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('playoff_rounds')
    .select('*')
    .eq('pool_season_id', poolSeasonId)
    .eq('is_active', true)
    .single()
  if (!data) return null
  return toRound(data)
}

export async function getEliminatedTeamsAction(poolSeasonId: number): Promise<EliminatedTeam[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('playoff_eliminations')
    .select('id, team_id, eliminated_in_round, teams (code, name)')
    .eq('pool_season_id', poolSeasonId)
    .order('eliminated_in_round')
  return (data ?? []).map((e: any) => ({
    id: e.id,
    teamId: e.team_id,
    teamCode: e.teams?.code ?? '',
    teamName: e.teams?.name ?? '',
    eliminatedInRound: e.eliminated_in_round,
  }))
}

export async function getPoolerPlayoffRosterAction(
  poolerId: string,
  roundId: number,
  poolSeasonId: number,
  season: string,
): Promise<PlayoffRosterEntry[]> {
  const supabase = await createClient()
  const [{ data: entries }, { data: elims }] = await Promise.all([
    supabase
      .from('playoff_rosters')
      .select(`
        id, player_id, position_slot, added_at,
        players (
          first_name, last_name, position, nhl_id,
          teams (id, code),
          player_contracts (season, cap_number)
        )
      `)
      .eq('pooler_id', poolerId)
      .eq('round_id', roundId)
      .eq('is_active', true),
    supabase
      .from('playoff_eliminations')
      .select('team_id')
      .eq('pool_season_id', poolSeasonId),
  ])

  const eliminatedIds = new Set((elims ?? []).map((e: any) => e.team_id))

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
    capNumber: r.players?.player_contracts?.find((c: any) => c.season === season)?.cap_number ?? null,
    teamEliminated: eliminatedIds.has(r.players?.teams?.id),
    addedAt: r.added_at,
  }))
}

export async function getAllPoolersRostersAction(
  roundId: number,
  poolSeasonId: number,
  season: string,
): Promise<AllPoolersRosters[]> {
  const supabase = await createClient()
  const [{ data: poolers }, { data: entries }, { data: elims }] = await Promise.all([
    supabase.from('poolers').select('id, name').order('name'),
    supabase
      .from('playoff_rosters')
      .select(`
        id, pooler_id, player_id, position_slot, added_at,
        players (
          first_name, last_name, position, nhl_id,
          teams (id, code),
          player_contracts (season, cap_number)
        )
      `)
      .eq('round_id', roundId)
      .eq('is_active', true),
    supabase
      .from('playoff_eliminations')
      .select('team_id')
      .eq('pool_season_id', poolSeasonId),
  ])

  const eliminatedIds = new Set((elims ?? []).map((e: any) => e.team_id))

  return (poolers ?? []).map(p => ({
    poolerId: p.id,
    poolerName: p.name,
    entries: (entries ?? [])
      .filter((e: any) => e.pooler_id === p.id)
      .map((r: any) => ({
        id: r.id,
        playerId: r.player_id,
        positionSlot: r.position_slot as 'F' | 'D' | 'G',
        firstName: r.players?.first_name ?? '',
        lastName: r.players?.last_name ?? '',
        position: r.players?.position ?? null,
        teamCode: r.players?.teams?.code ?? null,
        teamId: r.players?.teams?.id ?? null,
        nhlId: r.players?.nhl_id ?? null,
        capNumber: r.players?.player_contracts?.find((c: any) => c.season === season)?.cap_number ?? null,
        teamEliminated: eliminatedIds.has(r.players?.teams?.id),
        addedAt: r.added_at,
      })),
  }))
}

export async function searchPlayoffPlayersAction(
  query: string,
  season: string,
  poolSeasonId: number,
): Promise<PlayoffPlayerResult[]> {
  if (query.length < 2) return []
  const supabase = await createClient()
  const [{ data: players }, { data: elims }] = await Promise.all([
    supabase
      .from('players')
      .select('id, first_name, last_name, position, nhl_id, teams (id, code), player_contracts (season, cap_number)')
      .or(`last_name.ilike.%${query}%,first_name.ilike.%${query}%`)
      .eq('is_available', true)
      .order('last_name')
      .limit(20),
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
    capNumber: p.player_contracts?.find((c: any) => c.season === season)?.cap_number ?? null,
    teamEliminated: eliminatedIds.has(p.teams?.id),
  }))
}

export async function getPostDeadlineChangesAction(
  poolerId: string,
  roundId: number,
  deadline: string,
): Promise<number> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('playoff_rosters')
    .select('id')
    .eq('pooler_id', poolerId)
    .eq('round_id', roundId)
    .eq('is_active', true)
    .neq('removal_reason', 'elimination')
    .gt('added_at', deadline)
  return (data ?? []).length
}

// ─── Pooler write action ───────────────────────────────────────────────────────

export async function submitPlayoffChangeAction(input: {
  poolerId: string
  roundId: number
  poolSeasonId: number
  season: string
  removeEntryId: number | null
  addPlayerId: number | null
  addPositionSlot: 'F' | 'D' | 'G' | null
  isEliminationReplacement: boolean
}): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { data: poolerSelf } = await supabase
    .from('poolers').select('is_admin').eq('id', user.id).single()
  const isAdmin = poolerSelf?.is_admin ?? false

  if (!isAdmin && user.id !== input.poolerId) return { error: 'Non autorisé' }

  const db = createAdminClient()

  // Fetch round info
  const { data: round } = await db
    .from('playoff_rounds')
    .select('submission_deadline, max_changes, is_active')
    .eq('id', input.roundId)
    .single()
  if (!round) return { error: 'Ronde introuvable' }
  if (!round.is_active) return { error: 'Cette ronde n\'est plus active' }

  const deadline = round.submission_deadline ? new Date(round.submission_deadline) : null
  const isFrozen = deadline ? new Date() > deadline : false

  // Post-deadline validations (non-admin only)
  if (isFrozen && !isAdmin) {
    if (!input.isEliminationReplacement) {
      // Check discretionary change budget
      const { data: postDeadlineEntries } = await db
        .from('playoff_rosters')
        .select('id')
        .eq('pooler_id', input.poolerId)
        .eq('round_id', input.roundId)
        .gt('added_at', round.submission_deadline!)
        .neq('removal_reason', 'elimination')
      const used = (postDeadlineEntries ?? []).length
      if (used >= round.max_changes) {
        return { error: `Limite de ${round.max_changes} changements discrétionnaires atteinte pour cette ronde.` }
      }
    } else {
      // Verify the removed player's team is actually eliminated
      if (input.removeEntryId) {
        const { data: entry } = await db
          .from('playoff_rosters')
          .select('player_id, players (teams (id))')
          .eq('id', input.removeEntryId)
          .single()
        const teamId = (entry?.players as any)?.teams?.id
        if (teamId) {
          const { data: elim } = await db
            .from('playoff_eliminations')
            .select('id')
            .eq('pool_season_id', input.poolSeasonId)
            .eq('team_id', teamId)
            .maybeSingle()
          if (!elim) return { error: 'Ce joueur n\'est pas sur une équipe éliminée.' }
        }
      }
    }
  }

  try {
    const now = new Date().toISOString()

    // Remove existing entry
    if (input.removeEntryId) {
      await db.from('playoff_rosters').update({
        is_active: false,
        removed_at: now,
        removal_reason: input.isEliminationReplacement ? 'elimination' : 'discretionary',
      }).eq('id', input.removeEntryId)
    }

    // Add new player
    if (input.addPlayerId && input.addPositionSlot) {
      const { data: existing } = await db
        .from('playoff_rosters')
        .select('id')
        .eq('round_id', input.roundId)
        .eq('pooler_id', input.poolerId)
        .eq('player_id', input.addPlayerId)
        .maybeSingle()

      if (existing) {
        await db.from('playoff_rosters').update({
          is_active: true,
          position_slot: input.addPositionSlot,
          added_at: now,
          removed_at: null,
          removal_reason: null,
        }).eq('id', existing.id)
      } else {
        await db.from('playoff_rosters').insert({
          round_id: input.roundId,
          pooler_id: input.poolerId,
          player_id: input.addPlayerId,
          position_slot: input.addPositionSlot,
          is_active: true,
          added_at: now,
        })
      }
    }

    revalidatePath('/gestion-series')
    revalidatePath('/admin/series')
    return {}
  } catch (e: any) {
    return { error: e?.message ?? 'Erreur inconnue' }
  }
}

// ─── Admin write actions ───────────────────────────────────────────────────────

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')
  const { data: me } = await supabase.from('poolers').select('is_admin').eq('id', user.id).single()
  if (!me?.is_admin) throw new Error('Accès refusé')
}

export async function createRoundAction(
  poolSeasonId: number,
  roundNumber: number,
  submissionDeadline: string | null,
  maxChanges: number,
): Promise<{ error?: string }> {
  try {
    await requireAdmin()
    const db = createAdminClient()
    const { error } = await db.from('playoff_rounds').insert({
      pool_season_id: poolSeasonId,
      round_number: roundNumber,
      submission_deadline: submissionDeadline,
      max_changes: maxChanges,
      is_active: false,
    })
    if (error) return { error: error.message }
    revalidatePath('/admin/series')
    return {}
  } catch (e: any) {
    return { error: e?.message ?? 'Erreur inconnue' }
  }
}

export async function updateRoundAction(
  roundId: number,
  submissionDeadline: string | null,
  maxChanges: number,
): Promise<{ error?: string }> {
  try {
    await requireAdmin()
    const db = createAdminClient()
    const { error } = await db.from('playoff_rounds').update({
      submission_deadline: submissionDeadline,
      max_changes: maxChanges,
    }).eq('id', roundId)
    if (error) return { error: error.message }
    revalidatePath('/admin/series')
    revalidatePath('/gestion-series')
    return {}
  } catch (e: any) {
    return { error: e?.message ?? 'Erreur inconnue' }
  }
}

export async function activateRoundAction(
  roundId: number,
  poolSeasonId: number,
): Promise<{ error?: string }> {
  try {
    await requireAdmin()
    const db = createAdminClient()
    // Désactiver toutes les rondes de cette saison
    await db.from('playoff_rounds').update({ is_active: false }).eq('pool_season_id', poolSeasonId)
    const { error } = await db.from('playoff_rounds').update({ is_active: true }).eq('id', roundId)
    if (error) return { error: error.message }
    revalidatePath('/admin/series')
    revalidatePath('/gestion-series')
    return {}
  } catch (e: any) {
    return { error: e?.message ?? 'Erreur inconnue' }
  }
}

export async function transitionToNextRoundAction(
  fromRoundId: number,
  toRoundId: number,
  poolSeasonId: number,
): Promise<{ error?: string; copied?: number }> {
  try {
    await requireAdmin()
    const db = createAdminClient()

    // Récupérer tous les alignements actifs de la ronde précédente
    const { data: entries } = await db
      .from('playoff_rosters')
      .select('pooler_id, player_id, position_slot')
      .eq('round_id', fromRoundId)
      .eq('is_active', true)
    if (!entries || entries.length === 0) return { error: 'Aucun alignement à copier.' }

    const now = new Date().toISOString()
    const toInsert = entries.map((e: any) => ({
      round_id: toRoundId,
      pooler_id: e.pooler_id,
      player_id: e.player_id,
      position_slot: e.position_slot,
      is_active: true,
      added_at: now,
    }))

    const { error } = await db
      .from('playoff_rosters')
      .upsert(toInsert, { onConflict: 'round_id,pooler_id,player_id', ignoreDuplicates: true })
    if (error) return { error: error.message }

    revalidatePath('/admin/series')
    revalidatePath('/gestion-series')
    return { copied: toInsert.length }
  } catch (e: any) {
    return { error: e?.message ?? 'Erreur inconnue' }
  }
}

export async function markTeamEliminatedAction(
  poolSeasonId: number,
  teamId: number,
  eliminatedInRound: number,
): Promise<{ error?: string }> {
  try {
    await requireAdmin()
    const db = createAdminClient()
    const { error } = await db.from('playoff_eliminations').upsert(
      { pool_season_id: poolSeasonId, team_id: teamId, eliminated_in_round: eliminatedInRound },
      { onConflict: 'pool_season_id,team_id', ignoreDuplicates: false },
    )
    if (error) return { error: error.message }
    revalidatePath('/admin/series')
    revalidatePath('/gestion-series')
    return {}
  } catch (e: any) {
    return { error: e?.message ?? 'Erreur inconnue' }
  }
}

export async function removeEliminationAction(eliminationId: number): Promise<{ error?: string }> {
  try {
    await requireAdmin()
    const db = createAdminClient()
    const { error } = await db.from('playoff_eliminations').delete().eq('id', eliminationId)
    if (error) return { error: error.message }
    revalidatePath('/admin/series')
    revalidatePath('/gestion-series')
    return {}
  } catch (e: any) {
    return { error: e?.message ?? 'Erreur inconnue' }
  }
}
