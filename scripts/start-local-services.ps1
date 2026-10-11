$ErrorActionPreference = 'Stop'

$rootDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$logDir = Join-Path $env:TEMP 'xingyu-local-logs'
$node = (Get-Command node -ErrorAction Stop).Source
New-Item -ItemType Directory -Path $logDir -Force | Out-Null

function Test-PortListening([int]$port) {
  return [bool](Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
}

function Wait-ForUrl([string]$url) {
  for ($attempt = 0; $attempt -lt 30; $attempt += 1) {
    try {
      $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
      if ($response.StatusCode -eq 200) { return }
    } catch { }
    Start-Sleep -Seconds 1
  }
  throw "Service was not ready within 30 seconds: $url"
}

$ollama = (Get-Command ollama -ErrorAction SilentlyContinue).Source
if (-not $ollama) { $ollama = Join-Path $env:LOCALAPPDATA 'Programs\Ollama\ollama.exe' }
if (-not (Test-Path -LiteralPath $ollama)) { throw 'Ollama was not found.' }
if (-not (Test-PortListening 11434)) {
  Start-Process -FilePath $ollama -ArgumentList 'serve' -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $logDir 'ollama.out.log') `
    -RedirectStandardError (Join-Path $logDir 'ollama.err.log') | Out-Null
}
Wait-ForUrl 'http://127.0.0.1:11434/api/tags'

if (-not (Test-PortListening 3000)) {
  Start-Process -FilePath $node -ArgumentList 'server/index.js' -WorkingDirectory $rootDir `
    -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDir 'api.out.log') `
    -RedirectStandardError (Join-Path $logDir 'api.err.log') | Out-Null
}
Wait-ForUrl 'http://127.0.0.1:3000/api/config'

if (-not (Test-PortListening 4173)) {
  Start-Process -FilePath $node `
    -ArgumentList 'node_modules/vite/bin/vite.js','--host','0.0.0.0','--port','4173' `
    -WorkingDirectory $rootDir -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $logDir 'vite.out.log') `
    -RedirectStandardError (Join-Path $logDir 'vite.err.log') | Out-Null
}
Wait-ForUrl 'http://127.0.0.1:4173/admin'

Write-Host ''
Write-Host '本机后台（日常默认）: http://127.0.0.1:3000/admin'
Write-Host '前台热更新开发: http://127.0.0.1:4173/  （后台 http://127.0.0.1:4173/admin）'
Write-Host "日志目录: $logDir"
