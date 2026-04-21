"""
fix_null_positions.py
---------------------
Corrige les joueurs dont le champ `position` est NULL dans Supabase
en interrogeant l'API de recherche NHL par nom.

Usage :
    python fix_null_positions.py [--dry-run]

Options :
    --dry-run   Affiche les corrections sans modifier la BD.

Mapping positions NHL → pool :
    C, L, R, LW, RW, W, F  → F
    D, LD, RD               → D
    G                       → G
"""

import os
import sys
import time
import requests
from unidecode import unidecode
from dotenv import load_dotenv
from supabase import create_client

sys.stdout.reconfigure(encoding='utf-8')
load_dotenv()

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_KEY')
NHL_SEARCH_URL = 'https://search.d3.nhle.com/api/v1/search/player'
SEASON = '2025-26'
DRY_RUN = '--dry-run' in sys.argv

# Mapping des codes de position NHL vers nos valeurs en BD
POSITION_MAP = {
    'C': 'F', 'L': 'F', 'R': 'F', 'LW': 'F', 'RW': 'F', 'W': 'F', 'F': 'F',
    'D': 'D', 'LD': 'D', 'RD': 'D',
    'G': 'G',
}


def normaliser(nom: str) -> str:
    return unidecode(str(nom)).lower().strip().replace('-', ' ')


def chercher_position_nhl(first_name: str, last_name: str, team_code: str) -> str | None:
    """Interroge l'API de recherche NHL et retourne la position normalisée, ou None."""
    query = f'{first_name} {last_name}'
    try:
        r = requests.get(
            NHL_SEARCH_URL,
            params={'culture': 'en-us', 'limit': 10, 'q': query, 'active': 'true'},
            headers={'User-Agent': 'Mozilla/5.0'},
            timeout=10,
        )
        r.raise_for_status()
        results = r.json()
    except Exception as e:
        print(f'  ⚠️  API NHL erreur pour {first_name} {last_name} : {e}')
        return None

    fn_norm = normaliser(first_name)
    ln_norm = normaliser(last_name)

    # Cherche d'abord un match exact nom + équipe
    for p in results:
        if (normaliser(p.get('firstName', '')) == fn_norm
                and normaliser(p.get('lastName', '')) == ln_norm):
            team_match = p.get('lastTeamAbbrev', '') == team_code
            pos_raw = p.get('positionCode', '')
            pos = POSITION_MAP.get(pos_raw.upper())
            if pos:
                quality = '✅ exact+équipe' if team_match else '🔶 exact nom'
                return pos, quality, pos_raw

    # Pas de match — loggue les candidats reçus pour faciliter le débogage
    if results:
        candidats = ', '.join(
            f"{p.get('firstName')} {p.get('lastName')} ({p.get('lastTeamAbbrev','')} / {p.get('positionCode','')})"
            for p in results[:3]
        )
        print(f'  ❌ Aucun match exact. Candidats NHL : {candidats}')
    else:
        print(f'  ❌ Aucun résultat NHL pour « {query} »')

    return None


def main():
    print(f'[INFO] Connexion à Supabase...')
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Récupère tous les joueurs avec position NULL + contrat actif cette saison
    print(f'[INFO] Recherche des joueurs avec position NULL (saison {SEASON})...\n')
    rows = (
        supabase
        .table('players')
        .select('id, first_name, last_name, teams(code)')
        .is_('position', 'null')
        .execute()
        .data
    )

    # Filtre : seulement ceux qui ont un contrat actif cette saison
    contrats = (
        supabase
        .table('player_contracts')
        .select('player_id')
        .eq('season', SEASON)
        .gt('cap_number', 0)
        .execute()
        .data
    )
    ids_avec_contrat = {c['player_id'] for c in contrats}
    joueurs = [r for r in rows if r['id'] in ids_avec_contrat]

    print(f'[INFO] {len(joueurs)} joueur(s) avec position NULL et contrat {SEASON}\n')

    corrections = []   # (id, position, first_name, last_name)
    echecs     = []    # (id, first_name, last_name, team_code)

    for j in joueurs:
        first  = j['first_name']
        last   = j['last_name']
        team   = (j.get('teams') or {}).get('code', '??')
        print(f'  🔍 {first} {last} ({team})')

        result = chercher_position_nhl(first, last, team)
        if result:
            pos, quality, raw = result
            print(f'     → {pos} (NHL: {raw}) [{quality}]')
            corrections.append((j['id'], pos, first, last))
        else:
            echecs.append((j['id'], first, last, team))

        time.sleep(0.3)   # respecte le rate-limit de l'API

    print(f'\n{"=" * 60}')
    print(f'Corrections trouvées : {len(corrections)}')
    print(f'Échecs (aucun match) : {len(echecs)}')

    if DRY_RUN:
        print('\n[DRY-RUN] Aucune modification en BD.')
        if corrections:
            print('\nCorrections qui seraient appliquées :')
            for pid, pos, fn, ln in corrections:
                print(f'  id={pid}  {fn} {ln}  →  position={pos}')
        if echecs:
            print('\nÀ corriger manuellement :')
            for pid, fn, ln, tc in echecs:
                print(f'  id={pid}  {fn} {ln} ({tc})')
        return

    # Applique les corrections
    if corrections:
        print('\n[INFO] Application des corrections...')
        for pid, pos, fn, ln in corrections:
            try:
                supabase.table('players').update({'position': pos}).eq('id', pid).execute()
                print(f'  ✅ id={pid}  {fn} {ln}  →  position={pos}')
            except Exception as e:
                print(f'  ❌ id={pid}  {fn} {ln}  →  ERREUR: {e}')

    if echecs:
        print('\n⚠️  Joueurs à corriger manuellement (aucun résultat NHL) :')
        print('   UPDATE players SET position = \'?\' WHERE id = <id>;')
        for pid, fn, ln, tc in echecs:
            print(f'  id={pid}  {fn} {ln} ({tc})')

    print('\n[INFO] Terminé.')


if __name__ == '__main__':
    main()
