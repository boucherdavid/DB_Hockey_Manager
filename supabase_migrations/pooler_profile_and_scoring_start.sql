-- Migration : profil pooler (phone, notif) + début comptabilisation séries
-- À exécuter dans Supabase SQL Editor

-- Profil pooler
ALTER TABLE poolers
  ADD COLUMN IF NOT EXISTS phone       VARCHAR(20),
  ADD COLUMN IF NOT EXISTS notif_email BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_sms   BOOLEAN NOT NULL DEFAULT false;

-- Date de départ de la comptabilisation des séries
ALTER TABLE playoff_seasons
  ADD COLUMN IF NOT EXISTS scoring_start_at TIMESTAMPTZ;
