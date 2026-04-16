'use client'

import { useState } from 'react'
import { updateScoringAction } from './actions'

const SCOPE_LABEL: Record<string, string> = {
  both: 'Saison + Séries',
  regular: 'Saison seulement',
  playoffs: 'Séries seulement',
}

export type ScoringRow = {
  id: number
  stat_key: string
  label: string
  points: number
  scope: string
}

export default function ScoringConfig({ rows }: { rows: ScoringRow[] }) {
  const [values, setValues] = useState<Record<number, string>>(
    Object.fromEntries(rows.map(r => [r.id, String(r.points)]))
  )
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    const updates = rows.map(r => ({ id: r.id, points: parseFloat(values[r.id]) || 0 }))
    const result = await updateScoringAction(updates)
    setSaving(false)

    if (result.error) {
      setMessage({ type: 'error', text: result.error })
    } else {
      setMessage({ type: 'success', text: 'Pointage mis à jour.' })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6">
      <div className="mb-4">
        <h2 className="font-bold text-lg text-gray-800">Pointage par statistique</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Points attribués par unité statistique, saison régulière et séries.
        </p>
      </div>

      <div className="space-y-3 mb-6">
        {rows.map(r => (
          <div key={r.id} className="flex items-center gap-3">
            <div className="flex-1">
              <span className="text-sm font-medium text-gray-700">{r.label}</span>
              <span className="ml-2 text-xs text-gray-400">{SCOPE_LABEL[r.scope] ?? r.scope}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={0}
                max={99}
                step={0.5}
                value={values[r.id]}
                onChange={e => setValues(v => ({ ...v, [r.id]: e.target.value }))}
                className="w-20 border border-gray-300 rounded px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-400 w-6">pt{parseFloat(values[r.id] ?? '0') !== 1 ? 's' : ''}</span>
            </div>
          </div>
        ))}
      </div>

      <button
        type="submit"
        disabled={saving}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
      >
        {saving ? 'Enregistrement...' : 'Enregistrer'}
      </button>

      {message && (
        <p className={`mt-3 text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
          {message.text}
        </p>
      )}
    </form>
  )
}
