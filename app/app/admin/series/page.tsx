import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import {
  getActivePlayoffSaisonAction,
  getAllRoundsAction,
  getEliminatedTeamsAction,
  getAllPoolersRostersAction,
} from '@/app/gestion-series/actions'
import SeriesAdminManager from './SeriesAdminManager'

export const metadata = { title: 'Pool des séries — Admin' }
export const dynamic = 'force-dynamic'

export default async function AdminSeriesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: me } = await supabase.from('poolers').select('is_admin').eq('id', user.id).single()
  if (!me?.is_admin) redirect('/admin')

  const saison = await getActivePlayoffSaisonAction()
  if (!saison) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-800">Pool des séries</h1>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-5 text-sm text-yellow-800">
          Aucune saison de séries active. Créez une saison dans{' '}
          <a href="/admin/config" className="underline">Configuration</a>{' '}
          et activez le toggle &ldquo;Saison de type séries&rdquo;.
        </div>
      </div>
    )
  }

  const [rounds, eliminations, { data: teams }] = await Promise.all([
    getAllRoundsAction(saison.id),
    getEliminatedTeamsAction(saison.id),
    supabase.from('teams').select('id, code, name').order('code'),
  ])

  const activeRound = rounds.find(r => r.isActive) ?? null

  const allRosters = activeRound
    ? await getAllPoolersRostersAction(activeRound.id, saison.id, saison.season)
    : []

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Pool des séries — {saison.season}</h1>
      <SeriesAdminManager
        saison={saison}
        rounds={rounds}
        eliminations={eliminations}
        teams={teams ?? []}
        allRosters={allRosters}
        activeRound={activeRound}
      />
    </div>
  )
}
