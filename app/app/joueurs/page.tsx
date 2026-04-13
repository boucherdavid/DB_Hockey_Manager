import JoueursTable from './JoueursTable'
import { fetchAllPages } from '@/lib/supabase/fetch-all'
import { createClient } from '@/lib/supabase/server'

export type Team = {
  code: string
  name: string
} | null

export type PlayerContract = {
  season: string
  cap_number: number | null
  contract_status: string | null
}

export type PlayerRow = {
  id: string
  first_name: string
  last_name: string
  position: string | null
  age: number | null
  status: string | null
  is_available: boolean
  is_rookie: boolean
  draft_year: number | null
  draft_round: number | null
  draft_overall: number | null
  teams: Team
  player_contracts: PlayerContract[] | null
}

export default async function JoueursPage() {
  const supabase = await createClient()

  const players = await fetchAllPages<PlayerRow>(async (from, to) =>
    supabase
      .from('players')
      .select(`
        *,
        teams (code, name),
        player_contracts (season, cap_number, contract_status)
      `)
      .range(from, to),
  )

  return <JoueursTable players={players} />
}