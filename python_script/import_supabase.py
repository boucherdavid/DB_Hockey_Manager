import os
import re
import sys
import time
import requests
import pandas as pd
from bs4 import BeautifulSoup
from unidecode import unidecode
from dotenv import load_dotenv
from supabase import create_client

sys.stdout.reconfigure(encoding='utf-8')
load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DIAGNOSTICS_DIR = os.path.join(BASE_DIR, 'diagnostics')
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_KEY')
BATCH_SIZE = 50
PUCKPEDIA_BASE_URL = 'https://puckpedia.com'

NHL_TEAM_CODES = [
    'ANA','BOS','BUF','CGY','CAR','CHI','COL','CBJ','DAL','DET',
    'EDM','FLA','LAK','MIN','MTL','NSH','NJD','NYI','NYR','OTT',
    'PHI','PIT','SEA','SJS','STL','TBL','TOR','UTA','VAN','VGK',
    'WSH','WPG'
]

NHL_SEASON = '20252026'

PLAYER_LINK_CACHE = {}


def normaliser_nom(nom):
    return unidecode(str(nom)).lower().strip().replace('-', ' ')


def parse_nom(name):
    name = str(name).strip()
    if ', ' in name:
        parts = name.split(', ', 1)
        return parts[1].strip(), parts[0].strip()
    parts = name.split(' ', 1)
    return parts[0].strip(), parts[1].strip() if len(parts) > 1 else ''


def build_player_link_cache():
    if PLAYER_LINK_CACHE:
        return PLAYER_LINK_CACHE

    if not os.path.isdir(DIAGNOSTICS_DIR):
        return PLAYER_LINK_CACHE

    for filename in os.listdir(DIAGNOSTICS_DIR):
        if not filename.endswith('_source.html'):
            continue
        team_code = filename.split('_source.html')[0].upper()
        filepath = os.path.join(DIAGNOSTICS_DIR, filename)

        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                soup = BeautifulSoup(f.read(), 'html.parser')
        except Exception:
            continue

        for anchor in soup.select('a[href^="/player/"]'):
            href = anchor.get('href', '').strip()
            name = anchor.get_text(strip=True)
            if not href or not name:
                continue
            first_name, last_name = parse_nom(name)
            if not first_name or not last_name:
                continue
            key = (normaliser_nom(first_name), normaliser_nom(last_name), team_code)
            PLAYER_LINK_CACHE[key] = f'{PUCKPEDIA_BASE_URL}{href}'

    return PLAYER_LINK_CACHE


def get_player_link(row):
    team_code = str(row.get('Equipe', '')).strip().upper()
    first_name, last_name = parse_nom(row.get('Joueur', ''))
    if not first_name or not last_name or not team_code:
        return None
    cache = build_player_link_cache()
    return cache.get((normaliser_nom(first_name), normaliser_nom(last_name), team_code))


def charger_rosters_nhl():
    print('[INFO] Chargement des rosters NHL...')
    roster_map = {}
    saison = NHL_SEASON

    for team in NHL_TEAM_CODES:
        try:
            url = f'https://api-web.nhle.com/v1/roster/{team}/{saison}'
            r = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=10)
            if r.status_code != 200:
                print(f'  [WARN] {team}: status {r.status_code}')
                continue
            data = r.json()
            nb = 0
            for groupe in ['forwards', 'defensemen', 'goalies']:
                for p in data.get(groupe, []):
                    prenom = normaliser_nom(p['firstName']['default'])
                    nom = normaliser_nom(p['lastName']['default'])
                    roster_map[(prenom, nom)] = team
                    nb += 1
            print(f'  {team}: {nb} joueurs')
            time.sleep(0.1)
        except Exception as e:
            print(f'  [ERREUR] {team}: {e}')

    print(f'[INFO] {len(roster_map)} joueurs dans les rosters NHL')
    return roster_map


def get_cap_value(row, season):
    val = str(row.get(season, '')).strip().upper()
    if val in ['UFA', 'RFA', '', 'NAN', 'FA']:
        return 0
    try:
        return int(float(val))
    except Exception:
        return 0


