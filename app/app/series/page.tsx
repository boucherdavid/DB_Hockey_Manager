import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { fetchNhlSkaters, fetchNhlGoalies, normName, fmtPts } from '@/lib/nhl-stats'

export const metadata = { title: 'Pool des séries' }
export const dynamic = 'force-dynamic'

const ROUND_LABEL = ['Quart de finale', 'Demi-finale', 'Finale de conférence', 'Finale de la Coupe Stanley']
const RANK_COLOR = ['text-yellow-500', 'text-gray-400', 'text-amber-600']

function posGroup(pos: string) {
  if (pos === 'G') return 'G'
  if (['D', 'LD', 'RD'].includes(pos)) return 'D'
  return 'F'
}

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
              <p className="text-sm font-medium text-gray-700 mb-2">{submitted.size} pooler{submitted.size > 1 ? 's ont' : ' a'} soumis ses picks :</p>
              <div className="flex flex-wrap gap-2">
                {Array.from(submitted.values()).map(name => (
                  <span key={name} className="text-xs bg-green-100 text-green-700 rounded-full px-3 py-1">{name}</span>
                ))}
              </div>
            </div>
          )}
          {user && (
            <Link href="/series/picks" className="inline-block bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700">
              Soumettre / modifier mes picks
            </Link>
          )}
        </div>
      </div>
    )
  }

  const [{ data: scoringRows }, { data: rosterRows }, skatersMap, goaliesMap] = await Promise.all([
    supabase.from('scoring_config').select('stat_key, points'),
    supabase
      .from('playoff_rosters')
      .select(`
        pooler_id, player_id,
        snap_goals, snap_assists, snap_goalie_wins, snap_goalie_otl, snap_goalie_shutouts,
        poolers (id, name),
        players (first_name, last_name, position)
      `)
      .eq('playoff_season_id', ps.id)
      .eq('is_active', true),
    fetchNhlSkaters(3),
    fetchNhlGoalies(3),
  ])

  // Scoring config
  const scoring: Record<string, number> = {}
  for (const r of scoringRows ?? []) scoring[r.stat_key] = Number(r.points)
  const pts = {
    goal:           scoring.goal           ?? 1,
    assist:         scoring.assist         ?? 1,
    goalie_win:     scoring.goalie_win     ?? 2,
    goalie_otl:     scoring.goalie_otl     ?? 1,
    goalie_shutout: scoring.goalie_shutout ?? 2,
  }

  // Calcul des points par pooler
  type PlayerLine = {
    firstName: string
    lastName: string
    position: string
    goals: number
    assists: number
    goalieWins: number
    goalieOtl: number
    goalieShutouts: number
    poolPoints: number
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
      const wins     = Math.max(0, (stat?.wins ?? 0)      - row.snap_goalie_wins)
      const otl      = Math.max(0, (stat?.otLosses ?? 0)  - row.snap_goalie_otl)
      const shutouts = Math.max(0, (stat?.shutouts ?? 0)  - row.snap_goalie_shutouts)
      const goals    = Math.max(0, (stat?.goals ?? 0)     - row.snap_goals)
      const assists  = Math.max(0, (stat?.assists ?? 0)   - row.snap_assists)
      line = {
        firstName: player.first_name, lastName: player.last_name, position: 'G',
        goals, assists, goalieWins: wins, goalieOtl: otl, goalieShutouts: shutouts,
        poolPoints: wins * pts.goalie_win + otl * pts.goalie_otl + shutouts * pts.goalie_shutout
          + goals * pts.goal + assists * pts.assist,
      }
    } else {
      const stat = skatersMap.get(key)
      const goals   = Math.max(0, (stat?.goals ?? 0)   - row.snap_goals)
      const assists = Math.max(0, (stat?.assists ?? 0) - row.snap_assists)
      line = {
        firstName: player.first_name, lastName: player.last_name, position: player.position,
        goals, assists, goalieWins: 0, goalieOtl: 0, goalieShutouts: 0,
        poolPoints: goals * pts.goal + assists * pts.assist,
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
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Pool des séries {ps.season}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Ronde {ps.current_round} — {roundLabel}
          </p>
        </div>
        {user && (
          <Link
            href="/series/picks"
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700"
          >
            Mes picks
          </Link>
        )}
      </div>

      {standings.length === 0 ? (
        <p className="text-gray-500">Aucun pooler n&apos;a encore soumis ses picks.</p>
      ) : (
        <div className="space-y-3">
          {standings.map((pooler, i) => {
            const byGroup = { F: [] as typeof pooler.players, D: [] as typeof pooler.players, G: [] as typeof pooler.players }
            for (const p of pooler.players) byGroup[posGroup(p.position) as 'F' | 'D' | 'G'].push(p)

            return (
              <div key={pooler.poolerId} className="bg-white rounded-lg shadow overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-3 border-b">
                  <span className={`font-bold text-lg w-7 text-center ${RANK_COLOR[i] ?? 'text-gray-500'}`}>{i + 1}</span>
                  <span className="flex-1 font-semibold text-gray-800">{pooler.poolerName}</span>
                  <span className="text-xl font-bold text-blue-600">{fmtPts(pooler.totalPoints)}</span>
                  <span className="text-sm text-gray-400">pts</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-400 uppercase tracking-wide">
                      <tr>
                        <th className="px-4 py-1.5 text-left">Joueur</th>
                        <th className="px-2 py-1.5">B</th>
                        <th className="px-2 py-1.5">A</th>
                        <th className="px-2 py-1.5 hidden sm:table-cell">V</th>
                        <th className="px-2 py-1.5 hidden sm:table-cell">DP</th>
                        <th className="px-2 py-1.5 hidden sm:table-cell">BL</th>
                        <th className="px-2 py-1.5 text-blue-500">Pts</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(['F', 'D', 'G'] as const).map(group =>
                        byGroup[group].map((p, j) => (
                          <tr key={`${group}-${j}`} className="hover:bg-gray-50">
                            <td className="px-4 py-2">
                              <span className="font-medium text-gray-800">{p.lastName}, {p.firstName}</span>
                              <span className="ml-1.5 text-xs text-gray-400">{p.position}</span>
                            </td>
                            <td className="px-2 py-2 text-center text-gray-600">{p.goals}</td>
                            <td className="px-2 py-2 text-center text-gray-600">{p.assists}</td>
                            <td className="px-2 py-2 text-center text-gray-500 hidden sm:table-cell">
                              {group === 'G' ? p.goalieWins : '—'}
                            </td>
                            <td className="px-2 py-2 text-center text-gray-500 hidden sm:table-cell">
                              {group === 'G' ? p.goalieOtl : '—'}
                            </td>
                            <td className="px-2 py-2 text-center text-gray-500 hidden sm:table-cell">
                              {group === 'G' ? (p.goalieShutouts || '—') : '—'}
                            </td>
                            <td className="px-2 py-2 text-center font-bold text-blue-600">{fmtPts(p.poolPoints)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
