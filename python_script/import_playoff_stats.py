"""
Mise à jour des stats en direct des joueurs du pool des séries.
Lit les joueurs actifs depuis Supabase, récupère leurs stats playoffs via l'API NHL,
et les stocke en tant que snapshots 'live_cache' dans player_stat_snapshots.

Exécuter après chaque journée de matchs (géré par GitHub Action).
"""

import os
import sys
import time
import requests
from datetime import datetime, timezone

from dotenv import load_dotenv
from supabase import create_client

sys.stdout.reconfigure(encoding='utf-8')
load_dotenv()

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_KEY')
NHL_SEASON   = 20252026
NHL_WEB      = 'https://api-web.nhle.com'


def fetch_player_playoff_stats(nhl_id: int) -> dict | None:
    """
    Fetch stats cumulatives playoffs depuis l'API NHL (endpoint landing).
    Retourne None en cas d'échec pour éviter d'écraser de bonnes données.
    """
    url = f'{NHL_WEB}/v1/player/{nhl_id}/landing'
    try:
        r = requests.get(url, timeout=10)
        r.raise_for_status()
        data = r.json()
        season_totals = data.get('seasonTotals', [])
        current = next(
            (s for s in season_totals
             if s.get('season') == NHL_SEASON and s.get('gameTypeId') == 3),
            None,
        )
        # Joueur sans stats playoffs (pas encore joué) → zéros légitimes
        if not current:
            return {'goals': 0, 'assists': 0, 'goalie_wins': 0, 'goalie_otl': 0, 'goalie_shutouts': 0}
        return {
            'goals':          int(current.get('goals',     0) or 0),
            'assists':        int(current.get('assists',   0) or 0),
            'goalie_wins':    int(current.get('wins',      0) or 0),
            'goalie_otl':     int(current.get('otLosses',  0) or 0),
            'goalie_shutouts':int(current.get('shutouts',  0) or 0),
        }
    except Exception as e:
        print(f'  ✗ Erreur fetch nhl_id={nhl_id}: {e}')
        return None


def main():
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
        print('Aucune saison de séries active — rien à faire.')
        return

    pool_season_id = resp.data['id']
    season_label   = resp.data['season']
    print(f'Saison active : {season_label} (id={pool_season_id})')

    # Joueurs actifs du pool des séries
    rosters_resp = (
        client.table('playoff_pool_rosters')
        .select('pooler_id, player_id, players(nhl_id, position)')
        .eq('pool_season_id', pool_season_id)
        .eq('is_active', True)
        .execute()
    )
    rosters = rosters_resp.data or []
    print(f'{len(rosters)} entrées actives dans le pool des séries.')

    # Dédupliquer par nhl_id (les stats sont identiques peu importe le pooler)
    nhl_to_entries: dict[int, list[dict]] = {}
    for r in rosters:
        nhl_id = (r.get('players') or {}).get('nhl_id')
        if not nhl_id:
            continue
        nhl_to_entries.setdefault(nhl_id, []).append(r)

    print(f'{len(nhl_to_entries)} joueurs uniques à mettre à jour.')

    now     = datetime.now(timezone.utc).isoformat()
    upserts = []
    errors  = 0

    for i, (nhl_id, entries) in enumerate(nhl_to_entries.items(), 1):
        print(f'  [{i}/{len(nhl_to_entries)}] nhl_id={nhl_id}', end=' ')
        stats = fetch_player_playoff_stats(nhl_id)
        if stats is None:
            errors += 1
            continue
        print(f'→ {stats["goals"]}B {stats["assists"]}A')
        for r in entries:
            upserts.append({
                'player_id':     r['player_id'],
                'pooler_id':     r['pooler_id'],
                'pool_season_id':pool_season_id,
                'snapshot_type': 'live_cache',
                'taken_at':      now,
                **stats,
            })
        time.sleep(0.15)  # Respecter le rate limit NHL API

    if upserts:
        # Supprimer les anciens live_cache pour cette saison, puis insérer les nouveaux.
        # On évite le ON CONFLICT qui nécessite une contrainte UNIQUE globale incompatible
        # avec la structure de player_stat_snapshots (plusieurs activation/deactivation possibles).
        client.table('player_stat_snapshots')\
            .delete()\
            .eq('pool_season_id', pool_season_id)\
            .eq('snapshot_type', 'live_cache')\
            .execute()
        client.table('player_stat_snapshots').insert(upserts).execute()
        print(f'\n✓ {len(upserts)} snapshots live_cache mis à jour ({errors} erreur(s)).')
    else:
        print('\nAucun snapshot mis à jour.')


if __name__ == '__main__':
    main()
