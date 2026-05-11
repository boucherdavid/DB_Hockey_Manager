'use client'

import { useState, useTransition } from 'react'
import { recalcPostDeadlineSnapshotsAction, recalcMissingBaselinesAction } from '@/app/gestion-series/playoff-pool-actions'
import type { PlayoffChangeLogEntry } from '@/app/gestion-series/playoff-pool-actions'

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('fr-CA', {
    day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  })

export default function ChangeLogPanel({
  poolSeasonId,
  log,
}: {
  poolSeasonId: number
  log: PlayoffChangeLogEntry[]
}) {
  const [recalcResult, setRecalcResult] = useState<string | null>(null)
  const [baselineResult, setBaselineResult] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isBaselinePending, startBaselineTransition] = useTransition()

  function handleRecalc() {
    startTransition(async () => {
      const result = await recalcPostDeadlineSnapshotsAction(poolSeasonId)
      if (result.error) setRecalcResult(`Erreur : ${result.error}`)
      else setRecalcResult(`✓ ${result.fixed} snapshot${result.fixed > 1 ? 's' : ''} recalculé${result.fixed > 1 ? 's' : ''}.`)
    })
  }

  function handleRecalcBaselines() {
    startBaselineTransition(async () => {
      const result = await recalcMissingBaselinesAction(poolSeasonId)
      if (result.error) setBaselineResult(`Erreur : ${result.error}`)
      else setBaselineResult(result.fixed > 0
        ? `✓ ${result.fixed} baseline${result.fixed > 1 ? 's' : ''} ajoutée${result.fixed > 1 ? 's' : ''}.`
        : '✓ Aucune baseline manquante.')
      setTimeout(() => setBaselineResult(null), 5000)
    })
  }

  return (
    <div className="bg-white rounded-lg shadow p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Changements post-deadline
        </h2>
        <div className="flex items-center gap-3 flex-wrap">
          {(recalcResult || baselineResult) && (
            <span className={`text-xs ${(recalcResult ?? baselineResult)!.startsWith('✓') ? 'text-green-600' : 'text-red-600'}`}>
              {recalcResult ?? baselineResult}
            </span>
          )}
          <button
            onClick={handleRecalcBaselines}
            disabled={isBaselinePending}
            className="text-xs bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-300 rounded px-3 py-1.5 font-medium disabled:opacity-50 transition-colors"
            title="Crée les baselines deadline manquantes pour les joueurs retirés avant la première visite du classement"
          >
            {isBaselinePending ? 'Calcul...' : '↺ Baselines manquantes'}
          </button>
          <button
            onClick={handleRecalc}
            disabled={isPending}
            className="text-xs bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-300 rounded px-3 py-1.5 font-medium disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Recalcul...' : '↺ Recalculer snapshots'}
          </button>
        </div>
      </div>

      {log.length === 0 ? (
        <p className="text-sm text-gray-400">Aucun changement post-deadline enregistré.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-400 uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2 text-left">Pooler</th>
                <th className="px-3 py-2 text-left">Action</th>
                <th className="px-3 py-2 text-left">Joueur</th>
                <th className="px-3 py-2 text-left">Équipe</th>
                <th className="px-3 py-2 text-left">Pos.</th>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-left">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {log.map((entry, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium text-gray-800">{entry.poolerName}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded ${
                      entry.action === 'ajout' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {entry.action === 'ajout' ? '+ Ajout' : '− Retrait'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-700">{entry.playerName}</td>
                  <td className="px-3 py-2 text-gray-500">{entry.teamCode ?? '—'}</td>
                  <td className="px-3 py-2 text-gray-500">{entry.positionSlot ?? '—'}</td>
                  <td className="px-3 py-2">
                    {entry.removalReason === 'elimination' && (
                      <span className="text-xs text-red-600 font-medium">Élim.</span>
                    )}
                    {entry.removalReason === 'voluntary' && (
                      <span className="text-xs text-orange-600 font-medium">Volont.</span>
                    )}
                    {!entry.removalReason && entry.action === 'ajout' && (
                      <span className="text-xs text-blue-600 font-medium">Ajout</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-400">{fmtDate(entry.changedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
