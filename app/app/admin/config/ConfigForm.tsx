'use client'

import { useState } from 'react'
import { updateCapAction } from './actions'

type Saison = {
  id: number
  season: string
  nhl_cap: number
  cap_multiplier: number
  pool_cap: number
  next_nhl_cap?: number | null
}

export default function ConfigForm({ saison }: { saison: Saison }) {
  const [nhlCap, setNhlCap] = useState(String(saison.nhl_cap))
  const [multiplier, setMultiplier] = useState(String(saison.cap_multiplier))
  const [nextNhlCap, setNextNhlCap] = useState(String(saison.next_nhl_cap ?? ''))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const nhlCapNum = parseFloat(nhlCap) || 0
  const multiplierNum = parseFloat(multiplier) || 0
  const poolCapPreview = Math.ceil((nhlCapNum * multiplierNum) / 1_000_000) * 1_000_000
  const nextNhlCapNum = parseFloat(nextNhlCap) || 0
  const nextPoolCapPreview = nextNhlCapNum > 0 ? Math.ceil((nextNhlCapNum * multiplierNum) / 1_000_000) * 1_000_000 : 0

  const getNextSeasonLabel = (s: string) => {
    const y = parseInt(s.split('-')[0]) + 1
    return `${y}-${String(y + 1).slice(-2)}`
  }
  const nextSeasonLabel = getNextSeasonLabel(saison.season)

  const fmt = (n: number) =>
    new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    const result = await updateCapAction(saison.id, nhlCapNum, multiplierNum, nextNhlCapNum > 0 ? nextNhlCapNum : null)
    setSaving(false)
    if (result.error) {
      setMessage({ type: 'error', text: result.error })
    } else {
      setMessage({ type: 'success', text: 'Configuration mise à jour.' })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 max-w-md">
      <h2 className="font-bold text-lg text-gray-800 mb-4">Saison active : {saison.season}</h2>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Plafond salarial NHL officiel ($)
        </label>
        <input
          type="number"
          min={1000000}
          step={100000}
          value={nhlCap}
          onChange={e => setNhlCap(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-gray-400 mt-1">Ex : 95500000 pour 95,5 M$</p>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Facteur du pool
        </label>
        <input
          type="number"
          min={1}
          max={2}
          step={0.01}
          value={multiplier}
          onChange={e => setMultiplier(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-gray-400 mt-1">1.24 = 124 % du cap NHL, arrondi au million supérieur</p>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Plafond salarial NHL {nextSeasonLabel} ($) <span className="text-gray-400 font-normal">(optionnel)</span>
        </label>
        <input
          type="number"
          min={1000000}
          step={100000}
          value={nextNhlCap}
          onChange={e => setNextNhlCap(e.target.value)}
          placeholder="ex : 104000000"
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-gray-400 mt-1">Utilisé pour prévoir la masse salariale de la prochaine saison</p>
      </div>

      <div className="mb-6 p-3 bg-gray-50 rounded text-sm text-gray-600 space-y-1">
        <div className="flex justify-between">
          <span>Cap NHL {saison.season}</span>
          <span className="font-mono">{fmt(nhlCapNum)}</span>
        </div>
        <div className="flex justify-between">
          <span>× {multiplierNum.toFixed(2)}</span>
          <span className="font-mono">{fmt(nhlCapNum * multiplierNum)}</span>
        </div>
        <div className="flex justify-between border-t pt-1 mt-1 font-semibold text-blue-700">
          <span>Cap du pool (arrondi ↑)</span>
          <span className="font-mono">{fmt(poolCapPreview)}</span>
        </div>
        {nextPoolCapPreview > 0 && (
          <div className="flex justify-between border-t pt-1 mt-1 text-gray-500">
            <span>Cap du pool {nextSeasonLabel} (estimé)</span>
            <span className="font-mono font-semibold text-indigo-600">{fmt(nextPoolCapPreview)}</span>
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={saving || nhlCapNum < 1_000_000 || multiplierNum <= 0}
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
