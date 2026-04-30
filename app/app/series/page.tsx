import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { fetchNhlSkaters, fetchNhlGoalies, normName } from '@/lib/nhl-stats'
import { PoolerSeriesCard } from './PoolerSeriesCard'
import type { PlayerLine } from './PoolerSeriesCard'

export const metadata = { title: 'Pool des séries' }
export const dynamic = 'force-dynamic'

const ROUND_LABEL = ['Quart de finale', 'Demi-finale', 'Finale de conférence', 'Finale de la Coupe Stanley']

export default async function SeriesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: ps } = await supabase
    .from('playoff_seasons')
    .select('id, season, current_round, cap_per_round, scoring_start_at')
    .eq('is_active', true)
    .single()

  if (!ps) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Pool des séries</h1>
        <p className="text-gray-500">Aucune saison playoffs active pour l&apos;instant.</p>
      </div>
    )
  }

  // Avant le démarrage : afficher un écran d'attente
  if (!ps.scoring_start_at) {
    const { data: picks } = await supabase
      .from('playoff_rosters')
      .select('pooler_id, poolers(name)')
      .eq('playoff_season_id', ps.id)
      .eq('is_active', true)

    const submitted = new Map<string, string>()
    for (const p of picks ?? []) {
      const pooler = p.poolers as unknown as { name: string } | null
      if (!submitted.has(p.pooler_id) && pooler) submitted.set(p.pooler_id, pooler.name)
    }

    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-1">Pool des séries {ps.season}</h1>
        <p className="text-sm text-gray-500 mb-6">
          Ronde {ps.current_round} — {['Quart de finale','Demi-finale','Finale de conférence','Finale de la Coupe Stanley'][ps.current_round - 1] ?? `Ronde ${ps.current_round}`}
        </p>
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-xl">⏳</div>
            <div>
              <p className="font-semibold text-gray-800">En attente du démarrage</p>
              <p className="text-sm text-gray-500">Le classement sera visible une fois la comptabilisation démarrée par l&apos;admin.</p>
            </div>
          </div>
          {submitted.size > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">{submitted.size} pooler{submitted.size > 1 ? 's ont' : ' a'} soumis ses choix :</p>
              <div className="flex flex-wrap gap-2">
                {Array.from(submitted.values()).map(name => (
                  <span key={name} className="text-xs bg-green-100 text-green-700 rounded-full px-3 py-1">{name}</span>
                ))}
              </div>
            </div>
          )}
          {user && (
            <Link href="/series/picks" className="inline-block bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700">
              Soumettre / modifier mes choix
            </Link>
          )}
        </div>
      </div>
    )
  }

  const [{ data: scoringRows }, { data: rosterRows }, skatersMap, goaliesMap] = await Promise.all([
    supabase.from('scoring_config').select('stat_key, points, points_playoffs').in('scope', ['playoffs', 'both']),
    supabase
      .from('playoff_rosters')
      .select(`
        pooler_id, conference,
        snap_goals, snap_assists, snap_goalie_wins, snap_goalie_otl, snap_goalie_shutouts, snap_gwg,
        poolers (id, name),
        players (first_name, last_name, position)
      `)
      .eq('playoff_season_id', ps.id)
      .eq('is_active', true),
    fetchNhlSkaters(3),
    fetchNhlGoalies(3),
  ])

  const pts: Record<string, number> = {}
  for (const r of scoringRows ?? []) {
    pts[r.stat_key] = r.points_playoffs !== null ? Number(r.points_playoffs) : Number(r.points)
  }
  const p = {
    goal:           pts.goal           ?? 1,
    assist:         pts.assist         ?? 1,
    goalie_win:     pts.goalie_win     ?? 2,
    goalie_otl:     pts.goalie_otl     ?? 1,
    goalie_shutout: pts.goalie_shutout ?? 2,
    gwg:            pts.gwg            ?? 1,
  }

  const poolerMap = new Map<string, { name: string; players: PlayerLine[] }>()

  for (const row of rosterRows ?? []) {
    const pooler = row.poolers as unknown as { id: string; name: string } | null
    const player = row.players as unknown as { first_name: string; last_name: string; position: string } | null
    if (!pooler || !player) continue

    if (!poolerMap.has(pooler.id)) poolerMap.set(pooler.id, { name: pooler.name, players: [] })

    const key = normName(`${player.first_name} ${player.last_name}`)
    const isG = player.position === 'G'
    let line: PlayerLine

    if (isG) {
      const stat = goaliesMap.get(key)
      const wins     = Math.max(0, (stat?.wins ?? 0)     - row.snap_goalie_wins)
      const otl      = Math.max(0, (stat?.otLosses ?? 0) - row.snap_goalie_otl)
      const shutouts = Math.max(0, (stat?.shutouts ?? 0) - row.snap_goalie_shutouts)
      const goals    = Math.max(0, (stat?.goals ?? 0)    - row.snap_goals)
      const assists  = Math.max(0, (stat?.assists ?? 0)  - row.snap_assists)
      line = {
        firstName: player.first_name, lastName: player.last_name, position: 'G',
        conference: row.conference ?? '',
        goals, assists, gwg: 0, goalieWins: wins, goalieOtl: otl, goalieShutouts: shutouts,
        poolPoints: wins * p.goalie_win + otl * p.goalie_otl + shutouts * p.goalie_shutout
          + goals * p.goal + assists * p.assist,
      }
    } else {
      const stat = skatersMap.get(key)
      const goals   = Math.max(0, (stat?.goals ?? 0)                - row.snap_goals)
      const assists = Math.max(0, (stat?.assists ?? 0)              - row.snap_assists)
      const gwg     = Math.max(0, (stat?.gameWinningGoals ?? 0)     - row.snap_gwg)
      line = {
        firstName: player.first_name, lastName: player.last_name, position: player.position,
        conference: row.conference ?? '',
        goals, assists, gwg, goalieWins: 0, goalieOtl: 0, goalieShutouts: 0,
        poolPoints: goals * p.goal + assists * p.assist + gwg * p.gwg,
      }
    }

    poolerMap.get(pooler.id)!.players.push(line)
  }

  const standings = Array.from(poolerMap.entries())
    .map(([id, { name, players }]) => ({
      poolerId: id,
      poolerName: name,
      totalPoints: players.reduce((s, p) => s + p.poolPoints, 0),
      players,
    }))
    .sort((a, b) => b.totalPoints - a.totalPoints || a.poolerName.localeCompare(b.poolerName))

  const roundLabel = ROUND_LABEL[ps.current_round - 1] ?? `Ronde ${ps.current_round}`

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Pool des séries {ps.season}</h1>
          <p className="text-sm text-gray-500 mt-0.5">Ronde {ps.current_round} — {roundLabel}</p>
        </div>
        {user && (
          <Link href="/series/picks" className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700">
            Mes choix
          </Link>
        )}
      </div>

      {standings.length === 0 ? (
        <p className="text-gray-500">Aucun pooler n&apos;a encore soumis ses choix.</p>
      ) : (
        <div className="space-y-3">
          {standings.map((pooler, i) => (
            <PoolerSeriesCard key={pooler.poolerId} pooler={pooler} rank={i} />
          ))}
        </div>
      )}
    </div>
  )
}
