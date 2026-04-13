'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const HOCKEY_STICK = '\uD83C\uDFD2'

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [userName, setUserName] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: pooler } = await supabase
          .from('poolers')
          .select('name, is_admin')
          .eq('id', user.id)
          .single()
        if (pooler) {
          setUserName(pooler.name)
          setIsAdmin(pooler.is_admin)
        }
      }
    }
    getUser()
  }, [supabase])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUserName(null)
    setIsAdmin(false)
    router.push('/login')
  }

  const linkClass = (href: string) =>
    `px-3 py-2 rounded text-sm font-medium transition-colors ${
      pathname === href
        ? 'bg-blue-700 text-white'
        : 'text-blue-100 hover:bg-blue-700 hover:text-white'
    }`

  return (
    <nav className="bg-blue-800 shadow">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-1">
            <Link href="/" className="text-white font-bold text-lg mr-4">
              {`${HOCKEY_STICK} Hockey Pool`}
            </Link>
            <Link href="/joueurs" className={linkClass('/joueurs')}>
              Joueurs LNH
            </Link>
            <Link href="/repechage" className={linkClass('/repechage')}>
              {'Rep\u00eachage'}
            </Link>
            <Link href="/poolers" className={linkClass('/poolers')}>
              Poolers
            </Link>
            <Link href="/transactions" className={linkClass('/transactions')}>
              Transactions
            </Link>
            {userName && (
              <Link href="/dashboard" className={linkClass('/dashboard')}>
                Mon alignement
              </Link>
            )}
            {isAdmin && (
              <Link href="/admin" className={linkClass('/admin')}>
                Admin
              </Link>
            )}
          </div>
          <div className="flex items-center gap-3">
            {userName ? (
              <>
                <span className="text-blue-200 text-sm">{userName}</span>
                <button
                  onClick={handleLogout}
                  className="text-blue-200 hover:text-white text-sm"
                >
                  {'D\u00e9connexion'}
                </button>
              </>
            ) : (
              <Link href="/login" className="text-blue-200 hover:text-white text-sm">
                Connexion
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}