-- Date de journalisation (moment réel de la saisie), distincte de changed_at
-- (date effective du mouvement, potentiellement forcée dans le passé par l'admin)
ALTER TABLE roster_change_log
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
