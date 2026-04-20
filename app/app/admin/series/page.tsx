import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SeriesAdmin, { type PicksCount } from './SeriesAdmin'

export const metadata = { title: 'Admin — Pool des séries' }
export const dynamic = 'force-dynamic'

export default async function AdminSeriesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: pooler } = await supabase
    .from('poolers')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  if (!pooler?.is_admin) redirect('/')

  const [{ data: seasons }, { count: totalPoolers }, { data: rawPicks }] = await Promise.all([
    supabase
      .from('playoff_seasons')
      .select('id, season, current_round, is_active, cap_per_round, scoring_start_at')
      .order('season', { ascending: false }),
    supabase.from('poolers').select('*', { count: 'exact', head: true }),
    supabase
      .from('playoff_rosters')
      .select('playoff_season_id, pooler_id')
      .eq('is_active', true),
  ])

  // Compter les poolers distincts par saison
  const picksBySeasonMap = new Map<number, Set<string>>()
  for (const row of rawPicks ?? []) {
    if (!picksBySeasonMap.has(row.playoff_season_id)) {
      picksBySeasonMap.set(row.playoff_season_id, new Set())
    }
    picksBySeasonMap.get(row.playoff_season_id)!.add(row.pooler_id)
  }

  const picksCounts: PicksCount[] = Array.from(picksBySeasonMap.entries()).map(([id, poolerSet]) => ({
    playoff_season_id: id,
    pooler_count: poolerSet.size,
    total_poolers: totalPoolers ?? 0,
  }))

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Pool des séries</h1>
      <SeriesAdmin seasons={seasons ?? []} picksCounts={picksCounts} />
    </div>
  )
}
