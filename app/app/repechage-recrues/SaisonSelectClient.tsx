'use client'

import { useRouter } from 'next/navigation'

type Saison = { id: number; season: string; is_active: boolean }

export default function SaisonSelectClient({
  saisons,
  selectedId,
}: {
  saisons: Saison[]
  selectedId: number
}) {
  const router = useRouter()
  return (
    <select
      value={selectedId}
      onChange={e => router.push(`/repechage-recrues?saisonId=${e.target.value}`)}
      className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500"
    >
      {saisons.map(s => (
        <option key={s.id} value={s.id}>
          {s.season}{s.is_active ? ' (active)' : ''}
        </option>
      ))}
    </select>
  )
}
