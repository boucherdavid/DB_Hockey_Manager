import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const DASH = '\u2014'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: pooler } = await supabase
    .from('poolers')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!pooler?.is_admin) redirect('/')

  const [{ count: nbJoueurs }, { count: nbPoolers }, { data: saison }] = await Promise.all([
    supabase.from('players').select('*', { count: 'exact', head: true }),
    supabase.from('poolers').select('*', { count: 'exact', head: true }),
    supabase.from('pool_seasons').select('*').eq('is_active', true).single(),
  ])

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Panneau Admin</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow p-5 border-l-4 border-blue-500">
          <p className="text-3xl font-bold text-blue-700">{nbJoueurs ?? 0}</p>
          <p className="text-gray-500 text-sm mt-1">Joueurs dans la BD</p>
        </div>
        <div className="bg-white rounded-lg shadow p-5 border-l-4 border-green-500">
          <p className="text-3xl font-bold text-green-700">{nbPoolers ?? 0}</p>
          <p className="text-gray-500 text-sm mt-1">{'Poolers enregistr\u00e9s'}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-5 border-l-4 border-orange-500">
          <p className="text-3xl font-bold text-orange-700">{saison?.season ?? DASH}</p>
          <p className="text-gray-500 text-sm mt-1">Saison active</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/admin/joueurs" className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow group">
          <h2 className="font-bold text-lg text-gray-800 group-hover:text-blue-700">{'Mise \u00e0 jour des donn\u00e9es'}</h2>
          <p className="text-gray-500 text-sm mt-1">{'Proc\u00e9dure officielle pour scraper PuckPedia puis importer les joueurs et contrats'}</p>
        </Link>
        <Link href="/admin/poolers" className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow group">
          <h2 className="font-bold text-lg text-gray-800 group-hover:text-blue-700">Gestion des poolers</h2>
          <p className="text-gray-500 text-sm mt-1">{'Ajouter des poolers et g\u00e9rer leurs alignements'}</p>
        </Link>
        <Link href="/admin/rosters" className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow group">
          <h2 className="font-bold text-lg text-gray-800 group-hover:text-blue-700">Gestion des alignements</h2>
          <p className="text-gray-500 text-sm mt-1">Assigner et retirer des joueurs actifs et reservistes</p>
        </Link>
        <Link href="/admin/recrues" className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow group">
          <h2 className="font-bold text-lg text-gray-800 group-hover:text-emerald-700">Banque de recrues</h2>
          <p className="text-gray-500 text-sm mt-1">{'G\u00e9rer les recrues assign\u00e9es \u00e0 la banque de chaque pooler'}</p>
        </Link>
        <Link href="/admin/repechage" className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow group">
          <h2 className="font-bold text-lg text-gray-800 group-hover:text-blue-700">Repêchage des recrues</h2>
          <p className="text-gray-500 text-sm mt-1">Effectuer le repêchage annuel des recrues et les assigner aux banques</p>
        </Link>
        <Link href="/admin/transactions" className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow group">
          <h2 className="font-bold text-lg text-gray-800 group-hover:text-purple-700">Transactions</h2>
          <p className="text-gray-500 text-sm mt-1">{'Effectuer des \u00e9changes, signatures et ajustements entre poolers'}</p>
        </Link>
        <Link href="/admin/presaison" className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow group">
          <h2 className="font-bold text-lg text-gray-800 group-hover:text-amber-700">Repêchage pré-saison</h2>
          <p className="text-gray-500 text-sm mt-1">Conformité des rosters, ordre de signature et marché d'agents libres</p>
        </Link>
        <Link href="/admin/config" className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow group">
          <h2 className="font-bold text-lg text-gray-800 group-hover:text-gray-600">Configuration du pool</h2>
          <p className="text-gray-500 text-sm mt-1">{'Modifier le cap NHL et les param\u00e8tres de la saison active'}</p>
        </Link>
        <Link href="/admin/series" className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow group">
          <h2 className="font-bold text-lg text-gray-800 group-hover:text-indigo-700">Pool des séries</h2>
          <p className="text-gray-500 text-sm mt-1">{'Cr\u00e9er et g\u00e9rer la saison playoffs, avancer les rondes'}</p>
        </Link>
        <Link href="/admin/feedback" className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow group">
          <h2 className="font-bold text-lg text-gray-800 group-hover:text-teal-700">Retours des poolers</h2>
          <p className="text-gray-500 text-sm mt-1">Consulter et exporter les problèmes et suggestions soumis par les poolers</p>
        </Link>
        <Link href="/admin/suivi" className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow group">
          <h2 className="font-bold text-lg text-gray-800 group-hover:text-rose-700">Suivi de l&apos;activité</h2>
          <p className="text-gray-500 text-sm mt-1">Fil chronologique de tous les changements : alignements, transactions et picks séries</p>
        </Link>
      </div>
    </div>
  )
}