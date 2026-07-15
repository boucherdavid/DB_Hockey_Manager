$ErrorActionPreference = 'Stop'

$projectRoot = 'C:\Projet_Codex\Hockey_Pool_App'
$appDir      = Join-Path $projectRoot 'app'
$envStaging  = Join-Path $appDir '.env.staging.local'
$envLocal    = Join-Path $appDir '.env.local'

if (-not (Test-Path $envStaging)) {
    Write-Error "Fichier introuvable : $envStaging"
}

$existing = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($existing) {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $($existing.OwningProcess)"
    Write-Host "Le port 3000 est deja utilise par PID $($existing.OwningProcess)."
    if ($process) {
        Write-Host "Processus: $($process.Name)"
        Write-Host "Commande : $($process.CommandLine)"
    }
    Write-Host "Arretez-le avec .\stop_app.ps1 ou Ctrl+C dans la fenetre active."
    exit 1
}

# L'app tourne toujours en local contre staging - la prod reelle est sur Vercel,
# jamais demarree/arretee depuis ce poste. .env.local est ecrase a chaque lancement,
# rien a restaurer a la fin.
Copy-Item $envStaging $envLocal -Force

Write-Host ""
Write-Host "Demarrage de l'application (staging) depuis $appDir"
Write-Host "Supabase : https://pwblgjdmuaoyfixeyltg.supabase.co"
Write-Host "URL      : http://localhost:3000"
Write-Host ""

Set-Location $appDir
npm.cmd run dev
