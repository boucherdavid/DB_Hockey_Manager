'use client'

import { useRouter } from 'next/navigation'

export default function DraftYearSelect({
  years,
  selectedYear,
}: {
  years: number[]
  selectedYear: number
}) {
  const router = useRouter()
  return (
    <select
      value={selectedYear}
      onChange={e => router.push(`/draft-center?year=${e.target.value}`)}
      className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500"
    >
      {years.map(y => (
        <option key={y} value={y}>{y}</option>
      ))}
    </select>
  )
}
