'use server'

import { createClient } from '@/lib/supabase/server'
import { takeSnapshot } from '@/lib/snapshot'
import { sendPushToUser } from '@/lib/push'

const ACTIVE_LIMITS = { forward: 12, defense: 6, goalie: 2 } as const
type Bucket = keyof typeof ACTIVE_LIMITS

const BUCKET_LABELS: Record<Bucket, string> = {
  forward: 'attaquants actifs',
  defense: 'défenseurs actifs',
  goalie: 'gardiens actifs',
}

type PlayerType = 'actif' | 'recrue' | 'reserviste' | 'ltir'

const TYPE_LABEL: Record<PlayerType, string> = {
  actif:      'actif',
  reserviste: 'réserviste',
  recrue:     'recrue',
  ltir:       'LTIR',
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

function detectChangeType(
  oldType: PlayerType | null,
  newType: PlayerType,
  isRemoval = false,
): string {
  if (isRemoval) return oldType === 'actif' ? 'deactivation' : 'retrait'
  if (!oldType) {
    const map: Record<PlayerType, string> = {
      actif:      'activation',
      reserviste: 'ajout_reserviste',
      recrue:     'ajout_recrue',
      ltir:       'ltir',
    }
    return map[newType]
  }
  if (newType === 'actif') return 'activation'
  if (oldType === 'actif') return 'deactivation'
  if (newType === 'ltir') return 'ltir'
  if (oldType === 'ltir') return 'retour_ltir'
  return 'changement_type'
}

async function logChange(
  supabase: Awaited<ReturnType<typeof createClient>>,
  playerId: number,
  poolerId: string,
  poolSeasonId: number,
  changeType: string,
  oldType: string | null,
  newType: string | null,
): Promise<void> {
  await supabase.from('roster_change_log').insert({
    player_id:      playerId,
    pooler_id:      poolerId,
    pool_season_id: poolSeasonId,
    change_type:    changeType,
    old_type:       oldType,
    new_type:       newType,
    changed_by:     null, // null = admin; pooler_id ici quand self-service implémenté
  })
}

export async function addPlayerAction(
  poolerId: string,
  playerId: number,
  saisonId: number,
  playerType: PlayerType,
  rookieType?: 'repeche' | 'agent_libre',
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
    ? { rookie_type: rookieType, pool_draft_year: rookieType === 'repeche' ? poolDraftYear : null }
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
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase.from('pooler_rosters').insert({
      pooler_id:      poolerId,
      player_id:      playerId,
      pool_season_id: saisonId,
      player_type:    playerType,
      is_active:      true,
      ...rookieFields,
    })
    if (error) return { error: error.message }
  }

  const changeType = detectChangeType(null, playerType)
  await logChange(supabase, playerId, poolerId, saisonId, changeType, null, playerType)

  if (playerType === 'actif') {
    const { data: player } = await supabase.from('players').select('nhl_id').eq('id', playerId).single()
    await takeSnapshot({
      playerId,
      nhlId:        player?.nhl_id ?? null,
      poolerId,
      poolSeasonId: saisonId,
      snapshotType: 'activation',
    })
  }

  // Notification push au pooler
  const { data: playerInfo } = await supabase
    .from('players')
    .select('first_name, last_name')
    .eq('id', playerId)
    .single()
  if (playerInfo) {
    sendPushToUser(poolerId, {
      title: 'DB Hockey Manager — Alignement',
      body:  `${playerInfo.last_name}, ${playerInfo.first_name} ajouté (${TYPE_LABEL[playerType]}).`,
      url:   `/poolers/${poolerId}`,
    }).catch(() => {})
  }

  return {}
}

export async function updateRookieTypeAction(
  rosterId: number,
  rookieType: 'repeche' | 'agent_libre',
  poolDraftYear?: number,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('pooler_rosters')
    .update({
      rookie_type:    rookieType,
      pool_draft_year: rookieType === 'repeche' ? (poolDraftYear ?? null) : null,
    })
    .eq('id', rosterId)
  return error ? { error: error.message } : {}
}

