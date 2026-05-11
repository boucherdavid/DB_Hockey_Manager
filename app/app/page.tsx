import { createClient } from '@/lib/supabase/server'
import { buildStandings } from '@/lib/standings'
import { fmtPts, NHL_SEASON } from '@/lib/nhl-stats'
import SummaryTable from '@/components/SummaryTable'
import { getPlayoffStandingsCached } from '@/app/gestion-series/playoff-pool-actions'
import DailyRecapWidget, { type RecapPlayer, type RecapPooler } from '@/components/DailyRecapWidget'
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
  const p = (pos ?? '').split(',')[0].trim()
  if (p === 'G') return 'G'
  if (['D', 'LD', 'RD'].includes(p)) return 'D'
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
  name, saison,
}: {
  name: string | null
  saison: { season: string; pool_cap: number } | null
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
    </div>
  )
}

// ---------- points du soir séries ----------

async function fetchTodayPlayoffPts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  poolSeasonId: number,
  todayDate: string,
  playingTeams: Set<string>,
): Promise<Map<string, number>> {
  if (!todayDate || playingTeams.size === 0) return new Map()

  const [{ data: rosters }, { data: scoringRows }] = await Promise.all([
    supabase
      .from('playoff_pool_rosters')
      .select('pooler_id, player_id, is_active, players(nhl_id, position, teams(code))')
      .eq('pool_season_id', poolSeasonId)
      .eq('is_active', true),
    supabase.from('scoring_config').select('stat_key, points, points_playoffs'),
  ])

  const cfg: Record<string, number> = {}
  for (const row of scoringRows ?? []) cfg[row.stat_key] = row.points_playoffs ?? row.points

  // Joueurs actifs dont l'équipe joue ce soir
  const playerMap = new Map<number, { poolerIds: string[]; isGoalie: boolean }>()
  for (const r of rosters ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const player = (r as any).players
    const nhlId: number | null = player?.nhl_id
    const teamCode: string | null = player?.teams?.code
    if (!nhlId || !teamCode || !playingTeams.has(teamCode)) continue
    const isGoalie = (player?.position ?? '').toUpperCase() === 'G'
    if (!playerMap.has(nhlId)) playerMap.set(nhlId, { poolerIds: [], isGoalie })
    playerMap.get(nhlId)!.poolerIds.push(r.pooler_id)
  }

  if (playerMap.size === 0) return new Map()

  // Game logs playoff en parallèle, filtrés à la date du jour
  const results = await Promise.all(
    [...playerMap.entries()].map(async ([nhlId, { isGoalie }]) => {
      try {
        const res = await fetch(
          `https://api-web.nhle.com/v1/player/${nhlId}/game-log/${NHL_SEASON}/3`,
          { next: { revalidate: 300 } },
        )
        if (!res.ok) return { nhlId, isGoalie, pts: 0 }
        const data = await res.json()
        const todayGames = ((data.gameLog ?? []) as Record<string, unknown>[]).filter(
          g => g.gameDate === todayDate,
        )
        let pts = 0
        for (const g of todayGames) {
          if (isGoalie) {
            const wins = g.decision === 'W' ? 1 : 0
            const otl  = g.decision === 'O' ? 1 : 0
            const so   = typeof g.shutouts === 'number' ? g.shutouts : 0
            pts += wins * (cfg.goalie_win ?? 2) + otl * (cfg.goalie_otl ?? 1) + so * (cfg.goalie_shutout ?? 2)
          } else {
            const goals   = typeof g.goals   === 'number' ? g.goals   : 0
            const assists = typeof g.assists === 'number' ? g.assists : 0
            pts += goals * (cfg.goal ?? 1) + assists * (cfg.assist ?? 1)
          }
        }
        return { nhlId, isGoalie, pts }
      } catch {
        return { nhlId, isGoalie: false, pts: 0 }
      }
    }),
  )

  const poolerPts = new Map<string, number>()
  for (const { nhlId, pts } of results) {
    if (pts === 0) continue
    for (const poolerId of playerMap.get(nhlId)!.poolerIds) {
      poolerPts.set(poolerId, (poolerPts.get(poolerId) ?? 0) + pts)
    }
  }
  return poolerPts
}

// ---------- récap de la soirée précédente ----------

