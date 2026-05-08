'use client'

import { useState, useEffect, useTransition, useMemo } from 'react'
import {
  getPlayoffPoolRosterAction,
  getPlayoffChangeCountsAction,
  getAvailablePlayoffPlayersAction,
  submitPlayoffPoolChangeAction,
  confirmPlayoffAlignmentAction,
} from './playoff-pool-actions'
import type {
  PlayoffPoolSaison,
  PlayoffPoolEntry,
  PlayoffPoolPlayerResult,
} from './playoff-pool-actions'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const capFmt = (n: number) =>
  new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

const slotLabel: Record<'F' | 'D' | 'G', string> = { F: 'Attaquant', D: 'Défenseur', G: 'Gardien' }
const slotAccent: Record<'F' | 'D' | 'G', string> = {
  F: 'text-blue-600 border-blue-300 bg-blue-50',
  D: 'text-green-600 border-green-300 bg-green-50',
  G: 'text-purple-600 border-purple-300 bg-purple-50',
}
const slotBadge: Record<'F' | 'D' | 'G', string> = {
  F: 'bg-blue-100 text-blue-700',
  D: 'bg-green-100 text-green-700',
  G: 'bg-purple-100 text-purple-700',
}

function deadlineLabel(deadline: string | null): string {
  if (!deadline) return 'Aucune deadline'
  return new Date(deadline).toLocaleString('fr-CA', {
    day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  })
}

// ─── Cap bar ──────────────────────────────────────────────────────────────────

