'use client'

import { useState } from 'react'
import { fmtPts } from '@/lib/nhl-stats'
import type { PlayoffPoolStanding } from '@/app/gestion-series/playoff-pool-actions'
import type { StreakInfo } from '@/lib/streaks'

const RANK_COLOR = ['text-yellow-500', 'text-gray-400', 'text-amber-600']

const BADGE_META: Record<NonNullable<StreakInfo['badge']>, { emoji: string; label: string }> = {
  en_feu:    { emoji: '🔥', label: 'En feu'    },
  en_forme:  { emoji: '✅', label: 'En forme'  },
  en_froid:  { emoji: '🧊', label: 'En froid'  },
  en_crise:  { emoji: '🚨', label: 'En crise'  },
  en_hausse: { emoji: '📈', label: 'En hausse' },
  en_baisse: { emoji: '📉', label: 'En baisse' },
}

const slotLabel: Record<'F' | 'D' | 'G', string> = { F: 'Attaquants', D: 'Défenseurs', G: 'Gardiens' }
const slotOrder: Record<'F' | 'D' | 'G', number> = { F: 0, D: 1, G: 2 }

function StreakBadge({ nhlId, streaks }: { nhlId: number | null; streaks: Record<number, StreakInfo> }) {
  if (!nhlId) return null
  const info = streaks[nhlId]
  if (!info?.badge) return null
  const meta = BADGE_META[info.badge]
  const hasCount = info.badge === 'en_feu' || info.badge === 'en_forme' || info.badge === 'en_froid' || info.badge === 'en_crise'
  const title = hasCount ? `${meta.label} — ${info.count} matchs consécutifs` : meta.label
  return <span className="text-sm" title={title}>{meta.emoji}</span>
}

function groupBySlot(players: PlayoffPoolStanding['players']) {
  const groups: Record<'F' | 'D' | 'G', PlayoffPoolStanding['players']> = { F: [], D: [], G: [] }
  for (const p of players) groups[p.positionSlot].push(p)
  for (const slot of ['F', 'D', 'G'] as const) {
    groups[slot].sort((a, b) => b.points - a.points || (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0))
  }
  return (['F', 'D', 'G'] as const).map(slot => ({ slot, players: groups[slot] })).filter(g => g.players.length > 0)
}

