'use client'

import { useState, useRef } from 'react'
import { searchPlayersAction, mergePlayersAction, type PlayerSearchResult } from './merge-actions'

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

function PlayerSearch({
  label,
  selected,
  onSelect,
  excludeId,
}: {
  label: string
  selected: PlayerSearchResult | null
  onSelect: (p: PlayerSearchResult) => void
  excludeId?: number
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PlayerSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleChange = (q: string) => {
    setQuery(q)
    if (timer.current) clearTimeout(timer.current)
    if (q.trim().length < 2) { setResults([]); return }
    timer.current = setTimeout(async () => {
      setSearching(true)
      const res = await searchPlayersAction(q)
      setResults(res.filter(p => p.id !== excludeId))
      setSearching(false)
    }, 300)
  }

  const handleSelect = (p: PlayerSearchResult) => {
    onSelect(p)
    setQuery('')
    setResults([])
  }

  return (
    <div className="flex-1">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{label}</p>

      {selected ? (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold text-gray-800">{selected.last_name}, {selected.first_name}</p>
              <p className="text-sm text-gray-500 mt-0.5">
                {selected.teams?.code ?? '—'} · {selected.position ?? '—'}
                {selected.is_rookie && <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">Recrue</span>}
              </p>
              <p className="text-xs text-gray-400 mt-1">ID #{selected.id} {selected.nhl_id ? `· NHL #${selected.nhl_id}` : '· nhl_id manquant'}</p>
              {selected.player_contracts.length > 0 && (
                <p className="text-xs text-gray-400 mt-0.5">
                  Contrats : {selected.player_contracts.map(c => `${c.season} (${fmt(c.cap_number)})`).join(', ')}
                </p>
              )}
            </div>
            <button
              onClick={() => { onSelect(null as never) }}
              className="text-xs text-gray-400 hover:text-gray-600 ml-2"
            >
              ✕
            </button>
          </div>
        </div>
      ) : (
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={e => handleChange(e.target.value)}
            placeholder="Rechercher par nom..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {searching && <p className="text-xs text-gray-400 mt-1">Recherche...</p>}
          {results.length > 0 && (
            <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
              {results.map(p => (
                <button
                  key={p.id}
                  onClick={() => handleSelect(p)}
                  className="w-full text-left px-3 py-2.5 hover:bg-gray-50 border-b last:border-0 text-sm"
                >
                  <span className="font-medium text-gray-800">{p.last_name}, {p.first_name}</span>
                  <span className="ml-2 text-gray-400 text-xs">{p.teams?.code ?? '—'} · {p.position ?? '—'} · #{p.id}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function PlayerMerge() {
  const [keepPlayer, setKeepPlayer] = useState<PlayerSearchResult | null>(null)
  const [dupPlayer, setDupPlayer] = useState<PlayerSearchResult | null>(null)
  const [merging, setMerging] = useState(false)
  const [result, setResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleMerge = async () => {
    if (!keepPlayer || !dupPlayer) return
    if (!window.confirm(
      `Fusionner "${dupPlayer.last_name}, ${dupPlayer.first_name}" (doublon) → "${keepPlayer.last_name}, ${keepPlayer.first_name}" (à garder) ?\n\n` +
      `Le joueur #${dupPlayer.id} sera définitivement supprimé. Cette action est irréversible.`
    )) return

    setMerging(true)
    setResult(null)
    const res = await mergePlayersAction(keepPlayer.id, dupPlayer.id)
    setMerging(false)

    if (res.error) {
      setResult({ type: 'error', text: res.error })
    } else {
      setResult({ type: 'success', text: res.summary ?? 'Fusion réussie.' })
      setKeepPlayer(null)
      setDupPlayer(null)
    }
  }

  const canMerge = keepPlayer !== null && dupPlayer !== null

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-800">Fusion de doublons</h2>
        <p className="text-sm text-gray-500 mt-1">
          Quand un même joueur existe en double (ex. nom différent ou suite à un échange), fusionner les deux enregistrements en un seul.
          Tous les rosters, contrats et logs sont redirigés vers le joueur à garder, puis le doublon est supprimé.
        </p>
      </div>

      <div className="flex gap-6 items-start">
        <PlayerSearch
          label="Joueur à garder ✓"
          selected={keepPlayer}
          onSelect={setKeepPlayer}
          excludeId={dupPlayer?.id}
        />

        <div className="flex items-center pt-8 text-gray-400 font-bold text-lg">←</div>

        <PlayerSearch
          label="Doublon à supprimer ✕"
          selected={dupPlayer}
          onSelect={setDupPlayer}
          excludeId={keepPlayer?.id}
        />
      </div>

      {canMerge && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
          <strong>Attention :</strong> &quot;{dupPlayer!.last_name}, {dupPlayer!.first_name}&quot; (#{dupPlayer!.id}) sera
          définitivement supprimé. Tous ses rosters et contrats seront fusionnés dans &quot;{keepPlayer!.last_name}, {keepPlayer!.first_name}&quot; (#{keepPlayer!.id}).
        </div>
      )}

      <button
        onClick={handleMerge}
        disabled={!canMerge || merging}
        className="px-5 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {merging ? 'Fusion en cours...' : 'Fusionner les joueurs'}
      </button>

      {result && (
        <p className={`text-sm font-medium ${result.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
          {result.text}
        </p>
      )}
    </div>
  )
}
