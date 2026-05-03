import { createClient } from '@/lib/supabase/server'
import CalendrierClient from './CalendrierClient'

export const metadata = { title: 'Calendrier LNH' }
export const dynamic = 'force-dynamic'

export type Game = {
  id: number
  date: string
  awayAbbrev: string
  homeAbbrev: string
  awayScore: number | null
  homeScore: number | null
  startTimeUTC: string
  gameState: string
  gameType: number
}

export type DaySchedule = {
  date: string
  games: Game[]
}

export type OrgPlayer = {
  name: string
  position: string
  teamCode: string
  playerType: 'actif' | 'reserviste' | 'recrue'
}

function todayET(): string {
  return new Intl.DateTimeFormat('fr-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}

function addDays(isoDate: string, n: number): string {
  const d = new Date(isoDate + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

async function fetchWeek(date: string): Promise<DaySchedule[]> {
  try {
    const res = await fetch(
      `https://api-web.nhle.com/v1/schedule/${date}`,
      { next: { revalidate: 300 } },
    )
    if (!res.ok) return []
    const data = await res.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data.gameWeek ?? []).map((day: any) => ({
      date: day.date as string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      games: (day.games ?? []).map((g: any) => ({
        id: g.id,
        date: day.date as string,
        awayAbbrev: g.awayTeam?.abbrev ?? '',
        homeAbbrev: g.homeTeam?.abbrev ?? '',
        awayScore: g.awayTeam?.score ?? null,
        homeScore: g.homeTeam?.score ?? null,
        startTimeUTC: g.startTimeUTC ?? '',
        gameState: g.gameState ?? 'FUT',
        gameType: g.gameType ?? 2,
      })),
    }))
  } catch {
    return []
  }
}

export default async function CalendrierPage({
  searchParams,
}: {
  searchParams: Promise<{ jour?: string }>
}) {
  const { jour } = await searchParams
  const today = todayET()
  const selectedDay = jour ?? today

  // Fetch week containing selected day + today's week + next week (for analysis tab)
  const [week, weekToday, weekNext] = await Promise.all([
    fetchWeek(selectedDay),
    fetchWeek(today),
    fetchWeek(addDays(today, 7)),
  ])

  // Build schedule7: days with games in the next 7 calendar days (starting today)
  const todayDate = new Date(today + 'T12:00:00')
  const limitDate = new Date(todayDate)
  limitDate.setDate(limitDate.getDate() + 7)
  const seen = new Set<string>()
  const schedule7: DaySchedule[] = []
  for (const day of [...weekToday, ...weekNext]) {
    const d = new Date(day.date + 'T12:00:00')
    if (d >= todayDate && d < limitDate && !seen.has(day.date)) {
      seen.add(day.date)
      schedule7.push(day)
    }
  }
  schedule7.sort((a, b) => a.date.localeCompare(b.date))

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let myRoster: { name: string; position: string; teamCode: string }[] = []
  let mySeriesRoster: { name: string; position: string; teamCode: string }[] = []
  let allOrgPlayers: OrgPlayer[] = []
  let hasPlayoffSeason = false

  if (user) {
    const [{ data: activeSeason }, { data: playoffSeason }] = await Promise.all([
      supabase.from('pool_seasons').select('id').eq('is_active', true).eq('is_playoff', false).single(),
      supabase.from('playoff_seasons').select('id').eq('is_active', true).maybeSingle(),
    ])

    hasPlayoffSeason = !!playoffSeason

    const [orgRows, seriesRows] = await Promise.all([
      activeSeason
        ? supabase
            .from('pooler_rosters')
            .select('player_type, players (first_name, last_name, position, teams (code))')
            .eq('pooler_id', user.id)
            .eq('pool_season_id', activeSeason.id)
            .in('player_type', ['actif', 'reserviste', 'recrue'])
            .eq('is_active', true)
        : Promise.resolve({ data: null }),
      playoffSeason
        ? supabase
            .from('playoff_rosters')
            .select('players (first_name, last_name, position, teams (code))')
            .eq('pooler_id', user.id)
            .eq('playoff_season_id', playoffSeason.id)
            .eq('is_active', true)
        : Promise.resolve({ data: null }),
    ])

    allOrgPlayers = ((orgRows as { data: unknown[] | null })?.data ?? []).flatMap((r: unknown) => {
      const row = r as { player_type: string; players: unknown }
      const p = row.players as {
        first_name: string; last_name: string; position: string | null
        teams: { code: string } | null
      } | null
      if (!p?.teams?.code) return []
      return [{
        name: `${p.last_name}, ${p.first_name}`,
        position: p.position ?? '',
        teamCode: p.teams.code,
        playerType: row.player_type as 'actif' | 'reserviste' | 'recrue',
      }]
    })

    myRoster = allOrgPlayers
      .filter(p => p.playerType === 'actif')
      .map(({ name, position, teamCode }) => ({ name, position, teamCode }))

    mySeriesRoster = ((seriesRows as { data: unknown[] | null })?.data ?? []).flatMap((r: unknown) => {
      const p = (r as { players: unknown }).players as {
        first_name: string; last_name: string; position: string | null
        teams: { code: string } | null
      } | null
      if (!p?.teams?.code) return []
      return [{ name: `${p.last_name}, ${p.first_name}`, position: p.position ?? '', teamCode: p.teams.code }]
    })
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <CalendrierClient
        week={week}
        today={today}
        selectedDay={selectedDay}
        schedule7={schedule7}
        myRoster={myRoster}
        mySeriesRoster={mySeriesRoster}
        allOrgPlayers={allOrgPlayers}
        hasPlayoffSeason={hasPlayoffSeason}
      />
    </div>
  )
}
