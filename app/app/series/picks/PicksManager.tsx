'use client'

import { useState, useMemo } from 'react'
import { savePicksAction, type PickInput } from '@/app/series/actions'
import { fmtPts } from '@/lib/nhl-stats'

const ROUND_LABEL = ['Quart de finale', 'Demi-finale', 'Finale de conférence', 'Finale de la Coupe Stanley']

type Player = {
  id: number
  first_name: string
  last_name: string
  position: string
  cap_number: number
  team_abbrev: string
}

type ActivePick = {
  playerId: number
  firstName: string
  lastName: string
  position: string
  cap_number: number
  snap_goals: number
  snap_assists: number
  snap_goalie_wins: number
  snap_goalie_otl: number
  snap_goalie_shutouts: number
}

function isForward(pos: string) { return !['D', 'LD', 'RD', 'G'].includes(pos) }
function isDefense(pos: string) { return ['D', 'LD', 'RD'].includes(pos) }
function isGoalie(pos: string)  { return pos === 'G' }

function posGroup(pos: string): 'F' | 'D' | 'G' {
  if (isGoalie(pos)) return 'G'
  if (isDefense(pos)) return 'D'
  return 'F'
}

const GROUP_NEEDS = { F: 3, D: 2, G: 1 }
const GROUP_LABEL = { F: 'Attaquants (3)', D: 'Défenseurs (2)', G: 'Gardien (1)' }

