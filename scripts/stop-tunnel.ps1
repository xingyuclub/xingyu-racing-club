# ============================================================
#  星屿车队 H5 - 停止 Node 服务和 cpolar 隧道进程
# ============================================================
$ErrorActionPreference = 'SilentlyContinue'
$Port = 3000

$listening = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($listening) {
    Stop-Process -Id $listening.OwningProcess -Force
    Write-Host "已停止 Node 服务 (PID $($listening.OwningProcess))" -ForegroundColor Green
} else {
    Write-Host "Node 服务未在运行" -ForegroundColor DarkGray
}

Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -like 'cpolar*' } | ForEach-Object {
    Stop-Process -Id $_.Id -Force
    Write-Host "已停止 $($_.ProcessName) (PID $($_.Id))" -ForegroundColor Green
}