def get_row_priority(row, season_cols):
    if not season_cols:
        return (0, 0, 0)
    current_cap = get_cap_value(row, season_cols[0])
    active_seasons = sum(1 for season in season_cols if get_cap_value(row, season) > 0)
    return (1 if current_cap > 0 else 0, current_cap, active_seasons)


def build_player_group_key(row):
    player_link = get_player_link(row)
    if player_link:
        return player_link

    # Fallback : inclure l'équipe pour éviter de fusionner deux homonymes
    # (ex: les deux Sebastian Aho) quand le lien PuckPedia n'est pas dans le cache.
    # Conséquence acceptée : un retained salary sans lien cache ne sera pas sommé,
    # mais c'est moins grave que de fusionner deux joueurs différents.
    first_name, last_name = parse_nom(row.get('Joueur', ''))
    team_code = str(row.get('Equipe', '')).strip().upper()
    return f'name::{normaliser_nom(first_name)}::{normaliser_nom(last_name)}::{team_code}'


def should_sum_retained_fragments(entries, current_team, season_cols):
    if not season_cols or not current_team:
        return False

    current_entry = next(
        (entry for entry in entries if str(entry[1].get('Equipe', '')).strip().upper() == current_team),
        None,
    )
    if current_entry is None:
        return False

    current_cap = get_cap_value(current_entry[1], season_cols[0])
    if current_cap <= 0:
        return False

    other_caps = [
        get_cap_value(entry[1], season_cols[0])
        for entry in entries
        if str(entry[1].get('Equipe', '')).strip().upper() != current_team
    ]
    positive_other_caps = [cap for cap in other_caps if cap > 0]
    if not positive_other_caps:
        return False

    return all(cap <= current_cap for cap in positive_other_caps)


def sum_contract_fragments(row_base, entries, season_cols):
    row_base = row_base.copy()
    for season in season_cols:
        total = 0
        statuses = []
        for _, row, _, _ in entries:
            val = str(row.get(season, '')).strip().upper()
            if val in ['UFA', 'RFA']:
                statuses.append(val)
                continue
            try:
                amount = int(float(val))
                if amount > 0:
                    total += amount
            except Exception:
                pass

        if total > 0:
            row_base[season] = total
        elif statuses:
            row_base[season] = statuses[0]

    return row_base


def fusionner_doublons(df, roster_map):
    season_cols = [col for col in df.columns if '20' in col and '-' in col]

    groupes = {}
    for idx, row in df.iterrows():
        key = build_player_group_key(row)
        if key not in groupes:
            groupes[key] = []
        prenom, nom = parse_nom(row['Joueur'])
        groupes[key].append((idx, row, prenom, nom))

    rows_finales = []
    nb_fusionnes = 0

    for key, entries in groupes.items():
        if len(entries) == 1:
            rows_finales.append(entries[0][1])
            continue

        prenom_norm = normaliser_nom(entries[0][2])
        nom_norm = normaliser_nom(entries[0][3])
        equipes = [str(e[1].get('Equipe', '')).strip().upper() for e in entries]
        print(f"  [DOUBLON] {entries[0][2]} {entries[0][3]} - equipes: {equipes}")

        equipe_actuelle = roster_map.get((prenom_norm, nom_norm))
        if equipe_actuelle:
            print(f'    -> Equipe actuelle (NHL API): {equipe_actuelle}')

        entry_actuelle = next(
            (e for e in entries if str(e[1].get('Equipe', '')).strip().upper() == equipe_actuelle),
            None,
        )

        if entry_actuelle is None:
            entry_actuelle = max(entries, key=lambda entry: get_row_priority(entry[1], season_cols))
            equipe_actuelle = str(entry_actuelle[1].get('Equipe', '')).strip().upper()
            print(f'    -> Fallback sur la ligne prioritaire: {equipe_actuelle}')

        row_base = entry_actuelle[1].copy()
        row_base['Equipe'] = equipe_actuelle

        if should_sum_retained_fragments(entries, equipe_actuelle, season_cols):
            row_base = sum_contract_fragments(row_base, entries, season_cols)
            print(f"    -> Fragment de retained salary somme, cap {season_cols[0]}: {get_cap_value(row_base, season_cols[0])}")
        elif season_cols:
            print(f"    -> Contrat principal retenu, cap {season_cols[0]}: {get_cap_value(row_base, season_cols[0])}")

        rows_finales.append(row_base)
        nb_fusionnes += 1

    print(f'[INFO] {nb_fusionnes} groupes de doublons traites')
    return pd.DataFrame(rows_finales)


