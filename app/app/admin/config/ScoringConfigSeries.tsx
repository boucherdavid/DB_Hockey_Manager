'use client'

import { useState } from 'react'
import { updateScoringAction } from './actions'

export type ScoringRow = {
  id: number
  stat_key: string
  label: string
  points: number
  points_playoffs: number | null
  scope: string
}

export default function ScoringConfigSeries({ rows }: { rows: ScoringRow[] }) {
  const visibleRows = rows.filter(r => r.scope !== 'regular')

  const [values, setValues] = useState<Record<number, string>>(
    Object.fromEntries(visibleRows.map(r => [r.id, String(r.points_playoffs ?? r.points)]))
  )
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    const updates = rows.map(r => ({
      id: r.id,
      points: r.points,
      points_playoffs: visibleRows.some(vr => vr.id === r.id)
        ? (parseFloat(values[r.id]) || 0)
        : r.points_playoffs,
    }))
    const result = await updateScoringAction(updates)
    setSaving(false)
    if (result.error) {
      setMessage({ type: 'error', text: result.error })
    } else {
      setMessage({ type: 'success', text: 'Pointage séries mis à jour.' })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 max-w-2xl">
      <div className="mb-4">
        <h3 className="font-semibold text-gray-700">Pointage par statistique — Séries</h3>
        <p className="text-sm text-gray-400 mt-0.5">Valeurs appliquées uniquement lors du pool des séries.</p>
      </div>

      <div className="space-y-1 mb-6">
        <div className="grid grid-cols-[1fr_auto] gap-x-4 items-center px-1 pb-1 border-b text-xs font-semibold text-gray-400 uppercase tracking-wide">
          <span>Statistique</span>
          <span className="text-right w-24">Points</span>
        </div>

        {visibleRows.map(r => (
          <div key={r.id} className="grid grid-cols-[1fr_auto] gap-x-4 items-center py-2 px-1 rounded hover:bg-gray-50">
            <div>
              <span className="text-sm font-medium text-gray-700">{r.label}</span>
              {r.scope === 'playoffs' && (
                <span className="ml-2 text-xs bg-orange-100 text-orange-600 rounded px-1.5 py-0.5">Séries seulement</span>
              )}
            </div>
            <div className="flex items-center gap-1 w-24 justify-end">
              <input
                type="number" min={0} max={99} step={0.5}
                value={values[r.id]}
                onChange={e => setValues(v => ({ ...v, [r.id]: e.target.value }))}
                className="w-16 border border-gray-300 rounded px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-400">pt</span>
            </div>
          </div>
        ))}
      </div>

      <button type="submit" disabled={saving}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
        {saving ? 'Enregistrement...' : 'Enregistrer'}
      </button>

      {message && (
        <p className={`mt-3 text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>{message.text}</p>
      )}
    </form>
  )
}
