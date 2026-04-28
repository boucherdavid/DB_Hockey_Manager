'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import TeamBadge from '@/components/TeamBadge'
import { fetchTeamSeasonSchedule } from './actions'
import type { SeasonGame } from './actions'
import type { DaySchedule, Game } from './page'

// All 32 NHL team abbreviations
const NHL_TEAMS = [
  'ANA', 'BOS', 'BUF', 'CAR', 'CBJ', 'CGY', 'CHI', 'COL', 'DAL', 'DET',
  'EDM', 'FLA', 'LAK', 'MIN', 'MTL', 'NJD', 'NSH', 'NYI', 'NYR', 'OTT',
  'PHI', 'PIT', 'SEA', 'SJS', 'STL', 'TBL', 'TOR', 'UTA', 'VAN', 'VGK',
  'WSH', 'WPG',
]

type RosterPlayer = { name: string; position: string; teamCode: string }

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

function fmtMonthYear(yearMonth: string) {
  try {
    return new Intl.DateTimeFormat('fr-CA', {
      timeZone: 'America/Toronto',
      month: 'long', year: 'numeric',
    }).format(new Date(yearMonth + '-15T12:00:00'))
  } catch { return yearMonth }
}

// ─── GameCard ────────────────────────────────────────────────────────────────

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

// ─── AnalyseSection ──────────────────────────────────────────────────────────

