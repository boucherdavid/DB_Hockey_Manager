'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function updatePasswordAction(newPassword: string): Promise<{ error?: string }> {
  if (newPassword.length < 6) return { error: 'Le mot de passe doit faire au moins 6 caractères.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) return { error: error.message }
  return {}
}

export async function updateProfileAction(
  phone: string | null,
  notifEmail: boolean,
  notifSms: boolean,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }

  const { error } = await supabase
    .from('poolers')
    .update({
      phone: phone?.trim() || null,
      notif_email: notifEmail,
      notif_sms: notifSms,
    })
    .eq('id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/compte')
  return {}
}

export async function resetPasswordForPoolerAction(poolerId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }

  const { data: me } = await supabase.from('poolers').select('is_admin').eq('id', user.id).single()
  if (!me?.is_admin) return { error: 'Accès refusé.' }

  const admin = createAdminClient()
  const { data: authUser, error: fetchErr } = await admin.auth.admin.getUserById(poolerId)
  if (fetchErr || !authUser?.user?.email) return { error: 'Utilisateur introuvable.' }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('.supabase.co', '.vercel.app') ?? ''
  const { error } = await supabase.auth.resetPasswordForEmail(authUser.user.email, {
    redirectTo: `${siteUrl}/compte`,
  })
  if (error) return { error: error.message }
  return {}
}
