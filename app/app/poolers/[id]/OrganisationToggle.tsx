'use client'

import { useState } from 'react'

export default function OrganisationToggle({
  commonContent,
  masseSalariale,
  orgComplete,
}: {
  commonContent: React.ReactNode
  masseSalariale: React.ReactNode
  orgComplete: React.ReactNode
}) {
  const [view, setView] = useState<'masse' | 'org'>('masse')

  return (
    <>
      {commonContent}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setView('masse')}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
            view === 'masse' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Masse salariale
        </button>
        <button
          onClick={() => setView('org')}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
            view === 'org' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Organisation
        </button>
      </div>
      {view === 'masse' ? masseSalariale : orgComplete}
    </>
  )
}
