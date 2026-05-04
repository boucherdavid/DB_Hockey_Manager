import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SuiviTable from './SuiviTable'
import type { Event } from './SuiviTable'

export const metadata = { title: 'Suivi — Admin' }
export const dynamic = 'force-dynamic'

const CHANGE_LABEL: Record<string, string> = {
  activation:           'Activation',
  deactivation:         'Désactivation',
  ajout_reserviste:     'Ajout réserviste',
  ajout_recrue:         'Ajout recrue',
  retrait:              'Retrait',
  ltir:                 'Mise sur LTIR',
  retour_ltir:          'Retour de LTIR',
  changement_type:      'Changement de type',
  signature_agent_libre:'Signature agent libre',
}

const CHANGE_COLOR: Record<string, string> = {
  activation:           'bg-green-100 text-green-800',
  deactivation:         'bg-orange-100 text-orange-800',
  ajout_reserviste:     'bg-blue-100 text-blue-800',
  ajout_recrue:         'bg-purple-100 text-purple-800',
  retrait:              'bg-red-100 text-red-800',
  ltir:                 'bg-yellow-100 text-yellow-800',
  retour_ltir:          'bg-teal-100 text-teal-800',
  changement_type:      'bg-gray-100 text-gray-800',
  signature_agent_libre:'bg-indigo-100 text-indigo-800',
}


export default async function AdminSuiviPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: me } = await supabase.from('poolers').select('is_admin').eq('id', user.id).single()
  if (!me?.is_admin) redirect('/')

  const [{ data: rosterChanges }, { data: transactions }] = await Promise.all([
    // Changements d'alignement (saison régulière)
    supabase
      .from('roster_change_log')
      .select('id, change_type, old_type, new_type, changed_at, players (first_name, last_name), poolers!roster_change_log_pooler_id_fkey (name)')
      .order('changed_at', { ascending: false })
      .limit(100),

    // Transactions inter-poolers
    supabase
      .from('transactions')
      .select('id, notes, created_at, poolers!transactions_created_by_fkey (name)')
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  const events: Event[] = []

  // Changements roster
  for (const r of rosterChanges ?? []) {
    const player = r.players as unknown as { first_name: string; last_name: string } | null
    const pooler = (r as any).poolers as { name: string } | null
    const label = CHANGE_LABEL[r.change_type] ?? r.change_type
    const color = CHANGE_COLOR[r.change_type] ?? 'bg-gray-100 text-gray-700'
    const playerName = player ? `${player.last_name}, ${player.first_name}` : '—'
    const detail = r.old_type && r.new_type
      ? `${playerName} (${r.old_type} → ${r.new_type})`
      : playerName
    events.push({
      id:         `r-${r.id}`,
      at:         r.changed_at,
      category:   'roster',
      poolerName: pooler?.name ?? '?',
      label,
      detail,
      color,
    })
  }

  // Transactions
  for (const t of transactions ?? []) {
    const pooler = (t as any).poolers as { name: string } | null
    events.push({
      id:         `t-${t.id}`,
      at:         t.created_at,
      category:   'transaction',
      poolerName: pooler?.name ?? 'Admin',
      label:      'Transaction',
      detail:     t.notes ?? '(sans notes)',
      color:      'bg-slate-100 text-slate-800',
    })
  }

  events.sort((a, b) => b.at.localeCompare(a.at))

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Suivi de l&apos;activité</h1>
      <SuiviTable events={events} />
    </div>
  )
}
