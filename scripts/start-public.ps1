# 星屿 H5 一键生产公网启动脚本
# 作用：构建前台、启动 Node 生产服务(3000) + Cloudflare 快速隧道，并输出公网链接
# 用法：双击根目录 start-public.bat，或在 PowerShell 中执行 scripts/start-public.ps1
$ErrorActionPreference = 'Stop'

$rootDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$logDir  = Join-Path $env:TEMP 'xingyu-public-logs'
New-Item -ItemType Directory -Path $logDir -Force | Out-Null

function Test-PortListening([int]$port) {
  return [bool](Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
}

function Test-ProductionBinding {
  $listeners = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
  return [bool]($listeners | Where-Object { $_.LocalAddress -in @('0.0.0.0', '::') })
}

function Test-ProductionReady {
  if (-not (Test-ProductionBinding)) { return $false }
  try {
    $rootResponse = Invoke-WebRequest -Uri 'http://127.0.0.1:3000/' -UseBasicParsing -TimeoutSec 2
    $configResponse = Invoke-WebRequest -Uri 'http://127.0.0.1:3000/api/config' -UseBasicParsing -TimeoutSec 2
    return $rootResponse.StatusCode -eq 200 -and $configResponse.StatusCode -eq 200
  } catch {
    return $false
  }
}

# 1) 本机 Ollama 截图识别服务 (127.0.0.1:11434)
$ollama = (Get-Command ollama -ErrorAction SilentlyContinue).Source
if (-not $ollama) {
  $ollama = Join-Path $env:LOCALAPPDATA 'Programs\Ollama\ollama.exe'
}
if (-not (Test-Path -LiteralPath $ollama)) {
  throw '未找到 Ollama，截图识别必须依赖这台电脑的本机 Ollama。'
}

if (Test-PortListening 11434) {
  Write-Host '[1/3] 本机 Ollama 已在运行 (11434)'
} else {
  Write-Host '[1/3] 启动本机 Ollama ...'
  Start-Process -FilePath $ollama -ArgumentList 'serve' -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $logDir 'ollama.out.log') `
    -RedirectStandardError (Join-Path $logDir 'ollama.err.log') | Out-Null
}

$ollamaReady = $false
for ($i = 0; $i -lt 30; $i++) {
  if (Test-PortListening 11434) { $ollamaReady = $true; break }
  Start-Sleep -Seconds 1
}
if (-not $ollamaReady) { throw '本机 Ollama 未在 30 秒内就绪，请查看 ollama.err.log。' }

$modelLine = Get-Content -LiteralPath (Join-Path $rootDir '.env') -ErrorAction SilentlyContinue |
  Where-Object { $_ -match '^\s*OPENAI_VISION_MODEL\s*=' } |
  Select-Object -Last 1
$visionModel = if ($modelLine) { ($modelLine -split '=', 2)[1].Trim().Trim('"').Trim("'") } else { 'xingyu-score-recognition' }
& $ollama show $visionModel *> $null
if ($LASTEXITCODE -ne 0) { throw "Ollama 缺少截图识别模型: $visionModel" }

# 2) 构建并启动生产 Node (0.0.0.0:3000)
if (Test-PortListening 3000) {
  if (-not (Test-ProductionReady)) {
    throw '端口 3000 已被占用，但不是绑定到 0.0.0.0 的已就绪生产 Node；请先运行 scripts/stop-tunnel.ps1 或手动释放端口。'
  }
  Write-Host '[2/3] 生产 Node 已在运行 (3000)'
} else {
  Write-Host '[2/3] 构建生产前台 ...'
  Push-Location $rootDir
  try {
    & npm run build
    if ($LASTEXITCODE -ne 0) { throw "npm run build 失败 ($LASTEXITCODE)" }
  } finally {
    Pop-Location
  }

  Write-Host '[2/3] 启动生产 Node ...'
  $node = (Get-Command node -ErrorAction Stop).Source
  $hadHost = Test-Path Env:HOST
  $previousHost = $env:HOST
  $env:HOST = '0.0.0.0'
  try {
    Start-Process -FilePath $node -ArgumentList 'server/index.js' -WorkingDirectory $rootDir `
      -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDir 'api.out.log') `
      -RedirectStandardError (Join-Path $logDir 'api.err.log') | Out-Null
  } finally {
    if ($hadHost) { $env:HOST = $previousHost }
    else { Remove-Item Env:HOST -ErrorAction SilentlyContinue }
  }
}

$nodeReady = $false
for ($i = 0; $i -lt 30; $i++) {
  if (Test-ProductionReady) { $nodeReady = $true; break }
  Start-Sleep -Seconds 1
}
if (-not $nodeReady) { Write-Warning '生产 Node 未就绪，请查看日志后重试'; exit 1 }

# 3) Cloudflare 快速隧道（未安装 cloudflared 时降级为仅局域网）
$cfExe = (Get-Command cloudflared -ErrorAction SilentlyContinue).Source
if (-not $cfExe) { $cfExe = 'C:\Program Files (x86)\cloudflared\cloudflared.exe' }
$cfAvailable = Test-Path $cfExe
$cfOut = Join-Path $logDir 'cloudflared.out.log'
$cfErr = Join-Path $logDir 'cloudflared.err.log'
if (-not $cfAvailable) {
  Write-Warning '未找到 cloudflared，跳过公网隧道（仅局域网可访问）'
} else {
  $runningCloudflared = Get-CimInstance Win32_Process -Filter "Name = 'cloudflared.exe'" -ErrorAction SilentlyContinue
  $productionTunnel = $runningCloudflared | Where-Object { $_.CommandLine -match '127\.0\.0\.1:3000' }
  if ($runningCloudflared -and -not $productionTunnel) {
    throw '检测到旧 cloudflared 进程，但它没有指向生产 Node 3000；请先运行 scripts/stop-tunnel.ps1。'
  }
}
if ($cfAvailable -and $productionTunnel) {
  Write-Host '[3/3] Cloudflare 隧道已在运行'
} elseif ($cfAvailable) {
  Write-Host '[3/3] 启动 Cloudflare 快速隧道 ...'
  Remove-Item -LiteralPath $cfOut, $cfErr -Force -ErrorAction SilentlyContinue
  Start-Process -FilePath $cfExe -ArgumentList 'tunnel','--url','http://127.0.0.1:3000','--no-autoupdate' `
    -WindowStyle Hidden -RedirectStandardOutput $cfOut -RedirectStandardError $cfErr | Out-Null
}

