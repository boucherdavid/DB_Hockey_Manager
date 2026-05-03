import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PresaisonManager from './PresaisonManager'

export default async function PresaisonPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: me } = await supabase.from('poolers').select('is_admin').eq('id', user.id).single()
  if (!me?.is_admin) redirect('/')

  const { data: saisons } = await supabase
    .from('pool_seasons')
    .select('id, season, is_active')
    .eq('is_playoff', false)
    .order('season', { ascending: false })

  const list = (saisons ?? []) as { id: number; season: string; is_active: boolean }[]
  const defaultId = list.find(s => s.is_active)?.id ?? list[0]?.id ?? null

  if (!defaultId) {
    return (
      <div className="max-w-5xl mx-auto py-8 px-4">
        <p className="text-gray-500">Aucune saison disponible.</p>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Repêchage pré-saison</h1>
      <PresaisonManager saisons={list} defaultSaisonId={defaultId} />
    </div>
  )
}
