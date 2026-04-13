import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import BanqueRecruesManager from './BanqueRecruesManager'
import ErrorBoundary from '@/components/ErrorBoundary'

async function fetchAllRookies(supabase: Awaited<ReturnType<typeof createClient>>) {
  const PAGE = 1000
  const all: any[] = []
  let offset = 0
  while (true) {
    const { data } = await supabase
      .from('players')
      .select('id, first_name, last_name, position, status, draft_year, draft_round, draft_overall, teams(code)')
      .eq('is_rookie', true)
      .range(offset, offset + PAGE - 1)
    all.push(...(data ?? []))
    if ((data ?? []).length < PAGE) break
    offset += PAGE
  }
  return all
}

export default async function AdminRecruesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: pooler } = await supabase.from('poolers').select('is_admin').eq('id', user.id).single()
  if (!pooler?.is_admin) redirect('/')

  const [poolersResult, rookies, saisonResult] = await Promise.all([
    supabase.from('poolers').select('id, name').order('name'),
    fetchAllRookies(supabase),
    supabase.from('pool_seasons').select('id, season').eq('is_active', true).single(),
  ])

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin" className="text-sm text-gray-400 hover:text-gray-600">{'\u2190 Admin'}</Link>
        <h1 className="text-2xl font-bold text-gray-800 mt-1">Banque de recrues</h1>
        <p className="text-gray-500 text-sm mt-1">
          {'Assigner des recrues \u00e0 la banque de recrues de chaque pooler. '}
          {'La banque de recrues ne compte pas dans la masse salariale.'}
        </p>
      </div>
      <ErrorBoundary>
        <BanqueRecruesManager
          poolers={poolersResult.data ?? []}
          rookies={rookies as any}
          saison={saisonResult.data ?? null}
        />
      </ErrorBoundary>
    </div>
  )
}
