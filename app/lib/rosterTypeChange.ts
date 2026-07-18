// Un changement de type (actif ↔ réserviste ↔ recrue ↔ ltir) sur une ligne pooler_rosters
// existante ne crée jamais de nouvelle ligne — added_at reste donc celui du tout premier
// ajout. Si la date effective de ce changement est antérieure à added_at (ex: ajout en
// temps réel suivi d'une correction à une date passée via "Forcer une date effective" ou
// l'onglet Historique), buildStandings() ignorerait tous les matchs entre les deux, même
// avec le bon statut dans roster_change_log — added_at borne la fenêtre en premier lieu.
// La date effective saisie fait foi comme date de début : on recule added_at, avec un
// avertissement non bloquant pour que l'admin le sache.
export function computeTypeChangeAddedAt(
  currentAddedAt: string | null,
  effectiveTs: string,
): { addedAtOverride?: string; warning?: string } {
  if (currentAddedAt && effectiveTs < currentAddedAt) {
    return {
      addedAtOverride: effectiveTs,
      warning: `Date d'ajout au roster reculée du ${currentAddedAt.slice(0, 10)} au ${effectiveTs.slice(0, 10)} pour couvrir la transaction.`,
    }
  }
  return {}
}
