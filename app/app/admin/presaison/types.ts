export const FREE_AGENT_THRESHOLD = 500_000

export type RosterEntry = {
  roster_id: number
  player_id: number
  player_type: string
  playerName: string
  position: string | null
  cap_number: number
}

export type PoolerCapInfo = {
  id: string
  name: string
  capUsed: number
  capSpace: number
  isCompliant: boolean
  counts: { forward: number; defense: number; goalie: number; reserviste: number }
  roster: RosterEntry[]
}
