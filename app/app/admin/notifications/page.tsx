'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

async function markAllReadAction() {
  'use server'
  const db = createAdminClient()
  await db.from('notification_log').update({ read_at: new Date().toISOString() }).is('read_at', null)
  revalidatePath('/admin/notifications')
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('fr-CA', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Toronto',
  })
}

export default async function NotificationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: pooler } = await supabase.from('poolers').select('is_admin').eq('id', user.id).single()
  if (!pooler?.is_admin) redirect('/')

  const db = createAdminClient()
  const { data: notifications } = await db
    .from('notification_log')
    .select('id, title, body, url, sent_at, read_at')
    .order('sent_at', { ascending: false })
    .limit(100)

  const unread = (notifications ?? []).filter(n => !n.read_at).length

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Notifications</h1>
          {unread > 0 && (
            <p className="text-sm text-gray-500 mt-0.5">{unread} non lue{unread > 1 ? 's' : ''}</p>
          )}
        </div>
        {unread > 0 && (
          <form action={markAllReadAction}>
            <button
              type="submit"
              className="text-sm text-blue-600 hover:underline"
            >
              Tout marquer comme lu
            </button>
          </form>
        )}
      </div>

      {(!notifications || notifications.length === 0) ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-400 text-sm">
          Aucune notification pour l&apos;instant.
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => (
            <div
              key={n.id}
              className={`bg-white rounded-lg shadow px-4 py-3 flex items-start gap-3 ${!n.read_at ? 'border-l-4 border-blue-500' : 'border-l-4 border-transparent'}`}
            >
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${n.read_at ? 'text-gray-600' : 'text-gray-900'}`}>
                  {n.title}
                </p>
                <p className="text-sm text-gray-500 mt-0.5">{n.body}</p>
                <p className="text-xs text-gray-400 mt-1">{formatDate(n.sent_at)}</p>
              </div>
              {n.url && (
                <Link
                  href={n.url}
                  className="shrink-0 text-xs text-blue-600 hover:underline mt-0.5"
                >
                  Voir →
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