export async function removePlayerAction(rosterId: number): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: entry } = await supabase
    .from('pooler_rosters')
    .select('player_id, player_type, pooler_id, pool_season_id')
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

  if (entry) {
    const oldType = entry.player_type as PlayerType
    const changeType = detectChangeType(oldType, oldType, true)
    await logChange(supabase, entry.player_id, entry.pooler_id, entry.pool_season_id, changeType, oldType, null)

    if (oldType === 'actif') {
      const { data: player } = await supabase.from('players').select('nhl_id').eq('id', entry.player_id).single()
      await takeSnapshot({
        playerId:     entry.player_id,
        nhlId:        player?.nhl_id ?? null,
        poolerId:     entry.pooler_id,
        poolSeasonId: entry.pool_season_id,
        snapshotType: 'deactivation',
      })
    }
  }

  const { error } = await supabase
    .from('pooler_rosters')
    .update({ is_active: false, removed_at: new Date().toISOString() })
    .eq('id', rosterId)

  if (!error && entry) {
    const { data: playerInfo } = await supabase
      .from('players')
      .select('first_name, last_name')
      .eq('id', entry.player_id)
      .single()
    if (playerInfo) {
      sendPushToUser(entry.pooler_id, {
        title: 'DB Hockey Manager — Alignement',
        body:  `${playerInfo.last_name}, ${playerInfo.first_name} retiré de votre alignement.`,
        url:   `/poolers/${entry.pooler_id}`,
      }).catch(() => {})
    }
  }

  return error ? { error: error.message } : {}
}

export async function changeTypeAction(
  entryId: number,
  playerId: number,
  poolerId: string,
  saisonId: number,
  newType: PlayerType,
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: currentEntry } = await supabase
    .from('pooler_rosters')
    .select('player_type')
    .eq('id', entryId)
    .single()
  const oldType = (currentEntry?.player_type ?? null) as PlayerType | null

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
  if (error) return { error: error.message }

  if (oldType !== newType) {
    const changeType = detectChangeType(oldType, newType)
    await logChange(supabase, playerId, poolerId, saisonId, changeType, oldType, newType)

    if (oldType === 'actif' || newType === 'actif') {
      const { data: player } = await supabase.from('players').select('nhl_id').eq('id', playerId).single()
      await takeSnapshot({
        playerId,
        nhlId:        player?.nhl_id ?? null,
        poolerId,
        poolSeasonId: saisonId,
        snapshotType: newType === 'actif' ? 'activation' : 'deactivation',
      })
    }

    const { data: playerInfo } = await supabase
      .from('players')
      .select('first_name, last_name')
      .eq('id', playerId)
      .single()
    if (playerInfo) {
      sendPushToUser(poolerId, {
        title: 'DB Hockey Manager — Alignement',
        body:  `${playerInfo.last_name}, ${playerInfo.first_name} : ${TYPE_LABEL[oldType ?? 'actif']} → ${TYPE_LABEL[newType]}.`,
        url:   `/poolers/${poolerId}`,
      }).catch(() => {})
    }
  }

  return {}
}

type AddEntry = {
  player_id:      number
  player_type:    PlayerType
  rookie_type?:   'repeche' | 'agent_libre'
  pool_draft_year?: number
}

type ChangeTypeEntry = {
  entryId: number
  newType: PlayerType
}

