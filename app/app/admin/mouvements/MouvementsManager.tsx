'use client'

import { useState, useEffect, useTransition } from 'react'
import {
  getPoolerRosterAction,
  searchPlayersAction,
  checkEffectiveDateAction,
  submitMouvementAction,
} from './actions'
import type { ActionType, RosterEntry, RosterForPooler, MouvementInput } from './actions'

// ─── Types ────────────────────────────────────────────────────────────────────

type Pooler = { id: string; name: string }

const ACTION_DEFS: { type: ActionType; label: string; description: string }[] = [
  { type: 'swap',            label: 'Ajustement d\'alignement', description: 'Interchanger un actif et un réserviste' },
  { type: 'activate_rookie', label: 'Activation recrue',        description: 'Activer une recrue, désactiver un actif' },
  { type: 'ltir',            label: 'Mise sur LTIR',            description: 'Envoyer un joueur actif sur LTIR' },
  { type: 'return_ltir',     label: 'Retour LTIR',              description: 'Réintégrer un joueur LTIR, désactiver un actif' },
  { type: 'ltir_sign',       label: 'Agent libre + LTIR',       description: 'Mettre un joueur sur LTIR et signer un agent libre' },
  { type: 'sign',            label: 'Signature agent libre',    description: 'Ajouter un nouveau joueur au roster' },
  { type: 'release',         label: 'Libération',               description: 'Retirer un joueur du roster' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function entryLabel(e: RosterEntry) {
  return `${e.lastName}, ${e.firstName}${e.position ? ` (${e.position}` : ''}${e.teamCode ? `, ${e.teamCode})` : e.position ? ')' : ''}`
}

function todayLocal() {
  return new Intl.DateTimeFormat('fr-CA', { timeZone: 'America/Toronto' }).format(new Date())
}

function tomorrowLocal() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return new Intl.DateTimeFormat('fr-CA', { timeZone: 'America/Toronto' }).format(d)
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EntrySelect({
  label, entries, value, onChange, placeholder,
}: {
  label: string
  entries: RosterEntry[]
  value: number
  onChange: (v: number) => void
  placeholder?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <select
        value={value || ''}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        <option value="">{placeholder ?? '— Choisir —'}</option>
        {entries.map(e => (
          <option key={e.id} value={e.id}>{entryLabel(e)}</option>
        ))}
      </select>
    </div>
  )
}

function PlayerSearch({
  label, onSelect,
}: {
  label: string
  onSelect: (p: { id: number; firstName: string; lastName: string; position: string | null; teamCode: string | null }) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{ id: number; firstName: string; lastName: string; position: string | null; teamCode: string | null }[]>([])
  const [selected, setSelected] = useState<{ id: number; firstName: string; lastName: string } | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (query.length < 2) { setResults([]); return }
    const t = setTimeout(async () => {
      setLoading(true)
      const r = await searchPlayersAction(query)
      setResults(r)
      setLoading(false)
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  if (selected) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        <div className="flex items-center gap-2 border border-green-300 bg-green-50 rounded px-3 py-2 text-sm">
          <span className="flex-1 font-medium text-gray-800">{selected.lastName}, {selected.firstName}</span>
          <button onClick={() => { setSelected(null); setQuery('') }} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
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
              onClick={() => {
                setSelected(p)
                setResults([])
                setQuery('')
                onSelect(p)
              }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center gap-2"
            >
              <span className="font-medium">{p.lastName}, {p.firstName}</span>
              {p.position && <span className="text-xs text-gray-400">{p.position}</span>}
              {p.teamCode && <span className="text-xs text-gray-500 ml-auto">{p.teamCode}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MouvementsManager({
  poolers,
  saisonId,
}: {
  poolers: Pooler[]
  saisonId: number
}) {
  const [poolerId, setPoolerId]         = useState('')
  const [actionType, setActionType]     = useState<ActionType | null>(null)
  const [roster, setRoster]             = useState<RosterForPooler | null>(null)
  const [loadingRoster, setLoadingRoster] = useState(false)

  // Action-specific fields
  const [swapActifId, setSwapActifId]             = useState(0)
  const [swapReservisteId, setSwapReservisteId]   = useState(0)
  const [recrueEntryId, setRecruEntryId]          = useState(0)
  const [deactivateActifId, setDeactivateActifId] = useState(0)
  const [ltirEntryId, setLtirEntryId]             = useState(0)
  const [returnLtirEntryId, setReturnLtirEntryId] = useState(0)
  const [releaseEntryId, setReleaseEntryId]       = useState(0)
  const [newPlayerId, setNewPlayerId]             = useState(0)
  const [newPlayerType, setNewPlayerType]         = useState<'actif' | 'reserviste'>('actif')

  // Date & effective date
  const [date, setDate]                       = useState(todayLocal())
  const [effectiveWarning, setEffectiveWarning] = useState<string | null>(null)
  const [checkingDate, setCheckingDate]       = useState(false)

  // Submit
  const [isPending, startTransition] = useTransition()
  const [error, setError]   = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Load roster when pooler changes
  useEffect(() => {
    if (!poolerId) { setRoster(null); return }
    setLoadingRoster(true)
    setActionType(null)
    resetFields()
    getPoolerRosterAction(poolerId, saisonId).then(r => {
      setRoster(r)
      setLoadingRoster(false)
    })
  }, [poolerId, saisonId])

  // Check effective date when involved players change
  useEffect(() => {
    if (!actionType || !roster) return
    const nhlIds = getInvolvedNhlIds()
    if (nhlIds.length === 0) return
    setCheckingDate(true)
    checkEffectiveDateAction(nhlIds).then(result => {
      setEffectiveWarning(result.warning)
      if (!result.isToday) setDate(tomorrowLocal())
      else setDate(todayLocal())
      setCheckingDate(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swapActifId, swapReservisteId, recrueEntryId, deactivateActifId, ltirEntryId, returnLtirEntryId, newPlayerId, releaseEntryId])

  function getInvolvedNhlIds(): (number | null)[] {
    if (!roster) return []
    const findNhl = (id: number) => [...roster.actifs, ...roster.reservistes, ...roster.ltir, ...roster.recrues].find(e => e.id === id)?.nhlId ?? null
    switch (actionType) {
      case 'swap':            return [findNhl(swapActifId), findNhl(swapReservisteId)]
      case 'activate_rookie': return [findNhl(recrueEntryId), findNhl(deactivateActifId)]
      case 'ltir':            return [findNhl(ltirEntryId)]
      case 'return_ltir':     return [findNhl(returnLtirEntryId), findNhl(deactivateActifId)]
      case 'ltir_sign':       return [findNhl(ltirEntryId)]
      case 'sign':            return []
      case 'release':         return [findNhl(releaseEntryId)]
      default:                return []
    }
  }

  function resetFields() {
    setSwapActifId(0); setSwapReservisteId(0)
    setRecruEntryId(0); setDeactivateActifId(0)
    setLtirEntryId(0); setReturnLtirEntryId(0)
    setReleaseEntryId(0); setNewPlayerId(0)
    setEffectiveWarning(null)
    setError(null); setSuccess(false)
  }

  function handleActionSelect(type: ActionType) {
    setActionType(type)
    resetFields()
  }

  function buildInput(): MouvementInput {
    return {
      poolerId, saisonId, actionType: actionType!, date,
      swapActifId:       swapActifId || undefined,
      swapReservisteId:  swapReservisteId || undefined,
      recrueEntryId:     recrueEntryId || undefined,
      deactivateActifId: deactivateActifId || undefined,
      ltirEntryId:       ltirEntryId || undefined,
      returnLtirEntryId: returnLtirEntryId || undefined,
      newPlayerId:       newPlayerId || undefined,
      newPlayerType,
      releaseEntryId:    releaseEntryId || undefined,
    }
  }

  function handleSubmit() {
    setError(null)
    startTransition(async () => {
      const result = await submitMouvementAction(buildInput())
      if (result.error) {
        setError(result.error)
      } else {
        setSuccess(true)
        resetFields()
        setActionType(null)
        // Reload roster
        const r = await getPoolerRosterAction(poolerId, saisonId)
        setRoster(r)
      }
    })
  }

  // ─── Form fields per action ────────────────────────────────────────────────

  function renderFields() {
    if (!roster || !actionType) return null
    switch (actionType) {
      case 'swap':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <EntrySelect label="Actif à désactiver" entries={roster.actifs}      value={swapActifId}      onChange={setSwapActifId} />
            <EntrySelect label="Réserviste à activer" entries={roster.reservistes} value={swapReservisteId} onChange={setSwapReservisteId} />
          </div>
        )
      case 'activate_rookie':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <EntrySelect label="Recrue à activer"    entries={roster.recrues} value={recrueEntryId}      onChange={setRecruEntryId} />
            <EntrySelect label="Actif à désactiver"  entries={roster.actifs}  value={deactivateActifId} onChange={setDeactivateActifId} />
          </div>
        )
      case 'ltir':
        return <EntrySelect label="Joueur à mettre sur LTIR" entries={roster.actifs} value={ltirEntryId} onChange={setLtirEntryId} />
      case 'return_ltir':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <EntrySelect label="Joueur LTIR à réintégrer" entries={roster.ltir}   value={returnLtirEntryId} onChange={setReturnLtirEntryId} />
            <EntrySelect label="Actif à désactiver"       entries={roster.actifs} value={deactivateActifId} onChange={setDeactivateActifId} />
          </div>
        )
      case 'ltir_sign':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <EntrySelect label="Joueur à mettre sur LTIR" entries={roster.actifs} value={ltirEntryId} onChange={setLtirEntryId} />
            <PlayerSearch label="Agent libre à signer (actif)" onSelect={p => setNewPlayerId(p.id)} />
          </div>
        )
      case 'sign':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <PlayerSearch label="Joueur à signer" onSelect={p => setNewPlayerId(p.id)} />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rôle</label>
              <select
                value={newPlayerType}
                onChange={e => setNewPlayerType(e.target.value as 'actif' | 'reserviste')}
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
            entries={[...roster.actifs, ...roster.reservistes, ...roster.ltir]}
            value={releaseEntryId}
            onChange={setReleaseEntryId}
          />
        )
    }
  }

  function isReadyToSubmit(): boolean {
    if (!poolerId || !actionType) return false
    switch (actionType) {
      case 'swap':            return !!(swapActifId && swapReservisteId)
      case 'activate_rookie': return !!(recrueEntryId && deactivateActifId)
      case 'ltir':            return !!ltirEntryId
      case 'return_ltir':     return !!(returnLtirEntryId && deactivateActifId)
      case 'ltir_sign':       return !!(ltirEntryId && newPlayerId)
      case 'sign':            return !!newPlayerId
      case 'release':         return !!releaseEntryId
      default:                return false
    }
  }

  const actionDef = ACTION_DEFS.find(a => a.type === actionType)

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* Pooler + Date */}
      <div className="bg-white rounded-lg shadow p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Pooler</label>
          <select
            value={poolerId}
            onChange={e => setPoolerId(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          >
            <option value="">— Choisir un pooler —</option>
            {poolers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
          {checkingDate && <p className="text-xs text-gray-400 mt-1">Vérification...</p>}
          {effectiveWarning && (
            <p className="text-xs text-orange-600 mt-1">⚠ {effectiveWarning}</p>
          )}
          {!effectiveWarning && !checkingDate && isReadyToSubmit() && (
            <p className="text-xs text-green-600 mt-1">✓ Effectif aujourd&apos;hui</p>
          )}
        </div>
      </div>

      {/* Action type */}
      {poolerId && !loadingRoster && roster && (
        <div className="bg-white rounded-lg shadow p-5">
          <p className="text-sm font-medium text-gray-700 mb-3">Type de mouvement</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ACTION_DEFS.map(a => (
              <button
                key={a.type}
                onClick={() => handleActionSelect(a.type)}
                className={`text-left px-4 py-3 rounded-lg border-2 transition-colors ${
                  actionType === a.type
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <p className={`text-sm font-semibold ${actionType === a.type ? 'text-blue-700' : 'text-gray-800'}`}>{a.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{a.description}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {loadingRoster && (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-400 text-sm">Chargement du roster...</div>
      )}

      {/* Action fields */}
      {actionType && roster && (
        <div className="bg-white rounded-lg shadow p-5 space-y-4">
          <p className="text-sm font-semibold text-gray-700">{actionDef?.label}</p>
          {renderFields()}
        </div>
      )}

      {/* Submit */}
      {isReadyToSubmit() && (
        <div className="bg-white rounded-lg shadow p-5 flex items-center justify-between gap-4">
          <div className="text-sm text-gray-600">
            <span className="font-medium">{poolers.find(p => p.id === poolerId)?.name}</span>
            {' — '}{actionDef?.label}
            {' — '}{date}
          </div>
          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="bg-blue-600 text-white px-5 py-2 rounded font-medium text-sm hover:bg-blue-700 disabled:opacity-50 shrink-0"
          >
            {isPending ? 'En cours...' : 'Appliquer'}
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">{error}</div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-700">
          ✓ Mouvement appliqué avec succès.
        </div>
      )}
    </div>
  )
}
