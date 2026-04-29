'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import TeamBadge from '@/components/TeamBadge'
import type { DaySchedule, Game, OrgPlayer } from './page'

type RosterPlayer = { name: string; position: string; teamCode: string }
type Tab = 'matchs' | 'analyse'

function addDays(isoDate: string, n: number): string {
  const d = new Date(isoDate + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function fmtTime(utcStr: string) {
  if (!utcStr) return ''
  try {
    return new Intl.DateTimeFormat('fr-CA', {
      timeZone: 'America/Toronto',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(new Date(utcStr)).replace(':', 'h') + ' ET'
  } catch { return '' }
}

function fmtDayHeader(isoDate: string) {
  try {
    return new Intl.DateTimeFormat('fr-CA', {
      timeZone: 'America/Toronto',
      weekday: 'long', day: 'numeric', month: 'long',
    }).format(new Date(isoDate + 'T12:00:00'))
  } catch { return isoDate }
}

function fmtShortDate(isoDate: string) {
  try {
    return new Intl.DateTimeFormat('fr-CA', {
      timeZone: 'America/Toronto',
      day: 'numeric', month: 'short',
    }).format(new Date(isoDate + 'T12:00:00'))
  } catch { return isoDate }
}

// ─── GameCard ─────────────────────────────────────────────────────────────────

function GameCard({ game, myPlayers }: { game: Game; myPlayers: RosterPlayer[] }) {
  const isFinal = ['FINAL', 'OFF'].includes(game.gameState)
  const isLive  = ['LIVE', 'CRIT'].includes(game.gameState)
  const isFut   = !isFinal && !isLive

  return (
    <div className={`bg-white rounded-lg border px-4 py-3 flex items-center gap-3 ${isLive ? 'border-green-400 bg-green-50' : 'border-gray-200'}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <TeamBadge code={game.awayAbbrev} />
          <span className="text-xs text-gray-400">@</span>
          <TeamBadge code={game.homeAbbrev} />
          {game.gameType === 3 && (
            <span className="text-xs bg-purple-100 text-purple-700 rounded px-1.5 py-0.5 font-medium">SÉR</span>
          )}
        </div>
        {myPlayers.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {myPlayers.map(p => (
              <span key={p.name} title={p.name}
                className="inline-block text-xs bg-blue-100 text-blue-700 rounded px-1.5 py-0.5">
                {p.name.split(', ')[0]} <span className="text-blue-400">{p.position}</span>
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="text-right shrink-0">
        {isFinal && game.awayScore !== null && (
          <div className="font-bold text-gray-800 tabular-nums">{game.awayScore} – {game.homeScore}</div>
        )}
        {isLive && game.awayScore !== null && (
          <div className="font-bold text-green-700 tabular-nums">{game.awayScore} – {game.homeScore}</div>
        )}
        {isFut && (
          <div className="text-sm text-gray-500">{fmtTime(game.startTimeUTC)}</div>
        )}
        <div className={`text-xs mt-0.5 ${isLive ? 'text-green-600 font-medium' : 'text-gray-400'}`}>
          {isLive ? '● En cours' : isFinal ? 'Final' : ''}
        </div>
      </div>
    </div>
  )
}

// ─── AnalyseTab ───────────────────────────────────────────────────────────────

const TYPE_BADGE: Record<string, string> = {
  reserviste: 'RÉS',
  recrue: 'REC',
}

const TYPE_LABEL: Record<string, string> = {
  actif: 'Actifs',
  reserviste: 'Réservistes',
  recrue: 'Recrues',
}

const HORIZON_OPTIONS = [2, 3, 4, 5, 6, 7]

function AnalyseTab({
  allOrgPlayers,
  schedule7,
  today,
}: {
  allOrgPlayers: OrgPlayer[]
  schedule7: DaySchedule[]
  today: string
}) {
  const [horizon, setHorizon] = useState(7)
  const [typeFilter, setTypeFilter] = useState<'all' | 'actif' | 'reserviste' | 'recrue'>('all')

  const endDate = addDays(today, horizon - 1)

  const gamesPerTeam = useMemo(() => {
    const limitStr = addDays(today, horizon)
    const counts: Record<string, number> = {}
    for (const day of schedule7) {
      if (day.date >= today && day.date < limitStr) {
        for (const g of day.games) {
          counts[g.awayAbbrev] = (counts[g.awayAbbrev] ?? 0) + 1
          counts[g.homeAbbrev] = (counts[g.homeAbbrev] ?? 0) + 1
        }
      }
    }
    return counts
  }, [schedule7, horizon, today])

  const players = useMemo(() => {
    const filtered = typeFilter === 'all'
      ? allOrgPlayers
      : allOrgPlayers.filter(p => p.playerType === typeFilter)
    return filtered
      .map(p => ({ ...p, games: gamesPerTeam[p.teamCode] ?? 0 }))
      .sort((a, b) => b.games - a.games || a.name.localeCompare(b.name))
  }, [allOrgPlayers, gamesPerTeam, typeFilter])

  const btnClass = (active: boolean) =>
    `px-3 py-1.5 text-sm font-medium rounded border transition-colors ${
      active
        ? 'bg-blue-600 text-white border-blue-600'
        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
    }`

  if (allOrgPlayers.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400 text-sm">
        Connectez-vous pour accéder à l&apos;analyse de votre organisation.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Horizon selector */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-gray-600 font-medium">Horizon :</span>
        <div className="flex gap-1">
          {HORIZON_OPTIONS.map(h => (
            <button key={h} onClick={() => setHorizon(h)} className={btnClass(horizon === h)}>
              {h}J
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-400 capitalize">
          {fmtShortDate(today)} – {fmtShortDate(endDate)}
        </span>
      </div>

      {/* Type filter */}
      <div className="flex flex-wrap gap-2">
        {(['all', 'actif', 'reserviste', 'recrue'] as const).map(t => (
          <button key={t} onClick={() => setTypeFilter(t)} className={btnClass(typeFilter === t)}>
            {t === 'all' ? 'Tous' : TYPE_LABEL[t]}
          </button>
        ))}
      </div>

      {/* Player grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {players.map(p => (
          <div key={p.name}
            className={`flex items-center gap-2 bg-white rounded-lg border px-3 py-2.5 ${
              p.games === 0 ? 'border-gray-200 opacity-60' : 'border-gray-200'
            }`}>
            <TeamBadge code={p.teamCode} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-gray-800 truncate">{p.name.split(', ')[0]}</div>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-xs text-gray-400">{p.position}</span>
                {TYPE_BADGE[p.playerType] && (
                  <span className="text-xs bg-gray-100 text-gray-500 rounded px-1">
                    {TYPE_BADGE[p.playerType]}
                  </span>
                )}
              </div>
            </div>
            <div className={`text-xl font-bold tabular-nums leading-none ${
              p.games >= 5 ? 'text-green-600' :
              p.games >= 3 ? 'text-blue-600' :
              p.games >= 1 ? 'text-gray-600' :
              'text-gray-300'
            }`}>
              {p.games}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CalendrierClient({
  week,
  today,
  selectedDay,
  schedule7,
  myRoster,
  mySeriesRoster,
  allOrgPlayers,
  hasPlayoffSeason,
}: {
  week: DaySchedule[]
  today: string
  selectedDay: string
  schedule7: DaySchedule[]
  myRoster: RosterPlayer[]
  mySeriesRoster: RosterPlayer[]
  allOrgPlayers: OrgPlayer[]
  hasPlayoffSeason: boolean
}) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('matchs')
  const [currentDay, setCurrentDay] = useState(selectedDay)
  const [gameMode, setGameMode] = useState<'saison' | 'series'>('saison')

  const effectiveRoster = gameMode === 'series' ? mySeriesRoster : myRoster
  const myTeamCodes = useMemo(() => new Set(effectiveRoster.map(p => p.teamCode)), [effectiveRoster])

  const firstDay = week[0]?.date
  const lastDay  = week[week.length - 1]?.date

  const daySchedule = useMemo(
    () => week.find(d => d.date === currentDay) ?? { date: currentDay, games: [] },
    [week, currentDay],
  )

  const myPlayersFor = (game: Game) =>
    effectiveRoster.filter(p => p.teamCode === game.awayAbbrev || p.teamCode === game.homeAbbrev)

  const goToDay = (day: string) => {
    if (!firstDay || !lastDay || day < firstDay || day > lastDay) {
      router.push(`/calendrier?jour=${day}`)
    } else {
      setCurrentDay(day)
    }
  }

  const prevDay = addDays(currentDay, -1)
  const nextDay = addDays(currentDay, 1)
  const isToday = currentDay === today

  const myGamesCount = daySchedule.games.filter(
    g => myTeamCodes.has(g.awayAbbrev) || myTeamCodes.has(g.homeAbbrev)
  ).length

  const navBtnClass = 'px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-default'
  const tabBtnClass = (active: boolean) =>
    `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
      active
        ? 'border-blue-600 text-blue-600'
        : 'border-transparent text-gray-500 hover:text-gray-700'
    }`

  return (
    <div className="space-y-5">

      {/* Title */}
      <h1 className="text-2xl font-bold text-gray-800">Calendrier LNH</h1>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button onClick={() => setTab('matchs')} className={tabBtnClass(tab === 'matchs')}>
          Matchs
        </button>
        <button onClick={() => setTab('analyse')} className={tabBtnClass(tab === 'analyse')}>
          Analyse
        </button>
      </div>

      {tab === 'matchs' ? (
        <>
          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <button onClick={() => goToDay(prevDay)} className={navBtnClass}>←</button>
              <button onClick={() => goToDay(today)} disabled={isToday} className={navBtnClass}>
                Aujourd&apos;hui
              </button>
              <button onClick={() => goToDay(nextDay)} className={navBtnClass}>→</button>
            </div>

            <input
              type="date"
              value={currentDay}
              onChange={e => e.target.value && goToDay(e.target.value)}
              className="border border-gray-300 rounded px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {hasPlayoffSeason && (
              <div className="flex rounded overflow-hidden border border-gray-300 ml-auto">
                <button
                  onClick={() => setGameMode('saison')}
                  className={`px-3 py-1.5 text-sm transition-colors ${gameMode === 'saison' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                  Saison
                </button>
                <button
                  onClick={() => setGameMode('series')}
                  className={`px-3 py-1.5 text-sm transition-colors ${gameMode === 'series' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                  Séries
                </button>
              </div>
            )}
          </div>

          {/* Day header */}
          <div className="flex items-center gap-3">
            <h2 className={`text-lg font-semibold capitalize ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>
              {fmtDayHeader(currentDay)}
            </h2>
            {isToday && (
              <span className="text-xs bg-blue-100 text-blue-700 rounded px-2 py-0.5 font-medium">
                Aujourd&apos;hui
              </span>
            )}
            {daySchedule.games.length > 0 && (
              <span className="text-sm text-gray-400 ml-auto">
                {daySchedule.games.length} match{daySchedule.games.length > 1 ? 's' : ''}
                {myGamesCount > 0 && effectiveRoster.length > 0 && (
                  <> · <span className="text-blue-600">{myGamesCount} avec mes joueurs</span></>
                )}
              </span>
            )}
          </div>

          {/* Games */}
          {daySchedule.games.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-12">Aucun match ce jour.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {daySchedule.games.map(g => (
                <GameCard key={g.id} game={g} myPlayers={myPlayersFor(g)} />
              ))}
            </div>
          )}
        </>
      ) : (
        <AnalyseTab
          allOrgPlayers={allOrgPlayers}
          schedule7={schedule7}
          today={today}
        />
      )}
    </div>
  )
}
