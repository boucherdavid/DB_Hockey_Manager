import { createClient } from '@/lib/supabase/server'
import RepechageTable from './RepechageTable'

const PROTECTION_SEASONS = 5
const NHL_RECORDS_URL = 'https://records.nhl.com/site/api/draft'

function getSaisonFinCourante() {
  const now = new Date()
  return now.getMonth() < 6 ? now.getFullYear() : now.getFullYear() + 1
}

function getAnneesDraft() {
  const fin = getSaisonFinCourante()
  const annees: number[] = []
  for (let y = fin - PROTECTION_SEASONS; y <= new Date().getFullYear(); y++) {
    annees.push(y)
  }
  return annees
}

async function fetchDraftYear(year: number) {
  try {
    const res = await fetch(`${NHL_RECORDS_URL}?cayenneExp=draftYear=${year}`, {
      next: { revalidate: 3600 },
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.data ?? []) as any[]
  } catch {
    return []
  }
}

export default async function RepechagePage() {
  const supabase = await createClient()
  const annees = getAnneesDraft()

  // Récupérer tous les picks depuis l'API NHL en parallèle
  const picksByYear = await Promise.all(annees.map((y) => fetchDraftYear(y)))
  const allPicks = picksByYear.flat()

  // Saison active pour les assignations
  const { data: saison } = await supabase
    .from('pool_seasons')
    .select('id')
    .eq('is_active', true)
    .single()

  // Banque de recrues active : player_id → pooler name
  const { data: rosterEntries } = saison
    ? await supabase
        .from('pooler_rosters')
        .select('player_id, poolers(name)')
        .eq('pool_season_id', saison.id)
        .eq('player_type', 'recrue')
        .eq('is_active', true)
    : { data: [] }

  // Players en DB avec draft info pour enrichir les picks API
  const { data: dbPlayers } = await supabase
    .from('players')
    .select('id, first_name, last_name, draft_year, draft_round, draft_overall')
    .not('draft_year', 'is', null)
    .range(0, 1999)

  // Map (draft_year, draft_overall) → player_id pour la correspondance
  const dbPickMap = new Map<string, number>(
    (dbPlayers ?? []).map((p: any) => [
      `${p.draft_year}|${p.draft_overall}`,
      p.id,
    ]),
  )

  const poolerByPlayerId = new Map<number, string>(
    (rosterEntries ?? []).map((entry: any) => [
      entry.player_id as number,
      entry.poolers?.name as string,
    ]),
  )

  const picks = allPicks
    .filter((p) => p.firstName && p.lastName)
    .map((p) => {
      const dbKey = `${p.draftYear}|${p.overallPickNumber}`
      const dbPlayerId = dbPickMap.get(dbKey) ?? null
      return {
        player_id: dbPlayerId ?? p.playerId,
        first_name: p.firstName,
        last_name: p.lastName,
        position: p.position ?? null,
        draft_year: p.draftYear,
        draft_round: p.roundNumber,
        draft_overall: p.overallPickNumber,
        team_code: p.triCode ?? null,
        status: null,
        pooler_name: dbPlayerId ? (poolerByPlayerId.get(dbPlayerId) ?? null) : null,
      }
    })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Repêchage LNH</h1>
        <p className="text-gray-500 text-sm mt-1">
          {"Vue d'ensemble des choix au repêchage et de leur assignation dans les banques de recrues du pool."}
        </p>
      </div>
      <RepechageTable picks={picks} />
    </div>
  )
}
