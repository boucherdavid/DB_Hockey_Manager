"""
Backfill des game-logs pour le pool des séries.
Récupère tous les matchs joués par les joueurs du pool depuis le début des séries
et les insère dans player_game_logs via upsert.

Usage :
    python backfill_playoff_game_logs.py

Prérequis :
    - Table player_game_logs créée dans Supabase (migration player_game_logs.sql)
    - Variables SUPABASE_URL et SUPABASE_SERVICE_KEY dans .env
"""

import os
import sys
import time
import requests

from dotenv import load_dotenv
from supabase import create_client

sys.stdout.reconfigure(encoding='utf-8')
load_dotenv()

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_KEY')
NHL_WEB      = 'https://api-web.nhle.com'
NHL_SEASON   = 20252026
GAME_TYPE    = 3   # 3 = playoffs


def fetch_player_game_log(nhl_id: int) -> list[dict]:
    url = f'{NHL_WEB}/v1/player/{nhl_id}/game-log/{NHL_SEASON}/{GAME_TYPE}'
    r = requests.get(url, timeout=10)
    r.raise_for_status()
    return r.json().get('gameLog', [])


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


def parse_game_log_row(player_id: int, nhl_id: int, g: dict, start_time: str) -> dict:
    """Transforme une entrée de game-log NHL en ligne player_game_logs."""
    # Patineurs : goals / assists
    # Gardiens  : wins (decision='W'), otLosses (decision='O'), shutouts
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
        'season':          NHL_SEASON,
        'game_type':       GAME_TYPE,
        'goals':           goals,
        'assists':         assists,
        'goalie_wins':     wins,
        'goalie_otl':      otl,
        'goalie_shutouts': shutouts,
    }


def main() -> None:
    if not SUPABASE_URL or not SUPABASE_KEY:
        print('Variables SUPABASE_URL et SUPABASE_SERVICE_KEY requises.')
        sys.exit(1)

    client = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Saison de séries active
    resp = (
        client.table('pool_seasons')
        .select('id, season')
        .eq('is_active', True)
        .eq('is_playoff', True)
        .maybe_single()
        .execute()
    )
    if not resp.data:
        print('Aucune saison de séries active.')
        return
    pool_season_id = resp.data['id']
    print(f'Saison : {resp.data["season"]} (id={pool_season_id})')

    # Tous les joueurs du pool (actifs + retirés) — dédupliqués par player_id
    rosters = (
        client.table('playoff_pool_rosters')
        .select('player_id, players(nhl_id)')
        .eq('pool_season_id', pool_season_id)
        .execute()
        .data or []
    )
    player_map: dict[int, int] = {}  # player_id → nhl_id
    for r in rosters:
        nhl_id = (r.get('players') or {}).get('nhl_id')
        if nhl_id:
            player_map[r['player_id']] = nhl_id

    print(f'{len(player_map)} joueurs uniques à backfiller.\n')

    # Cache pour éviter de fetcher le schedule plusieurs fois par date
    schedule_cache: dict[str, dict[int, str]] = {}   # date → {gameId: startTimeUTC}
    game_start_cache: dict[int, str] = {}             # gameId → startTimeUTC

    rows: list[dict] = []
    errors = 0

    for i, (player_id, nhl_id) in enumerate(player_map.items(), 1):
        print(f'  [{i}/{len(player_map)}] player_id={player_id} nhl_id={nhl_id}', end=' ')
        try:
            game_log = fetch_player_game_log(nhl_id)
        except Exception as e:
            print(f'✗ game-log: {e}')
            errors += 1
            continue

        print(f'→ {len(game_log)} match(s)')

        for g in game_log:
            game_id   = g.get('gameId')
            game_date = g.get('gameDate')
            if not game_id or not game_date:
                continue

            # Résoudre startTimeUTC via le schedule
            if game_id not in game_start_cache:
                if game_date not in schedule_cache:
                    try:
                        schedule_cache[game_date] = fetch_schedule_start_times(game_date)
                        time.sleep(0.1)
                    except Exception as e:
                        print(f'    ✗ schedule {game_date}: {e}')
                        schedule_cache[game_date] = {}
                game_start_cache[game_id] = schedule_cache[game_date].get(game_id, '')

            start_time = game_start_cache.get(game_id, '')
            if not start_time:
                print(f'    ✗ startTimeUTC introuvable pour gameId={game_id} ({game_date})')
                continue

            rows.append(parse_game_log_row(player_id, nhl_id, g, start_time))

        time.sleep(0.15)

    if not rows:
        print('\nAucune ligne à insérer.')
        return

    print(f'\n{len(rows)} lignes à insérer dans player_game_logs...')

    BATCH = 100
    inserted = 0
    for i in range(0, len(rows), BATCH):
        batch = rows[i:i + BATCH]
        (
            client.table('player_game_logs')
            .upsert(batch, on_conflict='player_id,game_date,season,game_type')
            .execute()
        )
        inserted += len(batch)
        print(f'  {inserted}/{len(rows)} insérées')

    print(f'\n✓ Backfill terminé — {inserted} lignes, {errors} erreur(s).')


if __name__ == '__main__':
    main()
