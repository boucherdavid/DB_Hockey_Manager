import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/admin'

webpush.setVapidDetails(
  process.env.VAPID_MAILTO!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
)

export type PushPayload = {
  title: string
  body: string
  url?: string
}

async function sendToSubscriptions(
  subs: { id: string; endpoint: string; p256dh: string; auth: string }[],
  payload: PushPayload,
) {
  if (!subs || subs.length === 0) return
  const supabase = createAdminClient()
  const notification = JSON.stringify(payload)

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          notification,
        )
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        }
      }
    }),
  )
}

export async function sendPushToAdmins(payload: PushPayload) {
  const supabase = createAdminClient()

  const { data: adminIds } = await supabase
    .from('poolers')
    .select('id')
    .eq('is_admin', true)

  if (!adminIds || adminIds.length === 0) return

  const ids = adminIds.map(p => p.id)
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .in('user_id', ids)

  await sendToSubscriptions(subs ?? [], payload)
}

export async function sendPushToUser(userId: string, payload: PushPayload) {
  const supabase = createAdminClient()

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId)

  await sendToSubscriptions(subs ?? [], payload)
}

export async function sendPushToAll(payload: PushPayload) {
  const supabase = createAdminClient()

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')

  await sendToSubscriptions(subs ?? [], payload)
}