$publicUrl = $null
if ($cfAvailable) {
  for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    $m = Select-String -Path $cfOut, $cfErr -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($m) { $publicUrl = $m.Matches[0].Value; break }
  }
  if (-not $publicUrl) { Write-Warning '未获取到公网地址，请查看隧道日志' }
}

$publicOk = $false
if ($publicUrl) {
  for ($i = 0; $i -lt 15; $i++) {
    try {
      $rootResponse = Invoke-WebRequest -Uri "$publicUrl/" -UseBasicParsing -TimeoutSec 5
      $configResponse = Invoke-WebRequest -Uri "$publicUrl/api/config" -UseBasicParsing -TimeoutSec 5
      if ($rootResponse.StatusCode -eq 200 -and $configResponse.StatusCode -eq 200) {
        $publicOk = $true
        break
      }
    } catch { }
    Start-Sleep -Seconds 1
  }
}

$lanIp = (Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq 'Up' } | Select-Object -ExpandProperty IPv4Address | Where-Object { $_.AddressFamily -eq 'IPv4' } | Select-Object -First 1).IPAddress
if (-not $lanIp) { $lanIp = '127.0.0.1' }

Write-Host ''
Write-Host '===================================================='
Write-Host '  星屿 H5 已就绪'
if ($publicUrl) { Write-Host "  公网链接(可发微信群): $publicUrl" }
else { Write-Host '  公网未启用: 未安装 cloudflared 或隧道未就绪（仅局域网可访问）' }
Write-Host "  本地访问: http://${lanIp}:3000/"
Write-Host "  后台管理: http://${lanIp}:3000/admin (仅本机/局域网)"
if ($publicUrl) { Write-Host '  提示: 公网链接在重启后会变化，重新运行本脚本即可获取新链接' }
Write-Host "  日志目录: $logDir"
if ($publicUrl -and -not $publicOk) { Write-Host '  注意: 公网根路径或 /api/config 暂未验证通过，请稍后打开链接确认' }
Write-Host '===================================================='
