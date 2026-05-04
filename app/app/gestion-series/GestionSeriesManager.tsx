'use client'

import { useState, useEffect, useTransition } from 'react'
import {
  getPlayoffPoolRosterAction,
  getPlayoffChangeCountsAction,
  searchPlayoffPoolPlayersAction,
  submitPlayoffPoolChangeAction,
} from './playoff-pool-actions'
import type {
  PlayoffPoolSaison,
  PlayoffPoolEntry,
  PlayoffPoolPlayerResult,
} from './playoff-pool-actions'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const capFmt = (n: number | null) =>
  n == null ? '—' : new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

const slotLabel: Record<'F' | 'D' | 'G', string> = { F: 'Attaquant', D: 'Défenseur', G: 'Gardien' }
const slotColor: Record<'F' | 'D' | 'G', string> = {
  F: 'bg-blue-50 border-blue-200',
  D: 'bg-green-50 border-green-200',
  G: 'bg-purple-50 border-purple-200',
}
const slotTextColor: Record<'F' | 'D' | 'G', string> = {
  F: 'text-blue-600', D: 'text-green-600', G: 'text-purple-600',
}

function deadlineLabel(deadline: string | null): string {
  if (!deadline) return 'Aucune deadline'
  return new Date(deadline).toLocaleString('fr-CA', {
    day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  })
}

// ─── Player search ────────────────────────────────────────────────────────────

