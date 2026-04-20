import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SeriesAdmin from './SeriesAdmin'

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

  const { data: seasons } = await supabase
    .from('playoff_seasons')
    .select('id, season, current_round, is_active, cap_per_round')
    .order('season', { ascending: false })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Pool des séries</h1>
      <SeriesAdmin seasons={seasons ?? []} />
    </div>
  )
}
