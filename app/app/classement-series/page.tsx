import {
  getPlayoffPoolSaisonAction,
  getPlayoffPoolStandingsAction,
} from '@/app/gestion-series/playoff-pool-actions'
import ClassementSeriesTable from './ClassementSeriesTable'

export const metadata = { title: 'Classement — Pool des séries' }
export const dynamic = 'force-dynamic'

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

      {standings.length === 0 ? (
        <p className="text-gray-500 text-sm">
          Aucun alignement complet soumis pour l&apos;instant.
        </p>
      ) : (
        <ClassementSeriesTable standings={standings} />
      )}
    </div>
  )
}
