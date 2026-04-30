'use server'

import { createClient } from '@/lib/supabase/server'
import { takeSnapshot } from '@/lib/snapshot'

export type ActionType = 'transfer' | 'promote' | 'sign' | 'reactivate' | 'release' | 'type_change' | 'ballotage'

export type TxItemPayload = {
  action_type: ActionType
  from_pooler_id?: string
  to_pooler_id?: string
  player_id?: number
  pick_id?: number
  old_player_type?: string
  new_player_type?: string
}

type VEntry = {
  roster_id: number
  player_id: number
  player_type: string
  position: string | null
  cap_number: number
  nhl_id: number | null
}

type SnapshotTask = {
  playerId: number
  nhlId: number | null
  poolerId: string
  snapshotType: 'activation' | 'deactivation'
}

function getPlayerBucket(position: string | null): 'forward' | 'defense' | 'goalie' {
  const pos = (position ?? '').toUpperCase()
  if (pos.includes('G')) return 'goalie'
  if (pos.includes('D')) return 'defense'
  return 'forward'
}

const ACTIVE_LIMITS = { forward: 12, defense: 6, goalie: 2 }

function validateFinalRoster(entries: VEntry[], poolCap: number): string | null {
  const actifs = entries.filter(e => e.player_type === 'actif')
  const reservistes = entries.filter(e => e.player_type === 'reserviste')

  const counts = actifs.reduce((acc, e) => {
    acc[getPlayerBucket(e.position)] += 1
    return acc
  }, { forward: 0, defense: 0, goalie: 0 })

  if (counts.forward > ACTIVE_LIMITS.forward) return `Trop d'attaquants actifs (${counts.forward} / ${ACTIVE_LIMITS.forward})`
  if (counts.defense > ACTIVE_LIMITS.defense) return `Trop de défenseurs actifs (${counts.defense} / ${ACTIVE_LIMITS.defense})`
  if (counts.goalie > ACTIVE_LIMITS.goalie) return `Trop de gardiens actifs (${counts.goalie} / ${ACTIVE_LIMITS.goalie})`
  if (reservistes.length < 2) return `Minimum 2 réservistes requis (${reservistes.length})`

  const cap = [...actifs, ...reservistes].reduce((sum, e) => sum + e.cap_number, 0)
  if (cap > poolCap) return `Cap dépassé (${new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cap)} / ${new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(poolCap)})`

  return null
}

export async function loadRosterAction(poolerId: string, saisonId: number) {
  const supabase = await createClient()
  const [{ data: rosterData }, { data: picksData }] = await Promise.all([
    supabase
      .from('pooler_rosters')
      .select(`id, player_id, player_type, players (id, first_name, last_name, position, status, is_rookie, teams (code), player_contracts (season, cap_number))`)
      .eq('pooler_id', poolerId)
      .eq('pool_season_id', saisonId)
      .eq('is_active', true)
      .order('player_type'),
    supabase
      .from('pool_draft_picks')
      .select(`id, round, pool_season_id, pool_seasons (season), original_owner:poolers!original_owner_id (id, name)`)
      .eq('current_owner_id', poolerId)
      .eq('is_used', false)
      .order('pool_season_id')
      .order('round'),
  ])
  return { roster: (rosterData ?? []) as any[], picks: (picksData ?? []) as any[] }
}

export async function searchFreeAgentsAction(saisonId: number, query: string): Promise<{ players: any[] }> {
  if (query.trim().length < 2) return { players: [] }
  const supabase = await createClient()

  const { data: onRoster } = await supabase
    .from('pooler_rosters')
    .select('player_id')
    .eq('pool_season_id', saisonId)
    .eq('is_active', true)

  const takenIds = (onRoster ?? []).map((r: any) => r.player_id)
  const q = query.trim()

  let dbQuery = supabase
    .from('players')
    .select(`id, first_name, last_name, position, status, teams (code), player_contracts (season, cap_number)`)
    .or(`last_name.ilike.%${q}%,first_name.ilike.%${q}%`)
    .limit(15)

  if (takenIds.length > 0) {
    dbQuery = dbQuery.not('id', 'in', `(${takenIds.join(',')})`)
  }

  const { data } = await dbQuery
  return { players: (data ?? []) as any[] }
}

