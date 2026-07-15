'use client'
import { useState, useEffect, useTransition, useCallback } from 'react'
import {
  getHistRosterAction,
  searchHistPlayersAction,
  submitHistChangeAction,
  getHistLogAction,
  checkHistReactivationDelayAction,
  getHistDraftPicksAction,
  type HistRosterEntry,
  type HistPlayerResult,
  type HistLogEntry,
  type HistTxType,
  type HistPlayerType,
  type HistDraftPick,
  type HistTradePlayer,
} from './historique-actions'

type Pooler = { id: string; name: string }

const TX_TYPES: { value: HistTxType; label: string }[] = [
  { value: 'swap',   label: 'Échange même pooler' },
  { value: 'trade',  label: 'Échange entre poolers' },
  { value: 'ajout',  label: 'Ajout seulement' },
  { value: 'retrait', label: 'Retrait seulement' },
  { value: 'type_change', label: 'Changement de type' },
]

const PLAYER_TYPES = ['actif', 'reserviste', 'recrue'] as const

const TX_TYPE_LABEL: Record<HistTxType, string> = Object.fromEntries(
  TX_TYPES.map(t => [t.value, t.label]),
) as Record<HistTxType, string>

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat('fr-CA', {
    dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Toronto',
  }).format(new Date(iso))
}

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

