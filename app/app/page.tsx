import { createClient } from '@/lib/supabase/server'
import { buildStandings } from '@/lib/standings'
import SummaryTable from '@/components/SummaryTable'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

type TodayGame = {
  id: number
  awayAbbrev: string
  homeAbbrev: string
  startTimeUTC: string
  gameState: string
}

async function fetchTodayGames(): Promise<{ date: string; games: TodayGame[] }> {
  try {
    const res = await fetch('https://api-web.nhle.com/v1/schedule/now', { next: { revalidate: 300 } })
    if (!res.ok) return { date: '', games: [] }
    const data = await res.json()
    const todayET = new Intl.DateTimeFormat('fr-CA', {
      timeZone: 'America/Toronto',
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date())
    const entry = (data.gameWeek ?? []).find((d: { date: string }) => d.date === todayET)
      ?? data.gameWeek?.[0]
    if (!entry) return { date: '', games: [] }
    return {
      date: entry.date as string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      games: (entry.games ?? []).map((g: any) => ({
        id: g.id,
        awayAbbrev: g.awayTeam?.abbrev ?? '',
        homeAbbrev: g.homeTeam?.abbrev ?? '',
        startTimeUTC: g.startTimeUTC ?? '',
        gameState: g.gameState ?? 'FUT',
      })),
    }
  } catch {
    return { date: '', games: [] }
  }
}

function fmtGameTime(utcStr: string): string {
  if (!utcStr) return ''
  try {
    return new Intl.DateTimeFormat('fr-CA', {
      timeZone: 'America/Toronto',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(new Date(utcStr)).replace(':', 'h') + ' ET'
  } catch { return '' }
}

function fmtDateFr(isoDate: string): string {
  if (!isoDate) return ''
  try {
    return new Intl.DateTimeFormat('fr-CA', {
      timeZone: 'America/Toronto',
      weekday: 'long', day: 'numeric', month: 'long',
    }).format(new Date(isoDate + 'T12:00:00'))
  } catch { return isoDate }
}

const GAME_STATE_LABEL: Record<string, string> = {
  LIVE: 'En cours',
  CRIT: 'En cours',
  FINAL: 'Terminé',
  OFF: 'Terminé',
}

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: saison }, { data: me }] = await Promise.all([
    supabase.from('pool_seasons').select('id, season, pool_cap').eq('is_active', true).single(),
    user
      ? supabase.from('poolers').select('id, name').eq('id', user.id).single()
      : Promise.resolve({ data: null }),
  ])

  const [standings, { date: todayDate, games: todayGames }] = await Promise.all([
    saison ? buildStandings(supabase, saison.id) : Promise.resolve([]),
    fetchTodayGames(),
  ])

  const playingTeams = new Set(todayGames.flatMap(g => [g.awayAbbrev, g.homeAbbrev]))

  const myStanding = me?.id ? standings.find(s => s.poolerId === me.id) : null
  const myPlayersToday = myStanding
    ? myStanding.players.filter(p => p.playerType === 'actif' && playingTeams.has(p.teamAbbrev))
    : []

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">

      {/* En-tête */}
      <div>
        <h1 className="text-3xl font-bold text-gray-800">
          {me?.name ? <>Bienvenue {me.name} sur DB Hockey Manager</> : 'DB Hockey Manager'}
        </h1>
        {saison && (
          <p className="text-gray-500 mt-1">
            Saison {saison.season} &middot; Cap pool :{' '}
            <span className="font-semibold text-blue-700">
              {new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(saison.pool_cap)}
            </span>
          </p>
        )}
      </div>

      {/* Classement + matchs côte à côte sur desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Classement (2/3 de largeur) */}
        <div className="lg:col-span-2 space-y-2">
          {standings.length > 0 ? (
            <>
              <SummaryTable standings={standings} />
              <div className="text-right">
                <Link href="/classement" className="text-sm text-blue-600 hover:underline">
                  Classement détaillé →
                </Link>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-lg shadow p-6 text-gray-400 text-sm">
              Aucune donnée de classement disponible.
            </div>
          )}
        </div>

        {/* Matchs du jour (1/3 de largeur) */}
        <div className="space-y-2">
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="bg-slate-700 px-5 py-3">
              <h2 className="text-white font-bold text-sm uppercase tracking-wide">
                {todayDate ? `Matchs — ${fmtDateFr(todayDate)}` : 'Matchs du jour'}
              </h2>
            </div>

            {todayGames.length === 0 ? (
              <p className="px-5 py-4 text-sm text-gray-400">Aucun match aujourd&apos;hui.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {todayGames.map(g => {
                  const stateLabel = GAME_STATE_LABEL[g.gameState]
                  const myTeams = [g.awayAbbrev, g.homeAbbrev].filter(t => playingTeams.has(t) && myStanding?.players.some(p => p.teamAbbrev === t && p.playerType === 'actif'))
                  return (
                    <li key={g.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-gray-800">
                        {g.awayAbbrev} <span className="text-gray-400 font-normal">@</span> {g.homeAbbrev}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        {myTeams.length > 0 && (
                          <span className="text-xs bg-blue-100 text-blue-700 rounded px-1.5 py-0.5 font-medium">
                            {myTeams.length === 1 ? myTeams[0] : '2 éq.'}
                          </span>
                        )}
                        <span className={`text-xs ${stateLabel ? 'text-green-600 font-medium' : 'text-gray-400'}`}>
                          {stateLabel ?? fmtGameTime(g.startTimeUTC)}
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* Résumé joueurs actifs aujourd'hui */}
          {myStanding && (
            <div className={`rounded-lg px-4 py-3 text-sm ${myPlayersToday.length > 0 ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50 border border-gray-200'}`}>
              {myPlayersToday.length > 0 ? (
                <>
                  <p className="font-semibold text-blue-800">
                    {myPlayersToday.length} joueur{myPlayersToday.length > 1 ? 's' : ''} en action aujourd&apos;hui
                  </p>
                  <p className="text-blue-600 text-xs mt-0.5">
                    {myPlayersToday.map(p => p.lastName).join(', ')}
                  </p>
                </>
              ) : (
                <p className="text-gray-500">Aucun de tes joueurs actifs ne joue aujourd&apos;hui.</p>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
