'use client'

import { useState, useEffect, useTransition } from 'react'
import {
  getPoolerPlayoffRosterAction,
  searchPlayoffPlayersAction,
  getPostDeadlineChangesAction,
  submitPlayoffChangeAction,
} from './actions'
import type {
  PlayoffRound,
  PlayoffRosterEntry,
  PlayoffPlayerResult,
} from './actions'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const capFmt = (n: number | null) =>
  n == null ? '—' : new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

const slotLabel: Record<'F' | 'D' | 'G', string> = { F: 'Attaquant', D: 'Défenseur', G: 'Gardien' }
const slotColor: Record<'F' | 'D' | 'G', string> = {
  F: 'bg-blue-50 border-blue-200',
  D: 'bg-green-50 border-green-200',
  G: 'bg-purple-50 border-purple-200',
}

function deadlineLabel(deadline: string | null): string {
  if (!deadline) return 'Aucune deadline fixée'
  return new Date(deadline).toLocaleString('fr-CA', {
    day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  })
}

function timeUntilDeadline(deadline: string | null): string | null {
  if (!deadline) return null
  const diff = new Date(deadline).getTime() - Date.now()
  if (diff <= 0) return null
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  if (h >= 24) return `${Math.floor(h / 24)}j ${h % 24}h`
  return `${h}h ${m}m`
}

// ─── Sub-component : player search ────────────────────────────────────────────

