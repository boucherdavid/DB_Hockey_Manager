'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

export default function PlayerLink({
  nhlId,
  children,
}: {
  nhlId: number | null | undefined
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  if (!nhlId) return <>{children}</>

  const handleClick = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('joueur', String(nhlId))
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <button onClick={handleClick} className="hover:text-blue-600 hover:underline text-left">
      {children}
    </button>
  )
}
