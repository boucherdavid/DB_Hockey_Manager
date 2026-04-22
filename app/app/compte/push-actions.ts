'use server'

import { createClient } from '@/lib/supabase/server'

export async function subscribePushAction(subscription: {
  endpoint: string
  keys: { p256dh: string; auth: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non connecté' }

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
    { onConflict: 'user_id,endpoint' },
  )
  if (error) return { error: error.message }
  return {}
}

export async function unsubscribePushAction(endpoint: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non connecté' }

  await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', user.id)
    .eq('endpoint', endpoint)

  return {}
}

export async function getSubscriptionStatusAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { subscribed: false }

  const { data } = await supabase
    .from('push_subscriptions')
    .select('endpoint')
    .eq('user_id', user.id)

  return { subscribed: (data?.length ?? 0) > 0 }
}
