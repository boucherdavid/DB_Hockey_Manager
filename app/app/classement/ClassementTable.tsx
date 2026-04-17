'use client'

import { useState } from 'react'
import Link from 'next/link'
import { fmtPts } from '@/lib/nhl-stats'
import type { PoolerStanding, PlayerContrib } from './page'

const RANK_COLOR = ['text-yellow-500', 'text-gray-400', 'text-amber-600']

const GROUP_LABEL = ['Attaquants', 'Défenseurs', 'Gardiens']

function positionGroup(pos: string): number {
  if (pos === 'G') return 2
  if (pos === 'D' || pos === 'LD' || pos === 'RD') return 1
  return 0
}

function typeOrder(type: string): number {
  if (type === 'actif') return 0
  if (type === 'reserviste') return 1
  return 2 // ltir
}

const TYPE_BADGE: Record<string, string> = {
  reserviste: 'RES',
  ltir: 'LTIR',
}

function PlayerRow({ p }: { p: PlayerContrib }) {
  const isGoalie = p.position === 'G'
  const isActif = p.playerType === 'actif'
  const badge = TYPE_BADGE[p.playerType]

  return (
    <tr className={isActif ? 'hover:bg-gray-50' : 'hover:bg-gray-50 opacity-60'}>
      <td className="px-4 py-2">
        <span className={`font-medium ${isActif ? 'text-gray-800' : 'text-gray-500'}`}>
          {p.lastName}, {p.firstName}
        </span>
        {badge && (
          <span className="ml-2 text-xs bg-gray-100 text-gray-400 rounded px-1">{badge}</span>
        )}
      </td>
      <td className="px-2 py-2 hidden sm:table-cell text-gray-500 text-center text-xs">{p.teamAbbrev}</td>
      <td className="px-2 py-2 text-center text-gray-500">{p.gamesPlayed || '—'}</td>
      {isGoalie ? (
        <>
          <td className="px-2 py-2 text-center text-gray-400">—</td>
          <td className="px-2 py-2 text-center text-gray-400">—</td>
          <td className="px-2 py-2 text-center text-gray-500 hidden sm:table-cell">{p.goalieWins}</td>
          <td className="px-2 py-2 text-center text-gray-500 hidden sm:table-cell">{p.goalieOtl}</td>
        </>
      ) : (
        <>
          <td className="px-2 py-2 text-center text-gray-500">{p.goals}</td>
          <td className="px-2 py-2 text-center text-gray-500">{p.assists}</td>
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

function GroupHeader({ label }: { label: string }) {
  return (
    <tr className="bg-gray-100">
      <td colSpan={8} className="px-4 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
        {label}
      </td>
    </tr>
  )
}

function groupAndSort(players: PlayerContrib[]): PlayerContrib[] {
  const groups: PlayerContrib[][] = [[], [], []]
  for (const p of players) groups[positionGroup(p.position)].push(p)

  // Dans chaque groupe : actifs d'abord (par pts DESC), puis réservistes, puis LTIR
  for (const g of groups) {
    g.sort((a, b) =>
      typeOrder(a.playerType) - typeOrder(b.playerType) ||
      b.poolPoints - a.poolPoints
    )
  }
  return groups.flat()
}

export default function ClassementTable({ standings }: { standings: PoolerStanding[] }) {
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div className="space-y-2">
      {standings.map((pooler, i) => {
        const sorted = groupAndSort(pooler.players)

        return (
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
                    {sorted.map((p, j) => {
                      const isFirstOfGroup = j === 0 || positionGroup(p.position) !== positionGroup(sorted[j - 1].position)
                      return (
                        <>
                          {isFirstOfGroup && (
                            <GroupHeader key={`g-${j}`} label={GROUP_LABEL[positionGroup(p.position)]} />
                          )}
                          <PlayerRow key={j} p={p} />
                        </>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-blue-50 border-t">
                      <td colSpan={7} className="px-4 py-2 text-sm font-medium">
                        <Link href={`/poolers/${pooler.poolerId}`} className="text-blue-600 hover:underline">
                          Voir l'alignement complet →
                        </Link>
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
        )
      })}
    </div>
  )
}
