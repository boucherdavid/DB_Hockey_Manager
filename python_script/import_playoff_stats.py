"""
Mise à jour quotidienne des game-logs pour le pool des séries.
Approche boxscore : 1 appel par match au lieu de 1 appel par joueur.
Typiquement 2-5 appels API par nuit au lieu de 632.

Exécuté par GitHub Action chaque nuit (schedule : 0 6 * * * UTC = 2h AM ET).
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
    et_offset = timedelta(hours=-4)
    now_et = datetime.now(timezone.utc) + et_offset
    return (now_et - timedelta(days=1)).strftime('%Y-%m-%d')


def _toi_seconds(toi: str) -> int:
    try:
        parts = toi.split(':')
        return int(parts[0]) * 60 + int(parts[1])
    except Exception:
        return 0


def fetch_schedule_games(date_str: str, game_type: int) -> list[dict]:
    """Retourne [{id, startTimeUTC}] pour les matchs d'une date et d'un type."""
    url = f'{NHL_WEB}/v1/schedule/{date_str}'
    r = requests.get(url, timeout=10)
    r.raise_for_status()
    games = []
    for day in r.json().get('gameWeek', []):
        if day.get('date') != date_str:
            continue
        for g in day.get('games', []):
            if int(g.get('gameType', 0)) == game_type:
                games.append({'id': g['id'], 'startTimeUTC': g.get('startTimeUTC', '')})
    return games


def fetch_boxscore(game_id: int) -> dict:
    url = f'{NHL_WEB}/v1/gamecenter/{game_id}/boxscore'
    r = requests.get(url, timeout=10)
    r.raise_for_status()
    return r.json()


def parse_boxscore(
    boxscore: dict,
    nhl_to_db: dict[int, int],
    game_date: str,
    start_time: str,
    season: int,
    game_type: int,
) -> list[dict]:
    """Extrait les stats de tous les joueurs connus du boxscore."""
    rows = []
    is_playoff = (game_type == 3)

    for side in ('homeTeam', 'awayTeam'):
        team = boxscore.get('playerByGameStats', {}).get(side, {})

        for slot in ('forwards', 'defense'):
            for p in team.get(slot, []):
                nhl_id = p.get('playerId')
                if not nhl_id or nhl_id not in nhl_to_db:
                    continue
                rows.append({
                    'player_id':       nhl_to_db[nhl_id],
                    'nhl_id':          nhl_id,
                    'game_date':       game_date,
                    'game_start_time': start_time,
                    'season':          season,
                    'game_type':       game_type,
                    'goals':           int(p.get('goals', 0) or 0),
                    'assists':         int(p.get('assists', 0) or 0),
                    'goalie_wins':     0,
                    'goalie_otl':      0,
                    'goalie_shutouts': 0,
                })

        for g in team.get('goalies', []):
            nhl_id = g.get('playerId')
            if not nhl_id or nhl_id not in nhl_to_db:
                continue
            decision = g.get('decision')       # 'W', 'L', 'O' ou None
            toi_secs = _toi_seconds(g.get('toi', '0:00'))
            goals_ag = int(g.get('goalsAgainst', 0) or 0)

            wins = 1 if decision == 'W' else 0
            # En séries, défaite en prolongation = decision 'L' + toi > 60 min
            if is_playoff:
                otl = 1 if (decision == 'L' and toi_secs > 3600) else 0
            else:
                otl = 1 if decision == 'O' else 0
            # Jeu blanc : 0 but accordé + gardien a joué au moins 60 min
            shutouts = 1 if (goals_ag == 0 and decision is not None and toi_secs >= 3600) else 0

            rows.append({
                'player_id':       nhl_to_db[nhl_id],
                'nhl_id':          nhl_id,
                'game_date':       game_date,
                'game_start_time': start_time,
                'season':          season,
                'game_type':       game_type,
                'goals':           int(g.get('goals', 0) or 0),
                'assists':         int(g.get('assists', 0) or 0),
                'goalie_wins':     wins,
                'goalie_otl':      otl,
                'goalie_shutouts': shutouts,
            })

    return rows


def main() -> None:
    parser = argparse.ArgumentParser(description="Import game-logs playoff pour le pool.")
    parser.add_argument('--date', metavar='YYYY-MM-DD', help="Date à traiter (défaut : hier ET)")
    args = parser.parse_args()

    if not SUPABASE_URL or not SUPABASE_KEY:
        print('Variables SUPABASE_URL et SUPABASE_SERVICE_KEY requises.')
        sys.exit(1)

    client = create_client(SUPABASE_URL, SUPABASE_KEY)
    target_date = args.date or get_yesterday_et()
    print(f'Date cible : {target_date}')

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

    games = fetch_schedule_games(target_date, GAME_TYPE)
    if not games:
        print(f'Aucun match de séries le {target_date} — rien à faire.')
        return
    print(f'{len(games)} match(s) : {[g["id"] for g in games]}')

    # nhl_id → player_id (DB)
    players_resp = client.table('players').select('id, nhl_id').execute()
    nhl_to_db: dict[int, int] = {
        r['nhl_id']: r['id']
        for r in (players_resp.data or [])
        if r.get('nhl_id')
    }

    rows: list[dict] = []
    errors = 0
    for game in games:
        try:
            boxscore = fetch_boxscore(game['id'])
        except Exception as e:
            print(f'  Erreur boxscore {game["id"]}: {e}')
            errors += 1
            continue
        rows.extend(parse_boxscore(
            boxscore, nhl_to_db,
            target_date, game['startTimeUTC'],
            NHL_SEASON, GAME_TYPE,
        ))
        time.sleep(0.2)

    if not rows:
        print('Aucun game-log à insérer pour cette date.')
        return

    print(f'{len(rows)} lignes à upsert...')
    client.table('player_game_logs').upsert(
        rows, on_conflict='player_id,game_date,season,game_type'
    ).execute()
    print(f'✓ {len(rows)} lignes mises à jour ({errors} erreur(s)).')


if __name__ == '__main__':
    main()
