import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: saison }, { data: poolers }, { data: me }] = await Promise.all([
    supabase.from('pool_seasons').select('*').eq('is_active', true).single(),
    supabase.from('poolers').select('id, name').order('name'),
    user
      ? supabase.from('poolers').select('name').eq('id', user.id).single()
      : Promise.resolve({ data: null }),
  ])

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">
          {me ? <>Bienvenue {me.name} sur DB Hockey Manager</> : 'DB Hockey Manager'}
        </h1>
        {saison && (
          <p className="text-gray-500 mt-1">
            Saison {saison.season} — Cap pool:{' '}
            <span className="font-semibold text-blue-700">
              {new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(saison.pool_cap)}
            </span>
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Link href="/joueurs" className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow border-l-4 border-blue-500">
          <h2 className="font-bold text-lg text-gray-800">Joueurs LNH</h2>
          <p className="text-gray-500 text-sm mt-1">Consulter les salaires et disponibilités</p>
        </Link>
        <Link href="/poolers" className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow border-l-4 border-green-500">
          <h2 className="font-bold text-lg text-gray-800">Alignements</h2>
          <p className="text-gray-500 text-sm mt-1">Voir les équipes des poolers</p>
        </Link>
        <Link href="/dashboard" className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow border-l-4 border-orange-500">
          <h2 className="font-bold text-lg text-gray-800">Mon équipe</h2>
          <p className="text-gray-500 text-sm mt-1">Gérer mon alignement</p>
        </Link>
      </div>

      {poolers && poolers.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="font-bold text-lg text-gray-800 mb-4">Poolers</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {poolers.map((p) => (
              <Link
                key={p.id}
                href={`/poolers/${p.id}`}
                className="text-center py-3 px-4 bg-gray-50 rounded-lg hover:bg-blue-50 hover:text-blue-700 transition-colors text-sm font-medium"
              >
                {p.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
