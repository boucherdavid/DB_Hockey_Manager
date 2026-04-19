import os
import time
import requests
import pandas as pd
from bs4 import BeautifulSoup
from unidecode import unidecode
from shutil import which
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SOURCE_DIR = os.path.join(BASE_DIR, "source")
DIAGNOSTICS_DIR = os.path.join(BASE_DIR, "diagnostics")
TEAMS_OFFLINE_DIR = os.path.join(BASE_DIR, "teams_offline")
OUTPUT_CSV = os.path.join(BASE_DIR, "PuckPedia_update.csv")
OFFLINE_CSV = os.path.join(BASE_DIR, "PuckPedia_offline.csv")
DEFAULT_SOURCE_CSV = os.path.join(SOURCE_DIR, "teams_todo.csv")

def fusionner_equipes(dossier=TEAMS_OFFLINE_DIR, fichier_sortie=OUTPUT_CSV):
    print(f"\n🔄 Fusion des fichiers CSV du dossier : {dossier}")
    fichiers = [f for f in os.listdir(dossier) if f.endswith(".csv")]
    print(f"📁 Fichiers détectés : {len(fichiers)}")

    all_data = pd.DataFrame()

    for fichier in fichiers:
        chemin = os.path.join(dossier, fichier)
        try:
            df = pd.read_csv(chemin, sep=';')
            print(f"✅ Chargé : {fichier} ({len(df)} lignes)")
            all_data = pd.concat([all_data, df], ignore_index=True)
        except Exception as e:
            print(f"❌ Erreur avec {fichier} : {e}")

    if not all_data.empty:
        # 🧼 Réorganisation des colonnes
        colonnes_fixes = ['Joueur', 'Equipe', 'Statut', 'Position', 'Age', 'ELC_Saisons']
        colonnes_salaires = [col for col in all_data.columns if "20" in col and "-" in col]
        colonnes_finales = colonnes_fixes + colonnes_salaires

        # Ajout des colonnes manquantes si nécessaire
        for col in colonnes_finales:
            if col not in all_data.columns:
                all_data[col] = ''

        all_data = all_data[colonnes_finales]

        all_data.to_csv(fichier_sortie, index=False, sep=';')
        print(f"\n📦 Fichier fusionné sauvegardé : {fichier_sortie}")
        print(f"👥 Total joueurs : {len(all_data)} | Équipes uniques : {all_data['Equipe'].nunique()}")
    else:
        print("⚠️ Aucun fichier valide à fusionner.")

def test_url_accessible(url):
    try:
        headers = {"User-Agent": "Mozilla/5.0"}
        r = requests.get(url, headers=headers, timeout=10)
        return r.status_code == 200
    except:
        return False

def get_driver(headless=True):
    options = Options()
    if headless:
        options.add_argument("--headless=new")
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--window-size=1920,1080")

    chrome_path = which("chromedriver")
    service = Service(executable_path=chrome_path)
    return webdriver.Chrome(service=service, options=options)

def telecharger_html(url, sigle, headless=True, timeout=30):
    print(f"\n🌐 Ouverture de la page {url} pour {sigle}")
    driver = None
    try:
        driver = get_driver(headless)
        driver.set_page_load_timeout(timeout)
        driver.set_script_timeout(timeout)

        try:
            driver.get(url)
        except Exception as e:
            print(f"⚠️ Première tentative échouée : {e}")
            print("🔁 Nouvelle tentative après 5 secondes...")
            time.sleep(5)
            try:
                driver.get(url)
            except Exception as e2:
                print(f"❌ Échec définitif pour {sigle} : {e2}")
                return

        print("⏳ Attente du tableau principal...")
        try:
            WebDriverWait(driver, 20).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, 'table.pp_table'))
            )
            print("✅ Tableau détecté")
        except Exception as e:
            print(f"⚠️ Tableau non détecté pour {sigle} : {e}")
            return

        time.sleep(2)
        html = driver.page_source
        with open(os.path.join(DIAGNOSTICS_DIR, f"{sigle}_source.html"), "w", encoding="utf-8") as f:
            f.write(html)
        print(f"📥 HTML complet sauvegardé pour {sigle}")

    except Exception as e:
        print(f"❌ Erreur Selenium pour {sigle} : {e}")

    finally:
        if driver:
            try:
                driver.quit()
            except Exception:
                pass


def clean_salary(val):
    try:
        val = val.replace(",", "").replace("$", "").strip()
        return int(val)
    except:
        return 0