function PlayerSearch({
  season, poolSeasonId, onSelect, excludeIds,
}: {
  season: string
  poolSeasonId: number
  onSelect: (p: PlayoffPlayerResult) => void
  excludeIds: Set<number>
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PlayoffPlayerResult[]>([])
  const [selected, setSelected] = useState<PlayoffPlayerResult | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (query.length < 2) { setResults([]); return }
    const t = setTimeout(async () => {
      setLoading(true)
      setResults(await searchPlayoffPlayersAction(query, season, poolSeasonId))
      setLoading(false)
    }, 300)
    return () => clearTimeout(t)
  }, [query, season, poolSeasonId])

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
              className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center gap-2"
            >
              <span className="flex-1">{p.lastName}, {p.firstName}</span>
              <span className="text-xs text-gray-500">{p.teamCode} — {p.position}</span>
              {p.teamEliminated && <span className="text-xs text-red-500 font-medium">ÉL.</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Slot row ─────────────────────────────────────────────────────────────────

function SlotRow({
  slot, index, entry, isFrozen, isAdmin, onRemove,
}: {
  slot: 'F' | 'D' | 'G'
  index: number
  entry: PlayoffRosterEntry | undefined
  isFrozen: boolean
  isAdmin: boolean
  onRemove: (entry: PlayoffRosterEntry, isElimReplacement: boolean) => void
}) {
  const label = `${slotLabel[slot]} ${index + 1}`
  const canRemove = !isFrozen || isAdmin || (isFrozen && entry?.teamEliminated)

  return (
    <div className={`border rounded-lg p-3 ${slotColor[slot]}`}>
      <p className="text-xs font-semibold text-gray-500 mb-1">{label}</p>
      {entry ? (
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <span className="text-sm font-medium text-gray-800">{entry.lastName}, {entry.firstName}</span>
            <span className="text-xs text-gray-500 ml-2">{entry.teamCode} — {entry.position}</span>
            {entry.teamEliminated && (
              <span className="ml-2 text-xs text-red-600 font-semibold">⚠ Équipe éliminée</span>
            )}
          </div>
          {entry.capNumber != null && (
            <span className="text-xs text-gray-400 tabular-nums">{capFmt(entry.capNumber)}</span>
          )}
          {canRemove && (
            <button
              onClick={() => onRemove(entry, isFrozen && !!entry.teamEliminated)}
              className="text-xs text-red-400 hover:text-red-600 shrink-0"
            >
              Retirer
            </button>
          )}
          {isFrozen && !isAdmin && !entry.teamEliminated && (
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

const SLOTS: { slot: 'F' | 'D' | 'G'; count: number }[] = [
  { slot: 'F', count: 3 },
  { slot: 'D', count: 2 },
  { slot: 'G', count: 1 },
]

export default function GestionSeriesManager({
  isAdmin,
  poolerId,
  poolerName,
  round,
  poolSeasonId,
  season,
}: {
  isAdmin: boolean
  poolerId: string
  poolerName: string
  round: PlayoffRound
  poolSeasonId: number
  season: string
}) {
  const [entries, setEntries] = useState<PlayoffRosterEntry[]>([])
  const [postDeadlineChanges, setPostDeadlineChanges] = useState(0)
  const [loading, setLoading] = useState(true)

  // Add-form state
  const [removingEntry, setRemovingEntry] = useState<PlayoffRosterEntry | null>(null)
  const [isElimReplacement, setIsElimReplacement] = useState(false)
  const [addSlot, setAddSlot] = useState<'F' | 'D' | 'G'>('F')
  const [addPlayer, setAddPlayer] = useState<PlayoffPlayerResult | null>(null)
  const [searchKey, setSearchKey] = useState(0)

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  const isFrozen = round.isFrozen

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getPoolerPlayoffRosterAction(poolerId, round.id, poolSeasonId, season),
      round.submissionDeadline
        ? getPostDeadlineChangesAction(poolerId, round.id, round.submissionDeadline)
        : Promise.resolve(0),
    ]).then(([r, c]) => {
      setEntries(r)
      setPostDeadlineChanges(c)
      setLoading(false)
    })
  }, [poolerId, round.id, poolSeasonId, season, round.submissionDeadline])

  function resetForm() {
    setRemovingEntry(null)
    setIsElimReplacement(false)
    setAddPlayer(null)
    setSearchKey(k => k + 1)
  }

  function handleRemove(entry: PlayoffRosterEntry, isElim: boolean) {
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
      const result = await submitPlayoffChangeAction({
        poolerId,
        roundId: round.id,
        poolSeasonId,
        season,
        removeEntryId: removingEntry?.id ?? null,
        addPlayerId: addPlayer?.id ?? null,
        addPositionSlot: addPlayer ? addSlot : null,
        isEliminationReplacement: isElimReplacement,
      })
      if (result.error) {
        setError(result.error)
      } else {
        setSuccess(true)
        resetForm()
        const [r, c] = await Promise.all([
          getPoolerPlayoffRosterAction(poolerId, round.id, poolSeasonId, season),
          round.submissionDeadline
            ? getPostDeadlineChangesAction(poolerId, round.id, round.submissionDeadline)
            : Promise.resolve(0),
        ])
        setEntries(r)
        setPostDeadlineChanges(c)
      }
    })
  }

  const existingPlayerIds = new Set(entries.map(e => e.playerId))
  const entriesBySlot = (slot: 'F' | 'D' | 'G') => entries.filter(e => e.positionSlot === slot)
  const hasEliminatedPlayers = entries.some(e => e.teamEliminated)
  const timeLeft = timeUntilDeadline(round.submissionDeadline)
  const changesLeft = round.maxChanges - postDeadlineChanges

  return (
    <div className="space-y-5">

      {/* Round status banner */}
      <div className={`rounded-lg p-4 text-sm ${isFrozen ? 'bg-orange-50 border border-orange-200' : 'bg-green-50 border border-green-200'}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className={`font-semibold ${isFrozen ? 'text-orange-700' : 'text-green-700'}`}>
              {isFrozen ? '🔒 Alignement gelé' : '✏️ Modifications libres'}
            </span>
            <span className="text-gray-600 ml-2">
              {round.submissionDeadline ? `Deadline : ${deadlineLabel(round.submissionDeadline)}` : 'Aucune deadline fixée'}
            </span>
          </div>
          {!isFrozen && timeLeft && (
            <span className="text-xs text-gray-500">Ferme dans {timeLeft}</span>
          )}
          {isFrozen && (
            <span className="text-xs text-orange-600 font-medium">
              Changements discrétionnaires : {postDeadlineChanges}/{round.maxChanges}
            </span>
          )}
        </div>
        {hasEliminatedPlayers && (
          <p className="mt-2 text-orange-700 font-medium text-xs">
            ⚠ Un ou plusieurs de vos joueurs sont sur des équipes éliminées — remplacement possible même si gelé.
          </p>
        )}
      </div>

      {/* Lineup */}
      {loading ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-400 text-sm">Chargement...</div>
      ) : (
        <div className="bg-white rounded-lg shadow p-5 space-y-4">
          <p className="text-sm font-semibold text-gray-700">
            Alignement — Ronde {round.roundNumber} — {poolerName}
          </p>
          {SLOTS.map(({ slot, count }) => (
            <div key={slot} className="space-y-2">
              {Array.from({ length: count }).map((_, i) => (
                <SlotRow
                  key={`${slot}-${i}`}
                  slot={slot}
                  index={i}
                  entry={entriesBySlot(slot)[i]}
                  isFrozen={isFrozen}
                  isAdmin={isAdmin}
                  onRemove={handleRemove}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Change form */}
      {(removingEntry || (!isFrozen || isAdmin)) && !loading && (
        <div className="bg-white rounded-lg shadow p-5 space-y-4">
          <p className="text-sm font-semibold text-gray-700">
            {removingEntry ? `Remplacer : ${removingEntry.lastName}, ${removingEntry.firstName}` : 'Ajouter un joueur'}
          </p>

          {isFrozen && !isAdmin && (
            <div className={`text-xs rounded p-2 ${isElimReplacement ? 'bg-blue-50 text-blue-700' : changesLeft <= 0 ? 'bg-red-50 text-red-700' : 'bg-orange-50 text-orange-700'}`}>
              {isElimReplacement
                ? 'Remplacement d\'urgence (équipe éliminée) — ne compte pas dans le budget.'
                : changesLeft <= 0
                  ? `Budget épuisé (${round.maxChanges}/${round.maxChanges} changements utilisés).`
                  : `Changement discrétionnaire — il vous reste ${changesLeft} changement${changesLeft > 1 ? 's' : ''}.`}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                season={season}
                poolSeasonId={poolSeasonId}
                onSelect={setAddPlayer}
                excludeIds={existingPlayerIds}
              />
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            {removingEntry && (
              <button onClick={resetForm} className="text-sm text-gray-500 hover:text-gray-700">
                Annuler
              </button>
            )}
            <button
              onClick={handleSubmit}
              disabled={isPending || (!addPlayer && !removingEntry) || (isFrozen && !isAdmin && !isElimReplacement && changesLeft <= 0)}
              className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isPending ? 'En cours...' : removingEntry ? 'Remplacer' : 'Ajouter'}
            </button>
          </div>
        </div>
      )}

      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-700">✓ Changement appliqué.</div>}
    </div>
  )
}
