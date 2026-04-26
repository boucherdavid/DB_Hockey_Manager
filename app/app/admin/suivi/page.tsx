import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

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

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('fr-CA', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default async function AdminSuiviPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: me } = await supabase.from('poolers').select('is_admin').eq('id', user.id).single()
  if (!me?.is_admin) redirect('/')

  const [{ data: rosterChanges }, { data: transactions }, { data: playoffPicks }] = await Promise.all([
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

    // Soumissions pool des séries
    supabase
      .from('playoff_rosters')
      .select('id, round_added, created_at, pooler_id, poolers (name)')
      .not('created_at', 'is', null)
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  type Event = {
    id: string
    at: string
    category: 'roster' | 'transaction' | 'series'
    poolerName: string
    label: string
    detail: string
    color: string
  }

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

  // Picks séries — regrouper par pooler + ronde + minute (= même soumission)
  const picksBySession = new Map<string, { poolerName: string; round: number; count: number; at: string }>()
  for (const p of playoffPicks ?? []) {
    if (!p.created_at) continue
    const pooler = (p as any).poolers as { name: string } | null
    const name = pooler?.name ?? '?'
    const minuteKey = `${(p as any).pooler_id}|${p.round_added}|${p.created_at.slice(0, 16)}`
    if (!picksBySession.has(minuteKey)) {
      picksBySession.set(minuteKey, { poolerName: name, round: p.round_added, count: 0, at: p.created_at })
    }
    picksBySession.get(minuteKey)!.count++
  }

  for (const [, s] of picksBySession) {
    events.push({
      id:         `s-${s.poolerName}-${s.round}-${s.at}`,
      at:         s.at,
      category:   'series',
      poolerName: s.poolerName,
      label:      `Picks séries R${s.round}`,
      detail:     `${s.count} joueur${s.count > 1 ? 's' : ''} soumis`,
      color:      'bg-pink-100 text-pink-800',
    })
  }

  events.sort((a, b) => b.at.localeCompare(a.at))

  const CATEGORY_LABEL = { roster: 'Alignement', transaction: 'Transaction', series: 'Séries' }
  const CATEGORY_DOT: Record<string, string> = {
    roster:      'bg-green-500',
    transaction: 'bg-slate-500',
    series:      'bg-pink-500',
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Suivi de l&apos;activité</h1>

      {events.length === 0 ? (
        <p className="text-gray-400 text-sm">Aucune activité enregistrée.</p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-36">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">Catégorie</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">Pooler</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-40">Action</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Détail</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {events.map(e => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-xs text-gray-400 whitespace-nowrap">{fmtDate(e.at)}</td>
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${CATEGORY_DOT[e.category]}`} />
                      <span className="text-xs text-gray-500">{CATEGORY_LABEL[e.category]}</span>
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-sm font-medium text-gray-700">{e.poolerName}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${e.color}`}>
                      {e.label}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-sm text-gray-600">{e.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
