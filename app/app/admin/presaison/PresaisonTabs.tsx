'use client'

import { useState } from 'react'
import PresaisonManager from './PresaisonManager'
import PicksEditor, { type Pick, type Pooler } from '../config/PicksEditor'
import RookieOverrideManager from '../config/RookieOverrideManager'

type Saison = { id: number; season: string; is_active: boolean }

type Tab = 'presaison' | 'picks' | 'recrues'

const TABS: { id: Tab; label: string }[] = [
  { id: 'presaison', label: 'Repêchage pré-saison' },
  { id: 'picks',     label: 'Choix de repêchage' },
  { id: 'recrues',   label: 'Banque de recrues' },
]

type Props = {
  saisons: Saison[]
  defaultSaisonId: number
  picks: Pick[]
  poolers: Pooler[]
  activeSaison: Saison | null
}

export default function PresaisonTabs({ saisons, defaultSaisonId, picks, poolers, activeSaison }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('presaison')

  const tabCls = (id: Tab) =>
    `px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
      activeTab === id
        ? 'border-blue-600 text-blue-600'
        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
    }`

  return (
    <div>
      <div className="flex border-b border-gray-200 mb-8">
        {TABS.map(t => (
          <button key={t.id} type="button" className={tabCls(t.id)} onClick={() => setActiveTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'presaison' && (
        <PresaisonManager saisons={saisons} defaultSaisonId={defaultSaisonId} />
      )}

      {activeTab === 'picks' && (
        activeSaison
          ? <PicksEditor picks={picks} poolers={poolers} seasonLabel={activeSaison.season} />
          : <div className="text-gray-400 text-sm bg-white rounded-lg shadow p-6">Aucune saison régulière active.</div>
      )}

      {activeTab === 'recrues' && (
        activeSaison
          ? <RookieOverrideManager poolers={poolers} saison={activeSaison} />
          : <div className="text-gray-400 text-sm bg-white rounded-lg shadow p-6">Aucune saison régulière active.</div>
      )}
    </div>
  )
}
