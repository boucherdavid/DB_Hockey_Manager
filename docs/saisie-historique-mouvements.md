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
       ⚠️ Le joueur sortant est **retiré complètement du pool**
       (`is_active=false`, `removed_at` posé) — ce n'est **pas** un
       ajustement actif↔réserviste (le joueur reste dans l'équipe). Pour
       ça, utiliser **Changement de type** ci-dessous.
     - **Échange entre poolers** — trade A ↔ B (un joueur part de A vers B,
       un autre part de B vers A).
     - **Ajout seulement** — signature sans coupure correspondante.
     - **Retrait seulement** — coupure sans remplacement.
     - **Changement de type** — un joueur déjà dans l'équipe change de
       statut (actif ↔ réserviste ↔ recrue) **sans quitter le pool** :
       `player_type` est mis à jour sur sa ligne existante, `added_at`
       reste intact. À utiliser pour les ajustements d'alignement
       (monter/descendre un joueur) et les mouvements de recrues
       (promotion, retour en banque) — la majorité des mouvements
       d'un historique de saison normale, en fait.
   - Partout où un rôle est choisi pour un joueur qui arrive (Ajout,
     Échange même pooler, Échange entre poolers), le choix inclut
     **Recrue** en plus d'Actif/Réserviste — utile si le joueur reçu
     est encore sous contrat ELC ou était déjà en banque de recrues
     chez l'autre pooler.
   - **Échange entre poolers** peut aussi inclure des **choix de
     repêchage** (section qui apparaît sous "Côté B" dès qu'un des deux
     poolers a des picks non utilisés) : cases à cocher pour les picks
     de A qui partent vers B et vice-versa. Un échange peut être
     pick(s)-contre-pick(s) sans aucun joueur.
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
6. Un avertissement orange (non bloquant) apparaît si le joueur sélectionné
   a été retiré du même pooler il y a moins de `delai_reactivation_jours`
   (3 jours actuellement) par rapport à la date choisie — utile pour
   repérer une saisie qui viole involontairement cette règle. Le même
   avertissement (badge ⚠, survol pour le détail) apparaît rétroactivement
   dans le journal pour les lignes déjà saisies. Ça n'empêche jamais de
   soumettre : des cas légitimes existent (LTIR, etc.).

---

## Validation après la saisie

- `/admin/historique` (vue classement/historique poolers) et
  `/poolers/[id]` permettent de valider visuellement que les points et les
  rosters historiques sont cohérents avec le fichier source.
- `buildStandings()` (`app/lib/standings.ts`) calcule les points en filtrant
  les game-logs sur la fenêtre `added_at → removed_at` de chaque ligne
  `pooler_rosters` — une date mal saisie ici fausse directement les points
  attribués pour la période concernée.

### Principe pour les changements de statut (actif/réserviste/recrue)

Un joueur initialisé (via Admin > Initialisation) est considéré **actif par
défaut du 7 octobre 2025 (début de saison) au 16 avril 2026 (fin de saison)**,
tant qu'aucune transaction historique ne dit le contraire. `buildStandings()`
découpe chaque période `pooler_rosters` en segments actif/non-actif à partir
de `roster_change_log` (fonction `statusAt`, corrigée le 2026-07-13 —
voir entrée SUIVI du même jour) : seuls les matchs joués pendant un segment
**réellement actif** comptent dans le total du pooler, peu importe le statut
*actuel* du joueur.

**Tant qu'un joueur n'a pas encore de vraie transaction historique saisie**
(ex. seulement le marqueur générique du 7 juin 2026, sans date réelle dans la
saison), le calcul retombe sur son statut **actuel** en base — c'est
volontaire et sans danger, mais ça veut dire que ses points ne se
corrigeront qu'au fur et à mesure que ses vraies dates de désactivation/
réactivation sont saisies via **Changement de type**. Un joueur affichant 0
point compté malgré un statut visible dans son historique n'est donc pas
forcément un bug — vérifier d'abord si sa vraie date de changement de statut
a été saisie.

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
