'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { fetchNhlSkaters, fetchNhlGoalies, normName } from '@/lib/nhl-stats'

const REVALIDATE = () => {
  revalidatePath('/series')
  revalidatePath('/series/picks')
  revalidatePath('/admin/series')
}

// ---------- Admin : démarrer la comptabilisation ----------

export async function startScoringAction(playoffSeasonId: number): Promise<{ error?: string; updated?: number }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }
  const { data: me } = await supabase.from('poolers').select('is_admin').eq('id', user.id).single()
  if (!me?.is_admin) return { error: 'Accès refusé.' }

  const { data: ps } = await supabase
    .from('playoff_seasons')
    .select('scoring_start_at')
    .eq('id', playoffSeasonId)
    .single()
  if (!ps) return { error: 'Saison introuvable.' }
  if (ps.scoring_start_at) return { error: 'La comptabilisation est déjà démarrée.' }

  // Récupérer tous les picks actifs
  const { data: picks } = await supabase
    .from('playoff_rosters')
    .select('id, player_id, players(first_name, last_name, position)')
    .eq('playoff_season_id', playoffSeasonId)
    .eq('is_active', true)

  if (!picks || picks.length === 0) return { error: 'Aucun pick actif trouvé.' }

  // Fetch stats playoff actuelles
  const [skatersMap, goaliesMap] = await Promise.all([
    fetchNhlSkaters(3),
    fetchNhlGoalies(3),
  ])

  // Mettre à jour chaque pick avec le snapshot actuel
  let updated = 0
  for (const pick of picks) {
    const p = pick.players as unknown as { first_name: string; last_name: string; position: string } | null
    if (!p) continue

    const key = normName(`${p.first_name} ${p.last_name}`)
    const isG = p.position === 'G'

    const snap = isG
      ? {
          snap_goals:           goaliesMap.get(key)?.goals    ?? 0,
          snap_assists:         goaliesMap.get(key)?.assists   ?? 0,
          snap_goalie_wins:     goaliesMap.get(key)?.wins      ?? 0,
          snap_goalie_otl:      goaliesMap.get(key)?.otLosses  ?? 0,
          snap_goalie_shutouts: goaliesMap.get(key)?.shutouts  ?? 0,
        }
      : {
          snap_goals:           skatersMap.get(key)?.goals   ?? 0,
          snap_assists:         skatersMap.get(key)?.assists  ?? 0,
          snap_goalie_wins:     0,
          snap_goalie_otl:      0,
          snap_goalie_shutouts: 0,
        }

    await supabase.from('playoff_rosters').update(snap).eq('id', pick.id)
    updated++
  }

  // Enregistrer la date de départ
  await supabase
    .from('playoff_seasons')
    .update({ scoring_start_at: new Date().toISOString() })
    .eq('id', playoffSeasonId)

  REVALIDATE()
  return { updated }
}

// ---------- Admin : gestion de la saison playoffs ----------

export async function createPlayoffSeasonAction(
  season: string,
  capPerRound: number,
): Promise<{ error?: string }> {
  if (!/^\d{4}-\d{2}$/.test(season)) return { error: 'Format invalide. Ex: 2025-26' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }
  const { data: me } = await supabase.from('poolers').select('is_admin').eq('id', user.id).single()
  if (!me?.is_admin) return { error: 'Accès refusé.' }

  const { error } = await supabase
    .from('playoff_seasons')
    .insert({ season, cap_per_round: capPerRound, current_round: 1, is_active: false })

  if (error) return { error: error.message }
  REVALIDATE()
  return {}
}

export async function activatePlayoffSeasonAction(id: number): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }
  const { data: me } = await supabase.from('poolers').select('is_admin').eq('id', user.id).single()
  if (!me?.is_admin) return { error: 'Accès refusé.' }

  await supabase.from('playoff_seasons').update({ is_active: false }).neq('id', 0)
  const { error } = await supabase.from('playoff_seasons').update({ is_active: true }).eq('id', id)
  if (error) return { error: error.message }

  REVALIDATE()
  return {}
}

