'use client'

import { useRouter } from 'next/navigation'

export default function PoolerSwitcher({
  poolers,
  currentId,
}: {
  poolers: { id: string; name: string }[]
  currentId: string
}) {
  const router = useRouter()

  return (
    <select
      value={currentId}
      onChange={e => router.push(`/poolers/${e.target.value}`)}
      className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
    >
      {poolers.map(p => (
        <option key={p.id} value={p.id}>{p.name}</option>
      ))}
    </select>
  )
}
