'use client'

import { useState, useMemo } from 'react'

export type Event = {
  id: string
  at: string
  category: 'roster' | 'transaction' | 'series'
  poolerName: string
  label: string
  detail: string
  color: string
}

const CATEGORY_LABEL: Record<string, string> = { roster: 'Alignement', transaction: 'Transaction', series: 'Séries' }
const CATEGORY_DOT: Record<string, string> = {
  roster:      'bg-green-500',
  transaction: 'bg-slate-500',
  series:      'bg-pink-500',
}

type CategoryFilter = 'all' | 'roster' | 'transaction' | 'series'
type DateFilter = '7' | '30' | 'all'

const CATEGORY_TABS: { key: CategoryFilter; label: string }[] = [
  { key: 'all',         label: 'Tous' },
  { key: 'roster',      label: 'Alignement' },
  { key: 'transaction', label: 'Transaction' },
  { key: 'series',      label: 'Séries' },
]

const DATE_OPTIONS: { key: DateFilter; label: string }[] = [
  { key: '7',   label: '7 derniers jours' },
  { key: '30',  label: '30 derniers jours' },
  { key: 'all', label: 'Tout' },
]

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('fr-CA', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Toronto',
  })
}

export default function SuiviTable({ events }: { events: Event[] }) {
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [dateFilter, setDateFilter] = useState<DateFilter>('30')

  const filtered = useMemo(() => {
    const now = Date.now()
    const cutoff = dateFilter === 'all' ? null : now - parseInt(dateFilter) * 24 * 60 * 60 * 1000

    return events.filter(e => {
      if (categoryFilter !== 'all' && e.category !== categoryFilter) return false
      if (cutoff && new Date(e.at).getTime() < cutoff) return false
      return true
    })
  }, [events, categoryFilter, dateFilter])

  const countFor = (cat: CategoryFilter) =>
    cat === 'all' ? events.length : events.filter(e => e.category === cat).length

  return (
    <div className="space-y-4">
      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Filtre catégorie */}
        <div className="flex border-b">
          {CATEGORY_TABS.map(tab => (
            <button key={tab.key} onClick={() => setCategoryFilter(tab.key)}
              className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${
                categoryFilter === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {tab.label}
              <span className={`text-xs rounded-full px-1.5 py-0.5 font-semibold ${
                categoryFilter === tab.key ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {countFor(tab.key)}
              </span>
            </button>
          ))}
        </div>

        {/* Filtre date */}
        <select value={dateFilter} onChange={e => setDateFilter(e.target.value as DateFilter)}
          className="ml-auto border border-gray-300 rounded px-3 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          {DATE_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <p className="text-gray-400 text-sm py-8 text-center">Aucune activité pour ces filtres.</p>
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
              {filtered.map(e => (
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
          <p className="px-4 py-2 text-xs text-gray-400 border-t">
            {filtered.length} événement{filtered.length > 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  )
}
