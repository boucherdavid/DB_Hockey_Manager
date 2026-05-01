'use client'

import { useState, useEffect, useMemo, useTransition } from 'react'
import {
  getPoolerRosterAction,
  searchPlayersAction,
  submitBatchAction,
} from './actions'
import type {
  ActionType,
  RosterEntry,
  RosterForPooler,
  PlayerSearchResult,
  BatchActionInput,
} from './actions'

// ─── Types ────────────────────────────────────────────────────────────────────

type CartItem = {
  localId: string
  type: ActionType
  label: string
  swapActifEntry?: RosterEntry
  swapReservisteEntry?: RosterEntry
  recrueEntry?: RosterEntry
  deactivateActifEntry?: RosterEntry
  ltirEntry?: RosterEntry
  returnLtirEntry?: RosterEntry
  releaseEntry?: RosterEntry
  newPlayerEntry?: RosterEntry  // fake entry (id < 0) for projection only
  newPlayerType?: 'actif' | 'reserviste'
  newPlayerId?: number           // real players.id for DB submission
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayLocal() {
  return new Intl.DateTimeFormat('fr-CA', { timeZone: 'America/Toronto' }).format(new Date())
}

function entryLabel(e: RosterEntry) {
  const meta = [e.position, e.teamCode].filter(Boolean).join(', ')
  return `${e.lastName}, ${e.firstName}${meta ? ` (${meta})` : ''}`
}

function capFmt(n: number | null) {
  if (!n) return '—'
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n)
}

function posCategory(pos: string | null): 'F' | 'D' | 'G' {
  if (!pos) return 'F'
  const p = pos.toUpperCase()
  if (p === 'D') return 'D'
  if (p === 'G') return 'G'
  return 'F'
}

function projectRoster(roster: RosterForPooler, cart: CartItem[]): RosterForPooler {
  const map = new Map<number, RosterEntry>()
  for (const e of [...roster.actifs, ...roster.reservistes, ...roster.ltir, ...roster.recrues]) {
    map.set(e.id, { ...e })
  }

  let fakeIdCounter = -1

  for (const item of cart) {
    switch (item.type) {
      case 'swap':
        if (item.swapActifEntry && map.has(item.swapActifEntry.id))
          map.get(item.swapActifEntry.id)!.playerType = 'reserviste'
        if (item.swapReservisteEntry && map.has(item.swapReservisteEntry.id))
          map.get(item.swapReservisteEntry.id)!.playerType = 'actif'
        break
      case 'activate_rookie':
        if (item.deactivateActifEntry && map.has(item.deactivateActifEntry.id))
          map.get(item.deactivateActifEntry.id)!.playerType = 'reserviste'
        if (item.recrueEntry && map.has(item.recrueEntry.id))
          map.get(item.recrueEntry.id)!.playerType = 'actif'
        break
      case 'ltir':
        if (item.ltirEntry && map.has(item.ltirEntry.id))
          map.get(item.ltirEntry.id)!.playerType = 'ltir'
        break
      case 'return_ltir':
        if (item.deactivateActifEntry && map.has(item.deactivateActifEntry.id))
          map.get(item.deactivateActifEntry.id)!.playerType = 'reserviste'
        if (item.returnLtirEntry && map.has(item.returnLtirEntry.id))
          map.get(item.returnLtirEntry.id)!.playerType = 'actif'
        break
      case 'ltir_sign':
        if (item.ltirEntry && map.has(item.ltirEntry.id))
          map.get(item.ltirEntry.id)!.playerType = 'ltir'
        if (item.newPlayerEntry) {
          const id = fakeIdCounter--
          map.set(id, { ...item.newPlayerEntry, id, playerType: 'actif' })
        }
        break
      case 'sign':
        if (item.newPlayerEntry) {
          const id = fakeIdCounter--
          map.set(id, { ...item.newPlayerEntry, id, playerType: item.newPlayerType ?? 'actif' })
        }
        break
      case 'release':
        if (item.releaseEntry) map.delete(item.releaseEntry.id)
        break
    }
  }

  const all = [...map.values()]
  return {
    actifs:      all.filter(e => e.playerType === 'actif'),
    reservistes: all.filter(e => e.playerType === 'reserviste'),
    ltir:        all.filter(e => e.playerType === 'ltir'),
    recrues:     all.filter(e => e.playerType === 'recrue'),
  }
}

