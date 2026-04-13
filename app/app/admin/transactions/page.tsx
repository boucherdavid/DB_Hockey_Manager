import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import TransactionBuilder from './TransactionBuilder'

export default async function TransactionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: pooler } = await supabase.from('poolers').select('is_admin').eq('id', user.id).single()
  if (!pooler?.is_admin) redirect('/')

  const { data: saison } = await supabase.from('pool_seasons').select('id, season, pool_cap').eq('is_active', true).single()
  const { data: poolers } = await supabase.from('poolers').select('id, name').order('name')

  if (!saison) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Transactions</h1>
        <p className="text-gray-400">Aucune saison active.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/admin" className="text-sm text-gray-400 hover:text-gray-600">← Admin</Link>
          <h1 className="text-2xl font-bold text-gray-800 mt-1">Transactions</h1>
          <p className="text-gray-500 text-sm">Saison {saison.season}</p>
        </div>
      </div>
      <TransactionBuilder poolers={poolers ?? []} saison={saison} />
    </div>
  )
}
