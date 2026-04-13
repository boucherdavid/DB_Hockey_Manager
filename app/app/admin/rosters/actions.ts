'use server'

import { createClient } from '@/lib/supabase/server'

const ACTIVE_LIMITS = { forward: 12, defense: 6, goalie: 2 } as const
type Bucket = keyof typeof ACTIVE_LIMITS

const BUCKET_LABELS: Record<Bucket, string> = {
  forward: 'attaquants actifs',
  defense: 'défenseurs actifs',
  goalie: 'gardiens actifs',
}

function getPlayerBucket(position: string | null): Bucket {
  const pos = (position ?? '').toUpperCase()
  if (pos.includes('G')) return 'goalie'
  if (pos.includes('D')) return 'defense'
  return 'forward'
}

async function countActiveByBucket(
  supabase: Awaited<ReturnType<typeof createClient>>,
  poolerId: string,
  saisonId: number,
  bucket: Bucket,
  excludeEntryId?: number,
): Promise<number> {
  const { data } = await supabase
    .from('pooler_rosters')
    .select('id, players(position)')
    .eq('pooler_id', poolerId)
    .eq('pool_season_id', saisonId)
    .eq('player_type', 'actif')
    .eq('is_active', true)

  return (data ?? []).filter((r: any) => {
    if (excludeEntryId && r.id === excludeEntryId) return false
    return getPlayerBucket(r.players?.position ?? null) === bucket
  }).length
}

export async function addPlayerAction(
  poolerId: string,
  playerId: number,
  saisonId: number,
  playerType: 'actif' | 'recrue' | 'reserviste' | 'ltir',
  rookieType?: 'repcheche' | 'agent_libre',
  poolDraftYear?: number,
): Promise<{ error?: string }> {
  const supabase = await createClient()

  if (playerType === 'recrue') {
    const { data: player } = await supabase.from('players').select('is_rookie').eq('id', playerId).single()
    if (!player?.is_rookie) {
      return { error: 'Seuls les joueurs recrues peuvent aller dans la banque de recrues.' }
    }
    if (!rookieType) {
      return { error: 'Le type de recrue (repêché ou agent libre) est requis.' }
    }
  }

  if (playerType === 'actif') {
    const { data: player } = await supabase.from('players').select('position').eq('id', playerId).single()
    const bucket = getPlayerBucket(player?.position ?? null)
    const count = await countActiveByBucket(supabase, poolerId, saisonId, bucket)
    if (count >= ACTIVE_LIMITS[bucket]) {
      return { error: `Limite atteinte pour les ${BUCKET_LABELS[bucket]} (${ACTIVE_LIMITS[bucket]}).` }
    }
  }

  const rookieFields = rookieType
    ? { rookie_type: rookieType, pool_draft_year: rookieType === 'repcheche' ? poolDraftYear : null }
    : {}

  // Si une entrée inactive existe déjà (soft-delete), la réactiver plutôt qu'insérer
  const { data: existing } = await supabase
    .from('pooler_rosters')
    .select('id')
    .eq('pooler_id', poolerId)
    .eq('player_id', playerId)
    .eq('pool_season_id', saisonId)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('pooler_rosters')
      .update({ is_active: true, player_type: playerType, removed_at: null, ...rookieFields })
      .eq('id', existing.id)
    return error ? { error: error.message } : {}
  }

  const { error } = await supabase.from('pooler_rosters').insert({
    pooler_id: poolerId,
    player_id: playerId,
    pool_season_id: saisonId,
    player_type: playerType,
    is_active: true,
    ...rookieFields,
  })

  return error ? { error: error.message } : {}
}

export async function updateRookieTypeAction(
  rosterId: number,
  rookieType: 'repcheche' | 'agent_libre',
  poolDraftYear?: number,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('pooler_rosters')
    .update({
      rookie_type: rookieType,
      pool_draft_year: rookieType === 'repcheche' ? (poolDraftYear ?? null) : null,
    })
    .eq('id', rosterId)
  return error ? { error: error.message } : {}
}

export async function removePlayerAction(rosterId: number): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: entry } = await supabase
    .from('pooler_rosters')
    .select('player_type, pooler_id, pool_season_id')
    .eq('id', rosterId)
    .single()

  if (entry?.player_type === 'reserviste') {
    const { count } = await supabase
      .from('pooler_rosters')
      .select('id', { count: 'exact', head: true })
      .eq('pooler_id', entry.pooler_id)
      .eq('pool_season_id', entry.pool_season_id)
      .eq('player_type', 'reserviste')
      .eq('is_active', true)

    if ((count ?? 0) <= 2) {
      return { error: 'Un minimum de 2 réservistes est requis.' }
    }
  }

  const { error } = await supabase
    .from('pooler_rosters')
    .update({ is_active: false, removed_at: new Date().toISOString() })
    .eq('id', rosterId)

  return error ? { error: error.message } : {}
}

