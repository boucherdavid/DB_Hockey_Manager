# 📱 Mobile Setup — Pool de Hockey

> Notes d'architecture complètes générées depuis Claude  
> Couvre : PWA, domaine custom Vercel, notifications push, préférences Supabase  
> À utiliser comme contexte pour Claude Code lors de l'intégration

---

## Table des matières

1. [Stack technologique](#1-stack-technologique)
2. [Configuration PWA](#2-configuration-pwa)
3. [Domaine custom Vercel](#3-domaine-custom-vercel)
4. [Architecture des notifications](#4-architecture-des-notifications)
5. [Tables Supabase](#5-tables-supabase)
6. [Types de notifications personnalisées](#6-types-de-notifications-personnalisées)
7. [Cron Jobs Supabase](#7-cron-jobs-supabase)
8. [Edge Functions](#8-edge-functions)
9. [Frontend — Enregistrement push](#9-frontend--enregistrement-push)
10. [Page de préférences utilisateur](#10-page-de-préférences-utilisateur)
11. [Ressources utiles](#11-ressources-utiles)

---

## 1. Stack technologique

| Composant | Rôle |
|---|---|
| **Next.js** | Framework frontend |
| **Vercel** | Hébergement + domaine custom |
| **PWA** | Installation mobile sans App Store |
| **Supabase** | Base de données + Auth + Edge Functions + Cron |
| **Firebase Cloud Messaging (FCM)** | Livraison des notifications push |
| **Web Push API + VAPID** | Protocole push natif navigateur |

---

## 2. Configuration PWA

### Pourquoi une PWA ?

- L'app s'installe sur mobile via un lien URL, sans App Store ni Google Play
- **Android** : support complet, notifications push natives
- **iOS 16.4+** : support des notifications, l'app doit être ajoutée à l'écran d'accueil
- Mises à jour instantanées sans validation d'app store
- Un seul codebase pour Android, iOS et desktop

### 2.1 Manifest — `app/manifest.ts`

```typescript
import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Pool de Hockey',
    short_name: 'Pool Hockey',
    description: 'Gérez votre pool de hockey entre amis',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0a0a',
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
```

### 2.2 Service Worker — `public/sw.js`

```javascript
// Gestion du cache
const CACHE_NAME = 'pool-hockey-v1'
const STATIC_ASSETS = ['/', '/offline']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  )
})

self.addEventListener('fetch', (event) => {
  // Ne pas cacher les données utilisateur Supabase
  if (event.request.url.includes('supabase')) return

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  )
})

// Réception des notifications push
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      data: { url: data.url || '/' },
    })
  )
})

// Clic sur une notification → ouvre l'app
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(clients.openWindow(event.notification.data.url))
})
```

### 2.3 Enregistrement du Service Worker — `app/layout.tsx`

```typescript
'use client'
import { useEffect } from 'react'

export default function RootLayout({ children }) {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
    }
  }, [])

  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}
```

### 2.4 Icônes requises

Créer dans `public/icons/` :
- `icon-72x72.png`
- `icon-96x96.png`
- `icon-128x128.png`
- `icon-144x144.png`
- `icon-152x152.png`
- `icon-192x192.png` ← requis
- `icon-384x384.png`
- `icon-512x512.png` ← requis
- `badge-72x72.png` (icône monochrome pour la barre de notification)

> 💡 Outil recommandé : [PWA Asset Generator](https://github.com/elegantapp/pwa-asset-generator)  
> Génère toutes les tailles depuis une seule image source.

### 2.5 Configuration Next.js — `next.config.ts`

```typescript
const nextConfig = {
  headers: async () => [
    {
      source: '/sw.js',
      headers: [
        { key: 'Service-Worker-Allowed', value: '/' },
        { key: 'Cache-Control', value: 'no-cache' },
      ],
    },
  ],
}

export default nextConfig
```

---

## 3. Domaine custom Vercel

### Pourquoi un domaine custom ?

- URL professionnelle (ex. `poolhockey.ca` au lieu de `pool-hockey.vercel.app`)
- Requis pour que les notifications push iOS fonctionnent de manière fiable
- Certificat SSL automatique fourni par Vercel

### Étapes de configuration

1. Acheter un domaine (via Vercel ou un registrar tiers comme Namecheap)
2. Dans Vercel : **Project Settings** → **Domains** → **Add**
3. Configurer les DNS chez le registrar :
   - Domaine racine (`poolhockey.ca`) → **A record** pointant vers `76.76.21.21`
   - Sous-domaine (`www.poolhockey.ca`) → **CNAME** pointant vers `cname.vercel-dns.com`
4. Vercel provisione le certificat SSL automatiquement (~quelques minutes)

### Coût estimé (en CAD)

| Élément | Coût |
|---|---|
| Domaine `.ca` ou `.com` | ~21–34 CAD/an |
| Plan Vercel Hobby | Gratuit |
| Plan Vercel Pro (si production) | ~27 CAD/mois |

---

## 4. Architecture des notifications

### Flux général

```
Événement NHL (but, blessure, fin de match)
        ↓
Mise à jour table Supabase
        ↓
Database Webhook déclenché
        ↓
Supabase Edge Function
        ↓
Lecture des préférences de chaque utilisateur
        ↓
Envoi notification personnalisée via FCM
(seulement aux utilisateurs concernés avec la préférence activée)
```

---

## 5. Tables Supabase

```sql
-- Tokens de notification par utilisateur
CREATE TABLE push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT, -- 'android' | 'ios' | 'web'
  created_at TIMESTAMP DEFAULT now()
);

-- Préférences de notifications par utilisateur
CREATE TABLE notification_preferences (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  classement_frequence TEXT DEFAULT 'hebdomadaire', -- 'quotidien' | 'hebdomadaire' | 'jamais'
  classement_jour TEXT DEFAULT 'lundi',
  classement_heure TIME DEFAULT '08:00',
  alerte_blessures BOOLEAN DEFAULT true,
  resume_soiree BOOLEAN DEFAULT true,
  resume_heure TIME DEFAULT '22:00',
  updated_at TIMESTAMP DEFAULT now()
);

-- Activer Row Level Security
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Politique : chaque utilisateur accède uniquement à ses données
CREATE POLICY "users_own_subscriptions" ON push_subscriptions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users_own_preferences" ON notification_preferences
  FOR ALL USING (auth.uid() = user_id);
```

---

## 6. Types de notifications personnalisées

### 🏆 Classement (fréquence choisie par l'utilisateur)

- **Déclencheur** : cron job Supabase
- **Condition** : `classement_frequence != 'jamais'`
- **Exemple** :

```
📊 Votre classement — Lundi 14 avril
Vous êtes 2e sur 10 poolers 🔼
Total : 142 points (+8 cette semaine)
```

### 🚑 Alerte blessure

- **Déclencheur** : webhook sur INSERT dans la table `blessures`
- **Condition** : le joueur blessé est dans l'équipe du pooler ET `alerte_blessures = true`
- **Exemple** :

```
🚑 Alerte — Auston Matthews
Blessure au poignet — Absent 2 semaines
Il est dans votre équipe de pool !
```

### 🌙 Résumé de soirée

- **Déclencheur** : cron job chaque soir à l'heure choisie par l'utilisateur
- **Condition** : `resume_soiree = true`
- **Exemple** :

```
🏒 Votre soirée — Lundi 14 avril
Matthews : 1 but = +2 pts
Pastrnak : 2 passes = +2 pts
Total soirée : +4 pts 🔥
Classement : 2e place (inchangé)
```

---

## 7. Cron Jobs Supabase

> Activer l'extension pg_cron dans Supabase Dashboard → Database → Extensions

```sql
-- Résumé de soirée — tous les soirs à 22h
SELECT cron.schedule(
  'resume-soiree-quotidien',
  '0 22 * * *',
  'SELECT send_evening_summary()'
);

-- Classement hebdomadaire — tous les lundis à 8h
SELECT cron.schedule(
  'classement-hebdomadaire',
  '0 8 * * 1',
  'SELECT send_weekly_standings()'
);

-- Classement quotidien — tous les matins à 8h
SELECT cron.schedule(
  'classement-quotidien',
  '0 8 * * *',
  'SELECT send_daily_standings()'
);
```

---

## 8. Edge Functions

### Structure des fichiers

```
supabase/
└── functions/
    ├── send-evening-summary/
    │   └── index.ts
    ├── send-standings/
    │   └── index.ts
    └── send-injury-alert/
        └── index.ts
```

### Exemple — Résumé de soirée

```typescript
// supabase/functions/send-evening-summary/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // 1. Récupérer tous les users avec resume_soiree = true
  const { data: users } = await supabase
    .from('notification_preferences')
    .select('user_id, resume_heure')
    .eq('resume_soiree', true)

  for (const user of users ?? []) {
    // 2. Calculer les points de la soirée pour cet utilisateur
    const { data: summary } = await supabase
      .rpc('get_evening_summary', { p_user_id: user.user_id })

    // 3. Récupérer son token push
    const { data: sub } = await supabase
      .from('push_subscriptions')
      .select('token')
      .eq('user_id', user.user_id)
      .single()

    if (!sub?.token) continue

    // 4. Envoyer via FCM
    await fetch('https://fcm.googleapis.com/v1/projects/YOUR_PROJECT/messages:send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('FCM_ACCESS_TOKEN')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          token: sub.token,
          notification: {
            title: `🏒 Votre soirée — ${new Date().toLocaleDateString('fr-CA')}`,
            body: summary?.description ?? 'Aucun point ce soir.',
          },
        },
      }),
    })
  }

  return new Response('OK')
})
```

---

## 9. Frontend — Enregistrement push

```typescript
// hooks/usePushNotifications.ts
import { createClient } from '@/utils/supabase/client'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)))
}

export async function subscribeToPush(userId: string) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push non supporté sur ce navigateur')
    return
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return

  const registration = await navigator.serviceWorker.ready

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  })

  const supabase = createClient()
  await supabase.from('push_subscriptions').upsert({
    user_id: userId,
    token: JSON.stringify(subscription),
    platform: /iPhone|iPad/.test(navigator.userAgent) ? 'ios' : 'android',
  })
}
```

### Variables d'environnement requises

```env
# .env.local
NEXT_PUBLIC_VAPID_PUBLIC_KEY=votre_cle_vapid_publique
VAPID_PRIVATE_KEY=votre_cle_vapid_privee
NEXT_PUBLIC_SUPABASE_URL=votre_url_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre_anon_key
```

> 💡 Générer des clés VAPID : [https://vapidkeys.com](https://vapidkeys.com)

---

## 10. Page de préférences utilisateur

À créer : `app/settings/notifications/page.tsx`

Interface permettant à chaque pooler de configurer :

- [ ] **Classement** : jamais / hebdomadaire / quotidien
- [ ] **Jour de réception** du classement (si hebdomadaire)
- [ ] **Heure de réception** du classement
- [ ] **Alertes blessures** : activé / désactivé
- [ ] **Résumé de soirée** : activé / désactivé
- [ ] **Heure du résumé** de soirée

Les préférences sont sauvegardées dans la table `notification_preferences` de Supabase en temps réel.

---

## 11. Ressources utiles

| Ressource | Lien |
|---|---|
| Next.js PWA Guide | https://nextjs.org/docs/app/guides/progressive-web-apps |
| Supabase Edge Functions | https://supabase.com/docs/guides/functions |
| Supabase pg_cron | https://supabase.com/docs/guides/database/extensions/pg_cron |
| Supabase Push Notifications | https://supabase.com/docs/guides/functions/examples/push-notifications |
| Firebase Cloud Messaging | https://firebase.google.com/docs/cloud-messaging |
| Générateur clés VAPID | https://vapidkeys.com |
| PWA Asset Generator | https://github.com/elegantapp/pwa-asset-generator |
| Test PWA (Chrome DevTools) | chrome://inspect → Application → Manifest |
