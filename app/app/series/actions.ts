'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { fetchNhlSkaters, fetchNhlGoalies, normName } from '@/lib/nhl-stats'
import { sendPushToAdmins, sendPushToUser } from '@/lib/push'

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
          snap_gwg:             0,
        }
      : {
          snap_goals:           skatersMap.get(key)?.goals            ?? 0,
          snap_assists:         skatersMap.get(key)?.assists           ?? 0,
          snap_goalie_wins:     0,
          snap_goalie_otl:      0,
          snap_goalie_shutouts: 0,
          snap_gwg:             skatersMap.get(key)?.gameWinningGoals ?? 0,
        }

    await supabase.from('playoff_rosters').update(snap).eq('id', pick.id)
    updated++
  }

  // Enregistrer la date de départ + verrouiller les picks
  await supabase
    .from('playoff_seasons')
    .update({ scoring_start_at: new Date().toISOString(), picks_locked: true })
    .eq('id', playoffSeasonId)

  // Notification : comptabilisation démarrée — uniquement aux poolers avec picks actifs
  const { data: psSeason } = await supabase
    .from('playoff_seasons')
    .select('current_round')
    .eq('id', playoffSeasonId)
    .single()

  const { data: participants } = await supabase
    .from('playoff_rosters')
    .select('pooler_id')
    .eq('playoff_season_id', playoffSeasonId)
    .eq('is_active', true)

  const participantIds = [...new Set((participants ?? []).map(p => p.pooler_id))]
  await Promise.all(participantIds.map(uid =>
    sendPushToUser(uid, {
      title: 'DB Hockey Manager — Pool des séries',
      body:  `La comptabilisation des points de la ronde ${psSeason?.current_round ?? ''} est démarrée !`,
      url:   '/series',
    }).catch(() => {})
  ))

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

export async function deletePlayoffSeasonAction(id: number): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }
  const { data: me } = await supabase.from('poolers').select('is_admin').eq('id', user.id).single()
  if (!me?.is_admin) return { error: 'Accès refusé.' }

  const { data: ps } = await supabase.from('playoff_seasons').select('is_active, scoring_start_at').eq('id', id).single()
  if (!ps) return { error: 'Saison introuvable.' }
  if (ps.is_active) return { error: 'Impossible de supprimer la saison active.' }
  if (ps.scoring_start_at) return { error: 'Impossible de supprimer une saison avec comptabilisation démarrée.' }

  const { error } = await supabase.from('playoff_seasons').delete().eq('id', id)
  if (error) return { error: error.message }
  REVALIDATE()
  return {}
}

