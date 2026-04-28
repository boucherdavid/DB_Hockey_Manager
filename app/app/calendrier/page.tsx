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
  searchParams: Promise<{ semaine?: string }>
}) {
  const { semaine } = await searchParams
  const today = todayET()
  const refDate = semaine ?? today

  // Fetch display week + two weeks for 7-day analysis in parallel
  const [week, week7a, week7b] = await Promise.all([
    fetchWeek(refDate),
    fetchWeek(today),
    fetchWeek(addDays(today, 7)),
  ])

  // Compute games-per-team in the next 7 days (today inclusive)
  const todayMs = new Date(today + 'T12:00:00').getTime()
  const limitMs = todayMs + 7 * 86400000
  const next7Days: Record<string, number> = {}
  for (const day of [...week7a, ...week7b]) {
    const dayMs = new Date(day.date + 'T12:00:00').getTime()
    if (dayMs >= todayMs && dayMs < limitMs) {
      for (const g of day.games) {
        next7Days[g.awayAbbrev] = (next7Days[g.awayAbbrev] ?? 0) + 1
        next7Days[g.homeAbbrev] = (next7Days[g.homeAbbrev] ?? 0) + 1
      }
    }
  }

  // Rosters du pooler connecté
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  type RosterPlayer = { name: string; position: string; teamCode: string }
  let myRoster: RosterPlayer[] = []
  let mySeriesRoster: RosterPlayer[] = []
  let hasPlayoffSeason = false

  if (user) {
    // Fetch les deux saisons actives en parallèle
    const [{ data: activeSeason }, { data: playoffSeason }] = await Promise.all([
      supabase.from('pool_seasons').select('id').eq('is_active', true).single(),
      supabase.from('playoff_seasons').select('id').eq('is_active', true).maybeSingle(),
    ])

    hasPlayoffSeason = !!playoffSeason

    // Fetch les deux rosters en parallèle
    const [seasonRows, seriesRows] = await Promise.all([
      activeSeason
        ? supabase
            .from('pooler_rosters')
            .select('players (first_name, last_name, position, teams (code))')
            .eq('pooler_id', user.id)
            .eq('pool_season_id', activeSeason.id)
            .eq('player_type', 'actif')
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

    const mapRow = (rows: unknown) =>
      ((rows as { data: unknown[] | null })?.data ?? []).flatMap((r: unknown) => {
        const p = (r as { players: unknown }).players as {
          first_name: string; last_name: string; position: string | null
          teams: { code: string } | null
        } | null
        if (!p?.teams?.code) return []
        return [{ name: `${p.last_name}, ${p.first_name}`, position: p.position ?? '', teamCode: p.teams.code }]
      })

    myRoster       = mapRow(seasonRows)
    mySeriesRoster = mapRow(seriesRows)
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <CalendrierClient
        week={week}
        today={today}
        refDate={refDate}
        prevDate={addDays(refDate, -7)}
        nextDate={addDays(refDate, 7)}
        myRoster={myRoster}
        mySeriesRoster={mySeriesRoster}
        hasPlayoffSeason={hasPlayoffSeason}
        next7Days={next7Days}
      />
    </div>
  )
}
