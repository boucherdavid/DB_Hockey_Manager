'use client'

import { useState } from 'react'
import { saveDraftOrderAction } from './actions'

type Pooler = { id: string; name: string; draft_order: number | null }

export default function DraftOrderEditor({
  poolers,
  saisonId,
}: {
  poolers: Pooler[]
  saisonId: number
}) {
  const sorted = [...poolers].sort((a, b) => {
    if (a.draft_order === null && b.draft_order === null) return a.name.localeCompare(b.name)
    if (a.draft_order === null) return 1
    if (b.draft_order === null) return -1
    return a.draft_order - b.draft_order
  })

  const [order, setOrder] = useState<Pooler[]>(sorted)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')

  const moveUp = (index: number) => {
    if (index === 0) return
    const next = [...order]
    ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
    setOrder(next)
  }

  const moveDown = (index: number) => {
    if (index === order.length - 1) return
    const next = [...order]
    ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
    setOrder(next)
  }

  const handleSave = async () => {
    setSaving(true)
    const entries = order.map((p, i) => ({ poolerId: p.id, draftOrder: i + 1 }))
    const result = await saveDraftOrderAction(saisonId, entries)
    if (result.error) {
      setMessage(result.error)
      setMessageType('error')
    } else {
      setMessage('Ordre sauvegardé.')
      setMessageType('success')
    }
    setSaving(false)
    setTimeout(() => setMessage(''), 3000)
  }

  return (
    <div className="bg-white rounded-lg shadow p-5">
      <h2 className="font-semibold text-gray-700 mb-1">Ordre de sélection</h2>
      <p className="text-xs text-gray-400 mb-4">
        L'ordre s'applique à toutes les rondes. Un choix échangé conserve le rang de son propriétaire d'origine.
      </p>
      <div className="space-y-1 mb-4">
        {order.map((pooler, index) => (
          <div key={pooler.id} className="flex items-center gap-3 py-1.5 px-3 rounded-lg bg-slate-50">
            <span className="text-sm font-bold text-slate-400 w-5 text-right">{index + 1}</span>
            <span className="flex-1 text-sm font-medium text-gray-800">{pooler.name}</span>
            <div className="flex gap-1">
              <button
                onClick={() => moveUp(index)}
                disabled={index === 0}
                className="text-gray-400 hover:text-gray-700 disabled:opacity-20 px-1 text-xs"
                title="Monter"
              >
                ▲
              </button>
              <button
                onClick={() => moveDown(index)}
                disabled={index === order.length - 1}
                className="text-gray-400 hover:text-gray-700 disabled:opacity-20 px-1 text-xs"
                title="Descendre"
              >
                ▼
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40"
        >
          {saving ? 'Sauvegarde...' : 'Sauvegarder'}
        </button>
        {message && (
          <span className={`text-sm font-medium ${messageType === 'error' ? 'text-red-600' : 'text-green-600'}`}>
            {message}
          </span>
        )}
      </div>
    </div>
  )
}
