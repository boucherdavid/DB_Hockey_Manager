'use client'

import { useState } from 'react'
import type { PlayoffPoolStanding } from '@/app/gestion-series/playoff-pool-actions'

const slotColor: Record<'F' | 'D' | 'G', string> = {
  F: 'text-blue-500',
  D: 'text-green-500',
  G: 'text-purple-500',
}

function fmt(pts: number) {
  return Math.round(pts)
}

export default function ClassementSeriesTable({ standings }: { standings: PlayoffPoolStanding[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(standings.map(s => s.poolerId))
  )

  function toggle(poolerId: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(poolerId)) next.delete(poolerId)
      else next.add(poolerId)
      return next
    })
  }

  return (
    <>
      {/* Tableau synthèse */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b">
              <th className="text-left px-4 py-2 font-medium text-gray-600 w-8">#</th>
              <th className="text-left px-4 py-2 font-medium text-gray-600">Pooler</th>
              <th className="text-right px-4 py-2 font-bold text-gray-700">Points</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s, i) => (
              <tr
                key={s.poolerId}
                className={`border-b cursor-pointer ${i === 0 ? 'bg-yellow-50 hover:bg-yellow-100' : 'hover:bg-gray-50'}`}
                onClick={() => toggle(s.poolerId)}
              >
                <td className="px-4 py-2 text-gray-400 font-medium">{i + 1}</td>
                <td className="px-4 py-2 font-medium text-blue-600 underline-offset-2 hover:underline">
                  {s.poolerName}
                </td>
                <td className="text-right px-4 py-2 font-bold text-blue-700 tabular-nums">
                  {fmt(s.totalPoints)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Détail par pooler */}
      {standings.map((s, i) => (
        <div key={s.poolerId} className="bg-white rounded-lg shadow overflow-hidden">
          <button
            type="button"
            onClick={() => toggle(s.poolerId)}
            className={`w-full px-4 py-3 flex items-center justify-between ${i === 0 ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-blue-600 hover:bg-blue-700'} transition-colors`}
          >
            <div className="flex items-center gap-2">
              <span className="text-white font-bold text-sm">#{i + 1}</span>
              <span className="text-white font-semibold text-sm">{s.poolerName}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-white font-bold tabular-nums">{fmt(s.totalPoints)} pts</span>
              <span className="text-white/70 text-xs">{expanded.has(s.poolerId) ? '▲' : '▼'}</span>
            </div>
          </button>

          {expanded.has(s.poolerId) && (
            <div className="divide-y divide-gray-50">
              {s.players.map(p => (
                <div key={p.playerId} className="flex items-center gap-2 px-4 py-2 text-sm">
                  <span className={`font-bold text-xs w-4 ${slotColor[p.positionSlot]}`}>
                    {p.positionSlot}
                  </span>
                  <span className={`flex-1 font-medium ${p.isActive ? 'text-gray-800' : 'text-gray-400'}`}>
                    {p.lastName}, {p.firstName}
                  </span>
                  <span className="text-xs text-gray-400 shrink-0">{p.teamCode}</span>
                  <span className="tabular-nums text-gray-500 text-xs shrink-0">
                    {p.goals}B {p.assists}A
                  </span>
                  {(p.goalieWins > 0 || p.goalieOtl > 0 || p.goalieShutouts > 0) && (
                    <span className="tabular-nums text-gray-500 text-xs shrink-0">
                      {p.goalieWins}V {p.goalieOtl}DP {p.goalieShutouts}BL
                    </span>
                  )}
                  {!p.isActive && (
                    <span className="text-xs text-gray-300 shrink-0">retiré</span>
                  )}
                  <span className="font-semibold text-blue-600 tabular-nums w-14 text-right shrink-0">
                    {fmt(p.points)} pts
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </>
  )
}
