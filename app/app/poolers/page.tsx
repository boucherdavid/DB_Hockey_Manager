import { createClient } from '@/lib/supabase/server'
import { fetchNhlSkaters, fetchNhlGoalies, normName } from '@/lib/nhl-stats'
import ClassementTable from '../classement/ClassementTable'
import type { PoolerStanding } from '../classement/page'

export const metadata = { title: 'Poolers — Classement' }
export const dynamic = 'force-dynamic'

export default async function PoolersPage() {
  const supabase = await createClient()

  const { data: season } = await supabase
    .from('pool_seasons')
    .select('id, season, pool_cap')
    .eq('is_active', true)
    .single()

  if (!season) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Classement</h1>
        <p className="text-gray-500">Aucune saison active.</p>
      </div>
    )
  }

  const [
    { data: rosterRows },
    { data: scoringRows },
    skatersMap,
    goaliesMap,
  ] = await Promise.all([
    supabase
      .from('pooler_rosters')
      .select('player_type, poolers(id, name), players(first_name, last_name, position)')
      .eq('pool_season_id', season.id)
      .eq('is_active', true)
      .in('player_type', ['actif', 'reserviste', 'ltir']),
    supabase.from('scoring_config').select('stat_key, points'),
    fetchNhlSkaters(),
    fetchNhlGoalies(),
  ])

  const scoring: Record<string, number> = {}
  for (const r of scoringRows ?? []) scoring[r.stat_key] = Number(r.points)
  const pts = {
    goal:       scoring.goal       ?? 1,
    assist:     scoring.assist     ?? 1,
    goalie_win: scoring.goalie_win ?? 2,
    goalie_otl: scoring.goalie_otl ?? 1,
  }

  const poolerMap = new Map<string, { name: string; players: PoolerStanding['players'] }>()

  for (const row of rosterRows ?? []) {
    const pooler = row.poolers as unknown as { id: string; name: string } | null
    const player = row.players as unknown as { first_name: string; last_name: string; position: string } | null
    if (!pooler || !player) continue

    if (!poolerMap.has(pooler.id)) poolerMap.set(pooler.id, { name: pooler.name, players: [] })

    const isGoalie = player.position === 'G'
    const key = normName(`${player.first_name} ${player.last_name}`)

    if (isGoalie) {
      const stat = goaliesMap.get(key)
      const wins = stat?.wins ?? 0
      const otl  = stat?.otLosses ?? 0
      const goals = stat?.goals ?? 0
      const assists = stat?.assists ?? 0
      poolerMap.get(pooler.id)!.players.push({
        firstName: player.first_name, lastName: player.last_name,
        position: 'G', playerType: row.player_type,
        teamAbbrev: stat?.teamAbbrev ?? '—',
        gamesPlayed: stat?.gamesStarted ?? 0,
        goals, assists, goalieWins: wins, goalieOtl: otl,
        poolPoints: wins * pts.goalie_win + otl * pts.goalie_otl + goals * pts.goal + assists * pts.assist,
      })
    } else {
      const stat = skatersMap.get(key)
      const goals = stat?.goals ?? 0
      const assists = stat?.assists ?? 0
      poolerMap.get(pooler.id)!.players.push({
        firstName: player.first_name, lastName: player.last_name,
        position: stat?.position ?? player.position,
        playerType: row.player_type,
        teamAbbrev: stat?.teamAbbrev ?? '—',
        gamesPlayed: stat?.gamesPlayed ?? 0,
        goals, assists, goalieWins: 0, goalieOtl: 0,
        poolPoints: goals * pts.goal + assists * pts.assist,
      })
    }
  }

  const standings: PoolerStanding[] = Array.from(poolerMap.entries())
    .map(([poolerId, { name, players }]) => ({
      poolerId,
      poolerName: name,
      totalPoints: players.reduce((s, p) => s + p.poolPoints, 0),
      players,
    }))
    .sort((a, b) => b.totalPoints - a.totalPoints || a.poolerName.localeCompare(b.poolerName))

  const fmt = (n: number) =>
    new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-1">Classement</h1>
      <p className="text-sm text-gray-500 mb-6">
        Saison {season.season} &middot; Cap du pool : {fmt(season.pool_cap)} &middot; Joueurs actifs, réservistes et LTIR
      </p>
      <ClassementTable standings={standings} />
    </div>
  )
}