async function fetchYesterdayPlayoffRecap(
  supabase: Awaited<ReturnType<typeof createClient>>,
  poolSeasonId: number,
): Promise<{ date: string; poolers: RecapPooler[] }> {
  try {
    const now = new Date()
    const yesterdayET = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Toronto',
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date(now.getTime() - 24 * 60 * 60 * 1000))

    const schedRes = await fetch(
      `https://api-web.nhle.com/v1/schedule/${yesterdayET}`,
      { next: { revalidate: 3600 } },
    )
    if (!schedRes.ok) return { date: yesterdayET, poolers: [] }
    const schedData = await schedRes.json()
    const dayEntry = (schedData.gameWeek ?? []).find((d: { date: string }) => d.date === yesterdayET)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const yesterdayTeams = new Set<string>((dayEntry?.games ?? []).flatMap((g: any) => [g.awayTeam?.abbrev, g.homeTeam?.abbrev]).filter(Boolean))
    if (yesterdayTeams.size === 0) return { date: yesterdayET, poolers: [] }

    const [{ data: rosters }, { data: poolerRows }, { data: scoringRows }] = await Promise.all([
      supabase
        .from('playoff_pool_rosters')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .select('pooler_id, position_slot, players(nhl_id, position, first_name, last_name, teams(code))' as any)
        .eq('pool_season_id', poolSeasonId)
        .eq('is_active', true),
      supabase.from('poolers').select('id, name'),
      supabase.from('scoring_config').select('stat_key, points, points_playoffs'),
    ])

    const cfg: Record<string, number> = {}
    for (const row of scoringRows ?? []) cfg[row.stat_key] = row.points_playoffs ?? row.points
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const poolerNames = new Map((poolerRows ?? []).map((p: any) => [p.id, p.name]))

    type PlayerInfo = {
      firstName: string; lastName: string; teamCode: string
      isGoalie: boolean
      entries: { poolerId: string; positionSlot: string }[]
    }
    const playerMap = new Map<number, PlayerInfo>()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const r of (rosters ?? []) as any[]) {
      const nhlId: number | null = r.players?.nhl_id
      const teamCode: string | null = r.players?.teams?.code
      if (!nhlId || !teamCode || !yesterdayTeams.has(teamCode)) continue
      if (!playerMap.has(nhlId)) {
        playerMap.set(nhlId, {
          firstName: r.players?.first_name ?? '',
          lastName: r.players?.last_name ?? '',
          teamCode,
          isGoalie: (r.players?.position ?? '').toUpperCase() === 'G',
          entries: [],
        })
      }
      playerMap.get(nhlId)!.entries.push({ poolerId: r.pooler_id, positionSlot: r.position_slot })
    }
    if (playerMap.size === 0) return { date: yesterdayET, poolers: [] }

    const playerStats = await Promise.all(
      [...playerMap.entries()].map(async ([nhlId, info]) => {
        try {
          const res = await fetch(
            `https://api-web.nhle.com/v1/player/${nhlId}/game-log/${NHL_SEASON}/3`,
            { next: { revalidate: 3600 } },
          )
          if (!res.ok) return { nhlId, info, goals: 0, assists: 0, wins: 0, otl: 0, so: 0, pts: 0 }
          const data = await res.json()
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const games = ((data.gameLog ?? []) as any[]).filter(g => g.gameDate === yesterdayET)
          let goals = 0, assists = 0, wins = 0, otl = 0, so = 0
          for (const g of games) {
            if (info.isGoalie) {
              wins += g.decision === 'W' ? 1 : 0
              otl += g.decision === 'O' ? 1 : 0
              so += typeof g.shutouts === 'number' ? g.shutouts : 0
            } else {
              goals += typeof g.goals === 'number' ? g.goals : 0
              assists += typeof g.assists === 'number' ? g.assists : 0
            }
          }
          const pts = goals * (cfg.goal ?? 1) + assists * (cfg.assist ?? 1)
            + wins * (cfg.goalie_win ?? 2) + otl * (cfg.goalie_otl ?? 1) + so * (cfg.goalie_shutout ?? 0)
          return { nhlId, info, goals, assists, wins, otl, so, pts }
        } catch {
          return { nhlId, info, goals: 0, assists: 0, wins: 0, otl: 0, so: 0, pts: 0 }
        }
      }),
    )

    const poolerData = new Map<string, { pts: number; players: RecapPlayer[] }>()
    for (const { info, goals, assists, wins, otl, so, pts } of playerStats) {
      if (pts === 0) continue
      for (const { poolerId, positionSlot } of info.entries) {
        if (!poolerData.has(poolerId)) poolerData.set(poolerId, { pts: 0, players: [] })
        const entry = poolerData.get(poolerId)!
        entry.pts += pts
        entry.players.push({
          firstName: info.firstName,
          lastName: info.lastName,
          teamCode: info.teamCode,
          positionSlot,
          goals, assists,
          goalieWins: wins,
          goalieOtl: otl,
          goalieShutouts: so,
          pts,
        })
      }
    }
    if (poolerData.size === 0) return { date: yesterdayET, poolers: [] }

    const poolers = [...poolerData.entries()]
      .map(([poolerId, { pts, players }]) => ({
        poolerId,
        poolerName: poolerNames.get(poolerId) ?? poolerId,
        pts,
        players: players.sort((a, b) => b.pts - a.pts),
      }))
      .sort((a, b) => b.pts - a.pts)

    return { date: yesterdayET, poolers }
  } catch {
    return { date: '', poolers: [] }
  }
}

