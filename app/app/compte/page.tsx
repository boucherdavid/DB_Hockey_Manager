import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CompteForm from './CompteForm'

export const metadata = { title: 'Mon compte' }
export const dynamic = 'force-dynamic'

export default async function ComptePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: pooler } = await supabase
    .from('poolers')
    .select('name, phone, notif_email, notif_sms')
    .eq('id', user.id)
    .single()

  if (!pooler) redirect('/')

  return (
    <CompteForm
      profile={{
        name: pooler.name,
        email: user.email ?? '',
        phone: pooler.phone ?? null,
        notif_email: pooler.notif_email ?? true,
        notif_sms: pooler.notif_sms ?? false,
      }}
    />
  )
}
