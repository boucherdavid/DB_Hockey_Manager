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
  delai_reactivation_jours?: number | null
  max_signatures_al?: number | null
  max_signatures_ltir?: number | null
  gestion_effectifs_ouvert?: boolean | null
  is_playoff?: boolean | null
}

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

const getNextSeasonLabel = (s: string) => {
  const y = parseInt(s.split('-')[0]) + 1
  return `${y}-${String(y + 1).slice(-2)}`
}

export default function ConfigForm({ saison }: { saison: Saison }) {
  const [nhlCap, setNhlCap] = useState(String(saison.nhl_cap))
  const [multiplier, setMultiplier] = useState(String(saison.cap_multiplier))
  const [nextNhlCap, setNextNhlCap] = useState(String(saison.next_nhl_cap ?? ''))
  const [delaiReactivation, setDelaiReactivation] = useState(String(saison.delai_reactivation_jours ?? 7))
  const [maxAl, setMaxAl] = useState(String(saison.max_signatures_al ?? 10))
  const [maxLtir, setMaxLtir] = useState(String(saison.max_signatures_ltir ?? 2))
  const [toolOuvert, setToolOuvert] = useState(saison.gestion_effectifs_ouvert ?? true)
  const [isPlayoff, setIsPlayoff] = useState(saison.is_playoff ?? false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const nhlCapNum = parseFloat(nhlCap) || 0
  const multiplierNum = parseFloat(multiplier) || 0
  const poolCapPreview = nhlCapNum > 0 && multiplierNum > 0
    ? Math.ceil((nhlCapNum * multiplierNum) / 1_000_000) * 1_000_000
    : 0
  const nextNhlCapNum = parseFloat(nextNhlCap) || 0
  const nextPoolCapPreview = nextNhlCapNum > 0 && multiplierNum > 0
    ? Math.ceil((nextNhlCapNum * multiplierNum) / 1_000_000) * 1_000_000
    : 0
  const nextSeasonLabel = getNextSeasonLabel(saison.season)

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    const result = await updateCapAction(
      saison.id, nhlCapNum, isPlayoffSeason ? 1 : multiplierNum, isPlayoffSeason ? null : (nextNhlCapNum > 0 ? nextNhlCapNum : null),
      {
        delaiReactivationJours: Math.max(0, parseInt(delaiReactivation) || 0),
        maxSignaturesAl: Math.max(0, parseInt(maxAl) || 0),
        maxSignaturesLtir: Math.max(0, parseInt(maxLtir) || 0),
        gestionEffectifsOuvert: toolOuvert,
        isPlayoff,
      },
    )
    setSaving(false)
    if (result.error) {
      setMessage({ type: 'error', text: result.error })
    } else {
      setMessage({ type: 'success', text: 'Configuration mise à jour.' })
    }
  }

  const inputCls = 'w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  const isPlayoffSeason = saison.is_playoff ?? false

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6">
      <h2 className="font-bold text-lg text-gray-800 mb-4">
        {isPlayoffSeason ? 'Configuration — Séries' : 'Plafonds salarials'}
      </h2>

      {isPlayoffSeason ? (
        /* Saison séries : cap fixe par ronde, pas de facteur */
        <div className="border rounded-lg overflow-hidden mb-5">
          <div className="bg-orange-500 px-3 py-2 flex items-center gap-2">
            <span className="text-white text-sm font-bold">{saison.season}</span>
            <span className="text-xs bg-white text-orange-600 px-1.5 py-0.5 rounded font-bold leading-none">Séries · Active</span>
          </div>
          <div className="divide-y divide-gray-100">
            <div className="px-3 py-3">
              <p className="text-xs text-gray-500 mb-1">Cap par ronde</p>
              <input
                type="number"
                min={1_000_000}
                step={1_000_000}
                value={nhlCap}
                onChange={e => setNhlCap(e.target.value)}
                className={inputCls}
              />
              <p className="text-xs text-gray-400 mt-1">Montant fixe — pas de facteur multiplicatif.</p>
            </div>
            <div className="px-3 py-3 bg-orange-50">
              <p className="text-xs text-gray-500 mb-1">Cap actuel</p>
              <p className="text-base font-bold text-orange-700 tabular-nums">
                {nhlCapNum > 0 ? fmt(nhlCapNum) : '—'}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 mb-5">
          {/* Saison courante */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-blue-600 px-3 py-2 flex items-center gap-2">
              <span className="text-white text-sm font-bold">{saison.season}</span>
              <span className="text-xs bg-white text-blue-600 px-1.5 py-0.5 rounded font-bold leading-none">Active</span>
            </div>
            <div className="divide-y divide-gray-100">
              <div className="px-3 py-3">
                <p className="text-xs text-gray-500 mb-1">Plafond NHL</p>
                <input
                  type="number"
                  min={1000000}
                  step={100000}
                  value={nhlCap}
                  onChange={e => setNhlCap(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div className="px-3 py-3">
                <p className="text-xs text-gray-500 mb-1">Facteur</p>
                <input
                  type="number"
                  min={1}
                  max={2}
                  step={0.01}
                  value={multiplier}
                  onChange={e => setMultiplier(e.target.value)}
                  className={inputCls}
                />
                {multiplierNum > 0 && (
                  <p className="text-xs text-gray-400 mt-1">{(multiplierNum * 100).toFixed(0)} % du cap NHL</p>
                )}
              </div>
              <div className="px-3 py-3 bg-blue-50">
                <p className="text-xs text-gray-500 mb-1">Cap du pool</p>
                <p className="text-base font-bold text-blue-700 tabular-nums">
                  {poolCapPreview > 0 ? fmt(poolCapPreview) : '—'}
                </p>
              </div>
            </div>
          </div>

          {/* Saison suivante */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-slate-100 px-3 py-2">
              <span className="text-slate-600 text-sm font-bold">{nextSeasonLabel}</span>
            </div>
            <div className="divide-y divide-gray-100">
              <div className="px-3 py-3">
                <p className="text-xs text-gray-500 mb-1">
                  Plafond NHL <span className="text-gray-400">(optionnel)</span>
                </p>
                <input
                  type="number"
                  min={1000000}
                  step={100000}
                  value={nextNhlCap}
                  onChange={e => setNextNhlCap(e.target.value)}
                  placeholder="ex : 104 000 000"
                  className={inputCls}
                />
              </div>
              <div className="px-3 py-3">
                <p className="text-xs text-gray-500 mb-1">Facteur</p>
                <p className="text-sm text-gray-700 font-medium tabular-nums">
                  {multiplierNum > 0 ? multiplierNum.toFixed(2) : '—'}
                </p>
                {multiplierNum > 0 && (
                  <p className="text-xs text-gray-400 mt-0.5">{(multiplierNum * 100).toFixed(0)} % du cap NHL</p>
                )}
              </div>
              <div className={`px-3 py-3 ${nextPoolCapPreview > 0 ? 'bg-indigo-50' : 'bg-gray-50'}`}>
                <p className="text-xs text-gray-500 mb-1">Cap du pool <span className="text-gray-400">(estimé)</span></p>
                <p className={`text-base font-bold tabular-nums ${nextPoolCapPreview > 0 ? 'text-indigo-600' : 'text-gray-300'}`}>
                  {nextPoolCapPreview > 0 ? fmt(nextPoolCapPreview) : '—'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="border rounded-lg overflow-hidden">
        <div className="bg-slate-100 px-3 py-2">
          <span className="text-slate-600 text-sm font-bold">Règles de transactions</span>
        </div>
        <div className="divide-y divide-gray-100">
          <div className="px-3 py-3 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-700">Outil gestion d&apos;effectifs ouvert</p>
              <p className="text-xs text-gray-400 mt-0.5">Si désactivé, seul l&apos;admin y a accès.</p>
            </div>
            <button
              type="button"
              onClick={() => setToolOuvert(v => !v)}
              className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${toolOuvert ? 'bg-blue-600' : 'bg-gray-300'}`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${toolOuvert ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
          <div className="px-3 py-3 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-700">Saison de type séries (playoffs)</p>
              <p className="text-xs text-gray-400 mt-0.5">Active les mécaniques spéciales du pool des séries.</p>
            </div>
            <button
              type="button"
              onClick={() => setIsPlayoff(v => !v)}
              className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${isPlayoff ? 'bg-blue-600' : 'bg-gray-300'}`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${isPlayoff ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
          <div className="px-3 py-3">
            <p className="text-xs text-gray-500 mb-1">
              Délai de réactivation <span className="text-gray-400">(jours)</span>
            </p>
            <input
              type="number" min={0} step={1} value={delaiReactivation}
              onChange={e => setDelaiReactivation(e.target.value)}
              className={inputCls}
            />
            <p className="text-xs text-gray-400 mt-1">
              Nombre de jours avant qu&apos;un pooler puisse réactiver un joueur qu&apos;il vient de désactiver. L&apos;admin est exempt.
            </p>
          </div>
          <div className="px-3 py-3 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">Max signatures AL</p>
              <input
                type="number" min={0} step={1} value={maxAl}
                onChange={e => setMaxAl(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Max signatures LTIR</p>
              <input
                type="number" min={0} step={1} value={maxLtir}
                onChange={e => setMaxLtir(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>
        </div>
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
