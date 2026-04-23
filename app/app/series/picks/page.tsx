import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PicksManager from './PicksManager'
import { fetchAllPages } from '@/lib/supabase/fetch-all'

export const metadata = { title: 'Mes choix — Séries' }
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

  const seasonLabel = ps.season

  // Équipes encore actives dans le bracket (API NHL) — filtre la liste de sélection
  const playoffYear = parseInt(ps.season.split('-')[0]) + 1
  let activeTeamCodes: Set<string> | null = null
  try {
    const bracketRes = await fetch(
      `https://api-web.nhle.com/v1/playoff-bracket/${playoffYear}`,
      { next: { revalidate: 3600 } }
    )
    if (bracketRes.ok) {
      const bracket = await bracketRes.json() as {
        series: {
          topSeedTeam: { id: number; abbrev: string } | null
          bottomSeedTeam: { id: number; abbrev: string } | null
          losingTeamId?: number
        }[]
      }
      const series = bracket.series ?? []
      if (series.length > 0) {
        const losingIds = new Set(series.map(s => s.losingTeamId).filter(Boolean))
        const active = new Set<string>()
        for (const s of series) {
          if (s.topSeedTeam && !losingIds.has(s.topSeedTeam.id)) active.add(s.topSeedTeam.abbrev)
          if (s.bottomSeedTeam && !losingIds.has(s.bottomSeedTeam.id)) active.add(s.bottomSeedTeam.abbrev)
        }
        if (active.size > 0) activeTeamCodes = active
      }
    }
  } catch {
    // Silently ignore — pas de filtre si l'API est indisponible
  }

  // Picks actifs du pooler
  const { data: rawPicks } = await supabase
    .from('playoff_rosters')
    .select(`
      player_id, round_added, conference,
      snap_goals, snap_assists, snap_goalie_wins, snap_goalie_otl, snap_goalie_shutouts,
      players (id, first_name, last_name, position, player_contracts (cap_number, season))
    `)
    .eq('playoff_season_id', ps.id)
    .eq('pooler_id', user.id)
    .eq('is_active', true)

  type RawPlayer = { id: number; first_name: string; last_name: string; position: string | null; teams: unknown; player_contracts: unknown }

  // Partir de players pour exclure salaires retenus et rachats
  const rawPlayers = await fetchAllPages<RawPlayer>((from, to) =>
    supabase
      .from('players')
      .select('id, first_name, last_name, position, teams (code, conference), player_contracts (season, cap_number, years_remaining)')
      .range(from, to) as unknown as Promise<{ data: RawPlayer[] | null; error: { message: string } | null }>
  )

  // Fallback statique si la colonne conference n'est pas renseignée en BD
  const EASTERN_TEAMS = new Set([
    'BOS','BUF','DET','FLA','MTL','OTT','TBL','TOR',
    'CAR','CBJ','NJD','NYI','NYR','PHI','PIT','WSH',
  ])

  type PlayerRow = {
    id: number
    first_name: string
    last_name: string
    position: string | null
    cap_number: number
    team_abbrev: string
    conference: string
  }

  const players: PlayerRow[] = (rawPlayers ?? []).flatMap(p => {
    const player = p as unknown as {
      id: number; first_name: string; last_name: string; position: string | null
      teams: { code: string; conference: string } | null
      player_contracts: { season: string; cap_number: number; years_remaining: number | null }[]
    }
    if (!player.teams) return []
    const teamCode = player.teams.code
    if (activeTeamCodes && !activeTeamCodes.has(teamCode)) return []
    const contract = (player.player_contracts ?? []).find(
      c => c.season === seasonLabel && c.cap_number > 0 && (c.years_remaining == null || c.years_remaining > 0)
    )
    if (!contract) return []
    const conference = player.teams.conference || (EASTERN_TEAMS.has(teamCode) ? 'Est' : 'Ouest')
    return [{
      id: player.id,
      first_name: player.first_name,
      last_name: player.last_name,
      position: player.position ?? null,
      cap_number: contract.cap_number,
      team_abbrev: teamCode,
      conference,
    }]
  }).sort((a, b) =>
    a.team_abbrev.localeCompare(b.team_abbrev) || b.cap_number - a.cap_number
  )

  // Picks actuels formatés
  const currentPicks = (rawPicks ?? []).flatMap(r => {
    const p = r.players as unknown as {
      id: number; first_name: string; last_name: string; position: string
      player_contracts: { cap_number: number; season: string }[]
    } | null
    if (!p) return []
    const contract = (p.player_contracts ?? []).find(c => c.season === seasonLabel)
    return [{
      playerId: p.id,
      firstName: p.first_name,
      lastName: p.last_name,
      position: p.position,
      cap_number: contract?.cap_number ?? 0,
      conference: (r.conference ?? 'Est') as 'Est' | 'Ouest',
      snap_goals: r.snap_goals,
      snap_assists: r.snap_assists,
      snap_goalie_wins: r.snap_goalie_wins,
      snap_goalie_otl: r.snap_goalie_otl,
      snap_goalie_shutouts: r.snap_goalie_shutouts,
    }]
  })

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <PicksManager
        playoffSeasonId={ps.id}
        currentRound={ps.current_round}
        capPerRound={ps.cap_per_round}
        players={players}
        currentPicks={currentPicks}
        activeTeamCount={activeTeamCodes?.size ?? null}
      />
    </div>
  )
}