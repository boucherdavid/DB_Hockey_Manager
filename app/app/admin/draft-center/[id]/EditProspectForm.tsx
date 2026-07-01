'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DRAFT_SOURCES, DraftSourceKey } from '@/lib/draft-sources'
import { updateProspectAction, updateRankingsAction } from '../actions'

type Prospect = {
  id: number
  first_name: string
  last_name: string
  position: string | null
  team: string | null
  games_played: number | null
  goals: number | null
  assists: number | null
  points: number | null
  pim: number | null
  notes: string | null
  draft_prospect_rankings: { source: DraftSourceKey; rank: number; source_url: string | null }[]
}

export default function EditProspectForm({ prospect }: { prospect: Prospect }) {
  const router = useRouter()
  const [firstName, setFirstName] = useState(prospect.first_name)
  const [lastName, setLastName] = useState(prospect.last_name)
  const [position, setPosition] = useState(prospect.position ?? '')
  const [team, setTeam] = useState(prospect.team ?? '')
  const [gp, setGp] = useState(prospect.games_played?.toString() ?? '')
  const [g, setG] = useState(prospect.goals?.toString() ?? '')
  const [a, setA] = useState(prospect.assists?.toString() ?? '')
  const [p, setP] = useState(prospect.points?.toString() ?? '')
  const [pim, setPim] = useState(prospect.pim?.toString() ?? '')
  const [notes, setNotes] = useState(prospect.notes ?? '')

  const initialRankings = Object.fromEntries(
    prospect.draft_prospect_rankings.map(r => [r.source, { rank: r.rank.toString(), url: r.source_url ?? '' }]),
  ) as Record<string, { rank: string; url: string }>
  const [rankings, setRankings] = useState(initialRankings)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  function setRanking(source: DraftSourceKey, field: 'rank' | 'url', value: string) {
    setRankings(prev => ({ ...prev, [source]: { ...prev[source], rank: prev[source]?.rank ?? '', url: prev[source]?.url ?? '', [field]: value } }))
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess(false)

    const bioResult = await updateProspectAction(prospect.id, {
      firstName, lastName,
      position: position || null,
      team: team || null,
      gamesPlayed: gp ? parseInt(gp) : null,
      goals: g ? parseInt(g) : null,
      assists: a ? parseInt(a) : null,
      points: p ? parseInt(p) : null,
      pim: pim ? parseInt(pim) : null,
      notes: notes || null,
    })
    if (bioResult.error) {
      setLoading(false)
      setError(bioResult.error)
      return
    }

    const rankingsResult = await updateRankingsAction(
      prospect.id,
      DRAFT_SOURCES.map(s => ({
        source: s.key,
        rank: rankings[s.key]?.rank ? parseInt(rankings[s.key].rank) : null,
        sourceUrl: rankings[s.key]?.url || null,
      })),
    )
    setLoading(false)
    if (rankingsResult.error) {
      setError(rankingsResult.error)
      return
    }
    setSuccess(true)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      <div className="bg-white rounded-lg shadow p-5">
        <h2 className="font-semibold text-gray-700 mb-4">Informations</h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <input value={firstName} onChange={e => setFirstName(e.target.value)} required placeholder="Prénom"
            className="border rounded-lg px-3 py-2 text-sm" />
          <input value={lastName} onChange={e => setLastName(e.target.value)} required placeholder="Nom"
            className="border rounded-lg px-3 py-2 text-sm" />
          <input value={position} onChange={e => setPosition(e.target.value)} placeholder="Position"
            className="border rounded-lg px-3 py-2 text-sm" />
          <input value={team} onChange={e => setTeam(e.target.value)} placeholder="Équipe, ligue"
            className="border rounded-lg px-3 py-2 text-sm sm:col-span-1" />
        </div>
        <h3 className="text-sm font-medium text-gray-600 mt-4 mb-2">Statistiques (optionnel)</h3>
        <div className="grid grid-cols-5 gap-3 max-w-xl">
          <input value={gp} onChange={e => setGp(e.target.value)} placeholder="PJ" type="number"
            className="border rounded-lg px-3 py-2 text-sm" />
          <input value={g} onChange={e => setG(e.target.value)} placeholder="B" type="number"
            className="border rounded-lg px-3 py-2 text-sm" />
          <input value={a} onChange={e => setA(e.target.value)} placeholder="A" type="number"
            className="border rounded-lg px-3 py-2 text-sm" />
          <input value={p} onChange={e => setP(e.target.value)} placeholder="PTS" type="number"
            className="border rounded-lg px-3 py-2 text-sm" />
          <input value={pim} onChange={e => setPim(e.target.value)} placeholder="PUN" type="number"
            className="border rounded-lg px-3 py-2 text-sm" />
        </div>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes"
          className="border rounded-lg px-3 py-2 text-sm w-full mt-3" rows={2} />
      </div>

      <div className="bg-white rounded-lg shadow p-5">
        <h2 className="font-semibold text-gray-700 mb-4">Rangs par source</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {DRAFT_SOURCES.map(s => (
            <div key={s.key} className="flex items-center gap-2">
              <label className="text-xs text-gray-600 w-44 shrink-0">{s.label}</label>
              <input
                type="number"
                placeholder="Rang"
                value={rankings[s.key]?.rank ?? ''}
                onChange={e => setRanking(s.key, 'rank', e.target.value)}
                className="border rounded-lg px-2 py-1.5 text-sm w-20"
              />
              <input
                type="url"
                placeholder="Lien source (optionnel)"
                value={rankings[s.key]?.url ?? ''}
                onChange={e => setRanking(s.key, 'url', e.target.value)}
                className="border rounded-lg px-2 py-1.5 text-sm flex-1"
              />
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}
      {success && <p className="text-green-600 text-sm">Enregistré.</p>}
      <button type="submit" disabled={loading}
        className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40">
        {loading ? 'Enregistrement...' : 'Enregistrer'}
      </button>
    </form>
  )
}
