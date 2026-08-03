# ============================================================
#  星屿车队 H5 - 公网隧道一键启动（cpolar 国内节点）
#  作用：确保 Node 生产服务在 3000 端口运行，再启动 cpolar
#        公网隧道，并在日志中打印公网访问地址。
#  用法：右键"用 PowerShell 运行"，或在终端执行：
#        powershell -ExecutionPolicy Bypass -File .\scripts\start-tunnel.ps1
#  停止：运行 stop-tunnel.ps1
# ============================================================
$ErrorActionPreference = 'Stop'

$Root     = 'C:\Users\Admin\Documents\H5'
$ToolsDir = Join-Path $Root 'tools'
$LogsDir  = Join-Path $Root 'logs'
$Port     = 3000

# 自动定位 tools 目录下的 cpolar exe
$CpolarExe = Get-ChildItem -Path $ToolsDir -Filter 'cpolar*.exe' -File -ErrorAction SilentlyContinue |
             Sort-Object Length -Descending | Select-Object -First 1
if (-not $CpolarExe) { throw "找不到 cpolar.exe，请确认 $ToolsDir 下有该文件" }

New-Item -ItemType Directory -Force -Path $LogsDir | Out-Null

# --- 1. 确保 Node 生产服务在 $Port 运行 ---
$listening = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if (-not $listening) {
    Write-Host "[1/2] Node 服务未运行，以生产模式启动..." -ForegroundColor Cyan
    Start-Process -WindowStyle Hidden -FilePath 'node' `
        -ArgumentList 'server/index.js' `
        -WorkingDirectory $Root `
        -RedirectStandardOutput "$LogsDir\node-out.log" `
        -RedirectStandardError  "$LogsDir\node-err.log"
    $ready = $false
    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Seconds 1
        if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) { $ready = $true; break }
    }
    if (-not $ready) { throw "Node 启动超时，请查看 $LogsDir\node-err.log" }
    Write-Host "[1/2] Node 服务已启动 (端口 $Port)" -ForegroundColor Green
} else {
    Write-Host "[1/2] Node 服务已在运行 (端口 $Port，PID $($listening.OwningProcess))" -ForegroundColor Green
}

# --- 2. 启动 cpolar 公网隧道（国内 cn 节点）---
Write-Host "[2/2] 启动 cpolar 公网隧道（国内节点）..." -ForegroundColor Cyan
Write-Host "公网地址会在下方输出（含 cpolar.cn 的行）。" -ForegroundColor Yellow
Write-Host "也可打开 http://127.0.0.1:4040 查看 cpolar dashboard。" -ForegroundColor Yellow
Write-Host "------------------------------------------------------------"
& $CpolarExe.FullName http $Port -region=cn --log=stdout --log-level=info
