# Saisie de l'historique des mouvements de roster

Ce document décrit la procédure suivie pour reconstituer, dans `pooler_rosters`,
l'historique complet des mouvements d'alignement d'une saison à partir d'un
fichier consolidé (ex. `excel/Mouvements_consolides.xlsx`). Écrit après la
session du 2026-07-09 — opération jugée ponctuelle par David (ne devrait pas
se reproduire), conservé ici comme trace/référence si besoin un jour.

---

## Préparation des données

Le fichier source doit être consolidé et **trié chronologiquement** avant la
saisie. Deux scripts existants s'en chargent :

```bash
cd python_script
python extract_mouvements.py   # extrait les mouvements bruts
python sort_mouvements.py      # trie chronologiquement
```

Résultat : `excel/Mouvements_consolides.xlsx` (gitignored, local).

---

## Où saisir : onglet Historique, pas Mouvements

Le menu **Admin > Gestion des effectifs** (`/admin/effectifs`) contient
plusieurs onglets. Deux d'entre eux permettent de modifier `pooler_rosters`,
mais ils ont des usages très différents :

| | Onglet **Mouvements** | Onglet **Historique** |
|---|---|---|
| Usage prévu | Gestion courante en direct | Reconstruction d'un historique passé |
| Validation cap/composition (12A/6D/2G, ≥2 réservistes) | **Bloque** la soumission si non respecté | Aucune validation |
| Budget agents libres / LTIR | Compté et limité | Ignoré (écrit dans `roster_change_log` avec des `change_type` préfixés `hist_`, jamais comptés dans les budgets `signature_agent_libre`/`signature_ltir`) |
| Types de mouvement | swap actif/réserve, activation recrue, LTIR, retour LTIR, signature, ballotage, libération | Échange même pooler, échange entre poolers (trade), ajout seul, retrait seul |
| Date appliquée à `added_at` / `removed_at` | Oui, via checkbox "Forcer une date effective" | Oui, toujours (champ Date obligatoire) |

L'onglet **Historique** (`app/app/admin/historique/`, composant
`HistoriqueManager.tsx` + `historique-actions.ts`) a été construit
spécifiquement pour ce cas d'usage (commit `01cafb1` — *feat(admin): page
/admin/historique — saisie transactions historiques 2024-25*) : aucune
contrainte de roster valide à chaque étape, ce qui permet de rejouer des
mouvements un par un sans que l'état intermédiaire soit conforme aux règles
du pool.

> ⚠️ Ne pas utiliser l'onglet Mouvements pour de la saisie historique en
> lot : les validations de cap/composition et les compteurs d'agents libres
> bloqueront rapidement des scénarios historiques légitimes.

---

## Procédure

1. Ouvrir `excel/Mouvements_consolides.xlsx` comme référence (déjà trié
   chronologiquement).
2. Aller sur `/admin/effectifs`, onglet **Historique**.
3. Pour **chaque ligne du fichier, dans l'ordre chronologique strict** :
   - La liste déroulante "Joueur retiré / cédé" ne montre que le roster
     **réellement actif en base** au moment de la saisie — pas un état
     hypothétique. Sauter l'ordre chronologique produit des sélections
     impossibles ou incorrectes.
   - Choisir le **type de transaction** :
     - **Échange même pooler** — sortie + entrée chez le même pooler
       (remplacement 1 pour 1, ex. libération + signature simultanée).
     - **Échange entre poolers** — trade A ↔ B (un joueur part de A vers B,
       un autre part de B vers A).
     - **Ajout seulement** — signature sans coupure correspondante.
     - **Retrait seulement** — coupure sans remplacement.
   - Choisir la **date** exacte du mouvement (devient `added_at`/`removed_at`
     à midi UTC ce jour-là).
   - Sélectionner le/les pooler(s) et joueur(s) concernés (recherche par nom
     pour les entrées, liste du roster actuel pour les sorties).
   - Cliquer **Enregistrer la transaction**.
4. Le panneau "Journal des transactions" (à droite) confirme chaque
   ajout/retrait immédiatement — vérifier après chaque lot pour repérer une
   erreur de saisie rapidement plutôt qu'à la fin. Le journal affiche deux
   dates distinctes : **Date effective** (la date choisie à l'étape 3, celle
   qui alimente `added_at`/`removed_at`) et **Saisi le** (le moment réel de
   la soumission, colonne `created_at` de `roster_change_log`) — utile
   puisque la saisie historique se fait dans le désordre par rapport à
   aujourd'hui, donc trier par date effective ne remonte pas forcément
   l'entrée qu'on vient de faire. Le journal peut être filtré par type de
   transaction (boutons au-dessus du tableau).
5. Le message vert "✓ Transaction enregistrée" confirme la soumission et le
   formulaire se réinitialise (pooler et date conservés, champs joueur
   vidés) pour enchaîner rapidement sur la ligne suivante du fichier.

---

## Validation après la saisie

- `/admin/historique` (vue classement/historique poolers) et
  `/poolers/[id]` permettent de valider visuellement que les points et les
  rosters historiques sont cohérents avec le fichier source.
- `buildStandings()` (`app/lib/standings.ts`) calcule les points en filtrant
  les game-logs sur la fenêtre `added_at → removed_at` de chaque ligne
  `pooler_rosters` — une date mal saisie ici fausse directement les points
  attribués pour la période concernée.

---

## Points d'attention

- **Aucun garde-fou** de cap, de composition, ni de doublon dans l'onglet
  Historique — une erreur de joueur ou de pooler ne sera pas bloquée par
  l'outil. Aller lentement, valider le journal régulièrement.
- Chaque "ajout" crée une **nouvelle ligne** `pooler_rosters` (pas de
  réutilisation d'une ligne existante même si le même joueur était déjà
  passé chez ce pooler plus tôt dans la saison) — comportement voulu : un
  joueur qui quitte puis revient chez un pooler a deux fenêtres de tenure
  distinctes, chacune avec ses propres `added_at`/`removed_at`.
- L'onglet écrit bien dans `roster_change_log` (types `hist_swap`,
  `hist_trade`, `hist_ajout`, `hist_retrait`) pour permettre le journal à
  deux dates, mais ces types ne sont jamais comptés dans les budgets
  agents libres/LTIR (filtrés sur `signature_agent_libre`/`signature_ltir`
  ailleurs dans le code) ni dans le délai de réactivation. Normal pour du
  backfill historique — à garder en tête si les compteurs de la saison
  courante semblent incomplets après une saisie historique tardive.
- Nécessite la colonne `roster_change_log.created_at` (migration
  `supabase_migrations/roster_change_log_created_at.sql`, ajoutée le
  2026-07-09/10). Sans cette colonne, la soumission échoue.
