$ErrorActionPreference = 'Stop'

$root = Split-Path -Path $PSScriptRoot -Parent
$logDir = Join-Path $root 'logs'
$outLog = Join-Path $logDir 'api-3000.log'
$errLog = Join-Path $logDir 'api-3000.err.log'
New-Item -ItemType Directory -Path $logDir -Force | Out-Null

function Stop-Port3000 {
    $connections = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
    $processIds = $connections | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($processId in $processIds) {
        if ($processId -gt 0) {
            Write-Host "Stopping old process PID $processId"
            Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
        }
    }
    if (-not $processIds) {
        Write-Host 'Port 3000: no listener found'
    }
    Start-Sleep -Seconds 1
}

function Start-Api {
    Start-Process `
        -FilePath 'node' `
        -ArgumentList 'server/index.js' `
        -WorkingDirectory $root `
        -WindowStyle Hidden `
        -RedirectStandardOutput $outLog `
        -RedirectStandardError $errLog
}

function Wait-ApiHealthy {
    $deadline = (Get-Date).AddSeconds(30)
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -Uri 'http://127.0.0.1:3000/api/config' -UseBasicParsing -TimeoutSec 5
            if ($response.StatusCode -eq 200) {
                return $true
            }
        } catch {
            Start-Sleep -Milliseconds 800
        }
    }
    return $false
}

Stop-Port3000
Write-Host 'Starting API (node server/index.js)...'
Start-Api

if (Wait-ApiHealthy) {
    Write-Host 'API is up: http://127.0.0.1:3000/ (error log: logs/api-3000.err.log)'
    exit 0
}

Write-Host 'API not healthy within 30s. Last error log lines:' -ForegroundColor Red
Get-Content $errLog -Tail 20 -ErrorAction SilentlyContinue | Write-Host
exit 1
