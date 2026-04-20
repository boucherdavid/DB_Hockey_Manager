import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PicksManager from './PicksManager'

export const metadata = { title: 'Mes picks — Séries' }
export const dynamic = 'force-dynamic'

export default async function SeriesPicksPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: pooler } = await supabase
    .from('poolers')
    .select('id, name')
    .eq('id', user.id)
    .single()

  if (!pooler) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center text-gray-500">
        Votre compte n&apos;est pas lié à un pooler.
      </div>
    )
  }

  const { data: ps } = await supabase
    .from('playoff_seasons')
    .select('id, season, current_round, cap_per_round')
    .eq('is_active', true)
    .single()

  if (!ps) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Pool des séries</h1>
        <p className="text-gray-500">Aucune saison playoffs active pour l&apos;instant.</p>
      </div>
    )
  }

  // Picks actifs du pooler
  const { data: rawPicks } = await supabase
    .from('playoff_rosters')
    .select(`
      player_id, round_added,
      snap_goals, snap_assists, snap_goalie_wins, snap_goalie_otl, snap_goalie_shutouts,
      players (id, first_name, last_name, position, player_contracts (cap_number, season))
    `)
    .eq('playoff_season_id', ps.id)
    .eq('pooler_id', user.id)
    .eq('is_active', true)

  // Tous les joueurs actifs en séries (ceux qui ont un contrat cette saison)
  // On se base sur les joueurs en BD avec contrat actif
  const seasonLabel = ps.season // ex: '2025-26'
  const { data: rawPlayers } = await supabase
    .from('players')
    .select('id, first_name, last_name, position, player_contracts (cap_number, season)')
    .order('last_name')

  // Filtrer sur la saison active et cap > 0 (exclut les ELC/UFA sans contrat)
  const players = (rawPlayers ?? []).flatMap(p => {
    const contract = (p.player_contracts as { cap_number: number; season: string }[])
      .find(c => c.season === seasonLabel && c.cap_number > 0)
    if (!contract || !p.position) return []
    return [{
      id: p.id,
      first_name: p.first_name,
      last_name: p.last_name,
      position: p.position,
      cap_number: contract.cap_number,
      team_abbrev: '',
    }]
  })

  // Picks actuels formatés
  const currentPicks = (rawPicks ?? []).flatMap(r => {
    const p = r.players as unknown as { id: number; first_name: string; last_name: string; position: string; player_contracts: { cap_number: number; season: string }[] } | null
    if (!p) return []
    const contract = (p.player_contracts ?? []).find(c => c.season === seasonLabel)
    return [{
      playerId: p.id,
      firstName: p.first_name,
      lastName: p.last_name,
      position: p.position,
      cap_number: contract?.cap_number ?? 0,
      snap_goals: r.snap_goals,
      snap_assists: r.snap_assists,
      snap_goalie_wins: r.snap_goalie_wins,
      snap_goalie_otl: r.snap_goalie_otl,
      snap_goalie_shutouts: r.snap_goalie_shutouts,
    }]
  })

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <PicksManager
        playoffSeasonId={ps.id}
        currentRound={ps.current_round}
        capPerRound={ps.cap_per_round}
        players={players}
        currentPicks={currentPicks}
      />
    </div>
  )
}
