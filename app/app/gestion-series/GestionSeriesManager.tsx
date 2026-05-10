'use client'

import { useState, useEffect, useTransition, useMemo } from 'react'
import {
  getPlayoffPoolRosterAction,
  getPlayoffChangeCountsAction,
  getAvailablePlayoffPlayersAction,
  submitSeriesBatchAction,
  confirmPlayoffAlignmentAction,
} from './playoff-pool-actions'
import type {
  PlayoffPoolSaison,
  PlayoffPoolEntry,
  PlayoffPoolPlayerResult,
  SeriesBatchItem,
} from './playoff-pool-actions'

// ─── Types ────────────────────────────────────────────────────────────────────

type SeriesCartItem = {
  localId: string
  type: 'elimination' | 'voluntary' | 'add'
  removeEntryId: number | null
  removePlayerId: number | null
  removeNhlId: number | null
  removeName: string | null
  removeCapNumber: number
  addPlayerId: number
  addNhlId: number | null
  addName: string
  addTeamCode: string | null
  addCapNumber: number
  addPositionSlot: 'F' | 'D' | 'G'
  label: string
}

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

export function posGroup(pos: string | null): 'F' | 'D' | 'G' {
  const p = (pos ?? '').split(',')[0].trim()
  if (p === 'G') return 'G'
  if (['D', 'LD', 'RD'].includes(p)) return 'D'
  return 'F'
}

// ─── CapBar ───────────────────────────────────────────────────────────────────

