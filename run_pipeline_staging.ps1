$ErrorActionPreference = 'Stop'

$projectRoot = 'C:\Projet_Codex\Hockey_Pool_App'
$scriptsDir = Join-Path $projectRoot 'python_script'
$envFile = Join-Path $scriptsDir '.env.staging'

if (-not (Test-Path $envFile)) {
    Write-Error "Fichier introuvable: $envFile"
}

# Nettoyer d'abord toute variable residuelle d'une session precedente (ex: prod)
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

$venvPython = Join-Path $scriptsDir 'venv\Scripts\python.exe'
if (-not (Test-Path $venvPython)) {
    Write-Error "Venv introuvable: $venvPython (voir python_script/venv/)"
}

$logsDir = Join-Path $scriptsDir 'logs'
if (-not (Test-Path $logsDir)) { New-Item -ItemType Directory -Path $logsDir | Out-Null }
$timestamp = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'
$logFile = Join-Path $logsDir "run_pipeline_staging_$timestamp.log"

# Python ecrit son stdout en UTF-8 (scripts reconfigures) ; sans ceci,
# PowerShell le decode avec l'encodage console par defaut (pas UTF-8) et
# Tee-Object/Out-File ecrit le fichier en UTF-16 par defaut -> log corrompu.
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'

Write-Host "=== Pipeline hockey pool -- STAGING ===" -ForegroundColor Cyan
Write-Host "Cible: $($env:SUPABASE_URL)" -ForegroundColor Yellow
Write-Host "Log  : $logFile" -ForegroundColor Yellow

Set-Location $scriptsDir
& $venvPython run_pipeline.py @args | Tee-Object -FilePath $logFile
