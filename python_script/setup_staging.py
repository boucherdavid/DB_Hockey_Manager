"""
setup_staging.py — Copie les données de production vers staging.

Usage :
    python setup_staging.py

Variables d'environnement requises (dans .env et .env.staging) :
    .env           : SUPABASE_URL, SUPABASE_SERVICE_KEY
    .env.staging   : STAGING_SUPABASE_URL, STAGING_SERVICE_KEY, STAGING_PASSWORD
"""

import os
import sys
import unicodedata
from dotenv import load_dotenv
from supabase import create_client

sys.stdout.reconfigure(encoding='utf-8')

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# ─── Chargement des credentials ───────────────────────────────────────────────

load_dotenv(os.path.join(BASE_DIR, '.env'))
PROD_URL = os.getenv('SUPABASE_URL')
PROD_KEY = os.getenv('SUPABASE_SERVICE_KEY')

# .env.staging utilise SUPABASE_URL/SUPABASE_SERVICE_KEY — charger avec override
# pour lire les valeurs staging dans des variables séparées
load_dotenv(os.path.join(BASE_DIR, '.env.staging'), override=True)
STAGING_URL      = os.getenv('SUPABASE_URL')
STAGING_KEY      = os.getenv('SUPABASE_SERVICE_KEY')
STAGING_PASSWORD = os.getenv('STAGING_PASSWORD', 'Staging2026!')

if not all([PROD_URL, PROD_KEY, STAGING_URL, STAGING_KEY]):
    print("❌ Variables manquantes. Vérifie .env et .env.staging.")
    sys.exit(1)

prod    = create_client(PROD_URL, PROD_KEY)
staging = create_client(STAGING_URL, STAGING_KEY)

# ─── Tables à copier (ordre FK) ───────────────────────────────────────────────

TABLES = [
    'teams',
    'players',
    'player_contracts',
    'pool_seasons',
    'scoring_config',
    'poolers',
    'pool_draft_picks',
    'pooler_rosters',
    'transactions',
    'transaction_items',
    'player_stat_snapshots',
    'playoff_participating_teams',
    'playoff_eliminations',
    'playoff_pool_rosters',
    # Note : player_game_logs est EXCLU — données NHL API, pas prod.
    # Relancer backfill_regular_game_logs.py et backfill_playoff_game_logs.py après setup.
]

# Tables exclues du wipe (données NHL API conservées entre les setups)
SKIP_WIPE = {'player_game_logs'}

BATCH = 500


def fetch_all(client, table):
    rows, offset = [], 0
    while True:
        res = client.table(table).select('*').range(offset, offset + BATCH - 1).execute()
        chunk = res.data or []
        rows.extend(chunk)
        if len(chunk) < BATCH:
            break
        offset += BATCH
    return rows


def clear_table(client, table):
    # Supprime toutes les lignes — fonctionne avec RLS bypassé via service_role
    client.table(table).delete().neq('id', 0).execute()


def upsert_batch(client, table, rows):
    for i in range(0, len(rows), BATCH):
        client.table(table).upsert(rows[i:i + BATCH]).execute()


# ─── Confirmation ─────────────────────────────────────────────────────────────

print("\n🔄 COPIE PROD → STAGING")
print(f"  Prod    : {PROD_URL}")
print(f"  Staging : {STAGING_URL}")
print()
confirm = input("⚠  Ceci va EFFACER toutes les données staging. Continuer ? (oui/non) : ")
if confirm.strip().lower() != 'oui':
    print("Annulé.")
    sys.exit(0)

# ─── Effacer staging (ordre inverse FK) ───────────────────────────────────────

print("\n🗑  Effacement des tables staging...")
for table in reversed(TABLES):
    try:
        staging.table(table).delete().gte('id', 0).execute()
        print(f"   ✓ {table}")
    except Exception as e:
        # Certaines tables utilisent des clés non-int (ex: UUID) — fallback
        try:
            rows = staging.table(table).select('id').execute().data or []
            if rows:
                ids = [r['id'] for r in rows]
                for i in range(0, len(ids), 100):
                    staging.table(table).delete().in_('id', ids[i:i+100]).execute()
            print(f"   ✓ {table} (UUID fallback)")
        except Exception as e2:
            print(f"   ⚠ {table} ignoré : {e2}")

# ─── Créer les comptes Auth staging (avant la copie — poolers a une FK sur auth.users) ──

print("\n👤 Création des comptes Auth staging...")
try:
    poolers = fetch_all(prod, 'poolers')
    for p in poolers:
        uid   = p['id']
        name  = p.get('name', 'Pooler')
        slug  = unicodedata.normalize('NFD', name.lower())
        slug  = ''.join(c for c in slug if unicodedata.category(c) != 'Mn')
        slug  = slug.replace(' ', '').replace('-', '').replace('.', '')
        email = f"{slug}@staging.test"
        try:
            staging.auth.admin.create_user({
                'id': uid,
                'email': email,
                'password': STAGING_PASSWORD,
                'email_confirm': True,
                'user_metadata': {'name': name},
            })
            role = '(admin)' if p.get('is_admin') else ''
            print(f"   ✓ {name} {role} → {email} / {STAGING_PASSWORD}")
        except Exception as e:
            if 'already' in str(e).lower() or 'exists' in str(e).lower():
                print(f"   ~ {name} — compte déjà existant")
            else:
                print(f"   ⚠ {name} : {e}")
except Exception as e:
    print(f"   ❌ Erreur Auth : {e}")

# ─── Copier les tables ────────────────────────────────────────────────────────

# Colonnes à exclure par table (colonnes générées ou non copiables)
EXCLUDE_COLUMNS = {
    'pool_seasons': {'pool_cap'},
}

# Tables à vider juste avant la copie (triggers qui auto-insèrent des données)
PRE_CLEAR = {'pool_draft_picks'}

print("\n📥 Copie des données...")
for table in TABLES:
    try:
        if table in PRE_CLEAR:
            staging.table(table).delete().gte('id', 0).execute()
        rows = fetch_all(prod, table)
        exclude = EXCLUDE_COLUMNS.get(table, set())
        if exclude:
            rows = [{k: v for k, v in r.items() if k not in exclude} for r in rows]
        if rows:
            upsert_batch(staging, table, rows)
        print(f"   ✓ {table} — {len(rows)} lignes")
    except Exception as e:
        print(f"   ❌ {table} : {e}")

# ─── Résumé ───────────────────────────────────────────────────────────────────

print("\n✅ Copie terminée !")
print()
print("─" * 60)
print("ÉTAPE MANUELLE REQUISE — SQL Editor Supabase staging :")
print("─" * 60)
print("""
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM poolers WHERE id = auth.uid() AND is_admin = true)
$$ LANGUAGE sql SECURITY DEFINER STABLE;

DROP POLICY IF EXISTS "Pooler gère son profil" ON poolers;
CREATE POLICY "Pooler gère son profil" ON poolers FOR ALL
  USING (id = auth.uid() OR is_admin());
""")
print("─" * 60)
print()
print("Ensuite :")
print("  1. .\\start_staging.ps1")
print("  2. Connecte-toi avec prenom@staging.test / Staging2026!")
print("  3. python backfill_regular_game_logs.py --env .env.staging --season 2025-26")
print()