function TradeSidePicker({
  label,
  roster,
  selected,
  onToggle,
  onTypeChange,
  warnings,
}: {
  label: string
  roster: HistRosterEntry[]
  selected: HistTradePlayer[]
  onToggle: (playerId: number, checked: boolean) => void
  onTypeChange: (playerId: number, type: HistPlayerType) => void
  warnings: Record<number, string | null>
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-gray-500">{label}</label>
      {roster.length === 0 ? (
        <p className="text-xs text-gray-400">Aucun joueur</p>
      ) : (
        <ul className="space-y-1.5 max-h-56 overflow-y-auto border rounded p-2">
          {roster.map(r => {
            const sel = selected.find(s => s.playerId === r.playerId)
            return (
              <li key={r.id}>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!sel}
                    onChange={e => onToggle(r.playerId, e.target.checked)}
                  />
                  {r.name}
                  <span className="text-gray-400 text-xs">({r.teamCode} · {r.playerType})</span>
                </label>
                {sel && (
                  <div className="flex gap-3 pl-6 pt-0.5">
                    {PLAYER_TYPES.map(t => (
                      <label key={t} className="flex items-center gap-1 text-xs cursor-pointer">
                        <input
                          type="radio"
                          checked={sel.type === t}
                          onChange={() => onTypeChange(r.playerId, t)}
                        />
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </label>
                    ))}
                  </div>
                )}
                {sel && warnings[r.playerId] && (
                  <p className="text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded px-2 py-0.5 ml-6 mt-0.5">
                    ⚠ {warnings[r.playerId]}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}
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
  const [playerInAType, setPlayerInAType] = useState<HistPlayerType>('actif')
  const [typeChangeTo, setTypeChangeTo] = useState<HistPlayerType | null>(null)
  const [typeChangeSecondPlayerId, setTypeChangeSecondPlayerId] = useState<number | null>(null)
  const [typeChangeSecondTo, setTypeChangeSecondTo] = useState<HistPlayerType | null>(null)

  // Côté B (trade)
  const [poolerBId, setPoolerBId] = useState('')
  const [rosterB, setRosterB] = useState<HistRosterEntry[]>([])

  // Joueurs échangés (trade seulement) — N contre M
  const [playersAOut, setPlayersAOut] = useState<HistTradePlayer[]>([])
  const [playersBOut, setPlayersBOut] = useState<HistTradePlayer[]>([])

  // Choix de repêchage échangés (trade seulement)
  const [pickAOptions, setPickAOptions] = useState<HistDraftPick[]>([])
  const [pickBOptions, setPickBOptions] = useState<HistDraftPick[]>([])
  const [pickAIds, setPickAIds] = useState<number[]>([])
  const [pickBIds, setPickBIds] = useState<number[]>([])

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [log, setLog] = useState<HistLogEntry[]>(initialLog)
  const [logFilter, setLogFilter] = useState<HistTxType | 'all'>('all')

  // Avertissement (non bloquant) : délai de réactivation
  const [reactivationWarningA, setReactivationWarningA] = useState<string | null>(null)
  const [warningsAOut, setWarningsAOut] = useState<Record<number, string | null>>({})
  const [warningsBOut, setWarningsBOut] = useState<Record<number, string | null>>({})

  const poolerName = poolers.find(p => p.id === poolerAId)?.name ?? ''

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

  // Choix de repêchage disponibles (trade seulement)
  useEffect(() => {
    if (txType !== 'trade' || !poolerAId) { setPickAOptions([]); return }
    getHistDraftPicksAction(poolerAId).then(setPickAOptions)
  }, [txType, poolerAId])

  useEffect(() => {
    if (txType !== 'trade' || !poolerBId) { setPickBOptions([]); return }
    getHistDraftPicksAction(poolerBId).then(setPickBOptions)
  }, [txType, poolerBId])

  // Avertissement délai de réactivation — côté A (joueur ajouté chez poolerA)
  useEffect(() => {
    if (txType === 'retrait' || !poolerAId || !playerInA || !date) { setReactivationWarningA(null); return }
    checkHistReactivationDelayAction(poolerAId, playerInA.id, poolSeasonId, date)
      .then(r => setReactivationWarningA(r.warning))
  }, [poolerAId, playerInA, poolSeasonId, date, txType])

  // Avertissement délai de réactivation — joueurs de A qui vont chez B (trade)
  useEffect(() => {
    if (txType !== 'trade' || !poolerBId || !date || playersAOut.length === 0) { setWarningsAOut({}); return }
    let cancelled = false
    Promise.all(
      playersAOut.map(({ playerId }) =>
        checkHistReactivationDelayAction(poolerBId, playerId, poolSeasonId, date).then(r => [playerId, r.warning] as const)
      )
    ).then(entries => { if (!cancelled) setWarningsAOut(Object.fromEntries(entries)) })
    return () => { cancelled = true }
  }, [txType, poolerBId, playersAOut, poolSeasonId, date])

  // Avertissement délai de réactivation — joueurs de B qui vont chez A (trade)
  useEffect(() => {
    if (txType !== 'trade' || !poolerAId || !date || playersBOut.length === 0) { setWarningsBOut({}); return }
    let cancelled = false
    Promise.all(
      playersBOut.map(({ playerId }) =>
        checkHistReactivationDelayAction(poolerAId, playerId, poolSeasonId, date).then(r => [playerId, r.warning] as const)
      )
    ).then(entries => { if (!cancelled) setWarningsBOut(Object.fromEntries(entries)) })
    return () => { cancelled = true }
  }, [txType, poolerAId, playersBOut, poolSeasonId, date])

  // Vide les champs de sélection joueur (garde pooler + date pour enchaîner rapidement)
  function resetSelections() {
    setPlayerOutAId(null)
    setPlayerInA(null)
    setPlayerInAType('actif')
    setTypeChangeTo(null)
    setTypeChangeSecondPlayerId(null)
    setTypeChangeSecondTo(null)
    setPlayersAOut([])
    setPlayersBOut([])
    setPickAIds([])
    setPickBIds([])
    setError(null)
    setReactivationWarningA(null)
    setWarningsAOut({})
    setWarningsBOut({})
  }

  function toggleAOut(playerId: number, checked: boolean) {
    setPlayersAOut(prev => checked ? [...prev, { playerId, type: 'actif' }] : prev.filter(p => p.playerId !== playerId))
  }
  function setAOutType(playerId: number, type: HistPlayerType) {
    setPlayersAOut(prev => prev.map(p => p.playerId === playerId ? { ...p, type } : p))
  }
  function toggleBOut(playerId: number, checked: boolean) {
    setPlayersBOut(prev => checked ? [...prev, { playerId, type: 'actif' }] : prev.filter(p => p.playerId !== playerId))
  }
  function setBOutType(playerId: number, type: HistPlayerType) {
    setPlayersBOut(prev => prev.map(p => p.playerId === playerId ? { ...p, type } : p))
  }

  // Reset complet déclenché par un changement de contexte (type ou pooler A)
  function reset() {
    resetSelections()
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
        playerOutAId: (txType === 'ajout' || txType === 'trade') ? null : playerOutAId,
        playerInAId: (txType === 'retrait' || txType === 'trade') ? null : (playerInA?.id ?? null),
        playerInAType,
        poolerBId: txType === 'trade' ? poolerBId : null,
        typeChangeTo: txType === 'type_change' ? typeChangeTo : null,
        typeChangeSecondPlayerId: txType === 'type_change' ? typeChangeSecondPlayerId : null,
        typeChangeSecondTo: txType === 'type_change' ? typeChangeSecondTo : null,
        playersAOut: txType === 'trade' ? playersAOut : [],
        playersBOut: txType === 'trade' ? playersBOut : [],
        pickAIds: txType === 'trade' ? pickAIds : [],
        pickBIds: txType === 'trade' ? pickBIds : [],
      })
      if (result.error) {
        setError(result.error)
      } else {
        setSuccess(true)
        resetSelections()
        // Recharger les rosters et le log
        if (poolerAId) getHistRosterAction(poolerAId, poolSeasonId).then(setRosterA)
        if (poolerBId) getHistRosterAction(poolerBId, poolSeasonId).then(setRosterB)
        refreshLog()
      }
    })
  }

  const canSubmit = !!poolerAId && !!date && (
    txType === 'swap'        ? (!!playerOutAId && !!playerInA) :
    txType === 'trade'       ? (!!poolerBId && (
                                 playersAOut.length > 0 || playersBOut.length > 0 ||
                                 pickAIds.length > 0 || pickBIds.length > 0
                               )) :
    txType === 'ajout'       ? !!playerInA :
    txType === 'retrait'     ? !!playerOutAId :
    txType === 'type_change' ? !!playerOutAId && !!typeChangeTo && (!typeChangeSecondPlayerId || !!typeChangeSecondTo) : false
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

        {/* Player OUT (swap / retrait / type_change) */}
        {txType !== 'ajout' && txType !== 'trade' && (
          <div className="space-y-1">
            <RosterSelect
              label={txType === 'type_change' ? 'Joueur 1' : 'Joueur retiré / cédé'}
              roster={rosterA}
              value={playerOutAId}
              onChange={setPlayerOutAId}
            />
          </div>
        )}

        {/* Nouveau type (type_change seulement) — le(s) joueur(s) restent dans le pool */}
        {txType === 'type_change' && (
          <div className="space-y-4 border rounded p-3 bg-gray-50">
            <div className="space-y-1">
              <label className="text-xs text-gray-500">Nouveau type — Joueur 1</label>
              <div className="flex gap-3">
                {PLAYER_TYPES.map(t => (
                  <label key={t} className="flex items-center gap-1 text-sm cursor-pointer">
                    <input
                      type="radio"
                      checked={typeChangeTo === t}
                      onChange={() => setTypeChangeTo(t)}
                    />
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </label>
                ))}
              </div>
            </div>

            <div className="border-t pt-3 space-y-1">
              <RosterSelect
                label="Joueur 2 (optionnel — pour un échange actif/réserve/recrue en une seule transaction)"
                roster={rosterA.filter(r => r.playerId !== playerOutAId)}
                value={typeChangeSecondPlayerId}
                onChange={setTypeChangeSecondPlayerId}
              />
              {typeChangeSecondPlayerId && (
                <div className="flex gap-3 pt-1">
                  {PLAYER_TYPES.map(t => (
                    <label key={t} className="flex items-center gap-1 text-sm cursor-pointer">
                      <input
                        type="radio"
                        checked={typeChangeSecondTo === t}
                        onChange={() => setTypeChangeSecondTo(t)}
                      />
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Player IN (swap / ajout) */}
        {txType !== 'retrait' && txType !== 'type_change' && txType !== 'trade' && (
          <div className="space-y-3">
            <PlayerSearch
              label="Joueur acquis / activé"
              selected={playerInA}
              onSelect={setPlayerInA}
              onClear={() => setPlayerInA(null)}
            />
            <div className="flex gap-3">
              {PLAYER_TYPES.map(t => (
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
            <p className="text-xs text-gray-400">
              Recrue : le joueur va directement dans la banque de recrues (ex. encore sous contrat ELC).
            </p>
            {reactivationWarningA && (
              <p className="text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded px-2 py-1">
                ⚠ {reactivationWarningA}
              </p>
            )}
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

            <TradeSidePicker
              label="Joueurs que A envoie (quittent A → vont chez B)"
              roster={rosterA}
              selected={playersAOut}
              onToggle={toggleAOut}
              onTypeChange={setAOutType}
              warnings={warningsAOut}
            />

            <TradeSidePicker
              label="Joueurs que B envoie (quittent B → vont chez A)"
              roster={rosterB}
              selected={playersBOut}
              onToggle={toggleBOut}
              onTypeChange={setBOutType}
              warnings={warningsBOut}
            />

            {/* Choix de repêchage échangés */}
            {(pickAOptions.length > 0 || pickBOptions.length > 0) && (
              <div className="border-t pt-3 space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Choix de repêchage échangés (optionnel)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-gray-500">Picks de A → B</label>
                    {pickAOptions.length === 0 ? (
                      <p className="text-xs text-gray-400">Aucun pick disponible</p>
                    ) : (
                      <ul className="space-y-1">
                        {pickAOptions.map(p => (
                          <li key={p.id}>
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                              <input
                                type="checkbox"
                                checked={pickAIds.includes(p.id)}
                                onChange={e => setPickAIds(ids => e.target.checked ? [...ids, p.id] : ids.filter(i => i !== p.id))}
                              />
                              {p.season} — Ronde {p.round}
                              {p.originalOwnerName && <span className="text-gray-400 text-xs"> ({p.originalOwnerName})</span>}
                            </label>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-gray-500">Picks de B → A</label>
                    {pickBOptions.length === 0 ? (
                      <p className="text-xs text-gray-400">Aucun pick disponible</p>
                    ) : (
                      <ul className="space-y-1">
                        {pickBOptions.map(p => (
                          <li key={p.id}>
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                              <input
                                type="checkbox"
                                checked={pickBIds.includes(p.id)}
                                onChange={e => setPickBIds(ids => e.target.checked ? [...ids, p.id] : ids.filter(i => i !== p.id))}
                              />
                              {p.season} — Ronde {p.round}
                              {p.originalOwnerName && <span className="text-gray-400 text-xs"> ({p.originalOwnerName})</span>}
                            </label>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {error && <p className="text-red-600 text-sm">{error}</p>}
        {success && (
          <p className="text-green-700 text-sm bg-green-50 border border-green-200 rounded px-3 py-2">
            ✓ Transaction enregistrée — prêt pour la suivante ({poolerName || '—'}, {date}).
          </p>
        )}

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
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-semibold text-gray-800">Journal des transactions</h2>
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setLogFilter('all')}
              className={`px-2 py-0.5 rounded text-xs border ${logFilter === 'all' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-gray-600 border-gray-300 hover:border-slate-500'}`}
            >
              Tous
            </button>
            {TX_TYPES.map(t => (
              <button
                key={t.value}
                onClick={() => setLogFilter(t.value)}
                className={`px-2 py-0.5 rounded text-xs border ${logFilter === t.value ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-gray-600 border-gray-300 hover:border-slate-500'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        {(() => {
          const filtered = logFilter === 'all' ? log : log.filter(e => e.txType === logFilter)
          if (filtered.length === 0) {
            return <p className="text-sm text-gray-400">Aucune transaction enregistrée.</p>
          }
          return (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b">
                    <th className="pb-1 pr-2">Date effective</th>
                    <th className="pb-1 pr-2">Saisi le</th>
                    <th className="pb-1 pr-2">Type</th>
                    <th className="pb-1 pr-2">Pooler</th>
                    <th className="pb-1">Joueur</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="py-1 pr-2 text-gray-500 whitespace-nowrap">
                        {e.effectiveDate.slice(0, 10)}
                      </td>
                      <td className="py-1 pr-2 text-gray-400 whitespace-nowrap">
                        {formatDateTime(e.loggedAt)}
                      </td>
                      <td className="py-1 pr-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${e.newType ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {TX_TYPE_LABEL[e.txType] ?? e.txType}
                        </span>
                      </td>
                      <td className="py-1 pr-2 text-gray-700">{e.poolerName}</td>
                      <td className="py-1 text-gray-800">
                        {e.playerName}
                        <span className="text-gray-400 text-xs ml-1">{e.teamCode}</span>
                        {e.reactivationWarning && (
                          <span
                            className="ml-1 text-orange-600 cursor-help"
                            title={e.reactivationWarning}
                          >
                            ⚠
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        })()}
      </div>
    </div>
  )
}
