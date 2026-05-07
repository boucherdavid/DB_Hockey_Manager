import {
  getPlayoffPoolSaisonAction,
  getPlayoffPoolStandingsAction,
} from '@/app/gestion-series/playoff-pool-actions'
import { fetchStreaks } from '@/lib/streaks'
import ClassementSeriesTable from './ClassementSeriesTable'
import type { StreakInfo } from '@/lib/streaks'

export const metadata = { title: 'Classement — Pool des séries' }
export const dynamic = 'force-dynamic'

export default async function ClassementSeriesPage() {
  const saison = await getPlayoffPoolSaisonAction()

  if (!saison) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Classement — Pool des séries</h1>
        <p className="text-gray-500">Aucune saison de séries active.</p>
      </div>
    )
  }

  const standings = await getPlayoffPoolStandingsAction(saison.id, true)

  // Streaks — fetch des game logs séries pour les joueurs actifs (fire-and-forget avec timeout)
  let streaks: Record<number, StreakInfo> = {}
  if (standings.length > 0) {
    const activePlayers = standings
      .flatMap(s => s.players)
      .filter(p => p.isActive && p.nhlId !== null)
    const unique = new Map<number, boolean>()
    for (const p of activePlayers) {
      if (p.nhlId && !unique.has(p.nhlId)) unique.set(p.nhlId, p.positionSlot === 'G')
    }
    const players = [...unique.entries()].map(([nhlId, isGoalie]) => ({ nhlId, isGoalie }))
    try {
      const map = await Promise.race([
        fetchStreaks(players, 3, undefined, 5),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 6000)),
      ])
      for (const [nhlId, info] of map) streaks[nhlId] = info
    } catch {
      // Timeout ou erreur NHL API — classement s'affiche quand même sans indicateurs
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Classement — Pool des séries {saison.season}</h1>
        <p className="text-xs text-gray-400 mt-1">Stats en direct — séries éliminatoires LNH</p>
      </div>

      {standings.length === 0 ? (
        <p className="text-gray-500 text-sm">
          Aucun alignement complet soumis pour l&apos;instant.
        </p>
      ) : (
        <ClassementSeriesTable standings={standings} streaks={streaks} />
      )}
    </div>
  )
}
