import { createClient } from '@/lib/supabase/server'
import { buildStandings } from '@/lib/standings'
import ClassementTable from '../classement/ClassementTable'

export const metadata = { title: 'Classement' }
export const dynamic = 'force-dynamic'

export default async function PoolersPage() {
  const supabase = await createClient()

  const { data: season } = await supabase
    .from('pool_seasons')
    .select('id, season, pool_cap')
    .eq('is_active', true)
    .single()

  if (!season) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Classement</h1>
        <p className="text-gray-500">Aucune saison active.</p>
      </div>
    )
  }

  const standings = await buildStandings(supabase, season.id)

  const fmt = (n: number) =>
    new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-1">Classement</h1>
      <p className="text-sm text-gray-500 mb-6">
        Saison {season.season} &middot; Cap du pool : {fmt(season.pool_cap)} &middot; Joueurs actifs, réservistes et LTIR
      </p>
      <ClassementTable standings={standings} />
    </div>
  )
}
