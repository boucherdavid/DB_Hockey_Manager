'use client'
import { useState, useEffect, useTransition, useCallback } from 'react'
import {
  getHistRosterAction,
  searchHistPlayersAction,
  submitHistChangeAction,
  getHistLogAction,
  type HistRosterEntry,
  type HistPlayerResult,
  type HistLogEntry,
  type HistTxType,
} from './historique-actions'

type Pooler = { id: string; name: string }

const TX_TYPES: { value: HistTxType; label: string }[] = [
  { value: 'swap',   label: 'Échange même pooler' },
  { value: 'trade',  label: 'Échange entre poolers' },
  { value: 'ajout',  label: 'Ajout seulement' },
  { value: 'retrait', label: 'Retrait seulement' },
]

function PlayerSearch({
  label,
  onSelect,
  selected,
  onClear,
}: {
  label: string
  onSelect: (p: HistPlayerResult) => void
  selected: HistPlayerResult | null
  onClear: () => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<HistPlayerResult[]>([])

  useEffect(() => {
    if (selected) return
    const t = setTimeout(async () => {
      const r = await searchHistPlayersAction(query)
      setResults(r)
    }, 300)
    return () => clearTimeout(t)
  }, [query, selected])

  if (selected) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{selected.name}</span>
        <span className="text-xs text-gray-400">{selected.teamCode} · {selected.position}</span>
        <button onClick={onClear} className="text-xs text-red-500 hover:text-red-700">✕</button>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <label className="text-xs text-gray-500">{label}</label>
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Rechercher un joueur..."
        className="w-full border rounded px-2 py-1 text-sm"
      />
      {results.length > 0 && (
        <ul className="border rounded bg-white shadow text-sm max-h-40 overflow-y-auto">
          {results.map(p => (
            <li
              key={p.id}
              onClick={() => { onSelect(p); setQuery(''); setResults([]) }}
              className="px-3 py-1.5 hover:bg-blue-50 cursor-pointer"
            >
              {p.name} <span className="text-gray-400 text-xs">{p.teamCode} · {p.position}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function RosterSelect({
  label,
  roster,
  value,
  onChange,
}: {
  label: string
  roster: HistRosterEntry[]
  value: number | null
  onChange: (id: number | null) => void
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-gray-500">{label}</label>
      <select
        value={value ?? ''}
        onChange={e => onChange(e.target.value ? Number(e.target.value) : null)}
        className="w-full border rounded px-2 py-1 text-sm"
      >
        <option value="">— Sélectionner —</option>
        {roster.map(r => (
          <option key={r.id} value={r.playerId}>
            {r.name} ({r.teamCode} · {r.playerType})
          </option>
        ))}
      </select>
    </div>
  )
}

export default function HistoriqueManager({
  poolers,
  poolSeasonId,
  initialLog,
}: {
  poolers: Pooler[]
  poolSeasonId: number
  initialLog: HistLogEntry[]
}) {
  const [isPending, startTransition] = useTransition()
  const [txType, setTxType] = useState<HistTxType>('swap')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))

  // Côté A
  const [poolerAId, setPoolerAId] = useState('')
  const [rosterA, setRosterA] = useState<HistRosterEntry[]>([])
  const [playerOutAId, setPlayerOutAId] = useState<number | null>(null)
  const [playerInA, setPlayerInA] = useState<HistPlayerResult | null>(null)
  const [playerInAType, setPlayerInAType] = useState<'actif' | 'reserviste'>('actif')

  // Côté B (trade)
  const [poolerBId, setPoolerBId] = useState('')
  const [rosterB, setRosterB] = useState<HistRosterEntry[]>([])
  const [playerInBType, setPlayerInBType] = useState<'actif' | 'reserviste'>('actif')

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [log, setLog] = useState<HistLogEntry[]>(initialLog)

  const refreshLog = useCallback(async () => {
    const l = await getHistLogAction(poolSeasonId)
    setLog(l)
  }, [poolSeasonId])

  // Charger roster A quand le pooler A change
  useEffect(() => {
    if (!poolerAId) { setRosterA([]); return }
    getHistRosterAction(poolerAId, poolSeasonId).then(setRosterA)
    setPlayerOutAId(null)
  }, [poolerAId, poolSeasonId])

  // Charger roster B quand le pooler B change
  useEffect(() => {
    if (!poolerBId) { setRosterB([]); return }
    getHistRosterAction(poolerBId, poolSeasonId).then(setRosterB)
  }, [poolerBId, poolSeasonId])

  function reset() {
    setPlayerOutAId(null)
    setPlayerInA(null)
    setPlayerInAType('actif')
    setPlayerInBType('actif')
    setError(null)
    setSuccess(false)
  }

  function handleSubmit() {
    setError(null)
    setSuccess(false)
    startTransition(async () => {
      const result = await submitHistChangeAction({
        poolSeasonId,
        date,
        txType,
        poolerAId,
        playerOutAId: txType === 'ajout' ? null : playerOutAId,
        playerInAId: txType === 'retrait' ? null : (playerInA?.id ?? null),
        playerInAType,
        poolerBId: txType === 'trade' ? poolerBId : null,
        playerInBType,
      })
      if (result.error) {
        setError(result.error)
      } else {
        setSuccess(true)
        reset()
        // Recharger les rosters et le log
        if (poolerAId) getHistRosterAction(poolerAId, poolSeasonId).then(setRosterA)
        if (poolerBId) getHistRosterAction(poolerBId, poolSeasonId).then(setRosterB)
        refreshLog()
      }
    })
  }

  const canSubmit = !!poolerAId && !!date && (
    txType === 'swap'   ? (!!playerOutAId && !!playerInA) :
    txType === 'trade'  ? (!!playerOutAId && !!playerInA && !!poolerBId) :
    txType === 'ajout'  ? !!playerInA :
    txType === 'retrait'? !!playerOutAId : false
  )

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Formulaire */}
      <div className="bg-white rounded-lg shadow p-5 space-y-4">
        <h2 className="font-semibold text-gray-800">Saisir une transaction</h2>

        {/* Type */}
        <div className="flex flex-wrap gap-2">
          {TX_TYPES.map(t => (
            <button
              key={t.value}
              onClick={() => { setTxType(t.value); reset() }}
              className={`px-3 py-1 rounded text-sm border ${txType === t.value ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-gray-600 border-gray-300 hover:border-slate-500'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Date */}
        <div className="space-y-1">
          <label className="text-xs text-gray-500">Date de la transaction</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          />
        </div>

        {/* Pooler A */}
        <div className="space-y-1">
          <label className="text-xs text-gray-500">
            {txType === 'trade' ? 'Pooler A' : 'Pooler'}
          </label>
          <select
            value={poolerAId}
            onChange={e => { setPoolerAId(e.target.value); reset() }}
            className="w-full border rounded px-2 py-1 text-sm"
          >
            <option value="">— Sélectionner —</option>
            {poolers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {/* Player OUT (swap / trade / retrait) */}
        {txType !== 'ajout' && (
          <div className="space-y-1">
            <RosterSelect
              label={txType === 'trade' ? 'Joueur A envoie (quitte A → va chez B)' : 'Joueur retiré / cédé'}
              roster={rosterA}
              value={playerOutAId}
              onChange={setPlayerOutAId}
            />
          </div>
        )}

        {/* Player IN (swap / trade / ajout) */}
        {txType !== 'retrait' && (
          <div className="space-y-3">
            <PlayerSearch
              label={txType === 'trade' ? 'Joueur A reçoit (vient de B)' : 'Joueur acquis / activé'}
              selected={playerInA}
              onSelect={setPlayerInA}
              onClear={() => setPlayerInA(null)}
            />
            <div className="flex gap-3">
              {(['actif', 'reserviste'] as const).map(t => (
                <label key={t} className="flex items-center gap-1 text-sm cursor-pointer">
                  <input
                    type="radio"
                    checked={playerInAType === t}
                    onChange={() => setPlayerInAType(t)}
                  />
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Côté B — trade seulement */}
        {txType === 'trade' && (
          <div className="border-t pt-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Côté B</p>
            <div className="space-y-1">
              <label className="text-xs text-gray-500">Pooler B</label>
              <select
                value={poolerBId}
                onChange={e => setPoolerBId(e.target.value)}
                className="w-full border rounded px-2 py-1 text-sm"
              >
                <option value="">— Sélectionner —</option>
                {poolers.filter(p => p.id !== poolerAId).map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            {/* Le joueur qui quitte B vers A est le playerInA — affiché en lecture seule */}
            {playerInA && (
              <p className="text-sm text-gray-600">
                Joueur B envoie : <span className="font-medium">{playerInA.name}</span>
                <span className="text-gray-400 text-xs ml-1">(même que Joueur A reçoit)</span>
              </p>
            )}
            {/* Le joueur que B reçoit est playerOutA — affiché en lecture seule */}
            {playerOutAId && (
              <p className="text-sm text-gray-600">
                Joueur B reçoit : <span className="font-medium">
                  {rosterA.find(r => r.playerId === playerOutAId)?.name ?? '—'}
                </span>
                <span className="text-gray-400 text-xs ml-1">(même que Joueur A envoie)</span>
              </p>
            )}
            <div className="flex gap-3">
              <span className="text-xs text-gray-500">Type chez B :</span>
              {(['actif', 'reserviste'] as const).map(t => (
                <label key={t} className="flex items-center gap-1 text-sm cursor-pointer">
                  <input type="radio" checked={playerInBType === t} onChange={() => setPlayerInBType(t)} />
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </label>
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-red-600 text-sm">{error}</p>}
        {success && <p className="text-green-600 text-sm">✓ Transaction enregistrée.</p>}

        <button
          onClick={handleSubmit}
          disabled={!canSubmit || isPending}
          className="w-full bg-slate-800 text-white rounded py-2 text-sm font-medium hover:bg-slate-700 disabled:opacity-40"
        >
          {isPending ? 'Enregistrement...' : 'Enregistrer la transaction'}
        </button>
      </div>

      {/* Journal */}
      <div className="bg-white rounded-lg shadow p-5 space-y-3">
        <h2 className="font-semibold text-gray-800">Journal des transactions</h2>
        {log.length === 0 ? (
          <p className="text-sm text-gray-400">Aucune transaction enregistrée.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b">
                  <th className="pb-1 pr-2">Date</th>
                  <th className="pb-1 pr-2">Action</th>
                  <th className="pb-1 pr-2">Pooler</th>
                  <th className="pb-1">Joueur</th>
                </tr>
              </thead>
              <tbody>
                {log.map((e, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-1 pr-2 text-gray-500 whitespace-nowrap">
                      {e.date.slice(0, 10)}
                    </td>
                    <td className="py-1 pr-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${e.action === 'ajout' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {e.action === 'ajout' ? '+ Ajout' : '− Retrait'}
                      </span>
                    </td>
                    <td className="py-1 pr-2 text-gray-700">{e.poolerName}</td>
                    <td className="py-1 text-gray-800">
                      {e.playerName}
                      <span className="text-gray-400 text-xs ml-1">{e.teamCode}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
