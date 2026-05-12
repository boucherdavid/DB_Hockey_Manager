'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { DailyRecap, RecapPlayer } from '@/lib/daily-recap'
import { addDaysToDate, getTodayET } from '@/lib/daily-recap'

// ─── Helpers affichage ────────────────────────────────────────────────────────

function fmtDateLong(dateStr: string): string {
  if (!dateStr) return ''
  try {
    return new Intl.DateTimeFormat('fr-CA', {
      timeZone: 'America/Toronto',
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    }).format(new Date(dateStr + 'T12:00:00'))
  } catch { return dateStr }
}

function playerStatLine(p: RecapPlayer): string {
  if (p.positionSlot === 'G') {
    const parts: string[] = []
    if (p.goalieWins > 0)    parts.push(`${p.goalieWins}V`)
    if (p.goalieOtl > 0)     parts.push(`${p.goalieOtl}P`)
    if (p.goalieShutouts > 0) parts.push(`${p.goalieShutouts}JB`)
    return parts.join(' ') || '—'
  }
  const parts: string[] = []
  if (p.goals > 0)   parts.push(`${p.goals}B`)
  if (p.assists > 0) parts.push(`${p.assists}A`)
  return parts.join(' ') || '—'
}

// ─── Sous-composant : tableau d'un pool ───────────────────────────────────────

function RecapTable({
  recap, title, expanded, onToggle,
}: {
  recap: DailyRecap
  title: string
  expanded: string | null
  onToggle: (id: string) => void
}) {
  const hasAnyPts = recap.poolers.some(p => p.pts > 0)

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="bg-slate-800 px-5 py-3">
        <h2 className="text-white font-bold text-sm uppercase tracking-wide">{title}</h2>
      </div>

      {!hasAnyPts ? (
        <p className="px-5 py-4 text-sm text-gray-400">Aucun joueur actif n&apos;a joué ce soir-là.</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {recap.poolers.map(pooler => (
            <div key={pooler.poolerId}>
              <button
                onClick={() => pooler.players.length > 0 && onToggle(pooler.poolerId)}
                className={`w-full flex items-center justify-between px-5 py-3 text-sm text-left transition-colors ${
                  pooler.players.length > 0 ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-default'
                }`}
              >
                <span className="font-semibold text-gray-800">{pooler.poolerName}</span>
                <div className="flex items-center gap-3">
                  {pooler.pts > 0 ? (
                    <span className="font-bold text-green-600">+{pooler.pts} pt{pooler.pts > 1 ? 's' : ''}</span>
                  ) : (
                    <span className="text-gray-300 text-xs">—</span>
                  )}
                  {pooler.players.length > 0 && (
                    <span className="text-xs text-gray-400 w-3">{expanded === pooler.poolerId ? '▲' : '▼'}</span>
                  )}
                </div>
              </button>

              {expanded === pooler.poolerId && pooler.players.length > 0 && (
                <div className="bg-gray-50 px-5 pb-3 pt-1">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-400 uppercase tracking-wide">
                        <th className="py-1.5 text-left font-medium">Joueur</th>
                        <th className="py-1.5 text-center w-14 font-medium">Éq.</th>
                        <th className="py-1.5 text-center w-20 font-medium">Stats</th>
                        <th className="py-1.5 text-right w-16 font-medium">Pts</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {pooler.players.map((pl, i) => (
                        <tr key={i} className="text-gray-700">
                          <td className="py-1.5 font-medium">{pl.lastName}, {pl.firstName}</td>
                          <td className="py-1.5 text-center text-gray-500 text-xs">{pl.teamCode}</td>
                          <td className="py-1.5 text-center text-gray-600">{playerStatLine(pl)}</td>
                          <td className="py-1.5 text-right font-bold text-green-600">+{pl.pts}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function ResultatsManager({
  date,
  playoffRecap,
  regularRecap,
  playoffSaisonName,
  regularSaisonName,
  minDate,
}: {
  date: string
  playoffRecap: DailyRecap | null
  regularRecap: DailyRecap | null
  playoffSaisonName?: string
  regularSaisonName?: string
  minDate?: string
}) {
  const router = useRouter()
  const [expanded, setExpanded] = useState<string | null>(null)

  const prevDate = addDaysToDate(date, -1)
  const nextDate = addDaysToDate(date, 1)
  const todayET  = getTodayET()
  const isToday  = date >= todayET
  const isFirst  = !!minDate && prevDate < minDate

  function navigate(d: string) {
    router.push(`/resultats?date=${d}`)
    setExpanded(null)
  }

  function onToggle(poolerId: string) {
    setExpanded(prev => prev === poolerId ? null : poolerId)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

      {/* En-tête + navigation */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Résultats</h1>
          <p className="text-gray-500 mt-0.5 capitalize">{fmtDateLong(date)}</p>
        </div>
        <div className="flex items-center gap-2 pt-1 shrink-0">
          {!isFirst && (
            <button
              onClick={() => navigate(prevDate)}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50 transition-colors"
            >
              ← Veille
            </button>
          )}
          {!isToday && (
            <button
              onClick={() => navigate(nextDate)}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50 transition-colors"
            >
              Lendemain →
            </button>
          )}
        </div>
      </div>

      {/* Pool des séries */}
      {playoffRecap && (
        <RecapTable
          recap={playoffRecap}
          title={`Pool séries ${playoffSaisonName ?? ''}`}
          expanded={expanded}
          onToggle={onToggle}
        />
      )}

      {/* Pool saison régulière */}
      {regularRecap && (
        <RecapTable
          recap={regularRecap}
          title={`Pool saison ${regularSaisonName ?? ''}`}
          expanded={expanded}
          onToggle={onToggle}
        />
      )}

      {!playoffRecap && !regularRecap && (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-400 text-sm">
          Aucun pool actif pour cette date.
        </div>
      )}
    </div>
  )
}
