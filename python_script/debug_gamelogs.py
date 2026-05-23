"""
debug_gamelogs.py — Diagnostic ciblé pour les joueurs sans game-logs.
Usage : python debug_gamelogs.py --env .env.staging
"""
import os, sys, requests, argparse
from dotenv import load_dotenv

_pre = argparse.ArgumentParser(add_help=False)
_pre.add_argument('--env', default='.env')
_pre_args, _ = _pre.parse_known_args()
load_dotenv(_pre_args.env, override=True)

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_KEY')
NHL_WEB      = 'https://api-web.nhle.com'

print(f'SUPABASE_URL  : {SUPABASE_URL}')
print(f'SERVICE_KEY   : {(SUPABASE_KEY or "")[:20]}...\n')

if not SUPABASE_URL or not SUPABASE_KEY:
    print('❌ Variables manquantes.')
    sys.exit(1)

from supabase import create_client
client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Joueurs à tester
TARGETS = {
    8476460: 'Scheifele',
    8478398: 'Connor',
    8480893: 'Marchenko',
    8481580: 'McMichael',
    8481711: 'Maccelli',
}
NHL_SEASON = 20252026
GAME_TYPE  = 2

# 1. Vérifier les player_ids dans la DB
print('=== 1. player_ids en DB ===')
players_resp = client.table('players').select('id, nhl_id, first_name, last_name').execute()
print(f'Total joueurs avec nhl_id : {len(players_resp.data or [])}')
pid_map = {}
for r in (players_resp.data or []):
    if r.get('nhl_id') in TARGETS:
        print(f'  player_id={r["id"]} nhl_id={r["nhl_id"]} {r["first_name"]} {r["last_name"]}')
        pid_map[r['nhl_id']] = r['id']

# 2. Compter les logs existants pour ces players
print('\n=== 2. Logs existants pour ces player_ids ===')
if pid_map:
    logs_resp = client.table('player_game_logs')\
        .select('player_id, nhl_id')\
        .in_('player_id', list(pid_map.values()))\
        .eq('season', NHL_SEASON)\
        .eq('game_type', GAME_TYPE)\
        .execute()
    print(f'  Logs trouvés : {len(logs_resp.data or [])}')
else:
    print('  Aucun player_id trouvé en DB')

# 3. Tester l'API NHL pour Scheifele
nhl_id = 8476460
print(f'\n=== 3. API NHL pour Scheifele (nhl_id={nhl_id}) ===')
url = f'{NHL_WEB}/v1/player/{nhl_id}/game-log/{NHL_SEASON}/{GAME_TYPE}'
print(f'  URL : {url}')
try:
    r = requests.get(url, timeout=15)
    print(f'  HTTP status : {r.status_code}')
    game_log = r.json().get('gameLog', [])
    print(f'  Matchs retournés : {len(game_log)}')
    if game_log:
        print(f'  Premier match : {game_log[0]}')
except Exception as e:
    print(f'  Erreur : {e}')

# 4. Tenter un INSERT direct d'un faux log et vérifier la réponse
if pid_map.get(nhl_id):
    print(f'\n=== 4. Test INSERT direct pour Scheifele (player_id={pid_map[nhl_id]}) ===')
    test_row = {
        'player_id':       pid_map[nhl_id],
        'nhl_id':          nhl_id,
        'game_date':       '2025-10-09',
        'game_start_time': '2025-10-09T23:00:00Z',
        'season':          NHL_SEASON,
        'game_type':       GAME_TYPE,
        'goals':           0,
        'assists':         0,
        'goalie_wins':     0,
        'goalie_otl':      0,
        'goalie_shutouts': 0,
    }
    resp = client.table('player_game_logs').upsert(
        [test_row], on_conflict='player_id,game_date,season,game_type'
    ).execute()
    print(f'  resp.data  : {resp.data}')
    print(f'  resp.error (si attr) : {getattr(resp, "error", "n/a")}')
    # Vérifier si la ligne est maintenant en DB
    check = client.table('player_game_logs')\
        .select('id')\
        .eq('player_id', pid_map[nhl_id])\
        .eq('game_date', '2025-10-09')\
        .eq('season', NHL_SEASON)\
        .eq('game_type', GAME_TYPE)\
        .execute()
    print(f'  Ligne en DB après insert : {len(check.data or [])} résultat(s)')