export async function advanceRoundAction(id: number): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }
  const { data: me } = await supabase.from('poolers').select('is_admin').eq('id', user.id).single()
  if (!me?.is_admin) return { error: 'Accès refusé.' }

  const { data: ps } = await supabase.from('playoff_seasons').select('current_round').eq('id', id).single()
  if (!ps) return { error: 'Saison introuvable.' }
  if (ps.current_round >= 4) return { error: 'Déjà à la finale.' }

  const { error } = await supabase
    .from('playoff_seasons')
    .update({ current_round: ps.current_round + 1 })
    .eq('id', id)

  if (error) return { error: error.message }
  REVALIDATE()
  return {}
}

// ---------- Pooler : gestion des picks ----------

export type PickInput = {
  playerId: number
  firstName: string
  lastName: string
  position: string
  conference: 'Est' | 'Ouest'
}

function validateConf(picks: PickInput[], conf: 'Est' | 'Ouest'): string | null {
  const cp = picks.filter(p => p.conference === conf)
  const fwd = cp.filter(p => !['D', 'LD', 'RD', 'G'].includes(p.position))
  const def = cp.filter(p => ['D', 'LD', 'RD'].includes(p.position))
  const gol = cp.filter(p => p.position === 'G')
  if (fwd.length !== 3) return `Conférence ${conf} : exactement 3 attaquants requis.`
  if (def.length !== 2) return `Conférence ${conf} : exactement 2 défenseurs requis.`
  if (gol.length !== 1) return `Conférence ${conf} : exactement 1 gardien requis.`
  return null
}

export async function savePicksAction(
  playoffSeasonId: number,
  picks: PickInput[],
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }

  const { data: pooler } = await supabase.from('poolers').select('id').eq('id', user.id).single()
  if (!pooler) return { error: 'Compte non lié à un pooler.' }

  const { data: ps } = await supabase
    .from('playoff_seasons')
    .select('current_round, is_active')
    .eq('id', playoffSeasonId)
    .single()
  if (!ps) return { error: 'Saison playoff introuvable.' }
  if (!ps.is_active) return { error: "Cette saison playoffs n'est pas active." }

  // Validation : 3F/2D/1G par conférence
  const errEst   = validateConf(picks, 'Est')
  const errOuest = validateConf(picks, 'Ouest')
  if (errEst)   return { error: errEst }
  if (errOuest) return { error: errOuest }

  // Snapshots via NHL API
  const [skatersMap, goaliesMap] = await Promise.all([
    fetchNhlSkaters(3),
    fetchNhlGoalies(3),
  ])

  const getSnap = (firstName: string, lastName: string, position: string) => {
    const key = normName(`${firstName} ${lastName}`)
    if (position === 'G') {
      const g = goaliesMap.get(key)
      return {
        snap_goals: g?.goals ?? 0, snap_assists: g?.assists ?? 0,
        snap_goalie_wins: g?.wins ?? 0, snap_goalie_otl: g?.otLosses ?? 0,
        snap_goalie_shutouts: g?.shutouts ?? 0,
      }
    }
    const s = skatersMap.get(key)
    return {
      snap_goals: s?.goals ?? 0, snap_assists: s?.assists ?? 0,
      snap_goalie_wins: 0, snap_goalie_otl: 0, snap_goalie_shutouts: 0,
    }
  }

  // Désactiver les picks actuels
  const { error: deactivateErr } = await supabase
    .from('playoff_rosters')
    .update({ is_active: false, removed_at: new Date().toISOString() })
    .eq('playoff_season_id', playoffSeasonId)
    .eq('pooler_id', user.id)
    .eq('is_active', true)
  if (deactivateErr) return { error: deactivateErr.message }

  // Insérer les nouveaux picks avec conférence + snapshot
  const newRows = picks.map(p => ({
    playoff_season_id: playoffSeasonId,
    pooler_id: user.id,
    player_id: p.playerId,
    round_added: ps.current_round,
    is_active: true,
    conference: p.conference,
    ...getSnap(p.firstName, p.lastName, p.position),
  }))

  const { error: insertErr } = await supabase.from('playoff_rosters').insert(newRows)
  if (insertErr) return { error: insertErr.message }

  REVALIDATE()
  return {}
}
