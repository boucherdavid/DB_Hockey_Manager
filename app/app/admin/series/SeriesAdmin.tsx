'use client'

import { useState } from 'react'
import {
  createPlayoffSeasonAction,
  activatePlayoffSeasonAction,
  advanceRoundAction,
} from '@/app/series/actions'

const ROUND_LABEL = ['Quart de finale', 'Demi-finale', 'Finale de conférence', 'Finale de la Coupe Stanley']

export type PlayoffSeason = {
  id: number
  season: string
  current_round: number
  is_active: boolean
  cap_per_round: number
}

export default function SeriesAdmin({ seasons }: { seasons: PlayoffSeason[] }) {
  const [newSeason, setNewSeason] = useState('')
  const [cap, setCap] = useState('25000000')
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleCreate(e: React.FormEvent) {
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
    const res = await activatePlayoffSeasonAction(id)
    setBusy(false)
    if (res.error) setMsg({ type: 'err', text: res.error })
    else setMsg({ type: 'ok', text: 'Saison activée.' })
  }

  async function handleAdvance(id: number) {
    if (!confirm('Avancer à la prochaine ronde ? Les poolers pourront modifier leurs picks.')) return
    setBusy(true)
    const res = await advanceRoundAction(id)
    setBusy(false)
    if (res.error) setMsg({ type: 'err', text: res.error })
    else setMsg({ type: 'ok', text: 'Ronde avancée.' })
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
            {seasons.map(ps => (
              <div key={ps.id} className="flex items-center gap-4 px-5 py-4">
                <div className="flex-1">
                  <span className="font-semibold text-gray-800">{ps.season}</span>
                  {ps.is_active && (
                    <span className="ml-2 text-xs bg-green-100 text-green-700 rounded px-2 py-0.5">Active</span>
                  )}
                  <div className="text-sm text-gray-500 mt-0.5">
                    Ronde {ps.current_round} — {ROUND_LABEL[ps.current_round - 1] ?? `Ronde ${ps.current_round}`}
                    &nbsp;·&nbsp;
                    Cap {(ps.cap_per_round / 1_000_000).toFixed(1)} M$
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  {!ps.is_active && (
                    <button
                      onClick={() => handleActivate(ps.id)}
                      disabled={busy}
                      className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      Activer
                    </button>
                  )}
                  {ps.is_active && ps.current_round < 4 && (
                    <button
                      onClick={() => handleAdvance(ps.id)}
                      disabled={busy}
                      className="text-sm bg-orange-500 text-white px-3 py-1.5 rounded hover:bg-orange-600 disabled:opacity-50"
                    >
                      Ronde suivante →
                    </button>
                  )}
                  {ps.is_active && ps.current_round >= 4 && (
                    <span className="text-sm text-gray-400 italic">Finale en cours</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Créer une nouvelle saison */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="font-bold text-lg text-gray-800 mb-4">Nouvelle saison playoffs</h2>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Saison (ex: 2025-26)</label>
              <input
                type="text"
                value={newSeason}
                onChange={e => setNewSeason(e.target.value)}
                placeholder="2025-26"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cap par ronde ($)</label>
              <input
                type="number"
                value={cap}
                onChange={e => setCap(e.target.value)}
                min={1_000_000}
                step={500_000}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? 'En cours...' : 'Créer'}
          </button>
          {msg && (
            <p className={`text-sm ${msg.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}>{msg.text}</p>
          )}
        </form>
      </div>
    </div>
  )
}