export async function updateCapAction(id: number, capPerRound: number): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }
  const { data: me } = await supabase.from('poolers').select('is_admin').eq('id', user.id).single()
  if (!me?.is_admin) return { error: 'Accès refusé.' }

  const { data: ps } = await supabase.from('playoff_seasons').select('scoring_start_at').eq('id', id).single()
  if (!ps) return { error: 'Saison introuvable.' }
  if (ps.scoring_start_at) return { error: 'Impossible de modifier le cap après le démarrage de la comptabilisation.' }

  const { error } = await supabase.from('playoff_seasons').update({ cap_per_round: capPerRound }).eq('id', id)
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

  const newRound = ps.current_round + 1
  const { error } = await supabase
    .from('playoff_seasons')
    .update({ current_round: newRound, picks_locked: false, scoring_start_at: null })
    .eq('id', id)

  if (error) return { error: error.message }

  // Notification générale : nouvelle ronde démarrée — uniquement aux poolers avec picks actifs
  const ROUND_LABEL = ['Quart de finale', 'Demi-finale', 'Finale de conférence', 'Finale de la Coupe Stanley']

  const { data: roundParticipants } = await supabase
    .from('playoff_rosters')
    .select('pooler_id')
    .eq('playoff_season_id', id)
    .eq('is_active', true)

  const roundParticipantIds = [...new Set((roundParticipants ?? []).map(p => p.pooler_id))]
  await Promise.all(roundParticipantIds.map(uid =>
    sendPushToUser(uid, {
      title: 'DB Hockey Manager — Pool des séries',
      body:  `Ronde ${newRound} démarrée (${ROUND_LABEL[newRound - 1] ?? `Ronde ${newRound}`}) — soumettez vos nouveaux choix !`,
      url:   '/series/picks',
    }).catch(() => {})
  ))

  // Notification ciblée : poolers avec des joueurs d'équipes éliminées
  try {
    const { data: psData } = await supabase
      .from('playoff_seasons')
      .select('season')
      .eq('id', id)
      .single()

    if (psData) {
      const playoffYear = parseInt(psData.season.split('-')[0]) + 1
      const bracketRes = await fetch(`https://api-web.nhle.com/v1/playoff-bracket/${playoffYear}`)
      if (bracketRes.ok) {
        const bracket = await bracketRes.json() as {
          series: { topSeedTeam: { id: number; abbrev: string } | null; bottomSeedTeam: { id: number; abbrev: string } | null; losingTeamId?: number }[]
        }
        const series = bracket.series ?? []
        const losingIds = new Set(series.map(s => s.losingTeamId).filter(Boolean))
        const activeCodes = new Set<string>()
        for (const s of series) {
          if (s.topSeedTeam && !losingIds.has(s.topSeedTeam.id)) activeCodes.add(s.topSeedTeam.abbrev)
          if (s.bottomSeedTeam && !losingIds.has(s.bottomSeedTeam.id)) activeCodes.add(s.bottomSeedTeam.abbrev)
        }

        if (activeCodes.size > 0) {
          // Trouver les picks actifs dont l'équipe est éliminée
          const { data: activePicks } = await supabase
            .from('playoff_rosters')
            .select('pooler_id, players (teams (code))')
            .eq('playoff_season_id', id)
            .eq('is_active', true)

          const affectedPoolers = new Set<string>()
          for (const pick of activePicks ?? []) {
            const code = (pick.players as unknown as { teams: { code: string } | null } | null)?.teams?.code
            if (code && !activeCodes.has(code)) {
              affectedPoolers.add(pick.pooler_id)
            }
          }

          for (const poolerId of affectedPoolers) {
            sendPushToUser(poolerId, {
              title: 'DB Hockey Manager — Action requise',
              body:  'Un ou plusieurs joueurs de votre alignement appartiennent à une équipe éliminée. Mettez à jour vos choix.',
              url:   '/series/picks',
            }).catch(() => {})
          }
        }
      }
    }
  } catch {
    // Silently ignore si l'API bracket est indisponible
  }

  REVALIDATE()
  return {}
}

export async function togglePicksLockAction(id: number, locked: boolean): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }
  const { data: me } = await supabase.from('poolers').select('is_admin').eq('id', user.id).single()
  if (!me?.is_admin) return { error: 'Accès refusé.' }

  const { error } = await supabase
    .from('playoff_seasons')
    .update({ picks_locked: locked })
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
  position: string | null
  conference: 'Est' | 'Ouest'
}

function posGroup(pos: string | null): 'F' | 'D' | 'G' {
  if (!pos) return 'F'
  const parts = pos.split(',').map(p => p.trim())
  if (parts.some(p => p === 'G')) return 'G'
  if (parts.some(p => p === 'D' || p === 'LD' || p === 'RD')) return 'D'
  return 'F'
}

