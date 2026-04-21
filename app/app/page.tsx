import { createClient } from '@/lib/supabase/server'
import { buildStandings } from '@/lib/standings'
import { fetchNhlSkaters, fetchNhlGoalies, normName, fmtPts } from '@/lib/nhl-stats'
import SummaryTable from '@/components/SummaryTable'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

// ---------- helpers schedule ----------

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

// ---------- helper positions ----------

function posGroup(pos: string): 'A' | 'D' | 'G' {
  if (pos === 'G') return 'G'
  if (['D', 'LD', 'RD'].includes(pos)) return 'D'
  return 'A'
}

function fmtActifs(players: Array<{ position: string }>): string {
  const counts = { A: 0, D: 0, G: 0 }
  for (const p of players) counts[posGroup(p.position)]++
  return (['A', 'D', 'G'] as const)
    .filter(k => counts[k] > 0)
    .map(k => `${counts[k]}${k}`)
    .join(' · ')
}

// ---------- playoff standings (home, compact) ----------

type PlayoffRow = { poolerId: string; poolerName: string; totalPoints: number }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildPlayoffStandingsCompact(supabase: any, psId: number): Promise<PlayoffRow[]> {
  const [{ data: rosterRows }, { data: scoringRows }, skatersMap, goaliesMap] = await Promise.all([
    supabase
      .from('playoff_rosters')
      .select('pooler_id, snap_goals, snap_assists, snap_goalie_wins, snap_goalie_otl, snap_goalie_shutouts, poolers(id, name), players(first_name, last_name, position)')
      .eq('playoff_season_id', psId)
      .eq('is_active', true),
    supabase.from('scoring_config').select('stat_key, points'),
    fetchNhlSkaters(3),
    fetchNhlGoalies(3),
  ])

  const scoring: Record<string, number> = {}
  for (const r of scoringRows ?? []) scoring[r.stat_key] = Number(r.points)
  const pts = {
    goal: scoring.goal ?? 1, assist: scoring.assist ?? 1,
    goalie_win: scoring.goalie_win ?? 2, goalie_otl: scoring.goalie_otl ?? 1,
    goalie_shutout: scoring.goalie_shutout ?? 2,
  }

  const poolerMap = new Map<string, { name: string; total: number }>()
  for (const row of rosterRows ?? []) {
    const pooler = row.poolers as unknown as { id: string; name: string } | null
    const player = row.players as unknown as { first_name: string; last_name: string; position: string } | null
    if (!pooler || !player) continue
    if (!poolerMap.has(pooler.id)) poolerMap.set(pooler.id, { name: pooler.name, total: 0 })

    const key = normName(`${player.first_name} ${player.last_name}`)
    let rowPts = 0
    if (player.position === 'G') {
      const stat = goaliesMap.get(key)
      rowPts =
        Math.max(0, (stat?.wins     ?? 0) - row.snap_goalie_wins)     * pts.goalie_win +
        Math.max(0, (stat?.otLosses ?? 0) - row.snap_goalie_otl)      * pts.goalie_otl +
        Math.max(0, (stat?.shutouts ?? 0) - row.snap_goalie_shutouts) * pts.goalie_shutout +
        Math.max(0, (stat?.goals    ?? 0) - row.snap_goals)           * pts.goal +
        Math.max(0, (stat?.assists  ?? 0) - row.snap_assists)         * pts.assist
    } else {
      const stat = skatersMap.get(key)
      rowPts =
        Math.max(0, (stat?.goals   ?? 0) - row.snap_goals)   * pts.goal +
        Math.max(0, (stat?.assists ?? 0) - row.snap_assists) * pts.assist
    }
    poolerMap.get(pooler.id)!.total += rowPts
  }

  return Array.from(poolerMap.entries())
    .map(([id, { name, total }]) => ({ poolerId: id, poolerName: name, totalPoints: total }))
    .sort((a, b) => b.totalPoints - a.totalPoints || a.poolerName.localeCompare(b.poolerName))
}

const RANK_COLOR = ['text-yellow-500', 'text-gray-400', 'text-amber-600']

// ---------- sous-composants inline ----------

