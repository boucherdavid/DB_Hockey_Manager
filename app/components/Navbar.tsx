'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

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
    // Récupère l'événement capturé avant hydratation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).__pwaPrompt) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setInstallPrompt((window as any).__pwaPrompt)
    }
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
        ? 'bg-pool-navy-light text-white'
        : 'text-pool-light hover:bg-pool-navy-light hover:text-white'
    }`

  const mobileLinkClass = (href: string) =>
    `block px-3 py-2 rounded text-sm font-medium transition-colors ${
      pathname === href
        ? 'bg-pool-navy-light text-white'
        : 'text-pool-light hover:bg-pool-navy-light hover:text-white'
    }`

  const navLinks = (
    <>
      <Link href="/joueurs" className={linkClass('/joueurs')}>Contrats LNH</Link>
      <Link href="/statistiques" className={linkClass('/statistiques')}>Statistiques</Link>
      <Link href="/repechage" className={linkClass('/repechage')}>{'Rep\u00eachage'}</Link>
      <Link href="/poolers" className={linkClass('/poolers')}>Classement</Link>
      <Link href="/transactions" className={linkClass('/transactions')}>Transactions</Link>
      {userName && <Link href="/dashboard" className={linkClass('/dashboard')}>Mon alignement</Link>}
      {userName && <Link href="/signaler" className={linkClass('/signaler')}>Signaler</Link>}
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
      {userName && <Link href="/signaler" className={mobileLinkClass('/signaler')}>Signaler</Link>}
      {isAdmin && <Link href="/admin" className={mobileLinkClass('/admin')}>Admin</Link>}
    </>
  )

  return (
    <nav className="bg-pool-navy shadow">
      <div className="max-w-7xl mx-auto px-4">
        {/* Barre principale */}
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-1 min-w-0">
            <Link href="/" className="flex items-center gap-2 text-white font-bold text-sm mr-4 shrink-0 hover:opacity-80 transition-opacity">
              <Image src="/icons/icon-192x192.png" alt="Logo" width={32} height={32} className="rounded" />
              <span className="hidden sm:inline">{"Page d\u2019accueil"}</span>
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
                className="text-pool-silver hover:text-white text-sm border border-pool-silver rounded px-2 py-1 transition-colors"
              >
                Installer
              </button>
            )}
            {/* Authentification */}
            {userName ? (
              <>
                <span className="text-pool-silver text-sm hidden sm:inline">{userName}</span>
                <button onClick={handleLogout} className="text-pool-silver hover:text-white text-sm transition-colors">
                  {'D\u00e9connexion'}
                </button>
              </>
            ) : (
              <Link href="/login" className="text-pool-silver hover:text-white text-sm transition-colors">
                Connexion
              </Link>
            )}
            {/* Bouton hamburger — visible uniquement sur mobile */}
            <button
              className="md:hidden text-white p-1 rounded hover:bg-pool-navy-light transition-colors"
              onClick={() => setMenuOpen(v => !v)}
              aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            >
              {menuOpen ? <CloseIcon /> : <HamburgerIcon />}
            </button>
          </div>
        </div>

        {/* Menu mobile déroulant */}
        {menuOpen && (
          <div className="md:hidden border-t border-pool-navy-light py-2 flex flex-col gap-1">
            {mobileNavLinks}
            {userName && (
              <div className="mt-2 pt-2 border-t border-pool-navy-light">
                <span className="block px-3 py-1 text-pool-silver text-sm">{userName}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}