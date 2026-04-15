import { teamColor } from '@/lib/nhl-colors'

/**
 * Badge coloré aux couleurs NHL de l'équipe.
 * Utilisé de façon cohérente dans toutes les sections de l'application.
 *
 * size="sm"  → petit (px-1.5 py-0.5 text-xs)  — listes denses, rosters
 * size="md"  → normal (px-2 py-0.5 text-xs)   — tableaux standard (défaut)
 */
export default function TeamBadge({
  code,
  size = 'md',
}: {
  code: string | null | undefined
  size?: 'sm' | 'md'
}) {
  if (!code) return <span className="text-gray-400">—</span>

  const isMultiTeam = /^\d TM$/.test(code)
  const colors = isMultiTeam ? { primary: '#64748b', secondary: '#94a3b8' } : teamColor(code)

  const padding = size === 'sm' ? 'px-1.5 py-0.5' : 'px-2 py-0.5'

  return (
    <span
      className={`inline-flex items-center ${padding} rounded text-xs font-bold text-white tracking-wide leading-none`}
      style={{ backgroundColor: colors.primary }}
    >
      {code}
    </span>
  )
}
