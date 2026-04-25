'use client'

import { useState } from 'react'
import { seasonEndSyncAction } from './actions'

export default function SeasonEndSync({ seasonId, season }: { seasonId: number; season: string }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<{ count?: number; errors?: string[]; error?: string } | null>(null)

  async function handleSync() {
    if (!confirm(`Confirmer la sync fin de saison ${season} ?\n\nCette action prend un snapshot final pour tous les joueurs actifs. Elle peut être répétée sans danger.`)) return
    setStatus('loading')
    const res = await seasonEndSyncAction(seasonId)
    setResult(res)
    setStatus(res.error ? 'error' : 'done')
  }

  return (
    <div className="bg-white rounded-lg shadow p-5 space-y-3">
      <div>
        <h3 className="font-semibold text-gray-800 mb-1">Sync fin de saison</h3>
        <p className="text-sm text-gray-500">
          Prend un snapshot <span className="font-mono text-xs bg-gray-100 px-1 rounded">season_end</span> pour
          tous les joueurs actifs de la saison {season}. À exécuter une fois la saison régulière terminée,
          avant de démarrer la transition vers la nouvelle saison.
        </p>
      </div>

      <button
        onClick={handleSync}
        disabled={status === 'loading'}
        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {status === 'loading' ? 'Synchronisation…' : 'Lancer la sync fin de saison'}
      </button>

      {status === 'done' && result && (
        <div className="rounded bg-green-50 border border-green-200 px-4 py-3 text-sm">
          <p className="text-green-700 font-medium">
            ✓ {result.count} snapshot{(result.count ?? 0) > 1 ? 's' : ''} enregistré{(result.count ?? 0) > 1 ? 's' : ''}.
          </p>
          {result.errors && result.errors.length > 0 && (
            <details className="mt-2">
              <summary className="text-orange-600 cursor-pointer">{result.errors.length} erreur(s)</summary>
              <ul className="mt-1 space-y-1 text-orange-600 text-xs">
                {result.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </details>
          )}
        </div>
      )}

      {status === 'error' && result?.error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-2">
          {result.error}
        </p>
      )}
    </div>
  )
}