def parse_cap(val):
    val_str = str(val).strip().upper()
    if val_str in ['UFA', 'RFA']:
        return None, val_str
    if val_str in ['', 'NAN', 'FA', '0', '0.0']:
        return None, None
    try:
        cap = int(float(val_str))
        return (cap, None) if cap > 0 else (None, None)
    except Exception:
        return None, None


def upload_vers_supabase(csv_path=None):
    if csv_path is None:
        csv_path = os.path.join(BASE_DIR, 'PuckPedia_update.csv')
    print('\n[INFO] Connexion a Supabase...')
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    print(f'[INFO] Lecture du CSV : {csv_path}')
    df = pd.read_csv(csv_path, sep=';')
    print(f'[INFO] {len(df)} lignes dans le CSV')

    mots_exclus = ['Performance Bonus', 'Cap Space', 'Cap Limit', 'Totals',
                   'Annual Cap', 'LTIR', 'Actual Salary', 'Bonus Overage',
                   'Projected Cap', 'Potential Bonus', 'suspension']
    masque = ~df['Joueur'].apply(lambda x: any(m.lower() in str(x).lower() for m in mots_exclus))
    df = df[masque].copy()
    print(f'[INFO] {len(df)} joueurs apres filtrage')

    season_cols = [col for col in df.columns if '20' in col and '-' in col]
    print(f'[INFO] Saisons : {season_cols}')

    build_player_link_cache()
    roster_map = charger_rosters_nhl()
    df = fusionner_doublons(df, roster_map)
    print(f'[INFO] {len(df)} joueurs apres fusion')

    teams_map = {t['code']: t['id'] for t in supabase.table('teams').select('id, code').execute().data}

    # Clé primaire : nom|equipe  (distingue les homonymes comme les deux Sebastian Aho)
    # Clé secondaire : nom seul → liste, utilisée comme fallback si non-ambigu
    teams_id_to_code = {v: k for k, v in teams_map.items()}

    existing_map = {}       # 'fn|ln|team' → {id, draft_year}
    existing_by_name = {}   # 'fn|ln'      → [{id, draft_year, team_code}, ...]

    offset = 0
    while True:
        batch = supabase.table('players').select('id, first_name, last_name, team_id, draft_year').range(offset, offset + 999).execute().data
        for p in batch:
            fn = normaliser_nom(p['first_name'])
            ln = normaliser_nom(p['last_name'])
            tc = teams_id_to_code.get(p.get('team_id'), '')
            entry = {'id': p['id'], 'draft_year': p.get('draft_year')}
            existing_map[f'{fn}|{ln}|{tc}'] = entry
            existing_by_name.setdefault(f'{fn}|{ln}', []).append({'team_code': tc, **entry})
        if len(batch) < 1000:
            break
        offset += 1000
    print(f'[INFO] {len(existing_map)} joueurs deja en base')

    players_to_insert = []
    players_to_update = []

    for _, row in df.iterrows():
        first_name, last_name = parse_nom(row['Joueur'])
        if not first_name or not last_name:
            continue

        team_code = str(row.get('Equipe', '')).strip().upper()
        age_raw = row.get('Age', '')
        try:
            age = float(age_raw) if age_raw and str(age_raw).strip() not in ['', 'nan'] else None
        except Exception:
            age = None

        statut_csv = str(row.get('Statut', '')).strip()
        status = statut_csv if statut_csv in ['ELC', 'UFA', 'RFA'] else None
        if not status and season_cols:
            first_val = str(row.get(season_cols[0], '')).strip().upper()
            if first_val in ['UFA', 'RFA']:
                status = first_val

        payload = {
            'first_name': first_name,
            'last_name': last_name,
            'team_id': teams_map.get(team_code),
            'position': (lambda v: v if v not in ('', 'nan') else None)(str(row.get('Position', '')).strip()),
            'age': age,
            'status': status,
            'is_available': True,
            # is_rookie: uniquement si contrat ELC actif.
            # Les prospects repêchés sans contrat PuckPedia sont gérés par import_drafts.py.
            # Un joueur avec draft_year mais contrat RFA/UFA n'est plus une recrue éligible.
            'is_rookie': status == 'ELC',
        }

        fn = normaliser_nom(first_name)
        ln = normaliser_nom(last_name)
        key_team = f'{fn}|{ln}|{team_code}'
        key_name = f'{fn}|{ln}'

        if key_team in existing_map:
            player_info = existing_map[key_team]
        elif f'{fn}|{ln}|' in existing_map:
            # Joueur en base sans équipe assignée (team_id null)
            player_info = existing_map[f'{fn}|{ln}|']
        else:
            player_info = None

        if player_info:
            players_to_update.append((player_info['id'], payload))
        else:
            players_to_insert.append((key_team, payload))

    print(f'[INFO] A inserer: {len(players_to_insert)} | A mettre a jour: {len(players_to_update)}')

    nb_inserts = 0
    if players_to_insert:
        payloads = [p for _, p in players_to_insert]
        keys = [k for k, _ in players_to_insert]
        for i in range(0, len(payloads), BATCH_SIZE):
            batch = payloads[i:i+BATCH_SIZE]
            batch_keys = keys[i:i+BATCH_SIZE]
            try:
                result = supabase.table('players').insert(batch).execute()
                for j, p in enumerate(result.data):
                    existing_map[batch_keys[j]] = {'id': p['id'], 'draft_year': None}
                nb_inserts += len(result.data)
            except Exception as e:
                print(f'[ERREUR INSERT] Batch {i//BATCH_SIZE + 1}: {e}')

    nb_updates = 0
    update_payloads = [{**payload, 'id': pid} for pid, payload in players_to_update]
    for i in range(0, len(update_payloads), BATCH_SIZE):
        batch = update_payloads[i:i+BATCH_SIZE]
        try:
            supabase.table('players').upsert(batch, on_conflict='id').execute()
            nb_updates += len(batch)
        except Exception as e:
            print(f'[ERREUR UPDATE] Batch {i//BATCH_SIZE + 1}: {e}')

    contracts_to_upsert = []
    for _, row in df.iterrows():
        first_name, last_name = parse_nom(row['Joueur'])
        team_code = str(row.get('Equipe', '')).strip().upper()
        fn = normaliser_nom(first_name)
        ln = normaliser_nom(last_name)
        key_team = f'{fn}|{ln}|{team_code}'
        key_name = f'{fn}|{ln}'

        if key_team in existing_map:
            player_id = existing_map[key_team]['id']
        elif f'{fn}|{ln}|' in existing_map:
            player_id = existing_map[f'{fn}|{ln}|']['id']
        else:
            player_id = None

        if not player_id:
            continue
        # Saisons ELC détectées par le scraper (pipe-séparées)
        elc_raw = str(row.get('ELC_Saisons', '') or '')
        elc_saisons = set(s.strip() for s in elc_raw.split('|') if s.strip())
        for season in season_cols:
            cap_number, contract_status = parse_cap(row.get(season, ''))
            if cap_number is None and contract_status is None:
                continue
            contracts_to_upsert.append({
                'player_id': player_id,
                'season': season,
                'cap_number': cap_number,
                'contract_status': contract_status,
                'is_elc': season in elc_saisons,
            })

    nb_contracts = 0
    for i in range(0, len(contracts_to_upsert), BATCH_SIZE):
        batch = contracts_to_upsert[i:i+BATCH_SIZE]
        try:
            supabase.table('player_contracts').upsert(batch, on_conflict='player_id,season').execute()
            nb_contracts += len(batch)
        except Exception as e:
            print(f'[ERREUR CONTRAT] Batch {i//BATCH_SIZE + 1}: {e}')

    print('\n[OK] Import termine!')
    print(f'     Joueurs inseres   : {nb_inserts}')
    print(f'     Joueurs mis a jour: {nb_updates}')
    print(f'     Contrats upserted : {nb_contracts}')


if __name__ == '__main__':
    upload_vers_supabase()
