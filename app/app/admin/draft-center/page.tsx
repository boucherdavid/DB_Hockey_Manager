import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import AddProspectForm from './AddProspectForm'
import DraftProspectActions from './DraftProspectActions'
import AdminDraftYearSelect from './AdminDraftYearSelect'
import { DRAFT_SOURCES_INFOONLY } from '@/lib/draft-sources'

export const dynamic = 'force-dynamic'

const INFO_ONLY_KEYS = new Set(DRAFT_SOURCES_INFOONLY.map(s => s.key))

export default async function AdminDraftCenterPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: pooler } = await supabase.from('poolers').select('is_admin').eq('id', user.id).single()
  if (!pooler?.is_admin) redirect('/')

  const { year } = await searchParams

  const { data: yearRows } = await supabase
    .from('draft_prospects').select('draft_year').order('draft_year', { ascending: false })
  const existingYears = Array.from(new Set((yearRows ?? []).map(r => r.draft_year))) as number[]
  const latestYear = existingYears[0] ?? new Date().getFullYear()
  const parsedYear = year ? parseInt(year, 10) : NaN
  const draftYear = !isNaN(parsedYear) ? parsedYear : latestYear
  // Toujours offrir l'année suivante dans le sélecteur pour démarrer la liste du prochain repêchage
  const nextYear = latestYear + 1
  const years = Array.from(new Set([...existingYears, nextYear, draftYear])).sort((a, b) => b - a)

  const { data: prospects } = await supabase
    .from('draft_prospects')
    .select('id, first_name, last_name, position, team, draft_prospect_rankings(rank)')
    .eq('draft_year', draftYear)
    .order('last_name')

  const rows = (prospects ?? []).map(p => {
    const allRanks = (p.draft_prospect_rankings as { rank: number; source: string }[])
    const ranked = allRanks.filter(r => !INFO_ONLY_KEYS.has(r.source as never))
    const avg = ranked.length > 0 ? ranked.reduce((s, r) => s + r.rank, 0) / ranked.length : null
    return { ...p, avgRank: avg, sourceCount: ranked.length }
  }).sort((a, b) => (a.avgRank ?? 999) - (b.avgRank ?? 999))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/admin" className="text-sm text-gray-400 hover:text-gray-600">{'← Admin'}</Link>
          <h1 className="text-2xl font-bold text-gray-800 mt-1">{'Classement des prospects'} — {draftYear}</h1>
        </div>
        <AdminDraftYearSelect years={years} selectedYear={draftYear} />
      </div>

      <AddProspectForm draftYear={draftYear} />

      <div className="bg-white rounded-lg shadow overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Joueur</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Pos</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Équipe</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Rang moyen</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Sources</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(p => (
              <tr key={p.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800">{p.last_name}, {p.first_name}</td>
                <td className="px-4 py-3 text-gray-600">{p.position ?? '—'}</td>
                <td className="px-4 py-3 text-gray-600">{p.team ?? '—'}</td>
                <td className="px-4 py-3 text-right text-gray-700">{p.avgRank ? p.avgRank.toFixed(1) : '—'}</td>
                <td className="px-4 py-3 text-right text-gray-500">{p.sourceCount}</td>
                <td className="px-4 py-3 text-center">
                  <DraftProspectActions prospectId={p.id} prospectName={`${p.first_name} ${p.last_name}`} />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Aucun prospect.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