function computeCap(roster: RosterForPooler): number {
  return [...roster.actifs, ...roster.reservistes]
    .reduce((sum, e) => sum + (Number(e.capNumber) || 0), 0)
}

function cartItemToInput(item: CartItem): BatchActionInput {
  return {
    type: item.type,
    swapActifId:       item.swapActifEntry?.id,
    swapReservisteId:  item.swapReservisteEntry?.id,
    recrueEntryId:     item.recrueEntry?.id,
    deactivateActifId: item.deactivateActifEntry?.id,
    ltirEntryId:       item.ltirEntry?.id,
    returnLtirEntryId: item.returnLtirEntry?.id,
    releaseEntryId:    item.releaseEntry?.id,
    newPlayerId:       item.newPlayerId,
    newPlayerType:     item.newPlayerType,
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EntrySelect({
  label, entries, value, onChange,
}: {
  label: string
  entries: RosterEntry[]
  value: number
  onChange: (v: number) => void
}) {
  const valid = entries.filter(e => e.id > 0)
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <select
        value={value || ''}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        <option value="">— Choisir —</option>
        {valid.map(e => (
          <option key={e.id} value={e.id}>{entryLabel(e)}</option>
        ))}
      </select>
    </div>
  )
}

function PlayerSearch({
  label, season, onSelect,
}: {
  label: string
  season: string
  onSelect: (p: PlayerSearchResult) => void
}) {
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState<PlayerSearchResult[]>([])
  const [selected, setSelected] = useState<PlayerSearchResult | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (query.length < 2) { setResults([]); return }
    const t = setTimeout(async () => {
      setLoading(true)
      const r = await searchPlayersAction(query, season)
      setResults(r)
      setLoading(false)
    }, 300)
    return () => clearTimeout(t)
  }, [query, season])

  if (selected) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        <div className="flex items-center gap-2 border border-green-300 bg-green-50 rounded px-3 py-2 text-sm">
          <span className="flex-1 font-medium text-gray-800">{selected.lastName}, {selected.firstName}</span>
          {selected.capNumber != null && (
            <span className="text-xs text-gray-500">{capFmt(selected.capNumber)}</span>
          )}
          <button
            onClick={() => { setSelected(null); setQuery('') }}
            className="text-gray-400 hover:text-gray-600 text-xs"
          >✕</button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Rechercher par nom..."
        className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
      {loading && <p className="text-xs text-gray-400 mt-1">Recherche...</p>}
      {results.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded shadow-lg max-h-48 overflow-y-auto">
          {results.map(p => (
            <button
              key={p.id}
              onClick={() => { setSelected(p); setResults([]); setQuery(''); onSelect(p) }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center gap-2"
            >
              <span className="font-medium">{p.lastName}, {p.firstName}</span>
              {p.position && <span className="text-xs text-gray-400">{p.position}</span>}
              <span className="ml-auto flex items-center gap-2 shrink-0">
                {p.capNumber != null && <span className="text-xs text-gray-500">{capFmt(p.capNumber)}</span>}
                {p.teamCode && <span className="text-xs text-gray-500">{p.teamCode}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Action definitions ───────────────────────────────────────────────────────

const ACTION_DEFS: { type: ActionType; label: string; description: string; adminOnly?: boolean }[] = [
  { type: 'swap',            label: 'Ajustement',        description: 'Actif ↔ réserviste' },
  { type: 'activate_rookie', label: 'Activation recrue', description: 'Recrue → actif' },
  { type: 'sign',            label: 'Signature',         description: 'Ajouter un agent libre' },
  { type: 'release',         label: 'Libération',        description: 'Retirer un joueur' },
  { type: 'ltir',            label: 'LTIR',              description: 'Actif → LTIR', adminOnly: true },
  { type: 'return_ltir',     label: 'Retour LTIR',       description: 'LTIR → actif', adminOnly: true },
  { type: 'ltir_sign',       label: 'LTIR + Signature',  description: 'LTIR et signer', adminOnly: true },
]

// ─── Main component ───────────────────────────────────────────────────────────

export default function GestionEffectifsManager({
  isAdmin,
  poolers,
  selfPoolerId,
  selfPoolerName,
  saisonId,
  season,
  poolCap,
}: {
  isAdmin: boolean
  poolers?: { id: string; name: string }[]
  selfPoolerId?: string
  selfPoolerName?: string
  saisonId: number
  season: string
  poolCap: number
}) {
  const [poolerId, setPoolerId]         = useState(selfPoolerId ?? '')
  const [roster, setRoster]             = useState<RosterForPooler | null>(null)
  const [loadingRoster, setLoadingRoster] = useState(false)

  // Cart
  const [cart, setCart] = useState<CartItem[]>([])

  // Add-action form state
  const [addType, setAddType]                   = useState<ActionType | null>(null)
  const [addSwapActifId, setAddSwapActifId]     = useState(0)
  const [addSwapResId, setAddSwapResId]         = useState(0)
  const [addRecruId, setAddRecruId]             = useState(0)
  const [addDeactifId, setAddDeactifId]         = useState(0)
  const [addLtirId, setAddLtirId]               = useState(0)
  const [addReturnLtirId, setAddReturnLtirId]   = useState(0)
  const [addReleaseId, setAddReleaseId]         = useState(0)
  const [addNewPlayer, setAddNewPlayer]         = useState<PlayerSearchResult | null>(null)
  const [addNewPlayerType, setAddNewPlayerType] = useState<'actif' | 'reserviste'>('actif')
  const [searchKey, setSearchKey]               = useState(0)  // forces PlayerSearch remount

  // Admin date override
  const [forceDateEnabled, setForceDateEnabled] = useState(false)
  const [forcedDate, setForcedDate]             = useState(todayLocal)

  // Submit
  const [isPending, startTransition] = useTransition()
  const [error, setError]   = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Projected roster (memo)
  const projected = useMemo(
    () => roster ? projectRoster(roster, cart) : null,
    [roster, cart],
  )

  const capUsed = useMemo(() => projected ? computeCap(projected) : 0, [projected])
  const capOver = capUsed > poolCap

  const actifCounts = useMemo(() => {
    if (!projected) return { F: 0, D: 0, G: 0 }
    return projected.actifs.reduce(
      (acc, e) => { acc[posCategory(e.position)]++; return acc },
      { F: 0, D: 0, G: 0 },
    )
  }, [projected])

  const compositionOk = actifCounts.F === 12 && actifCounts.D === 6 && actifCounts.G === 2
  const reservistesOk = (projected?.reservistes.length ?? 0) >= 2
  const canSubmit = cart.length > 0 && !capOver && compositionOk && reservistesOk && !isPending

  // Load roster when pooler selection changes
  useEffect(() => {
    if (!poolerId) { setRoster(null); return }
    setLoadingRoster(true)
    setCart([])
    resetAddForm()
    setSuccess(false)
    setError(null)
    getPoolerRosterAction(poolerId, saisonId, season).then(r => {
      setRoster(r)
      setLoadingRoster(false)
    })
  }, [poolerId, saisonId, season])

  function resetAddForm() {
    setAddType(null)
    setAddSwapActifId(0); setAddSwapResId(0)
    setAddRecruId(0); setAddDeactifId(0)
    setAddLtirId(0); setAddReturnLtirId(0)
    setAddReleaseId(0)
    setAddNewPlayer(null)
    setAddNewPlayerType('actif')
    setSearchKey(k => k + 1)
  }

  function handleSelectAddType(type: ActionType) {
    setAddType(type)
    setAddSwapActifId(0); setAddSwapResId(0)
    setAddRecruId(0); setAddDeactifId(0)
    setAddLtirId(0); setAddReturnLtirId(0)
    setAddReleaseId(0)
    setAddNewPlayer(null)
    setSearchKey(k => k + 1)
  }

  function findEntry(id: number): RosterEntry | undefined {
    if (!projected) return undefined
    return [
      ...projected.actifs,
      ...projected.reservistes,
      ...projected.ltir,
      ...projected.recrues,
    ].find(e => e.id === id)
  }

  function isAddReady(): boolean {
    if (!addType) return false
    switch (addType) {
      case 'swap':            return !!(addSwapActifId && addSwapResId)
      case 'activate_rookie': return !!(addRecruId && addDeactifId)
      case 'ltir':            return !!addLtirId
      case 'return_ltir':     return !!(addReturnLtirId && addDeactifId)
      case 'ltir_sign':       return !!(addLtirId && addNewPlayer)
      case 'sign':            return !!addNewPlayer
      case 'release':         return !!addReleaseId
      default:                return false
    }
  }

  function buildCartItem(): CartItem | null {
    if (!addType || !projected) return null
    const localId = crypto.randomUUID()

    const makeNewPlayerEntry = (type: 'actif' | 'reserviste'): RosterEntry => ({
      id: -(Date.now()),
      playerId: addNewPlayer!.id,
      playerType: type,
      firstName: addNewPlayer!.firstName,
      lastName: addNewPlayer!.lastName,
      position: addNewPlayer!.position,
      teamCode: addNewPlayer!.teamCode,
      nhlId: addNewPlayer!.nhlId,
      capNumber: addNewPlayer!.capNumber,
    })

    switch (addType) {
      case 'swap': {
        const a = findEntry(addSwapActifId)
        const r = findEntry(addSwapResId)
        if (!a || !r) return null
        return {
          localId, type: 'swap',
          label: `Ajustement : ${a.lastName} → RÉS / ${r.lastName} → ACT`,
          swapActifEntry: a, swapReservisteEntry: r,
        }
      }
      case 'activate_rookie': {
        const rec = findEntry(addRecruId)
        const act = findEntry(addDeactifId)
        if (!rec || !act) return null
        return {
          localId, type: 'activate_rookie',
          label: `Recrue : ${rec.lastName} → ACT / ${act.lastName} → RÉS`,
          recrueEntry: rec, deactivateActifEntry: act,
        }
      }
      case 'ltir': {
        const e = findEntry(addLtirId)
        if (!e) return null
        return { localId, type: 'ltir', label: `LTIR : ${e.lastName}, ${e.firstName}`, ltirEntry: e }
      }
      case 'return_ltir': {
        const ret = findEntry(addReturnLtirId)
        const act = findEntry(addDeactifId)
        if (!ret || !act) return null
        return {
          localId, type: 'return_ltir',
          label: `Retour LTIR : ${ret.lastName} → ACT / ${act.lastName} → RÉS`,
          returnLtirEntry: ret, deactivateActifEntry: act,
        }
      }
      case 'ltir_sign': {
        const e = findEntry(addLtirId)
        if (!e || !addNewPlayer) return null
        return {
          localId, type: 'ltir_sign',
          label: `LTIR+Sign : ${e.lastName} → LTIR / ${addNewPlayer.lastName} → ACT`,
          ltirEntry: e,
          newPlayerEntry: makeNewPlayerEntry('actif'),
          newPlayerId: addNewPlayer.id,
          newPlayerType: 'actif',
        }
      }
      case 'sign': {
        if (!addNewPlayer) return null
        return {
          localId, type: 'sign',
          label: `Signature : ${addNewPlayer.lastName}, ${addNewPlayer.firstName} (${addNewPlayerType})`,
          newPlayerEntry: makeNewPlayerEntry(addNewPlayerType),
          newPlayerId: addNewPlayer.id,
          newPlayerType: addNewPlayerType,
        }
      }
      case 'release': {
        const e = findEntry(addReleaseId)
        if (!e) return null
        return {
          localId, type: 'release',
          label: `Libération : ${e.lastName}, ${e.firstName}`,
          releaseEntry: e,
        }
      }
      default: return null
    }
  }

  function handleAddToCart() {
    const item = buildCartItem()
    if (!item) return
    setCart(c => [...c, item])
    resetAddForm()
    setError(null)
    setSuccess(false)
  }

  function handleSubmit() {
    setError(null)
    startTransition(async () => {
      const result = await submitBatchAction({
        poolerId,
        saisonId,
        actions: cart.map(cartItemToInput),
        forcedDate: isAdmin && forceDateEnabled ? forcedDate : undefined,
      })
      if (result.error) {
        setError(result.error)
      } else {
        setSuccess(true)
        setCart([])
        resetAddForm()
        const r = await getPoolerRosterAction(poolerId, saisonId, season)
        setRoster(r)
      }
    })
  }

  // ─── Add-form fields per action type ──────────────────────────────────────

  function renderAddFields() {
    if (!addType || !projected) return null
    switch (addType) {
      case 'swap':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <EntrySelect label="Actif à désactiver"   entries={projected.actifs}      value={addSwapActifId} onChange={setAddSwapActifId} />
            <EntrySelect label="Réserviste à activer" entries={projected.reservistes} value={addSwapResId}   onChange={setAddSwapResId} />
          </div>
        )
      case 'activate_rookie':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <EntrySelect label="Recrue à activer"    entries={projected.recrues} value={addRecruId}   onChange={setAddRecruId} />
            <EntrySelect label="Actif à désactiver"  entries={projected.actifs}  value={addDeactifId} onChange={setAddDeactifId} />
          </div>
        )
      case 'ltir':
        return <EntrySelect label="Actif à mettre sur LTIR" entries={projected.actifs} value={addLtirId} onChange={setAddLtirId} />
      case 'return_ltir':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <EntrySelect label="Joueur LTIR à réintégrer" entries={projected.ltir}   value={addReturnLtirId} onChange={setAddReturnLtirId} />
            <EntrySelect label="Actif à désactiver"       entries={projected.actifs} value={addDeactifId}    onChange={setAddDeactifId} />
          </div>
        )
      case 'ltir_sign':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <EntrySelect label="Actif à mettre sur LTIR"    entries={projected.actifs} value={addLtirId} onChange={setAddLtirId} />
            <PlayerSearch key={searchKey} label="Agent libre à signer (actif)" season={season} onSelect={setAddNewPlayer} />
          </div>
        )
      case 'sign':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <PlayerSearch key={searchKey} label="Joueur à signer" season={season} onSelect={setAddNewPlayer} />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rôle</label>
              <select
                value={addNewPlayerType}
                onChange={e => setAddNewPlayerType(e.target.value as 'actif' | 'reserviste')}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              >
                <option value="actif">Actif</option>
                <option value="reserviste">Réserviste</option>
              </select>
            </div>
          </div>
        )
      case 'release':
        return (
          <EntrySelect
            label="Joueur à libérer"
            entries={[...projected.actifs, ...projected.reservistes, ...projected.ltir].filter(e => e.id > 0)}
            value={addReleaseId}
            onChange={setAddReleaseId}
          />
        )
    }
  }

  const visibleActions = ACTION_DEFS.filter(a => isAdmin || !a.adminOnly)
  const poolerName = isAdmin
    ? (poolers?.find(p => p.id === poolerId)?.name ?? '')
    : (selfPoolerName ?? '')

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* Pooler selector (admin only) */}
      {isAdmin && (
        <div className="bg-white rounded-lg shadow p-5">
          <label className="block text-sm font-medium text-gray-700 mb-1">Pooler</label>
          <select
            value={poolerId}
            onChange={e => setPoolerId(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          >
            <option value="">— Choisir un pooler —</option>
            {poolers?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      )}

      {loadingRoster && (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-400 text-sm">
          Chargement du roster...
        </div>
      )}

      {/* Add-action form */}
      {roster && projected && (
        <div className="bg-white rounded-lg shadow p-5 space-y-4">
          <p className="text-sm font-semibold text-gray-700">Ajouter une action</p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {visibleActions.map(a => (
              <button
                key={a.type}
                onClick={() => handleSelectAddType(a.type)}
                className={`text-left px-3 py-2.5 rounded-lg border-2 transition-colors ${
                  addType === a.type
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <p className={`text-xs font-semibold leading-tight ${addType === a.type ? 'text-blue-700' : 'text-gray-800'}`}>{a.label}</p>
                <p className="text-xs text-gray-400 mt-0.5 leading-tight">{a.description}</p>
              </button>
            ))}
          </div>

          {addType && (
            <div className="space-y-4 pt-3 border-t border-gray-100">
              {renderAddFields()}
              <div className="flex justify-end">
                <button
                  onClick={handleAddToCart}
                  disabled={!isAddReady()}
                  className="bg-green-600 text-white px-4 py-2 rounded font-medium text-sm hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Ajouter au panier
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cart */}
      {cart.length > 0 && (
        <div className="bg-white rounded-lg shadow p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">
              Panier — {cart.length} action{cart.length > 1 ? 's' : ''}
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
              <li key={item.localId} className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-gray-700">{item.label}</span>
                <button
                  onClick={() => setCart(c => c.filter(i => i.localId !== item.localId))}
                  className="text-gray-400 hover:text-red-500 ml-4 shrink-0 text-xs"
                >
                  Retirer
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Projected state */}
      {projected && cart.length > 0 && (
        <div className="bg-white rounded-lg shadow p-5 space-y-3">
          <p className="text-sm font-semibold text-gray-700">État projeté</p>

          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            <span>
              Actifs :{' '}
              <span className={actifCounts.F !== 12 ? 'text-red-600 font-semibold' : 'text-gray-700'}>{actifCounts.F}A</span>
              {' '}
              <span className={actifCounts.D !== 6 ? 'text-red-600 font-semibold' : 'text-gray-700'}>{actifCounts.D}D</span>
              {' '}
              <span className={actifCounts.G !== 2 ? 'text-red-600 font-semibold' : 'text-gray-700'}>{actifCounts.G}G</span>
            </span>
            <span>
              Réservistes :{' '}
              <span className={projected.reservistes.length < 2 ? 'text-red-600 font-semibold' : 'text-gray-700'}>
                {projected.reservistes.length}
              </span>
            </span>
            {projected.ltir.length > 0 && <span>LTIR : {projected.ltir.length}</span>}
            {projected.recrues.length > 0 && <span>Recrues : {projected.recrues.length}</span>}
          </div>

          {/* Cap bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-gray-500">
              <span>Masse salariale</span>
              <span className={capOver ? 'text-red-600 font-semibold' : 'text-gray-700'}>
                {capFmt(capUsed)} / {capFmt(poolCap)}
              </span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${capOver ? 'bg-red-500' : 'bg-green-500'}`}
                style={{ width: `${Math.min((capUsed / poolCap) * 100, 100)}%` }}
              />
            </div>
          </div>

          {!compositionOk && (
            <p className="text-xs text-red-600">
              La composition des actifs doit être 12 attaquants / 6 défenseurs / 2 gardiens.
            </p>
          )}
          {!reservistesOk && (
            <p className="text-xs text-red-600">Minimum 2 réservistes requis.</p>
          )}
          {capOver && (
            <p className="text-xs text-red-600">
              La masse salariale dépasse le cap du pool ({capFmt(poolCap)}).
            </p>
          )}
        </div>
      )}

      {/* Admin date override */}
      {isAdmin && cart.length > 0 && (
        <div className="bg-white rounded-lg shadow p-5 space-y-3">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="force-date"
              checked={forceDateEnabled}
              onChange={e => setForceDateEnabled(e.target.checked)}
              className="rounded border-gray-300"
            />
            <label htmlFor="force-date" className="text-sm text-gray-700">
              Forcer une date effective
            </label>
          </div>
          {forceDateEnabled ? (
            <input
              type="date"
              value={forcedDate}
              onChange={e => setForcedDate(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 text-sm max-w-xs"
            />
          ) : (
            <p className="text-xs text-gray-400">
              Par défaut : date et heure de la soumission.
            </p>
          )}
        </div>
      )}

      {/* Submit */}
      {cart.length > 0 && (
        <div className="bg-white rounded-lg shadow p-5 flex items-center justify-between gap-4">
          <div className="text-sm text-gray-600">
            <span className="font-medium">{poolerName}</span>
            {' — '}
            {cart.length} action{cart.length > 1 ? 's' : ''}
            {isAdmin && forceDateEnabled && ` — ${forcedDate}`}
          </div>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="bg-blue-600 text-white px-5 py-2 rounded font-medium text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {isPending ? 'En cours...' : 'Soumettre'}
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-700">
          ✓ Mouvements appliqués avec succès.
        </div>
      )}
    </div>
  )
}
