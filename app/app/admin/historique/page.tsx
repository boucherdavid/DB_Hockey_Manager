import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import HistoriqueManager from './HistoriqueManager'
import { getHistLogAction } from './historique-actions'

export default async function AdminHistoriquePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: pooler } = await supabase.from('poolers').select('is_admin').eq('id', user.id).single()
  if (!pooler?.is_admin) redirect('/')

  const db = createAdminClient()

  const [{ data: saison }, { data: poolers }] = await Promise.all([
    db.from('pool_seasons').select('id, season').eq('is_active', true).eq('is_playoff', false).single(),
    db.from('poolers').select('id, name').eq('is_admin', false).order('name'),
  ])

  if (!saison) {
    return (
      <div className="p-8 text-gray-500">
        Aucune saison régulière active. Activez la saison 2024-25 dans Supabase avant de continuer.
      </div>
    )
  }

  const initialLog = await getHistLogAction(saison.id)

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Historique des transactions</h1>
        <p className="text-sm text-gray-500 mt-1">
          Saison active : <span className="font-medium">{saison.season}</span> — Saisie des données historiques pour validation.
        </p>
      </div>
      <HistoriqueManager
        poolers={poolers ?? []}
        poolSeasonId={saison.id}
        initialLog={initialLog}
      />
    </div>
  )
}
