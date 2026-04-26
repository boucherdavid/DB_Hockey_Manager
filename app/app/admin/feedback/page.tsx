import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import FeedbackAdminView from './FeedbackAdminView'

export const metadata = { title: 'Boîte de réception — Admin' }
export const dynamic = 'force-dynamic'

export default async function FeedbackAdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: pooler } = await supabase.from('poolers').select('is_admin').eq('id', user.id).single()
  if (!pooler?.is_admin) redirect('/')

  const { data: feedbacks } = await supabase
    .from('feedback')
    .select('id, type, description, created_at, status, poolers(name)')
    .order('created_at', { ascending: false })

  const all = feedbacks ?? []
  const counts = {
    nouveau: all.filter(f => f.status === 'nouveau').length,
    traité:  all.filter(f => f.status === 'traité').length,
    archivé: all.filter(f => f.status === 'archivé').length,
  }

  return (
    <div>
      <Link href="/admin" className="text-sm text-gray-400 hover:text-gray-600">← Admin</Link>
      <div className="flex items-center justify-between mt-1 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Boîte de réception</h1>
          <p className="text-gray-500 text-sm">
            {counts.nouveau > 0
              ? `${counts.nouveau} nouveau${counts.nouveau > 1 ? 'x' : ''} · ${all.length} au total`
              : `${all.length} message${all.length > 1 ? 's' : ''} au total`}
          </p>
        </div>
      </div>
      <FeedbackAdminView feedbacks={all} counts={counts} />
    </div>
  )
}
