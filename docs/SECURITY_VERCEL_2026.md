# 🔐 Mesures de sécurité — Brèche Vercel (Avril 2026)

> Suite à l'incident de sécurité Vercel du 19 avril 2026, voici les étapes à suivre pour sécuriser ton projet.

---

## Contexte

Un employé de Vercel a accordé des permissions OAuth trop larges à un outil tiers (Context.ai), ce qui a permis à des attaquants d'accéder à des variables d'environnement **non marquées comme sensibles** pour un nombre limité de clients.

**Ce qui n'a PAS été compromis :**
- Le code source de Next.js / Turbopack
- Les packages npm de Vercel
- Les variables d'environnement marquées "sensitive"

---

## ✅ Checklist de sécurité

### 1. Rotater les clés Supabase

1. Va sur [app.supabase.com](https://app.supabase.com)
2. Sélectionne ton projet
3. **Settings → API**
4. Clique sur **"Reset"** pour régénérer :
   - `anon` (clé publique)
   - `service_role` (clé privée — priorité haute)
5. Mets à jour ces nouvelles clés dans Vercel (voir étape 2)

> ⚠️ La `service_role` donne un accès complet à ta base de données — à rotater en priorité.

---

### 2. Mettre à jour les variables d'environnement dans Vercel

1. Va sur [vercel.com/dashboard](https://vercel.com/dashboard)
2. Sélectionne ton projet
3. **Settings → Environment Variables**
4. Pour chaque variable sensible :
   - Clique sur la variable
   - Mets à jour avec la nouvelle valeur
   - Coche **"Sensitive"** pour la chiffrer au repos
5. **Redéploie** ton application pour appliquer les changements

Variables à vérifier en priorité :
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Toute autre clé API tierce (OAuth, paiement, email, etc.)

---

### 3. Marquer toutes les variables comme "Sensitive"

Vercel a amélioré la gestion des variables sensibles suite à l'incident.

1. Dans **Settings → Environment Variables**
2. Pour chaque variable contenant un secret ou une clé :
   - Active l'option **"Sensitive"**
   - Cela chiffre la valeur au repos et la masque dans les logs

> 💡 Les variables `NEXT_PUBLIC_*` sont publiques par nature — inutile de les marquer sensibles. Toutes les autres devraient l'être.

---

### 4. Auditer les accès OAuth tiers

1. Va sur [myaccount.google.com/permissions](https://myaccount.google.com/permissions)
2. Révoque l'accès à toute application tierce que tu ne reconnais pas ou n'utilises plus
3. Fais la même chose dans ton **GitHub → Settings → Applications → Authorized OAuth Apps**

---

### 5. Vérifier l'activité dans Vercel

1. Dans ton dashboard Vercel, va dans **Settings → Audit Log**
2. Vérifie s'il y a des accès inhabituels récents
3. Si Vercel t'a contacté directement, suis leurs instructions spécifiques

---

### 6. Vérifier les logs Supabase

1. Dans ton projet Supabase, va dans **Logs → API Logs**
2. Recherche des appels inhabituels ou venant d'IPs inconnues
3. Si tu vois quelque chose de suspect, contacte le support Supabase

---

## 🔒 Bonnes pratiques à adopter

| Pratique | Pourquoi |
|---|---|
| Toujours marquer les secrets comme "Sensitive" dans Vercel | Chiffrement au repos, masqué dans les logs |
| Ne jamais committer de clés dans GitHub | Utilise uniquement les variables d'environnement Vercel |
| Activer le 2FA sur Vercel, GitHub et Supabase | Protection contre la compromission de compte |
| Limiter les permissions OAuth des outils tiers | Principe du moindre privilège |
| Rotater les clés régulièrement | Limite la fenêtre d'exposition en cas de fuite |

---

## 📚 Ressources

- [Bulletin de sécurité Vercel — Avril 2026](https://vercel.com/kb/bulletin/vercel-april-2026-security-incident)
- [CVE-2025-55184 et CVE-2025-55183 (Next.js)](https://vercel.com/kb/bulletin/security-bulletin-cve-2025-55184-and-cve-2025-55183)
- [Documentation Supabase — Rotation des clés](https://supabase.com/docs/guides/platform/api-keys)
- [Variables d'environnement Vercel](https://vercel.com/docs/environment-variables)

---

*Document créé le 23 avril 2026 — À mettre à jour si de nouvelles informations émergent.*
