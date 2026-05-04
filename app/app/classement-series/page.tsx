import { createClient } from '@/lib/supabase/server'
import {
  getActivePlayoffSaisonAction,
  getAllRoundsAction,
  getRoundStandingsAction,
} from '@/app/gestion-series/actions'

export const metadata = { title: 'Classement — Pool des séries' }
export const dynamic = 'force-dynamic'

const roundLabel = (n: number) => ['Ronde 1', 'Ronde 2', 'Demi-finales', 'Finale'][n - 1] ?? `Ronde ${n}`

export default async function ClassementSeriesPage() {
  const saison = await getActivePlayoffSaisonAction()

  if (!saison) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Classement — Pool des séries</h1>
        <p className="text-gray-500">Aucune saison de séries active.</p>
      </div>
    )
  }

  const rounds = await getAllRoundsAction(saison.id)
  const roundsWithScoring = rounds.filter(r => r.roundNumber >= 1)

  const standingsByRound = await Promise.all(
    roundsWithScoring.map(async r => ({
      round: r,
      standings: await getRoundStandingsAction(r.id),
    }))
  )

  const hasAnyScoring = standingsByRound.some(x => x.standings.length > 0)

  // Classement cumulatif toutes rondes
  const cumulatif = new Map<string, { poolerName: string; total: number; byRound: Map<number, number> }>()
  for (const { round, standings } of standingsByRound) {
    for (const s of standings) {
      if (!cumulatif.has(s.poolerId)) {
        cumulatif.set(s.poolerId, { poolerName: s.poolerName, total: 0, byRound: new Map() })
      }
      const entry = cumulatif.get(s.poolerId)!
      entry.total += s.totalPoints
      entry.byRound.set(round.roundNumber, s.totalPoints)
    }
  }
  const cumulatifSorted = [...cumulatif.entries()].sort((a, b) => b[1].total - a[1].total)

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <h1 className="text-2xl font-bold text-gray-800">Classement — Pool des séries {saison.season}</h1>

      {!hasAnyScoring && (
        <p className="text-gray-500 text-sm">Le scoring n&apos;a pas encore été comptabilisé pour cette saison.</p>
      )}

      {/* Classement cumulatif */}
      {cumulatifSorted.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="bg-slate-700 px-4 py-3">
            <h2 className="text-white font-semibold text-sm">Classement cumulatif</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b">
                <th className="text-left px-4 py-2 font-medium text-gray-600 w-8">#</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Pooler</th>
                {roundsWithScoring.map(r => (
                  <th key={r.id} className="text-right px-3 py-2 font-medium text-gray-400 text-xs">{roundLabel(r.roundNumber)}</th>
                ))}
                <th className="text-right px-4 py-2 font-bold text-gray-700">Total</th>
              </tr>
            </thead>
            <tbody>
              {cumulatifSorted.map(([poolerId, data], i) => (
                <tr key={poolerId} className={`border-b ${i === 0 ? 'bg-yellow-50' : 'hover:bg-gray-50'}`}>
                  <td className="px-4 py-2 text-gray-400 font-medium">{i + 1}</td>
                  <td className="px-4 py-2 font-medium text-gray-800">{data.poolerName}</td>
                  {roundsWithScoring.map(r => (
                    <td key={r.id} className="text-right px-3 py-2 text-gray-500 tabular-nums">
                      {data.byRound.has(r.roundNumber) ? data.byRound.get(r.roundNumber)!.toFixed(1) : '—'}
                    </td>
                  ))}
                  <td className="text-right px-4 py-2 font-bold text-blue-700 tabular-nums">{data.total.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Détail par ronde */}
      {standingsByRound.filter(x => x.standings.length > 0).map(({ round, standings }) => (
        <div key={round.id} className="bg-white rounded-lg shadow overflow-hidden">
          <div className="bg-blue-600 px-4 py-3">
            <h2 className="text-white font-semibold text-sm">{roundLabel(round.roundNumber)}</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {standings.map((s, i) => (
              <div key={s.poolerId}>
                <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 font-bold w-5">#{i + 1}</span>
                    <span className="text-sm font-semibold text-gray-800">{s.poolerName}</span>
                  </div>
                  <span className="text-sm font-bold text-blue-700 tabular-nums">{s.totalPoints.toFixed(1)} pts</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {s.players.map(p => (
                    <div key={p.playerId} className="flex items-center gap-2 px-6 py-1.5 text-xs text-gray-600">
                      <span className={`font-bold w-4 ${p.positionSlot === 'F' ? 'text-blue-500' : p.positionSlot === 'D' ? 'text-green-500' : 'text-purple-500'}`}>{p.positionSlot}</span>
                      <span className="flex-1">{p.lastName}, {p.firstName}</span>
                      <span className="text-gray-400">{p.teamCode}</span>
                      <span className="tabular-nums text-gray-500">{p.goals}B {p.assists}A</span>
                      {(p.goalieWins > 0 || p.goalieOtl > 0 || p.goalieShutouts > 0) && (
                        <span className="tabular-nums text-gray-500">{p.goalieWins}V {p.goalieOtl}DP {p.goalieShutouts}BL</span>
                      )}
                      <span className="font-semibold text-blue-600 tabular-nums w-14 text-right">{p.points.toFixed(1)} pts</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
