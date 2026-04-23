'use client'

import { useState } from 'react'
import { fmtPts } from '@/lib/nhl-stats'
import type { PlayerContrib } from '@/lib/standings'

type Tab = 'organisation' | 'alignement'

const GROUP_LABEL = ['Attaquants', 'Défenseurs', 'Gardiens']
const TYPE_BADGE: Record<string, string> = { reserviste: 'RES', ltir: 'LTIR' }

function positionGroup(pos: string): number {
  if (pos === 'G') return 2
  if (pos === 'D' || pos === 'LD' || pos === 'RD') return 1
  return 0
}

function typeOrder(type: string): number {
  if (type === 'actif') return 0
  if (type === 'reserviste') return 1
  return 2
}

function groupAndSort(players: PlayerContrib[]): PlayerContrib[] {
  const groups: PlayerContrib[][] = [[], [], []]
  for (const p of players) groups[positionGroup(p.position)].push(p)
  for (const g of groups) g.sort((a, b) => typeOrder(a.playerType) - typeOrder(b.playerType) || b.poolPoints - a.poolPoints)
  return groups.flat()
}

function PlayerStatsRow({ p }: { p: PlayerContrib }) {
  const isGoalie = p.position === 'G'
  const isActif = p.playerType === 'actif'
  const badge = TYPE_BADGE[p.playerType]
  return (
    <tr className={isActif ? 'hover:bg-gray-50' : 'hover:bg-gray-50 opacity-60'}>
      <td className="px-4 py-2">
        <span className={`font-medium ${isActif ? 'text-gray-800' : 'text-gray-500'}`}>
          {p.lastName}, {p.firstName}
        </span>
        {badge && <span className="ml-2 text-xs bg-gray-100 text-gray-400 rounded px-1">{badge}</span>}
      </td>
      <td className="px-2 py-2 hidden sm:table-cell text-gray-500 text-center text-xs">{p.teamAbbrev}</td>
      <td className="px-2 py-2 text-center text-gray-500">{p.gamesPlayed || '—'}</td>
      {isGoalie ? (
        <>
          <td className="px-2 py-2 text-center text-gray-500">{p.goals || '—'}</td>
          <td className="px-2 py-2 text-center text-gray-500">{p.assists || '—'}</td>
          <td className="px-2 py-2 text-center text-gray-500 hidden sm:table-cell">{p.goalieWins}</td>
          <td className="px-2 py-2 text-center text-gray-500 hidden sm:table-cell">{p.goalieOtl}</td>
          <td className="px-2 py-2 text-center text-gray-500 hidden sm:table-cell">{p.goalieShutouts || '—'}</td>
        </>
      ) : (
        <>
          <td className="px-2 py-2 text-center text-gray-500">{p.goals}</td>
          <td className="px-2 py-2 text-center text-gray-500">{p.assists}</td>
          <td className="px-2 py-2 text-center text-gray-400 hidden sm:table-cell">—</td>
          <td className="px-2 py-2 text-center text-gray-400 hidden sm:table-cell">—</td>
          <td className="px-2 py-2 text-center text-gray-400 hidden sm:table-cell">—</td>
        </>
      )}
      <td className={`px-2 py-2 text-center font-bold ${isActif ? 'text-blue-600' : 'text-gray-400'}`}>
        {fmtPts(p.poolPoints)}
      </td>
    </tr>
  )
}

export default function PoolerPageTabs({
  organisationContent,
  alignementPlayers,
}: {
  organisationContent: React.ReactNode
  alignementPlayers: PlayerContrib[]
}) {
  const [tab, setTab] = useState<Tab>('organisation')

  const btnClass = (t: Tab) =>
    `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
      tab === t
        ? 'border-blue-600 text-blue-600'
        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
    }`

  const sorted = groupAndSort(alignementPlayers)
  const totalPts = alignementPlayers.filter(p => p.playerType === 'actif').reduce((s, p) => s + p.poolPoints, 0)

  return (
    <div>
      <div className="flex border-b border-gray-200 mb-6">
        <button className={btnClass('organisation')} onClick={() => setTab('organisation')}>
          Organisation
        </button>
        <button className={btnClass('alignement')} onClick={() => setTab('alignement')}>
          Alignement
        </button>
      </div>

      {tab === 'organisation' && organisationContent}

      {tab === 'alignement' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {alignementPlayers.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              Aucune donnée disponible pour cette saison.
            </div>
          ) : (
            <div className="overflow-x-auto">
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
                    <th className="px-2 py-2 hidden sm:table-cell">BL</th>
                    <th className="px-2 py-2 text-blue-500">PTS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sorted.map((p, i) => {
                    const isFirstOfGroup = i === 0 || positionGroup(p.position) !== positionGroup(sorted[i - 1].position)
                    return (
                      <>
                        {isFirstOfGroup && (
                          <tr key={`g-${i}`} className="bg-gray-100">
                            <td colSpan={9} className="px-4 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                              {GROUP_LABEL[positionGroup(p.position)]}
                            </td>
                          </tr>
                        )}
                        <PlayerStatsRow key={i} p={p} />
                      </>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-blue-50 border-t">
                    <td colSpan={8} className="px-4 py-2 text-sm text-gray-500 font-medium">
                      Total (actifs seulement)
                    </td>
                    <td className="px-2 py-2 text-center font-bold text-blue-600">{fmtPts(totalPts)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
