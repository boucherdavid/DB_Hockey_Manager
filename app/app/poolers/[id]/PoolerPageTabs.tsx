'use client'

import { useState } from 'react'

type Tab = 'organisation' | 'alignement'

export default function PoolerPageTabs({
  organisationContent,
}: {
  organisationContent: React.ReactNode
}) {
  const [tab, setTab] = useState<Tab>('organisation')

  const btnClass = (t: Tab) =>
    `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
      tab === t
        ? 'border-blue-600 text-blue-600'
        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
    }`

  return (
    <div>
      {/* Onglets */}
      <div className="flex border-b border-gray-200 mb-6">
        <button className={btnClass('organisation')} onClick={() => setTab('organisation')}>
          Organisation
        </button>
        <button className={btnClass('alignement')} onClick={() => setTab('alignement')}>
          Alignement
        </button>
      </div>

      {/* Contenu */}
      {tab === 'organisation' && organisationContent}

      {tab === 'alignement' && (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-2xl mb-3">🏒</p>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Alignement — Points de la saison</h3>
          <p className="text-sm text-gray-400 max-w-sm mx-auto">
            Cette vue affichera les joueurs ayant contribué aux points du pooler,
            avec buts, passes, victoires et total de points pool.
            Disponible avec le Chantier B (snapshots NHL).
          </p>
        </div>
      )}
    </div>
  )
}
