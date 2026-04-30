'use server'

export type NhlSeasonTotal = {
  season: number
  gameTypeId: number
  leagueAbbrev: string
  teamName: { default: string }
  gamesPlayed: number
  goals?: number
  assists?: number
  wins?: number
  losses?: number
  otLosses?: number
  shutouts?: number
  savePct?: number
  goalsAgainstAvg?: number
  gamesStarted?: number
}

export type NhlPlayerLanding = {
  playerId: number
  firstName: { default: string }
  lastName: { default: string }
  headshot: string
  position: string
  sweaterNumber?: number
  currentTeamAbbrev?: string
  birthDate?: string
  birthCity?: { default: string }
  birthCountry?: string
  heightInInches?: number
  weightInPounds?: number
  seasonTotals: NhlSeasonTotal[]
}

export async function fetchPlayerLanding(nhlId: number): Promise<NhlPlayerLanding | null> {
  try {
    const res = await fetch(
      `https://api-web.nhle.com/v1/player/${nhlId}/landing`,
      { next: { revalidate: 3600 } },
    )
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}
