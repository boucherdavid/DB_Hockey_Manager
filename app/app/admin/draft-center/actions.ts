'use server'

import { createClient } from '@/lib/supabase/server'
import { DraftSourceKey } from '@/lib/draft-sources'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, error: 'Non authentifié.' as const }
  const { data: me } = await supabase.from('poolers').select('is_admin').eq('id', user.id).single()
  if (!me?.is_admin) return { supabase, error: 'Accès refusé.' as const }
  return { supabase, error: null }
}

export type ProspectInput = {
  draftYear?: number
  firstName: string
  lastName: string
  position?: string | null
  team?: string | null
  gamesPlayed?: number | null
  goals?: number | null
  assists?: number | null
  points?: number | null
  pim?: number | null
  notes?: string | null
}

export async function createProspectAction(input: ProspectInput): Promise<{ error?: string; id?: number }> {
  const { supabase, error } = await requireAdmin()
  if (error) return { error }

  if (!input.draftYear) return { error: 'Année de repêchage requise.' }
  if (!input.firstName.trim() || !input.lastName.trim()) return { error: 'Prénom et nom requis.' }

  const { data, error: insertError } = await supabase
    .from('draft_prospects')
    .insert({
      draft_year: input.draftYear,
      first_name: input.firstName.trim(),
      last_name: input.lastName.trim(),
      position: input.position || null,
      team: input.team || null,
      games_played: input.gamesPlayed ?? null,
      goals: input.goals ?? null,
      assists: input.assists ?? null,
      points: input.points ?? null,
      pim: input.pim ?? null,
      notes: input.notes || null,
    })
    .select('id')
    .single()

  if (insertError) return { error: insertError.message }
  return { id: data.id }
}

export async function updateProspectAction(id: number, input: ProspectInput): Promise<{ error?: string }> {
  const { supabase, error } = await requireAdmin()
  if (error) return { error }

  if (!input.firstName.trim() || !input.lastName.trim()) return { error: 'Prénom et nom requis.' }

  const { error: updateError } = await supabase
    .from('draft_prospects')
    .update({
      first_name: input.firstName.trim(),
      last_name: input.lastName.trim(),
      position: input.position || null,
      team: input.team || null,
      games_played: input.gamesPlayed ?? null,
      goals: input.goals ?? null,
      assists: input.assists ?? null,
      points: input.points ?? null,
      pim: input.pim ?? null,
      notes: input.notes || null,
    })
    .eq('id', id)

  if (updateError) return { error: updateError.message }
  return {}
}

export async function deleteProspectAction(id: number): Promise<{ error?: string }> {
  const { supabase, error } = await requireAdmin()
  if (error) return { error }

  const { error: deleteError } = await supabase.from('draft_prospects').delete().eq('id', id)
  if (deleteError) return { error: deleteError.message }
  return {}
}

export type RankingInput = { source: DraftSourceKey; rank: number | null; sourceUrl?: string | null }

export async function updateRankingsAction(prospectId: number, rankings: RankingInput[]): Promise<{ error?: string }> {
  const { supabase, error } = await requireAdmin()
  if (error) return { error }

  const toUpsert = rankings.filter(r => r.rank !== null)
  const toDelete = rankings.filter(r => r.rank === null).map(r => r.source)

  if (toUpsert.length > 0) {
    const { error: upsertError } = await supabase
      .from('draft_prospect_rankings')
      .upsert(
        toUpsert.map(r => ({
          prospect_id: prospectId,
          source: r.source,
          rank: r.rank,
          source_url: r.sourceUrl || null,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: 'prospect_id,source' },
      )
    if (upsertError) return { error: upsertError.message }
  }

  if (toDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from('draft_prospect_rankings')
      .delete()
      .eq('prospect_id', prospectId)
      .in('source', toDelete)
    if (deleteError) return { error: deleteError.message }
  }

  return {}
}
