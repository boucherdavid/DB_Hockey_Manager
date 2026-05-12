import { fetchAllPages } from '@/lib/supabase/fetch-all'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import RosterManager from './RosterManager'
import ErrorBoundary from '@/components/ErrorBoundary'

export default async function AdminRostersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: pooler } = await supabase.from('poolers').select('is_admin').eq('id', user.id).single()
  if (!pooler?.is_admin) redirect('/')

  const saisonResult = await supabase.from('pool_seasons').select('*').eq('is_active', true).eq('is_playoff', false).single()
  const saison = saisonResult.data

  const [poolersResult, players, takenResult] = await Promise.all([
    supabase.from('poolers').select('id, name').order('name'),
    fetchAllPages(async (from, to) =>
      supabase
        .from('players')
        .select(`
          id, first_name, last_name, position, status, is_available, is_rookie,
          draft_year, draft_round, draft_overall,
          teams(code),
          player_contracts(season, cap_number)
        `)
        .order('last_name')
        .range(from, to),
    ),
    saison
      ? supabase.from('pooler_rosters')
          .select('player_id, pooler_id, poolers(name)')
          .eq('pool_season_id', saison.id)
          .eq('is_active', true)
      : Promise.resolve({ data: [] as { player_id: number; pooler_id: string; poolers: { name: string } | null }[] }),
  ])

  const poolers = poolersResult.data ?? []
  const takenRows = (takenResult.data ?? []) as { player_id: number; pooler_id: string; poolers: { name: string } | null }[]
  const allTakenPlayerIds = takenRows.map((r) => r.player_id)
  // Map player_id \u2192 nom du pooler propri\u00e9taire (pour Mode init)
  const playerOwnerMap: Record<number, string> = {}
  for (const r of takenRows) {
    playerOwnerMap[r.player_id] = (r.poolers as any)?.name ?? r.pooler_id
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin" className="text-sm text-gray-400 hover:text-gray-600">{'\u2190 Admin'}</Link>
        <h1 className="text-2xl font-bold text-gray-800 mt-1">Gestion des alignements</h1>
      </div>
      <ErrorBoundary>
        <RosterManager
          poolers={poolers}
          players={players as any}
          saison={saison}
          allTakenPlayerIds={allTakenPlayerIds}
          playerOwnerMap={playerOwnerMap}
        />
      </ErrorBoundary>
    </div>
  )
}