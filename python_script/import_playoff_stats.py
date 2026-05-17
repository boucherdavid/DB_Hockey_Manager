"""
Mise à jour quotidienne des game-logs pour le pool des séries.
Récupère les matchs joués hier (ET) pour chaque joueur actif du pool
et les insère/met à jour dans player_game_logs.

Exécuté par GitHub Action chaque nuit après la fin des matchs
(schedule : 0 6 * * * UTC = 2h AM ET).
"""

import os
import sys
import time
import requests
from datetime import datetime, timezone, timedelta

from dotenv import load_dotenv
from supabase import create_client

sys.stdout.reconfigure(encoding='utf-8')
load_dotenv()

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_KEY')
NHL_WEB      = 'https://api-web.nhle.com'
NHL_SEASON   = 20252026
GAME_TYPE    = 3   # 3 = playoffs


def get_yesterday_et() -> str:
    """Retourne la date d'hier en heure de l'Est (YYYY-MM-DD)."""
    et_offset = timedelta(hours=-4)  # EDT (UTC-4)
    now_et = datetime.now(timezone.utc) + et_offset
    yesterday_et = now_et - timedelta(days=1)
    return yesterday_et.strftime('%Y-%m-%d')


def fetch_schedule_for_date(date_str: str) -> list[dict]:
    """Retourne la liste des matchs (avec startTimeUTC) pour une date donnée."""
    url = f'{NHL_WEB}/v1/schedule/{date_str}'
    r = requests.get(url, timeout=10)
    r.raise_for_status()
    games = []
    for week in r.json().get('gameWeek', []):
        for game in week.get('games', []):
            if game.get('gameDate') == date_str and game.get('gameType') == GAME_TYPE:
                games.append(game)
    return games


def fetch_player_game_log(nhl_id: int) -> list[dict]:
    url = f'{NHL_WEB}/v1/player/{nhl_id}/game-log/{NHL_SEASON}/{GAME_TYPE}'
    r = requests.get(url, timeout=10)
    r.raise_for_status()
    return r.json().get('gameLog', [])


def parse_game_log_row(player_id: int, nhl_id: int, g: dict, start_time: str) -> dict:
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

    # Date d'hier ET
    target_date = get_yesterday_et()
    print(f'Date cible : {target_date}')

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
        print('Aucune saison de séries active — rien à faire.')
        return
    pool_season_id = resp.data['id']
    print(f'Saison : {resp.data["season"]} (id={pool_season_id})')

    # Matchs d'hier avec leurs heures de début
    try:
        schedule_games = fetch_schedule_for_date(target_date)
    except Exception as e:
        print(f'Erreur schedule : {e}')
        sys.exit(1)

    if not schedule_games:
        print(f'Aucun match de séries le {target_date} — rien à faire.')
        return

    # {gameId: startTimeUTC}
    start_time_map: dict[int, str] = {
        g['id']: g['startTimeUTC'] for g in schedule_games if g.get('startTimeUTC')
    }
    print(f'{len(schedule_games)} match(s) trouvé(s) : {list(start_time_map.keys())}')

    # Joueurs actifs du pool
    rosters = (
        client.table('playoff_pool_rosters')
        .select('player_id, players(nhl_id)')
        .eq('pool_season_id', pool_season_id)
        .eq('is_active', True)
        .execute()
        .data or []
    )
    player_map: dict[int, int] = {}
    for r in rosters:
        nhl_id = (r.get('players') or {}).get('nhl_id')
        if nhl_id:
            player_map[r['player_id']] = nhl_id

    print(f'{len(player_map)} joueurs actifs.\n')

    rows: list[dict] = []
    errors = 0

    for i, (player_id, nhl_id) in enumerate(player_map.items(), 1):
        print(f'  [{i}/{len(player_map)}] nhl_id={nhl_id}', end=' ')
        try:
            game_log = fetch_player_game_log(nhl_id)
        except Exception as e:
            print(f'✗ {e}')
            errors += 1
            continue

        # Filtrer uniquement les matchs de la date cible
        day_games = [g for g in game_log if g.get('gameDate') == target_date]
        if not day_games:
            print('— pas de match hier')
            time.sleep(0.1)
            continue

        for g in day_games:
            game_id = g.get('gameId')
            start_time = start_time_map.get(game_id, '')
            if not start_time:
                print(f'✗ startTimeUTC introuvable pour gameId={game_id}')
                continue
            rows.append(parse_game_log_row(player_id, nhl_id, g, start_time))

        stats_str = ', '.join(
            f'{g.get("goals",0)}B {g.get("assists",0)}A' for g in day_games
        )
        print(f'→ {stats_str}')
        time.sleep(0.15)

    if not rows:
        print('\nAucun game-log à insérer.')
        return

    print(f'\n{len(rows)} lignes à upsert dans player_game_logs...')
    (
        client.table('player_game_logs')
        .upsert(rows, on_conflict='player_id,game_date,season,game_type')
        .execute()
    )
    print(f'✓ {len(rows)} lignes mises à jour ({errors} erreur(s)).')


if __name__ == '__main__':
    main()
