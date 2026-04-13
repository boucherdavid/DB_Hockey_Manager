import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import PoolerActions from './PoolerActions'
import AddPoolerForm from './AddPoolerForm'

const DASH = '\u2014'

const normalizePlayerType = (playerType: string) => {
  if (playerType === 'agent_libre') return 'reserviste'
  return playerType
}

export default async function AdminPoolersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: pooler } = await supabase.from('poolers').select('is_admin').eq('id', user.id).single()
  if (!pooler?.is_admin) redirect('/')

  const { data: saison } = await supabase.from('pool_seasons').select('*').eq('is_active', true).single()

  const { data: poolers } = await supabase
    .from('poolers')
    .select(`
      id, name, is_admin,
      pooler_rosters(id, player_type, is_active, pool_season_id,
        players(player_contracts(season, cap_number))
      )
    `)
    .order('name')

  const formatCap = (amount: number) =>
    new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/admin" className="text-sm text-gray-400 hover:text-gray-600">{'\u2190 Admin'}</Link>
          <h1 className="text-2xl font-bold text-gray-800 mt-1">Poolers</h1>
        </div>
      </div>

      <AddPoolerForm />

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Nom</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Admin</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Actifs</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Reservistes</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Cap comptabilise</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {poolers?.map((poolerRow) => {
              const rosters = (poolerRow.pooler_rosters as any[])
                ?.filter((row) => row.is_active && row.pool_season_id === saison?.id)
                .map((row) => ({ ...row, player_type: normalizePlayerType(row.player_type) })) ?? []

              const actifs = rosters.filter((row) => row.player_type === 'actif')
              const reservistes = rosters.filter((row) => row.player_type === 'reserviste')
              const capTotal = [...actifs, ...reservistes].reduce((sum: number, row: any) => {
                const contract = row.players?.player_contracts?.find((contract: any) => contract.season === saison?.season)
                return sum + (contract?.cap_number ?? 0)
              }, 0)

              return (
                <tr key={poolerRow.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{poolerRow.name}</td>
                  <td className="px-4 py-3 text-center">
                    {poolerRow.is_admin && <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded">Admin</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">{actifs.length}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{reservistes.length}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{capTotal > 0 ? formatCap(capTotal) : DASH}</td>
                  <td className="px-4 py-3 text-center">
                    <PoolerActions poolerId={poolerRow.id} poolerName={poolerRow.name} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}