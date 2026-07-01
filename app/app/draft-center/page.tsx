import { createClient } from '@/lib/supabase/server'
import DraftCenterTable from './DraftCenterTable'
import { DRAFT_SOURCES_INFOONLY } from '@/lib/draft-sources'

export const revalidate = 3600

const INFO_ONLY_KEYS = new Set(DRAFT_SOURCES_INFOONLY.map(s => s.key))

export default async function DraftCenterPage() {
  const supabase = await createClient()

  const { data: yearRow } = await supabase
    .from('draft_prospects').select('draft_year').order('draft_year', { ascending: false }).limit(1).maybeSingle()
  const draftYear = yearRow?.draft_year ?? new Date().getFullYear()

  const { data: prospects } = await supabase
    .from('draft_prospects')
    .select('id, first_name, last_name, position, team, games_played, goals, assists, points, pim, draft_prospect_rankings(source, rank, source_url)')
    .eq('draft_year', draftYear)

  const rows = (prospects ?? []).map(p => {
    const rankings = (p.draft_prospect_rankings as { source: string; rank: number; source_url: string | null }[])
    const ranked = rankings.filter(r => !INFO_ONLY_KEYS.has(r.source as never))
    const avg = ranked.length > 0 ? ranked.reduce((s, r) => s + r.rank, 0) / ranked.length : null
    return { ...p, rankings, avgRank: avg, sourceCount: ranked.length }
  }).sort((a, b) => (a.avgRank ?? 9999) - (b.avgRank ?? 9999))

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-1">DraftCenter {draftYear}</h1>
      <p className="text-sm text-gray-500 mb-6">
        Classements de prospects selon plusieurs sources — trié par rang moyen · cliquer sur un joueur pour voir les points amassés au cours de la dernière saison
      </p>
      <DraftCenterTable prospects={rows} draftYear={draftYear} />
    </div>
  )
}