export async function submitTransactionAction(
  saisonId: number,
  notes: string,
  items: TxItemPayload[],
  transactionDate?: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }
  const { data: me } = await supabase.from('poolers').select('is_admin').eq('id', user.id).single()
  if (!me?.is_admin) return { error: 'Accès refusé.' }
  if (items.length === 0) return { error: 'La transaction est vide.' }

  const { data: saison } = await supabase.from('pool_seasons').select('season, pool_cap').eq('id', saisonId).single()
  if (!saison) return { error: 'Saison introuvable.' }

  // Poolers affectés
  const affectedIds = new Set<string>()
  for (const item of items) {
    if (item.from_pooler_id) affectedIds.add(item.from_pooler_id)
    if (item.to_pooler_id) affectedIds.add(item.to_pooler_id)
  }

  // Charger les rosters
  const { data: allRosters } = await supabase
    .from('pooler_rosters')
    .select(`id, pooler_id, player_id, player_type, players (id, position, nhl_id, player_contracts (season, cap_number))`)
    .in('pooler_id', Array.from(affectedIds))
    .eq('pool_season_id', saisonId)
    .eq('is_active', true)

  // Construire les rosters virtuels
  const virtual = new Map<string, VEntry[]>()
  for (const id of affectedIds) virtual.set(id, [])

  for (const entry of (allRosters ?? []) as any[]) {
    const cap = entry.players?.player_contracts?.find((c: any) => c.season === saison.season)?.cap_number ?? 0
    virtual.get(entry.pooler_id)!.push({
      roster_id: entry.id,
      player_id: entry.player_id,
      player_type: entry.player_type,
      position: entry.players?.position ?? null,
      cap_number: cap,
      nhl_id: entry.players?.nhl_id ?? null,
    })
  }

  // Charger les picks pour validation
  const pickIds = items.filter(i => i.pick_id).map(i => i.pick_id!)
  const pickMap = new Map<number, any>()
  if (pickIds.length > 0) {
    const { data: picks } = await supabase.from('pool_draft_picks').select('id, current_owner_id, is_used').in('id', pickIds)
    for (const p of (picks ?? [])) pickMap.set(p.id, p)
  }

  // Charger les joueurs signés (sign) pour cap + snapshot
  const signPlayerIds = items.filter(i => i.action_type === 'sign' && i.player_id).map(i => i.player_id!)
  const signPlayerMap = new Map<number, any>()
  if (signPlayerIds.length > 0) {
    const { data: sPlayers } = await supabase
      .from('players')
      .select(`id, position, nhl_id, player_contracts (season, cap_number)`)
      .in('id', signPlayerIds)
    for (const p of (sPlayers ?? [])) signPlayerMap.set(p.id, p)
  }

  // Vérifier qu'aucun joueur signé n'est déjà actif dans la saison (unicité métier)
  if (signPlayerIds.length > 0) {
    const { data: alreadyActive } = await supabase
      .from('pooler_rosters')
      .select('player_id')
      .in('player_id', signPlayerIds)
      .eq('pool_season_id', saisonId)
      .eq('is_active', true)
    if (alreadyActive && alreadyActive.length > 0) {
      const pid = (alreadyActive[0] as any).player_id
      const sp = signPlayerMap.get(pid)
      const name = sp ? `${sp.first_name ?? ''} ${sp.last_name ?? ''}`.trim() : `id: ${pid}`
      return { error: `${name} est déjà actif dans un roster cette saison.` }
    }
  }

  // Valider préconditions, simuler et collecter les snapshots nécessaires
  const snapshotTasks: SnapshotTask[] = []

  for (const item of items) {
    const { action_type, from_pooler_id, to_pooler_id, player_id, pick_id, old_player_type, new_player_type } = item

    if (action_type === 'transfer' && pick_id) {
      const pick = pickMap.get(pick_id)
      if (!pick) return { error: `Choix introuvable (id: ${pick_id}).` }
      if (pick.is_used) return { error: `Ce choix a déjà été utilisé.` }
      if (pick.current_owner_id !== from_pooler_id) return { error: `Ce choix n'appartient pas au pooler source.` }
      continue
    }

    if ((action_type === 'transfer' || action_type === 'ballotage') && player_id) {
      const fromRoster = virtual.get(from_pooler_id!)
      const entry = fromRoster?.find(e => e.player_id === player_id)
      if (!entry) return { error: `Joueur (id: ${player_id}) introuvable dans le roster source.` }
      const destType = new_player_type ?? entry.player_type
      if (entry.player_type === 'actif')
        snapshotTasks.push({ playerId: player_id, nhlId: entry.nhl_id, poolerId: from_pooler_id!, snapshotType: 'deactivation' })
      if (destType === 'actif')
        snapshotTasks.push({ playerId: player_id, nhlId: entry.nhl_id, poolerId: to_pooler_id!, snapshotType: 'activation' })
      fromRoster!.splice(fromRoster!.indexOf(entry), 1)
      virtual.get(to_pooler_id!)!.push({ roster_id: -1, player_id, player_type: destType, position: entry.position, cap_number: entry.cap_number, nhl_id: entry.nhl_id })
      continue
    }

    if (action_type === 'promote') {
      const roster = virtual.get(to_pooler_id!)!
      const entry = roster.find(e => e.player_id === player_id && e.player_type === 'recrue')
      if (!entry) return { error: `Recrue (id: ${player_id}) introuvable dans la banque.` }
      if (new_player_type === 'actif')
        snapshotTasks.push({ playerId: player_id!, nhlId: entry.nhl_id, poolerId: to_pooler_id!, snapshotType: 'activation' })
      entry.player_type = new_player_type!
      continue
    }

    if (action_type === 'sign') {
      const p = signPlayerMap.get(player_id!)
      if (!p) return { error: `Joueur (id: ${player_id}) introuvable.` }
      const cap = p.player_contracts?.find((c: any) => c.season === saison.season)?.cap_number ?? 0
      if (new_player_type === 'actif')
        snapshotTasks.push({ playerId: player_id!, nhlId: p.nhl_id ?? null, poolerId: to_pooler_id!, snapshotType: 'activation' })
      virtual.get(to_pooler_id!)!.push({ roster_id: -1, player_id: player_id!, player_type: new_player_type!, position: p.position, cap_number: cap, nhl_id: p.nhl_id ?? null })
      continue
    }

    if (action_type === 'reactivate') {
      const roster = virtual.get(to_pooler_id!)!
      const entry = roster.find(e => e.player_id === player_id && e.player_type === 'ltir')
      if (!entry) return { error: `Joueur (id: ${player_id}) non trouvé en LTIR.` }
      if (new_player_type === 'actif')
        snapshotTasks.push({ playerId: player_id!, nhlId: entry.nhl_id, poolerId: to_pooler_id!, snapshotType: 'activation' })
      entry.player_type = new_player_type!
      continue
    }

    if (action_type === 'release') {
      const roster = virtual.get(from_pooler_id!)!
      const entry = roster.find(e => e.player_id === player_id)
      if (!entry) return { error: `Joueur (id: ${player_id}) introuvable dans le roster.` }
      if (entry.player_type === 'actif')
        snapshotTasks.push({ playerId: player_id!, nhlId: entry.nhl_id, poolerId: from_pooler_id!, snapshotType: 'deactivation' })
      roster.splice(roster.indexOf(entry), 1)
      continue
    }

    if (action_type === 'type_change') {
      const roster = virtual.get(from_pooler_id!)!
      const entry = roster.find(e => e.player_id === player_id && e.player_type === old_player_type)
      if (!entry) return { error: `Joueur (id: ${player_id}) avec type "${old_player_type}" introuvable.` }
      const poolerId = from_pooler_id!
      if (old_player_type === 'actif')
        snapshotTasks.push({ playerId: player_id!, nhlId: entry.nhl_id, poolerId, snapshotType: 'deactivation' })
      if (new_player_type === 'actif')
        snapshotTasks.push({ playerId: player_id!, nhlId: entry.nhl_id, poolerId, snapshotType: 'activation' })
      entry.player_type = new_player_type!
      continue
    }
  }

  // Valider état final
  for (const [poolerId, entries] of virtual) {
    const err = validateFinalRoster(entries, saison.pool_cap)
    if (err) {
      const { data: p } = await supabase.from('poolers').select('name').eq('id', poolerId).single()
      return { error: `${p?.name ?? poolerId}: ${err}` }
    }
  }

  // Enregistrer la transaction avant d'appliquer les mutations.
  // Ainsi, si une mutation échoue à mi-chemin, l'intent est toujours tracé
  // et un admin peut identifier et corriger l'état partiel.
  // (Une atomicité complète nécessiterait une fonction PostgreSQL via rpc().)
  const txPayload: Record<string, unknown> = { pool_season_id: saisonId, notes: notes || null, created_by: user.id }
  if (transactionDate) txPayload.created_at = `${transactionDate}T12:00:00Z`

  const { data: tx, error: txErr } = await supabase
    .from('transactions')
    .insert(txPayload)
    .select('id')
    .single()
  if (txErr) return { error: txErr.message }

  const txItems = items.map(item => ({
    transaction_id: tx.id,
    action_type: item.action_type,
    from_pooler_id: item.from_pooler_id ?? null,
    to_pooler_id: item.to_pooler_id ?? null,
    player_id: item.player_id ?? null,
    pick_id: item.pick_id ?? null,
    old_player_type: item.old_player_type ?? null,
    new_player_type: item.new_player_type ?? null,
  }))
  const { error: itemsErr } = await supabase.from('transaction_items').insert(txItems)
  if (itemsErr) return { error: itemsErr.message }

  // Appliquer
  for (const item of items) {
    const { action_type, from_pooler_id, to_pooler_id, player_id, pick_id, old_player_type, new_player_type } = item

    if (action_type === 'transfer' && pick_id) {
      const { error } = await supabase.from('pool_draft_picks').update({ current_owner_id: to_pooler_id }).eq('id', pick_id)
      if (error) return { error: error.message }
      continue
    }

    if ((action_type === 'transfer' || action_type === 'ballotage') && player_id) {
      // Retirer du roster source
      const { error: e1 } = await supabase
        .from('pooler_rosters')
        .update({ is_active: false, removed_at: new Date().toISOString() })
        .eq('pooler_id', from_pooler_id!)
        .eq('player_id', player_id)
        .eq('pool_season_id', saisonId)
        .eq('is_active', true)
      if (e1) return { error: e1.message }
      // Ajouter au roster dest
      const { data: existingDest } = await supabase.from('pooler_rosters').select('id').eq('pooler_id', to_pooler_id!).eq('player_id', player_id).eq('pool_season_id', saisonId).maybeSingle()
      if (existingDest) {
        const { error: e2 } = await supabase.from('pooler_rosters').update({ is_active: true, player_type: new_player_type ?? 'actif', removed_at: null }).eq('id', existingDest.id)
        if (e2) return { error: e2.message }
      } else {
        const { error: e2 } = await supabase.from('pooler_rosters').insert({ pooler_id: to_pooler_id, player_id, pool_season_id: saisonId, player_type: new_player_type ?? 'actif', is_active: true })
        if (e2) return { error: e2.message }
      }
      continue
    }

    if (action_type === 'promote' || action_type === 'reactivate' || action_type === 'type_change') {
      const matchType = action_type === 'type_change' ? old_player_type : action_type === 'promote' ? 'recrue' : 'ltir'
      const poolerId = to_pooler_id ?? from_pooler_id!
      const { error } = await supabase
        .from('pooler_rosters')
        .update({ player_type: new_player_type })
        .eq('pooler_id', poolerId)
        .eq('player_id', player_id!)
        .eq('pool_season_id', saisonId)
        .eq('player_type', matchType!)
        .eq('is_active', true)
      if (error) return { error: error.message }
      continue
    }

    if (action_type === 'sign') {
      const { data: existing } = await supabase.from('pooler_rosters').select('id').eq('pooler_id', to_pooler_id!).eq('player_id', player_id!).eq('pool_season_id', saisonId).maybeSingle()
      if (existing) {
        const { error } = await supabase.from('pooler_rosters').update({ is_active: true, player_type: new_player_type!, removed_at: null }).eq('id', existing.id)
        if (error) return { error: error.message }
      } else {
        const { error } = await supabase.from('pooler_rosters').insert({ pooler_id: to_pooler_id, player_id, pool_season_id: saisonId, player_type: new_player_type, is_active: true })
        if (error) return { error: error.message }
      }
      continue
    }

    if (action_type === 'release') {
      const { error } = await supabase
        .from('pooler_rosters')
        .update({ is_active: false, removed_at: new Date().toISOString() })
        .eq('pooler_id', from_pooler_id!)
        .eq('player_id', player_id!)
        .eq('pool_season_id', saisonId)
        .eq('is_active', true)
      if (error) return { error: error.message }
      continue
    }
  }

  // Snapshots fire-and-forget — ne bloquent pas la réponse
  if (snapshotTasks.length > 0) {
    Promise.all(snapshotTasks.map(t => takeSnapshot({
      playerId:     t.playerId,
      nhlId:        t.nhlId,
      poolerId:     t.poolerId,
      poolSeasonId: saisonId,
      snapshotType: t.snapshotType,
    }))).catch(() => {})
  }

  return {}
}