function PlayerSearch({
  poolSeasonId, season, onSelect, excludeIds,
}: {
  poolSeasonId: number
  season: string
  onSelect: (p: PlayoffPoolPlayerResult) => void
  excludeIds: Set<number>
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PlayoffPoolPlayerResult[]>([])
  const [selected, setSelected] = useState<PlayoffPoolPlayerResult | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (query.length < 2) { setResults([]); return }
    const t = setTimeout(async () => {
      setLoading(true)
      setResults(await searchPlayoffPoolPlayersAction(query, poolSeasonId, season))
      setLoading(false)
    }, 300)
    return () => clearTimeout(t)
  }, [query, poolSeasonId, season])

  if (selected) return (
    <div className="flex items-center gap-2 border border-green-300 bg-green-50 rounded px-3 py-2 text-sm">
      <span className="flex-1 font-medium">{selected.lastName}, {selected.firstName}</span>
      <span className="text-xs text-gray-500">{selected.teamCode}</span>
      {selected.teamEliminated && <span className="text-xs text-red-600 font-medium">ÉLIMINÉ</span>}
      {selected.capNumber != null && <span className="text-xs text-gray-400">{capFmt(selected.capNumber)}</span>}
      <button onClick={() => { setSelected(null); setQuery('') }} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
    </div>
  )

  return (
    <div className="relative">
      <input
        type="text" value={query} onChange={e => setQuery(e.target.value)}
        placeholder="Rechercher un joueur..."
        className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
      {loading && <p className="text-xs text-gray-400 mt-1">Recherche...</p>}
      {results.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded shadow-lg max-h-48 overflow-y-auto">
          {results.filter(p => !excludeIds.has(p.id)).map(p => (
            <button
              key={p.id}
              onClick={() => { setSelected(p); setResults([]); setQuery(''); onSelect(p) }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center gap-2 ${p.teamEliminated ? 'opacity-50' : ''}`}
              disabled={p.teamEliminated}
            >
              <span className="flex-1">{p.lastName}, {p.firstName}</span>
              <span className="text-xs text-gray-500">{p.teamCode} — {p.position}</span>
              {p.teamEliminated && <span className="text-xs text-red-500">ÉL.</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Slot row ─────────────────────────────────────────────────────────────────

function SlotRow({
  slot, index, entry, isLocked, isAdmin,
  onRemove,
}: {
  slot: 'F' | 'D' | 'G'
  index: number
  entry: PlayoffPoolEntry | undefined
  isLocked: boolean
  isAdmin: boolean
  onRemove: (entry: PlayoffPoolEntry, isElim: boolean) => void
}) {
  const canRemove = !isLocked || isAdmin || (isLocked && !!entry?.teamEliminated)

  return (
    <div className={`border rounded-lg p-3 ${slotColor[slot]}`}>
      <p className="text-xs font-semibold text-gray-500 mb-1">{slotLabel[slot]} {index + 1}</p>
      {entry ? (
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <span className="text-sm font-medium text-gray-800">{entry.lastName}, {entry.firstName}</span>
            <span className="text-xs text-gray-500 ml-2">{entry.teamCode} — {entry.position}</span>
            {entry.teamEliminated && <span className="ml-2 text-xs text-red-600 font-semibold">⚠ Équipe éliminée</span>}
          </div>
          {entry.capNumber != null && <span className="text-xs text-gray-400 tabular-nums">{capFmt(entry.capNumber)}</span>}
          {canRemove && (
            <button
              onClick={() => onRemove(entry, isLocked && !!entry.teamEliminated)}
              className="text-xs text-red-400 hover:text-red-600 shrink-0"
            >
              Retirer
            </button>
          )}
          {isLocked && !isAdmin && !entry.teamEliminated && (
            <span className="text-xs text-gray-400">🔒</span>
          )}
        </div>
      ) : (
        <p className="text-sm text-gray-400 italic">— Vide —</p>
      )}
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function GestionSeriesManager({
  isAdmin, poolers, selfPoolerId, selfPoolerName, saison,
}: {
  isAdmin: boolean
  poolers?: { id: string; name: string }[]
  selfPoolerId: string
  selfPoolerName: string
  saison: PlayoffPoolSaison
}) {
  const [poolerId, setPoolerId] = useState(selfPoolerId)
  const [entries, setEntries] = useState<PlayoffPoolEntry[]>([])
  const [counts, setCounts] = useState({ voluntary: 0, elimination: 0 })
  const [loading, setLoading] = useState(true)

  const [removingEntry, setRemovingEntry] = useState<PlayoffPoolEntry | null>(null)
  const [isElimReplacement, setIsElimReplacement] = useState(false)
  const [addSlot, setAddSlot] = useState<'F' | 'D' | 'G'>('F')
  const [addPlayer, setAddPlayer] = useState<PlayoffPoolPlayerResult | null>(null)
  const [searchKey, setSearchKey] = useState(0)

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  const isLocked = saison.submissionDeadline ? new Date() > new Date(saison.submissionDeadline) : false
  const poolerName = poolers?.find(p => p.id === poolerId)?.name ?? selfPoolerName

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getPlayoffPoolRosterAction(poolerId, saison.id, saison.season),
      getPlayoffChangeCountsAction(poolerId, saison.id),
    ]).then(([r, c]) => {
      setEntries(r)
      setCounts(c)
      setLoading(false)
    })
  }, [poolerId, saison.id, saison.season])

  function resetForm() {
    setRemovingEntry(null)
    setIsElimReplacement(false)
    setAddPlayer(null)
    setSearchKey(k => k + 1)
  }

  function handleRemove(entry: PlayoffPoolEntry, isElim: boolean) {
    setRemovingEntry(entry)
    setIsElimReplacement(isElim)
    setAddSlot(entry.positionSlot)
    setError(null)
    setSuccess(false)
  }

  function handleSubmit() {
    if (!removingEntry && !addPlayer) return
    setError(null)
    startTransition(async () => {
      const result = await submitPlayoffPoolChangeAction({
        poolerId,
        poolSeasonId: saison.id,
        season: saison.season,
        removeEntryId: removingEntry?.id ?? null,
        removePlayerId: removingEntry?.playerId ?? null,
        removeNhlId: removingEntry?.nhlId ?? null,
        addPlayerId: addPlayer?.id ?? null,
        addNhlId: addPlayer?.nhlId ?? null,
        addPositionSlot: addPlayer ? addSlot : null,
        isEliminationReplacement: isElimReplacement,
      })
      if (result.error) {
        setError(result.error)
      } else {
        setSuccess(true)
        resetForm()
        const [r, c] = await Promise.all([
          getPlayoffPoolRosterAction(poolerId, saison.id, saison.season),
          getPlayoffChangeCountsAction(poolerId, saison.id),
        ])
        setEntries(r)
        setCounts(c)
        setTimeout(() => setSuccess(false), 3000)
      }
    })
  }

  const existingPlayerIds = new Set(entries.map(e => e.playerId))
  const slots: { slot: 'F' | 'D' | 'G'; count: number }[] = [
    { slot: 'F', count: saison.maxF },
    { slot: 'D', count: saison.maxD },
    { slot: 'G', count: saison.maxG },
  ]
  const entriesBySlot = (slot: 'F' | 'D' | 'G') => entries.filter(e => e.positionSlot === slot)
  const hasEliminatedPlayers = entries.some(e => e.teamEliminated)
  const voluntaryLeft = saison.maxChanges - counts.voluntary
  const elimLeft = saison.maxElimChanges - counts.elimination

  return (
    <div className="space-y-5">

      {/* Pooler selector (admin) */}
      {isAdmin && poolers && poolers.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Pooler</label>
          <select
            value={poolerId}
            onChange={e => { setPoolerId(e.target.value); setError(null); setSuccess(false) }}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          >
            {poolers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      )}

      {/* Status banner */}
      <div className={`rounded-lg p-4 text-sm ${isLocked ? 'bg-orange-50 border border-orange-200' : 'bg-green-50 border border-green-200'}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className={`font-semibold ${isLocked ? 'text-orange-700' : 'text-green-700'}`}>
              {isLocked ? '🔒 Alignement verrouillé' : '✏️ Soumission libre'}
            </span>
            <p className="text-gray-500 text-xs mt-0.5">{deadlineLabel(saison.submissionDeadline)}</p>
          </div>
          <div className="flex flex-wrap gap-3 text-xs">
            <span className={voluntaryLeft <= 0 ? 'text-red-600 font-semibold' : 'text-gray-600'}>
              Changements volontaires : {counts.voluntary}/{saison.maxChanges}
            </span>
            <span className={elimLeft <= 0 ? 'text-red-600 font-semibold' : 'text-gray-600'}>
              Remplacements élimination : {counts.elimination}/{saison.maxElimChanges}
            </span>
          </div>
        </div>
        {hasEliminatedPlayers && (
          <div className="mt-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
            ⚠ Un ou plusieurs joueurs sont sur une équipe éliminée. Remplacez-les.
          </div>
        )}
      </div>

      {/* Roster slots */}
      {loading ? (
        <p className="text-sm text-gray-400">Chargement...</p>
      ) : (
        <div className="bg-white rounded-lg shadow p-4 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">{poolerName}</h2>
          {slots.map(({ slot, count }) => (
            <div key={slot}>
              <p className={`text-xs font-bold uppercase tracking-wide mb-2 ${slotTextColor[slot]}`}>
                {slotLabel[slot]}s ({entriesBySlot(slot).length}/{count})
              </p>
              <div className="grid grid-cols-1 gap-2">
                {Array.from({ length: count }).map((_, i) => (
                  <SlotRow
                    key={i}
                    slot={slot}
                    index={i}
                    entry={entriesBySlot(slot)[i]}
                    isLocked={isLocked}
                    isAdmin={isAdmin}
                    onRemove={handleRemove}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/swap form */}
      {(!isLocked || isAdmin || hasEliminatedPlayers) && (
        <div className="bg-white rounded-lg shadow p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-700">
            {removingEntry
              ? `Remplacer : ${removingEntry.lastName}, ${removingEntry.firstName}${isElimReplacement ? ' (élimination)' : ''}`
              : 'Ajouter un joueur'}
          </p>

          {removingEntry && (
            <div className="bg-red-50 border border-red-200 rounded px-3 py-2 flex items-center justify-between text-sm">
              <span className="text-red-700 font-medium">{removingEntry.lastName}, {removingEntry.firstName}</span>
              <button onClick={resetForm} className="text-xs text-gray-400 hover:text-gray-600">Annuler</button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Position</label>
              <select
                value={addSlot}
                onChange={e => setAddSlot(e.target.value as 'F' | 'D' | 'G')}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              >
                <option value="F">Attaquant (F)</option>
                <option value="D">Défenseur (D)</option>
                <option value="G">Gardien (G)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Joueur</label>
              <PlayerSearch
                key={searchKey}
                poolSeasonId={saison.id}
                season={saison.season}
                onSelect={setAddPlayer}
                excludeIds={existingPlayerIds}
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-green-600">Changement enregistré.</p>}

          <button
            onClick={handleSubmit}
            disabled={isPending || !addPlayer}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
          >
            {isPending ? 'Enregistrement...' : removingEntry ? 'Confirmer le remplacement' : 'Ajouter'}
          </button>
        </div>
      )}
    </div>
  )
}
