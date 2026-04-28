'use client'

import { useState } from 'react'
import {
  createPlayoffSeasonAction,
  activatePlayoffSeasonAction,
  advanceRoundAction,
  startScoringAction,
  deletePlayoffSeasonAction,
  updateCapAction,
  togglePicksLockAction,
} from '@/app/series/actions'

const ROUND_LABEL = ['Quart de finale', 'Demi-finale', 'Finale de conférence', 'Finale de la Coupe Stanley']

export type PlayoffSeason = {
  id: number
  season: string
  current_round: number
  is_active: boolean
  cap_per_round: number
  scoring_start_at: string | null
  picks_locked: boolean
}

export type PicksCount = {
  playoff_season_id: number
  pooler_count: number
  total_poolers: number
}

export default function SeriesAdmin({
  seasons,
  picksCounts,
}: {
  seasons: PlayoffSeason[]
  picksCounts: PicksCount[]
}) {
  const [newSeason, setNewSeason] = useState('')
  const [cap, setCap] = useState('25000000')
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [editingCapId, setEditingCapId] = useState<number | null>(null)
  const [editingCapValue, setEditingCapValue] = useState('')

  function getPicksCount(id: number) {
    return picksCounts.find(p => p.playoff_season_id === id)
  }

  async function handleCreate(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    const res = await createPlayoffSeasonAction(newSeason.trim(), parseFloat(cap) || 25_000_000)
    setBusy(false)
    if (res.error) setMsg({ type: 'err', text: res.error })
    else { setMsg({ type: 'ok', text: 'Saison créée.' }); setNewSeason('') }
  }

  async function handleActivate(id: number) {
    setBusy(true)
    setMsg(null)
    const res = await activatePlayoffSeasonAction(id)
    setBusy(false)
    if (res.error) setMsg({ type: 'err', text: res.error })
    else setMsg({ type: 'ok', text: 'Saison activée.' })
  }

  async function handleDelete(id: number) {
    if (!confirm('Supprimer cette saison playoff et tous ses picks ?')) return
    setBusy(true)
    setMsg(null)
    const res = await deletePlayoffSeasonAction(id)
    setBusy(false)
    if (res.error) setMsg({ type: 'err', text: res.error })
    else setMsg({ type: 'ok', text: 'Saison supprimée.' })
  }

  async function handleUpdateCap(id: number) {
    const val = parseFloat(editingCapValue)
    if (!val || val < 1_000_000) { setMsg({ type: 'err', text: 'Cap invalide.' }); return }
    setBusy(true)
    setMsg(null)
    const res = await updateCapAction(id, val)
    setBusy(false)
    if (res.error) setMsg({ type: 'err', text: res.error })
    else { setMsg({ type: 'ok', text: 'Cap mis à jour.' }); setEditingCapId(null) }
  }

  async function handleAdvance(id: number) {
    if (!confirm('Avancer à la prochaine ronde ? Les poolers pourront modifier leurs choix.')) return
    setBusy(true)
    setMsg(null)
    const res = await advanceRoundAction(id)
    setBusy(false)
    if (res.error) setMsg({ type: 'err', text: res.error })
    else setMsg({ type: 'ok', text: 'Ronde avancée.' })
  }

  async function handleToggleLock(id: number, locked: boolean) {
    const label = locked ? 'verrouiller' : 'rouvrir'
    if (!confirm(`${locked ? 'Verrouiller' : 'Rouvrir'} les choix des poolers ?`)) return
    setBusy(true)
    setMsg(null)
    const res = await togglePicksLockAction(id, locked)
    setBusy(false)
    if (res.error) setMsg({ type: 'err', text: res.error })
    else setMsg({ type: 'ok', text: `Choix ${label === 'verrouiller' ? 'verrouillés' : 'rouverts'}.` })
  }

  async function handleStartScoring(id: number, picksCount: PicksCount | undefined) {
    const total = picksCount?.total_poolers ?? 0
    const submitted = picksCount?.pooler_count ?? 0
    const missing = total - submitted

    const confirmMsg = missing > 0
      ? `${submitted}/${total} poolers ont soumis leurs choix. ${missing} n'ont pas encore de choix. Démarrer quand même ?`
      : `Tous les poolers ont soumis leurs choix. Démarrer la comptabilisation ?`

    if (!confirm(confirmMsg)) return
    setBusy(true)
    setMsg(null)
    const res = await startScoringAction(id)
    setBusy(false)
    if (res.error) setMsg({ type: 'err', text: res.error })
    else setMsg({ type: 'ok', text: `Comptabilisation démarrée. ${res.updated} choix verrouillés.` })
  }

  return (
    <div className="space-y-6">
      {/* Saisons existantes */}
      {seasons.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="bg-slate-800 px-5 py-3">
            <h2 className="text-white font-bold text-sm uppercase tracking-wide">Saisons playoffs</h2>
          </div>
          <div className="divide-y">
            {seasons.map(ps => {
              const pc = getPicksCount(ps.id)
              return (
                <div key={ps.id} className="px-5 py-4 space-y-3">
                  <div className="flex items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-800">{ps.season}</span>
                        {ps.is_active && (
                          <span className="text-xs bg-green-100 text-green-700 rounded px-2 py-0.5">Active</span>
                        )}
                        {ps.scoring_start_at && (
                          <span className="text-xs bg-blue-100 text-blue-700 rounded px-2 py-0.5">Comptabilisation en cours</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500 mt-0.5">
                        Ronde {ps.current_round} — {ROUND_LABEL[ps.current_round - 1] ?? `Ronde ${ps.current_round}`}
                        &nbsp;·&nbsp;
                        {editingCapId === ps.id ? (
                          <span className="inline-flex items-center gap-1">
                            <input
                              type="number" value={editingCapValue}
                              onChange={e => setEditingCapValue(e.target.value)}
                              min={1_000_000} step={500_000}
                              className="border border-gray-300 rounded px-2 py-0.5 text-xs w-32 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <button onClick={() => handleUpdateCap(ps.id)} disabled={busy}
                              className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded hover:bg-blue-700 disabled:opacity-50">✓</button>
                            <button onClick={() => setEditingCapId(null)}
                              className="text-xs text-gray-500 hover:text-gray-700">✕</button>
                          </span>
                        ) : (
                          <span>
                            Cap {(ps.cap_per_round / 1_000_000).toFixed(1)} M$
                            {!ps.scoring_start_at && (
                              <button onClick={() => { setEditingCapId(ps.id); setEditingCapValue(String(ps.cap_per_round)) }}
                                className="ml-1 text-xs text-blue-500 hover:underline">modifier</button>
                            )}
                          </span>
                        )}
                      </div>
                      {pc && (
                        <div className="text-sm mt-1">
                          <span className={pc.pooler_count === pc.total_poolers ? 'text-green-600 font-medium' : 'text-orange-600'}>
                            {pc.pooler_count}/{pc.total_poolers} poolers ont soumis leurs choix
                          </span>
                        </div>
                      )}
                      {ps.scoring_start_at && (
                        <div className="text-xs text-gray-400 mt-0.5">
                          Démarrée le {new Date(ps.scoring_start_at).toLocaleString('fr-CA')}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 shrink-0 items-end">
                      {!ps.is_active && (
                        <button onClick={() => handleActivate(ps.id)} disabled={busy}
                          className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 disabled:opacity-50">
                          Activer
                        </button>
                      )}
                      {ps.is_active && !ps.scoring_start_at && (
                        <button onClick={() => handleStartScoring(ps.id, pc)} disabled={busy}
                          className="text-sm bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700 disabled:opacity-50">
                          Démarrer la comptabilisation
                        </button>
                      )}
                      {ps.is_active && ps.scoring_start_at && (
                        <button onClick={() => handleToggleLock(ps.id, !ps.picks_locked)} disabled={busy}
                          className={`text-sm px-3 py-1.5 rounded disabled:opacity-50 ${
                            ps.picks_locked
                              ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              : 'bg-amber-500 text-white hover:bg-amber-600'
                          }`}>
                          {ps.picks_locked ? 'Rouvrir les choix' : 'Verrouiller les choix'}
                        </button>
                      )}
                      {ps.is_active && ps.current_round < 4 && (
                        <button onClick={() => handleAdvance(ps.id)} disabled={busy}
                          className="text-sm bg-orange-500 text-white px-3 py-1.5 rounded hover:bg-orange-600 disabled:opacity-50">
                          Ronde suivante →
                        </button>
                      )}
                      {ps.is_active && ps.current_round >= 4 && (
                        <span className="text-sm text-gray-400 italic">Finale en cours</span>
                      )}
                      {!ps.is_active && !ps.scoring_start_at && (
                        <button onClick={() => handleDelete(ps.id)} disabled={busy}
                          className="text-sm text-red-500 hover:text-red-700 disabled:opacity-50">
                          Supprimer
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {msg && (
        <p className={`text-sm px-1 ${msg.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}>{msg.text}</p>
      )}

      {/* Créer une nouvelle saison */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="font-bold text-lg text-gray-800 mb-4">Nouvelle saison playoffs</h2>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Saison (ex: 2025-26)</label>
              <input type="text" value={newSeason} onChange={e => setNewSeason(e.target.value)}
                placeholder="2025-26" required
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cap par ronde ($)</label>
              <input type="number" value={cap} onChange={e => setCap(e.target.value)}
                min={1_000_000} step={500_000}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <button type="submit" disabled={busy}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {busy ? 'En cours...' : 'Créer'}
          </button>
        </form>
      </div>
    </div>
  )
}