def scraper_depuis_html(fichier_html, sigle):
    print(f"\n📄 Lecture du fichier HTML : {fichier_html}")
    with open(fichier_html, "r", encoding="utf-8") as f:
        html = f.read()

    soup = BeautifulSoup(html, "html.parser")
    tables = soup.find_all("table")
    print(f"📊 Nombre total de tableaux : {len(tables)}")

    all_players = []
    total_detected = 0

    # Sections à ignorer : rachetés seulement
    # Les "Retained Salary" sont conservés car ils sont nécessaires pour
    # reconstituer le cap hit complet des joueurs échangés avec rétention.
    SECTIONS_TO_SKIP = ['buyout']

    for idx, table in enumerate(tables):
        # Détecter le titre de section précédant ce tableau
        section_heading = ""
        for tag in ['h1', 'h2', 'h3', 'h4']:
            heading = table.find_previous(tag)
            if heading:
                section_heading = heading.get_text(strip=True).lower()
                break

        if any(keyword in section_heading for keyword in SECTIONS_TO_SKIP):
            print(f"⏭️  Tableau {idx+1} ignoré (section : '{section_heading}')")
            continue

        headers = table.find_all("th")
        year_labels = [cell.get_text(strip=True) for cell in headers if "20" in cell.get_text(strip=True) and "-" in cell.get_text(strip=True)]
        rows = table.find_all("tr")
        print(f"📋 Tableau {idx+1} : {len(rows)} lignes détectées")
        lignes_utiles = 0

        for row in rows:
            cells = row.find_all("td")
            if not cells or len(cells) < 2:
                continue

            a_tag = cells[0].find("a")
            name = a_tag.get_text(strip=True) if a_tag else cells[0].get_text(strip=True)
            if not name or not any(c.isalpha() for c in name):
                continue

            age, position, shot = "", "", ""

            # 🔍 Détection agressive de la position "G"
            spans = cells[0].find_all("span")
            for i in range(len(spans) - 1):
                key = spans[i].get_text(strip=True).lower()
                val = spans[i + 1].get_text(strip=True).upper()
                if key == "pos" and val == "G":
                    position = "G"
                elif key == "catches":
                    shot = val

            # 🔄 Fallback sur les autres blocs div
            if not position or not shot:
                info_blocks = cells[0].find_all("div")
                for block in info_blocks:
                    spans = block.find_all("span")
                    if len(spans) >= 2:
                        key = spans[0].get_text(strip=True).lower()
                        val = spans[1].get_text(strip=True)
                        if "age" in key:
                            age = val
                        elif "pos" in key and not position:
                            position = val
                        elif "shot" in key and not shot:
                            shot = val

            # 🧠 Inférence gardien via majuscule dans "Tir"
            if not position and shot in ["L", "R"]:
                position = "G"

            # 🧼 Fallback texte brut
            if not position:
                raw_text = cells[0].get_text(" ", strip=True).lower()
                if "goalie" in raw_text or "goaltender" in raw_text or "g " in raw_text or raw_text.endswith(" g"):
                    position = "G"

            # 🎓 Détection ELC depuis la cellule du nom du joueur
            first_cell_html = str(cells[0])
            is_elc_player = (
                'data-content="Entry Level Contract"' in first_cell_html
                or "pp-elc" in first_cell_html
                or 'title="Entry Level Contract"' in first_cell_html
                or 'alt="ELC"' in first_cell_html
                or 'class="elc"' in first_cell_html
                or "entry level" in first_cell_html.lower()
            )

            # 💰 Extraction des salaires + détection ELC par cellule
            salaries = {}
            statut = ""
            elc_saisons = []

            for i, year in enumerate(year_labels):
                cell_index = 1 + i
                if cell_index < len(cells):
                    cell = cells[cell_index]
                    raw = cell.get("data-extract_ch", "")
                    text = cell.get_text(strip=True)
                    val = raw if raw else text
                    try:
                        salaries[year] = int(float(val.replace("$", "").replace(",", "")))
                    except:
                        salaries[year] = val if val else "FA"

                    # 🎓 Détection ELC par cellule (plusieurs variantes HTML)
                    cell_html = str(cell)
                    if (
                        'data-content="Entry Level Contract"' in cell_html
                        or "pp-elc" in cell_html
                        or 'title="Entry Level Contract"' in cell_html
                        or "entry level" in cell_html.lower()
                    ):
                        elc_saisons.append(year)
                        is_elc_player = True
                else:
                    salaries[year] = "FA"

            # Statut global ELC si au moins une saison est ELC
            if is_elc_player or elc_saisons:
                statut = "ELC"
                # Si ELC détecté au niveau joueur mais pas par cellule,
                # marquer toutes les saisons avec salaire non-nul comme ELC
                if is_elc_player and not elc_saisons:
                    elc_saisons = [y for y in year_labels if isinstance(salaries.get(y), int) and salaries[y] > 0]

            # 🔍 Détection UFA/RFA
            for i, year in enumerate(year_labels):
                cell_index = 1 + i
                if cell_index < len(cells):
                    cell = cells[cell_index]
                    span = cell.find("span", class_="pp-ufa") or cell.find("span", class_="pp-rfa")
                    if span:
                        statut_html = span.get_text(strip=True).upper()
                        if statut_html in ["UFA", "RFA"]:
                            salaries[year] = statut_html

            player_data = {
                'Joueur': name,
                'Equipe': sigle,
                'Position': position,
                'Age': age,
                'Statut': statut,
                'ELC_Saisons': '|'.join(elc_saisons),
                **salaries
            }
            all_players.append(player_data)
            lignes_utiles += 1
            print(f"👤 {name} | Âge: {age} | Pos: {position} | Statut: {statut} | Salaires: {list(salaries.values())}")

        print(f"✅ Tableau {idx+1} : {lignes_utiles} joueurs extraits")
        total_detected += lignes_utiles

    df = pd.DataFrame(all_players)
    print(f"\n👥 Total joueurs extraits : {total_detected}")

    for col in df.columns:
        if df[col].dtype == object:
            df[col] = df[col].apply(lambda x: unidecode(str(x)) if pd.notna(x) else x)

    mots_exclus = ['Totals', 'Annual Cap Hit', 'Current Cap Space', 'Deadline Cap Space', 'LTIR Pool',
                   'Actual Salary Paid', 'Bonus Overages', 'Projected Cap Hit', 'NHL Cap Limit',
                   'Active Roster', 'Standard Contracts', 'Retained Remaining', 'Bonus Carryover Overage',
                   'Projected Cap Space', 'Potential Bonuses']
    df = df[~df['Joueur'].isin(mots_exclus)]
    df = df.drop_duplicates(subset=['Joueur', 'Equipe'])

    year_cols = [col for col in df.columns if "20" in col and "-" in col]
    if year_cols:
        first_year = year_cols[0]
        df[first_year + '_sort'] = df[first_year].apply(lambda x: int(x) if str(x).isdigit() else -1)
        df = df.sort_values(by=[first_year + '_sort'], ascending=False)
        df = df.drop(columns=[first_year + '_sort'])

    # ✅ Colonnes finales sans "Tir"
    final_order = ['Joueur', 'Equipe', 'Statut', 'Position', 'Age', 'ELC_Saisons'] + year_cols
    for col in final_order:
        if col not in df.columns:
            df[col] = ''
    df = df[final_order]

    # ✅ Suppression des ".0" dans les colonnes numériques
    def nettoyer_valeur(val):
        try:
            f = float(val)
            if f.is_integer():
                return int(f)
            return f
        except:
            return val

    for col in year_cols:
        df[col] = df[col].apply(nettoyer_valeur)

    print(f"✅ Extraction finale pour {sigle} : {len(df)} joueurs retenus")
    return df