function CapBar({ entries, poolCap, cart, currentAdd, currentRemove }: {
  entries: PlayoffPoolEntry[]
  poolCap: number
  cart: SeriesCartItem[]
  currentAdd: PlayoffPoolPlayerResult | null
  currentRemove: PlayoffPoolEntry | null
}) {
  const base = entries.reduce((s, e) => s + (e.capNumber ?? 0), 0)

  // Cap après application du panier (sans l'item en cours de sélection)
  const cartRemovedIds = new Set(cart.filter(i => i.removePlayerId).map(i => i.removePlayerId!))
  const cartBase = entries
    .filter(e => !cartRemovedIds.has(e.playerId))
    .reduce((s, e) => s + (e.capNumber ?? 0), 0)
    + cart.reduce((s, i) => s + i.addCapNumber, 0)

  // Cap preview avec l'item en cours
  const pendingRemoveCap = currentRemove && !cartRemovedIds.has(currentRemove.playerId)
    ? (currentRemove.capNumber ?? 0) : 0
  const preview = cartBase - pendingRemoveCap + (currentAdd?.capNumber ?? 0)

  const hasCart = cart.length > 0
  const hasCurrent = !!currentAdd

  const displayed = hasCart ? cartBase : base
  const pct = poolCap > 0 ? Math.min(100, (displayed / poolCap) * 100) : 0
  const previewPct = poolCap > 0 ? Math.min(100, (preview / poolCap) * 100) : 0
  const over = hasCurrent ? preview > poolCap : displayed > poolCap
  const barColor = pct > 95 ? 'bg-red-500' : pct > 85 ? 'bg-orange-400' : 'bg-blue-500'
  const previewColor = preview > poolCap ? 'bg-red-300' : 'bg-blue-200'

  return (
    <div className="bg-white rounded-lg border p-4 space-y-2">
      <div className="flex items-center justify-between text-xs text-gray-500 font-medium uppercase tracking-wide">
        <span>Masse salariale</span>
        <span className={over ? 'text-red-600 font-semibold' : 'text-gray-700'}>
          {capFmt(displayed)} <span className="text-gray-400">/ {capFmt(poolCap)}</span>
        </span>
      </div>

      <div className="h-2 bg-gray-100 rounded-full overflow-hidden relative">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
        {hasCurrent && (
          <div
            className={`absolute top-0 h-full rounded-full transition-all ${previewColor}`}
            style={{ left: `${Math.min(pct, previewPct)}%`, width: `${Math.abs(previewPct - pct)}%` }}
          />
        )}
      </div>

      <div className="flex justify-between text-xs">
        <span className={`font-medium ${poolCap - displayed < 0 ? 'text-red-600' : 'text-gray-600'}`}>
          Disponible{hasCart ? ' après panier' : ''} : {capFmt(Math.max(0, poolCap - displayed))}
        </span>
        {hasCurrent && (
          <span className={`font-medium ${preview > poolCap ? 'text-red-600' : 'text-blue-600'}`}>
            Après échange : {capFmt(poolCap - preview)}
            {preview > poolCap && ' ⚠ Dépassement'}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── PlayerPicker ─────────────────────────────────────────────────────────────

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
      <select
        value={teamFilter}
        onChange={e => setTeamFilter(e.target.value)}
        className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs text-gray-700 bg-white"
      >
        <option value="">Toutes les équipes</option>
        {teams.map(t => <option key={t} value={t}>{t}</option>)}
      </select>

      <input
        type="text"
        value={nameFilter}
        onChange={e => setNameFilter(e.target.value)}
        placeholder="Rechercher par nom..."
        className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />

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

// ─── SlotRow ──────────────────────────────────────────────────────────────────

function SlotRow({
  slot, index, entry, isLocked, isAdmin, isActive, onSelect, canVoluntaryEdit, canElimEdit, cartItem, onRemoveFromCart,
}: {
  slot: 'F' | 'D' | 'G'
  index: number
  entry: PlayoffPoolEntry | undefined
  isLocked: boolean
  isAdmin: boolean
  isActive: boolean
  onSelect: (entry: PlayoffPoolEntry | null, slot: 'F' | 'D' | 'G') => void
  canVoluntaryEdit: boolean
  canElimEdit: boolean
  cartItem?: SeriesCartItem
  onRemoveFromCart?: () => void
}) {
  const isElimSlot = isLocked && !!entry?.teamEliminated
  const canEdit = !isLocked || isAdmin || (isElimSlot ? canElimEdit : canVoluntaryEdit)
  const isPending = !!cartItem

  if (isPending && cartItem && entry) {
    // Slot en attente de remplacement — affiche le "avant → après"
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 text-sm overflow-hidden">
        {/* Joueur sortant */}
        <div className="flex items-center gap-2 px-3 py-1.5 opacity-50 line-through text-gray-500">
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded shrink-0 ${slotBadge[slot]}`}>
            {slot}{index + 1}
          </span>
          <span className="flex-1 truncate">{entry.lastName}, {entry.firstName}</span>
          {entry.capNumber != null && <span className="tabular-nums text-xs shrink-0">{capFmt(entry.capNumber)}</span>}
        </div>
        {/* Joueur entrant */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border-t border-amber-200">
          <span className="text-xs text-green-600 shrink-0">↳</span>
          <span className="flex-1 font-medium text-green-800 truncate">{cartItem.addName}</span>
          {cartItem.addTeamCode && <span className="text-xs text-gray-400 shrink-0">{cartItem.addTeamCode}</span>}
          <span className="text-xs font-semibold text-green-700 tabular-nums shrink-0">{capFmt(cartItem.addCapNumber)}</span>
          <button
            onClick={onRemoveFromCart}
            className="text-xs text-amber-600 hover:text-red-600 shrink-0 ml-1"
            title="Retirer du panier"
          >✕</button>
        </div>
      </div>
    )
  }

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
          {!canEdit && (
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

  // Panier de changements
  const [cart, setCart] = useState<SeriesCartItem[]>([])

  // Formulaire de sélection en cours (pas encore dans le panier)
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
  const hasEliminatedPlayers = entries.some(e => e.teamEliminated && !cart.some(c => c.removeEntryId === e.id))

  // Budget restant en tenant compte du panier
  const cartElim = cart.filter(i => i.type === 'elimination').length
  const cartVoluntary = cart.filter(i => i.type === 'voluntary').length
  const remainingElim = saison.maxElimChanges - counts.elimination - cartElim
  const remainingVoluntary = saison.maxChanges - counts.voluntary - cartVoluntary

  const canVoluntaryEdit = !isLocked || remainingVoluntary > 0
  const canElimEdit = hasEliminatedPlayers && remainingElim > 0
  const canEdit = !isLocked || isAdmin || canVoluntaryEdit || canElimEdit
  const isTrulyLocked = isLocked && !isAdmin && remainingVoluntary <= 0 && remainingElim <= 0

  // IDs à exclure du sélecteur : joueurs actuellement dans le roster (sauf ceux en sortie du panier)
  // + joueurs déjà ajoutés dans le panier
  const cartRemovePlayerIds = new Set(cart.filter(i => i.removePlayerId).map(i => i.removePlayerId!))
  const cartAddPlayerIds = new Set(cart.map(i => i.addPlayerId))
  const excludeIds = useMemo(() => new Set([
    ...entries.filter(e => !cartRemovePlayerIds.has(e.playerId)).map(e => e.playerId),
    ...cartAddPlayerIds,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ]), [entries, cart])

  // Map entryId → cartItem pour l'affichage des slots
  const cartByEntryId = useMemo(() =>
    new Map(cart.filter(i => i.removeEntryId).map(i => [i.removeEntryId!, i])),
    [cart],
  )

  useEffect(() => {
    setLoading(true)
    setCart([])
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
    // Si déjà dans le panier, ignorer le clic (le ✕ du slot gère le retrait)
    if (entry && cartByEntryId.has(entry.id)) return
    resetForm()
    setActiveSlot(slot)
    if (entry) {
      setRemovingEntry(entry)
      setIsElimReplacement(isLocked && !!entry.teamEliminated)
    }
    setError(null)
    setSuccess(false)
  }

  function handleAddToCart() {
    if (!addPlayer) return
    const type = !isLocked ? 'add' : isElimReplacement ? 'elimination' : 'voluntary'
    const removeName = removingEntry
      ? `${removingEntry.lastName}, ${removingEntry.firstName}`
      : null
    const addName = `${addPlayer.lastName}, ${addPlayer.firstName}`
    const label = removeName
      ? `${removeName} → ${addName}`
      : `+ ${addName} (${activeSlot})`

    const item: SeriesCartItem = {
      localId: crypto.randomUUID(),
      type,
      removeEntryId: removingEntry?.id ?? null,
      removePlayerId: removingEntry?.playerId ?? null,
      removeNhlId: removingEntry?.nhlId ?? null,
      removeName,
      removeCapNumber: removingEntry?.capNumber ?? 0,
      addPlayerId: addPlayer.id,
      addNhlId: addPlayer.nhlId ?? null,
      addName,
      addTeamCode: addPlayer.teamCode,
      addCapNumber: addPlayer.capNumber ?? 0,
      addPositionSlot: activeSlot,
      label,
    }
    setCart(c => [...c, item])
    resetForm()
    setError(null)
  }

  function handleRemoveFromCart(localId: string) {
    setCart(c => c.filter(i => i.localId !== localId))
  }

  function handleConfirmBatch() {
    if (!cart.length) return
    setError(null)

    startTransition(async () => {
      const items: SeriesBatchItem[] = cart.map(i => ({
        type: i.type,
        removeEntryId: i.removeEntryId,
        removePlayerId: i.removePlayerId,
        removeNhlId: i.removeNhlId,
        addPlayerId: i.addPlayerId,
        addNhlId: i.addNhlId,
        addPositionSlot: i.addPositionSlot,
      }))

      const result = await submitSeriesBatchAction({
        poolerId,
        poolSeasonId: saison.id,
        season: saison.season,
        items,
      })

      if (result.error) {
        setError(result.error)
      } else {
        setSuccess(true)
        setCart([])
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

  const totalRequired = saison.maxF + saison.maxD + saison.maxG
  const isComplete =
    entriesBySlot('F').length === saison.maxF &&
    entriesBySlot('D').length === saison.maxD &&
    entriesBySlot('G').length === saison.maxG

  // Cap projeté après panier (pour validation client avant soumission)
  const cartRemovedIds = new Set(cart.filter(i => i.removePlayerId).map(i => i.removePlayerId!))
  const projectedCap = entries
    .filter(e => !cartRemovedIds.has(e.playerId))
    .reduce((s, e) => s + (e.capNumber ?? 0), 0)
    + cart.reduce((s, i) => s + i.addCapNumber, 0)
  const projectedOver = projectedCap > saison.poolCap

  return (
    <div className="space-y-4">

      {/* Sélecteur pooler (admin) */}
      {isAdmin && poolers && poolers.length > 0 && (
        <div className="bg-white rounded-lg shadow p-3">
          <label className="block text-xs font-medium text-gray-600 mb-1">Pooler</label>
          <select
            value={poolerId}
            onChange={e => { setPoolerId(e.target.value); resetForm(); setCart([]); setError(null); setSuccess(false) }}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          >
            {poolers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      )}

      {/* Bannière statut */}
      <div className={`rounded-lg p-3 text-sm ${!isLocked ? 'bg-green-50 border border-green-200' : isTrulyLocked ? 'bg-red-50 border border-red-200' : 'bg-orange-50 border border-orange-200'}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className={`font-semibold ${!isLocked ? 'text-green-700' : isTrulyLocked ? 'text-red-700' : 'text-orange-700'}`}>
              {!isLocked ? '✏️ Soumission libre' : isTrulyLocked ? '🔒 Alignement verrouillé' : '📅 Comptabilisation en cours'}
            </span>
            <span className="text-gray-400 text-xs ml-2">{deadlineLabel(saison.submissionDeadline)}</span>
          </div>
          <div className="flex gap-4 text-xs">
            <span className={counts.voluntary + cartVoluntary >= saison.maxChanges && isLocked ? 'text-red-600 font-semibold' : 'text-gray-600'}>
              Changements : {counts.voluntary}{cartVoluntary > 0 ? `+${cartVoluntary}` : ''}/{saison.maxChanges}
            </span>
            <span className={counts.elimination + cartElim >= saison.maxElimChanges && isLocked ? 'text-red-600 font-semibold' : 'text-gray-600'}>
              Remplacements élim. : {counts.elimination}{cartElim > 0 ? `+${cartElim}` : ''}/{saison.maxElimChanges}
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
                  {Array.from({ length: count }).map((_, i) => {
                    const entry = entriesBySlot(slot)[i]
                    return (
                      <SlotRow
                        key={i}
                        slot={slot}
                        index={i}
                        entry={entry}
                        isLocked={isLocked}
                        isAdmin={isAdmin}
                        isActive={!!(removingEntry && removingEntry === entry)}
                        onSelect={handleSlotSelect}
                        canVoluntaryEdit={canVoluntaryEdit}
                        canElimEdit={canElimEdit}
                        cartItem={entry ? cartByEntryId.get(entry.id) : undefined}
                        onRemoveFromCart={entry ? () => handleRemoveFromCart(cartByEntryId.get(entry.id)?.localId ?? '') : undefined}
                      />
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* ── Colonne droite : cap + sélecteur + panier ── */}
        <div className="space-y-4">

          {/* Cap projetée */}
          <CapBar
            entries={entries}
            poolCap={saison.poolCap}
            cart={cart}
            currentAdd={addPlayer}
            currentRemove={removingEntry}
          />

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
                excludeIds={excludeIds}
                activeSlot={activeSlot}
                selected={addPlayer}
                onSelect={setAddPlayer}
                resetKey={searchKey}
              />

              <button
                onClick={handleAddToCart}
                disabled={!addPlayer}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-40 text-sm font-medium transition-colors"
              >
                {removingEntry ? '+ Ajouter au panier' : '+ Ajouter au panier'}
              </button>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 text-sm text-gray-400 text-center">
              L&apos;alignement est verrouillé.
            </div>
          )}

          {/* Panier */}
          {cart.length > 0 && (
            <div className="bg-white rounded-lg shadow p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-700">
                  Panier — {cart.length} changement{cart.length > 1 ? 's' : ''}
                </p>
                <button
                  onClick={() => { setCart([]); setError(null) }}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Vider
                </button>
              </div>

              <ul className="divide-y divide-gray-100">
                {cart.map(item => (
                  <li key={item.localId} className="flex items-center justify-between py-2 text-sm">
                    <div className="flex-1 min-w-0">
                      <span className={`inline-block text-xs font-medium px-1.5 py-0.5 rounded mr-2 ${
                        item.type === 'elimination' ? 'bg-red-100 text-red-700' :
                        item.type === 'voluntary' ? 'bg-orange-100 text-orange-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {item.type === 'elimination' ? 'Élim.' : item.type === 'voluntary' ? 'Volont.' : 'Ajout'}
                      </span>
                      <span className="text-gray-700 truncate">{item.label}</span>
                    </div>
                    <button
                      onClick={() => handleRemoveFromCart(item.localId)}
                      className="text-gray-400 hover:text-red-500 ml-3 shrink-0 text-xs"
                    >
                      Retirer
                    </button>
                  </li>
                ))}
              </ul>

              {error && <p className="text-sm text-red-600">{error}</p>}
              {success && <p className="text-sm text-green-600 font-medium">✓ Changements enregistrés.</p>}

              {projectedOver && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-1.5">
                  ⚠ Ce panier dépasse la masse salariale ({capFmt(projectedCap)} / {capFmt(saison.poolCap)}).
                </p>
              )}

              <button
                onClick={handleConfirmBatch}
                disabled={isPending || projectedOver}
                className="w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 disabled:opacity-40 text-sm font-semibold transition-colors"
              >
                {isPending
                  ? 'Enregistrement...'
                  : `Confirmer ${cart.length} changement${cart.length > 1 ? 's' : ''}`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
