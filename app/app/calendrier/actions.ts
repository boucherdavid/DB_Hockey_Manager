'use server'

export type SeasonGame = {
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

export async function fetchTeamSeasonSchedule(abbrev: string): Promise<SeasonGame[]> {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const startYear = month >= 9 ? year : year - 1
  const season = `${startYear}${startYear + 1}`

  try {
    const res = await fetch(
      `https://api-web.nhle.com/v1/club-schedule-season/${abbrev}/${season}`,
      { next: { revalidate: 300 } },
    )
    if (!res.ok) return []
    const data = await res.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data.games ?? []).map((g: any) => ({
      id: g.id as number,
      date: g.gameDate as string,
      awayAbbrev: g.awayTeam?.abbrev ?? '',
      homeAbbrev: g.homeTeam?.abbrev ?? '',
      awayScore: g.awayTeam?.score ?? null,
      homeScore: g.homeTeam?.score ?? null,
      startTimeUTC: g.startTimeUTC ?? '',
      gameState: g.gameState ?? 'FUT',
      gameType: g.gameType ?? 2,
    }))
  } catch {
    return []
  }
}
