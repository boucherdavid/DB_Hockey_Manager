'use client'

import { useState, useTransition } from 'react'
import {
  createRoundAction,
  updateRoundAction,
  activateRoundAction,
  transitionToNextRoundAction,
  markTeamEliminatedAction,
  removeEliminationAction,
} from '@/app/gestion-series/actions'
import type {
  PlayoffSaison,
  PlayoffRound,
  EliminatedTeam,
  AllPoolersRosters,
} from '@/app/gestion-series/actions'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const roundLabel = (n: number) => ['Ronde 1', 'Ronde 2', 'Demi-finales', 'Finale'][n - 1] ?? `Ronde ${n}`
const roundDefaults = (n: number) => (
  n === 3
    ? { maxF: '6', maxD: '4', maxG: '2' }
    : { maxF: '3', maxD: '2', maxG: '1' }
)

function toLocalDatetimeInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromLocalDatetimeInput(val: string): string | null {
  if (!val) return null
  return new Date(val).toISOString()
}

// ─── Tab: Rondes ──────────────────────────────────────────────────────────────

function RondesTab({
  saison, rounds,
}: {
  saison: PlayoffSaison
  rounds: PlayoffRound[]
}) {
  const [isPending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // New round form
  const [showNew, setShowNew] = useState(false)
  const [newRound, setNewRound] = useState('1')
  const [newDeadline, setNewDeadline] = useState('')
  const [newMaxChanges, setNewMaxChanges] = useState('2')
  const [newMaxF, setNewMaxF] = useState('3')
  const [newMaxD, setNewMaxD] = useState('2')
  const [newMaxG, setNewMaxG] = useState('1')
  const [newCapPerRound, setNewCapPerRound] = useState('')

  // Edit state per round
  const [editing, setEditing] = useState<number | null>(null)
  const [editDeadline, setEditDeadline] = useState('')
  const [editMaxChanges, setEditMaxChanges] = useState('2')
  const [editMaxF, setEditMaxF] = useState('3')
  const [editMaxD, setEditMaxD] = useState('2')
  const [editMaxG, setEditMaxG] = useState('1')
  const [editCapPerRound, setEditCapPerRound] = useState('')

  function act(fn: () => Promise<{ error?: string; copied?: number }>) {
    setMsg(null)
    startTransition(async () => {
      const r = await fn()
      if (r.error) setMsg({ type: 'error', text: r.error })
      else setMsg({ type: 'success', text: r.copied ? `${r.copied} alignements copiés.` : 'Opération réussie.' })
    })
  }

  return (
    <div className="space-y-4">
      {msg && (
        <div className={`text-sm rounded p-3 ${msg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {msg.text}
        </div>
      )}

      {/* Existing rounds */}
      {rounds.map(r => (
        <div key={r.id} className={`border rounded-lg overflow-hidden ${r.isActive ? 'border-blue-400' : 'border-gray-200'}`}>
          <div className={`px-4 py-3 flex items-center justify-between gap-3 ${r.isActive ? 'bg-blue-600' : 'bg-slate-100'}`}>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-bold ${r.isActive ? 'text-white' : 'text-slate-700'}`}>
                {roundLabel(r.roundNumber)}
              </span>
              {r.isActive && <span className="text-xs bg-white text-blue-600 px-1.5 py-0.5 rounded font-bold">Active</span>}
              {r.isFrozen && <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-medium">Gelé</span>}
            </div>
            <div className="flex gap-2">
              {!r.isActive && (
                <button
                  disabled={isPending}
                  onClick={() => act(() => activateRoundAction(r.id, saison.id))}
                  className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  Activer
                </button>
              )}
              {editing === r.id ? (
                <>
                  <button
                    disabled={isPending}
                    onClick={() => act(async () => {
                      const res = await updateRoundAction(
                        r.id,
                        fromLocalDatetimeInput(editDeadline),
                        parseInt(editMaxChanges) || 2,
                        parseInt(editMaxF) || 3,
                        parseInt(editMaxD) || 2,
                        parseInt(editMaxG) || 1,
                        editCapPerRound ? parseFloat(editCapPerRound) : null,
                      )
                      if (!res.error) setEditing(null)
                      return res
                    })}
                    className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 disabled:opacity-50"
                  >
                    Enregistrer
                  </button>
                  <button onClick={() => setEditing(null)} className="text-xs text-gray-500 hover:text-gray-700">Annuler</button>
                </>
              ) : (
                <button
                  onClick={() => {
                    setEditing(r.id)
                    setEditDeadline(toLocalDatetimeInput(r.submissionDeadline))
                    setEditMaxChanges(String(r.maxChanges))
                    setEditMaxF(String(r.maxF))
                    setEditMaxD(String(r.maxD))
                    setEditMaxG(String(r.maxG))
                    setEditCapPerRound(r.capPerRound ? String(r.capPerRound) : '')
                  }}
                  className="text-xs text-gray-500 hover:text-gray-700 underline"
                >
                  Modifier
                </button>
              )}
            </div>
          </div>

          {editing === r.id ? (
            <div className="px-4 py-3 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Deadline soumission</label>
                  <input type="datetime-local" value={editDeadline} onChange={e => setEditDeadline(e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Max changements post-deadline</label>
                  <input type="number" min={0} value={editMaxChanges} onChange={e => setEditMaxChanges(e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Max F</label>
                  <input type="number" min={0} max={20} value={editMaxF} onChange={e => setEditMaxF(e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Max D</label>
                  <input type="number" min={0} max={20} value={editMaxD} onChange={e => setEditMaxD(e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Max G</label>
                  <input type="number" min={0} max={10} value={editMaxG} onChange={e => setEditMaxG(e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Cap override ($)</label>
                  <input type="number" min={0} step={1000000} value={editCapPerRound} onChange={e => setEditCapPerRound(e.target.value)}
                    placeholder="Défaut saison"
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
                </div>
              </div>
            </div>
          ) : (
            <div className="px-4 py-2 text-xs text-gray-500 flex flex-wrap gap-4">
              <span>Deadline : {r.submissionDeadline ? new Date(r.submissionDeadline).toLocaleString('fr-CA') : '—'}</span>
              <span>Composition : {r.maxF}F / {r.maxD}D / {r.maxG}G</span>
              <span>Cap : {r.capPerRound ? `${(r.capPerRound / 1_000_000).toFixed(0)} M$` : 'Défaut saison'}</span>
              <span>Max post-deadline : {r.maxChanges}</span>
            </div>
          )}

          {/* Transition to next round */}
          {r.isActive && rounds.find(x => x.roundNumber === r.roundNumber + 1) && (
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-3">
              <p className="text-xs text-gray-500">
                Copier les alignements vers {roundLabel(r.roundNumber + 1)}
              </p>
              <button
                disabled={isPending}
                onClick={() => {
                  const next = rounds.find(x => x.roundNumber === r.roundNumber + 1)!
                  act(() => transitionToNextRoundAction(r.id, next.id))
                }}
                className="text-xs bg-slate-700 text-white px-3 py-1.5 rounded hover:bg-slate-800 disabled:opacity-50"
              >
                Transitionner →
              </button>
            </div>
          )}
        </div>
      ))}

      {/* Create new round */}
      {!showNew ? (
        <button
          onClick={() => setShowNew(true)}
          className="w-full border-2 border-dashed border-gray-300 rounded-lg py-3 text-sm text-gray-400 hover:border-gray-400 hover:text-gray-600"
        >
          + Créer une ronde
        </button>
      ) : (
        <div className="border rounded-lg p-4 space-y-3">
          <p className="text-sm font-medium text-gray-700">Nouvelle ronde</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Numéro</label>
              <select value={newRound} onChange={e => {
                const value = e.target.value
                const defaults = roundDefaults(parseInt(value))
                setNewRound(value)
                setNewMaxF(defaults.maxF)
                setNewMaxD(defaults.maxD)
                setNewMaxG(defaults.maxG)
              }}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm">
                {[1, 2, 3, 4].map(n => <option key={n} value={n}>{roundLabel(n)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Deadline soumission</label>
              <input type="datetime-local" value={newDeadline} onChange={e => setNewDeadline(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Max changements post-deadline</label>
              <input type="number" min={0} value={newMaxChanges} onChange={e => setNewMaxChanges(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Max F</label>
              <input type="number" min={0} max={20} value={newMaxF} onChange={e => setNewMaxF(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Max D</label>
              <input type="number" min={0} max={20} value={newMaxD} onChange={e => setNewMaxD(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Max G</label>
              <input type="number" min={0} max={10} value={newMaxG} onChange={e => setNewMaxG(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Cap override ($)</label>
              <input type="number" min={0} step={1000000} value={newCapPerRound} onChange={e => setNewCapPerRound(e.target.value)}
                placeholder={parseInt(newRound) === 3 ? `Suggestion: ${saison.poolCap * 2}` : 'Défaut saison'}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowNew(false)} className="text-sm text-gray-500 hover:text-gray-700">Annuler</button>
            <button
              disabled={isPending}
              onClick={() => act(async () => {
                const res = await createRoundAction(
                  saison.id,
                  parseInt(newRound),
                  fromLocalDatetimeInput(newDeadline),
                  parseInt(newMaxChanges) || 2,
                  parseInt(newMaxF) || 3,
                  parseInt(newMaxD) || 2,
                  parseInt(newMaxG) || 1,
                  newCapPerRound ? parseFloat(newCapPerRound) : null,
                )
                if (!res.error) setShowNew(false)
                return res
              })}
              className="bg-blue-600 text-white text-sm px-4 py-1.5 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              Créer
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab: Éliminations ────────────────────────────────────────────────────────

function EliminationsTab({
  saison,
  eliminations,
  teams,
  activeRoundNumber,
}: {
  saison: PlayoffSaison
  eliminations: EliminatedTeam[]
  teams: { id: number; code: string; name: string }[]
  activeRoundNumber: number
}) {
  const [isPending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [selectedTeam, setSelectedTeam] = useState('')
  const [selectedRound, setSelectedRound] = useState(String(activeRoundNumber))

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

      {/* Mark eliminated */}
      <div className="border rounded-lg p-4 space-y-3">
        <p className="text-sm font-medium text-gray-700">Marquer une équipe éliminée</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Équipe</label>
            <select value={selectedTeam} onChange={e => setSelectedTeam(e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm">
              <option value="">— Choisir —</option>
              {availableTeams.map(t => <option key={t.id} value={t.id}>{t.code} — {t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Éliminée en ronde</label>
            <select value={selectedRound} onChange={e => setSelectedRound(e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm">
              {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <button
            disabled={isPending || !selectedTeam}
            onClick={() => act(async () => {
              const res = await markTeamEliminatedAction(saison.id, parseInt(selectedTeam), parseInt(selectedRound))
              if (!res.error) setSelectedTeam('')
              return res
            })}
            className="bg-red-600 text-white text-sm px-4 py-1.5 rounded hover:bg-red-700 disabled:opacity-50"
          >
            Marquer éliminée
          </button>
        </div>
      </div>

      {/* List */}
      {eliminations.length === 0 ? (
        <p className="text-sm text-gray-400">Aucune équipe éliminée enregistrée.</p>
      ) : (
        <div className="border rounded-lg divide-y divide-gray-100">
          {eliminations.map(e => (
            <div key={e.id} className="flex items-center justify-between px-4 py-2.5">
              <div>
                <span className="text-sm font-medium text-gray-800">{e.teamCode}</span>
                <span className="text-xs text-gray-500 ml-2">{e.teamName}</span>
                <span className="text-xs text-gray-400 ml-3">éliminée ronde {e.eliminatedInRound}</span>
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
  activeRound,
}: {
  allRosters: AllPoolersRosters[]
  activeRound: PlayoffRound | null
}) {
  if (!activeRound) return <p className="text-sm text-gray-400">Aucune ronde active.</p>

  const slotOrder: Record<string, number> = { F: 0, D: 1, G: 2 }

  return (
    <div className="space-y-4">
      {allRosters.map(({ poolerId, poolerName, entries }) => (
        <div key={poolerId} className="border rounded-lg overflow-hidden">
          <div className="bg-slate-100 px-4 py-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700">{poolerName}</span>
            <span className="text-xs text-gray-500">{entries.length} joueur{entries.length !== 1 ? 's' : ''}</span>
          </div>
          {entries.length === 0 ? (
            <p className="px-4 py-3 text-sm text-gray-400 italic">Aucun alignement soumis.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {[...entries].sort((a, b) => (slotOrder[a.positionSlot] ?? 3) - (slotOrder[b.positionSlot] ?? 3)).map(e => (
                <div key={e.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                  <span className={`text-xs font-bold w-5 ${e.positionSlot === 'F' ? 'text-blue-600' : e.positionSlot === 'D' ? 'text-green-600' : 'text-purple-600'}`}>
                    {e.positionSlot}
                  </span>
                  <span className="flex-1 text-gray-800">{e.lastName}, {e.firstName}</span>
                  <span className="text-xs text-gray-500">{e.teamCode}</span>
                  {e.teamEliminated && (
                    <span className="text-xs text-red-600 font-medium">⚠ ÉL.</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function SeriesAdminManager({
  saison, rounds, eliminations, teams, allRosters, activeRound,
}: {
  saison: PlayoffSaison
  rounds: PlayoffRound[]
  eliminations: EliminatedTeam[]
  teams: { id: number; code: string; name: string }[]
  allRosters: AllPoolersRosters[]
  activeRound: PlayoffRound | null
}) {
  const [tab, setTab] = useState<'rondes' | 'eliminations' | 'alignements'>('rondes')

  const tabs: { key: typeof tab; label: string }[] = [
    { key: 'rondes', label: 'Rondes' },
    { key: 'eliminations', label: 'Éliminations' },
    { key: 'alignements', label: 'Alignements' },
  ]

  return (
    <div className="space-y-4">
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

      {tab === 'rondes' && <RondesTab saison={saison} rounds={rounds} />}
      {tab === 'eliminations' && (
        <EliminationsTab
          saison={saison}
          eliminations={eliminations}
          teams={teams}
          activeRoundNumber={activeRound?.roundNumber ?? 1}
        />
      )}
      {tab === 'alignements' && <AlignmentsTab allRosters={allRosters} activeRound={activeRound} />}
    </div>
  )
}
