'use client'

import { Fragment, useState } from 'react'
import { DRAFT_SOURCES } from '@/lib/draft-sources'

type Ranking = { source: string; rank: number; source_url: string | null }
type Prospect = {
  id: number
  first_name: string
  last_name: string
  position: string | null
  team: string | null
  games_played: number | null
  goals: number | null
  assists: number | null
  points: number | null
  pim: number | null
  rankings: Ranking[]
  avgRank: number | null
  sourceCount: number
}

export default function DraftCenterTable({ prospects, draftYear }: { prospects: Prospect[]; draftYear: number }) {
  const [expanded, setExpanded] = useState<number | null>(null)

  const toggleExpand = (id: number) => setExpanded(prev => prev === id ? null : id)

  const rankMap = (rankings: Ranking[]) =>
    Object.fromEntries(rankings.map(r => [r.source, r]))

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">
        {prospects.length} prospects · rang moyen calculé sur les sources disponibles · cliquer sur un joueur pour voir le détail
      </p>
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-right px-3 py-3 font-medium text-gray-500 w-12">#</th>
              <th className="text-left px-3 py-3 font-medium text-gray-600">Joueur</th>
              <th className="text-left px-3 py-3 font-medium text-gray-600">Pos</th>
              <th className="text-left px-3 py-3 font-medium text-gray-600 hidden sm:table-cell">Équipe</th>
              <th className="text-right px-3 py-3 font-medium text-gray-600 hidden sm:table-cell">PJ</th>
              <th className="text-right px-3 py-3 font-medium text-gray-600 hidden sm:table-cell">B</th>
              <th className="text-right px-3 py-3 font-medium text-gray-600 hidden sm:table-cell">A</th>
              <th className="text-right px-3 py-3 font-medium text-gray-600">PTS</th>
              <th className="text-right px-3 py-3 font-medium text-gray-600 hidden sm:table-cell">PUN</th>
              <th className="text-right px-3 py-3 font-medium text-gray-600 hidden sm:table-cell">Sources</th>
            </tr>
          </thead>
          <tbody>
            {prospects.map((p, idx) => {
              const rm = rankMap(p.rankings)
              const isExpanded = expanded === p.id
              return (
                <Fragment key={p.id}>
                  <tr
                    onClick={() => toggleExpand(p.id)}
                    className={`border-b cursor-pointer transition-colors ${isExpanded ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                  >
                    <td className="px-3 py-3 text-right text-gray-400 font-mono text-xs">{idx + 1}</td>
                    <td className="px-3 py-3">
                      <span className="font-medium text-gray-800">{p.last_name}, {p.first_name}</span>
                    </td>
                    <td className="px-3 py-3 text-gray-600">{p.position ?? '—'}</td>
                    <td className="px-3 py-3 text-gray-500 hidden sm:table-cell text-xs">{p.team ?? '—'}</td>
                    <td className="px-3 py-3 text-right text-gray-600 hidden sm:table-cell">{p.games_played ?? '—'}</td>
                    <td className="px-3 py-3 text-right text-gray-600 hidden sm:table-cell">{p.goals ?? '—'}</td>
                    <td className="px-3 py-3 text-right text-gray-600 hidden sm:table-cell">{p.assists ?? '—'}</td>
                    <td className="px-3 py-3 text-right font-medium text-gray-800">{p.points ?? '—'}</td>
                    <td className="px-3 py-3 text-right text-gray-500 hidden sm:table-cell">{p.pim ?? '—'}</td>
                    <td className="px-3 py-3 text-right text-gray-400 text-xs hidden sm:table-cell">
                      {p.avgRank ? `${p.avgRank.toFixed(1)} (${p.sourceCount})` : '—'}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="bg-blue-50 border-b">
                      <td colSpan={10} className="px-4 py-3">
                        <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Rangs par source — {draftYear}</p>
                        <div className="flex flex-wrap gap-2">
                          {DRAFT_SOURCES.map(s => {
                            const r = rm[s.key]
                            if (!r) return (
                              <span key={s.key} className="text-xs text-gray-300 border border-gray-100 rounded px-2 py-0.5 bg-white">
                                {s.label} —
                              </span>
                            )
                            return r.source_url ? (
                              <a
                                key={s.key}
                                href={r.source_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs bg-white border border-blue-200 text-blue-700 rounded px-2 py-0.5 hover:bg-blue-50"
                                onClick={e => e.stopPropagation()}
                              >
                                {s.label} <span className="font-bold">#{r.rank}</span>
                              </a>
                            ) : (
                              <span key={s.key} className="text-xs bg-white border border-gray-200 text-gray-700 rounded px-2 py-0.5">
                                {s.label} <span className="font-bold">#{r.rank}</span>
                              </span>
                            )
                          })}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
            {prospects.length === 0 && (
              <tr><td colSpan={10} className="px-4 py-10 text-center text-gray-400">Aucune donnée disponible.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
