'use client'

import Link from 'next/link'

type TabDef = { id: string; label: string; badge?: number }

export function AdminTabBar({
  tabs,
  activeTab,
  basePath,
}: {
  tabs: TabDef[]
  activeTab: string
  basePath: string
}) {
  return (
    <div className="flex border-b border-gray-200 mb-6 overflow-x-auto">
      {tabs.map(t => (
        <Link
          key={t.id}
          href={`${basePath}?tab=${t.id}`}
          className={`whitespace-nowrap px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === t.id
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          {t.label}
          {t.badge ? (
            <span className="ml-1.5 text-xs bg-red-500 text-white rounded-full px-1.5 py-0.5">
              {t.badge}
            </span>
          ) : null}
        </Link>
      ))}
    </div>
  )
}
