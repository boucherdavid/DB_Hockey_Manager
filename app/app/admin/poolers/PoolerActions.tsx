'use client'

import Link from 'next/link'
import { useState } from 'react'
import { resetPasswordForPoolerAction } from '@/app/compte/actions'

export default function PoolerActions({ poolerId, poolerName }: { poolerId: string, poolerName: string }) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  async function handleReset() {
    if (!confirm(`Envoyer un courriel de réinitialisation à ${poolerName} ?`)) return
    setBusy(true)
    setMsg(null)
    const res = await resetPasswordForPoolerAction(poolerId)
    setBusy(false)
    setMsg(res.error ? { type: 'err', text: res.error } : { type: 'ok', text: 'Courriel envoyé.' })
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center justify-center gap-3">
        <Link href={`/poolers/${poolerId}`} className="text-blue-600 hover:text-blue-800 text-xs font-medium">
          Voir l&apos;alignement
        </Link>
        <button
          onClick={handleReset}
          disabled={busy}
          className="text-orange-600 hover:text-orange-800 text-xs font-medium disabled:opacity-50"
        >
          {busy ? '...' : 'Réinitialiser mot de passe'}
        </button>
      </div>
      {msg && (
        <span className={`text-xs ${msg.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}>{msg.text}</span>
      )}
    </div>
  )
}