def scraper_depuis_csv_source(csv_path=DEFAULT_SOURCE_CSV, headless=True):
    print(f"\n📁 Chargement du fichier source : {csv_path}")
    df_urls = pd.read_csv(csv_path, sep=';')
    print(f"🔢 Total d’équipes à traiter : {len(df_urls)}")

    os.makedirs(DIAGNOSTICS_DIR, exist_ok=True)
    os.makedirs(TEAMS_OFFLINE_DIR, exist_ok=True)

    all_table = pd.DataFrame()

    for _, row in df_urls.iterrows():
        url = row['URL']
        sigle = row['Team']
        print(f"\n🚀 Traitement de {sigle} — {url}")

        html_file = os.path.join(DIAGNOSTICS_DIR, f"{sigle}_source.html")

        if os.path.exists(html_file):
            print(f"📂 Fichier HTML déjà présent pour {sigle}, scraping direct.")
        else:
            telecharger_html(url, sigle, headless=headless)
            if not os.path.exists(html_file):
                print(f"❌ HTML introuvable pour {sigle}")
                continue

        try:
            df = scraper_depuis_html(html_file, sigle)
            df.to_csv(os.path.join(TEAMS_OFFLINE_DIR, f"{sigle}.csv"), index=False, sep=';')
            all_table = pd.concat([all_table, df], ignore_index=True)
        except Exception as e:
            print(f"❌ Erreur avec {sigle} : {e}")

    all_table.to_csv(OFFLINE_CSV, index=False, sep=';')
    print(f"\n📦 Fichier global sauvegardé : ./PuckPedia_offline.csv")

    if 'Equipe' in all_table.columns:
        print(f"📊 Total équipes traitées : {len(all_table['Equipe'].unique())}")
    else:
        print("⚠️ Aucune équipe n’a été traitée avec succès.")


def main():
    scraper_depuis_csv_source(headless=False)
    fusionner_equipes()

if __name__ == "__main__":
    main()
