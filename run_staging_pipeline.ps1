$ErrorActionPreference = 'Stop'

$projectRoot = 'C:\Projet_Codex\Hockey_Pool_App'
$envStaging  = Join-Path $projectRoot 'python_script\.env.staging'
$pythonScript = Join-Path $projectRoot 'python_script\import_playoff_stats.py'

if (-not (Test-Path $envStaging)) {
    Write-Error "Fichier introuvable : $envStaging"
}

# Lire les variables du fichier .env.staging
$envVars = @{}
Get-Content $envStaging | Where-Object { $_ -match '^\s*[^#]\w+=' } | ForEach-Object {
    $parts = $_ -split '=', 2
    $envVars[$parts[0].Trim()] = $parts[1].Trim()
}

$stagingUrl = $envVars['STAGING_SUPABASE_URL']
$stagingKey = $envVars['STAGING_SERVICE_KEY']

if (-not $stagingUrl -or -not $stagingKey) {
    Write-Error "STAGING_SUPABASE_URL ou STAGING_SERVICE_KEY manquant dans .env.staging"
}

Write-Host ""
Write-Host "=== PIPELINE STAGING — Stats pool des séries ==="
Write-Host "Supabase : $stagingUrl"
Write-Host ""

# Sauvegarder les valeurs actuelles (prod)
$prevUrl = $env:SUPABASE_URL
$prevKey = $env:SUPABASE_SERVICE_KEY

try {
    $env:SUPABASE_URL        = $stagingUrl
    $env:SUPABASE_SERVICE_KEY = $stagingKey

    python $pythonScript
} finally {
    # Restaurer les variables prod dans tous les cas
    $env:SUPABASE_URL        = $prevUrl
    $env:SUPABASE_SERVICE_KEY = $prevKey
    Write-Host "`nVariables d'environnement prod restaurées."
}
