$ErrorActionPreference = 'Stop'

$projectRoot = 'C:\Projet_Codex\Hockey_Pool_App'
$appDir      = Join-Path $projectRoot 'app'
$envLocal    = Join-Path $appDir '.env.local'
$envLocalProd = Join-Path $appDir '.env.local.prod'
$envStaging  = Join-Path $appDir '.env.staging.local'

if (-not (Test-Path $envStaging)) {
    Write-Error "Fichier introuvable : $envStaging"
}

$existing = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($existing) {
    Write-Host "Le port 3000 est deja utilise. Arretez-le avec .\stop_app.ps1."
    exit 1
}

# Swap : .env.local (prod) → .env.local.prod  /  .env.staging.local → .env.local
if (Test-Path $envLocal) {
    if (Test-Path $envLocalProd) { Remove-Item $envLocalProd }
    Rename-Item $envLocal $envLocalProd
}
Copy-Item $envStaging $envLocal

Write-Host ""
Write-Host "=== MODE STAGING ==="
Write-Host "Supabase : https://pwblgjdmuaoyfixeyltg.supabase.co"
Write-Host "URL      : http://localhost:3000"
Write-Host "Ctrl+C pour arreter (restaure .env.local prod automatiquement)"
Write-Host ""

try {
    Set-Location $appDir
    npm.cmd run dev
} finally {
    # Restaurer .env.local prod dans tous les cas (Ctrl+C inclus)
    if (Test-Path $envLocal) { Remove-Item $envLocal }
    if (Test-Path $envLocalProd) { Rename-Item $envLocalProd $envLocal }
    Write-Host "`n.env.local prod restaure."
}
