import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Hockey Pool',
    short_name: 'Pool Hockey',
    description: 'Gestion de pool de hockey long terme',
    start_url: '/',
    display: 'standalone',
    background_color: '#f9fafb',
    theme_color: '#1d4ed8',
    orientation: 'portrait',
    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  }
}