function AnalyseSection({
  myRoster,
  next7Days,
  today,
}: {
  myRoster: RosterPlayer[]
  next7Days: Record<string, number>
  today: string
}) {
  const endDate = (() => {
    const d = new Date(today + 'T12:00:00')
    d.setDate(d.getDate() + 6)
    return d.toISOString().slice(0, 10)
  })()

  const players = myRoster
    .map(p => ({ ...p, games: next7Days[p.teamCode] ?? 0 }))
    .sort((a, b) => b.games - a.games || a.name.localeCompare(b.name))

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-blue-800 mb-3">
        Mes joueurs actifs — matchs dans les 7 prochains jours
        <span className="ml-2 text-xs font-normal text-blue-500">
          ({fmtShortDate(today)} – {fmtShortDate(endDate)})
        </span>
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {players.map(p => (
          <div key={p.name}
            className={`flex items-center gap-2 bg-white rounded border px-2.5 py-2 ${p.games === 0 ? 'border-gray-200 opacity-60' : 'border-blue-200'}`}>
            <TeamBadge code={p.teamCode} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-gray-800 truncate">{p.name.split(', ')[0]}</div>
              <div className="text-xs text-gray-400">{p.position}</div>
            </div>
            <div className={`text-xl font-bold tabular-nums leading-none ${p.games >= 4 ? 'text-green-600' : p.games >= 2 ? 'text-blue-600' : p.games === 0 ? 'text-gray-300' : 'text-gray-500'}`}>
              {p.games}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── MonthlyCalendar ─────────────────────────────────────────────────────────

const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

function MonthlyCalendar({
  allGames,
  teamFilter,
  month,
  myTeamCodes,
  today,
}: {
  allGames: SeasonGame[]
  teamFilter: string
  month: string
  myTeamCodes: Set<string>
  today: string
}) {
  const [year, monthNum] = month.split('-').map(Number)

  // Build game map: date → game (one per day for this team)
  const gameMap = useMemo(() => {
    const m = new Map<string, SeasonGame>()
    for (const g of allGames) {
      if (g.awayAbbrev === teamFilter || g.homeAbbrev === teamFilter) {
        m.set(g.date, g)
      }
    }
    return m
  }, [allGames, teamFilter])

  // Build day grid (Monday-first)
  const firstDow = new Date(year, monthNum - 1, 1).getDay()
  const startOffset = (firstDow + 6) % 7 // Mon=0 … Sun=6
  const daysInMonth = new Date(year, monthNum, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[560px]">
        <div className="grid grid-cols-7 gap-px bg-gray-200 border border-gray-200 rounded-lg overflow-hidden">
          {DAYS_FR.map(d => (
            <div key={d} className="bg-gray-50 text-center text-xs font-semibold text-gray-500 py-1.5">{d}</div>
          ))}
          {cells.map((day, i) => {
            if (!day) return <div key={`e-${i}`} className="bg-white min-h-[72px]" />

            const dateStr = `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const game = gameMap.get(dateStr)
            const isHome = game?.homeAbbrev === teamFilter
            const opponent = game ? (isHome ? game.awayAbbrev : game.homeAbbrev) : null
            const isTodayCell = dateStr === today
            const isPast = dateStr < today
            const isFinal = game ? ['FINAL', 'OFF'].includes(game.gameState) : false
            const isLive  = game ? ['LIVE',  'CRIT'].includes(game.gameState) : false
            const myPlayerPlays = game
              ? myTeamCodes.has(game.awayAbbrev) || myTeamCodes.has(game.homeAbbrev)
              : false

            return (
              <div key={dateStr}
                className={[
                  'bg-white min-h-[72px] p-1.5 relative',
                  isTodayCell ? 'ring-2 ring-inset ring-blue-400' : '',
                  myPlayerPlays && game ? 'bg-blue-50' : '',
                  isLive ? 'bg-green-50' : '',
                ].join(' ')}>
                <div className={`text-xs font-semibold mb-0.5 ${isTodayCell ? 'text-blue-600' : isPast ? 'text-gray-300' : 'text-gray-500'}`}>
                  {day}
                </div>
                {game && opponent && (
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-0.5 flex-wrap">
                      {!isHome && <span className="text-xs text-gray-400 leading-none">@</span>}
                      <TeamBadge code={opponent} size="sm" />
                      {game.gameType === 3 && (
                        <span className="text-xs bg-purple-100 text-purple-700 rounded px-1 leading-tight">SÉR</span>
                      )}
                    </div>
                    {isFinal && game.awayScore !== null ? (
                      <div className="text-xs font-medium tabular-nums text-gray-600">
                        {isHome
                          ? `${game.homeScore}–${game.awayScore}`
                          : `${game.awayScore}–${game.homeScore}`}
                        {(() => {
                          const mine = isHome ? game.homeScore! : game.awayScore!
                          const opp  = isHome ? game.awayScore! : game.homeScore!
                          if (mine > opp) return <span className="ml-1 text-green-600 font-bold">V</span>
                          if (mine < opp) return <span className="ml-1 text-red-500 font-bold">D</span>
                          return null
                        })()}
                      </div>
                    ) : isLive && game.awayScore !== null ? (
                      <div className="text-xs font-bold text-green-700 tabular-nums">
                        {isHome
                          ? `${game.homeScore}–${game.awayScore}`
                          : `${game.awayScore}–${game.homeScore}`}
                        <span className="ml-1 text-green-500">●</span>
                      </div>
                    ) : (
                      <div className="text-xs text-gray-400">{fmtTime(game.startTimeUTC)}</div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function CalendrierClient({
  week,
  today,
  refDate,
  prevDate,
  nextDate,
  myRoster,
  next7Days,
}: {
  week: DaySchedule[]
  today: string
  refDate: string
  prevDate: string
  nextDate: string
  myRoster: RosterPlayer[]
  next7Days: Record<string, number>
}) {
  const router = useRouter()
  const [teamFilter, setTeamFilter] = useState('')
  const [viewMode, setViewMode] = useState<'semaine' | 'calendrier'>('semaine')
  const [seasonGames, setSeasonGames] = useState<SeasonGame[]>([])
  const [loadingCalendrier, setLoadingCalendrier] = useState(false)
  const [calendarMonth, setCalendarMonth] = useState(today.slice(0, 7))

  const myTeamCodes = useMemo(() => new Set(myRoster.map(p => p.teamCode)), [myRoster])

  // Filtered week view
  const filtered = useMemo(() =>
    week
      .map(day => ({
        ...day,
        games: day.games.filter(g =>
          !teamFilter || g.awayAbbrev === teamFilter || g.homeAbbrev === teamFilter
        ),
      }))
      .filter(day => day.games.length > 0),
  [week, teamFilter])

  const totalGames = week.reduce((s, d) => s + d.games.length, 0)
  const myGames = week.reduce((s, d) =>
    s + d.games.filter(g => myTeamCodes.has(g.awayAbbrev) || myTeamCodes.has(g.homeAbbrev)).length, 0)

  const firstDay = week[0]?.date ?? refDate
  const lastDay  = week[week.length - 1]?.date ?? refDate
  const periodeLabel = firstDay === lastDay
    ? fmtDayHeader(firstDay)
    : `${fmtShortDate(firstDay)} – ${fmtShortDate(lastDay)}`

  // Handlers
  const handleTeamFilterChange = (team: string) => {
    setTeamFilter(team)
    if (!team) {
      setViewMode('semaine')
      setSeasonGames([])
    }
  }

  const handleSwitchToCalendrier = async () => {
    if (!teamFilter) return
    if (seasonGames.length > 0) { setViewMode('calendrier'); return }
    setLoadingCalendrier(true)
    const games = await fetchTeamSeasonSchedule(teamFilter)
    setSeasonGames(games)
    setLoadingCalendrier(false)
    setViewMode('calendrier')
  }

  const prevMonth = () => {
    const [y, m] = calendarMonth.split('-').map(Number)
    const d = new Date(y, m - 2, 1)
    setCalendarMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const nextMonth = () => {
    const [y, m] = calendarMonth.split('-').map(Number)
    const d = new Date(y, m, 1)
    setCalendarMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const handleDatePick = (dateStr: string) => {
    if (!dateStr) return
    if (viewMode === 'calendrier') {
      setCalendarMonth(dateStr.slice(0, 7))
    } else {
      router.push(`/calendrier?semaine=${dateStr}`)
    }
  }

  const myPlayersFor = (game: Game) =>
    myRoster.filter(p => p.teamCode === game.awayAbbrev || p.teamCode === game.homeAbbrev)

  const navBtnClass = 'px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors'
  const viewBtnClass = (active: boolean) =>
    `px-3 py-1.5 text-sm transition-colors ${active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`

  return (
    <div className="space-y-5">

      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Calendrier LNH</h1>
        {viewMode === 'semaine' && totalGames > 0 && (
          <p className="text-sm text-gray-500 mt-0.5">
            {periodeLabel}
            {' · '}<span className="font-medium">{totalGames} match{totalGames > 1 ? 's' : ''}</span>
            {myGames > 0 && myRoster.length > 0 && (
              <> · <span className="text-blue-600 font-medium">{myGames} avec mes joueurs</span></>
            )}
          </p>
        )}
        {viewMode === 'calendrier' && (
          <p className="text-sm text-gray-500 mt-0.5 capitalize">{fmtMonthYear(calendarMonth)}</p>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Team filter */}
        <select
          value={teamFilter}
          onChange={e => handleTeamFilterChange(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Toutes les équipes</option>
          {NHL_TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        {teamFilter && (
          <button onClick={() => handleTeamFilterChange('')}
            className="text-sm text-gray-500 hover:text-gray-700">
            Effacer
          </button>
        )}

        {/* Date picker */}
        <input
          type="date"
          value={viewMode === 'calendrier' ? calendarMonth + '-01' : refDate}
          onChange={e => handleDatePick(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        {/* View toggle — only when team filter active */}
        {teamFilter && (
          <div className="flex rounded overflow-hidden border border-gray-300">
            <button
              onClick={() => setViewMode('semaine')}
              className={viewBtnClass(viewMode === 'semaine')}>
              Semaine
            </button>
            <button
              onClick={handleSwitchToCalendrier}
              disabled={loadingCalendrier}
              className={viewBtnClass(viewMode === 'calendrier')}>
              {loadingCalendrier ? 'Chargement…' : 'Calendrier'}
            </button>
          </div>
        )}

        {/* Legend */}
        {!teamFilter && myRoster.length > 0 && (
          <span className="text-xs text-gray-400">
            <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-1" />
            Badges = vos joueurs actifs
          </span>
        )}
      </div>

      {/* Navigation */}
      {viewMode === 'semaine' ? (
        <div className="flex items-center gap-2">
          <button onClick={() => router.push(`/calendrier?semaine=${prevDate}`)} className={navBtnClass}>
            ← Sem. préc.
          </button>
          <button onClick={() => router.push('/calendrier')} className={navBtnClass}>
            Aujourd&apos;hui
          </button>
          <button onClick={() => router.push(`/calendrier?semaine=${nextDate}`)} className={navBtnClass}>
            Sem. suiv. →
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className={navBtnClass}>← Mois préc.</button>
          <button onClick={() => setCalendarMonth(today.slice(0, 7))} className={navBtnClass}>
            Aujourd&apos;hui
          </button>
          <button onClick={nextMonth} className={navBtnClass}>Mois suiv. →</button>
        </div>
      )}

      {/* Analyse 7 jours */}
      {myRoster.length > 0 && (
        <AnalyseSection myRoster={myRoster} next7Days={next7Days} today={today} />
      )}

      {/* Content */}
      {viewMode === 'calendrier' ? (
        <MonthlyCalendar
          allGames={seasonGames}
          teamFilter={teamFilter}
          month={calendarMonth}
          myTeamCodes={myTeamCodes}
          today={today}
        />
      ) : (
        <>
          {filtered.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-12">
              {week.length === 0
                ? 'Aucun match cette semaine.'
                : 'Aucun match pour cette équipe cette semaine.'}
            </p>
          ) : (
            filtered.map(day => {
              const isToday = day.date === today
              return (
                <div key={day.date}>
                  <div className={`flex items-center gap-2 mb-2 pb-1 border-b ${isToday ? 'border-blue-400' : 'border-gray-200'}`}>
                    <h2 className={`text-sm font-semibold capitalize ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>
                      {fmtDayHeader(day.date)}
                    </h2>
                    {isToday && (
                      <span className="text-xs bg-blue-100 text-blue-700 rounded px-1.5 py-0.5 font-medium">
                        Aujourd&apos;hui
                      </span>
                    )}
                    <span className="text-xs text-gray-400 ml-auto">
                      {day.games.length} match{day.games.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {day.games.map(g => (
                      <GameCard key={g.id} game={g} myPlayers={myPlayersFor(g)} />
                    ))}
                  </div>
                </div>
              )
            })
          )}
        </>
      )}
    </div>
  )
}