export default function PicksManager({
  playoffSeasonId,
  currentRound,
  capPerRound,
  players,
  currentPicks,
}: {
  playoffSeasonId: number
  currentRound: number
  capPerRound: number
  players: Player[]
  currentPicks: ActivePick[]
}) {
  const [roster, setRoster] = useState<ActivePick[]>(currentPicks)
  const [search, setSearch] = useState('')
  const [posFilter, setPosFilter] = useState<'F' | 'D' | 'G' | ''>('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [editMode, setEditMode] = useState(currentPicks.length === 0)

  const pickedIds = new Set(roster.map(p => p.playerId))

  const totalCap = roster.reduce((s, p) => s + (p.cap_number ?? 0), 0)
  const capOk = totalCap <= capPerRound

  // Counts par groupe
  const counts = { F: 0, D: 0, G: 0 }
  for (const p of roster) counts[posGroup(p.position)]++
  const rosterOk = counts.F === 3 && counts.D === 2 && counts.G === 1

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return players.filter(p => {
      if (posFilter && posGroup(p.position) !== posFilter) return false
      if (q && !`${p.first_name} ${p.last_name}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [players, search, posFilter])

  function addPlayer(p: Player) {
    const group = posGroup(p.position)
    if (counts[group] >= GROUP_NEEDS[group]) return
    setRoster(r => [...r, {
      playerId: p.id,
      firstName: p.first_name,
      lastName: p.last_name,
      position: p.position,
      cap_number: p.cap_number,
      snap_goals: 0, snap_assists: 0,
      snap_goalie_wins: 0, snap_goalie_otl: 0, snap_goalie_shutouts: 0,
    }])
  }

  function removePlayer(playerId: number) {
    setRoster(r => r.filter(p => p.playerId !== playerId))
  }

  async function handleSave() {
    if (!rosterOk) return
    setSaving(true)
    setMsg(null)
    const picks: PickInput[] = roster.map(p => ({
      playerId: p.playerId,
      firstName: p.firstName,
      lastName: p.lastName,
      position: p.position,
    }))
    const res = await savePicksAction(playoffSeasonId, picks)
    setSaving(false)
    if (res.error) {
      setMsg({ type: 'err', text: res.error })
    } else {
      setMsg({ type: 'ok', text: 'Alignement sauvegardé !' })
      setEditMode(false)
    }
  }

  const roundLabel = ROUND_LABEL[currentRound - 1] ?? `Ronde ${currentRound}`

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Mes picks — Séries</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Ronde {currentRound} — {roundLabel}
            &nbsp;·&nbsp;
            Cap {(capPerRound / 1_000_000).toFixed(1)} M$
          </p>
        </div>
        {!editMode && (
          <button
            onClick={() => setEditMode(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700"
          >
            Modifier mon alignement
          </button>
        )}
      </div>

      {/* Alignement actuel */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="bg-slate-800 px-5 py-3 flex items-center justify-between">
          <h2 className="text-white font-bold text-sm uppercase tracking-wide">Mon alignement</h2>
          <span className={`text-sm font-medium ${capOk ? 'text-green-300' : 'text-red-300'}`}>
            {(totalCap / 1_000_000).toFixed(2)} M$ / {(capPerRound / 1_000_000).toFixed(1)} M$
          </span>
        </div>

        {(['F', 'D', 'G'] as const).map(group => {
          const groupPlayers = roster.filter(p => posGroup(p.position) === group)
          return (
            <div key={group}>
              <div className="bg-gray-50 px-4 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b">
                {GROUP_LABEL[group]}
              </div>
              {groupPlayers.length === 0 ? (
                <div className="px-4 py-3 text-sm text-gray-400 italic">Aucun joueur sélectionné</div>
              ) : (
                groupPlayers.map(p => (
                  <div key={p.playerId} className="flex items-center gap-3 px-4 py-2.5 border-b last:border-0">
                    <span className="text-xs text-gray-400 w-6 text-center">{p.position}</span>
                    <span className="flex-1 font-medium text-gray-800">{p.lastName}, {p.firstName}</span>
                    <span className="text-sm text-gray-500">{(p.cap_number / 1_000_000).toFixed(2)} M$</span>
                    {editMode && (
                      <button
                        onClick={() => removePlayer(p.playerId)}
                        className="text-red-400 hover:text-red-600 text-xs px-2"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          )
        })}
      </div>

      {/* Bouton sauvegarder */}
      {editMode && (
        <div className="flex items-center gap-4">
          <button
            onClick={handleSave}
            disabled={saving || !rosterOk || !capOk}
            className="bg-green-600 text-white px-6 py-2 rounded font-medium hover:bg-green-700 disabled:opacity-50 text-sm"
          >
            {saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
          {!rosterOk && (
            <span className="text-sm text-orange-600">
              Roster incomplet : {counts.F}/3 att., {counts.D}/2 déf., {counts.G}/1 gard.
            </span>
          )}
          {rosterOk && !capOk && (
            <span className="text-sm text-red-600">Cap dépassé de {fmtPts((totalCap - capPerRound) / 1_000_000)} M$</span>
          )}
          {msg && (
            <span className={`text-sm ${msg.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}>{msg.text}</span>
          )}
        </div>
      )}

      {/* Sélecteur de joueurs */}
      {editMode && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="bg-slate-700 px-5 py-3">
            <h2 className="text-white font-bold text-sm uppercase tracking-wide">Ajouter des joueurs</h2>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Rechercher un joueur..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-1">
                {(['', 'F', 'D', 'G'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setPosFilter(f)}
                    className={`px-3 py-2 rounded text-sm font-medium ${posFilter === f ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    {f || 'Tous'}
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto divide-y border rounded">
              {filtered.length === 0 ? (
                <div className="px-4 py-6 text-sm text-gray-400 text-center">Aucun joueur trouvé.</div>
              ) : (
                filtered.slice(0, 100).map(p => {
                  const group = posGroup(p.position)
                  const alreadyIn = pickedIds.has(p.id)
                  const groupFull = counts[group] >= GROUP_NEEDS[group]
                  const disabled = alreadyIn || groupFull

                  return (
                    <div
                      key={p.id}
                      className={`flex items-center gap-3 px-4 py-2 ${disabled ? 'opacity-40' : 'hover:bg-blue-50 cursor-pointer'}`}
                      onClick={() => !disabled && addPlayer(p)}
                    >
                      <span className="text-xs text-gray-400 w-8 text-center">{p.position}</span>
                      <span className="flex-1 text-sm font-medium text-gray-800">{p.last_name}, {p.first_name}</span>
                      <span className="text-xs text-gray-500">{p.team_abbrev}</span>
                      <span className="text-xs text-gray-500 w-16 text-right">{(p.cap_number / 1_000_000).toFixed(2)} M$</span>
                      {alreadyIn && <span className="text-xs text-green-600">✓</span>}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
