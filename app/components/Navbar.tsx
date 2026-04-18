'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const HOCKEY_STICK = '\uD83C\uDFD2'

function HamburgerIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

export default function Navbar({
  initialUserName,
  initialIsAdmin,
}: {
  initialUserName: string | null
  initialIsAdmin: boolean
}) {
  const pathname = usePathname()

  const supabase = createClient()
  const [userName, setUserName] = useState<string | null>(initialUserName)
  const [isAdmin, setIsAdmin] = useState(initialIsAdmin)
  const [menuOpen, setMenuOpen] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!installPrompt) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (installPrompt as any).prompt()
    setInstallPrompt(null)
  }

  // Ferme le menu mobile lors d'un changement de route
  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  // Met à jour l'état local si les props changent (ex: après login/logout côté serveur)
  useEffect(() => {
    setUserName(initialUserName)
    setIsAdmin(initialIsAdmin)
  }, [initialUserName, initialIsAdmin])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const linkClass = (href: string) =>
    `px-3 py-2 rounded text-sm font-medium transition-colors ${
      pathname === href
        ? 'bg-blue-700 text-white'
        : 'text-blue-100 hover:bg-blue-700 hover:text-white'
    }`

  const mobileLinkClass = (href: string) =>
    `block px-3 py-2 rounded text-sm font-medium transition-colors ${
      pathname === href
        ? 'bg-blue-700 text-white'
        : 'text-blue-100 hover:bg-blue-700 hover:text-white'
    }`

  const navLinks = (
    <>
      <Link href="/joueurs" className={linkClass('/joueurs')}>Contrats LNH</Link>
      <Link href="/statistiques" className={linkClass('/statistiques')}>Statistiques</Link>
      <Link href="/repechage" className={linkClass('/repechage')}>{'Rep\u00eachage'}</Link>
      <Link href="/poolers" className={linkClass('/poolers')}>Classement</Link>
      <Link href="/transactions" className={linkClass('/transactions')}>Transactions</Link>
      {userName && <Link href="/dashboard" className={linkClass('/dashboard')}>Mon alignement</Link>}
      {isAdmin && <Link href="/admin" className={linkClass('/admin')}>Admin</Link>}
    </>
  )

  const mobileNavLinks = (
    <>
      <Link href="/joueurs" className={mobileLinkClass('/joueurs')}>Contrats LNH</Link>
      <Link href="/statistiques" className={mobileLinkClass('/statistiques')}>Statistiques</Link>
      <Link href="/repechage" className={mobileLinkClass('/repechage')}>{'Rep\u00eachage'}</Link>
      <Link href="/poolers" className={mobileLinkClass('/poolers')}>Classement</Link>
      <Link href="/transactions" className={mobileLinkClass('/transactions')}>Transactions</Link>
      {userName && <Link href="/dashboard" className={mobileLinkClass('/dashboard')}>Mon alignement</Link>}
      {isAdmin && <Link href="/admin" className={mobileLinkClass('/admin')}>Admin</Link>}
    </>
  )

  return (
    <nav className="bg-blue-800 shadow">
      <div className="max-w-7xl mx-auto px-4">
        {/* Barre principale */}
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-1 min-w-0">
            <Link href="/" className="text-white font-bold text-lg mr-4 shrink-0">
              {`${HOCKEY_STICK} Hockey Pool`}
            </Link>
            {/* Liens desktop — cachés sur mobile */}
            <div className="hidden md:flex items-center gap-1">
              {navLinks}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {installPrompt && (
              <button
                onClick={handleInstall}
                className="text-blue-200 hover:text-white text-sm border border-blue-500 rounded px-2 py-1"
              >
                Installer
              </button>
            )}
            {/* Authentification */}
            {userName ? (
              <>
                <span className="text-blue-200 text-sm hidden sm:inline">{userName}</span>
                <button onClick={handleLogout} className="text-blue-200 hover:text-white text-sm">
                  {'D\u00e9connexion'}
                </button>
              </>
            ) : (
              <Link href="/login" className="text-blue-200 hover:text-white text-sm">
                Connexion
              </Link>
            )}
            {/* Bouton hamburger — visible uniquement sur mobile */}
            <button
              className="md:hidden text-white p-1 rounded hover:bg-blue-700 transition-colors"
              onClick={() => setMenuOpen(v => !v)}
              aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            >
              {menuOpen ? <CloseIcon /> : <HamburgerIcon />}
            </button>
          </div>
        </div>

        {/* Menu mobile déroulant */}
        {menuOpen && (
          <div className="md:hidden border-t border-blue-700 py-2 flex flex-col gap-1">
            {mobileNavLinks}
            {userName && (
              <div className="mt-2 pt-2 border-t border-blue-700">
                <span className="block px-3 py-1 text-blue-300 text-sm">{userName}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}