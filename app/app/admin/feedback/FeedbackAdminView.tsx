'use client'

import { useState } from 'react'

const TYPE_LABELS: Record<string, string> = {
  bug: 'Problème',
  suggestion: 'Suggestion',
  autre: 'Autre',
}

const TYPE_COLORS: Record<string, string> = {
  bug: 'bg-red-100 text-red-700',
  suggestion: 'bg-blue-100 text-blue-700',
  autre: 'bg-gray-100 text-gray-700',
}

type Feedback = {
  id: number
  type: string
  description: string
  created_at: string
  status: string
  poolers: { name: string } | { name: string }[] | null
}

function getPoolerName(poolers: Feedback['poolers']): string {
  if (!poolers) return 'Inconnu'
  if (Array.isArray(poolers)) return poolers[0]?.name ?? 'Inconnu'
  return poolers.name
}

export default function FeedbackAdminView({ feedbacks }: { feedbacks: Feedback[] }) {
  const [copied, setCopied] = useState(false)

  const buildMarkdown = () => {
    const lines: string[] = [
      '# Retours des poolers',
      '',
      `_Exporté le ${new Date().toLocaleDateString('fr-CA')}_`,
      '',
    ]
    for (const f of feedbacks) {
      const date = new Date(f.created_at).toLocaleDateString('fr-CA')
      const poolerName = getPoolerName(f.poolers)
      lines.push(`## [${TYPE_LABELS[f.type] ?? f.type}] — ${poolerName} (${date})`)
      lines.push('')
      lines.push(f.description)
      lines.push('')
      lines.push('---')
      lines.push('')
    }
    return lines.join('\n')
  }

  const exportMarkdown = () => {
    const blob = new Blob([buildMarkdown()], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `retours-poolers-${new Date().toISOString().slice(0, 10)}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (feedbacks.length === 0) {
    return <p className="text-gray-400 text-sm">Aucun retour pour l&apos;instant.</p>
  }

  const copyMarkdown = async () => {
    await navigator.clipboard.writeText(buildMarkdown())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      <div className="flex gap-3 mb-6">
        <button
          onClick={exportMarkdown}
          className="px-4 py-2 bg-pool-navy text-white text-sm font-medium rounded-lg hover:bg-pool-navy-light transition-colors"
        >
          Exporter en .md
        </button>
        <button
          onClick={copyMarkdown}
          className="px-4 py-2 border border-pool-navy text-pool-navy text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
        >
          {copied ? 'Copié ✓' : 'Copier le contenu'}
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {feedbacks.map(f => (
          <div key={f.id} className="bg-white rounded-lg shadow p-5 border-l-4 border-gray-200">
            <div className="flex items-center gap-3 mb-3 flex-wrap">
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${TYPE_COLORS[f.type] ?? 'bg-gray-100 text-gray-700'}`}>
                {TYPE_LABELS[f.type] ?? f.type}
              </span>
              <span className="text-sm font-medium text-gray-700">{getPoolerName(f.poolers)}</span>
              <span className="text-xs text-gray-400 ml-auto">
                {new Date(f.created_at).toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </div>
            <p className="text-gray-700 text-sm whitespace-pre-wrap">{f.description}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
