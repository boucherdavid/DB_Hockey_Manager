"""
Backfill des game-logs de saison régulière.
Récupère tous les matchs joués par les joueurs du pool (pooler_rosters)
et les insère dans player_game_logs (game_type=2).

Ciblé sur les joueurs du pool uniquement — beaucoup moins d'appels API
que de fetcher toute la ligue.

Usage:
    python backfill_regular_game_logs.py [--season 2025-26]

Par défaut, utilise la première saison régulière trouvée dans la DB.
Pointer .env vers le projet staging avant de lancer.

Prérequis:
    - .env avec SUPABASE_URL + SUPABASE_SERVICE_KEY (staging)
    - Table player_game_logs déjà créée (migration player_game_logs.sql)
"""

import os
import sys
import time
import argparse
import requests

from dotenv import load_dotenv
from supabase import create_client

sys.stdout.reconfigure(encoding='utf-8')

# Chargement anticipé pour que --env soit disponible avant parse_args
_pre = argparse.ArgumentParser(add_help=False)
_pre.add_argument('--env', default='.env')
_pre_args, _ = _pre.parse_known_args()
load_dotenv(_pre_args.env)

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_KEY')
NHL_WEB      = 'https://api-web.nhle.com'
GAME_TYPE    = 2   # 2 = saison régulière


def to_nhl_season(season: str) -> int:
    """'2025-26' → 20252026"""
    start = int(season.split('-')[0])
    return start * 10000 + (start + 1)


def fetch_player_game_log(nhl_id: int, nhl_season: int, retries: int = 3) -> list[dict]:
    url = f'{NHL_WEB}/v1/player/{nhl_id}/game-log/{nhl_season}/{GAME_TYPE}'
    for attempt in range(retries):
        try:
            r = requests.get(url, timeout=15)
            r.raise_for_status()
            return r.json().get('gameLog', [])
        except Exception as e:
            if attempt < retries - 1:
                wait = 5 * (attempt + 1)
                print(f'  Retry {attempt + 1}/{retries - 1} nhl_id={nhl_id} (attente {wait}s)...')
                time.sleep(wait)
            else:
                raise
    return []


def fetch_schedule_start_times(date_str: str) -> dict[int, str]:
    """Retourne {gameId: startTimeUTC} pour tous les matchs d'une date."""
    url = f'{NHL_WEB}/v1/schedule/{date_str}'
    r = requests.get(url, timeout=10)
    r.raise_for_status()
    result: dict[int, str] = {}
    for week in r.json().get('gameWeek', []):
        for game in week.get('games', []):
            gid = game.get('id')
            st  = game.get('startTimeUTC')
            if gid and st:
                result[gid] = st
    return result


