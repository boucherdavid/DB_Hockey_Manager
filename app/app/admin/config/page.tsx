import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ConfigForm from './ConfigForm'
import SeasonsManager from './SeasonsManager'
import PicksEditor, { type Pick, type Pooler } from './PicksEditor'

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

  // Charger les poolers et les picks de la saison active
  const [{ data: poolers }, { data: rawPicks }] = await Promise.all([
    supabase.from('poolers').select('id, name').order('name'),
    activeSaison
      ? supabase
          .from('pool_draft_picks')
          .select('id, round, original_owner_id, current_owner_id, is_used')
          .eq('pool_season_id', activeSaison.id)
          .order('round')
      : Promise.resolve({ data: [] }),
  ])

  const poolerMap = new Map((poolers ?? []).map(p => [p.id, p.name]))

  const picks: Pick[] = (rawPicks ?? []).map(p => ({
    id: p.id,
    round: p.round,
    original_owner_id: p.original_owner_id,
    original_owner_name: poolerMap.get(p.original_owner_id) ?? '?',
    current_owner_id: p.current_owner_id,
    current_owner_name: poolerMap.get(p.current_owner_id) ?? '?',
    is_used: p.is_used,
  }))

  const poolerList: Pooler[] = (poolers ?? []).map(p => ({ id: p.id, name: p.name }))

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

      {activeSaison && (
        <PicksEditor
          picks={picks}
          poolers={poolerList}
          seasonLabel={activeSaison.season}
        />
      )}
    </div>
  )
}
