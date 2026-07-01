'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { deleteProspectAction } from './actions'

export default function DraftProspectActions({ prospectId, prospectName }: { prospectId: number; prospectName: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function handleDelete() {
    if (!confirm(`Supprimer ${prospectName} ? Tous ses rangs par source seront supprimés aussi.`)) return
    setBusy(true)
    const result = await deleteProspectAction(prospectId)
    setBusy(false)
    if (result.error) {
      alert(result.error)
    } else {
      router.refresh()
    }
  }

  return (
    <div className="flex items-center justify-center gap-3">
      <Link href={`/admin/draft-center/${prospectId}`} className="text-blue-600 hover:text-blue-800 text-xs font-medium">
        Modifier
      </Link>
      <button onClick={handleDelete} disabled={busy} className="text-red-400 hover:text-red-600 text-xs font-medium disabled:opacity-50">
        {busy ? '...' : 'Supprimer'}
      </button>
    </div>
  )
}
