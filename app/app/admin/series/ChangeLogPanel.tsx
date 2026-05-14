'use client'

import { useState, useTransition } from 'react'
import { recalcMissingBaselinesAction, recalcPostDeadlineSnapshotsAction, recalcDeactivationSnapshotsAction } from '@/app/gestion-series/playoff-pool-actions'
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
  const [result, setResult] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleFixBaselines() {
    startTransition(async () => {
      const [r1, r2, r3] = await Promise.all([
        recalcMissingBaselinesAction(poolSeasonId),
        recalcPostDeadlineSnapshotsAction(poolSeasonId),
        recalcDeactivationSnapshotsAction(poolSeasonId),
      ])
      const error = r1.error ?? r2.error ?? r3.error
      if (error) { setResult(`Erreur : ${error}`); return }
      const total = (r1.fixed ?? 0) + (r2.fixed ?? 0) + (r3.fixed ?? 0)
      setResult(total > 0
        ? `✓ ${total} correction${total > 1 ? 's' : ''} effectuée${total > 1 ? 's' : ''}.`
        : '✓ Aucune correction nécessaire.')
      setTimeout(() => setResult(null), 6000)
    })
  }

  return (
    <div className="bg-white rounded-lg shadow p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Changements post-deadline
        </h2>
        <div className="flex items-center gap-3">
          {result && (
            <span className={`text-xs ${result.startsWith('✓') ? 'text-green-600' : 'text-red-600'}`}>
              {result}
            </span>
          )}
          <button
            onClick={handleFixBaselines}
            disabled={isPending}
            className="text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded px-3 py-1.5 font-medium disabled:opacity-50 transition-colors"
            title="Corrige les retraits post-deadline mal enregistrés et crée les baselines manquantes"
          >
            {isPending ? 'Correction...' : '↺ Corriger données'}
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
