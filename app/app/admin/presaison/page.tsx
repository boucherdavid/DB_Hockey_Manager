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

  // Toutes les saisons régulières pour les deux usages
  const { data: saisons } = await supabase
    .from('pool_seasons')
    .select('id, season, is_active, draft_rounds')
    .eq('is_playoff', false)
    .order('season', { ascending: false })

  const allSaisons = (saisons ?? []) as { id: number; season: string; is_active: boolean; draft_rounds: number }[]
  const defaultId = allSaisons.find(s => s.is_active)?.id ?? allSaisons[0]?.id ?? null
  const activeSaison = allSaisons.find(s => s.is_active) ?? null

  if (!defaultId) {
    return (
      <div className="max-w-5xl mx-auto py-8 px-4">
        <p className="text-gray-500">Aucune saison disponible.</p>
      </div>
    )
  }

  // Poolers + tous les picks pour toutes les saisons
  const [{ data: poolers }, { data: rawPicks }] = await Promise.all([
    supabase.from('poolers').select('id, name').order('name'),
    supabase
      .from('pool_draft_picks')
      .select('id, round, original_owner_id, current_owner_id, is_used, pool_season_id')
      .in('pool_season_id', allSaisons.map(s => s.id))
      .order('round'),
  ])

  const poolerMap = new Map((poolers ?? []).map(p => [p.id, p.name]))
  const poolerList: Pooler[] = (poolers ?? []).map(p => ({ id: p.id, name: p.name }))

  // Grouper les picks par saison
  const picksBySaison: Record<number, Pick[]> = {}
  for (const p of rawPicks ?? []) {
    const pick: Pick = {
      id: p.id,
      round: p.round,
      original_owner_id: p.original_owner_id,
      original_owner_name: poolerMap.get(p.original_owner_id) ?? '?',
      current_owner_id: p.current_owner_id,
      current_owner_name: poolerMap.get(p.current_owner_id) ?? '?',
      is_used: p.is_used,
    }
    if (!picksBySaison[p.pool_season_id]) picksBySaison[p.pool_season_id] = []
    picksBySaison[p.pool_season_id].push(pick)
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Pré-saison</h1>
      <PresaisonTabs
        saisonsPresaison={allSaisons}
        defaultSaisonId={defaultId}
        saisons={allSaisons}
        poolers={poolerList}
        picksBySaison={picksBySaison}
        activeSaison={activeSaison}
      />
    </div>
  )
}
