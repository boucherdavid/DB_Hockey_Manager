'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function deleteEventAction(eventId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  const { data: me } = await supabase.from('poolers').select('is_admin').eq('id', user.id).single()
  if (!me?.is_admin) return { error: 'Accès refusé' }

  const db = createAdminClient()

  if (eventId.startsWith('r-')) {
    const id = parseInt(eventId.slice(2))
    if (isNaN(id)) return { error: 'ID invalide' }
    const { error } = await db.from('roster_change_log').delete().eq('id', id)
    if (error) return { error: error.message }
  } else if (eventId.startsWith('t-')) {
    const id = parseInt(eventId.slice(2))
    if (isNaN(id)) return { error: 'ID invalide' }
    const { error: e1 } = await db.from('transaction_items').delete().eq('transaction_id', id)
    if (e1) return { error: e1.message }
    const { error: e2 } = await db.from('transactions').delete().eq('id', id)
    if (e2) return { error: e2.message }
  } else {
    return { error: 'Type inconnu' }
  }

  revalidatePath('/admin/suivi')
  return {}
}