def parse_game_log_row(player_id: int, nhl_id: int, nhl_season: int, g: dict, start_time: str) -> dict:
    goals   = int(g.get('goals',   0) or 0)
    assists = int(g.get('assists', 0) or 0)

    if 'wins' in g:
        wins = int(g.get('wins', 0) or 0)
    else:
        wins = 1 if g.get('decision') == 'W' else 0

    if 'otLosses' in g:
        otl = int(g.get('otLosses', 0) or 0)
    else:
        otl = 1 if g.get('decision') == 'O' else 0

    shutouts = int(g.get('shutouts', 0) or 0)

    return {
        'player_id':       player_id,
        'nhl_id':          nhl_id,
        'game_date':       g['gameDate'],
        'game_start_time': start_time,
        'season':          nhl_season,
        'game_type':       GAME_TYPE,
        'goals':           goals,
        'assists':         assists,
        'goalie_wins':     wins,
        'goalie_otl':      otl,
        'goalie_shutouts': shutouts,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--env',      default='.env',  help="Fichier d'environnement (ex: .env.staging)")
    parser.add_argument('--season',   help="Saison pool (ex: 2025-26). Par défaut: première trouvée.")
    parser.add_argument('--nhl-ids',  help="Comma-separated nhl_ids à traiter uniquement (ex: 8476460,8478398)")
    args = parser.parse_args()

    if not SUPABASE_URL or not SUPABASE_KEY:
        print('Variables SUPABASE_URL et SUPABASE_SERVICE_KEY requises.')
        sys.exit(1)

    client = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Trouver la saison cible
    seasons_resp = client.table('pool_seasons').select('id, season').eq('is_playoff', False).execute()
    seasons = seasons_resp.data or []
    if not seasons:
        print('Aucune saison régulière trouvée.')
        sys.exit(1)

    if args.season:
        target = next((s for s in seasons if s['season'] == args.season), None)
        if not target:
            print(f'Saison {args.season} introuvable. Disponibles: {[s["season"] for s in seasons]}')
            sys.exit(1)
    else:
        target = seasons[0]

    pool_season_id = target['id']
    nhl_season     = to_nhl_season(target['season'])
    print(f'Saison pool : {target["season"]} (id={pool_season_id}) → NHL season {nhl_season}')
    print(f'game_type   : {GAME_TYPE} (saison régulière)\n')

    # Tous les joueurs avec un nhl_id — pagination pour dépasser la limite 1000 Supabase
    all_players: list[dict] = []
    p_offset = 0
    P_PAGE = 1000
    while True:
        resp = client.table('players').select('id, nhl_id').range(p_offset, p_offset + P_PAGE - 1).execute()
        chunk = resp.data or []
        all_players.extend(chunk)
        if len(chunk) < P_PAGE:
            break
        p_offset += P_PAGE

    player_map: dict[int, int] = {
        r['id']: r['nhl_id']
        for r in all_players
        if r.get('nhl_id')
    }

    # Filtre optionnel par nhl_id
    if args.nhl_ids:
        target_ids = {int(x.strip()) for x in args.nhl_ids.split(',')}
        player_map = {pid: nid for pid, nid in player_map.items() if nid in target_ids}
        print(f'Mode ciblé : {len(player_map)} joueur(s) pour nhl_ids={target_ids}')

    print(f'{len(player_map)} joueurs à backfiller (toute la table players).\n')

    schedule_cache: dict[str, dict[int, str]] = {}
    game_start_cache: dict[int, str] = {}
    rows: list[dict] = []
    errors = 0
    skipped = 0

    for i, (player_id, nhl_id) in enumerate(player_map.items(), 1):
        if i % 20 == 0:
            print(f'  [{i}/{len(player_map)}] en cours...')
        try:
            game_log = fetch_player_game_log(nhl_id, nhl_season)
        except Exception as e:
            print(f'  Erreur nhl_id={nhl_id}: {e}')
            errors += 1
            time.sleep(0.3)
            continue

        if not game_log:
            skipped += 1
            time.sleep(0.05)
            continue

        for g in game_log:
            game_id   = g.get('gameId')
            game_date = g.get('gameDate')
            if not game_id or not game_date:
                continue

            if game_id not in game_start_cache:
                if game_date not in schedule_cache:
                    try:
                        schedule_cache[game_date] = fetch_schedule_start_times(game_date)
                        time.sleep(0.1)
                    except Exception:
                        schedule_cache[game_date] = {}
                game_start_cache[game_id] = schedule_cache[game_date].get(game_id, '')

            start_time = game_start_cache.get(game_id, '')
            if not start_time:
                # Fallback : midi UTC pour cette date (suffisant pour les fenêtres d'activation journalières)
                start_time = f'{game_date}T12:00:00Z'

            rows.append(parse_game_log_row(player_id, nhl_id, nhl_season, g, start_time))

        time.sleep(0.1)

    print(f'\n{len(rows)} lignes à insérer ({errors} erreurs API, {skipped} sans matchs)...')

    if not rows:
        print('Aucune ligne à insérer.')
        return

    BATCH = 200
    inserted = 0
    db_errors = 0
    for i in range(0, len(rows), BATCH):
        batch = rows[i:i + BATCH]
        resp = client.table('player_game_logs').upsert(
            batch, on_conflict='player_id,game_date,season,game_type'
        ).execute()
        if hasattr(resp, 'data') and resp.data is not None:
            inserted += len(batch)
        else:
            db_errors += 1
            print(f'  ⚠ Erreur DB batch {i//BATCH + 1}: {getattr(resp, "error", resp)}')
            # Afficher les player_ids du batch pour diagnostic
            pids = {r['player_id'] for r in batch}
            print(f'    player_ids affectés: {pids}')
        if (i // BATCH + 1) % 5 == 0 or i + BATCH >= len(rows):
            print(f'  {i + len(batch)}/{len(rows)} traitées ({db_errors} erreur(s) DB)')

    print(f'\n✓ Backfill terminé — {inserted} lignes dans player_game_logs (game_type=2, saison={nhl_season}).')
    print(f'  {errors} erreur(s) API ignorées, {db_errors} erreur(s) DB.')


if __name__ == '__main__':
    main()
