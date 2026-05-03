import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ConfigForm from './ConfigForm'
import SeasonsManager from './SeasonsManager'
import InitTabs from './InitTabs'
import ScoringConfig from './ScoringConfig'
import SeasonEndSync from './SeasonEndSync'
import { type Pick, type Pooler } from './PicksEditor'

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
    .select('id, season, nhl_cap, cap_multiplier, pool_cap, is_active, is_playoff, next_nhl_cap, delai_reactivation_jours, max_signatures_al, max_signatures_ltir, gestion_effectifs_ouvert')
    .order('season', { ascending: false })

  const activeRegSaison = (saisons ?? []).find(s => s.is_active && !s.is_playoff) ?? null
  const activePlayoffSaison = (saisons ?? []).find(s => s.is_active && s.is_playoff) ?? null

  const { data: scoringRows } = await supabase
    .from('scoring_config')
    .select('id, stat_key, label, points, points_playoffs, scope')
    .order('id')

  // Picks et poolers liés à la saison régulière uniquement
  const [{ data: poolers }, { data: rawPicks }] = await Promise.all([
    supabase.from('poolers').select('id, name').order('name'),
    activeRegSaison
      ? supabase
          .from('pool_draft_picks')
          .select('id, round, original_owner_id, current_owner_id, is_used')
          .eq('pool_season_id', activeRegSaison.id)
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

      <SeasonsManager saisons={saisons ?? []} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Pool Saison — saison régulière */}
        <div className="space-y-6">
          <h2 className="text-base font-semibold text-gray-700 border-b pb-2">Pool Saison</h2>
          {activeRegSaison
            ? <ConfigForm saison={activeRegSaison} />
            : <div className="bg-white rounded-lg shadow p-6 text-gray-400 text-sm">Aucune saison régulière active.</div>
          }
          {activeRegSaison && (
            <SeasonEndSync seasonId={activeRegSaison.id} season={activeRegSaison.season} />
          )}
        </div>

        {/* Pool Séries — saison playoff */}
        <div className="space-y-6">
          <h2 className="text-base font-semibold text-gray-700 border-b pb-2">Pool Séries</h2>
          {activePlayoffSaison
            ? <ConfigForm saison={activePlayoffSaison} />
            : <div className="bg-white rounded-lg shadow p-6 text-gray-400 text-sm">Aucune saison séries active.</div>
          }
        </div>
      </div>

      {scoringRows && scoringRows.length > 0 && (
        <ScoringConfig rows={scoringRows} />
      )}

      {activeRegSaison && (
        <InitTabs
          picks={picks}
          poolers={poolerList}
          saison={activeRegSaison}
        />
      )}
    </div>
  )
}
