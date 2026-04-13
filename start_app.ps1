$ErrorActionPreference = 'Stop'

$projectRoot = 'C:\Projet_Codex\Hockey_Pool_App'
$appDir = Join-Path $projectRoot 'app'

if (-not (Test-Path $appDir)) {
    Write-Error "Dossier introuvable: $appDir"
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

Write-Host "Demarrage de l'application depuis $appDir"
Write-Host "Mode dev: Webpack"
Write-Host "URL: http://localhost:3000"
Set-Location $appDir
npm.cmd run dev
