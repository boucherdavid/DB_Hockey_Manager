import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

const DASH = '\u2014'

const typeLabel: Record<string, string> = {
  actif: 'Actif', reserviste: 'Réserviste', ltir: 'LTIR', recrue: 'Recrue',
}

function itemDescription(item: any): string {
  const from = item.from_pooler?.name
  const to = item.to_pooler?.name
  const player = item.players
    ? `${item.players.last_name}, ${item.players.first_name} (${item.players.teams?.code ?? DASH}) ${item.players.position ?? ''}`
    : null
  const oldT = item.old_player_type ? typeLabel[item.old_player_type] ?? item.old_player_type : null
  const newT = item.new_player_type ? typeLabel[item.new_player_type] ?? item.new_player_type : null

  switch (item.action_type) {
    case 'transfer': {
      if (item.pick) {
        const isOwn = item.pick.original_owner?.name === from
        const pickLabel = `Ronde ${item.pick.round} ${item.pick.pool_seasons?.season ?? ''}${!isOwn ? ` (de ${item.pick.original_owner?.name})` : ''}`
        return `${from} donne ${pickLabel} à ${to}`
      }
      return `${from} donne ${player} à ${to}`
    }
    case 'sign':
      return `${to} signe ${player} (${newT})`
    case 'promote':
      return `${to} promeut ${player} → ${newT}`
    case 'reactivate':
      return `${to} réactive ${player} (LTIR → ${newT})`
    case 'release':
      return `${from} libère ${player}`
    case 'type_change':
      return `${from ?? to} : ${player} ${oldT} → ${newT}`
    default:
      return item.action_type
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-CA', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

export default async function TransactionsPage() {
  const supabase = await createClient()

  const { data: saison } = await supabase
    .from('pool_seasons')
    .select('id, season')
    .eq('is_active', true)
    .single()

  if (!saison) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Transactions</h1>
        <p className="text-gray-400">Aucune saison active.</p>
      </div>
    )
  }

  const { data: transactions } = await supabase
    .from('transactions')
    .select(`
      id, notes, created_at,
      transaction_items (
        id, action_type, old_player_type, new_player_type,
        from_pooler:poolers!from_pooler_id (name),
        to_pooler:poolers!to_pooler_id (name),
        players (id, first_name, last_name, position, teams (code)),
        pick:pool_draft_picks!pick_id (round, pool_seasons (season), original_owner:poolers!original_owner_id (name))
      )
    `)
    .eq('pool_season_id', saison.id)
    .order('created_at', { ascending: false })

  const txList = (transactions ?? []) as any[]

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Transactions</h1>
          <p className="text-gray-500 text-sm">Saison {saison.season}</p>
        </div>
      </div>

      {txList.length === 0 && (
        <p className="text-gray-400 text-sm">Aucune transaction cette saison.</p>
      )}

      <div className="space-y-4">
        {txList.map((tx: any) => {
          const transfers = (tx.transaction_items ?? []).filter((i: any) => i.action_type === 'transfer')
          const adjustments = (tx.transaction_items ?? []).filter((i: any) => i.action_type !== 'transfer')
          return (
            <div key={tx.id} className="bg-white rounded-lg shadow p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  {tx.notes && <p className="font-medium text-gray-800">{tx.notes}</p>}
                  <p className="text-xs text-gray-400 mt-0.5">{formatDate(tx.created_at)}</p>
                </div>
                <span className="text-xs text-gray-300">#{tx.id}</span>
              </div>

              {transfers.length > 0 && (
                <div className="mb-2">
                  <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Échanges</p>
                  <ul className="space-y-1">
                    {transfers.map((item: any) => (
                      <li key={item.id} className="text-sm text-gray-700 bg-blue-50 px-3 py-1.5 rounded">
                        {itemDescription(item)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {adjustments.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Ajustements</p>
                  <ul className="space-y-1">
                    {adjustments.map((item: any) => (
                      <li key={item.id} className="text-sm text-gray-700 bg-slate-50 px-3 py-1.5 rounded">
                        {itemDescription(item)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
