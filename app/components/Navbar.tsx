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

function Chevron({ open }: { open: boolean }) {
  return (
    <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
    </svg>
  )
}

function Avatar({ name }: { name: string }) {
  const initials = name.split(' ').map(w => w[0] ?? '').slice(0, 2).join('').toUpperCase()
  const colors = [
    'bg-blue-600', 'bg-emerald-600', 'bg-violet-600',
    'bg-orange-600', 'bg-rose-600', 'bg-teal-600', 'bg-indigo-600', 'bg-amber-600',
  ]
  const idx = name.split('').reduce((s, c) => s + c.charCodeAt(0), 0) % colors.length
  return (
    <div className={`w-8 h-8 rounded-full ${colors[idx]} flex items-center justify-center text-white text-xs font-bold select-none`}>
      {initials}
    </div>
  )
}

type DropdownKey = 'pool-saison' | 'classement' | 'statistiques' | 'series' | 'profile' | null

export default function Navbar({
  initialUserName,
  initialIsAdmin,
  initialUnreadCount = 0,
}: {
  initialUserName: string | null
  initialIsAdmin: boolean
  initialUnreadCount?: number
}) {
  const pathname = usePathname()
  const supabase = createClient()

  const [userName, setUserName] = useState<string | null>(initialUserName)
  const [isAdmin, setIsAdmin] = useState(initialIsAdmin)
  const [unreadCount] = useState(initialUnreadCount)
  const [menuOpen, setMenuOpen] = useState(false)
  const [openDropdown, setOpenDropdown] = useState<DropdownKey>(null)
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null)
  const navRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (
      localStorage.getItem('pwaInstalled') === '1' ||
      window.matchMedia('(display-mode: standalone)').matches ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window.navigator as any).standalone === true
    ) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).__pwaPrompt) setInstallPrompt((window as any).__pwaPrompt)
    const handler = (e: Event) => { e.preventDefault(); setInstallPrompt(e) }
    window.addEventListener('beforeinstallprompt', handler)
    const onInstalled = () => { localStorage.setItem('pwaInstalled', '1'); setInstallPrompt(null) }
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenDropdown(null)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  useEffect(() => {
    setMenuOpen(false)
    setOpenDropdown(null)
  }, [pathname])

  useEffect(() => {
    setUserName(initialUserName)
    setIsAdmin(initialIsAdmin)
  }, [initialUserName, initialIsAdmin])

  const handleInstall = async () => {
    if (!installPrompt) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (installPrompt as any).prompt()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { outcome } = await (installPrompt as any).userChoice
    if (outcome === 'accepted') localStorage.setItem('pwaInstalled', '1')
    setInstallPrompt(null)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const toggle = (key: DropdownKey) => setOpenDropdown(prev => prev === key ? null : key)

  const isActive = (...paths: string[]) =>
    paths.some(p => pathname === p || pathname.startsWith(p + '/'))

  const navBtnClass = (active: boolean) =>
    `flex items-center gap-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
      active ? 'bg-pool-navy-light text-white' : 'text-pool-light hover:bg-pool-navy-light hover:text-white'
    }`

  const dropdownLinkClass = (href: string) =>
    `block px-4 py-2 text-sm transition-colors ${
      isActive(href) ? 'text-blue-600 font-medium bg-blue-50' : 'text-gray-700 hover:bg-gray-50'
    }`

  const mobileLinkClass = (href: string) =>
    `block px-3 py-2 rounded text-sm font-medium transition-colors ${
      isActive(href) ? 'bg-pool-navy-light text-white' : 'text-pool-light hover:bg-pool-navy-light hover:text-white'
    }`

  const MobileSection = ({ label }: { label: string }) => (
    <div className="px-3 pt-3 pb-0.5 text-xs text-pool-silver uppercase tracking-wide font-semibold">{label}</div>
  )

  return (
    <nav className="bg-pool-navy shadow" ref={navRef}>
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">

          {/* Gauche : logo + liens */}
          <div className="flex items-center gap-1 min-w-0">
            <Link href="/" className="flex items-center gap-2 text-white font-bold text-sm mr-3 shrink-0 hover:opacity-80 transition-opacity">
              <Image src="/icons/icon-192x192.png" alt="Logo" width={32} height={32} className="rounded" />
              <span className="hidden lg:inline">Accueil</span>
            </Link>

            <div className="hidden md:flex items-center gap-1">

              {/* Pool Saison */}
              <div className="relative">
                <button onClick={() => toggle('pool-saison')}
                  className={navBtnClass(isActive('/dashboard', '/transactions'))}>
                  Pool Saison <Chevron open={openDropdown === 'pool-saison'} />
                </button>
                {openDropdown === 'pool-saison' && (
                  <div className="absolute left-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-100 z-50 py-1">
                    {userName && <Link href="/dashboard"    className={dropdownLinkClass('/dashboard')}>Mon équipe</Link>}
                    <Link href="/transactions" className={dropdownLinkClass('/transactions')}>Transactions</Link>
                  </div>
                )}
              </div>

              {/* Classement */}
              <div className="relative">
                <button onClick={() => toggle('classement')}
                  className={navBtnClass(isActive('/classement', '/poolers'))}>
                  Classement <Chevron open={openDropdown === 'classement'} />
                </button>
                {openDropdown === 'classement' && (
                  <div className="absolute left-0 top-full mt-1 w-52 bg-white rounded-lg shadow-lg border border-gray-100 z-50 py-1">
                    <Link href="/classement" className={dropdownLinkClass('/classement')}>Saison complète</Link>
                    <span className="flex items-center gap-2 px-4 py-2 text-sm text-gray-400 cursor-default">
                      Hebdomadaire <span className="text-xs bg-gray-100 text-gray-500 rounded px-1.5 py-0.5">À venir</span>
                    </span>
                    <span className="flex items-center gap-2 px-4 py-2 text-sm text-gray-400 cursor-default">
                      Mensuel <span className="text-xs bg-gray-100 text-gray-500 rounded px-1.5 py-0.5">À venir</span>
                    </span>
                    <div className="border-t my-1" />
                    <span className="flex items-center gap-2 px-4 py-2 text-sm text-gray-400 cursor-default">
                      Meilleurs disponibles <span className="text-xs bg-gray-100 text-gray-500 rounded px-1.5 py-0.5">À venir</span>
                    </span>
                  </div>
                )}
              </div>

              {/* Statistiques */}
              <div className="relative">
                <button onClick={() => toggle('statistiques')}
                  className={navBtnClass(isActive('/statistiques'))}>
                  Statistiques <Chevron open={openDropdown === 'statistiques'} />
                </button>
                {openDropdown === 'statistiques' && (
                  <div className="absolute left-0 top-full mt-1 w-44 bg-white rounded-lg shadow-lg border border-gray-100 z-50 py-1">
                    <Link href="/statistiques" className={dropdownLinkClass('/statistiques')}>LNH</Link>
                    <span className="flex items-center gap-2 px-4 py-2 text-sm text-gray-400 cursor-default">
                      AHL <span className="text-xs bg-gray-100 text-gray-500 rounded px-1.5 py-0.5">À venir</span>
                    </span>
                  </div>
                )}
              </div>

              {/* Contrats LNH */}
              <Link href="/joueurs" className={navBtnClass(isActive('/joueurs'))}>
                Contrats LNH
              </Link>

              {/* Repêchage */}
              <Link href="/repechage" className={navBtnClass(isActive('/repechage'))}>
                {'Rep\u00eachage'}
              </Link>

              {/* Pool Séries */}
              <div className="relative">
                <button onClick={() => toggle('series')}
                  className={navBtnClass(isActive('/series'))}>
                  {'Pool S\u00e9ries'} <Chevron open={openDropdown === 'series'} />
                </button>
                {openDropdown === 'series' && (
                  <div className="absolute left-0 top-full mt-1 w-44 bg-white rounded-lg shadow-lg border border-gray-100 z-50 py-1">
                    {userName && <Link href="/series/picks" className={dropdownLinkClass('/series/picks')}>Mes choix</Link>}
                    <Link href="/series" className={dropdownLinkClass('/series')}>Classement</Link>
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* Droite : installer + avatar */}
          <div className="flex items-center gap-2 shrink-0">
            {installPrompt && (
              <button onClick={handleInstall}
                className="text-pool-silver hover:text-white text-sm border border-pool-silver rounded px-2 py-1 transition-colors">
                Installer
              </button>
            )}

            {userName ? (
              <div className="relative">
                <button
                  onClick={() => toggle('profile')}
                  className="flex items-center gap-2 rounded-full p-0.5 hover:ring-2 hover:ring-white/30 transition-all"
                  aria-label="Menu du compte"
                  aria-expanded={openDropdown === 'profile'}
                >
                  <Avatar name={userName} />
                </button>
                {openDropdown === 'profile' && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-100 z-50 overflow-hidden">
                    <div className="px-4 py-2.5 border-b bg-gray-50">
                      <p className="text-xs text-gray-500">Connecté en tant que</p>
                      <p className="text-sm font-semibold text-gray-800 truncate">{userName}</p>
                    </div>
                    <div className="py-1">
                      <Link href="/compte"   className={dropdownLinkClass('/compte')}>Mon compte</Link>
                      <Link href="/aide"     className={dropdownLinkClass('/aide')}>Aide &amp; Règlements</Link>
                      <Link href="/signaler" className={dropdownLinkClass('/signaler')}>Signaler un problème</Link>
                    </div>
                    {isAdmin && (
                      <div className="py-1 border-t">
                        <Link href="/admin" className={dropdownLinkClass('/admin')}>
                          <span className="flex items-center gap-2">
                            <span className="text-xs bg-blue-100 text-blue-700 rounded px-1.5 py-0.5">Admin</span>
                            Panneau admin
                          </span>
                        </Link>
                        <Link href="/admin/feedback" className={dropdownLinkClass('/admin/feedback')}>
                          <span className="flex items-center justify-between">
                            <span className="flex items-center gap-2">
                              <span className="text-xs bg-blue-100 text-blue-700 rounded px-1.5 py-0.5">Admin</span>
                              Boîte de réception
                            </span>
                            {unreadCount > 0 && (
                              <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">{unreadCount}</span>
                            )}
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

        {/* Menu mobile */}
        {menuOpen && (
          <div className="md:hidden border-t border-pool-navy-light py-2 flex flex-col gap-0.5">
            <MobileSection label="Pool Saison" />
            {userName && <Link href="/dashboard"    className={mobileLinkClass('/dashboard')}>Mon équipe</Link>}
            <Link href="/transactions" className={mobileLinkClass('/transactions')}>Transactions</Link>

            <MobileSection label="Classement" />
            <Link href="/classement" className={mobileLinkClass('/classement')}>Saison complète</Link>
            <span className="px-3 py-2 text-sm text-pool-silver opacity-50">Hebdomadaire (à venir)</span>
            <span className="px-3 py-2 text-sm text-pool-silver opacity-50">Mensuel (à venir)</span>
            <span className="px-3 py-2 text-sm text-pool-silver opacity-50">Meilleurs disponibles (à venir)</span>

            <MobileSection label="Statistiques" />
            <Link href="/statistiques" className={mobileLinkClass('/statistiques')}>LNH</Link>
            <span className="px-3 py-2 text-sm text-pool-silver opacity-50">AHL (à venir)</span>

            <MobileSection label="Autre" />
            <Link href="/joueurs"   className={mobileLinkClass('/joueurs')}>Contrats LNH</Link>
            <Link href="/repechage" className={mobileLinkClass('/repechage')}>{'Rep\u00eachage'}</Link>

            <MobileSection label={'Pool S\u00e9ries'} />
            {userName && <Link href="/series/picks" className={mobileLinkClass('/series/picks')}>Mes choix</Link>}
            <Link href="/series" className={mobileLinkClass('/series')}>Classement</Link>

            {userName && (
              <div className="mt-1 pt-1 border-t border-pool-navy-light flex flex-col gap-0.5">
                <MobileSection label="Compte" />
                <Link href="/compte"   className={mobileLinkClass('/compte')}>Mon compte</Link>
                <Link href="/aide"     className={mobileLinkClass('/aide')}>Aide &amp; Règlements</Link>
                <Link href="/signaler" className={mobileLinkClass('/signaler')}>Signaler un problème</Link>
                {isAdmin && <Link href="/admin" className={mobileLinkClass('/admin')}>Admin</Link>}
                {isAdmin && (
                  <Link href="/admin/feedback" className={mobileLinkClass('/admin/feedback')}>
                    <span className="flex items-center justify-between">
                      Boîte de réception
                      {unreadCount > 0 && (
                        <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">{unreadCount}</span>
                      )}
                    </span>
                  </Link>
                )}
                <button onClick={handleLogout}
                  className="block text-left px-3 py-2 rounded text-sm font-medium text-red-400 hover:bg-pool-navy-light hover:text-red-300 transition-colors">
                  {'D\u00e9connexion'}
                </button>
                <div className="px-3 py-1 text-pool-silver text-xs">{userName}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}