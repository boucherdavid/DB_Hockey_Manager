import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AdminTabBar } from '@/components/AdminTabBar'
import ErrorBoundary from '@/components/ErrorBoundary'
import { fetchAllPages } from '@/lib/supabase/fetch-all'
import RosterManager from '../rosters/RosterManager'
import BanqueRecruesManager from '../recrues/BanqueRecruesManager'
import DraftBoard from '../repechage/DraftBoard'
import DraftOrderEditor from '../repechage/DraftOrderEditor'
import PresaisonManager from '../presaison/PresaisonManager'
import PicksManager from '../presaison/PicksManager'
import { SaisonSelectNav } from './SaisonSelectNav'
import { type Pick, type Pooler } from '../config/PicksEditor'

export const dynamic = 'force-dynamic'

const TABS = [
  { id: 'rosters',   label: 'Rosters initiaux' },
  { id: 'recrues',   label: 'Banque de recrues' },
  { id: 'presaison', label: 'Pré-saison' },
  { id: 'choix',     label: 'Choix de repêchage' },
]

async function fetchAllRookies(
  supabase: Awaited<ReturnType<typeof createClient>>,
  draftYearCutoff: number
) {
  const PAGE = 1000
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const all: any[] = []
  let offset = 0
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

export default async function AdminInitPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; saisonId?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: me } = await supabase.from('poolers').select('is_admin').eq('id', user.id).single()
  if (!me?.is_admin) redirect('/')

  const { tab = 'rosters', saisonId } = await searchParams
  const activeTab = TABS.some(t => t.id === tab) ? tab : 'rosters'

  // ── Rosters ───────────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let poolersRosters: any[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let players: any[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let saisonRosters: any = null
  let allTakenPlayerIds: number[] = []
  let playerOwnerMap: Record<number, string> = {}
  if (activeTab === 'rosters') {
    const saisonResult = await supabase.from('pool_seasons').select('*').eq('is_active', true).eq('is_playoff', false).single()
    saisonRosters = saisonResult.data
    const [pr, pl, tr] = await Promise.all([
      supabase.from('poolers').select('id, name').order('name'),
      fetchAllPages(async (from, to) =>
        supabase
          .from('players')
          .select('id, first_name, last_name, position, status, is_available, is_rookie, draft_year, draft_round, draft_overall, teams(code), player_contracts(season, cap_number)')
          .order('last_name')
          .range(from, to),
      ),
      saisonRosters
        ? supabase.from('pooler_rosters').select('player_id, pooler_id, poolers(name)').eq('pool_season_id', saisonRosters.id).eq('is_active', true)
        : Promise.resolve({ data: [] as { player_id: number; pooler_id: string; poolers: { name: string } | null }[] }),
    ])
    poolersRosters = pr.data ?? []
    players = pl as unknown[]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const takenRows = (tr.data ?? []) as any[]
    allTakenPlayerIds = takenRows.map(r => r.player_id)
    for (const r of takenRows) {
      playerOwnerMap[r.player_id] = (r.poolers as { name?: string } | null)?.name ?? r.pooler_id
    }
  }

  // ── Recrues ───────────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let poolersRecrues: any[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rookies: any[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let saisonRecrues: any = null
  if (activeTab === 'recrues') {
    const saisonResult = await supabase.from('pool_seasons').select('id, season').eq('is_active', true).eq('is_playoff', false).single()
    saisonRecrues = saisonResult.data
    const saisonFin = saisonRecrues
      ? parseInt(saisonRecrues.season.split('-')[0], 10) + 1
      : new Date().getFullYear()
    const draftYearCutoff = saisonFin - 5
    const [pr, rk] = await Promise.all([
      supabase.from('poolers').select('id, name').order('name'),
      fetchAllRookies(supabase, draftYearCutoff),
    ])
    poolersRecrues = pr.data ?? []
    rookies = rk
  }

  // ── Repêchage ─────────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let saisonRep: any = null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let allSaisonsRep: any[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let picksData: any[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let usedPicksData: any[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let availableRookies: any[] = []
  let bankByPooler: Record<string, unknown[]> = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let poolersForEditor: any[] = []
  let poolDraftYear = 0
  if (activeTab === 'repechage') {
    const { data: allS } = await supabase
      .from('pool_seasons')
      .select('id, season, is_active')
      .eq('is_playoff', false)
      .order('season', { ascending: false })
    allSaisonsRep = allS ?? []
    const parsedId = saisonId ? parseInt(saisonId, 10) : NaN
    saisonRep = (!isNaN(parsedId) && allSaisonsRep.find(s => s.id === parsedId))
      || allSaisonsRep.find(s => s.is_active)
      || allSaisonsRep[0]
      || null
    if (saisonRep) {
      poolDraftYear = parseInt(saisonRep.season.split('-')[0], 10)
      const [pk, upk, rk, bk, od] = await Promise.all([
        supabase.from('pool_draft_picks').select('id, round, draft_order, pending_player_id, current_owner:poolers!current_owner_id(id, name), original_owner:poolers!original_owner_id(id, name)').eq('pool_season_id', saisonRep.id).eq('is_used', false).order('round'),
        supabase.from('pool_draft_picks').select('id, round, draft_order, current_owner:poolers!current_owner_id(id, name), original_owner:poolers!original_owner_id(id, name)').eq('pool_season_id', saisonRep.id).eq('is_used', true).order('round'),
        supabase.from('players').select('id, first_name, last_name, position, status, draft_year, draft_round, draft_overall, teams(code)').or(`is_rookie.eq.true,draft_year.gte.${poolDraftYear - 4}`).not('draft_year', 'is', null).not('draft_overall', 'is', null).order('draft_year', { ascending: false }).order('draft_round', { ascending: true, nullsFirst: false }).order('draft_overall', { ascending: true, nullsFirst: false }),
        supabase.from('pooler_rosters').select('pooler_id, player_id, players(id, first_name, last_name, position, teams(code), draft_round, draft_overall)').eq('pool_season_id', saisonRep.id).eq('player_type', 'recrue').eq('pool_draft_year', poolDraftYear).eq('is_active', true),
        supabase.from('pool_draft_picks').select('original_owner_id, draft_order, original_owner:poolers!original_owner_id(id, name)').eq('pool_season_id', saisonRep.id).eq('round', 1),
      ])
      picksData = (pk.data ?? []) as unknown[]
      usedPicksData = (upk.data ?? []) as unknown[]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pMap = new Map<string, any>()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const row of (od.data ?? []) as any[]) {
        const p = row.original_owner
        if (p && !pMap.has(p.id)) pMap.set(p.id, { id: p.id, name: p.name, draft_order: row.draft_order })
      }
      poolersForEditor = Array.from(pMap.values())
      const bankMap = new Map<string, unknown[]>()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const entry of (bk.data ?? []) as any[]) {
        const list = bankMap.get(entry.pooler_id) ?? []
        list.push(entry.players)
        bankMap.set(entry.pooler_id, list)
      }
      bankByPooler = Object.fromEntries(bankMap)
      const inBankIds = new Set((bk.data ?? []).map((r: { player_id: number }) => r.player_id))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      availableRookies = (rk.data ?? []).filter((r: any) => !inBankIds.has(r.id))
    }
  }

  // ── Pré-saison ────────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let saisonsPresaison: any[] = []
  let defaultPresaisonId: number | null = null
  if (activeTab === 'presaison') {
    const { data } = await supabase.from('pool_seasons').select('id, season, is_active').eq('is_playoff', false).order('season', { ascending: false })
    saisonsPresaison = (data ?? []) as { id: number; season: string; is_active: boolean }[]
    defaultPresaisonId = saisonsPresaison.find(s => s.is_active)?.id ?? saisonsPresaison[0]?.id ?? null
  }

  // ── Choix de repêchage ────────────────────────────────────────────────────
  let saisonsChoix: { id: number; season: string; is_active: boolean; draft_rounds: number }[] = []
  let poolersChoix: Pooler[] = []
  let picksBySaison: Record<number, Pick[]> = {}
  if (activeTab === 'choix') {
    const { data: sc } = await supabase.from('pool_seasons').select('id, season, is_active, draft_rounds').eq('is_playoff', false).order('season', { ascending: false })
    saisonsChoix = (sc ?? []) as { id: number; season: string; is_active: boolean; draft_rounds: number }[]
    const saisionIds = saisonsChoix.map(s => s.id)
    const [{ data: pc }, { data: rp }] = await Promise.all([
      supabase.from('poolers').select('id, name').order('name'),
      saisionIds.length > 0
        ? supabase.from('pool_draft_picks').select('id, round, original_owner_id, current_owner_id, is_used, pool_season_id').in('pool_season_id', saisionIds).order('round')
        : Promise.resolve({ data: [] }),
    ])
    poolersChoix = (pc ?? []).map(p => ({ id: p.id, name: p.name }))
    const pMap = new Map((pc ?? []).map(p => [p.id, p.name]))
    for (const p of rp ?? []) {
      const pick: Pick = {
        id: p.id, round: p.round,
        original_owner_id: p.original_owner_id,
        original_owner_name: pMap.get(p.original_owner_id) ?? '?',
        current_owner_id: p.current_owner_id,
        current_owner_name: pMap.get(p.current_owner_id) ?? '?',
        is_used: p.is_used,
      }
      if (!picksBySaison[p.pool_season_id]) picksBySaison[p.pool_season_id] = []
      picksBySaison[p.pool_season_id].push(pick)
    }
  }

  return (
    <div>
      <AdminTabBar tabs={TABS} activeTab={activeTab} basePath="/admin/init" />

      {/* ── Rosters ── */}
      {activeTab === 'rosters' && (
        <div>
          <h1 className="text-2xl font-bold text-gray-800 mb-6">Gestion des alignements</h1>
          <ErrorBoundary>
            <RosterManager
              poolers={poolersRosters}
              players={players as never}
              saison={saisonRosters}
              allTakenPlayerIds={allTakenPlayerIds}
              playerOwnerMap={playerOwnerMap}
            />
          </ErrorBoundary>
        </div>
      )}

      {/* ── Recrues ── */}
      {activeTab === 'recrues' && (
        <div>
          <h1 className="text-2xl font-bold text-gray-800 mb-1">Banque de recrues</h1>
          <p className="text-gray-500 text-sm mb-6">
            {'Assigner des recrues à la banque de chaque pooler. La banque ne compte pas dans la masse salariale.'}
          </p>
          <ErrorBoundary>
            <BanqueRecruesManager
              poolers={poolersRecrues}
              rookies={rookies as never}
              saison={saisonRecrues}
            />
          </ErrorBoundary>
        </div>
      )}

      {/* ── Repêchage ── */}
      {activeTab === 'repechage' && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">{'Repêchage des recrues'}</h1>
              {saisonRep && (
                <p className="text-gray-500 text-sm mt-1">Repêchage {poolDraftYear}</p>
              )}
            </div>
            {allSaisonsRep.length > 0 && saisonRep && (
              <SaisonSelectNav
                saisons={allSaisonsRep}
                selectedId={saisonRep.id}
                baseHref="/admin/init?tab=repechage"
              />
            )}
          </div>
          {!saisonRep
            ? <p className="text-gray-400">Aucune saison disponible.</p>
            : <>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                  <div className="lg:col-span-1">
                    <DraftOrderEditor poolers={poolersForEditor} saisonId={saisonRep.id} />
                  </div>
                  <div className="lg:col-span-2 flex items-start">
                    <div className="bg-slate-50 rounded-lg border border-slate-200 px-4 py-3 text-xs text-slate-500 w-full">
                      {"L'ordre de sélection détermine la position de chaque pick. Un pick échangé conserve le rang de son propriétaire d'origine. Sauvegardez l'ordre avant de commencer le repêchage."}
                    </div>
                  </div>
                </div>
                <DraftBoard
                  picks={picksData as never[]}
                  usedPicks={usedPicksData as never[]}
                  rookies={availableRookies as never[]}
                  bankByPooler={bankByPooler as Record<string, never[]>}
                  saisonId={saisonRep.id}
                  poolDraftYear={poolDraftYear}
                />
              </>
          }
        </div>
      )}

      {/* ── Choix de repêchage ── */}
      {activeTab === 'choix' && (
        <div className="max-w-5xl">
          <h1 className="text-2xl font-bold text-gray-800 mb-6">Choix de repêchage</h1>
          <PicksManager saisons={saisonsChoix} poolers={poolersChoix} picksBySaison={picksBySaison} />
        </div>
      )}

      {/* ── Pré-saison ── */}
      {activeTab === 'presaison' && (
        <div className="max-w-5xl">
          <h1 className="text-2xl font-bold text-gray-800 mb-6">{'Repêchage pré-saison'}</h1>
          {!defaultPresaisonId
            ? <p className="text-gray-500">Aucune saison disponible.</p>
            : <PresaisonManager saisons={saisonsPresaison} defaultSaisonId={defaultPresaisonId} />
          }
        </div>
      )}
    </div>
  )
}
