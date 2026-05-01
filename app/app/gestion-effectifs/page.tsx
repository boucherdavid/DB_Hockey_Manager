import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import GestionEffectifsManager from './GestionEffectifsManager'

export const metadata = { title: 'Gestion d\'effectifs' }
export const dynamic = 'force-dynamic'

export default async function GestionEffectifsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: pooler }, { data: saison }] = await Promise.all([
    supabase.from('poolers').select('id, name, is_admin').eq('id', user.id).single(),
    supabase.from('pool_seasons')
      .select('id, season, pool_cap, delai_reactivation_jours, max_signatures_al, max_signatures_ltir')
      .eq('is_active', true).single(),
  ])

  if (!pooler) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <p className="text-gray-500">Votre compte n&apos;est pas lié à un pooler.</p>
      </div>
    )
  }

  if (!saison) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Gestion d&apos;effectifs</h1>
        <p className="text-gray-500">Aucune saison active.</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-1">Gestion d&apos;effectifs</h1>
      <p className="text-sm text-gray-500 mb-6">
        Ajoutez une ou plusieurs actions, vérifiez l&apos;état projeté, puis soumettez en une seule opération.
      </p>
      <GestionEffectifsManager
        isAdmin={false}
        selfPoolerId={pooler.id}
        selfPoolerName={pooler.name}
        saisonId={saison.id}
        season={saison.season}
        poolCap={Number(saison.pool_cap)}
        delaiReactivationJours={saison.delai_reactivation_jours ?? 7}
        maxSignaturesAl={saison.max_signatures_al ?? 10}
        maxSignaturesLtir={saison.max_signatures_ltir ?? 2}
      />
    </div>
  )
}