export async function changeTypeAction(
  entryId: number,
  playerId: number,
  poolerId: string,
  saisonId: number,
  newType: 'actif' | 'recrue' | 'reserviste' | 'ltir',
): Promise<{ error?: string }> {
  const supabase = await createClient()

  if (newType === 'recrue') {
    const { data: player } = await supabase.from('players').select('is_rookie').eq('id', playerId).single()
    if (!player?.is_rookie) {
      return { error: 'Seuls les joueurs recrues peuvent aller dans la banque de recrues.' }
    }
  }

  if (newType === 'actif') {
    const { data: player } = await supabase.from('players').select('position').eq('id', playerId).single()
    const bucket = getPlayerBucket(player?.position ?? null)
    const count = await countActiveByBucket(supabase, poolerId, saisonId, bucket, entryId)
    if (count >= ACTIVE_LIMITS[bucket]) {
      return { error: `Limite atteinte pour les ${BUCKET_LABELS[bucket]} (${ACTIVE_LIMITS[bucket]}).` }
    }
  }

  const { error } = await supabase.from('pooler_rosters').update({ player_type: newType }).eq('id', entryId)

  return error ? { error: error.message } : {}
}

type AddEntry = {
  player_id: number
  player_type: 'actif' | 'recrue' | 'reserviste' | 'ltir'
  rookie_type?: 'repcheche' | 'agent_libre'
  pool_draft_year?: number
}

type ChangeTypeEntry = {
  entryId: number
  newType: 'actif' | 'recrue' | 'reserviste' | 'ltir'
}

export async function submitRosterAction(
  poolerId: string,
  saisonId: number,
  toAdd: AddEntry[],
  toRemove: number[],
  toChangeType: ChangeTypeEntry[],
): Promise<{ error?: string }> {
  const supabase = await createClient()

  // Reconstituer l'état final pour validation
  const { data: current } = await supabase
    .from('pooler_rosters')
    .select('id, player_type, players(position, is_rookie)')
    .eq('pooler_id', poolerId)
    .eq('pool_season_id', saisonId)
    .eq('is_active', true)

  const removeSet = new Set(toRemove)
  const changeMap = new Map(toChangeType.map(c => [c.entryId, c.newType]))

  type FinalEntry = { player_type: string; position: string | null; is_rookie: boolean }
  const finalEntries: FinalEntry[] = []

  for (const row of (current ?? []) as any[]) {
    if (removeSet.has(row.id)) continue
    finalEntries.push({
      player_type: changeMap.get(row.id) ?? row.player_type,
      position: row.players?.position ?? null,
      is_rookie: row.players?.is_rookie ?? false,
    })
  }

  for (const entry of toAdd) {
    const { data: player } = await supabase.from('players').select('position, is_rookie').eq('id', entry.player_id).single()
    if (entry.player_type === 'recrue' && !player?.is_rookie) {
      return { error: `Seuls les joueurs recrues peuvent aller dans la banque de recrues.` }
    }
    finalEntries.push({
      player_type: entry.player_type,
      position: player?.position ?? null,
      is_rookie: player?.is_rookie ?? false,
    })
  }

  // Validation de l'état final
  const actifs = finalEntries.filter(e => e.player_type === 'actif')
  const reservistes = finalEntries.filter(e => e.player_type === 'reserviste')

  const counts = actifs.reduce(
    (acc, e) => { acc[getPlayerBucket(e.position)] += 1; return acc },
    { forward: 0, defense: 0, goalie: 0 } as Record<Bucket, number>,
  )

  for (const bucket of (['forward', 'defense', 'goalie'] as Bucket[])) {
    if (counts[bucket] > ACTIVE_LIMITS[bucket]) {
      return { error: `Limite dépassée pour les ${BUCKET_LABELS[bucket]} (${ACTIVE_LIMITS[bucket]} max).` }
    }
  }

  if (reservistes.length < 2) {
    return { error: `Un minimum de 2 réservistes est requis (${reservistes.length} dans cet alignement).` }
  }

  // Application
  if (toRemove.length > 0) {
    const { error } = await supabase
      .from('pooler_rosters')
      .update({ is_active: false, removed_at: new Date().toISOString() })
      .in('id', toRemove)
    if (error) return { error: error.message }
  }

  for (const { entryId, newType } of toChangeType) {
    const { error } = await supabase.from('pooler_rosters').update({ player_type: newType }).eq('id', entryId)
    if (error) return { error: error.message }
  }

  for (const entry of toAdd) {
    const rookieFields = entry.rookie_type
      ? { rookie_type: entry.rookie_type, pool_draft_year: entry.rookie_type === 'repcheche' ? (entry.pool_draft_year ?? null) : null }
      : {}

    const { data: existing } = await supabase
      .from('pooler_rosters')
      .select('id')
      .eq('pooler_id', poolerId)
      .eq('player_id', entry.player_id)
      .eq('pool_season_id', saisonId)
      .maybeSingle()

    if (existing) {
      const { error } = await supabase
        .from('pooler_rosters')
        .update({ is_active: true, player_type: entry.player_type, removed_at: null, ...rookieFields })
        .eq('id', existing.id)
      if (error) return { error: error.message }
    } else {
      const { error } = await supabase.from('pooler_rosters').insert({
        pooler_id: poolerId,
        player_id: entry.player_id,
        pool_season_id: saisonId,
        player_type: entry.player_type,
        is_active: true,
        ...rookieFields,
      })
      if (error) return { error: error.message }
    }
  }

  return {}
}
