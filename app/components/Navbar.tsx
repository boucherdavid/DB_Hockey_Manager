'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
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

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .map(w => w[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase()

  // Couleur déterministe basée sur le nom
  const colors = [
    'bg-blue-600', 'bg-emerald-600', 'bg-violet-600',
    'bg-orange-600', 'bg-rose-600', 'bg-teal-600', 'bg-indigo-600', 'bg-amber-600',
  ]
  const idx = name.split('').reduce((s, c) => s + c.charCodeAt(0), 0) % colors.length
  const color = colors[idx]

  return (
    <div className={`w-8 h-8 rounded-full ${color} flex items-center justify-center text-white text-xs font-bold select-none`}>
      {initials}
    </div>
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
  const [profileOpen, setProfileOpen] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null)
  const profileRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).__pwaPrompt) setInstallPrompt((window as any).__pwaPrompt)
    const handler = (e: Event) => { e.preventDefault(); setInstallPrompt(e) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  // Ferme le menu profil si clic en dehors
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  // Ferme les menus lors d'un changement de route
  useEffect(() => {
    setMenuOpen(false)
    setProfileOpen(false)
  }, [pathname])

  useEffect(() => {
    setUserName(initialUserName)
    setIsAdmin(initialIsAdmin)
  }, [initialUserName, initialIsAdmin])

  const handleInstall = async () => {
    if (!installPrompt) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (installPrompt as any).prompt()
    setInstallPrompt(null)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const linkClass = (href: string) =>
    `px-3 py-2 rounded text-sm font-medium transition-colors ${
      pathname === href || pathname.startsWith(href + '/')
        ? 'bg-pool-navy-light text-white'
        : 'text-pool-light hover:bg-pool-navy-light hover:text-white'
    }`

  const mobileLinkClass = (href: string) =>
    `block px-3 py-2 rounded text-sm font-medium transition-colors ${
      pathname === href
        ? 'bg-pool-navy-light text-white'
        : 'text-pool-light hover:bg-pool-navy-light hover:text-white'
    }`

  const dropdownLinkClass = (href: string) =>
    `block px-4 py-2 text-sm transition-colors ${
      pathname === href
        ? 'text-blue-600 font-medium bg-blue-50'
        : 'text-gray-700 hover:bg-gray-50'
    }`

  // Liens de navigation publics
  const publicLinks = (
    <>
      <Link href="/joueurs"      className={linkClass('/joueurs')}>Contrats LNH</Link>
      <Link href="/statistiques" className={linkClass('/statistiques')}>Statistiques</Link>
      <Link href="/repechage"    className={linkClass('/repechage')}>{'Rep\u00eachage'}</Link>
      <Link href="/poolers"      className={linkClass('/poolers')}>Classement</Link>
      <Link href="/series"       className={linkClass('/series')}>{'S\u00e9ries'}</Link>
      <Link href="/transactions" className={linkClass('/transactions')}>Transactions</Link>
    </>
  )

  return (
    <nav className="bg-pool-navy shadow">
      <div className="max-w-7xl mx-auto px-4">
        {/* Barre principale */}
        <div className="flex items-center justify-between h-14">

          {/* Gauche : logo + liens publics */}
          <div className="flex items-center gap-1 min-w-0">
            <Link href="/" className="flex items-center gap-2 text-white font-bold text-sm mr-3 shrink-0 hover:opacity-80 transition-opacity">
              <Image src="/icons/icon-192x192.png" alt="Logo" width={32} height={32} className="rounded" />
              <span className="hidden lg:inline">{"Page d\u2019accueil"}</span>
            </Link>
            <div className="hidden md:flex items-center gap-1">
              {publicLinks}
            </div>
          </div>

          {/* Droite : installer + avatar ou connexion + hamburger */}
          <div className="flex items-center gap-2 shrink-0">
            {installPrompt && (
              <button onClick={handleInstall}
                className="text-pool-silver hover:text-white text-sm border border-pool-silver rounded px-2 py-1 transition-colors">
                Installer
              </button>
            )}

            {userName ? (
              /* Avatar avec menu déroulant */
              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setProfileOpen(v => !v)}
                  className="flex items-center gap-2 rounded-full p-0.5 hover:ring-2 hover:ring-white/30 transition-all"
                  aria-label="Menu du compte"
                  aria-expanded={profileOpen}
                >
                  <Avatar name={userName} />
                </button>

                {profileOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-100 z-50 overflow-hidden">
                    <div className="px-4 py-2.5 border-b bg-gray-50">
                      <p className="text-xs text-gray-500">Connecté en tant que</p>
                      <p className="text-sm font-semibold text-gray-800 truncate">{userName}</p>
                    </div>
                    <div className="py-1">
                      <Link href="/dashboard"  className={dropdownLinkClass('/dashboard')}>Mon alignement</Link>
                      <Link href="/series/picks" className={dropdownLinkClass('/series/picks')}>Mes picks — Séries</Link>
                      <Link href="/compte"     className={dropdownLinkClass('/compte')}>Mon compte</Link>
                      <Link href="/signaler"   className={dropdownLinkClass('/signaler')}>Signaler un problème</Link>
                    </div>
                    {isAdmin && (
                      <div className="py-1 border-t">
                        <Link href="/admin" className={dropdownLinkClass('/admin')}>
                          <span className="flex items-center gap-2">
                            <span className="text-xs bg-blue-100 text-blue-700 rounded px-1.5 py-0.5">Admin</span>
                            Panneau admin
                          </span>
                        </Link>
                      </div>
                    )}
                    <div className="py-1 border-t">
                      <button onClick={handleLogout}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors">
                        {'D\u00e9connexion'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link href="/login" className="text-pool-silver hover:text-white text-sm transition-colors">
                Connexion
              </Link>
            )}

            {/* Hamburger mobile */}
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
            <Link href="/joueurs"      className={mobileLinkClass('/joueurs')}>Contrats LNH</Link>
            <Link href="/statistiques" className={mobileLinkClass('/statistiques')}>Statistiques</Link>
            <Link href="/repechage"    className={mobileLinkClass('/repechage')}>{'Rep\u00eachage'}</Link>
            <Link href="/poolers"      className={mobileLinkClass('/poolers')}>Classement</Link>
            <Link href="/series"       className={mobileLinkClass('/series')}>{'S\u00e9ries'}</Link>
            <Link href="/transactions" className={mobileLinkClass('/transactions')}>Transactions</Link>
            {userName && (
              <>
                <div className="mt-1 pt-1 border-t border-pool-navy-light flex flex-col gap-1">
                  <Link href="/dashboard"    className={mobileLinkClass('/dashboard')}>Mon alignement</Link>
                  <Link href="/series/picks" className={mobileLinkClass('/series/picks')}>Mes picks — Séries</Link>
                  <Link href="/compte"       className={mobileLinkClass('/compte')}>Mon compte</Link>
                  <Link href="/signaler"     className={mobileLinkClass('/signaler')}>Signaler un problème</Link>
                  {isAdmin && <Link href="/admin" className={mobileLinkClass('/admin')}>Admin</Link>}
                  <button onClick={handleLogout}
                    className="block text-left px-3 py-2 rounded text-sm font-medium text-red-400 hover:bg-pool-navy-light hover:text-red-300 transition-colors">
                    {'D\u00e9connexion'}
                  </button>
                </div>
                <div className="px-3 py-1 text-pool-silver text-xs">{userName}</div>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}
