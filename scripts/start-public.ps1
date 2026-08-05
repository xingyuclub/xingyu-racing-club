# 星屿 H5 一键公网启动脚本
# 作用：启动配置 API(3000) + 前台 H5(4173) + Cloudflare 快速隧道，并输出可发微信群的公网链接
# 用法：双击根目录 start-public.bat，或在 PowerShell 中执行 scripts/start-public.ps1
$ErrorActionPreference = 'Stop'

$rootDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$logDir  = Join-Path $env:TEMP 'xingyu-public-logs'
New-Item -ItemType Directory -Path $logDir -Force | Out-Null

function Test-PortListening([int]$port) {
  return [bool](Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
}

# 1) 配置 API (127.0.0.1:3000)
if (Test-PortListening 3000) {
  Write-Host '[1/3] 配置 API 已在运行 (127.0.0.1:3000)'
} else {
  Write-Host '[1/3] 启动配置 API ...'
  $node = (Get-Command node).Source
  Start-Process -FilePath $node -ArgumentList 'server/index.js' -WorkingDirectory $rootDir `
    -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDir 'api.out.log') `
    -RedirectStandardError (Join-Path $logDir 'api.err.log') | Out-Null
}

# 2) 前台 H5 (Vite, 0.0.0.0:4173)
if (Test-PortListening 4173) {
  Write-Host '[2/3] 前台 H5 已在运行 (0.0.0.0:4173)'
} else {
  Write-Host '[2/3] 启动前台 H5 ...'
  $node = (Get-Command node).Source
  Start-Process -FilePath $node -ArgumentList 'node_modules/vite/bin/vite.js','--host','0.0.0.0','--port','4173' `
    -WorkingDirectory $rootDir -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $logDir 'vite.out.log') `
    -RedirectStandardError (Join-Path $logDir 'vite.err.log') | Out-Null
}

$viteReady = $false
for ($i = 0; $i -lt 20; $i++) {
  try {
    if ((Invoke-WebRequest -Uri 'http://127.0.0.1:4173/' -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200) { $viteReady = $true; break }
  } catch { }
  Start-Sleep -Seconds 1
}
if (-not $viteReady) { Write-Warning '前台 H5 未就绪，请查看日志后重试'; exit 1 }

# 3) Cloudflare 快速隧道
$cfExe = (Get-Command cloudflared -ErrorAction SilentlyContinue).Source
if (-not $cfExe) { $cfExe = 'C:\Program Files (x86)\cloudflared\cloudflared.exe' }
$cfOut = Join-Path $logDir 'cloudflared.out.log'
$cfErr = Join-Path $logDir 'cloudflared.err.log'
if (Get-Process cloudflared -ErrorAction SilentlyContinue) {
  Write-Host '[3/3] Cloudflare 隧道已在运行'
} else {
  Write-Host '[3/3] 启动 Cloudflare 快速隧道 ...'
  Start-Process -FilePath $cfExe -ArgumentList 'tunnel','--url','http://localhost:4173','--no-autoupdate' `
    -WindowStyle Hidden -RedirectStandardOutput $cfOut -RedirectStandardError $cfErr | Out-Null
}

$publicUrl = $null
for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Seconds 1
  $m = Select-String -Path $cfOut, $cfErr -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($m) { $publicUrl = $m.Matches[0].Value; break }
}
if (-not $publicUrl) { Write-Warning '未获取到公网地址，请查看隧道日志'; exit 1 }

$publicOk = $false
for ($i = 0; $i -lt 15; $i++) {
  try {
    if ((Invoke-WebRequest -Uri $publicUrl -UseBasicParsing -TimeoutSec 5).StatusCode -eq 200) { $publicOk = $true; break }
  } catch { }
  Start-Sleep -Seconds 1
}

$lanIp = (Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq 'Up' } | Select-Object -ExpandProperty IPv4Address | Where-Object { $_.AddressFamily -eq 'IPv4' } | Select-Object -First 1).IPAddress
if (-not $lanIp) { $lanIp = '127.0.0.1' }

Write-Host ''
Write-Host '===================================================='
Write-Host '  星屿 H5 已就绪'
Write-Host "  公网链接(可发微信群): $publicUrl"
Write-Host "  本地访问: http://${lanIp}:4173/"
Write-Host '  后台管理: http://127.0.0.1:4173/admin (仅本机/局域网)'
Write-Host "  日志目录: $logDir"
if (-not $publicOk) { Write-Host '  注意: 公网地址暂未验证通过，请稍后打开链接确认' }
Write-Host '===================================================='
