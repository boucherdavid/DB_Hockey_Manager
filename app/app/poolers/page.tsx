import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function PoolersPage() {
  const supabase = await createClient()

  const { data: saison } = await supabase
    .from('pool_seasons')
    .select('*')
    .eq('is_active', true)
    .single()

  const { data: poolers } = await supabase
    .from('poolers')
    .select('id, name')
    .order('name')

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Alignements des poolers</h1>

      {saison && (
        <p className="text-gray-500 text-sm mb-6">
          Saison {saison.season} — Cap:{' '}
          <span className="font-semibold text-blue-700">
            {new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(saison.pool_cap)}
          </span>
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {poolers?.map((p) => (
          <Link
            key={p.id}
            href={`/poolers/${p.id}`}
            className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow flex items-center justify-between group"
          >
            <span className="font-semibold text-gray-800 group-hover:text-blue-700 transition-colors">
              {p.name}
            </span>
            <span className="text-gray-400 group-hover:text-blue-500 text-lg">→</span>
          </Link>
        ))}
        {(!poolers || poolers.length === 0) && (
          <p className="text-gray-400 col-span-3 text-center py-8">Aucun pooler enregistré.</p>
        )}
      </div>
    </div>
  )
}
