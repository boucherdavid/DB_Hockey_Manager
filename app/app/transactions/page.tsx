import { createClient } from '@/lib/supabase/server'
import TransactionsClient from './TransactionsClient'

export default async function TransactionsPage() {
  const supabase = await createClient()

  const { data: saison } = await supabase
    .from('pool_seasons')
    .select('id, season')
    .eq('is_active', true)
    .eq('is_playoff', false)
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

  return <TransactionsClient transactions={(transactions ?? []) as any[]} saison={saison} />
}
