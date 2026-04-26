import type { Metadata } from 'next'
import './globals.css'
import Navbar from '@/components/Navbar'
import InstallBanner from '@/components/InstallBanner'
import ServiceWorkerProvider from '@/components/ServiceWorkerProvider'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'DB Hockey Manager',
  description: 'Gestion de pool de hockey long terme',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icons/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icons/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/icons/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'DB Hockey Manager',
  },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let userName: string | null = null
  let isAdmin = false

  if (user) {
    const { data: pooler } = await supabase
      .from('poolers')
      .select('name, is_admin')
      .eq('id', user.id)
      .single()
    if (pooler) {
      userName = pooler.name
      isAdmin = pooler.is_admin
    }
  }

  let unreadCount = 0
  if (isAdmin) {
    const { count } = await supabase
      .from('feedback')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'nouveau')
    unreadCount = count ?? 0
  }

  return (
    <html lang="fr">
      <head>
        {/* Capture beforeinstallprompt avant l'hydratation React */}
        <script dangerouslySetInnerHTML={{ __html: `
          window.addEventListener('beforeinstallprompt', function(e) {
            e.preventDefault();
            window.__pwaPrompt = e;
          });
        `}} />
      </head>
      <body className="bg-gray-50 min-h-screen">
        <ServiceWorkerProvider />
        <Navbar initialUserName={userName} initialIsAdmin={isAdmin} initialUnreadCount={unreadCount} />
        <InstallBanner />
        <main className="max-w-7xl mx-auto px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  )
}
