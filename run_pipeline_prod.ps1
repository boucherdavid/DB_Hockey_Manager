$ErrorActionPreference = 'Stop'

$projectRoot = 'C:\Projet_Codex\Hockey_Pool_App'
$scriptsDir = Join-Path $projectRoot 'python_script'
$envFile = Join-Path $scriptsDir '.env'

if (-not (Test-Path $envFile)) {
    Write-Error "Fichier introuvable: $envFile"
}

# Nettoyer d'abord toute variable residuelle d'une session precedente (ex: staging)
Remove-Item Env:SUPABASE_URL -ErrorAction SilentlyContinue
Remove-Item Env:SUPABASE_SERVICE_KEY -ErrorAction SilentlyContinue

Get-Content $envFile | ForEach-Object {
    if ($_ -match '^(SUPABASE_URL|SUPABASE_SERVICE_KEY)=(.*)$') {
        Set-Item -Path "Env:$($Matches[1])" -Value $Matches[2]
    }
}

if (-not $env:SUPABASE_URL -or -not $env:SUPABASE_SERVICE_KEY) {
    Write-Error "SUPABASE_URL / SUPABASE_SERVICE_KEY absents de $envFile"
}

Write-Host "=== Pipeline hockey pool -- PRODUCTION ===" -ForegroundColor Red
Write-Host "Cible: $($env:SUPABASE_URL)" -ForegroundColor Yellow

$confirm = Read-Host "Ceci va modifier la base de PRODUCTION. Continuer ? (oui/non)"
if ($confirm.Trim().ToLower() -ne 'oui') {
    Write-Host "Annule."
    exit 0
}

$venvPython = Join-Path $scriptsDir 'venv\Scripts\python.exe'
if (-not (Test-Path $venvPython)) {
    Write-Error "Venv introuvable: $venvPython (voir python_script/venv/)"
}

$logsDir = Join-Path $scriptsDir 'logs'
if (-not (Test-Path $logsDir)) { New-Item -ItemType Directory -Path $logsDir | Out-Null }
$timestamp = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'
$logFile = Join-Path $logsDir "run_pipeline_prod_$timestamp.log"
Write-Host "Log  : $logFile" -ForegroundColor Yellow

Set-Location $scriptsDir
& $venvPython run_pipeline.py @args | Tee-Object -FilePath $logFile
