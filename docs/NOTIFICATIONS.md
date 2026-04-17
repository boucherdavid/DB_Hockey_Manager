# 🏒 Notifications Push — Pool de Hockey

> Notes d'architecture générées depuis Claude (mobile)  
> À intégrer dans le projet Next.js / Vercel / Supabase

---

## Stack technologique

| Composant | Rôle |
|---|---|
| **Vercel** | Hébergement + domaine custom |
| **PWA** | Installation mobile sans App Store |
| **Supabase** | Base de données + Auth + Edge Functions + Cron |
| **Firebase Cloud Messaging (FCM)** | Livraison des notifications push |
| **Web Push API + VAPID** | Protocole push natif navigateur |

---

## 1. Installation mobile (PWA)

- L'app est accessible via un lien URL
- L'utilisateur l'ajoute à son écran d'accueil depuis le navigateur
- **Android** : support complet des notifications push
- **iOS 16.4+** : support des notifications, mais l'app doit être ajoutée à l'écran d'accueil d'abord
- Aucun App Store requis

---

## 2. Architecture des notifications

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
Lecture des préférences utilisateur
        ↓
Envoi notification personnalisée via FCM (seulement si préférence activée)
```

### Tables Supabase à créer

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
  classement_jour TEXT DEFAULT 'lundi',             -- jour de la semaine
  classement_heure TIME DEFAULT '08:00',
  alerte_blessures BOOLEAN DEFAULT true,
  resume_soiree BOOLEAN DEFAULT true,
  resume_heure TIME DEFAULT '22:00',
  updated_at TIMESTAMP DEFAULT now()
);
```

---

## 3. Types de notifications

### 🏆 Classement (fréquence personnalisée)

- **Déclencheur** : cron job Supabase (pg_cron)
- **Contenu** : position actuelle, variation, points totaux
- **Fréquence** : selon `classement_frequence` de chaque utilisateur

```
📊 Votre classement — Lundi 14 avril
Vous êtes 2e sur 10 poolers 🔼
Total : 142 points (+8 cette semaine)
```

### 🚑 Alerte blessure

- **Déclencheur** : webhook sur la table `blessures` (INSERT)
- **Condition** : le joueur blessé est dans l'équipe du pooler ET `alerte_blessures = true`
- **Contenu** : nom du joueur, type de blessure, impact estimé

```
🚑 Alerte — Auston Matthews
Blessure au poignet — Absent 2 semaines
Il est dans votre équipe de pool !
```

### 🌙 Résumé de soirée

- **Déclencheur** : cron job chaque soir (heure personnalisée)
- **Condition** : `resume_soiree = true`
- **Contenu** : points gagnés dans la soirée, joueurs ayant performé, classement mis à jour

```
🏒 Votre soirée — Lundi 14 avril
Matthews : 1 but = +2 pts
Pastrnak : 2 passes = +2 pts
Total soirée : +4 pts 🔥
Classement : 2e place (inchangé)
```

---

## 4. Cron Jobs Supabase (pg_cron)

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

## 5. Edge Function — Exemple résumé de soirée

```typescript
// supabase/functions/send-evening-summary/index.ts

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

  // 2. Pour chaque user, calculer ses points de la soirée
  for (const user of users) {
    const summary = await getUserEveningSummary(user.user_id)

    // 3. Récupérer son token push
    const { data: sub } = await supabase
      .from('push_subscriptions')
      .select('token')
      .eq('user_id', user.user_id)
      .single()

    // 4. Envoyer la notification personnalisée via FCM
    await sendPushNotification(sub.token, {
      title: `🏒 Votre soirée — ${formatDate(new Date())}`,
      body: formatSummary(summary),
    })
  }

  return new Response('OK')
})
```

---

## 6. Côté frontend — Enregistrement du token

```typescript
// hooks/usePushNotifications.ts

export async function subscribeToPush(userId: string) {
  const registration = await navigator.serviceWorker.ready

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  })

  // Sauvegarder le token dans Supabase
  await supabase.from('push_subscriptions').upsert({
    user_id: userId,
    token: JSON.stringify(subscription),
    platform: detectPlatform(),
  })
}
```

---

## 7. Page de préférences utilisateur

À créer dans l'app : `/settings/notifications`

Permettre à l'utilisateur de configurer :
- [ ] Fréquence du classement (jamais / hebdo / quotidien)
- [ ] Jour et heure de réception du classement
- [ ] Alertes blessures (oui / non)
- [ ] Résumé de soirée (oui / non)
- [ ] Heure du résumé de soirée

---

## 8. Ressources utiles

- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Supabase pg_cron](https://supabase.com/docs/guides/database/extensions/pg_cron)
- [Supabase Push Notifications (docs officielles)](https://supabase.com/docs/guides/functions/examples/push-notifications)
- [Next.js PWA Guide](https://nextjs.org/docs/app/guides/progressive-web-apps)
- [Web Push VAPID Keys](https://vapidkeys.com/)
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)
