'use client'

import { useState } from 'react'
import { fmtPts } from '@/lib/nhl-stats'
import PlayerLink from '@/components/PlayerLink'
import type { PlayerContrib } from '@/lib/standings'

type Tab = 'organisation' | 'alignement' | 'historique'

type ChangeLogEntry = {
  id: number
  change_type: string
  old_type: string | null
  new_type: string | null
  changed_at: string
  players: { first_name: string; last_name: string; position: string | null } | null
}

const GROUP_LABEL = ['Attaquants', 'Défenseurs', 'Gardiens']
const TYPE_BADGE: Record<string, string> = { reserviste: 'RES', ltir: 'LTIR' }

const CHANGE_LABEL: Record<string, string> = {
  activation:          'Activation',
  deactivation:        'Désactivation',
  ajout_reserviste:    'Ajout (réserviste)',
  ajout_recrue:        'Ajout (banque recrues)',
  retrait:             'Retrait',
  ltir:                'Mise sur LTIR',
  retour_ltir:         'Retour LTIR',
  changement_type:     'Changement de type',
  signature_agent_libre: 'Signature agent libre',
}

const CHANGE_COLOR: Record<string, string> = {
  activation:          'bg-green-100 text-green-700',
  deactivation:        'bg-orange-100 text-orange-700',
  ajout_reserviste:    'bg-blue-100 text-blue-700',
  ajout_recrue:        'bg-purple-100 text-purple-700',
  retrait:             'bg-red-100 text-red-700',
  ltir:                'bg-yellow-100 text-yellow-700',
  retour_ltir:         'bg-teal-100 text-teal-700',
  changement_type:     'bg-gray-100 text-gray-600',
  signature_agent_libre: 'bg-indigo-100 text-indigo-700',
}

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

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-CA', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))
}

function PlayerStatsRow({ p }: { p: PlayerContrib }) {
  const isGoalie = p.position === 'G'
  const isActif = p.playerType === 'actif'
  const badge = TYPE_BADGE[p.playerType]
  return (
    <tr className={isActif ? 'hover:bg-gray-50' : 'hover:bg-gray-50 opacity-60'}>
      <td className="px-4 py-2">
        <PlayerLink nhlId={p.nhlId}>
          <span className={`font-medium ${isActif ? 'text-gray-800' : 'text-gray-500'}`}>
            {p.lastName}, {p.firstName}
          </span>
        </PlayerLink>
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
  changeLog,
}: {
  organisationContent: React.ReactNode
  alignementPlayers: PlayerContrib[]
  changeLog: ChangeLogEntry[]
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

  const signaturesLibres = changeLog.filter(e => e.change_type === 'signature_agent_libre' && e.old_type !== 'ltir').length
  const signaturesLtir   = changeLog.filter(e => e.change_type === 'signature_agent_libre' && e.old_type === 'ltir').length

  return (
    <div>
      <div className="flex border-b border-gray-200 mb-6">
        <button className={btnClass('organisation')} onClick={() => setTab('organisation')}>
          Organisation
        </button>
        <button className={btnClass('alignement')} onClick={() => setTab('alignement')}>
          Alignement
        </button>
        <button className={btnClass('historique')} onClick={() => setTab('historique')}>
          Historique
          {changeLog.length > 0 && (
            <span className="ml-1.5 text-xs bg-gray-100 text-gray-500 rounded-full px-1.5">{changeLog.length}</span>
          )}
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

      {tab === 'historique' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-xs text-gray-400 mb-1">Agents libres signés</p>
              <p className="text-2xl font-bold text-gray-800">{signaturesLibres}<span className="text-sm font-normal text-gray-400"> / 2</span></p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-xs text-gray-400 mb-1">Signatures LTIR</p>
              <p className="text-2xl font-bold text-gray-800">{signaturesLtir}<span className="text-sm font-normal text-gray-400"> / 2</span></p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-xs text-gray-400 mb-1">Total changements</p>
              <p className="text-2xl font-bold text-gray-800">{changeLog.length}</p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow overflow-hidden">
            {changeLog.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">
                Aucun changement enregistré pour cette saison.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-400 text-xs uppercase tracking-wide border-b">
                    <tr>
                      <th className="px-4 py-2 text-left">Date</th>
                      <th className="px-4 py-2 text-left">Joueur</th>
                      <th className="px-4 py-2 text-left">Type</th>
                      <th className="px-4 py-2 text-left hidden sm:table-cell">Détail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {changeLog.map(entry => {
                      const label = CHANGE_LABEL[entry.change_type] ?? entry.change_type
                      const color = CHANGE_COLOR[entry.change_type] ?? 'bg-gray-100 text-gray-600'
                      const player = entry.players
                      return (
                        <tr key={entry.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-gray-400 text-xs whitespace-nowrap">
                            {formatDate(entry.changed_at)}
                          </td>
                          <td className="px-4 py-2 font-medium text-gray-800">
                            {player ? `${player.last_name}, ${player.first_name}` : '—'}
                            {player?.position && (
                              <span className="ml-1 text-xs text-gray-400">{player.position}</span>
                            )}
                          </td>
                          <td className="px-4 py-2">
                            <span className={`inline-block text-xs font-medium rounded px-2 py-0.5 ${color}`}>
                              {label}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-xs text-gray-400 hidden sm:table-cell">
                            {entry.old_type && entry.new_type
                              ? `${entry.old_type} → ${entry.new_type}`
                              : entry.new_type ?? entry.old_type ?? '—'
                            }
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
