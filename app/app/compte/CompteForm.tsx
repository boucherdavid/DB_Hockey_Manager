'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { updatePasswordAction, updateProfileAction } from './actions'

type Profile = {
  name: string
  email: string
  phone: string | null
  notif_email: boolean
  notif_sms: boolean
}

export default function CompteForm({ profile }: { profile: Profile }) {
  const [phone, setPhone] = useState(profile.phone ?? '')
  const [notifEmail, setNotifEmail] = useState(profile.notif_email)
  const [notifSms, setNotifSms] = useState(profile.notif_sms)
  const [profileMsg, setProfileMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [profileBusy, setProfileBusy] = useState(false)

  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [pwdMsg, setPwdMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [pwdBusy, setPwdBusy] = useState(false)

  // Détecte le flow de réinitialisation (lien reçu par courriel)
  const [isRecovery, setIsRecovery] = useState(false)
  useEffect(() => {
    const hash = window.location.hash
    if (hash.includes('type=recovery') || hash.includes('type=email_change')) {
      setIsRecovery(true)
    }
  }, [])

  async function handleProfile(e: React.FormEvent) {
    e.preventDefault()
    setProfileBusy(true)
    setProfileMsg(null)
    const res = await updateProfileAction(phone || null, notifEmail, notifSms)
    setProfileBusy(false)
    setProfileMsg(res.error ? { type: 'err', text: res.error } : { type: 'ok', text: 'Profil mis à jour.' })
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPwd !== confirmPwd) {
      setPwdMsg({ type: 'err', text: 'Les mots de passe ne correspondent pas.' })
      return
    }

    // Si c'est un flow de récupération, on vérifie d'abord la session avec le token du hash
    if (isRecovery) {
      const supabase = createClient()
      const hashParams = new URLSearchParams(window.location.hash.slice(1))
      const accessToken = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token')
      if (accessToken && refreshToken) {
        await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      }
    }

    setPwdBusy(true)
    setPwdMsg(null)
    const res = await updatePasswordAction(newPwd)
    setPwdBusy(false)
    if (res.error) {
      setPwdMsg({ type: 'err', text: res.error })
    } else {
      setPwdMsg({ type: 'ok', text: 'Mot de passe mis à jour.' })
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('')
      setIsRecovery(false)
      // Nettoyer le hash
      window.history.replaceState(null, '', window.location.pathname)
    }
  }

  if (isRecovery) {
    return (
      <div className="max-w-md mx-auto px-4 py-12">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-xl font-bold text-gray-800 mb-1">Nouveau mot de passe</h1>
          <p className="text-sm text-gray-500 mb-6">Choisissez votre nouveau mot de passe.</p>
          <form onSubmit={handlePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nouveau mot de passe</label>
              <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} required minLength={6}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirmer</label>
              <input type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} required
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <button type="submit" disabled={pwdBusy}
              className="w-full bg-blue-600 text-white py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {pwdBusy ? 'Enregistrement...' : 'Enregistrer'}
            </button>
            {pwdMsg && <p className={`text-sm ${pwdMsg.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}>{pwdMsg.text}</p>}
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Mon compte</h1>

      {/* Infos de base */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="font-bold text-lg text-gray-800 mb-4">Informations</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex gap-3">
            <dt className="text-gray-500 w-24 shrink-0">Nom</dt>
            <dd className="font-medium text-gray-800">{profile.name}</dd>
          </div>
          <div className="flex gap-3">
            <dt className="text-gray-500 w-24 shrink-0">Courriel</dt>
            <dd className="font-medium text-gray-800">{profile.email}</dd>
          </div>
        </dl>
      </div>

      {/* Profil notifications */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="font-bold text-lg text-gray-800 mb-4">Notifications</h2>
        <form onSubmit={handleProfile} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Numéro de cellulaire <span className="text-gray-400 font-normal">(optionnel)</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="ex: 514-555-1234"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-400 mt-1">Pour les futures notifications SMS.</p>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={notifEmail}
                onChange={e => setNotifEmail(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">Notifications par courriel</span>
                <p className="text-xs text-gray-400">Recevoir les alertes du pool par courriel.</p>
              </div>
            </label>
            <label className="flex items-center gap-3 cursor-pointer opacity-60">
              <input
                type="checkbox"
                checked={notifSms}
                onChange={e => setNotifSms(e.target.checked)}
                disabled={!phone}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">Notifications par SMS</span>
                <p className="text-xs text-gray-400">
                  {phone ? 'Recevoir les alertes par texto (à venir).' : 'Entrez un numéro de cellulaire pour activer.'}
                </p>
              </div>
            </label>
          </div>

          <button type="submit" disabled={profileBusy}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {profileBusy ? 'Enregistrement...' : 'Sauvegarder'}
          </button>
          {profileMsg && (
            <p className={`text-sm ${profileMsg.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}>{profileMsg.text}</p>
          )}
        </form>
      </div>

      {/* Changement de mot de passe */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="font-bold text-lg text-gray-800 mb-4">Changer le mot de passe</h2>
        <form onSubmit={handlePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nouveau mot de passe</label>
            <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} required minLength={6}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirmer le nouveau mot de passe</label>
            <input type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} required
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <button type="submit" disabled={pwdBusy}
            className="bg-gray-700 text-white px-4 py-2 rounded text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
            {pwdBusy ? 'Enregistrement...' : 'Changer le mot de passe'}
          </button>
          {pwdMsg && <p className={`text-sm ${pwdMsg.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}>{pwdMsg.text}</p>}
        </form>
      </div>
    </div>
  )
}
