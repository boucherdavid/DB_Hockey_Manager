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

export async function sendPushToAdmins(payload: PushPayload) {
  const supabase = createAdminClient()

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')

  if (!subs || subs.length === 0) return

  const notification = JSON.stringify(payload)

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          notification,
        )
      } catch (err: unknown) {
        // Abonnement expiré ou révoqué — on le supprime
        const status = (err as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        }
      }
    }),
  )
}