// ---------- joueurs en action séries ----------

async function fetchTodaySeriesActivity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  poolSeasonId: number,
  playingTeams: Set<string>,
  myId: string | null,
): Promise<PoolerActivity[]> {
  const [{ data: rosters }, { data: poolerRows }] = await Promise.all([
    supabase
      .from('playoff_pool_rosters')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .select('pooler_id, players(position, teams(code))' as any)
      .eq('pool_season_id', poolSeasonId)
      .eq('is_active', true),
    supabase.from('poolers').select('id, name'),
  ])

  const poolerNames = new Map((poolerRows ?? []).map((p: any) => [p.id, p.name]))
  const activityMap = new Map<string, { count: number; players: { position: string }[] }>()

  for (const r of (rosters ?? []) as any[]) {
    if (!activityMap.has(r.pooler_id)) activityMap.set(r.pooler_id, { count: 0, players: [] })
    const teamCode: string | null = r.players?.teams?.code ?? null
    if (!teamCode || !playingTeams.has(teamCode)) continue
    const entry = activityMap.get(r.pooler_id)!
    entry.count++
    entry.players.push({ position: r.players?.position ?? '' })
  }

  return [...activityMap.entries()]
    .map(([poolerId, { count, players }]) => ({
      poolerId,
      poolerName: poolerNames.get(poolerId) ?? poolerId,
      count,
      detail: fmtDetail(players),
      isMe: poolerId === myId,
    }))
    .sort((a, b) => b.count - a.count || a.poolerName.localeCompare(b.poolerName))
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

  // Classement séries depuis le cache BD + points du soir + joueurs en action séries + récap d'hier
  let playoffStandings: { poolerId: string; poolerName: string; totalPoints: number; todayPts: number }[] = []
  let activity: PoolerActivity[]
  let dailyRecap: { date: string; poolers: RecapPooler[] } = { date: '', poolers: [] }

  if (seriesSaison) {
    const [cached, todayMap, seriesActivity, recap] = await Promise.all([
      getPlayoffStandingsCached(seriesSaison.id),
      fetchTodayPlayoffPts(supabase, seriesSaison.id, todayDate, playingTeams),
      fetchTodaySeriesActivity(supabase, seriesSaison.id, playingTeams, me?.id ?? null),
      fetchYesterdayPlayoffRecap(supabase, seriesSaison.id),
    ])
    playoffStandings = cached.map(s => ({
      poolerId:    s.poolerId,
      poolerName:  s.poolerName,
      totalPoints: s.totalPoints,
      todayPts:    todayMap.get(s.poolerId) ?? 0,
    }))
    activity = seriesActivity
    dailyRecap = recap
  } else {
    activity = standings.map(pooler => {
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
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <Header name={me?.name ?? null} saison={saison} />

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
                        {hasGames && <th className="px-3 py-2 text-orange-400">Ce soir</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {playoffStandings.map((pooler, i) => (
                        <tr key={pooler.poolerId} className="hover:bg-gray-50">
                          <td className={`px-4 py-2.5 font-bold text-center ${RANK_COLOR[i] ?? 'text-gray-500'}`}>{i + 1}</td>
                          <td className="px-4 py-2.5 font-semibold text-gray-800">{pooler.poolerName}</td>
                          <td className="px-2 py-2.5 text-center font-bold text-blue-600">{fmtPts(pooler.totalPoints)}</td>
                          {hasGames && (
                            <td className="px-3 py-2.5 text-center font-semibold text-orange-500">
                              {pooler.todayPts > 0 ? `+${pooler.todayPts}` : <span className="text-gray-300">—</span>}
                            </td>
                          )}
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

          {/* Classement Pool Saison — masqué quand les séries sont actives */}
          {!seriesSaison && (
            standings.length > 0 ? (
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
            )
          )}
        </div>

        <div className="space-y-4">
          <ScheduleList todayDate={todayDate} games={todayGames} />
          <ActivityTable activity={activity} todayDate={todayDate} hasGames={hasGames} />
          <DailyRecapWidget date={dailyRecap.date} poolers={dailyRecap.poolers} />
        </div>
      </div>
    </div>
  )
}
