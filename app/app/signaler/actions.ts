'use server'

import { createClient } from '@/lib/supabase/server'

export async function submitFeedbackAction(
  type: string,
  description: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }

  if (!description.trim()) return { error: 'La description est requise.' }
  if (!['bug', 'suggestion', 'autre'].includes(type)) return { error: 'Type invalide.' }

  const { error } = await supabase.from('feedback').insert({
    pooler_id: user.id,
    type,
    description: description.trim(),
  })

  if (error) return { error: 'Erreur lors de l\'envoi. Réessayez.' }
  return {}
}