export async function submitRosterAction(
  poolerId: string,
  saisonId: number,
  toAdd: AddEntry[],
  toRemove: number[],
  toChangeType: ChangeTypeEntry[],
): Promise<{ error?: string }> {
  const supabase = await createClient()

  // Récupérer le roster courant pour validation et détection des types
  const { data: current } = await supabase
    .from('pooler_rosters')
    .select('id, player_id, player_type, players(position, is_rookie, nhl_id)')
    .eq('pooler_id', poolerId)
    .eq('pool_season_id', saisonId)
    .eq('is_active', true)

  const currentMap = new Map(
    (current ?? []).map((r: any) => [r.id, r]),
  )

  const removeSet = new Set(toRemove)
  const changeMap = new Map(toChangeType.map(c => [c.entryId, c.newType]))

  type FinalEntry = { player_type: string; position: string | null; is_rookie: boolean }
  const finalEntries: FinalEntry[] = []

  for (const row of (current ?? []) as any[]) {
    if (removeSet.has(row.id)) continue
    finalEntries.push({
      player_type: changeMap.get(row.id) ?? row.player_type,
      position:    row.players?.position ?? null,
      is_rookie:   row.players?.is_rookie ?? false,
    })
  }

  for (const entry of toAdd) {
    const { data: player } = await supabase.from('players').select('position, is_rookie').eq('id', entry.player_id).single()
    if (entry.player_type === 'recrue' && !player?.is_rookie) {
      return { error: `Seuls les joueurs recrues peuvent aller dans la banque de recrues.` }
    }
    finalEntries.push({
      player_type: entry.player_type,
      position:    player?.position ?? null,
      is_rookie:   player?.is_rookie ?? false,
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

  // Application — retraits
  for (const rosterId of toRemove) {
    const row = currentMap.get(rosterId) as any
    if (!row) continue
    const oldType = row.player_type as PlayerType
    const changeType = detectChangeType(oldType, oldType, true)
    await logChange(supabase, row.player_id, poolerId, saisonId, changeType, oldType, null)
    if (oldType === 'actif') {
      await takeSnapshot({
        playerId:     row.player_id,
        nhlId:        row.players?.nhl_id ?? null,
        poolerId,
        poolSeasonId: saisonId,
        snapshotType: 'deactivation',
      })
    }
  }

  if (toRemove.length > 0) {
    const { error } = await supabase
      .from('pooler_rosters')
      .update({ is_active: false, removed_at: new Date().toISOString() })
      .in('id', toRemove)
    if (error) return { error: error.message }
  }

  // Application — changements de type
  for (const { entryId, newType } of toChangeType) {
    const row = currentMap.get(entryId) as any
    const oldType = (row?.player_type ?? null) as PlayerType | null
    const { error } = await supabase.from('pooler_rosters').update({ player_type: newType }).eq('id', entryId)
    if (error) return { error: error.message }

    if (oldType !== newType) {
      const changeType = detectChangeType(oldType, newType)
      await logChange(supabase, row.player_id, poolerId, saisonId, changeType, oldType, newType)
      if (oldType === 'actif' || newType === 'actif') {
        await takeSnapshot({
          playerId:     row.player_id,
          nhlId:        row.players?.nhl_id ?? null,
          poolerId,
          poolSeasonId: saisonId,
          snapshotType: newType === 'actif' ? 'activation' : 'deactivation',
        })
      }
    }
  }

  // Application — ajouts
  for (const entry of toAdd) {
    const rookieFields = entry.rookie_type
      ? { rookie_type: entry.rookie_type, pool_draft_year: entry.rookie_type === 'repeche' ? (entry.pool_draft_year ?? null) : null }
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
        pooler_id:      poolerId,
        player_id:      entry.player_id,
        pool_season_id: saisonId,
        player_type:    entry.player_type,
        is_active:      true,
        ...rookieFields,
      })
      if (error) return { error: error.message }
    }

    const changeType = detectChangeType(null, entry.player_type)
    const { data: player } = await supabase.from('players').select('nhl_id').eq('id', entry.player_id).single()
    await logChange(supabase, entry.player_id, poolerId, saisonId, changeType, null, entry.player_type)

    if (entry.player_type === 'actif') {
      await takeSnapshot({
        playerId:     entry.player_id,
        nhlId:        player?.nhl_id ?? null,
        poolerId,
        poolSeasonId: saisonId,
        snapshotType: 'activation',
      })
    }
  }

  // Notification push de synthèse au pooler
  const totalChanges = toAdd.length + toRemove.length + toChangeType.length
  if (totalChanges > 0) {
    const parts: string[] = []
    if (toAdd.length)        parts.push(`${toAdd.length} ajout${toAdd.length > 1 ? 's' : ''}`)
    if (toRemove.length)     parts.push(`${toRemove.length} retrait${toRemove.length > 1 ? 's' : ''}`)
    if (toChangeType.length) parts.push(`${toChangeType.length} changement${toChangeType.length > 1 ? 's' : ''} de type`)
    sendPushToUser(poolerId, {
      title: 'DB Hockey Manager — Alignement mis à jour',
      body:  `L'admin a modifié votre alignement : ${parts.join(', ')}.`,
      url:   `/poolers/${poolerId}`,
    }).catch(() => {})
  }

  return {}
}
