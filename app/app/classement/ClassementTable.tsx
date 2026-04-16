'use client'

import { useState } from 'react'
import { fmtPts } from '@/lib/nhl-stats'
import type { PoolerStanding, PlayerContrib } from './page'

const RANK_COLOR = ['text-yellow-500', 'text-gray-400', 'text-amber-600']

function PlayerRow({ p }: { p: PlayerContrib }) {
  const isGoalie = p.position === 'G'
  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-2">
        <span className="font-medium text-gray-800">{p.lastName}, {p.firstName}</span>
        <span className="ml-2 text-xs text-gray-400">{p.position}</span>
      </td>
      <td className="px-2 py-2 hidden sm:table-cell text-gray-500 text-center text-xs">{p.teamAbbrev}</td>
      <td className="px-2 py-2 text-center text-gray-600">{p.gamesPlayed || '—'}</td>
      {isGoalie ? (
        <>
          <td className="px-2 py-2 text-center text-gray-400">—</td>
          <td className="px-2 py-2 text-center text-gray-400">—</td>
          <td className="px-2 py-2 text-center text-gray-600 hidden sm:table-cell">{p.goalieWins}</td>
          <td className="px-2 py-2 text-center text-gray-600 hidden sm:table-cell">{p.goalieOtl}</td>
        </>
      ) : (
        <>
          <td className="px-2 py-2 text-center text-gray-600">{p.goals}</td>
          <td className="px-2 py-2 text-center text-gray-600">{p.assists}</td>
          <td className="px-2 py-2 text-center text-gray-400 hidden sm:table-cell">—</td>
          <td className="px-2 py-2 text-center text-gray-400 hidden sm:table-cell">—</td>
        </>
      )}
      <td className="px-2 py-2 text-center font-bold text-blue-600">{fmtPts(p.poolPoints)}</td>
    </tr>
  )
}

export default function ClassementTable({ standings }: { standings: PoolerStanding[] }) {
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div className="space-y-2">
      {standings.map((pooler, i) => (
        <div key={pooler.poolerId} className="bg-white rounded-lg shadow overflow-hidden">
          <button
            type="button"
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left transition-colors"
            onClick={() => setExpanded(expanded === pooler.poolerId ? null : pooler.poolerId)}
          >
            <span className={`text-base font-bold w-7 text-center ${RANK_COLOR[i] ?? 'text-gray-500'}`}>
              {i + 1}
            </span>
            <span className="flex-1 font-semibold text-gray-800">{pooler.poolerName}</span>
            <span className="text-xl font-bold text-blue-600">{fmtPts(pooler.totalPoints)}</span>
            <span className="text-sm text-gray-400">pts</span>
            <span className="text-gray-300 text-xs ml-1">{expanded === pooler.poolerId ? '▲' : '▼'}</span>
          </button>

          {expanded === pooler.poolerId && (
            <div className="border-t overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-400 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-2 text-left">Joueur</th>
                    <th className="px-2 py-2 hidden sm:table-cell">Éq.</th>
                    <th className="px-2 py-2">MJ</th>
                    <th className="px-2 py-2">B</th>
                    <th className="px-2 py-2">A</th>
                    <th className="px-2 py-2 hidden sm:table-cell">V</th>
                    <th className="px-2 py-2 hidden sm:table-cell">DP</th>
                    <th className="px-2 py-2 text-blue-500">Pts</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[...pooler.players]
                    .sort((a, b) => b.poolPoints - a.poolPoints)
                    .map((p, j) => <PlayerRow key={j} p={p} />)
                  }
                </tbody>
                <tfoot>
                  <tr className="bg-blue-50 border-t">
                    <td colSpan={7} className="px-4 py-2 text-sm text-gray-500 font-medium">
                      Total — {pooler.players.length} joueurs
                    </td>
                    <td className="px-2 py-2 text-center font-bold text-blue-700">
                      {fmtPts(pooler.totalPoints)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
