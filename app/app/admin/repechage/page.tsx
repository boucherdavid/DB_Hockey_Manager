import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DraftBoard from './DraftBoard'
import DraftOrderEditor from './DraftOrderEditor'

export default async function RepechageAdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: pooler } = await supabase
    .from('poolers')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  if (!pooler?.is_admin) redirect('/')

  const { data: saison } = await supabase
    .from('pool_seasons')
    .select('id, season')
    .eq('is_active', true)
    .single()

  if (!saison) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Repêchage des recrues</h1>
        <p className="text-gray-400">Aucune saison active.</p>
      </div>
    )
  }

  const poolDraftYear = parseInt(saison.season.split('-')[0], 10)

  const [
    { data: picksData },
    { data: usedPicksData },
    { data: rookiesData },
    { data: bankData },
    { data: orderData },
  ] = await Promise.all([
    supabase
      .from('pool_draft_picks')
      .select(`id, round, draft_order, current_owner:poolers!current_owner_id (id, name), original_owner:poolers!original_owner_id (id, name)`)
      .eq('pool_season_id', saison.id)
      .eq('is_used', false)
      .order('round'),
    supabase
      .from('pool_draft_picks')
      .select(`id, round, draft_order, current_owner:poolers!current_owner_id (id, name), original_owner:poolers!original_owner_id (id, name)`)
      .eq('pool_season_id', saison.id)
      .eq('is_used', true)
      .order('round'),
    supabase
      .from('players')
      .select(`id, first_name, last_name, position, status, draft_year, draft_round, draft_overall, teams (code)`)
      .eq('is_rookie', true)
      .not('draft_year', 'is', null)
      .not('draft_overall', 'is', null)
      .order('draft_year', { ascending: false })
      .order('draft_round', { ascending: true, nullsFirst: false })
      .order('draft_overall', { ascending: true, nullsFirst: false }),
    supabase
      .from('pooler_rosters')
      .select(`pooler_id, player_id, players (id, first_name, last_name, position, teams (code), draft_round, draft_overall)`)
      .eq('pool_season_id', saison.id)
      .eq('player_type', 'recrue')
      .eq('pool_draft_year', poolDraftYear)
      .eq('is_active', true),
    // Ordre de sélection: un pick par pooler suffit (draft_order est le même pour tous ses picks)
    supabase
      .from('pool_draft_picks')
      .select(`original_owner_id, draft_order, original_owner:poolers!original_owner_id (id, name)`)
      .eq('pool_season_id', saison.id)
      .eq('round', 1),
  ])

  // Construire la liste des poolers avec leur ordre pour l'éditeur
  const poolerOrderMap = new Map<string, { id: string; name: string; draft_order: number | null }>()
  for (const row of (orderData ?? []) as any[]) {
    const p = row.original_owner
    if (p && !poolerOrderMap.has(p.id)) {
      poolerOrderMap.set(p.id, { id: p.id, name: p.name, draft_order: row.draft_order })
    }
  }
  const poolersForEditor = Array.from(poolerOrderMap.values())

  // Map pooler_id -> joueurs repêchés cette année
  const bankByPooler = new Map<string, any[]>()
  for (const entry of (bankData ?? []) as any[]) {
    const existing = bankByPooler.get(entry.pooler_id) ?? []
    existing.push(entry.players)
    bankByPooler.set(entry.pooler_id, existing)
  }

  const inBankIds = new Set((bankData ?? []).map((r: any) => r.player_id))
  const availableRookies = (rookiesData ?? []).filter((r: any) => !inBankIds.has(r.id))

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Repêchage des recrues</h1>
        <p className="text-gray-500 text-sm mt-1">Saison {saison.season} — Repêchage {poolDraftYear}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-1">
          <DraftOrderEditor poolers={poolersForEditor} saisonId={saison.id} />
        </div>
        <div className="lg:col-span-2 flex items-start">
          <div className="bg-slate-50 rounded-lg border border-slate-200 px-4 py-3 text-xs text-slate-500 w-full">
            L'ordre de sélection détermine la position de chaque pick dans le tableau. Un pick échangé
            conserve le rang de son propriétaire d'origine. Sauvegardez l'ordre avant de commencer le repêchage.
          </div>
        </div>
      </div>

      <DraftBoard
        picks={(picksData ?? []) as any[]}
        usedPicks={(usedPicksData ?? []) as any[]}
        rookies={availableRookies as any[]}
        bankByPooler={Object.fromEntries(bankByPooler)}
        saisonId={saison.id}
        poolDraftYear={poolDraftYear}
      />
    </div>
  )
}
