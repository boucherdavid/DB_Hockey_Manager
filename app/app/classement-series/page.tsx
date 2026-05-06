import {
  getPlayoffPoolSaisonAction,
  getPlayoffPoolStandingsAction,
} from '@/app/gestion-series/playoff-pool-actions'

export const metadata = { title: 'Classement — Pool des séries' }
export const dynamic = 'force-dynamic'

const slotColor: Record<'F' | 'D' | 'G', string> = {
  F: 'text-blue-500',
  D: 'text-green-500',
  G: 'text-purple-500',
}

export default async function ClassementSeriesPage() {
  const saison = await getPlayoffPoolSaisonAction()

  if (!saison) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Classement — Pool des séries</h1>
        <p className="text-gray-500">Aucune saison de séries active.</p>
      </div>
    )
  }

  const standings = await getPlayoffPoolStandingsAction(saison.id, true)

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Classement — Pool des séries {saison.season}</h1>
        <p className="text-xs text-gray-400 mt-1">Stats en direct — séries éliminatoires LNH</p>
      </div>

      {standings.length === 0 && (
        <p className="text-gray-500 text-sm">
          Aucun alignement complet soumis pour l&apos;instant.
        </p>
      )}

      {/* Tableau synthèse */}
      {standings.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b">
                <th className="text-left px-4 py-2 font-medium text-gray-600 w-8">#</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Pooler</th>
                <th className="text-right px-4 py-2 font-bold text-gray-700">Points</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((s, i) => (
                <tr key={s.poolerId} className={`border-b ${i === 0 ? 'bg-yellow-50' : 'hover:bg-gray-50'}`}>
                  <td className="px-4 py-2 text-gray-400 font-medium">{i + 1}</td>
                  <td className="px-4 py-2 font-medium text-gray-800">{s.poolerName}</td>
                  <td className="text-right px-4 py-2 font-bold text-blue-700 tabular-nums">
                    {s.totalPoints.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Détail par pooler */}
      {standings.map((s, i) => (
        <div key={s.poolerId} className="bg-white rounded-lg shadow overflow-hidden">
          <div className={`px-4 py-3 flex items-center justify-between ${i === 0 ? 'bg-yellow-500' : 'bg-blue-600'}`}>
            <div className="flex items-center gap-2">
              <span className="text-white font-bold text-sm">#{i + 1}</span>
              <span className="text-white font-semibold text-sm">{s.poolerName}</span>
            </div>
            <span className="text-white font-bold tabular-nums">{s.totalPoints.toFixed(1)} pts</span>
          </div>
          <div className="divide-y divide-gray-50">
            {s.players.map(p => (
              <div key={p.playerId} className="flex items-center gap-2 px-4 py-2 text-sm">
                <span className={`font-bold text-xs w-4 ${slotColor[p.positionSlot]}`}>
                  {p.positionSlot}
                </span>
                <span className={`flex-1 font-medium ${p.isActive ? 'text-gray-800' : 'text-gray-400'}`}>
                  {p.lastName}, {p.firstName}
                </span>
                <span className="text-xs text-gray-400 shrink-0">{p.teamCode}</span>
                <span className="tabular-nums text-gray-500 text-xs shrink-0">
                  {p.goals}B {p.assists}A
                </span>
                {(p.goalieWins > 0 || p.goalieOtl > 0 || p.goalieShutouts > 0) && (
                  <span className="tabular-nums text-gray-500 text-xs shrink-0">
                    {p.goalieWins}V {p.goalieOtl}DP {p.goalieShutouts}BL
                  </span>
                )}
                {!p.isActive && (
                  <span className="text-xs text-gray-300 shrink-0">retiré</span>
                )}
                <span className="font-semibold text-blue-600 tabular-nums w-16 text-right shrink-0">
                  {p.points.toFixed(1)} pts
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
