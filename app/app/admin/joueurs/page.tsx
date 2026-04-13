import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function AdminJoueursPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: pooler } = await supabase.from('poolers').select('is_admin').eq('id', user.id).single()
  if (!pooler?.is_admin) redirect('/')

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin" className="text-sm text-gray-400 hover:text-gray-600">{'\u2190 Admin'}</Link>
        <h1 className="text-2xl font-bold text-gray-800 mt-1">{'Mise \u00e0 jour des donn\u00e9es joueurs'}</h1>
        <p className="text-gray-500 mt-2 max-w-3xl">
          {'La source de v\u00e9rit\u00e9 des joueurs et contrats est le pipeline Python bas\u00e9 sur PuckPedia. '}
          {'Les modifications manuelles dans l\u2019application ne sont plus le flux recommand\u00e9, car elles seraient \u00e9cras\u00e9es au prochain import.'}
        </p>
      </div>

      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">Flux officiel</h2>
        <ol className="list-decimal pl-5 space-y-2 text-sm text-gray-700">
          <li>{'Lancer le scraping PuckPedia pour g\u00e9n\u00e9rer ou rafra\u00eechir les fichiers CSV.'}</li>
          <li>{'Importer ensuite ces donn\u00e9es vers Supabase.'}</li>
          <li>{'Recharger l\u2019application et valider les changements sur les pages joueurs et alignements.'}</li>
        </ol>
      </div>

      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">{'Commandes \u00e0 ex\u00e9cuter'}</h2>
        <p className="text-sm text-gray-600">Depuis le dossier <code>python_script</code> :</p>
        <pre className="bg-slate-950 text-slate-100 rounded-lg p-4 overflow-x-auto text-sm"><code>{`cd C:\\Projet_Codex\\Hockey_Pool_App\\python_script
.\\venv\\Scripts\\python.exe .\\scrape_puckpedia.py
.\\venv\\Scripts\\python.exe .\\import_supabase.py`}</code></pre>
      </div>

      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">Ce que fait chaque script</h2>
        <div className="space-y-3 text-sm text-gray-700">
          <p>
            <strong>scrape_puckpedia.py</strong>
            {' t\u00e9l\u00e9charge les pages d\u2019\u00e9quipes PuckPedia, sauvegarde les HTML de diagnostic et produit les CSV consolid\u00e9s comme '}
            <code>PuckPedia_update.csv</code>
            .
          </p>
          <p>
            <strong>import_supabase.py</strong>
            {' lit le CSV consolid\u00e9, fusionne les doublons complexes, puis met \u00e0 jour les tables '}
            <code>players</code>
            {' et '}
            <code>player_contracts</code>
            {' dans Supabase.'}
          </p>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-5 space-y-2">
        <h2 className="text-sm font-semibold text-amber-900">Important</h2>
        <p className="text-sm text-amber-800">{'Les routes de cr\u00e9ation et de modification manuelle des joueurs sont d\u00e9sormais d\u00e9sactiv\u00e9es pour \u00e9viter les incoh\u00e9rences avec le pipeline d\u2019import.'}</p>
        <p className="text-sm text-amber-800">{'Si un ajustement exceptionnel est n\u00e9cessaire, il vaut mieux corriger la source Python ou le script d\u2019import plut\u00f4t que modifier un joueur \u00e0 la main dans l\u2019interface.'}</p>
      </div>
    </div>
  )
}