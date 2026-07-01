'use client'

import { Fragment, useState } from 'react'
import { DRAFT_SOURCES, DRAFT_SOURCES_RANKED, DRAFT_SOURCES_INFOONLY } from '@/lib/draft-sources'

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
  { key: 'global', label: 'Classement global' },
  { key: 'cs_na',  label: 'Classement LNH Nord-Américain', source: 'central_scouting_na' },
  { key: 'cs_eu',  label: 'Classement LNH Européen',       source: 'central_scouting_eu' },
]

export default function DraftCenterTable({ prospects, draftYear }: { prospects: Prospect[]; draftYear: number }) {
  const [view, setView] = useState<View>('global')
  const [expanded, setExpanded] = useState<number | null>(null)

  const toggleExpand = (id: number) => setExpanded(prev => prev === id ? null : id)
  const rankMap = (rankings: Ranking[]) => Object.fromEntries(rankings.map(r => [r.source, r]))
  const currentTab = TABS.find(t => t.key === view)!
  const isCS = view !== 'global'

  const rows: Prospect[] = isCS
    ? prospects
        .filter(p => p.rankings.some(r => r.source === currentTab.source))
        .sort((a, b) => {
          const ra = a.rankings.find(r => r.source === currentTab.source)?.rank ?? 999
          const rb = b.rankings.find(r => r.source === currentTab.source)?.rank ?? 999
          return ra - rb
        })
    : prospects

  // nombre total de colonnes pour colSpan
  const colCount = isCS ? 9 : (4 + DRAFT_SOURCES.length + 1) // rang+joueur+pos+PTS + sources + chevron

  return (
    <div>
      {/* Onglets */}
      <div className="flex flex-wrap gap-1 mb-4 border-b border-gray-200">
        {TABS.map(tab => (
          <button key={tab.key}
            onClick={() => { setView(tab.key); setExpanded(null) }}
            className={`px-4 py-2 text-sm font-medium rounded-t border-b-2 transition-colors ${
              view === tab.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            {tab.source && (
              <span className="ml-1.5 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">informatif</span>
            )}
          </button>
        ))}
      </div>

      {isCS && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-4">
          Les Éclaireurs LNH classent les joueurs par catégorie (attaquants, défenseurs, gardiens) séparément —
          pas un classement global. Fourni à titre informatif, non inclus dans le rang moyen.
        </p>
      )}

      <p className="text-sm text-gray-500 mb-3">
        {rows.length} prospects
        {!isCS && <> · rang moyen calculé sur {DRAFT_SOURCES_RANKED.length} sources · CS-NA et CS-EU à titre informatif</>}
        {isCS && <> · cliquer un joueur pour voir ses classements sur les autres sources</>}
      </p>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="text-sm border-collapse" style={{ minWidth: isCS ? undefined : '1100px' }}>
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-center px-3 py-3 font-medium text-gray-600 sticky left-0 bg-gray-50 z-10 min-w-[72px]">
                {isCS ? 'Rang' : 'Moy.'}
              </th>
              <th className="text-left px-3 py-3 font-medium text-gray-600 sticky left-[72px] bg-gray-50 z-10 min-w-[160px]">
                Joueur
              </th>
              <th className="text-left px-3 py-3 font-medium text-gray-600 w-12">Pos</th>

              {!isCS && (
                <>
                  {DRAFT_SOURCES_RANKED.map(s => (
                    <th key={s.key} className="text-center px-2 py-3 font-medium text-gray-600 w-12 text-xs">
                      {s.abbr}
                    </th>
                  ))}
                  {DRAFT_SOURCES_INFOONLY.map(s => (
                    <th key={s.key} className="text-center px-2 py-3 font-medium text-amber-600 w-12 text-xs bg-amber-50">
                      {s.abbr}
                    </th>
                  ))}
                </>
              )}

              {isCS && (
                <>
                  <th className="text-left px-3 py-3 font-medium text-gray-600">Équipe</th>
                  <th className="text-right px-3 py-3 font-medium text-gray-600">PJ</th>
                  <th className="text-right px-3 py-3 font-medium text-gray-600">B</th>
                  <th className="text-right px-3 py-3 font-medium text-gray-600">A</th>
                  <th className="text-right px-3 py-3 font-medium text-gray-600">PTS</th>
                  <th className="text-right px-3 py-3 font-medium text-gray-600">PUN</th>
                </>
              )}

              {!isCS && <th className="text-right px-3 py-3 font-medium text-gray-600 w-14">PTS</th>}
              <th className="w-6 px-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((p, idx) => {
              const rm = rankMap(p.rankings)
              const isExpanded = expanded === p.id
              const csRank = currentTab.source ? rm[currentTab.source]?.rank : null
              const prevHadRank = idx > 0 && rows[idx - 1].avgRank !== null
              const showSeparator = !isCS && p.avgRank === null && prevHadRank

              return (
                <Fragment key={p.id}>
                  {showSeparator && (
                    <tr className="bg-gray-50">
                      <td colSpan={colCount} className="px-4 py-2 text-xs text-gray-500 italic border-t-2 border-gray-300">
                        ↓ Prospects repérés par les Éclaireurs LNH uniquement — non classés par les analystes indépendants
                      </td>
                    </tr>
                  )}
                  <tr
                    onClick={() => toggleExpand(p.id)}
                    className={`border-b cursor-pointer transition-colors ${isExpanded ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                  >
                    {/* Rang moyen / rang CS — sticky */}
                    <td className={`px-3 py-2 text-center sticky left-0 z-10 ${isExpanded ? 'bg-blue-50' : 'bg-white'}`}>
                      {isCS ? (
                        <span className="text-xl font-bold text-gray-800">{csRank ?? '—'}</span>
                      ) : (
                        <div className="flex flex-col items-center">
                          <span className="text-lg font-bold text-blue-600">
                            {p.avgRank ? p.avgRank.toFixed(1) : '—'}
                          </span>
                          {p.avgRank && <span className="text-xs text-gray-400">{p.sourceCount} src</span>}
                        </div>
                      )}
                    </td>

                    {/* Joueur — sticky */}
                    <td className={`px-3 py-2 font-medium text-gray-800 sticky left-[72px] z-10 ${isExpanded ? 'bg-blue-50' : 'bg-white'}`}>
                      {p.last_name}, {p.first_name}
                    </td>

                    <td className="px-3 py-2 text-gray-500 text-xs">{p.position ?? '—'}</td>

                    {/* Colonnes par source (onglet global uniquement) */}
                    {!isCS && (
                      <>
                        {DRAFT_SOURCES_RANKED.map(s => {
                          const r = rm[s.key]
                          return (
                            <td key={s.key} className="px-2 py-2 text-center text-xs">
                              {r ? (
                                <span className={`font-semibold ${r.rank <= 5 ? 'text-blue-700' : r.rank <= 15 ? 'text-gray-700' : 'text-gray-400'}`}>
                                  {r.rank}
                                </span>
                              ) : (
                                <span className="text-gray-200">—</span>
                              )}
                            </td>
                          )
                        })}
                        {DRAFT_SOURCES_INFOONLY.map(s => {
                          const r = rm[s.key]
                          return (
                            <td key={s.key} className="px-2 py-2 text-center text-xs bg-amber-50">
                              {r ? (
                                <span className="font-semibold text-amber-700">{r.rank}</span>
                              ) : (
                                <span className="text-amber-200">—</span>
                              )}
                            </td>
                          )
                        })}
                      </>
                    )}

                    {/* Stats (onglet CS) */}
                    {isCS && (
                      <>
                        <td className="px-3 py-2 text-gray-500 text-xs">{p.team ?? '—'}</td>
                        <td className="px-3 py-2 text-right text-gray-600">{p.games_played ?? '—'}</td>
                        <td className="px-3 py-2 text-right text-gray-600">{p.goals ?? '—'}</td>
                        <td className="px-3 py-2 text-right text-gray-600">{p.assists ?? '—'}</td>
                        <td className="px-3 py-2 text-right font-medium text-gray-800">{p.points ?? '—'}</td>
                        <td className="px-3 py-2 text-right text-gray-500">{p.pim ?? '—'}</td>
                      </>
                    )}

                    {/* PTS (onglet global) */}
                    {!isCS && (
                      <td className="px-3 py-2 text-right font-medium text-gray-800">{p.points ?? '—'}</td>
                    )}

                    <td className="px-2 py-2 text-gray-400 text-xs">{isExpanded ? '▲' : '▼'}</td>
                  </tr>

                  {/* Expand : stats complètes (global) ou rangs sources (CS) */}
                  {isExpanded && (
                    <tr className="bg-blue-50 border-b">
                      <td colSpan={colCount} className="px-4 py-3">
                        {!isCS ? (
                          <div className="flex flex-wrap gap-4 text-xs text-gray-600">
                            <span><span className="font-medium">Équipe :</span> {p.team ?? '—'}</span>
                            <span><span className="font-medium">PJ :</span> {p.games_played ?? '—'}</span>
                            <span><span className="font-medium">B :</span> {p.goals ?? '—'}</span>
                            <span><span className="font-medium">A :</span> {p.assists ?? '—'}</span>
                            <span><span className="font-medium">PTS :</span> {p.points ?? '—'}</span>
                            <span><span className="font-medium">PUN :</span> {p.pim ?? '—'}</span>
                          </div>
                        ) : (
                          <div>
                            <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                              Classements {draftYear}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {DRAFT_SOURCES_RANKED.map(s => {
                                const r = rm[s.key]
                                if (!r) return (
                                  <span key={s.key} className="text-xs text-gray-300 border border-gray-100 rounded px-2 py-0.5 bg-white">
                                    {s.label} —
                                  </span>
                                )
                                return (
                                  <span key={s.key} className="text-xs bg-white border border-blue-200 text-blue-700 rounded px-2 py-0.5">
                                    {s.label} <span className="font-bold">#{r.rank}</span>
                                  </span>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={colCount} className="px-4 py-10 text-center text-gray-400">Aucune donnée disponible.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Légende */}
      {!isCS && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Légende des sources</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-1">
            {DRAFT_SOURCES_RANKED.map(s => (
              <span key={s.key} className="text-xs text-gray-600">
                <span className="font-semibold text-gray-800">{s.abbr}</span> — {s.label}
              </span>
            ))}
            {DRAFT_SOURCES_INFOONLY.map(s => (
              <span key={s.key} className="text-xs text-amber-700">
                <span className="font-semibold">{s.abbr}</span> — {s.label} <span className="italic">(informatif)</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