function ScheduleWidget({
  todayDate,
  todayGames,
  myPlayingPlayers,
}: {
  todayDate: string
  todayGames: TodayGame[]
  myPlayingPlayers: Array<{ lastName: string; position: string }>
}) {
  const actifLabel = fmtActifs(myPlayingPlayers)

  return (
    <div className="space-y-2">
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="bg-slate-700 px-5 py-3">
          <h2 className="text-white font-bold text-sm uppercase tracking-wide">
            {todayDate ? `Matchs — ${fmtDateFr(todayDate)}` : 'Matchs du jour'}
          </h2>
        </div>
        {todayGames.length === 0 ? (
          <p className="px-5 py-4 text-sm text-gray-400">Aucun match aujourd&apos;hui.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {todayGames.map(g => {
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

      {myPlayingPlayers.length > 0 ? (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm">
          <p className="font-semibold text-blue-800">
            {myPlayingPlayers.length} joueur{myPlayingPlayers.length > 1 ? 's' : ''} en action ce soir
          </p>
          <p className="text-blue-600 font-medium mt-0.5">{actifLabel}</p>
          <p className="text-blue-500 text-xs mt-0.5">
            {myPlayingPlayers.map(p => p.lastName).join(', ')}
          </p>
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-500">
          Aucun de tes joueurs actifs ne joue aujourd&apos;hui.
        </div>
      )}
    </div>
  )
}

// ---------- page ----------

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>
}) {
  const { mode: modeParam } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: saison }, { data: ps }, { data: me }] = await Promise.all([
    supabase.from('pool_seasons').select('id, season, pool_cap').eq('is_active', true).single(),
    supabase.from('playoff_seasons').select('id, season, current_round, scoring_start_at').eq('is_active', true).single(),
    user
      ? supabase.from('poolers').select('id, name').eq('id', user.id).single()
      : Promise.resolve({ data: null }),
  ])

  const hasActiveSaison = !!saison
  const hasActiveSeries = !!ps
  const defaultMode = hasActiveSeries ? 'series' : 'saison'
  const mode = modeParam === 'saison' ? 'saison' : modeParam === 'series' ? 'series' : defaultMode

  // Fetch schedule (commun aux deux modes)
  const { date: todayDate, games: todayGames } = await fetchTodayGames()
  const playingTeams = new Set(todayGames.flatMap(g => [g.awayAbbrev, g.homeAbbrev]))

  // ---- Mode Saison ----
  if (mode === 'saison') {
    const standings = saison ? await buildStandings(supabase, saison.id) : []
    const myStanding = me?.id ? standings.find(s => s.poolerId === me.id) : null
    const myPlayersToday = (myStanding?.players ?? [])
      .filter(p => p.playerType === 'actif' && playingTeams.has(p.teamAbbrev))
      .map(p => ({ lastName: p.lastName, position: p.position }))

    return (
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <Header name={me?.name ?? null} saison={saison} ps={null}
          mode="saison" hasActiveSaison={hasActiveSaison} hasActiveSeries={hasActiveSeries} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-2">
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
          <ScheduleWidget todayDate={todayDate} todayGames={todayGames} myPlayingPlayers={myPlayersToday} />
        </div>
      </div>
    )
  }

  // ---- Mode Séries ----
  const ROUND_LABEL = ['Quart de finale', 'Demi-finale', 'Finale de conférence', 'Finale de la Coupe Stanley']

  // Joueurs actifs du pooler en séries (pour le widget)
  const { data: picksRows } = me?.id && ps ? await supabase
    .from('playoff_rosters')
    .select('players(last_name, position, teams(code))')
    .eq('playoff_season_id', ps.id)
    .eq('pooler_id', me.id)
    .eq('is_active', true)
    : { data: null }

  const mySeriesPlayersToday = (picksRows ?? []).flatMap(r => {
    const p = r.players as unknown as { last_name: string; position: string; teams: { code: string } | null } | null
    if (!p || !p.teams) return []
    if (!playingTeams.has(p.teams.code)) return []
    return [{ lastName: p.last_name, position: p.position }]
  })

  // Classement séries
  let playoffStandings: PlayoffRow[] = []
  let waitingPoolers: string[] = []
  if (ps?.scoring_start_at) {
    playoffStandings = await buildPlayoffStandingsCompact(supabase, ps.id)
  } else if (ps) {
    const { data: picks } = await supabase
      .from('playoff_rosters')
      .select('pooler_id, poolers(name)')
      .eq('playoff_season_id', ps.id)
      .eq('is_active', true)
    const seen = new Set<string>()
    for (const p of picks ?? []) {
      if (!seen.has(p.pooler_id)) {
        seen.add(p.pooler_id)
        const pooler = p.poolers as unknown as { name: string } | null
        if (pooler) waitingPoolers.push(pooler.name)
      }
    }
  }

  const roundLabel = ps ? (ROUND_LABEL[ps.current_round - 1] ?? `Ronde ${ps.current_round}`) : ''

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <Header name={me?.name ?? null} saison={null} ps={ps ? { season: ps.season, current_round: ps.current_round } : null}
        mode="series" hasActiveSaison={hasActiveSaison} hasActiveSeries={hasActiveSeries} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-2">
          {/* Classement séries */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="bg-slate-800 px-5 py-3 flex items-center justify-between">
              <h2 className="text-white font-bold text-sm uppercase tracking-wide">
                Classement séries — {roundLabel}
              </h2>
            </div>
            {!ps?.scoring_start_at ? (
              <div className="px-5 py-5 space-y-3">
                <p className="text-sm text-gray-500">Le classement sera disponible une fois la comptabilisation démarrée par l&apos;admin.</p>
                {waitingPoolers.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">{waitingPoolers.length} pooler{waitingPoolers.length > 1 ? 's ont' : ' a'} soumis ses picks :</p>
                    <div className="flex flex-wrap gap-1.5">
                      {waitingPoolers.map(n => (
                        <span key={n} className="text-xs bg-green-100 text-green-700 rounded-full px-3 py-0.5">{n}</span>
                      ))}
                    </div>
                  </div>
                )}
                {me && (
                  <Link href="/series/picks" className="inline-block text-sm text-blue-600 hover:underline">
                    Soumettre / modifier mes picks →
                  </Link>
                )}
              </div>
            ) : playoffStandings.length === 0 ? (
              <p className="px-5 py-4 text-sm text-gray-400">Aucun pooler n&apos;a encore soumis ses picks.</p>
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
          </div>
          <div className="text-right">
            <Link href="/series" className="text-sm text-blue-600 hover:underline">
              Classement détaillé →
            </Link>
          </div>
        </div>

        <ScheduleWidget todayDate={todayDate} todayGames={todayGames} myPlayingPlayers={mySeriesPlayersToday} />
      </div>
    </div>
  )
}

// ---------- header partagé ----------

function Header({
  name, saison, ps, mode, hasActiveSaison, hasActiveSeries,
}: {
  name: string | null
  saison: { season: string; pool_cap: number } | null
  ps: { season: string; current_round: number } | null
  mode: 'saison' | 'series'
  hasActiveSaison: boolean
  hasActiveSeries: boolean
}) {
  const ROUND_LABEL = ['Quart de finale', 'Demi-finale', 'Finale de conférence', 'Finale de la Coupe Stanley']
  const roundLabel = ps ? (ROUND_LABEL[ps.current_round - 1] ?? `Ronde ${ps.current_round}`) : ''

  return (
    <div className="flex flex-col sm:flex-row sm:items-end gap-4">
      <div className="flex-1">
        <h1 className="text-3xl font-bold text-gray-800">
          {name ? <>Bienvenue {name} sur DB Hockey Manager</> : 'DB Hockey Manager'}
        </h1>
        <p className="text-gray-500 mt-1">
          {mode === 'saison' && saison && (
            <>
              Saison {saison.season} &middot; Cap pool :{' '}
              <span className="font-semibold text-blue-700">
                {new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(saison.pool_cap)}
              </span>
            </>
          )}
          {mode === 'series' && ps && (
            <>Séries {ps.season} &middot; {roundLabel}</>
          )}
        </p>
      </div>

      {/* Toggle mode — seulement si les deux sont actifs */}
      {hasActiveSaison && hasActiveSeries && (
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm shrink-0">
          <Link
            href={mode === 'saison' ? '/' : '/?mode=saison'}
            className={`px-4 py-2 font-medium transition-colors ${mode === 'saison' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            Saison
          </Link>
          <Link
            href={mode === 'series' ? '/' : '/?mode=series'}
            className={`px-4 py-2 font-medium transition-colors border-l border-gray-200 ${mode === 'series' ? 'bg-orange-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            Séries
          </Link>
        </div>
      )}
    </div>
  )
}