function CapBar({ entries, poolCap, addingPlayer, removingPlayer }: {
  entries: PlayoffPoolEntry[]
  poolCap: number
  addingPlayer: PlayoffPoolPlayerResult | null
  removingPlayer: PlayoffPoolEntry | null
}) {
  const total = entries.reduce((s, e) => s + (e.capNumber ?? 0), 0)
  const removingCap = removingPlayer?.capNumber ?? 0
  const current = total - removingCap  // cap effectif une fois le retrait fait
  const preview = current + (addingPlayer?.capNumber ?? 0)
  const pct = poolCap > 0 ? Math.min(100, (current / poolCap) * 100) : 0
  const previewPct = poolCap > 0 ? Math.min(100, (preview / poolCap) * 100) : 0
  const over = preview > poolCap
  const barColor = pct > 95 ? 'bg-red-500' : pct > 85 ? 'bg-orange-400' : 'bg-blue-500'
  const previewColor = over ? 'bg-red-300' : 'bg-blue-200'

  return (
    <div className="bg-white rounded-lg border p-4 space-y-2">
      <div className="flex items-center justify-between text-xs text-gray-500 font-medium uppercase tracking-wide">
        <span>Masse salariale</span>
        <span className={over ? 'text-red-600 font-semibold' : 'text-gray-700'}>
          {capFmt(current)} <span className="text-gray-400">/ {capFmt(poolCap)}</span>
        </span>
      </div>

      {/* Barre de progression */}
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden relative">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
        {addingPlayer?.capNumber && (
          <div
            className={`absolute top-0 h-full rounded-full transition-all ${previewColor}`}
            style={{ left: `${pct}%`, width: `${previewPct - pct}%` }}
          />
        )}
      </div>

      <div className="flex justify-between text-xs">
        <span className={`font-medium ${poolCap - current < 0 ? 'text-red-600' : 'text-gray-600'}`}>
          Disponible : {capFmt(Math.max(0, poolCap - current))}
        </span>
        {addingPlayer?.capNumber && (
          <span className={`font-medium ${over ? 'text-red-600' : 'text-blue-600'}`}>
            Après échange : {capFmt(poolCap - preview)}
            {over && ' ⚠ Dépassement'}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Player picker ────────────────────────────────────────────────────────────

function posGroup(pos: string | null): 'F' | 'D' | 'G' {
  const p = (pos ?? '').split(',')[0].trim()
  if (p === 'G') return 'G'
  if (['D', 'LD', 'RD'].includes(p)) return 'D'
  return 'F'
}

function PlayerPicker({
  poolSeasonId, season, excludeIds, activeSlot, selected, onSelect, resetKey,
}: {
  poolSeasonId: number
  season: string
  excludeIds: Set<number>
  activeSlot: 'F' | 'D' | 'G'
  selected: PlayoffPoolPlayerResult | null
  onSelect: (p: PlayoffPoolPlayerResult | null) => void
  resetKey: number
}) {
  const [allPlayers, setAllPlayers] = useState<PlayoffPoolPlayerResult[]>([])
  const [loading, setLoading] = useState(false)
  const [nameFilter, setNameFilter] = useState('')
  const [teamFilter, setTeamFilter] = useState('')

  useEffect(() => {
    setLoading(true)
    setNameFilter('')
    setTeamFilter('')
    getAvailablePlayoffPlayersAction(poolSeasonId, season).then(p => {
      setAllPlayers(p)
      setLoading(false)
    })
  }, [poolSeasonId, season, resetKey])

  const teams = useMemo(() =>
    [...new Set(allPlayers.filter(p => posGroup(p.position) === activeSlot).map(p => p.teamCode).filter(Boolean) as string[])].sort(),
    [allPlayers, activeSlot],
  )

  const filtered = useMemo(() =>
    allPlayers.filter(p => {
      if (excludeIds.has(p.id)) return false
      if (posGroup(p.position) !== activeSlot) return false
      if (teamFilter && p.teamCode !== teamFilter) return false
      if (nameFilter.trim()) {
        const q = nameFilter.trim().toLowerCase()
        if (!`${p.firstName} ${p.lastName}`.toLowerCase().includes(q)) return false
      }
      return true
    }),
    [allPlayers, excludeIds, activeSlot, teamFilter, nameFilter],
  )

  if (selected) return (
    <div className="border border-green-300 bg-green-50 rounded-lg px-3 py-2 text-sm flex items-center gap-2">
      <div className="flex-1 min-w-0">
        <span className="font-medium text-gray-800">{selected.lastName}, {selected.firstName}</span>
        <span className="text-xs text-gray-500 ml-2">{selected.teamCode} — {selected.position}</span>
        {selected.teamEliminated && <span className="ml-1 text-xs text-red-600 font-medium">ÉLIMINÉ</span>}
      </div>
      {selected.capNumber != null && (
        <span className="text-xs font-semibold text-gray-600 tabular-nums shrink-0">{capFmt(selected.capNumber)}</span>
      )}
      <button onClick={() => onSelect(null)} className="text-gray-400 hover:text-gray-600 text-xs shrink-0">✕</button>
    </div>
  )

  return (
    <div className="space-y-2">
      {/* Filtre équipe */}
      <select
        value={teamFilter}
        onChange={e => setTeamFilter(e.target.value)}
        className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs text-gray-700 bg-white"
      >
        <option value="">Toutes les équipes</option>
        {teams.map(t => <option key={t} value={t}>{t}</option>)}
      </select>

      {/* Recherche par nom */}
      <input
        type="text"
        value={nameFilter}
        onChange={e => setNameFilter(e.target.value)}
        placeholder="Rechercher par nom..."
        className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />

      {/* Liste */}
      {loading ? (
        <p className="text-xs text-gray-400 text-center py-6">Chargement...</p>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="max-h-60 overflow-y-auto divide-y divide-gray-50">
            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-xs text-gray-400 text-center">Aucun joueur pour ces filtres.</p>
            ) : filtered.map(p => (
              <button
                key={p.id}
                onClick={() => onSelect(p)}
                disabled={p.teamEliminated}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors ${p.teamEliminated ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <span className="flex-1 font-medium text-gray-800 truncate">{p.lastName}, {p.firstName}</span>
                  <span className="text-xs text-gray-400 shrink-0">{p.teamCode}</span>
                  <span className="text-xs text-gray-400 shrink-0 w-5">{(p.position ?? '').split(',')[0]}</span>
                  {p.capNumber != null
                    ? <span className="text-xs font-semibold text-gray-600 tabular-nums shrink-0 w-24 text-right">{capFmt(p.capNumber)}</span>
                    : <span className="text-xs text-gray-300 shrink-0 w-24 text-right">—</span>
                  }
                  {p.teamEliminated && <span className="text-xs text-red-400 shrink-0">ÉL.</span>}
                </div>
              </button>
            ))}
          </div>
          <div className="px-3 py-1.5 bg-gray-50 border-t text-xs text-gray-400">
            {filtered.length} joueur{filtered.length > 1 ? 's' : ''}
            {allPlayers.length !== filtered.length && ` / ${allPlayers.length} au total`}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Compact slot row ─────────────────────────────────────────────────────────

function SlotRow({
  slot, index, entry, isLocked, isAdmin, isActive, onSelect,
}: {
  slot: 'F' | 'D' | 'G'
  index: number
  entry: PlayoffPoolEntry | undefined
  isLocked: boolean
  isAdmin: boolean
  isActive: boolean
  onSelect: (entry: PlayoffPoolEntry | null, slot: 'F' | 'D' | 'G') => void
}) {
  const canEdit = !isLocked || isAdmin || (isLocked && !!entry?.teamEliminated)

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors cursor-default
        ${isActive ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-300' : entry ? 'border-gray-200 bg-white hover:border-gray-300' : 'border-dashed border-gray-200 bg-gray-50'}
      `}
    >
      <span className={`text-xs font-bold px-1.5 py-0.5 rounded shrink-0 ${slotBadge[slot]}`}>
        {slot}{index + 1}
      </span>

      {entry ? (
        <>
          <div className="flex-1 min-w-0">
            <span className="font-medium text-gray-800 truncate block">
              {entry.lastName}, {entry.firstName}
            </span>
            <span className="text-xs text-gray-400">{entry.teamCode} — {entry.position}</span>
            {entry.teamEliminated && <span className="ml-1 text-xs text-red-600 font-semibold">⚠ Éliminé</span>}
          </div>
          {entry.capNumber != null && (
            <span className="text-xs font-semibold text-gray-500 tabular-nums shrink-0">{capFmt(entry.capNumber)}</span>
          )}
          {canEdit && (
            <button
              onClick={() => onSelect(entry, slot)}
              className="text-xs text-red-400 hover:text-red-600 shrink-0 ml-1"
            >
              {isLocked && !!entry.teamEliminated ? '↺' : '✕'}
            </button>
          )}
          {isLocked && !isAdmin && !entry.teamEliminated && (
            <span className="text-xs text-gray-300 shrink-0">🔒</span>
          )}
        </>
      ) : (
        <button
          onClick={() => canEdit ? onSelect(null, slot) : undefined}
          disabled={!canEdit}
          className="flex-1 text-left text-xs text-gray-400 italic disabled:cursor-default"
        >
          {canEdit ? '+ Ajouter' : '— Vide —'}
        </button>
      )}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

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
  const [activeSlot, setActiveSlot] = useState<'F' | 'D' | 'G'>('F')
  const [isElimReplacement, setIsElimReplacement] = useState(false)
  const [addPlayer, setAddPlayer] = useState<PlayoffPoolPlayerResult | null>(null)
  const [searchKey, setSearchKey] = useState(0)

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [confirmPending, setConfirmPending] = useState(false)
  const [isPending, startTransition] = useTransition()

  const isLocked = saison.submissionDeadline ? new Date() > new Date(saison.submissionDeadline) : false
  const poolerName = poolers?.find(p => p.id === poolerId)?.name ?? selfPoolerName
  const hasEliminatedPlayers = entries.some(e => e.teamEliminated)
  const canEdit = !isLocked || isAdmin || hasEliminatedPlayers

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

  function handleSlotSelect(entry: PlayoffPoolEntry | null, slot: 'F' | 'D' | 'G') {
    resetForm()
    setActiveSlot(slot)
    if (entry) {
      setRemovingEntry(entry)
      setIsElimReplacement(isLocked && !!entry.teamEliminated)
    }
    setError(null)
    setSuccess(false)
  }

  function handleSubmit() {
    if (!addPlayer && !removingEntry) return
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
        addPositionSlot: addPlayer ? activeSlot : null,
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

  const slots: { slot: 'F' | 'D' | 'G'; count: number }[] = [
    { slot: 'F', count: saison.maxF },
    { slot: 'D', count: saison.maxD },
    { slot: 'G', count: saison.maxG },
  ]
  const entriesBySlot = (slot: 'F' | 'D' | 'G') => entries.filter(e => e.positionSlot === slot)
  const existingPlayerIds = new Set(entries.map(e => e.playerId))

  const totalRequired = saison.maxF + saison.maxD + saison.maxG
  const isComplete =
    entriesBySlot('F').length === saison.maxF &&
    entriesBySlot('D').length === saison.maxD &&
    entriesBySlot('G').length === saison.maxG

  return (
    <div className="space-y-4">

      {/* Sélecteur pooler (admin) */}
      {isAdmin && poolers && poolers.length > 0 && (
        <div className="bg-white rounded-lg shadow p-3">
          <label className="block text-xs font-medium text-gray-600 mb-1">Pooler</label>
          <select
            value={poolerId}
            onChange={e => { setPoolerId(e.target.value); resetForm(); setError(null); setSuccess(false) }}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          >
            {poolers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      )}

      {/* Bannière statut */}
      <div className={`rounded-lg p-3 text-sm ${isLocked ? 'bg-orange-50 border border-orange-200' : 'bg-green-50 border border-green-200'}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className={`font-semibold ${isLocked ? 'text-orange-700' : 'text-green-700'}`}>
              {isLocked ? '🔒 Alignement verrouillé' : '✏️ Soumission libre'}
            </span>
            <span className="text-gray-400 text-xs ml-2">{deadlineLabel(saison.submissionDeadline)}</span>
          </div>
          <div className="flex gap-4 text-xs">
            <span className={counts.voluntary >= saison.maxChanges ? 'text-red-600 font-semibold' : 'text-gray-600'}>
              Changements : {counts.voluntary}/{saison.maxChanges}
            </span>
            <span className={counts.elimination >= saison.maxElimChanges ? 'text-red-600 font-semibold' : 'text-gray-600'}>
              Remplacements élim. : {counts.elimination}/{saison.maxElimChanges}
            </span>
          </div>
        </div>
        {hasEliminatedPlayers && (
          <p className="mt-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-1.5">
            ⚠ Un ou plusieurs joueurs sont sur une équipe éliminée — cliquez ↺ pour les remplacer.
          </p>
        )}
      </div>

      {/* Confirmation alignement — avant deadline, alignement complet, pooler seulement */}
      {!loading && isComplete && !isLocked && !isAdmin && (
        <div className={`rounded-lg border px-4 py-3 flex items-center justify-between gap-4 ${confirmed ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}`}>
          <div className="text-sm">
            {confirmed
              ? <span className="text-green-700 font-semibold">✓ Alignement confirmé — l&apos;admin a été notifié.</span>
              : <span className="text-blue-700">Ton alignement est complet. Confirme-le pour aviser l&apos;admin.</span>
            }
          </div>
          {!confirmed && (
            <button
              disabled={confirmPending}
              onClick={async () => {
                setConfirmPending(true)
                await confirmPlayoffAlignmentAction(selfPoolerId, selfPoolerName)
                setConfirmed(true)
                setConfirmPending(false)
              }}
              className="shrink-0 bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {confirmPending ? 'Envoi...' : 'Confirmer mon alignement'}
            </button>
          )}
        </div>
      )}

      {/* Avertissement alignement incomplet */}
      {!loading && !isComplete && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="font-semibold">⚠ Alignement incomplet</span>
          <span className="ml-2 text-amber-600">
            {entries.length}/{totalRequired} joueurs sélectionnés
            {' — '}
            {[
              entriesBySlot('F').length < saison.maxF && `${entriesBySlot('F').length}/${saison.maxF} F`,
              entriesBySlot('D').length < saison.maxD && `${entriesBySlot('D').length}/${saison.maxD} D`,
              entriesBySlot('G').length < saison.maxG && `${entriesBySlot('G').length}/${saison.maxG} G`,
            ].filter(Boolean).join(', ')}
          </span>
          <p className="text-xs text-amber-600 mt-0.5">
            L&apos;alignement ne sera pas comptabilisé tant qu&apos;il est incomplet.
          </p>
        </div>
      )}

      {/* Layout deux colonnes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">

        {/* ── Colonne gauche : roster ── */}
        <div className="bg-white rounded-lg shadow p-4 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">{poolerName}</h2>

          {loading ? (
            <p className="text-sm text-gray-400 py-4 text-center">Chargement...</p>
          ) : (
            slots.map(({ slot, count }) => (
              <div key={slot}>
                <p className={`text-xs font-bold uppercase tracking-wide mb-2 ${slotAccent[slot].split(' ')[0]}`}>
                  {slotLabel[slot]}s ({entriesBySlot(slot).length}/{count})
                </p>
                <div className="space-y-1.5">
                  {Array.from({ length: count }).map((_, i) => (
                    <SlotRow
                      key={i}
                      slot={slot}
                      index={i}
                      entry={entriesBySlot(slot)[i]}
                      isLocked={isLocked}
                      isAdmin={isAdmin}
                      isActive={!!(removingEntry && removingEntry === entriesBySlot(slot)[i])}
                      onSelect={handleSlotSelect}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* ── Colonne droite : cap + sélecteur ── */}
        <div className="space-y-4">

          {/* Cap */}
          <CapBar entries={entries} poolCap={saison.poolCap} addingPlayer={addPlayer} removingPlayer={removingEntry} />

          {/* Sélecteur */}
          {canEdit ? (
            <div className="bg-white rounded-lg shadow p-4 space-y-3">

              {/* Contexte de l'action */}
              {removingEntry ? (
                <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded px-3 py-2 text-sm">
                  <div>
                    <span className="text-xs text-red-500 font-medium block">
                      {isElimReplacement ? 'Remplacement (élimination)' : 'Remplacement volontaire'}
                    </span>
                    <span className="text-gray-700 font-medium">
                      {removingEntry.lastName}, {removingEntry.firstName}
                    </span>
                    {removingEntry.capNumber != null && (
                      <span className="text-xs text-gray-400 ml-2">{capFmt(removingEntry.capNumber)}</span>
                    )}
                  </div>
                  <button onClick={resetForm} className="text-xs text-gray-400 hover:text-gray-600">Annuler</button>
                </div>
              ) : (
                <p className="text-sm font-semibold text-gray-700">Ajouter un joueur</p>
              )}

              {/* Slot cible */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Slot à remplir</label>
                <div className="flex gap-2">
                  {(['F', 'D', 'G'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setActiveSlot(s)}
                      className={`flex-1 py-1.5 text-sm font-semibold rounded border transition-colors
                        ${activeSlot === s
                          ? `${slotAccent[s]} border-current`
                          : 'border-gray-200 text-gray-400 hover:border-gray-300'}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sélecteur joueur */}
              <PlayerPicker
                poolSeasonId={saison.id}
                season={saison.season}
                excludeIds={existingPlayerIds}
                activeSlot={activeSlot}
                selected={addPlayer}
                onSelect={setAddPlayer}
                resetKey={searchKey}
              />

              {error && <p className="text-sm text-red-600">{error}</p>}
              {success && <p className="text-sm text-green-600 font-medium">✓ Changement enregistré.</p>}

              <button
                onClick={handleSubmit}
                disabled={isPending || !addPlayer}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-40 text-sm font-medium transition-colors"
              >
                {isPending
                  ? 'Enregistrement...'
                  : removingEntry
                    ? 'Confirmer le remplacement'
                    : 'Ajouter'}
              </button>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 text-sm text-gray-400 text-center">
              L&apos;alignement est verrouillé.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
