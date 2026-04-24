"""
backfill_nhl_ids.py
-------------------
Remplit le champ nhl_id sur la table players pour tous les joueurs
qui n'en ont pas encore, en utilisant l'API stats NHL publique
(même source que nhl-stats.ts dans l'app Next.js).

Deux appels seulement (patineurs + gardiens) au lieu d'un appel par joueur.

Usage :
    python backfill_nhl_ids.py [--dry-run]

Options :
    --dry-run   Affiche les correspondances sans modifier la BD.
"""

import os
import sys
import requests
from unidecode import unidecode
from dotenv import load_dotenv
from supabase import create_client

sys.stdout.reconfigure(encoding='utf-8')
load_dotenv()

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_KEY')
NHL_REST     = 'https://api.nhle.com/stats/rest/en'
NHL_SEASON   = '20252026'
SEASON_LABEL = '2025-26'
DRY_RUN      = '--dry-run' in sys.argv


def normaliser(nom: str) -> str:
    return unidecode(str(nom)).lower().strip().replace('-', ' ')


def build_url(player_type: str) -> str:
    cayenne = f'gameTypeId=2 and seasonId<={NHL_SEASON} and seasonId>={NHL_SEASON}'
    return (
        f'{NHL_REST}/{player_type}/summary'
        f'?isAggregate=false&isGame=false&start=0&limit=-1'
        f'&factCayenneExp=gamesPlayed%3E%3D1'
        f'&cayenneExp={requests.utils.quote(cayenne)}'
    )


def fetch_nhl_id_map() -> dict[str, int]:
    """Retourne un dict normName → nhl_id pour tous les patineurs et gardiens."""
    id_map: dict[str, int] = {}

    for player_type, name_field in [('skater', 'skaterFullName'), ('goalie', 'goalieFullName')]:
        url = build_url(player_type)
        try:
            r = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=30)
            r.raise_for_status()
            rows = r.json().get('data', [])
        except Exception as e:
            print(f'[ERREUR] Fetch NHL {player_type}: {e}')
            continue

        # Grouper par playerId pour agréger les joueurs multi-équipes
        by_id: dict[int, list] = {}
        for row in rows:
            pid = row.get('playerId')
            if pid:
                by_id.setdefault(int(pid), []).append(row)

        for pid, entries in by_id.items():
            main = entries[0]
            full_name = str(main.get(name_field, ''))
            parts = full_name.split(' ', 1)
            fn = parts[0] if parts else ''
            ln = parts[1] if len(parts) > 1 else ''
            key = normaliser(f'{fn} {ln}')
            if key:
                id_map[key] = pid

        print(f'[INFO] {player_type.capitalize()}s chargés depuis NHL API : {len(by_id)}')

    return id_map


def main():
    print('[INFO] Connexion à Supabase...')
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Joueurs avec contrat actif cette saison
    contrats = (
        supabase
        .table('player_contracts')
        .select('player_id')
        .eq('season', SEASON_LABEL)
        .gt('cap_number', 0)
        .execute()
        .data
    )
    ids_avec_contrat = {c['player_id'] for c in contrats}

    # Joueurs sans nhl_id
    print(f'\n[INFO] Recherche des joueurs sans nhl_id (saison {SEASON_LABEL})...')
    offset = 0
    tous = []
    while True:
        batch = (
            supabase.table('players')
            .select('id, first_name, last_name')
            .is_('nhl_id', 'null')
            .range(offset, offset + 999)
            .execute()
            .data
        )
        tous.extend(batch)
        if len(batch) < 1000:
            break
        offset += 1000

    joueurs = [j for j in tous if j['id'] in ids_avec_contrat]
    print(f'[INFO] {len(joueurs)} joueur(s) sans nhl_id avec contrat {SEASON_LABEL}\n')

    if not joueurs:
        print('[INFO] Rien à faire.')
        return

    # Charger la map NHL en 2 appels
    print('[INFO] Chargement des IDs depuis l\'API stats NHL...')
    id_map = fetch_nhl_id_map()
    print(f'[INFO] {len(id_map)} joueurs trouvés dans l\'API NHL\n')

    trouvés = []   # (id, nhl_id, first_name, last_name)
    échecs  = []   # (id, first_name, last_name)

    for j in joueurs:
        key = normaliser(f"{j['first_name']} {j['last_name']}")
        nhl_id = id_map.get(key)
        if nhl_id:
            trouvés.append((j['id'], nhl_id, j['first_name'], j['last_name']))
        else:
            échecs.append((j['id'], j['first_name'], j['last_name']))

    print(f'{"=" * 60}')
    print(f'Correspondances trouvées : {len(trouvés)}')
    print(f'Sans match (0 PJ ou nom différent) : {len(échecs)}')

    if DRY_RUN:
        print('\n[DRY-RUN] Aucune modification en BD.')
        if trouvés:
            print('\nMises à jour qui seraient appliquées :')
            for pid, nid, fn, ln in trouvés[:20]:
                print(f'  id={pid}  {fn} {ln}  →  nhl_id={nid}')
            if len(trouvés) > 20:
                print(f'  ... et {len(trouvés) - 20} autres')
        if échecs:
            print(f'\nSans correspondance ({len(échecs)}) :')
            for pid, fn, ln in échecs[:20]:
                print(f'  id={pid}  {fn} {ln}')
            if len(échecs) > 20:
                print(f'  ... et {len(échecs) - 20} autres')
        return

    if trouvés:
        BATCH_SIZE = 50
        print('\n[INFO] Application des mises à jour...')
        nb_ok = 0
        for i in range(0, len(trouvés), BATCH_SIZE):
            batch = trouvés[i:i+BATCH_SIZE]
            for pid, nid, fn, ln in batch:
                try:
                    supabase.table('players').update({'nhl_id': nid}).eq('id', pid).execute()
                    nb_ok += 1
                except Exception as e:
                    print(f'  ❌ id={pid}  {fn} {ln}  →  ERREUR: {e}')
            print(f'  {nb_ok}/{len(trouvés)} mis à jour...')
        print(f'[INFO] {nb_ok} nhl_id enregistrés.')

    if échecs:
        print(f'\n⚠️  {len(échecs)} joueur(s) sans correspondance NHL')
        print('   (joueurs sans match cette saison, prospects, ou nom différent)')
        print('   Correction manuelle si nécessaire :')
        print('   UPDATE players SET nhl_id = <nhl_id> WHERE id = <id>;')
        for pid, fn, ln in échecs[:30]:
            print(f'  id={pid}  {fn} {ln}')
        if len(échecs) > 30:
            print(f'  ... et {len(échecs) - 30} autres')

    print('\n[INFO] Terminé.')


if __name__ == '__main__':
    main()
