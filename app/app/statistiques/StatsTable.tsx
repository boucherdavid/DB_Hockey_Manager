'use client'

import { useMemo, useState } from 'react'
import type { SkaterStat, GoalieStat } from './page'
import TeamBadge from '@/components/TeamBadge'

type Tab = 'skaters' | 'goalies'

function AvailDot({ available }: { available: boolean }) {
  return (
    <span
      title={available ? 'Disponible' : 'Dans un pool'}
      className={`inline-block w-2 h-2 rounded-full shrink-0 ${available ? 'bg-green-500' : 'bg-slate-300'}`}
    />
  )
}

function formatTOI(seconds: number): string {
  if (!seconds) return '—'
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function normName(s: string) {
  return s.toLowerCase().replace(/-/g, ' ').trim()
}

export default function StatsTable({
  skaters,
  goalies,
  takenNames,
}: {
  skaters: SkaterStat[]
  goalies: GoalieStat[]
  takenNames: string[]
}) {
  const [tab, setTab] = useState<Tab>('skaters')
  const [search, setSearch] = useState('')
  const [selectedTeam, setSelectedTeam] = useState('')
  const [availOnly, setAvailOnly] = useState(false)

  const takenSet = useMemo(() => new Set(takenNames), [takenNames])

  const isAvailable = (firstName: string, lastName: string) =>
    !takenSet.has(normName(`${firstName} ${lastName}`))

  const teamOptions = useMemo(() => {
    const all = [
      ...skaters.map(s => s.teamAbbrev),
      ...goalies.map(g => g.teamAbbrev),
    ].filter(t => !/^\d TM$/.test(t))
    return Array.from(new Set(all.filter(Boolean))).sort((a, b) => a.localeCompare(b, 'fr-CA'))
  }, [skaters, goalies])

  const filteredSkaters = useMemo(() => {
    const q = search.trim().toLowerCase()
    return skaters
      .filter(s => {
        if (availOnly && !isAvailable(s.firstName, s.lastName)) return false
        if (selectedTeam && s.teamAbbrev !== selectedTeam) return false
        if (q) {
          const name = `${s.firstName} ${s.lastName}`.toLowerCase()
          const rev = `${s.lastName} ${s.firstName}`.toLowerCase()
          if (!name.includes(q) && !rev.includes(q) && !s.teamAbbrev.toLowerCase().includes(q)) return false
        }
        return true
      })
      .sort((a, b) => b.points - a.points || b.goals - a.goals || a.lastName.localeCompare(b.lastName))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skaters, search, selectedTeam, availOnly, takenSet])

  const filteredGoalies = useMemo(() => {
    const q = search.trim().toLowerCase()
    return goalies
      .filter(g => {
        if (availOnly && !isAvailable(g.firstName, g.lastName)) return false
        if (selectedTeam && g.teamAbbrev !== selectedTeam) return false
        if (q) {
          const name = `${g.firstName} ${g.lastName}`.toLowerCase()
          const rev = `${g.lastName} ${g.firstName}`.toLowerCase()
          if (!name.includes(q) && !rev.includes(q) && !g.teamAbbrev.toLowerCase().includes(q)) return false
        }
        return true
      })
      .sort((a, b) => b.wins - a.wins || b.shutouts - a.shutouts || a.lastName.localeCompare(b.lastName))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goalies, search, selectedTeam, availOnly, takenSet])

  const tabClass = (t: Tab) =>
    `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
      tab === t ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
    }`

  const hasFilters = search || selectedTeam || availOnly

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Statistiques LNH</h1>
        <span className="text-sm text-gray-500">
          {tab === 'skaters' ? `${filteredSkaters.length} joueurs` : `${filteredGoalies.length} gardiens`}
        </span>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-lg shadow p-4 mb-6 flex flex-wrap gap-3 items-center">
        <div className="flex gap-1">
          <button type="button" className={tabClass('skaters')} onClick={() => setTab('skaters')}>
            Patineurs
          </button>
          <button type="button" className={tabClass('goalies')} onClick={() => setTab('goalies')}>
            Gardiens
          </button>
        </div>
        <input
          type="text"
          placeholder="Nom ou équipe"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
        />
        <select
          value={selectedTeam}
          onChange={e => setSelectedTeam(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Toutes les équipes</option>
          {teamOptions.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setAvailOnly(v => !v)}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
            availOnly
              ? 'border-green-500 bg-green-50 text-green-700 font-medium'
              : 'border-slate-300 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
          Disponibles
        </button>
        {hasFilters && (
          <button
            type="button"
            onClick={() => { setSearch(''); setSelectedTeam(''); setAvailOnly(false) }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            Effacer
          </button>
        )}
      </div>

      {/* Table patineurs */}
      {tab === 'skaters' && (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-8">#</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-5" title="Disponibilité" />
                <th className="text-left px-4 py-3 font-medium text-gray-600">Joueur</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Équipe</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Pos</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">PJ</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Tps/M</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">B</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">A</th>
                <th className="text-right px-4 py-3 font-medium text-gray-800 font-semibold">Pts</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Pts/MJ</th>
              </tr>
            </thead>
            <tbody>
              {filteredSkaters.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-12 text-gray-400">
                    Aucun joueur ne correspond aux filtres.
                  </td>
                </tr>
              ) : (
                filteredSkaters.map((s, i) => {
                  const avail = isAvailable(s.firstName, s.lastName)
                  const ppm = s.gamesPlayed > 0 ? (s.points / s.gamesPlayed).toFixed(2) : '—'
                  return (
                    <tr key={s.id} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2.5 text-gray-400 text-xs">{i + 1}</td>
                      <td className="px-4 py-2.5">
                        <AvailDot available={avail} />
                      </td>
                      <td className="px-4 py-2.5 font-medium text-gray-800">
                        {s.lastName}, {s.firstName}
                      </td>
                      <td className="px-4 py-2.5 text-gray-600">
                        <TeamBadge code={s.teamAbbrev} />
                      </td>
                      <td className="px-4 py-2.5 text-gray-500">{s.position}</td>
                      <td className="px-4 py-2.5 text-right text-gray-500 tabular-nums">{s.gamesPlayed || '—'}</td>
                      <td className="px-4 py-2.5 text-right text-gray-500 tabular-nums">{formatTOI(s.toi)}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700">{s.goals}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700">{s.assists}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-gray-900">{s.points}</td>
                      <td className="px-4 py-2.5 text-right text-gray-500 tabular-nums">{ppm}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Table gardiens */}
      {tab === 'goalies' && (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-8">#</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-5" title="Disponibilité" />
                <th className="text-left px-4 py-3 font-medium text-gray-600">Gardien</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Équipe</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">PJ</th>
                <th className="text-right px-4 py-3 font-medium text-green-700">V</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">D</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">DP</th>
                <th className="text-right px-4 py-3 font-medium text-blue-700">BL</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">%Arr</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Moy</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">B</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">A</th>
              </tr>
            </thead>
            <tbody>
              {filteredGoalies.length === 0 ? (
                <tr>
                  <td colSpan={13} className="text-center py-12 text-gray-400">
                    Aucun gardien ne correspond aux filtres.
                  </td>
                </tr>
              ) : (
                filteredGoalies.map((g, i) => {
                  const avail = isAvailable(g.firstName, g.lastName)
                  return (
                    <tr key={g.id} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2.5 text-gray-400 text-xs">{i + 1}</td>
                      <td className="px-4 py-2.5">
                        <AvailDot available={avail} />
                      </td>
                      <td className="px-4 py-2.5 font-medium text-gray-800">
                        {g.lastName}, {g.firstName}
                      </td>
                      <td className="px-4 py-2.5 text-gray-600">
                        <TeamBadge code={g.teamAbbrev} />
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-500 tabular-nums">{g.gamesStarted || '—'}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-green-700">{g.wins}</td>
                      <td className="px-4 py-2.5 text-right text-gray-600">{g.losses || '—'}</td>
                      <td className="px-4 py-2.5 text-right text-gray-600">{g.otLosses || '—'}</td>
                      <td className="px-4 py-2.5 text-right text-blue-700">{g.shutouts}</td>
                      <td className="px-4 py-2.5 text-right text-gray-600 tabular-nums">
                        {g.savePct ? g.savePct.toFixed(3) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-600 tabular-nums">
                        {g.gaa ? g.gaa.toFixed(2) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-700">{g.goals}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700">{g.assists}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
