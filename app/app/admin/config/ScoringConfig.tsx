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
  points_playoffs: number | null
  scope: string
}

export default function ScoringConfig({ rows }: { rows: ScoringRow[] }) {
  const [values, setValues] = useState<Record<number, string>>(
    Object.fromEntries(rows.map(r => [r.id, String(r.points)]))
  )
  const [playoffValues, setPlayoffValues] = useState<Record<number, string>>(
    Object.fromEntries(rows.map(r => [r.id, r.points_playoffs !== null ? String(r.points_playoffs) : '']))
  )
  const [playoffDiff, setPlayoffDiff] = useState<Record<number, boolean>>(
    Object.fromEntries(rows.map(r => [r.id, r.points_playoffs !== null]))
  )
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  function togglePlayoffDiff(id: number, checked: boolean) {
    setPlayoffDiff(v => ({ ...v, [id]: checked }))
    if (checked && !playoffValues[id]) {
      setPlayoffValues(v => ({ ...v, [id]: values[id] ?? '0' }))
    }
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    const updates = rows.map(r => ({
      id: r.id,
      points: parseFloat(values[r.id]) || 0,
      points_playoffs: playoffDiff[r.id] ? (parseFloat(playoffValues[r.id]) || 0) : null,
    }))
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
          Cochez &quot;Séries différent&quot; pour utiliser une valeur distincte en playoffs.
        </p>
      </div>

      <div className="space-y-1 mb-6">
        {/* En-tête */}
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 items-center px-1 pb-1 border-b text-xs font-semibold text-gray-400 uppercase tracking-wide">
          <span>Statistique</span>
          <span className="text-right w-24">Saison</span>
          <span className="text-center w-32">Séries différent</span>
          <span className="text-right w-24">Séries</span>
        </div>

        {rows.map(r => (
          <div key={r.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 items-center py-2 px-1 rounded hover:bg-gray-50">
            {/* Label + scope */}
            <div>
              <span className="text-sm font-medium text-gray-700">{r.label}</span>
              <span className="ml-2 text-xs text-gray-400">{SCOPE_LABEL[r.scope] ?? r.scope}</span>
            </div>

            {/* Points saison */}
            <div className="flex items-center gap-1 w-24 justify-end">
              <input
                type="number" min={0} max={99} step={0.5}
                value={values[r.id]}
                onChange={e => setValues(v => ({ ...v, [r.id]: e.target.value }))}
                className="w-16 border border-gray-300 rounded px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-400">pt</span>
            </div>

            {/* Checkbox différent séries */}
            <div className="flex justify-center w-32">
              {r.scope !== 'regular' && (
                <input
                  type="checkbox"
                  checked={!!playoffDiff[r.id]}
                  onChange={e => togglePlayoffDiff(r.id, e.target.checked)}
                  className="w-4 h-4 accent-blue-600 cursor-pointer"
                />
              )}
            </div>

            {/* Points playoffs — visible seulement si coché */}
            <div className="flex items-center gap-1 w-24 justify-end">
              {playoffDiff[r.id] ? (
                <>
                  <input
                    type="number" min={0} max={99} step={0.5}
                    value={playoffValues[r.id]}
                    onChange={e => setPlayoffValues(v => ({ ...v, [r.id]: e.target.value }))}
                    className="w-16 border border-blue-400 rounded px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500 bg-blue-50"
                  />
                  <span className="text-sm text-gray-400">pt</span>
                </>
              ) : (
                <span className="text-sm text-gray-300 w-16 text-right pr-1">—</span>
              )}
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
