import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MouvementsManager from './MouvementsManager'

export const metadata = { title: 'Mouvements d\'alignement' }
export const dynamic = 'force-dynamic'

export default async function MouvementsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: poolerSelf } = await supabase
    .from('poolers').select('is_admin').eq('id', user.id).single()
  if (!poolerSelf?.is_admin) redirect('/admin')

  const [{ data: poolers }, { data: saison }] = await Promise.all([
    supabase.from('poolers').select('id, name').order('name'),
    supabase.from('pool_seasons').select('id').eq('is_active', true).single(),
  ])

  if (!saison) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Mouvements d&apos;alignement</h1>
        <p className="text-gray-500">Aucune saison active.</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-1">Mouvements d&apos;alignement</h1>
      <p className="text-sm text-gray-500 mb-6">
        Outil orienté action — chaque mouvement est atomique et journalisé avec snapshot.
      </p>
      <MouvementsManager poolers={poolers ?? []} saisonId={saison.id} />
    </div>
  )
}
