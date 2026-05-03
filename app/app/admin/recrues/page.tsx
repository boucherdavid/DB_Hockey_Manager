import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import BanqueRecruesManager from './BanqueRecruesManager'
import ErrorBoundary from '@/components/ErrorBoundary'

async function fetchAllRookies(supabase: Awaited<ReturnType<typeof createClient>>, draftYearCutoff: number) {
  const PAGE = 1000
  const all: any[] = []
  let offset = 0
  // Inclure : NHL rookies actuels (is_rookie) + joueurs dans la fenêtre de protection du pool (draft_year >= cutoff)
  const orFilter = `is_rookie.eq.true,draft_year.gte.${draftYearCutoff}`
  while (true) {
    const { data } = await supabase
      .from('players')
      .select('id, first_name, last_name, position, status, draft_year, draft_round, draft_overall, teams(code)')
      .or(orFilter)
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

  // Saison en premier pour calculer la fenêtre de protection du pool (5 saisons depuis le repêchage)
  const saisonResult = await supabase.from('pool_seasons').select('id, season').eq('is_active', true).eq('is_playoff', false).single()
  const saisonFin = saisonResult.data
    ? parseInt(saisonResult.data.season.split('-')[0], 10) + 1
    : new Date().getFullYear()
  const draftYearCutoff = saisonFin - 5  // ex. 2026 - 5 = 2021 pour la saison 2025-26

  const [poolersResult, rookies] = await Promise.all([
    supabase.from('poolers').select('id, name').order('name'),
    fetchAllRookies(supabase, draftYearCutoff),
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
