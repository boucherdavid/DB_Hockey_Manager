'use client'

import { useMemo, useState } from 'react'
import { submitDraftAction, rollbackPickAction } from './actions'

const DASH = '\u2014'

type Pooler = { id: string; name: string }
type Pick = {
  id: number
  round: number
  draft_order: number | null
  current_owner: Pooler
  original_owner: Pooler
}
type Rookie = {
  id: number
  first_name: string
  last_name: string
  position: string | null
  teams: { code: string } | null
  draft_year: number | null
  draft_round: number | null
  draft_overall: number | null
  status: string | null
}

export default function DraftBoard({
  picks,
  usedPicks,
  rookies,
  bankByPooler,
  saisonId,
  poolDraftYear,
}: {
  picks: Pick[]
  usedPicks: Pick[]
  rookies: Rookie[]
  bankByPooler: Record<string, any[]>
  saisonId: number
  poolDraftYear: number
}) {
  const [selections, setSelections] = useState<Record<number, number | null>>(() =>
    Object.fromEntries(picks.map(p => [p.id, null]))
  )
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')
  const [submittedPickIds, setSubmittedPickIds] = useState<Set<number>>(new Set())
  const [rollingBack, setRollingBack] = useState<number | null>(null)
  const [rolledBackPickIds, setRolledBackPickIds] = useState<Set<number>>(new Set())

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage(text)
    setMessageType(type)
    setTimeout(() => setMessage(''), 5000)
  }

  const handleRollback = async (pickId: number) => {
    if (!window.confirm('Annuler ce choix ? La recrue sera retirée de la banque et le pick redeviendra disponible.')) return
    setRollingBack(pickId)
    const result = await rollbackPickAction(pickId)
    if (result.error) {
      showMessage(result.error, 'error')
    } else {
      setRolledBackPickIds(prev => new Set([...prev, pickId]))
      showMessage('Choix annulé.', 'success')
    }
    setRollingBack(null)
  }

  const allPicks = useMemo(() => [...picks, ...usedPicks], [picks, usedPicks])

  const sortByOrder = (a: Pick, b: Pick) => {
    const oa = a.draft_order ?? 999
    const ob = b.draft_order ?? 999
    return oa - ob
  }

  const rounds = useMemo(() => {
    const roundNums = Array.from(new Set(allPicks.map(p => p.round))).sort((a, b) => a - b)
    return roundNums.map(r => ({
      round: r,
      pending: picks.filter(p => p.round === r).sort(sortByOrder),
      used: usedPicks.filter(p => p.round === r).sort(sortByOrder),
    }))
  }, [allPicks, picks, usedPicks])

  const selectedPlayerIds = useMemo(() =>
    new Set(Object.values(selections).filter((id): id is number => id !== null)),
  [selections])

  const pendingSelections = useMemo(() =>
    Object.entries(selections)
      .filter(([pickId, playerId]) => playerId !== null && !submittedPickIds.has(Number(pickId)))
      .map(([pickId, playerId]) => ({ pick_id: Number(pickId), player_id: playerId as number })),
  [selections, submittedPickIds])

  const handleSubmit = async () => {
    if (pendingSelections.length === 0) {
      showMessage('Aucun choix rempli.', 'error')
      return
    }
    setSubmitting(true)
    const result = await submitDraftAction(saisonId, poolDraftYear, pendingSelections)
    if (result.error) {
      showMessage(result.error, 'error')
    } else {
      const submitted = new Set([...submittedPickIds, ...pendingSelections.map(s => s.pick_id)])
      setSubmittedPickIds(submitted)
      showMessage(`${pendingSelections.length} choix soumis avec succès.`, 'success')
    }
    setSubmitting(false)
  }

  const totalPicks = picks.length + usedPicks.length
  const doneCount = usedPicks.length + submittedPickIds.size

  return (
    <div className="space-y-6">
      {/* Barre de progression */}
      <div className="bg-white rounded-lg shadow px-5 py-4 flex items-center gap-6">
        <div className="flex-1">
          <div className="flex justify-between text-sm mb-1">
            <span className="font-medium text-gray-700">Progression du repêchage {poolDraftYear}</span>
            <span className="text-gray-500">{doneCount} / {totalPicks} choix effectués</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className="h-2 rounded-full bg-green-500 transition-all"
              style={{ width: totalPicks > 0 ? `${(doneCount / totalPicks) * 100}%` : '0%' }}
            />
          </div>
        </div>
      </div>

      {rounds.map(({ round, pending, used }) => {
        const activePending = pending.filter(p => !submittedPickIds.has(p.id))
        const justSubmitted = pending.filter(p => submittedPickIds.has(p.id))
        const allUsed = [...used, ...justSubmitted]

        return (
          <div key={round} className="bg-white rounded-lg shadow overflow-hidden">
            <div className="bg-slate-700 px-5 py-3 flex items-center justify-between">
              <h2 className="text-white font-semibold">Ronde {round}</h2>
              <span className="text-slate-300 text-xs">
                {allUsed.length} / {pending.length + used.length} effectués
              </span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b text-left">
                  <th className="px-4 py-2 font-medium text-gray-600 w-8 text-center">#</th>
                  <th className="px-4 py-2 font-medium text-gray-600 w-48">Pooler</th>
                  <th className="px-4 py-2 font-medium text-gray-600 w-44">Choix d'origine</th>
                  <th className="px-4 py-2 font-medium text-gray-600">Recrue sélectionnée</th>
                </tr>
              </thead>
              <tbody>
                {/* Picks déjà soumis en lecture seule */}
                {allUsed.map(pick => {
                  const isOwn = pick.current_owner.id === pick.original_owner.id
                  const bankPlayers: any[] = bankByPooler[pick.current_owner.id] ?? []
                  // Trouver le joueur de la bonne ronde (draft_round correspond à la ronde du pool)
                  const chosen = bankPlayers.find((p: any) => p.draft_round === round) ?? bankPlayers[0]
                  return (
                    <tr key={pick.id} className="border-b last:border-0 bg-green-50">
                      <td className="px-4 py-3 text-center text-xs text-gray-400">{pick.draft_order ?? DASH}</td>
                      <td className="px-4 py-3 font-medium text-gray-700">{pick.current_owner.name}</td>
                      <td className="px-4 py-3">
                        {isOwn
                          ? <span className="text-xs text-gray-400">Propre</span>
                          : <span className="text-xs text-amber-600">De: {pick.original_owner.name}</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        <span className="flex items-center gap-2">
                          <span className="text-green-600 font-bold text-xs">✓</span>
                          {chosen
                            ? <>
                                {chosen.last_name}, {chosen.first_name}
                                <span className="text-gray-400 text-xs">{chosen.position} {chosen.teams?.code ?? ''}</span>
                              </>
                            : <span className="text-gray-400 text-xs">Soumis</span>
                          }
                          {!rolledBackPickIds.has(pick.id) && (
                            <button
                              onClick={() => handleRollback(pick.id)}
                              disabled={rollingBack === pick.id}
                              className="ml-2 text-xs text-red-400 hover:text-red-600 disabled:opacity-40"
                              title="Annuler ce choix"
                            >
                              {rollingBack === pick.id ? '...' : 'Annuler'}
                            </button>
                          )}
                        </span>
                      </td>
                    </tr>
                  )
                })}

                {/* Picks en attente */}
                {activePending.map(pick => {
                  const isOwn = pick.current_owner.id === pick.original_owner.id
                  const selectedId = selections[pick.id] ?? null

                  return (
                    <tr key={pick.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3 text-center text-xs text-gray-400">{pick.draft_order ?? DASH}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">{pick.current_owner.name}</td>
                      <td className="px-4 py-3">
                        {isOwn
                          ? <span className="text-xs text-gray-400">Propre</span>
                          : <span className="text-xs text-amber-600">De: {pick.original_owner.name}</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={selectedId ?? ''}
                          onChange={e => setSelections(prev => ({
                            ...prev,
                            [pick.id]: e.target.value ? Number(e.target.value) : null,
                          }))}
                          className="w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">— Choisir une recrue —</option>
                          {rookies.map(r => {
                            const alreadyPicked = selectedPlayerIds.has(r.id) && selections[pick.id] !== r.id
                            const draftInfo = `R${r.draft_round ?? '?'} #${r.draft_overall ?? '?'}`
                            return (
                              <option key={r.id} value={r.id} disabled={alreadyPicked}>
                                {r.last_name}, {r.first_name} {r.position ?? ''} {r.teams?.code ?? DASH} — {draftInfo}
                                {alreadyPicked ? ' (déjà choisi)' : ''}
                              </option>
                            )
                          })}
                        </select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      })}

      {/* Barre de soumission */}
      <div className="flex items-center justify-between bg-white rounded-lg shadow px-5 py-4">
        <div className="text-sm text-gray-500">
          {picks.filter(p => !submittedPickIds.has(p.id)).length > 0
            ? `${pendingSelections.length} / ${picks.filter(p => !submittedPickIds.has(p.id)).length} choix restants remplis`
            : <span className="text-green-600 font-medium">Tous les choix ont été soumis ✓</span>
          }
        </div>
        <div className="flex items-center gap-4">
          {message && (
            <span className={`text-sm font-medium ${messageType === 'error' ? 'text-red-600' : 'text-green-600'}`}>
              {message}
            </span>
          )}
          {picks.filter(p => !submittedPickIds.has(p.id)).length > 0 && (
            <button
              onClick={handleSubmit}
              disabled={submitting || pendingSelections.length === 0}
              className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? 'Soumission...' : `Soumettre${pendingSelections.length > 0 ? ` (${pendingSelections.length})` : ''}`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
