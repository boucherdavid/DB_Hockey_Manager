'use client'

import { useState } from 'react'
import { fmtPts } from '@/lib/nhl-stats'
import type { PlayoffPoolStanding, PeriodInfo } from '@/app/gestion-series/playoff-pool-actions'
import type { StreakInfo } from '@/lib/streaks'
import StreakLegend from '@/components/StreakLegend'

const RANK_COLOR = ['text-yellow-500', 'text-gray-400', 'text-amber-600']

const BADGE_META: Record<NonNullable<StreakInfo['badge']>, { emoji: string; label: string }> = {
  en_feu:    { emoji: '🔥', label: 'En feu'    },
  en_forme:  { emoji: '✅', label: 'En forme'  },
  en_panne:  { emoji: '🧊', label: 'En panne'  },
  en_crise:  { emoji: '🚨', label: 'En crise'  },
  en_hausse: { emoji: '📈', label: 'En hausse' },
  en_baisse: { emoji: '📉', label: 'En baisse' },
}

const slotLabel: Record<'F' | 'D' | 'G', string> = { F: 'Attaquants', D: 'Défenseurs', G: 'Gardiens' }

function StreakBadge({ nhlId, streaks }: { nhlId: number | null; streaks: Record<number, StreakInfo> }) {
  if (!nhlId) return null
  const info = streaks[nhlId]
  if (!info?.badge) return null
  const meta = BADGE_META[info.badge]
  const hasCount = info.badge === 'en_feu' || info.badge === 'en_forme' || info.badge === 'en_panne' || info.badge === 'en_crise'
  const title = hasCount ? `${meta.label} — ${info.count} matchs consécutifs` : meta.label
  return <span className="text-sm" title={title}>{meta.emoji}</span>
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', timeZone: 'America/Toronto' })
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('fr-CA', {
    day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', hour12: false,
    timeZone: 'America/Toronto',
  })
}

type PeriodPopupProps = {
  playerName: string
  positionSlot: 'F' | 'D' | 'G'
  periods: PeriodInfo[]
  totalPoints: number
  onClose: () => void
}

function PeriodPopup({ playerName, positionSlot, periods, totalPoints, onClose }: PeriodPopupProps) {
  const isGoalie = positionSlot === 'G'
  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-xs"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="font-semibold text-gray-800 text-sm">{playerName}</span>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none ml-2"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>
        <div className="px-4 py-3 space-y-3">
          {periods.map((p, i) => (
            <div key={i} className="space-y-0.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">
                  Période {i + 1}
                  {p.deactivatedAt === null && (
                    <span className="ml-1.5 text-green-600 font-semibold">actif</span>
                  )}
                </span>
                <span className="text-xs text-gray-400">
                  {fmtDate(p.activatedAt)} → {p.deactivatedAt ? fmtDate(p.deactivatedAt) : '…'}
                </span>
              </div>
              <div className="flex items-center justify-between bg-gray-50 rounded px-3 py-1.5">
                <span className="text-sm text-gray-600">
                  {isGoalie
                    ? `${p.goalie_wins}V  ${p.goalie_otl}DP  ${p.goalie_shutouts}BL`
                    : `${p.goals}B  ${p.assists}A`}
                </span>
                <span className="text-sm font-bold text-blue-600">{fmtPts(p.points)} pts</span>
              </div>
            </div>
          ))}
          <div className="border-t pt-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">Total</span>
            <span className="text-sm font-bold text-blue-700">{fmtPts(totalPoints)} pts</span>
          </div>
        </div>
      </div>
    </div>
  )
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
  const [periodPopup, setPeriodPopup] = useState<{
    playerName: string
    positionSlot: 'F' | 'D' | 'G'
    periods: PeriodInfo[]
    totalPoints: number
  } | null>(null)

  return (
    <div className="space-y-6">
      {periodPopup && (
        <PeriodPopup
          playerName={periodPopup.playerName}
          positionSlot={periodPopup.positionSlot}
          periods={periodPopup.periods}
          totalPoints={periodPopup.totalPoints}
          onClose={() => setPeriodPopup(null)}
        />
      )}
      <StreakLegend />
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
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Détail par pooler</h2>
      <div className="space-y-2">
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
                        <th className="px-2 py-2 hidden sm:table-cell">Éq.</th>
                        <th className="px-2 py-2">B</th>
                        <th className="px-2 py-2">A</th>
                        <th className="px-2 py-2 hidden sm:table-cell">V</th>
                        <th className="px-2 py-2 hidden sm:table-cell">DP</th>
                        <th className="px-2 py-2 hidden sm:table-cell">BL</th>
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
                          {players.map(p => {
                            const isMultiPeriod = p.periods.length > 1
                            const playerName = `${p.lastName}, ${p.firstName}`
                            return (
                            <tr key={p.playerId} className={p.isActive ? 'hover:bg-gray-50' : 'hover:bg-gray-50 opacity-50'}>
                              <td className="px-4 py-2">
                                <span
                                  className={`font-medium ${p.isActive ? 'text-gray-800' : 'text-gray-500'} ${isMultiPeriod ? 'cursor-pointer hover:underline' : ''}`}
                                  onClick={isMultiPeriod ? () => setPeriodPopup({ playerName, positionSlot: p.positionSlot, periods: p.periods, totalPoints: p.points }) : undefined}
                                >
                                  {playerName}
                                </span>
                                {isMultiPeriod && (
                                  <button
                                    type="button"
                                    title={`${p.periods.length} périodes — voir le détail`}
                                    className="ml-1.5 text-xs text-indigo-400 hover:text-indigo-600 align-middle"
                                    onClick={() => setPeriodPopup({ playerName, positionSlot: p.positionSlot, periods: p.periods, totalPoints: p.points })}
                                  >
                                    ↩{p.periods.length}
                                  </button>
                                )}
                                {!p.isActive && (
                                  <span className="ml-2 text-xs bg-gray-100 text-gray-400 rounded px-1">retiré</span>
                                )}
                                {p.isActive && (
                                  <span className="ml-1.5">
                                    <StreakBadge nhlId={p.nhlId} streaks={streaks} />
                                  </span>
                                )}
                                {!isMultiPeriod && p.periods[0]?.activatedAt && (
                                  <div className="text-xs text-gray-400 mt-0.5">
                                    {fmtDateTime(p.periods[0].activatedAt)}
                                  </div>
                                )}
                              </td>
                              <td className="px-2 py-2 text-center text-gray-500 text-xs hidden sm:table-cell">{p.teamCode ?? '—'}</td>
                              <td className="px-2 py-2 text-center text-gray-500">{p.goals || '—'}</td>
                              <td className="px-2 py-2 text-center text-gray-500">{p.assists || '—'}</td>
                              <td className="px-2 py-2 text-center text-gray-500 hidden sm:table-cell">{p.goalieWins || '—'}</td>
                              <td className="px-2 py-2 text-center text-gray-500 hidden sm:table-cell">{p.goalieOtl || '—'}</td>
                              <td className="px-2 py-2 text-center text-gray-500 hidden sm:table-cell">{p.goalieShutouts || '—'}</td>
                              <td className={`px-2 py-2 text-center font-bold ${p.isActive ? 'text-blue-600' : 'text-gray-400'}`}>
                                {fmtPts(p.points)}
                              </td>
                            </tr>
                            )
                          })}
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
