'use client'

import { useState } from 'react'
import PicksEditor, { type Pick, type Pooler } from './PicksEditor'
import RookieOverrideManager from './RookieOverrideManager'

type Saison = { id: number; season: string }

type Tab = 'picks' | 'recrues'

export default function InitTabs({
  picks,
  poolers,
  saison,
}: {
  picks: Pick[]
  poolers: Pooler[]
  saison: Saison
}) {
  const [tab, setTab] = useState<Tab>('picks')

  const tabClass = (t: Tab) =>
    `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
      tab === t
        ? 'bg-blue-600 text-white'
        : 'text-gray-600 hover:bg-gray-100'
    }`

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="flex items-center gap-1 p-4 border-b">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide mr-3">
          Ajustements initiaux
        </span>
        <button type="button" className={tabClass('picks')} onClick={() => setTab('picks')}>
          Choix de repêchage
        </button>
        <button type="button" className={tabClass('recrues')} onClick={() => setTab('recrues')}>
          Banque de recrues
        </button>
      </div>

      <div className="p-6">
        {tab === 'picks' && (
          <PicksEditor picks={picks} poolers={poolers} seasonLabel={saison.season} />
        )}
        {tab === 'recrues' && (
          <RookieOverrideManager poolers={poolers} saison={saison} />
        )}
      </div>
    </div>
  )
}
