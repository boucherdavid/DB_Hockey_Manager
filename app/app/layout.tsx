import type { Metadata } from 'next'
import './globals.css'
import Navbar from '@/components/Navbar'
import ServiceWorkerProvider from '@/components/ServiceWorkerProvider'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Hockey Pool',
  description: 'Gestion de pool de hockey long terme',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Pool Hockey',
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

  return (
    <html lang="fr">
      <body className="bg-gray-50 min-h-screen">
        <ServiceWorkerProvider />
        <Navbar initialUserName={userName} initialIsAdmin={isAdmin} />
        <main className="max-w-7xl mx-auto px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  )
}
