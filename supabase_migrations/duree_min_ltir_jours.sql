-- Durée minimale (en jours) qu'un joueur doit rester sur LTIR avant d'être réactivé.
-- Configurable par l'admin dans /admin/config, comme delai_reactivation_jours et
-- max_signatures_al/ltir. Utilisé pour un avertissement non bloquant (pas un blocage)
-- dans l'onglet Historique quand une correction ramène un joueur de LTIR à un autre
-- statut avant ce délai — voir checkHistLtirDurationAction (historique-actions.ts).
ALTER TABLE pool_seasons
  ADD COLUMN IF NOT EXISTS duree_min_ltir_jours INTEGER NOT NULL DEFAULT 21;
