$ErrorActionPreference = 'Stop'

$connections = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue |
    Sort-Object OwningProcess -Unique

if (-not $connections) {
    Write-Host 'Aucune application n''ecoute sur le port 3000.'
    exit 0
}

foreach ($connection in $connections) {
    $targetPid = $connection.OwningProcess
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $targetPid"

    Write-Host "Arret du PID $targetPid"
    if ($process) {
        Write-Host "Processus: $($process.Name)"
        Write-Host "Commande : $($process.CommandLine)"
    }

    Stop-Process -Id $targetPid -Force
}

Write-Host 'Le port 3000 est maintenant libre.'
