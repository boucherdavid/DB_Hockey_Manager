import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ConfigTabsClient from './ConfigTabsClient'

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
    .select('id, season, nhl_cap, cap_multiplier, pool_cap, is_active, is_playoff, next_nhl_cap, delai_reactivation_jours, max_signatures_al, max_signatures_ltir, gestion_effectifs_ouvert, playoff_submission_deadline, playoff_max_changes, playoff_max_elim_changes, playoff_max_f, playoff_max_d, playoff_max_g, indicator_streak_chaud, indicator_streak_forme, indicator_streak_froid, indicator_streak_crise, indicator_fenetre_tendance, indicator_goalie_wins_streak, indicator_goalie_sv_pct, indicator_goalie_gaa, indicator_goalie_min_games, draft_rounds, saison_start_date, saison_end_date')
    .order('season', { ascending: false })

  const activeRegSaison = (saisons ?? []).find(s => s.is_active && !s.is_playoff) ?? null
  const activePlayoffSaison = (saisons ?? []).find(s => s.is_active && s.is_playoff) ?? null

  const { data: scoringRows } = await supabase
    .from('scoring_config')
    .select('id, stat_key, label, points, points_playoffs, scope')
    .order('id')

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Configuration du pool</h1>
      <ConfigTabsClient
        saisons={saisons ?? []}
        activeRegSaison={activeRegSaison}
        activePlayoffSaison={activePlayoffSaison}
        scoringRows={scoringRows ?? []}
      />
    </div>
  )
}