function validateConf(picks: PickInput[], conf: 'Est' | 'Ouest'): string | null {
  const cp = picks.filter(p => p.conference === conf)
  const fwd = cp.filter(p => posGroup(p.position) === 'F')
  const def = cp.filter(p => posGroup(p.position) === 'D')
  const gol = cp.filter(p => posGroup(p.position) === 'G')
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

  const { data: pooler } = await supabase.from('poolers').select('id, name').eq('id', user.id).single()
  if (!pooler) return { error: 'Compte non lié à un pooler.' }

  const { data: ps } = await supabase
    .from('playoff_seasons')
    .select('current_round, is_active, scoring_start_at, season, picks_locked')
    .eq('id', playoffSeasonId)
    .single()
  if (!ps) return { error: 'Saison playoff introuvable.' }
  if (!ps.is_active) return { error: "Cette saison playoffs n'est pas active." }
  if (ps.picks_locked) return { error: 'Les choix sont verrouillés. La comptabilisation est en cours.' }

  // Validation : 3F/2D/1G par conférence
  const errEst   = validateConf(picks, 'Est')
  const errOuest = validateConf(picks, 'Ouest')
  if (errEst)   return { error: errEst }
  if (errOuest) return { error: errOuest }

  // Validation : aucun joueur d'une équipe éliminée (seulement si scoring pas encore démarré)
  if (!ps.scoring_start_at) {
    try {
      const playoffYear = parseInt(ps.season.split('-')[0]) + 1
      const bracketRes = await fetch(`https://api-web.nhle.com/v1/playoff-bracket/${playoffYear}`)
      if (bracketRes.ok) {
        const bracket = await bracketRes.json() as {
          series: { topSeedTeam: { id: number; abbrev: string } | null; bottomSeedTeam: { id: number; abbrev: string } | null; losingTeamId?: number }[]
        }
        const series = bracket.series ?? []
        if (series.length > 0) {
          const losingIds = new Set(series.map(s => s.losingTeamId).filter(Boolean))
          const activeCodes = new Set<string>()
          for (const s of series) {
            if (s.topSeedTeam && !losingIds.has(s.topSeedTeam.id)) activeCodes.add(s.topSeedTeam.abbrev)
            if (s.bottomSeedTeam && !losingIds.has(s.bottomSeedTeam.id)) activeCodes.add(s.bottomSeedTeam.abbrev)
          }
          if (activeCodes.size > 0) {
            const playerIds = picks.map(p => p.playerId)
            const { data: playerTeams } = await supabase
              .from('players')
              .select('id, teams (code)')
              .in('id', playerIds)
            for (const pt of playerTeams ?? []) {
              const code = (pt.teams as unknown as { code: string } | null)?.code
              if (code && !activeCodes.has(code)) {
                return { error: `Un joueur sélectionné appartient à une équipe éliminée (${code}). Retirez-le avant de sauvegarder.` }
              }
            }
          }
        }
      }
    } catch {
      // Si l'API est indisponible, on laisse passer — la validation UI a déjà filtré
    }
  }

  // Snapshots via NHL API
  const [skatersMap, goaliesMap] = await Promise.all([
    fetchNhlSkaters(3),
    fetchNhlGoalies(3),
  ])

  const getSnap = (firstName: string, lastName: string, position: string | null) => {
    const key = normName(`${firstName} ${lastName}`)
    if (position === 'G') {
      const g = goaliesMap.get(key)
      return {
        snap_goals: g?.goals ?? 0, snap_assists: g?.assists ?? 0,
        snap_goalie_wins: g?.wins ?? 0, snap_goalie_otl: g?.otLosses ?? 0,
        snap_goalie_shutouts: g?.shutouts ?? 0, snap_gwg: 0,
      }
    }
    const s = skatersMap.get(key)
    return {
      snap_goals: s?.goals ?? 0, snap_assists: s?.assists ?? 0,
      snap_goalie_wins: 0, snap_goalie_otl: 0, snap_goalie_shutouts: 0,
      snap_gwg: s?.gameWinningGoals ?? 0,
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

  // Notification push aux admins (excluant l'admin qui soumet ses propres choix)
  sendPushToAdmins({
    title: 'DB Hockey Manager — Pool des séries',
    body: `${pooler?.name ?? 'Un pooler'} a soumis ses choix (Ronde ${ps.current_round}).`,
    url: '/admin/series',
  }, user.id).catch(() => {})

  REVALIDATE()
  return {}
}
