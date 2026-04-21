'use client'

import { useState, useMemo } from 'react'
import { savePicksAction, type PickInput } from '@/app/series/actions'

const ROUND_LABEL = ['Quart de finale', 'Demi-finale', 'Finale de conférence', 'Finale de la Coupe Stanley']

type Conference = 'Est' | 'Ouest'

type Player = {
  id: number
  first_name: string
  last_name: string
  position: string | null
  cap_number: number
  team_abbrev: string
  conference: string
}

type ActivePick = {
  playerId: number
  firstName: string
  lastName: string
  position: string | null
  cap_number: number
  conference: Conference
  snap_goals: number
  snap_assists: number
  snap_goalie_wins: number
  snap_goalie_otl: number
  snap_goalie_shutouts: number
}

function posGroup(pos: string | null): 'F' | 'D' | 'G' {
  if (pos === 'G') return 'G'
  if (pos === 'D' || pos === 'LD' || pos === 'RD') return 'D'
  return 'F'
}

const GROUP_NEEDS = { F: 3, D: 2, G: 1 }
const GROUP_LABEL = { F: 'Attaquants (3)', D: 'Défenseurs (2)', G: 'Gardien (1)' }

function RosterPanel({
  conf,
  roster,
  capPerRound,
  editMode,
  onRemove,
}: {
  conf: Conference
  roster: ActivePick[]
  capPerRound: number
  editMode: boolean
  onRemove: (id: number) => void
}) {
  const totalCap = roster.reduce((s, p) => s + p.cap_number, 0)
  const capOk = totalCap <= capPerRound
  const counts = { F: 0, D: 0, G: 0 }
  for (const p of roster) counts[posGroup(p.position)]++

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className={`px-5 py-3 flex items-center justify-between ${conf === 'Est' ? 'bg-blue-800' : 'bg-orange-700'}`}>
        <h2 className="text-white font-bold text-sm uppercase tracking-wide">
          Conférence {conf}
        </h2>
        <span className={`text-sm font-medium ${capOk ? 'text-green-300' : 'text-red-300'}`}>
          {(totalCap / 1_000_000).toFixed(2)} M$ / {(capPerRound / 1_000_000).toFixed(1)} M$
        </span>
      </div>

      {(['F', 'D', 'G'] as const).map(group => {
        const groupPlayers = roster.filter(p => posGroup(p.position) === group)
        return (
          <div key={group}>
            <div className="bg-gray-50 px-4 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b">
              {GROUP_LABEL[group]} — {groupPlayers.length}/{GROUP_NEEDS[group]}
            </div>
            {groupPlayers.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-400 italic">Aucun joueur sélectionné</div>
            ) : (
              groupPlayers.map(p => (
                <div key={p.playerId} className="flex items-center gap-3 px-4 py-2.5 border-b last:border-0">
                  <span className="text-xs text-gray-400 w-8 text-center shrink-0">{p.position}</span>
                  <span className="flex-1 font-medium text-gray-800 text-sm">{p.lastName}, {p.firstName}</span>
                  <span className="text-sm text-gray-500 shrink-0">{(p.cap_number / 1_000_000).toFixed(2)} M$</span>
                  {editMode && (
                    <button onClick={() => onRemove(p.playerId)}
                      className="text-red-400 hover:text-red-600 text-xs px-1 shrink-0">✕</button>
                  )}
                </div>
              ))
            )}
          </div>
        )
      })}
    </div>
  )
}

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
  const [confFilter, setConfFilter] = useState<Conference | ''>('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [editMode, setEditMode] = useState(currentPicks.length === 0)

  const rosterEst   = roster.filter(p => p.conference === 'Est')
  const rosterOuest = roster.filter(p => p.conference === 'Ouest')
  const pickedIds   = new Set(roster.map(p => p.playerId))

  // Counts par groupe par conférence
  const countsEst   = { F: 0, D: 0, G: 0 }
  const countsOuest = { F: 0, D: 0, G: 0 }
  for (const p of rosterEst)   countsEst[posGroup(p.position)]++
  for (const p of rosterOuest) countsOuest[posGroup(p.position)]++

  const rosterOk =
    countsEst.F === 3 && countsEst.D === 2 && countsEst.G === 1 &&
    countsOuest.F === 3 && countsOuest.D === 2 && countsOuest.G === 1

  const capEstOk   = rosterEst.reduce((s, p) => s + p.cap_number, 0) <= capPerRound
  const capOuestOk = rosterOuest.reduce((s, p) => s + p.cap_number, 0) <= capPerRound
  const capOk = capEstOk && capOuestOk

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return players.filter(p => {
      if (posFilter && posGroup(p.position) !== posFilter) return false
      if (confFilter && p.conference !== confFilter) return false
      if (q && !`${p.first_name} ${p.last_name}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [players, search, posFilter, confFilter])

  function addPlayer(p: Player) {
    const conf = p.conference as Conference
    const counts = conf === 'Est' ? countsEst : countsOuest
    const group = posGroup(p.position)
    if (counts[group] >= GROUP_NEEDS[group]) return
    setRoster(r => [...r, {
      playerId: p.id,
      firstName: p.first_name,
      lastName: p.last_name,
      position: p.position,
      cap_number: p.cap_number,
      conference: conf,
      snap_goals: 0, snap_assists: 0,
      snap_goalie_wins: 0, snap_goalie_otl: 0, snap_goalie_shutouts: 0,
    }])
  }

  function removePlayer(playerId: number) {
    setRoster(r => r.filter(p => p.playerId !== playerId))
  }

  async function handleSave() {
    if (!rosterOk || !capOk) return
    setSaving(true)
    setMsg(null)
    const picks: PickInput[] = roster.map(p => ({
      playerId: p.playerId,
      firstName: p.firstName,
      lastName: p.lastName,
      position: p.position,
      conference: p.conference,
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
          <h1 className="text-2xl font-bold text-gray-800">Mes choix — Séries</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Ronde {currentRound} — {roundLabel}
            &nbsp;·&nbsp;Cap {(capPerRound / 1_000_000).toFixed(1)} M$ par conférence
          </p>
        </div>
        {!editMode && (
          <button onClick={() => setEditMode(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700">
            Modifier mon alignement
          </button>
        )}
      </div>

      {/* Deux panels côte à côte sur desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RosterPanel conf="Est"   roster={rosterEst}   capPerRound={capPerRound} editMode={editMode} onRemove={removePlayer} />
        <RosterPanel conf="Ouest" roster={rosterOuest} capPerRound={capPerRound} editMode={editMode} onRemove={removePlayer} />
      </div>

      {/* Bouton sauvegarder */}
      {editMode && (
        <div className="flex flex-wrap items-center gap-4">
          <button onClick={handleSave} disabled={saving || !rosterOk || !capOk}
            className="bg-green-600 text-white px-6 py-2 rounded font-medium hover:bg-green-700 disabled:opacity-50 text-sm">
            {saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
          {!rosterOk && (
            <span className="text-sm text-orange-600">
              Est : {countsEst.F}/3 att. {countsEst.D}/2 déf. {countsEst.G}/1 gard.
              &nbsp;·&nbsp;
              Ouest : {countsOuest.F}/3 att. {countsOuest.D}/2 déf. {countsOuest.G}/1 gard.
            </span>
          )}
          {rosterOk && !capOk && (
            <span className="text-sm text-red-600">
              Cap dépassé —{!capEstOk ? ' Est' : ''}{!capOuestOk ? ' Ouest' : ''}
            </span>
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
            <div className="flex flex-wrap gap-2">
              <input type="text" placeholder="Rechercher un joueur..."
                value={search} onChange={e => setSearch(e.target.value)}
                className="flex-1 min-w-48 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <div className="flex gap-1">
                {(['', 'Est', 'Ouest'] as const).map(f => (
                  <button key={f} onClick={() => setConfFilter(f)}
                    className={`px-3 py-2 rounded text-sm font-medium ${confFilter === f ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {f || 'Toutes'}
                  </button>
                ))}
              </div>
              <div className="flex gap-1">
                {(['', 'F', 'D', 'G'] as const).map(f => (
                  <button key={f} onClick={() => setPosFilter(f)}
                    className={`px-3 py-2 rounded text-sm font-medium ${posFilter === f ? 'bg-slate-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {f || 'Pos.'}
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto divide-y border rounded">
              {filtered.length === 0 ? (
                <div className="px-4 py-6 text-sm text-gray-400 text-center">Aucun joueur trouvé.</div>
              ) : (
                filtered.slice(0, 150).map(p => {
                  const conf = p.conference as Conference
                  const counts = conf === 'Est' ? countsEst : countsOuest
                  const group = posGroup(p.position)
                  const alreadyIn = pickedIds.has(p.id)
                  const groupFull = counts[group] >= GROUP_NEEDS[group]
                  const disabled = alreadyIn || groupFull

                  return (
                    <div key={p.id}
                      className={`flex items-center gap-2 px-4 py-2 ${disabled ? 'opacity-40' : 'hover:bg-blue-50 cursor-pointer'}`}
                      onClick={() => !disabled && addPlayer(p)}>
                      <span className={`text-xs font-medium w-8 text-center shrink-0 ${conf === 'Est' ? 'text-blue-600' : 'text-orange-600'}`}>
                        {conf === 'Est' ? 'E' : 'O'}
                      </span>
                      <span className="text-xs text-gray-400 w-8 text-center shrink-0">{p.position}</span>
                      <span className="flex-1 text-sm font-medium text-gray-800">{p.last_name}, {p.first_name}</span>
                      <span className="text-xs text-gray-500 shrink-0">{p.team_abbrev}</span>
                      <span className="text-xs text-gray-500 w-16 text-right shrink-0">{(p.cap_number / 1_000_000).toFixed(2)} M$</span>
                      {alreadyIn && <span className="text-xs text-green-600 shrink-0">✓</span>}
                    </div>
                  )
                })
              )}
            </div>
            <p className="text-xs text-gray-400">
              <span className="text-blue-600 font-medium">E</span> = Est &nbsp;·&nbsp;
              <span className="text-orange-600 font-medium">O</span> = Ouest &nbsp;·&nbsp;
              Cliquez sur un joueur pour l&apos;ajouter à sa conférence
            </p>
          </div>
        </div>
      )}
    </div>
  )
}