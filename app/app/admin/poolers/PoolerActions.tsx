'use client'

import Link from 'next/link'

export default function PoolerActions({ poolerId, poolerName }: { poolerId: string, poolerName: string }) {
  return (
    <div className="flex items-center justify-center gap-3">
      <Link
        href={`/poolers/${poolerId}`}
        className="text-blue-600 hover:text-blue-800 text-xs font-medium"
      >
        Voir l&apos;alignement
      </Link>
    </div>
  )
}
