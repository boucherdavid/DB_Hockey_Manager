'use client'

import { Fragment, useState } from 'react'
import { DRAFT_SOURCES_RANKED, DRAFT_SOURCES_INFOONLY } from '@/lib/draft-sources'

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

type View = 'global' | 'cs_na' | 'cs_eu'

const TABS: { key: View; label: string; source?: string }[] = [
  { key: 'global',  label: 'Classement global' },
  { key: 'cs_na',  label: 'Central Scouting NA', source: 'central_scouting_na' },
  { key: 'cs_eu',  label: 'Central Scouting EU', source: 'central_scouting_eu' },
]


export default function DraftCenterTable({ prospects, draftYear }: { prospects: Prospect[]; draftYear: number }) {
  const [view, setView] = useState<View>('global')
  const [expanded, setExpanded] = useState<number | null>(null)

  const toggleExpand = (id: number) => setExpanded(prev => prev === id ? null : id)

  const rankMap = (rankings: Ranking[]) =>
    Object.fromEntries(rankings.map(r => [r.source, r]))

  const currentTab = TABS.find(t => t.key === view)!

  const rows: Prospect[] = view === 'global'
    ? prospects
    : prospects
        .filter(p => p.rankings.some(r => r.source === currentTab.source))
        .sort((a, b) => {
          const ra = a.rankings.find(r => r.source === currentTab.source)?.rank ?? 999
          const rb = b.rankings.find(r => r.source === currentTab.source)?.rank ?? 999
          return ra - rb
        })

  const isCS = view !== 'global'

  return (
    <div>
      {/* Onglets */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setView(tab.key); setExpanded(null) }}
            className={`px-4 py-2 text-sm font-medium rounded-t border-b-2 transition-colors ${
              view === tab.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            {tab.source && (
              <span className="ml-1.5 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                informatif
              </span>
            )}
          </button>
        ))}
      </div>

      {isCS && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-4">
          Les listes des Éclaireurs LNH classent les joueurs par catégorie (attaquants NA, défenseurs NA, gardiens NA...),
          pas en classement global. Ces rangs sont fournis à titre informatif et ne sont pas inclus dans le rang moyen.
        </p>
      )}

      <p className="text-sm text-gray-500 mb-3">
        {rows.length} prospects
        {!isCS && <> · rang moyen calculé sur {DRAFT_SOURCES_RANKED.length} sources</>}
        {' · '}cliquer un joueur pour voir le détail des classements
      </p>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-center px-3 py-3 font-medium text-gray-600 w-20">
                {isCS ? 'Rang' : 'Rang moy.'}
              </th>
              <th className="text-left px-3 py-3 font-medium text-gray-600">Joueur</th>
              <th className="text-left px-3 py-3 font-medium text-gray-600">Pos</th>
              <th className="text-left px-3 py-3 font-medium text-gray-600 hidden sm:table-cell">Équipe</th>
              <th className="text-right px-3 py-3 font-medium text-gray-600 hidden sm:table-cell">PJ</th>
              <th className="text-right px-3 py-3 font-medium text-gray-600 hidden sm:table-cell">B</th>
              <th className="text-right px-3 py-3 font-medium text-gray-600 hidden sm:table-cell">A</th>
              <th className="text-right px-3 py-3 font-medium text-gray-600">PTS</th>
              <th className="text-right px-3 py-3 font-medium text-gray-600 hidden sm:table-cell">PUN</th>
              <th className="w-6 px-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(p => {
              const rm = rankMap(p.rankings)
              const isExpanded = expanded === p.id
              const csRank = currentTab.source ? rm[currentTab.source]?.rank : null

              return (
                <Fragment key={p.id}>
                  <tr
                    onClick={() => toggleExpand(p.id)}
                    className={`border-b cursor-pointer transition-colors ${isExpanded ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                  >
                    {/* Rang moyen / rang CS */}
                    <td className="px-3 py-3 text-center">
                      {isCS ? (
                        <span className="text-xl font-bold text-gray-800">
                          {csRank ?? '—'}
                        </span>
                      ) : (
                        <div className="flex flex-col items-center">
                          <span className="text-xl font-bold text-blue-600">
                            {p.avgRank ? p.avgRank.toFixed(1) : '—'}
                          </span>
                          {p.avgRank && (
                            <span className="text-xs text-gray-400">{p.sourceCount} src</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 font-medium text-gray-800">{p.last_name}, {p.first_name}</td>
                    <td className="px-3 py-3 text-gray-600">{p.position ?? '—'}</td>
                    <td className="px-3 py-3 text-gray-500 hidden sm:table-cell text-xs">{p.team ?? '—'}</td>
                    <td className="px-3 py-3 text-right text-gray-600 hidden sm:table-cell">{p.games_played ?? '—'}</td>
                    <td className="px-3 py-3 text-right text-gray-600 hidden sm:table-cell">{p.goals ?? '—'}</td>
                    <td className="px-3 py-3 text-right text-gray-600 hidden sm:table-cell">{p.assists ?? '—'}</td>
                    <td className="px-3 py-3 text-right font-medium text-gray-800">{p.points ?? '—'}</td>
                    <td className="px-3 py-3 text-right text-gray-500 hidden sm:table-cell">{p.pim ?? '—'}</td>
                    <td className="px-2 py-3 text-gray-400 text-xs">
                      {isExpanded ? '▲' : '▼'}
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr className="bg-blue-50 border-b">
                      <td colSpan={10} className="px-4 py-3">
                        <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                          Classements {draftYear}
                        </p>
                        <div className="flex flex-wrap gap-2 mb-3">
                          {DRAFT_SOURCES_RANKED.map(s => {
                            const r = rm[s.key]
                            if (!r) return (
                              <span key={s.key} className="text-xs text-gray-300 border border-gray-100 rounded px-2 py-0.5 bg-white">
                                {s.label} —
                              </span>
                            )
                            const content = <>{s.label} <span className="font-bold">#{r.rank}</span></>
                            return r.source_url ? (
                              <a key={s.key} href={r.source_url} target="_blank" rel="noopener noreferrer"
                                className="text-xs bg-white border border-blue-200 text-blue-700 rounded px-2 py-0.5 hover:bg-blue-50"
                                onClick={e => e.stopPropagation()}>
                                {content}
                              </a>
                            ) : (
                              <span key={s.key} className="text-xs bg-white border border-gray-200 text-gray-700 rounded px-2 py-0.5">
                                {content}
                              </span>
                            )
                          })}
                        </div>
                        {DRAFT_SOURCES_INFOONLY.some(s => rm[s.key]) && (
                          <>
                            <p className="text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wide">
                              Éclaireurs LNH (informatif)
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {DRAFT_SOURCES_INFOONLY.map(s => {
                                const r = rm[s.key]
                                if (!r) return null
                                const content = <>{s.label} <span className="font-bold">#{r.rank}</span></>
                                return r.source_url ? (
                                  <a key={s.key} href={r.source_url} target="_blank" rel="noopener noreferrer"
                                    className="text-xs bg-white border border-amber-200 text-amber-700 rounded px-2 py-0.5 hover:bg-amber-50"
                                    onClick={e => e.stopPropagation()}>
                                    {content}
                                  </a>
                                ) : (
                                  <span key={s.key} className="text-xs bg-white border border-amber-200 text-amber-700 rounded px-2 py-0.5">
                                    {content}
                                  </span>
                                )
                              })}
                            </div>
                          </>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
            {rows.length === 0 && (
              <tr><td colSpan={10} className="px-4 py-10 text-center text-gray-400">Aucune donnée disponible.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
