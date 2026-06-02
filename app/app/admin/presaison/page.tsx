import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PresaisonTabs from './PresaisonTabs'
import { type Pick, type Pooler } from '../config/PicksEditor'

export default async function PresaisonPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: me } = await supabase.from('poolers').select('is_admin').eq('id', user.id).single()
  if (!me?.is_admin) redirect('/')

  const { data: saisons } = await supabase
    .from('pool_seasons')
    .select('id, season, is_active')
    .eq('is_playoff', false)
    .order('season', { ascending: false })

  const list = (saisons ?? []) as { id: number; season: string; is_active: boolean }[]
  const defaultId = list.find(s => s.is_active)?.id ?? list[0]?.id ?? null
  const activeSaison = list.find(s => s.is_active) ?? null

  if (!defaultId) {
    return (
      <div className="max-w-5xl mx-auto py-8 px-4">
        <p className="text-gray-500">Aucune saison disponible.</p>
      </div>
    )
  }

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
    <div className="max-w-5xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Pré-saison</h1>
      <PresaisonTabs
        saisons={list}
        defaultSaisonId={defaultId}
        picks={picks}
        poolers={poolerList}
        activeSaison={activeSaison}
      />
    </div>
  )
}
