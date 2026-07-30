# Renommer le dossier local du projet

Guide à suivre quand on renomme le dossier local `C:\Projet_Codex\Hockey_Pool_App`
(ex: pour refléter le nouveau nom du projet, Cap Crunch). Ce renommage est purement
local — aucune action requise côté Git, GitHub ou Vercel.

---

## 1. Fermer tout ce qui touche le dossier

- Arrêter l'application si elle tourne : `./stop_app.ps1`
- Fermer VS Code / Claude Code
- Fermer tout terminal (PowerShell, Git Bash) ouvert dans le dossier

## 2. Renommer le dossier

Depuis l'explorateur Windows, ou en PowerShell (depuis le dossier parent) :

```powershell
Rename-Item 'C:\Projet_Codex\Hockey_Pool_App' 'C:\Projet_Codex\NouveauNom'
```

Git n'a besoin de rien de spécial — `.git` suit avec le dossier, aucun commit requis.

## 3. Corriger les chemins absolus codés en dur

Ces fichiers contiennent `C:\Projet_Codex\Hockey_Pool_App` en dur — à remplacer par
le nouveau chemin :

| Fichier | Ligne (approx.) | Contenu |
|---|---|---|
| `.mcp.json` | 8 | `"C:\\Projet_Codex\\Hockey_Pool_App"` (chemin du serveur MCP context-engine) |
| `start_app.ps1` | 3 | `$projectRoot = 'C:\Projet_Codex\Hockey_Pool_App'` |
| `run_pipeline_staging.ps1` | 3 | `$projectRoot = 'C:\Projet_Codex\Hockey_Pool_App'` |
| `run_pipeline_prod.ps1` | 3 | `$projectRoot = 'C:\Projet_Codex\Hockey_Pool_App'` |
| `docs/GIT_GUIDE.md` | 3, 10 | mentions du chemin dans la doc |
| `app/app/admin/effectifs/page.tsx` | ~167 | instructions affichées à l'admin (`cd C:\...\python_script`) |
| `app/app/admin/pool/page.tsx` | ~371 | instructions affichées à l'admin (`cd C:\...\python_script`) |
| `CLAUDE.md` | ~105 | diagramme d'arborescence (cosmétique, `Hockey_Pool_App/`) |

Vérifier qu'aucune autre occurrence n'a été oubliée (relancer la recherche après coup) :

```powershell
Select-String -Path *.ps1,*.json,*.md -Pattern "Projet_Codex" -Recurse
```

(ignorer les résultats dans `app/.next/**` — cache de build régénéré automatiquement,
et dans les entrées historiques de `SUIVI_PROJET.md` — journal, ne pas réécrire le passé).

## 4. Recréer l'environnement virtuel Python

`python_script/venv/` contient des chemins absolus dans ses scripts d'activation — un
simple déplacement de dossier le casse. Le plus simple est de le recréer :

```powershell
cd python_script
Remove-Item -Recurse -Force venv
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## 5. Supprimer le cache de build Next.js

`app/.next/` contient aussi des chemins absolus. Se régénère automatiquement au
prochain `npm run dev` ou `npm run build` — à supprimer seulement si un comportement
bizarre apparaît après le renommage :

```powershell
Remove-Item -Recurse -Force app\.next
```

## 6. À savoir : mémoire Claude Code

La mémoire persistante de Claude Code pour ce projet (décisions, contexte de sessions
passées — distinct de `SUIVI_PROJET.md` et `CLAUDE.md`, qui vivent dans le repo et
restent intacts) est stockée dans un dossier dérivé du chemin actuel
(`C:\Users\david\.claude\projects\c--Projet-Codex-Hockey-Pool-App\memory\`). Une fois
le dossier renommé, une nouvelle session Claude Code y démarrera avec cette mémoire-là
vierge — l'impact réel est faible puisque `SUIVI_PROJET.md`/`CLAUDE.md` restent la
vraie source de vérité, mais le signaler à Claude au moment du renommage permet de
migrer manuellement ce qui vaut la peine de l'être.

## 7. Vérification finale

```powershell
cd C:\Projet_Codex\NouveauNom
./start_app.ps1
```

Confirmer que l'app démarre normalement contre staging, sans erreur de chemin.
