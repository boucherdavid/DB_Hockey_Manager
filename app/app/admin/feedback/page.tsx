import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import FeedbackAdminView from './FeedbackAdminView'

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

  return (
    <div>
      <Link href="/admin" className="text-sm text-gray-400 hover:text-gray-600">← Admin</Link>
      <div className="flex items-center justify-between mt-1 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Retours des poolers</h1>
          <p className="text-gray-500 text-sm">{feedbacks?.length ?? 0} retour(s) reçu(s)</p>
        </div>
      </div>
      <FeedbackAdminView feedbacks={feedbacks ?? []} />
    </div>
  )
}
