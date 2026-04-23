export const metadata = { title: 'Aide — DB Hockey Manager' }

export default function AidePage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Aide &amp; Règlements</h1>
        <p className="text-sm text-gray-500 mt-1">Guide d&apos;utilisation et règlements du pool.</p>
      </div>

      {/* ── INSTALLATION ── */}
      <section id="installation">
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b">Installer l&apos;application</h2>
        <p className="text-sm text-gray-600 mb-6">
          DB Hockey Manager est une application web progressive (PWA). Vous pouvez l&apos;installer sur votre appareil pour y accéder comme une application normale, sans passer par un navigateur.
        </p>

        <div className="grid gap-4 sm:grid-cols-3">
          {/* Chrome / Edge desktop */}
          <div className="bg-white rounded-lg shadow p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">🖥️</span>
              <h3 className="font-semibold text-gray-800">Ordinateur</h3>
            </div>
            <p className="text-xs text-gray-500 mb-1">Chrome ou Edge</p>
            <ol className="text-sm text-gray-700 space-y-1.5 list-decimal list-inside">
              <li>Ouvrez le site dans Chrome ou Edge</li>
              <li>Cliquez sur le bouton <strong>Installer</strong> dans la barre de navigation du site</li>
              <li>Confirmez l&apos;installation dans la fenêtre qui s&apos;ouvre</li>
            </ol>
            <p className="text-xs text-gray-400 mt-3">
              Si le bouton n&apos;apparaît pas, cherchez l&apos;icône d&apos;installation (⊕) à droite de la barre d&apos;adresse du navigateur.
            </p>
          </div>

          {/* iPhone / iPad */}
          <div className="bg-white rounded-lg shadow p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">📱</span>
              <h3 className="font-semibold text-gray-800">iPhone / iPad</h3>
            </div>
            <p className="text-xs text-gray-500 mb-1">Safari uniquement</p>
            <ol className="text-sm text-gray-700 space-y-1.5 list-decimal list-inside">
              <li>Ouvrez le site dans <strong>Safari</strong></li>
              <li>Appuyez sur le bouton Partager <strong>⬆</strong> en bas de l&apos;écran</li>
              <li>Faites défiler et choisissez <strong>« Sur l&apos;écran d&apos;accueil »</strong></li>
              <li>Confirmez en appuyant sur <strong>Ajouter</strong></li>
            </ol>
            <p className="text-xs text-gray-400 mt-3">
              L&apos;icône apparaîtra sur votre écran d&apos;accueil comme une application normale.
            </p>
          </div>

          {/* Android */}
          <div className="bg-white rounded-lg shadow p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">🤖</span>
              <h3 className="font-semibold text-gray-800">Android</h3>
            </div>
            <p className="text-xs text-gray-500 mb-1">Chrome</p>
            <ol className="text-sm text-gray-700 space-y-1.5 list-decimal list-inside">
              <li>Ouvrez le site dans <strong>Chrome</strong></li>
              <li>Une bannière d&apos;installation peut apparaître automatiquement</li>
              <li>Sinon, appuyez sur le menu <strong>⋮</strong> en haut à droite</li>
              <li>Choisissez <strong>« Ajouter à l&apos;écran d&apos;accueil »</strong></li>
            </ol>
            <p className="text-xs text-gray-400 mt-3">
              L&apos;application s&apos;ouvre ensuite sans la barre d&apos;adresse du navigateur.
            </p>
          </div>
        </div>
      </section>

      {/* ── GUIDE D'UTILISATION ── */}
      <section id="guide">
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b">Guide d&apos;utilisation</h2>

        <div className="bg-amber-50 border border-amber-200 rounded-lg px-5 py-4 text-sm text-amber-800 mb-4">
          <strong>Section en construction.</strong> Les instructions seront complétées au fur et à mesure que les fonctionnalités sont déployées.
        </div>

        <div className="space-y-4">

          {/* Mon équipe */}
          <div className="bg-white rounded-lg shadow p-5">
            <h3 className="font-semibold text-gray-800 mb-3">Mon équipe</h3>
            <p className="text-sm text-gray-600 mb-3">
              Accédez à votre alignement via <strong>Pool Saison → Mon équipe</strong> dans la barre de navigation.
            </p>
            <ul className="text-sm text-gray-700 space-y-1.5">
              <li>• L&apos;onglet <strong>Organisation</strong> affiche votre roster complet: actifs, réservistes, recrues et joueurs LTIR.</li>
              <li>• Votre <strong>masse salariale</strong> et le cap restant sont affichés en haut de page.</li>
              <li>• Vos <strong>choix de repêchage</strong> sont listés en bas, regroupés par saison.</li>
              <li>• Le <strong>sélecteur de pooler</strong> en haut vous permet de consulter l&apos;alignement d&apos;un autre pooler.</li>
            </ul>
            <p className="text-xs text-gray-400 mt-3 italic">Modifications d&apos;alignement: effectuées par l&apos;administrateur seulement pour l&apos;instant.</p>
          </div>

          {/* Pool des séries */}
          <div className="bg-white rounded-lg shadow p-5">
            <h3 className="font-semibold text-gray-800 mb-3">Pool des séries éliminatoires</h3>
            <p className="text-sm text-gray-600 mb-3">
              Le pool des séries est <strong>self-service</strong> : chaque pooler fait ses propres sélections, sans passer par l&apos;administrateur.
              Accédez à vos choix via <strong>Pool Séries → Mes choix</strong>.
            </p>
            <h4 className="text-sm font-semibold text-gray-700 mb-1.5">Faire vos sélections</h4>
            <ul className="text-sm text-gray-700 space-y-1.5 mb-4">
              <li>• Choisissez <strong>3 attaquants, 2 défenseurs et 1 gardien</strong> pour la ronde en cours.</li>
              <li>• Seuls les joueurs dont l&apos;équipe est encore active dans les séries apparaissent dans la liste.</li>
              <li>• Votre sélection doit respecter le <strong>cap de la ronde</strong> (environ 25 M$).</li>
              <li>• Les joueurs sont triés par équipe puis par salaire pour faciliter la navigation.</li>
              <li>• Cliquez sur <strong>Soumettre mes choix</strong> pour confirmer. Vous pouvez modifier votre sélection tant que la ronde n&apos;est pas fermée.</li>
            </ul>
            <h4 className="text-sm font-semibold text-gray-700 mb-1.5">Entre les rondes</h4>
            <ul className="text-sm text-gray-700 space-y-1.5">
              <li>• Vous pouvez <strong>conserver ou remplacer</strong> vos joueurs au début de chaque nouvelle ronde.</li>
              <li>• Si l&apos;équipe d&apos;un de vos joueurs est éliminée, vous <strong>devez le remplacer</strong> avant la ronde suivante.</li>
            </ul>
          </div>

          {/* Classement */}
          <div className="bg-white rounded-lg shadow p-5">
            <h3 className="font-semibold text-gray-800 mb-3">Classement</h3>
            <p className="text-sm text-gray-600 mb-3">
              Accédez au classement via <strong>Classement → Saison complète</strong> ou via la page d&apos;accueil.
            </p>
            <ul className="text-sm text-gray-700 space-y-1.5">
              <li>• Le tableau affiche le rang, les points totaux et le détail (buts, passes, victoires, défaites prol.).</li>
              <li>• Cliquez sur le nom d&apos;un pooler pour consulter son alignement complet.</li>
              <li>• La page d&apos;accueil affiche aussi un widget <strong>Joueurs en action ce soir</strong> : combien de joueurs de chaque pooler jouent le soir même.</li>
            </ul>
            <p className="text-xs text-gray-400 mt-3 italic">Classements hebdomadaire et mensuel à venir.</p>
          </div>

          {/* Transactions */}
          <div className="bg-white rounded-lg shadow p-5">
            <h3 className="font-semibold text-gray-800 mb-3">Transactions</h3>
            <p className="text-sm text-gray-600 mb-3">
              Consultez l&apos;historique des mouvements via <strong>Pool Saison → Transactions</strong>.
            </p>
            <ul className="text-sm text-gray-700 space-y-1.5">
              <li>• Les transactions sont séparées en deux catégories: <strong>Échanges</strong> (joueurs et picks entre poolers) et <strong>Ajustements</strong> (signatures, libérations, changements de type).</li>
              <li>• Toutes les transactions sont effectuées par l&apos;administrateur.</li>
            </ul>
          </div>

          {/* Statistiques */}
          <div className="bg-white rounded-lg shadow p-5">
            <h3 className="font-semibold text-gray-800 mb-3">Statistiques LNH</h3>
            <p className="text-sm text-gray-600 mb-3">
              Accédez aux statistiques via <strong>Statistiques → LNH</strong>.
            </p>
            <ul className="text-sm text-gray-700 space-y-1.5">
              <li>• Consultez les stats des patineurs (triés par points) et des gardiens (triés par victoires).</li>
              <li>• Un <strong>point vert</strong> indique qu&apos;un joueur appartient déjà à un pooler dans la saison active.</li>
              <li>• Basculez entre <strong>Saison régulière</strong> et <strong>Séries</strong> avec le toggle en haut à droite.</li>
              <li>• Filtrez par attaquants / défenseurs et effectuez une recherche par nom.</li>
            </ul>
          </div>

        </div>
      </section>

      {/* ── RÈGLEMENTS ── */}
      <section id="reglements">
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b">Règlements du pool</h2>

        <div className="bg-blue-50 border border-blue-200 rounded-lg px-5 py-4 text-sm text-blue-800 mb-6">
          Ces règlements sont évolutifs. Cette section sera mise à jour au fur et à mesure que les règles sont clarifiées ou que de nouvelles fonctionnalités sont implémentées.
        </div>

        <div className="space-y-4">

          <div className="bg-white rounded-lg shadow p-5">
            <h3 className="font-semibold text-gray-800 mb-3">Structure de l&apos;alignement</h3>
            <ul className="text-sm text-gray-700 space-y-1.5">
              <li>• <strong>12 attaquants</strong> actifs</li>
              <li>• <strong>6 défenseurs</strong> actifs</li>
              <li>• <strong>2 gardiens</strong> actifs</li>
              <li>• Minimum <strong>2 réservistes</strong> (toutes positions confondues)</li>
            </ul>
          </div>

          <div className="bg-white rounded-lg shadow p-5">
            <h3 className="font-semibold text-gray-800 mb-3">Plafond salarial</h3>
            <ul className="text-sm text-gray-700 space-y-1.5">
              <li>• Le cap du pool est fixé par l&apos;administrateur. Il est calculé à partir du plafond salarial NHL de la saison, multiplié par un facteur (généralement 1.24–1.25) et arrondi au million supérieur.</li>
              <li>• Le facteur et le plafond NHL peuvent être ajustés par l&apos;administrateur avant ou pendant une saison.</li>
              <li>• Seuls les joueurs <strong>actifs</strong> et <strong>réservistes</strong> comptent dans la masse salariale</li>
              <li>• Les joueurs en <strong>LTIR</strong> et dans la <strong>banque de recrues</strong> ne comptent <em>pas</em> dans la masse</li>
            </ul>
          </div>

          <div className="bg-white rounded-lg shadow p-5">
            <h3 className="font-semibold text-gray-800 mb-3">Banque de recrues</h3>
            <ul className="text-sm text-gray-700 space-y-1.5">
              <li>• Un joueur <strong>repêché</strong> est protégé pendant <strong>5 saisons</strong> à partir de son année de repêchage</li>
              <li>• Un <strong>agent libre ELC</strong> est protégé uniquement pendant la durée de son contrat ELC</li>
              <li>• Un joueur en banque de recrues ne compte pas dans la masse salariale, même s&apos;il joue dans la LNH</li>
            </ul>
          </div>

          <div className="bg-white rounded-lg shadow p-5">
            <h3 className="font-semibold text-gray-800 mb-3">Transactions &amp; échanges</h3>
            <ul className="text-sm text-gray-700 space-y-1.5">
              <li>• Les transactions sont effectuées par l&apos;administrateur</li>
              <li>• <span className="italic text-gray-400">Règles additionnelles à venir (nombre d&apos;échanges permis, délai de désactivation, etc.)</span></li>
            </ul>
          </div>

          <div className="bg-white rounded-lg shadow p-5">
            <h3 className="font-semibold text-gray-800 mb-3">Pool des séries éliminatoires</h3>
            <ul className="text-sm text-gray-700 space-y-1.5">
              <li>• Chaque pooler sélectionne <strong>3 attaquants, 2 défenseurs et 1 gardien</strong> par ronde</li>
              <li>• Un cap d&apos;environ <strong>25 M$</strong> s&apos;applique à la sélection active</li>
              <li>• Si l&apos;équipe d&apos;un joueur est éliminée, un remplacement est obligatoire avant la ronde suivante</li>
              <li>• Les poolers peuvent conserver ou changer leurs joueurs entre chaque ronde</li>
              <li>• Pointage: buts, passes, victoires de gardien, défaites en prolongation/fusillade</li>
            </ul>
          </div>

        </div>
      </section>

      <p className="text-xs text-gray-400 text-right">
        Dernière mise à jour: avril 2026
      </p>
    </div>
  )
}
