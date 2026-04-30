'use client'

import { useState } from 'react'
import { fmtPts } from '@/lib/nhl-stats'
import type { StreakInfo } from '@/lib/streaks'

const RANK_COLOR = ['text-yellow-500', 'text-gray-400', 'text-amber-600']

export type PlayerLine = {
  firstName: string
  lastName: string
  position: string
  nhlId: number | null
  conference: string
  goals: number
  assists: number
  gwg: number
  goalieWins: number
  goalieOtl: number
  goalieShutouts: number
  poolPoints: number
}

function StreakBadge({ info }: { info: StreakInfo | undefined }) {
  if (!info || info.type === null) return null
  if (info.type === 'hot')
    return <span className="ml-1.5 text-xs font-bold text-orange-500" title={`${info.pts} pts en ${info.gp} matchs`}>▲</span>
  return <span className="ml-1.5 text-xs font-bold text-sky-500" title={`${info.pts} pts en ${info.gp} matchs`}>▼</span>
}

type Props = {
  pooler: {
    poolerId: string
    poolerName: string
    totalPoints: number
    players: PlayerLine[]
  }
  rank: number
  streaks: Record<number, StreakInfo>
}

export function PoolerSeriesCard({ pooler, rank, streaks }: Props) {
  const [expanded, setExpanded] = useState(false)

  const sortedPlayers = [...pooler.players].sort(
    (a, b) => b.poolPoints - a.poolPoints || a.lastName.localeCompare(b.lastName)
  )

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-5 py-3 border-b text-left sm:cursor-default"
        onClick={() => setExpanded(e => !e)}
        aria-expanded={expanded}
      >
        <span className={`font-bold text-lg w-7 text-center shrink-0 ${RANK_COLOR[rank] ?? 'text-gray-500'}`}>
          {rank + 1}
        </span>
        <span className="flex-1 font-semibold text-gray-800">{pooler.poolerName}</span>
        <span className="text-xl font-bold text-blue-600">{fmtPts(pooler.totalPoints)}</span>
        <span className="text-sm text-gray-400">pts</span>
        <span className="sm:hidden text-gray-400 ml-1" aria-hidden="true">{expanded ? '▲' : '▼'}</span>
      </button>

      <div className={`overflow-x-auto ${expanded ? 'block' : 'hidden'} sm:block`}>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-400 uppercase tracking-wide">
            <tr>
              <th className="px-4 py-1.5 text-left">Joueur</th>
              <th className="px-2 py-1.5">B</th>
              <th className="px-2 py-1.5">A</th>
              <th className="px-2 py-1.5 hidden sm:table-cell" title="Buts gagnants">BG</th>
              <th className="px-2 py-1.5 hidden sm:table-cell">V</th>
              <th className="px-2 py-1.5 hidden sm:table-cell">DP</th>
              <th className="px-2 py-1.5 hidden sm:table-cell">BL</th>
              <th className="px-2 py-1.5 text-blue-500">Pts</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedPlayers.map((pl, j) => (
              <tr key={j} className="hover:bg-gray-50">
                <td className="px-4 py-2">
                  <span className="font-medium text-gray-800">{pl.lastName}, {pl.firstName}</span>
                  <span className="ml-1.5 text-xs text-gray-400">{pl.position}</span>
                  <StreakBadge info={pl.nhlId ? streaks[pl.nhlId] : undefined} />
                </td>
                <td className="px-2 py-2 text-center text-gray-600">{pl.goals}</td>
                <td className="px-2 py-2 text-center text-gray-600">{pl.assists}</td>
                <td className="px-2 py-2 text-center text-gray-500 hidden sm:table-cell">
                  {pl.position !== 'G' ? (pl.gwg || '—') : '—'}
                </td>
                <td className="px-2 py-2 text-center text-gray-500 hidden sm:table-cell">
                  {pl.position === 'G' ? pl.goalieWins : '—'}
                </td>
                <td className="px-2 py-2 text-center text-gray-500 hidden sm:table-cell">
                  {pl.position === 'G' ? pl.goalieOtl : '—'}
                </td>
                <td className="px-2 py-2 text-center text-gray-500 hidden sm:table-cell">
                  {pl.position === 'G' ? (pl.goalieShutouts || '—') : '—'}
                </td>
                <td className="px-2 py-2 text-center font-bold text-blue-600">{fmtPts(pl.poolPoints)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
