'use client'

import { useEffect, useState } from 'react'

export default function InstallBanner() {
  const [show, setShow] = useState(false)
  const [prompt, setPrompt] = useState<Event | null>(null)

  useEffect(() => {
    // Ne pas afficher si déjà en mode standalone (app installée)
    if (window.matchMedia('(display-mode: standalone)').matches) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const deferred = (window as any).__pwaPrompt
    if (deferred) setPrompt(deferred)

    const handler = (e: Event) => {
      e.preventDefault()
      setPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)

    const dismissed = sessionStorage.getItem('installBannerDismissed')
    if (!dismissed) setShow(true)

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!prompt) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prompt as any).prompt()
    setShow(false)
  }

  const handleDismiss = () => {
    sessionStorage.setItem('installBannerDismissed', '1')
    setShow(false)
  }

  if (!show) return null

  return (
    <div className="bg-pool-navy border-b border-pool-navy-light px-4 py-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192x192.png" alt="Logo" className="w-8 h-8 rounded shrink-0" />
        <div className="min-w-0">
          <p className="text-white text-sm font-medium">Installer DB Hockey Manager</p>
          {prompt ? (
            <p className="text-pool-silver text-xs">Accès rapide depuis votre écran d&apos;accueil</p>
          ) : (
            <p className="text-pool-silver text-xs">Menu Chrome → &quot;Ajouter à l&apos;écran d&apos;accueil&quot;</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {prompt && (
          <button
            onClick={handleInstall}
            className="bg-white text-pool-navy text-sm font-semibold px-3 py-1 rounded"
          >
            Installer
          </button>
        )}
        <button
          onClick={handleDismiss}
          className="text-pool-silver hover:text-white text-lg leading-none"
          aria-label="Fermer"
        >
          ×
        </button>
      </div>
    </div>
  )
}
