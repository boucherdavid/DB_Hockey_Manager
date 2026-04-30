'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { fetchPlayerLanding, type NhlPlayerLanding, type NhlSeasonTotal } from '@/lib/nhl-player'

function formatSeason(s: number): string {
  const str = String(s)
  return `${str.slice(0, 4)}-${str.slice(6)}`
}

function SkaterRow({ s }: { s: NhlSeasonTotal }) {
  const pts = (s.goals ?? 0) + (s.assists ?? 0)
  return (
    <tr className="border-b hover:bg-gray-50 text-sm">
      <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap">{formatSeason(s.season)}</td>
      <td className="px-3 py-1.5 text-gray-400 text-xs truncate max-w-[120px]">{s.teamName?.default}</td>
      <td className="px-3 py-1.5 text-center tabular-nums text-gray-600">{s.gamesPlayed}</td>
      <td className="px-3 py-1.5 text-center tabular-nums text-gray-600">{s.goals ?? 0}</td>
      <td className="px-3 py-1.5 text-center tabular-nums text-gray-600">{s.assists ?? 0}</td>
      <td className="px-3 py-1.5 text-center tabular-nums font-semibold text-blue-600">{pts}</td>
    </tr>
  )
}

function GoalieRow({ s }: { s: NhlSeasonTotal }) {
  const savePct = s.savePct != null ? s.savePct.toFixed(3).replace('0.', '.') : '—'
  const gaa = s.goalsAgainstAvg != null ? s.goalsAgainstAvg.toFixed(2) : '—'
  return (
    <tr className="border-b hover:bg-gray-50 text-sm">
      <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap">{formatSeason(s.season)}</td>
      <td className="px-3 py-1.5 text-gray-400 text-xs truncate max-w-[120px]">{s.teamName?.default}</td>
      <td className="px-3 py-1.5 text-center tabular-nums text-gray-600">{s.gamesPlayed}</td>
      <td className="px-3 py-1.5 text-center tabular-nums text-gray-600">{s.wins ?? '—'}</td>
      <td className="px-3 py-1.5 text-center tabular-nums text-gray-600">{s.shutouts ?? '—'}</td>
      <td className="px-3 py-1.5 text-center tabular-nums text-gray-600">{gaa}</td>
      <td className="px-3 py-1.5 text-center tabular-nums font-semibold text-blue-600">{savePct}</td>
    </tr>
  )
}

export default function PlayerSlideOver() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const nhlIdStr = searchParams.get('joueur')
  const nhlId = nhlIdStr ? parseInt(nhlIdStr, 10) : null

  const [player, setPlayer] = useState<NhlPlayerLanding | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!nhlId) { setPlayer(null); return }
    setLoading(true)
    setPlayer(null)
    fetchPlayerLanding(nhlId).then(data => {
      setPlayer(data)
      setLoading(false)
    })
  }, [nhlId])

  const close = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('joueur')
    const url = params.size > 0 ? `${pathname}?${params.toString()}` : pathname
    router.replace(url, { scroll: false })
  }

  useEffect(() => {
    if (!nhlId) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  if (!nhlId) return null

  const isGoalie = player?.position === 'G'
  const nhlSeasons = (player?.seasonTotals ?? [])
    .filter(s => s.leagueAbbrev === 'NHL' && s.gameTypeId === 2)
    .sort((a, b) => b.season - a.season)
    .slice(0, 8)

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={close} />
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b bg-gray-50 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {loading && (
              <div className="space-y-1.5">
                <div className="h-5 w-36 bg-gray-200 rounded animate-pulse" />
                <div className="h-3.5 w-24 bg-gray-100 rounded animate-pulse" />
              </div>
            )}
            {!loading && player && (
              <div className="min-w-0">
                <p className="font-bold text-gray-900 text-lg leading-tight truncate">
                  {player.firstName.default} {player.lastName.default}
                </p>
                <p className="text-sm text-gray-500">
                  {player.currentTeamAbbrev ?? '—'}
                  {' · '}{player.position}
                  {player.sweaterNumber ? ` · #${player.sweaterNumber}` : ''}
                </p>
              </div>
            )}
            {!loading && !player && (
              <p className="text-gray-400 text-sm">Joueur introuvable</p>
            )}
          </div>
          <button
            onClick={close}
            className="shrink-0 ml-3 text-gray-400 hover:text-gray-600 text-2xl leading-none"
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading && (
            <div className="space-y-2">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          )}

          {!loading && player && nhlSeasons.length > 0 && (
            <>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                Saisons NHL — Saison régulière
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b text-xs text-gray-400 uppercase tracking-wide">
                      <th className="px-3 py-1.5 text-left">Saison</th>
                      <th className="px-3 py-1.5 text-left">Équipe</th>
                      <th className="px-3 py-1.5 text-center">MJ</th>
                      {isGoalie ? (
                        <>
                          <th className="px-3 py-1.5 text-center">V</th>
                          <th className="px-3 py-1.5 text-center">BL</th>
                          <th className="px-3 py-1.5 text-center">MB</th>
                          <th className="px-3 py-1.5 text-center text-blue-500">%A</th>
                        </>
                      ) : (
                        <>
                          <th className="px-3 py-1.5 text-center">B</th>
                          <th className="px-3 py-1.5 text-center">A</th>
                          <th className="px-3 py-1.5 text-center text-blue-500">PTS</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {nhlSeasons.map((s, i) =>
                      isGoalie
                        ? <GoalieRow key={i} s={s} />
                        : <SkaterRow key={i} s={s} />
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {!loading && player && nhlSeasons.length === 0 && (
            <p className="text-gray-400 text-sm">Aucune saison NHL disponible.</p>
          )}

          {!loading && !player && nhlId && (
            <p className="text-gray-400 text-sm">Impossible de charger les données de ce joueur.</p>
          )}
        </div>
      </div>
    </>
  )
}
