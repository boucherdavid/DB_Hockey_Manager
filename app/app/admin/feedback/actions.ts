'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function ensureAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.', supabase: null }
  const { data: me } = await supabase.from('poolers').select('is_admin').eq('id', user.id).single()
  if (!me?.is_admin) return { error: 'Accès refusé.', supabase: null }
  return { error: null, supabase }
}

export async function updateFeedbackStatusAction(
  id: number,
  status: 'nouveau' | 'traité' | 'archivé',
): Promise<{ error?: string }> {
  const { error: authError, supabase } = await ensureAdmin()
  if (authError || !supabase) return { error: authError ?? 'Erreur.' }

  const { error } = await supabase.from('feedback').update({ status }).eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/admin/feedback')
  return {}
}

export async function deleteFeedbackAction(id: number): Promise<{ error?: string }> {
  const { error: authError, supabase } = await ensureAdmin()
  if (authError || !supabase) return { error: authError ?? 'Erreur.' }

  const { error } = await supabase.from('feedback').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/admin/feedback')
  return {}
}
