import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ConfigForm from './ConfigForm'
import SeasonsManager from './SeasonsManager'

export default async function AdminConfigPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: pooler } = await supabase
    .from('poolers')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  if (!pooler?.is_admin) redirect('/')

  const { data: saisons } = await supabase
    .from('pool_seasons')
    .select('id, season, nhl_cap, cap_multiplier, pool_cap, is_active')
    .order('season', { ascending: false })

  const activeSaison = (saisons ?? []).find(s => s.is_active) ?? null

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-800">Configuration du pool</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <div className="space-y-6">
          <SeasonsManager saisons={saisons ?? []} />
        </div>
        <div>
          {activeSaison
            ? <ConfigForm saison={activeSaison} />
            : <div className="bg-white rounded-lg shadow p-6 text-gray-400">Aucune saison active.</div>
          }
        </div>
      </div>
    </div>
  )
}
