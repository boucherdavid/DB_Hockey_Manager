import { createClient } from '@/lib/supabase/server'
import { buildStandings } from '@/lib/standings'
import { fmtPts } from '@/lib/nhl-stats'
import SummaryTable from '@/components/SummaryTable'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

// ---------- schedule ----------

type TodayGame = {
  id: number
  awayAbbrev: string
  homeAbbrev: string
  startTimeUTC: string
  gameState: string
}

async function fetchTodayGames(): Promise<{ date: string; games: TodayGame[] }> {
  try {
    const res = await fetch('https://api-web.nhle.com/v1/schedule/now', { next: { revalidate: 300 } })
    if (!res.ok) return { date: '', games: [] }
    const data = await res.json()
    const todayET = new Intl.DateTimeFormat('fr-CA', {
      timeZone: 'America/Toronto',
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date())
    const entry = (data.gameWeek ?? []).find((d: { date: string }) => d.date === todayET)
      ?? data.gameWeek?.[0]
    if (!entry) return { date: '', games: [] }
    return {
      date: entry.date as string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      games: (entry.games ?? []).map((g: any) => ({
        id: g.id,
        awayAbbrev: g.awayTeam?.abbrev ?? '',
        homeAbbrev: g.homeTeam?.abbrev ?? '',
        startTimeUTC: g.startTimeUTC ?? '',
        gameState: g.gameState ?? 'FUT',
      })),
    }
  } catch {
    return { date: '', games: [] }
  }
}

function fmtGameTime(utcStr: string): string {
  if (!utcStr) return ''
  try {
    return new Intl.DateTimeFormat('fr-CA', {
      timeZone: 'America/Toronto',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(new Date(utcStr)).replace(':', 'h') + ' ET'
  } catch { return '' }
}

function fmtDateFr(isoDate: string): string {
  if (!isoDate) return ''
  try {
    return new Intl.DateTimeFormat('fr-CA', {
      timeZone: 'America/Toronto',
      weekday: 'long', day: 'numeric', month: 'long',
    }).format(new Date(isoDate + 'T12:00:00'))
  } catch { return isoDate }
}

const GAME_STATE_LABEL: Record<string, string> = {
  LIVE: 'En cours', CRIT: 'En cours', FINAL: 'Terminé', OFF: 'Terminé',
}

// ---------- position helpers ----------

function posGroup(pos: string): 'A' | 'D' | 'G' {
  if (pos === 'G') return 'G'
  if (['D', 'LD', 'RD'].includes(pos)) return 'D'
  return 'A'
}

function fmtDetail(players: Array<{ position: string }>): string {
  const counts = { A: 0, D: 0, G: 0 }
  for (const p of players) counts[posGroup(p.position)]++
  return (['A', 'D', 'G'] as const)
    .filter(k => counts[k] > 0)
    .map(k => `${counts[k]}${k}`)
    .join(' · ')
}

// ---------- types activité ----------

type PoolerActivity = {
  poolerId: string
  poolerName: string
  count: number
  detail: string
  isMe: boolean
}

const RANK_COLOR = ['text-yellow-500', 'text-gray-400', 'text-amber-600']

// ---------- composants inline ----------

function ActivityTable({
  activity,
  todayDate,
  hasGames,
}: {
  activity: PoolerActivity[]
  todayDate: string
  hasGames: boolean
}) {
  if (!hasGames) return null

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="bg-slate-700 px-5 py-3">
        <h2 className="text-white font-bold text-sm uppercase tracking-wide">
          Joueurs en action — {todayDate ? fmtDateFr(todayDate) : 'ce soir'}
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-400 uppercase tracking-wide">
            <tr>
              <th className="px-4 py-2 text-left">Pooler</th>
              <th className="px-2 py-2 text-center w-12">Nb</th>
              <th className="px-4 py-2 text-left">Détail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {activity.map(p => (
              <tr key={p.poolerId} className={p.isMe ? 'bg-blue-50' : 'hover:bg-gray-50'}>
                <td className="px-4 py-2.5 font-medium text-gray-800">
                  {p.poolerName}
                  {p.isMe && <span className="ml-1.5 text-xs text-blue-500">(toi)</span>}
                </td>
                <td className="px-2 py-2.5 text-center font-bold text-gray-700">
                  {p.count > 0 ? p.count : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-2.5 text-xs font-medium text-gray-500">
                  {p.detail || <span className="text-gray-300">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ScheduleList({
  todayDate,
  games,
}: {
  todayDate: string
  games: TodayGame[]
}) {
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="bg-slate-700 px-5 py-3">
        <h2 className="text-white font-bold text-sm uppercase tracking-wide">
          {todayDate ? `Matchs — ${fmtDateFr(todayDate)}` : 'Matchs du jour'}
        </h2>
      </div>
      {games.length === 0 ? (
        <p className="px-5 py-4 text-sm text-gray-400">Aucun match aujourd&apos;hui.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {games.map(g => {
            const stateLabel = GAME_STATE_LABEL[g.gameState]
            return (
              <li key={g.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-gray-800">
                  {g.awayAbbrev} <span className="text-gray-400 font-normal">@</span> {g.homeAbbrev}
                </span>
                <span className={`text-xs shrink-0 ${stateLabel ? 'text-green-600 font-medium' : 'text-gray-400'}`}>
                  {stateLabel ?? fmtGameTime(g.startTimeUTC)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// ---------- header ----------

function Header({
  name, saison, seriesSaison,
}: {
  name: string | null
  saison: { season: string; pool_cap: number } | null
  seriesSaison: { season: string; totalPoints?: number } | null
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end gap-4">
      <div className="flex-1">
        <h1 className="text-3xl font-bold text-gray-800">
          {name ? <>Bienvenue {name} sur DB Hockey Manager</> : 'DB Hockey Manager'}
        </h1>
        <p className="text-gray-500 mt-1">
          {saison && (
            <>
              Saison {saison.season} &middot; Cap pool :{' '}
              <span className="font-semibold text-blue-700">
                {new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(saison.pool_cap)}
              </span>
            </>
          )}
        </p>
      </div>
      {seriesSaison && (
        <Link
          href="/classement-series"
          className="shrink-0 flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg px-4 py-2 text-sm text-orange-700 hover:bg-orange-100 transition-colors"
        >
          <span className="font-semibold">Pool Séries {seriesSaison.season}</span>
          <span className="text-orange-400">→</span>
        </Link>
      )}
    </div>
  )
}

// ---------- page ----------

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: saison }, { data: seriesSaison }, { data: me }] = await Promise.all([
    supabase.from('pool_seasons').select('id, season, pool_cap').eq('is_active', true).eq('is_playoff', false).single(),
    supabase.from('pool_seasons').select('id, season').eq('is_active', true).eq('is_playoff', true).maybeSingle(),
    user
      ? supabase.from('poolers').select('id, name').eq('id', user.id).single()
      : Promise.resolve({ data: null }),
  ])

  const { date: todayDate, games: todayGames } = await fetchTodayGames()
  const playingTeams = new Set(todayGames.flatMap(g => [g.awayAbbrev, g.homeAbbrev]))
  const hasGames = todayGames.length > 0

  const standings = saison ? await buildStandings(supabase, saison.id) : []

  const activity: PoolerActivity[] = standings.map(pooler => {
    const playing = pooler.players.filter(
      p => p.playerType === 'actif' && playingTeams.has(p.teamAbbrev)
    )
    return {
      poolerId: pooler.poolerId,
      poolerName: pooler.poolerName,
      count: playing.length,
      detail: fmtDetail(playing),
      isMe: me?.id === pooler.poolerId,
    }
  }).sort((a, b) => b.count - a.count || a.poolerName.localeCompare(b.poolerName))

  // Compact playoff standings for the banner (top 4)
  let playoffStandings: { poolerId: string; poolerName: string; totalPoints: number }[] = []
  if (seriesSaison) {
    const [{ data: snapshots }, { data: rosters }, { data: scoringRows }, { data: poolers }] = await Promise.all([
      supabase.from('player_stat_snapshots').select('pooler_id, player_id, snapshot_type, goals, assists, goalie_wins, goalie_otl, goalie_shutouts').eq('pool_season_id', seriesSaison.id),
      supabase.from('playoff_pool_rosters').select('pooler_id, player_id, is_active').eq('pool_season_id', seriesSaison.id),
      supabase.from('scoring_config').select('stat_key, points, points_playoffs'),
      supabase.from('poolers').select('id, name').order('name'),
    ])
    const cfg: Record<string, number> = {}
    for (const row of scoringRows ?? []) cfg[row.stat_key] = row.points_playoffs != null ? row.points_playoffs : row.points

    type SnapMap = Map<string, Map<number, { activation?: Record<string, number>; deactivation?: Record<string, number> }>>
    const snapMap: SnapMap = new Map()
    for (const s of snapshots ?? []) {
      if (!snapMap.has(s.pooler_id)) snapMap.set(s.pooler_id, new Map())
      const pm = snapMap.get(s.pooler_id)!
      if (!pm.has(s.player_id)) pm.set(s.player_id, {})
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pm.get(s.player_id)![s.snapshot_type as 'activation' | 'deactivation'] = s as any
    }
    const rosterMap = new Map<string, number[]>()
    for (const r of rosters ?? []) {
      if (!rosterMap.has(r.pooler_id)) rosterMap.set(r.pooler_id, [])
      rosterMap.get(r.pooler_id)!.push(r.player_id)
    }
    const poolerNames = new Map((poolers ?? []).map(p => [p.id, p.name]))

    playoffStandings = Array.from(rosterMap.entries()).map(([poolerId, playerIds]) => {
      const pm = snapMap.get(poolerId) ?? new Map()
      let total = 0
      const seen = new Set<number>()
      for (const pid of playerIds) {
        if (seen.has(pid)) continue
        seen.add(pid)
        const snaps = pm.get(pid) ?? {}
        const activation = snaps.activation
        const deactivation = snaps.deactivation
        if (!activation) continue
        const end = deactivation ?? activation
        total +=
          Math.max(0, (end.goals ?? 0) - (activation.goals ?? 0)) * (cfg.goal ?? 1) +
          Math.max(0, (end.assists ?? 0) - (activation.assists ?? 0)) * (cfg.assist ?? 1) +
          Math.max(0, (end.goalie_wins ?? 0) - (activation.goalie_wins ?? 0)) * (cfg.goalie_win ?? 2) +
          Math.max(0, (end.goalie_otl ?? 0) - (activation.goalie_otl ?? 0)) * (cfg.goalie_otl ?? 1)
      }
      return { poolerId, poolerName: poolerNames.get(poolerId) ?? poolerId, totalPoints: total }
    }).sort((a, b) => b.totalPoints - a.totalPoints || a.poolerName.localeCompare(b.poolerName))
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <Header name={me?.name ?? null} saison={saison} seriesSaison={seriesSaison ?? null} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-2">
          {/* Classement Pool Séries compact */}
          {seriesSaison && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="bg-slate-800 px-5 py-3 flex items-center justify-between">
                <h2 className="text-white font-bold text-sm uppercase tracking-wide">
                  Classement séries {seriesSaison.season}
                </h2>
              </div>
              {playoffStandings.length === 0 ? (
                <p className="px-5 py-4 text-sm text-gray-400">Aucun point enregistré pour l&apos;instant.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-400 uppercase tracking-wide">
                      <tr>
                        <th className="px-4 py-2 text-left w-8">#</th>
                        <th className="px-4 py-2 text-left">Pooler</th>
                        <th className="px-2 py-2 text-blue-500">PTS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {playoffStandings.map((pooler, i) => (
                        <tr key={pooler.poolerId} className="hover:bg-gray-50">
                          <td className={`px-4 py-2.5 font-bold text-center ${RANK_COLOR[i] ?? 'text-gray-500'}`}>{i + 1}</td>
                          <td className="px-4 py-2.5 font-semibold text-gray-800">{pooler.poolerName}</td>
                          <td className="px-2 py-2.5 text-center font-bold text-blue-600">{fmtPts(pooler.totalPoints)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="px-5 py-2 border-t border-gray-100 text-right">
                <Link href="/classement-series" className="text-sm text-blue-600 hover:underline">
                  Classement détaillé →
                </Link>
              </div>
            </div>
          )}

          {/* Classement Pool Saison */}
          {standings.length > 0 ? (
            <>
              <SummaryTable standings={standings} />
              <div className="text-right">
                <Link href="/classement" className="text-sm text-blue-600 hover:underline">
                  Classement détaillé →
                </Link>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-lg shadow p-6 text-gray-400 text-sm">
              Aucune donnée de classement disponible.
            </div>
          )}
        </div>

        <div className="space-y-4">
          <ScheduleList todayDate={todayDate} games={todayGames} />
          <ActivityTable activity={activity} todayDate={todayDate} hasGames={hasGames} />
        </div>
      </div>
    </div>
  )
}
