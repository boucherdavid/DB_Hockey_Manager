'use client'

import { useState } from 'react'
export type { RecapPlayer, RecapPooler } from '@/lib/daily-recap'
import type { RecapPlayer, RecapPooler } from '@/lib/daily-recap'

function fmtRecapDate(dateStr: string): string {
  if (!dateStr) return ''
  try {
    return new Intl.DateTimeFormat('fr-CA', {
      timeZone: 'America/Toronto',
      day: 'numeric', month: 'long',
    }).format(new Date(dateStr + 'T12:00:00'))
  } catch { return dateStr }
}

function playerStatLine(p: RecapPlayer): string {
  if (p.positionSlot === 'G') {
    const parts = []
    if (p.goalieWins > 0) parts.push(`${p.goalieWins}V`)
    if (p.goalieOtl > 0) parts.push(`${p.goalieOtl}P`)
    if (p.goalieShutouts > 0) parts.push(`${p.goalieShutouts}JB`)
    return parts.join(' ') || '—'
  }
  const parts = []
  if (p.goals > 0) parts.push(`${p.goals}B`)
  if (p.assists > 0) parts.push(`${p.assists}A`)
  return parts.join(' ') || '—'
}

export default function DailyRecapWidget({
  date,
  poolers,
}: {
  date: string
  poolers: RecapPooler[]
}) {
  const [expanded, setExpanded] = useState<string | null>(null)

  if (poolers.length === 0) return null

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="bg-slate-700 px-5 py-3">
        <h2 className="text-white font-bold text-sm uppercase tracking-wide">
          Résultats — {fmtRecapDate(date)}
        </h2>
      </div>
      <div className="divide-y divide-gray-100">
        {poolers.map(p => (
          <div key={p.poolerId}>
            <button
              onClick={() => setExpanded(expanded === p.poolerId ? null : p.poolerId)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors text-left"
            >
              <span className="font-medium text-gray-800">{p.poolerName}</span>
              <div className="flex items-center gap-2">
                <span className="font-bold text-green-600">+{p.pts} pt{p.pts !== 1 ? 's' : ''}</span>
                <span className="text-xs text-gray-400">{expanded === p.poolerId ? '▲' : '▼'}</span>
              </div>
            </button>
            {expanded === p.poolerId && (
              <div className="bg-gray-50 px-4 pb-3 pt-1">
                <ul className="space-y-1.5">
                  {p.players.map((pl, i) => (
                    <li key={i} className="flex items-center justify-between text-xs text-gray-600">
                      <span>
                        <span className="font-medium text-gray-800">{pl.lastName}, {pl.firstName}</span>
                        <span className="text-gray-400 ml-1">{pl.teamCode}</span>
                      </span>
                      <span className="font-medium tabular-nums text-gray-700">
                        {playerStatLine(pl)}
                        <span className="text-green-600 ml-1">· +{pl.pts}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
