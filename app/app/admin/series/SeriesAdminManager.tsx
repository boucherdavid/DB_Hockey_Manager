'use client'

import { useState, useTransition } from 'react'
import {
  markTeamEliminatedAction,
  removeEliminationAction,
} from './series-admin-actions'
import {
  getPlayoffPoolStandingsAction,
} from '@/app/gestion-series/playoff-pool-actions'
import type {
  PlayoffPoolSaison,
  PlayoffPoolEntry,
  PlayoffPoolStanding,
} from '@/app/gestion-series/playoff-pool-actions'
import type { EliminatedTeam } from './series-admin-actions'

// ─── Tab: Éliminations ────────────────────────────────────────────────────────

function EliminationsTab({
  saison,
  eliminations,
  teams,
}: {
  saison: PlayoffPoolSaison
  eliminations: EliminatedTeam[]
  teams: { id: number; code: string; name: string }[]
}) {
  const [isPending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [selectedTeam, setSelectedTeam] = useState('')

  const eliminatedIds = new Set(eliminations.map(e => e.teamId))
  const availableTeams = teams.filter(t => !eliminatedIds.has(t.id))

  function act(fn: () => Promise<{ error?: string }>) {
    setMsg(null)
    startTransition(async () => {
      const r = await fn()
      if (r.error) setMsg({ type: 'error', text: r.error })
      else setMsg({ type: 'success', text: 'Opération réussie.' })
    })
  }

  return (
    <div className="space-y-4">
      {msg && (
        <div className={`text-sm rounded p-3 ${msg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {msg.text}
        </div>
      )}

      <div className="border rounded-lg p-4 space-y-3">
        <p className="text-sm font-medium text-gray-700">Marquer une équipe éliminée</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Équipe</label>
            <select value={selectedTeam} onChange={e => setSelectedTeam(e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm">
              <option value="">— Choisir —</option>
              {availableTeams.map(t => <option key={t.id} value={t.id}>{t.code} — {t.name}</option>)}
            </select>
          </div>
          <button
            disabled={isPending || !selectedTeam}
            onClick={() => act(async () => {
              const res = await markTeamEliminatedAction(saison.id, parseInt(selectedTeam))
              if (!res.error) setSelectedTeam('')
              return res
            })}
            className="bg-red-600 text-white text-sm px-4 py-1.5 rounded hover:bg-red-700 disabled:opacity-50"
          >
            Marquer éliminée
          </button>
        </div>
      </div>

      {eliminations.length === 0 ? (
        <p className="text-sm text-gray-400">Aucune équipe éliminée enregistrée.</p>
      ) : (
        <div className="border rounded-lg divide-y divide-gray-100">
          {eliminations.map(e => (
            <div key={e.id} className="flex items-center justify-between px-4 py-2.5">
              <div>
                <span className="text-sm font-medium text-gray-800">{e.teamCode}</span>
                <span className="text-xs text-gray-500 ml-2">{e.teamName}</span>
              </div>
              <button
                disabled={isPending}
                onClick={() => act(() => removeEliminationAction(e.id))}
                className="text-xs text-red-400 hover:text-red-600"
              >
                Retirer
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Tab: Alignements ─────────────────────────────────────────────────────────

function AlignmentsTab({
  allRosters,
  saison,
}: {
  allRosters: { poolerId: string; poolerName: string; entries: PlayoffPoolEntry[] }[]
  saison: PlayoffPoolSaison
}) {
  const slotOrder: Record<string, number> = { F: 0, D: 1, G: 2 }
  const slotColor: Record<string, string> = { F: 'text-blue-600', D: 'text-green-600', G: 'text-purple-600' }

  return (
    <div className="space-y-4">
      {allRosters.map(({ poolerId, poolerName, entries }) => (
        <div key={poolerId} className="border rounded-lg overflow-hidden">
          <div className="bg-slate-100 px-4 py-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700">{poolerName}</span>
            <span className="text-xs text-gray-500">{entries.length} / {saison.maxF + saison.maxD + saison.maxG} joueurs</span>
          </div>
          {entries.length === 0 ? (
            <p className="px-4 py-3 text-sm text-gray-400 italic">Aucun alignement soumis.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {[...entries]
                .sort((a, b) => (slotOrder[a.positionSlot] ?? 3) - (slotOrder[b.positionSlot] ?? 3))
                .map((e, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-2 text-sm">
                    <span className={`text-xs font-bold w-5 ${slotColor[e.positionSlot]}`}>{e.positionSlot}</span>
                    <span className="flex-1 text-gray-800">{e.lastName}, {e.firstName}</span>
                    <span className="text-xs text-gray-500">{e.teamCode}</span>
                    {e.teamEliminated && <span className="text-xs text-red-600 font-medium">⚠ ÉL.</span>}
                  </div>
                ))
              }
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Tab: Scoring ─────────────────────────────────────────────────────────────

function ScoringTab({ poolSeasonId }: { poolSeasonId: number }) {
  const [standings, setStandings] = useState<PlayoffPoolStanding[]>([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function calculate() {
    setLoading(true)
    setMsg(null)
    try {
      const s = await getPlayoffPoolStandingsAction(poolSeasonId)
      setStandings(s)
      if (s.length === 0) setMsg('Aucune donnée de scoring disponible. Des snapshots doivent être pris lors des changements.')
    } catch {
      setMsg('Erreur lors du calcul.')
    }
    setLoading(false)
  }

  return (
    <div className="space-y-4">
      <div className="border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-medium text-gray-700">Classement en direct</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Les points sont calculés automatiquement à chaque changement (snapshot activation/désactivation via API NHL playoffs).
            </p>
          </div>
          <button
            onClick={calculate}
            disabled={loading}
            className="bg-gray-800 text-white text-sm px-4 py-2 rounded hover:bg-gray-900 disabled:opacity-50"
          >
            {loading ? 'Calcul...' : 'Calculer'}
          </button>
        </div>
        {msg && <p className="text-xs text-gray-500">{msg}</p>}
      </div>

      {standings.length > 0 && (
        <div className="space-y-3">
          {standings.map((s, i) => (
            <div key={s.poolerId} className="border rounded-lg overflow-hidden">
              <div className="bg-slate-50 px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-400 w-5">#{i + 1}</span>
                  <span className="text-sm font-semibold text-gray-800">{s.poolerName}</span>
                </div>
                <span className="text-sm font-bold text-blue-700">{s.totalPoints.toFixed(1)} pts</span>
              </div>
              <div className="divide-y divide-gray-50">
                {s.players.map(p => (
                  <div key={p.playerId} className="flex items-center gap-2 px-4 py-1.5 text-xs text-gray-600">
                    <span className={`font-bold w-4 ${p.positionSlot === 'F' ? 'text-blue-500' : p.positionSlot === 'D' ? 'text-green-500' : 'text-purple-500'}`}>
                      {p.positionSlot}
                    </span>
                    <span className="flex-1">{p.lastName}, {p.firstName}</span>
                    <span className="text-gray-400">{p.teamCode}</span>
                    {!p.isActive && <span className="text-gray-300 text-xs">retiré</span>}
                    <span className="text-gray-500 tabular-nums">{p.goals}B {p.assists}A</span>
                    {(p.goalieWins > 0 || p.goalieOtl > 0) && (
                      <span className="text-gray-500 tabular-nums">{p.goalieWins}V {p.goalieOtl}DP</span>
                    )}
                    <span className="font-semibold text-blue-600 tabular-nums w-14 text-right">{p.points.toFixed(1)} pts</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function SeriesAdminManager({
  saison, eliminations, teams, allRosters,
}: {
  saison: PlayoffPoolSaison
  eliminations: EliminatedTeam[]
  teams: { id: number; code: string; name: string }[]
  allRosters: { poolerId: string; poolerName: string; entries: PlayoffPoolEntry[] }[]
}) {
  const [tab, setTab] = useState<'eliminations' | 'alignements' | 'scoring'>('eliminations')

  const tabs: { key: typeof tab; label: string }[] = [
    { key: 'eliminations', label: 'Éliminations' },
    { key: 'alignements', label: 'Alignements' },
    { key: 'scoring', label: 'Scoring' },
  ]

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow p-4 text-sm text-gray-600 flex flex-wrap gap-4">
        <span>Composition requise : <strong>{saison.maxF}F / {saison.maxD}D / {saison.maxG}G</strong></span>
        <span>Changements volontaires max : <strong>{saison.maxChanges}</strong></span>
        <span>Changements élimination max : <strong>{saison.maxElimChanges}</strong></span>
        <span>Deadline : <strong>{saison.submissionDeadline ? new Date(saison.submissionDeadline).toLocaleString('fr-CA', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : 'Aucune'}</strong></span>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'eliminations' && <EliminationsTab saison={saison} eliminations={eliminations} teams={teams} />}
      {tab === 'alignements' && <AlignmentsTab allRosters={allRosters} saison={saison} />}
      {tab === 'scoring' && <ScoringTab poolSeasonId={saison.id} />}
    </div>
  )
}