export default function ClassementSeriesTable({
  standings,
  streaks = {},
}: {
  standings: PlayoffPoolStanding[]
  streaks?: Record<number, StreakInfo>
}) {
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div>
      {/* Tableau synthèse */}
      <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
        <div className="bg-slate-800 px-5 py-3">
          <h2 className="text-white font-bold text-sm uppercase tracking-wide">Classement — Pool des séries</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-400 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2 text-left w-8">#</th>
                <th className="px-4 py-2 text-left">Pooler</th>
                <th className="px-2 py-2 text-blue-500">PTS</th>
                <th className="px-2 py-2 hidden sm:table-cell">B</th>
                <th className="px-2 py-2 hidden sm:table-cell">A</th>
                <th className="px-2 py-2 hidden sm:table-cell">V</th>
                <th className="px-2 py-2 hidden sm:table-cell">DP</th>
                <th className="px-2 py-2 hidden sm:table-cell">BL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {standings.map((s, i) => {
                const active = s.players.filter(p => p.isActive)
                const goals    = active.reduce((acc, p) => acc + p.goals, 0)
                const assists  = active.reduce((acc, p) => acc + p.assists, 0)
                const wins     = active.reduce((acc, p) => acc + p.goalieWins, 0)
                const otl      = active.reduce((acc, p) => acc + p.goalieOtl, 0)
                const shutouts = active.reduce((acc, p) => acc + p.goalieShutouts, 0)
                return (
                  <tr key={s.poolerId} className="hover:bg-gray-50">
                    <td className={`px-4 py-2.5 font-bold text-center ${RANK_COLOR[i] ?? 'text-gray-500'}`}>{i + 1}</td>
                    <td className="px-4 py-2.5 font-semibold text-gray-800">{s.poolerName}</td>
                    <td className="px-2 py-2.5 text-center font-bold text-blue-600">{fmtPts(s.totalPoints)}</td>
                    <td className="px-2 py-2.5 text-center text-gray-600 hidden sm:table-cell">{goals}</td>
                    <td className="px-2 py-2.5 text-center text-gray-600 hidden sm:table-cell">{assists}</td>
                    <td className="px-2 py-2.5 text-center text-gray-600 hidden sm:table-cell">{wins}</td>
                    <td className="px-2 py-2.5 text-center text-gray-600 hidden sm:table-cell">{otl}</td>
                    <td className="px-2 py-2.5 text-center text-gray-600 hidden sm:table-cell">{shutouts}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Détail par pooler */}
      <h2 className="hidden sm:block text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Détail par pooler</h2>
      <div className="hidden sm:block space-y-2">
        {standings.map((s, i) => {
          const groups = groupBySlot(s.players)
          return (
            <div key={s.poolerId} className="bg-white rounded-lg shadow overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3">
                <span className={`text-base font-bold w-7 text-center shrink-0 ${RANK_COLOR[i] ?? 'text-gray-500'}`}>
                  {i + 1}
                </span>
                <span className="flex-1 font-semibold text-gray-800">{s.poolerName}</span>
                <span className="text-xl font-bold text-blue-600">{fmtPts(s.totalPoints)}</span>
                <span className="text-sm text-gray-400">pts</span>
                <button
                  type="button"
                  className="text-gray-300 text-xs ml-1 hover:text-gray-500 px-1"
                  onClick={() => setExpanded(expanded === s.poolerId ? null : s.poolerId)}
                  aria-label={expanded === s.poolerId ? 'Réduire' : 'Développer'}
                >
                  {expanded === s.poolerId ? '▲' : '▼'}
                </button>
              </div>

              {expanded === s.poolerId && (
                <div className="border-t overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-400 text-xs uppercase tracking-wide">
                      <tr>
                        <th className="px-4 py-2 text-left">Joueur</th>
                        <th className="px-2 py-2">Éq.</th>
                        <th className="px-2 py-2">B</th>
                        <th className="px-2 py-2">A</th>
                        <th className="px-2 py-2">V</th>
                        <th className="px-2 py-2">DP</th>
                        <th className="px-2 py-2">BL</th>
                        <th className="px-2 py-2 text-blue-500">Pts</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {groups.map(({ slot, players }) => (
                        <>
                          <tr key={`grp-${slot}`} className="bg-gray-100">
                            <td colSpan={8} className="px-4 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                              {slotLabel[slot]}
                            </td>
                          </tr>
                          {players.map(p => (
                            <tr key={p.playerId} className={p.isActive ? 'hover:bg-gray-50' : 'hover:bg-gray-50 opacity-50'}>
                              <td className="px-4 py-2">
                                <span className={`font-medium ${p.isActive ? 'text-gray-800' : 'text-gray-500'}`}>
                                  {p.lastName}, {p.firstName}
                                </span>
                                {!p.isActive && (
                                  <span className="ml-2 text-xs bg-gray-100 text-gray-400 rounded px-1">retiré</span>
                                )}
                                {p.isActive && (
                                  <span className="ml-1.5">
                                    <StreakBadge nhlId={p.nhlId} streaks={streaks} />
                                  </span>
                                )}
                              </td>
                              <td className="px-2 py-2 text-center text-gray-500 text-xs">{p.teamCode ?? '—'}</td>
                              <td className="px-2 py-2 text-center text-gray-500">{p.positionSlot === 'G' ? '—' : p.goals}</td>
                              <td className="px-2 py-2 text-center text-gray-500">{p.positionSlot === 'G' ? '—' : p.assists}</td>
                              <td className="px-2 py-2 text-center text-gray-500">{p.goalieWins || '—'}</td>
                              <td className="px-2 py-2 text-center text-gray-500">{p.goalieOtl || '—'}</td>
                              <td className="px-2 py-2 text-center text-gray-500">{p.goalieShutouts || '—'}</td>
                              <td className={`px-2 py-2 text-center font-bold ${p.isActive ? 'text-blue-600' : 'text-gray-400'}`}>
                                {fmtPts(p.points)}
                              </td>
                            </tr>
                          ))}
                        </>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-blue-50 border-t">
                        <td colSpan={7} className="px-4 py-2 text-sm font-medium text-blue-600">
                          Total
                        </td>
                        <td className="px-2 py-2 text-center font-bold text-blue-700">
                          {fmtPts(s.totalPoints)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
