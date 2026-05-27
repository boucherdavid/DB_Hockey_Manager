"""
Mise à jour quotidienne des game-logs pour le pool des séries.
Récupère les matchs joués hier (ET) pour TOUS les joueurs de la table `players`
et les insère/met à jour dans player_game_logs.

Couvre tous les joueurs suivis par l'app (pool actif + échanges + joueurs libres),
évitant tout backfill d'urgence lors d'une activation en cours de saison.

Exécuté par GitHub Action chaque nuit après la fin des matchs
(schedule : 0 6 * * * UTC = 2h AM ET).

Fin de saison : vider player_game_logs pour la saison terminée une fois les
standings finaux archivés dans playoff_pool_standings_cache.
"""

import argparse
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
    """Retourne la liste des matchs playoffs (avec startTimeUTC) pour une date."""
    url = f'{NHL_WEB}/v1/schedule/{date_str}'
    r = requests.get(url, timeout=10)
    r.raise_for_status()
    games = []
    for day in r.json().get('gameWeek', []):
        if day.get('date') != date_str:
            continue
        for game in day.get('games', []):
            if int(game.get('gameType', 0)) == GAME_TYPE:
                games.append(game)
    return games


def fetch_player_game_log(nhl_id: int) -> list[dict]:
    url = f'{NHL_WEB}/v1/player/{nhl_id}/game-log/{NHL_SEASON}/{GAME_TYPE}'
    r = requests.get(url, timeout=10)
    r.raise_for_status()
    return r.json().get('gameLog', [])


def _toi_seconds(toi: str) -> int:
    """Convert 'MM:SS' string to total seconds."""
    try:
        parts = toi.split(':')
        return int(parts[0]) * 60 + int(parts[1])
    except Exception:
        return 0


def parse_game_log_row(player_id: int, nhl_id: int, g: dict, start_time: str) -> dict:
    goals   = int(g.get('goals',   0) or 0)
    assists = int(g.get('assists', 0) or 0)

    if 'wins' in g:
        wins = int(g.get('wins', 0) or 0)
    else:
        wins = 1 if g.get('decision') == 'W' else 0

    if 'otLosses' in g:
        otl = int(g.get('otLosses', 0) or 0)
    elif g.get('decision') == 'O':
        otl = 1
    elif g.get('decision') == 'L':
        # En séries, les défaites en prolongation utilisent decision='L' (pas 'O').
        # Détection via TOI > 60 minutes.
        otl = 1 if _toi_seconds(g.get('toi', '')) > 3600 else 0
    else:
        otl = 0

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
    parser = argparse.ArgumentParser(description="Import game-logs playoff pour le pool.")
    parser.add_argument('--date', metavar='YYYY-MM-DD', help="Date à traiter (défaut : hier en heure de l'Est)")
    args = parser.parse_args()

    if not SUPABASE_URL or not SUPABASE_KEY:
        print('Variables SUPABASE_URL et SUPABASE_SERVICE_KEY requises.')
        sys.exit(1)

    client = create_client(SUPABASE_URL, SUPABASE_KEY)

    target_date = args.date if args.date else get_yesterday_et()
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
    print(f'Saison : {resp.data["season"]} (id={resp.data["id"]})')

    # Matchs d'hier avec leurs heures de début
    try:
        schedule_games = fetch_schedule_for_date(target_date)
    except Exception as e:
        print(f'Erreur schedule : {e}')
        sys.exit(1)

    if not schedule_games:
        print(f'Aucun match de séries le {target_date} — rien à faire.')
        return

    start_time_map: dict[int, str] = {
        g['id']: g['startTimeUTC']
        for g in schedule_games
        if g.get('startTimeUTC')
    }
    print(f'{len(schedule_games)} match(s) : {list(start_time_map.keys())}')

    # Tous les joueurs avec un nhl_id — pas seulement les actifs du pool
    players_resp = (
        client.table('players')
        .select('id, nhl_id')
        .execute()
    )
    player_map: dict[int, int] = {
        r['id']: r['nhl_id']
        for r in (players_resp.data or [])
        if r.get('nhl_id')
    }
    print(f'{len(player_map)} joueurs à vérifier.\n')

    rows: list[dict] = []
    errors = 0

    for player_id, nhl_id in player_map.items():
        try:
            game_log = fetch_player_game_log(nhl_id)
        except Exception:
            errors += 1
            time.sleep(0.1)
            continue

        day_games = [g for g in game_log if g.get('gameDate') == target_date]
        if not day_games:
            time.sleep(0.05)
            continue

        for g in day_games:
            game_id = g.get('gameId')
            start_time = start_time_map.get(game_id, '')
            if not start_time:
                continue
            rows.append(parse_game_log_row(player_id, nhl_id, g, start_time))

        time.sleep(0.1)

    if not rows:
        print('Aucun game-log à insérer pour cette date.')
        return

    print(f'{len(rows)} lignes à upsert...')
    (
        client.table('player_game_logs')
        .upsert(rows, on_conflict='player_id,game_date,season,game_type')
        .execute()
    )
    print(f'✓ {len(rows)} lignes mises à jour ({errors} erreur(s)).')


if __name__ == '__main__':
    main()
