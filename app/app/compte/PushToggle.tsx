'use client'

import { useEffect, useState } from 'react'
import { subscribePushAction, unsubscribePushAction } from './push-actions'

type State = 'loading' | 'unsupported' | 'denied' | 'subscribed' | 'unsubscribed'

export default function PushToggle() {
  const [state, setState] = useState<State>('loading')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported')
      return
    }
    if (Notification.permission === 'denied') {
      setState('denied')
      return
    }
    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription()
      setState(sub ? 'subscribed' : 'unsubscribed')
    })
  }, [])

  async function handleSubscribe() {
    setBusy(true)
    setMsg(null)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      })
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
      const res = await subscribePushAction(json)
      if (res.error) { setMsg(res.error); return }
      setState('subscribed')
      setMsg('Notifications activées.')
    } catch {
      setMsg("Impossible d'activer les notifications. Vérifiez les permissions du navigateur.")
    } finally {
      setBusy(false)
    }
  }

  async function handleUnsubscribe() {
    setBusy(true)
    setMsg(null)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await unsubscribePushAction(sub.endpoint)
        await sub.unsubscribe()
      }
      setState('unsubscribed')
      setMsg('Notifications désactivées.')
    } catch {
      setMsg('Erreur lors de la désactivation.')
    } finally {
      setBusy(false)
    }
  }

  if (state === 'loading') return null

  if (state === 'unsupported') return (
    <p className="text-sm text-gray-400">
      Les notifications push ne sont pas supportées sur ce navigateur.
      Sur iPhone, l&apos;app doit être installée depuis Safari (iOS 16.4+).
    </p>
  )

  if (state === 'denied') return (
    <p className="text-sm text-orange-600">
      Les notifications sont bloquées dans les paramètres de votre navigateur.
      Autorisez-les manuellement, puis rechargez la page.
    </p>
  )

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <div className={`w-2.5 h-2.5 rounded-full ${state === 'subscribed' ? 'bg-green-500' : 'bg-gray-300'}`} />
        <span className="text-sm text-gray-700">
          {state === 'subscribed' ? 'Notifications activées sur cet appareil' : 'Notifications désactivées'}
        </span>
      </div>
      <button
        onClick={state === 'subscribed' ? handleUnsubscribe : handleSubscribe}
        disabled={busy}
        className={`px-4 py-2 rounded text-sm font-medium disabled:opacity-50 transition-colors ${
          state === 'subscribed'
            ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
      >
        {busy
          ? '...'
          : state === 'subscribed'
            ? 'Désactiver les notifications'
            : 'Activer les notifications sur cet appareil'}
      </button>
      {msg && <p className="text-sm text-green-600">{msg}</p>}
    </div>
  )
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const arr = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) arr[i] = rawData.charCodeAt(i)
  return arr.buffer as ArrayBuffer
}
