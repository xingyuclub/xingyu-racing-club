# ============================================================
#  星屿车队 H5 - 停止生产 Node 服务和 Cloudflare 隧道进程
# ============================================================
$ErrorActionPreference = 'SilentlyContinue'
$Ports = @(3000, 4173)

foreach ($Port in $Ports) {
    $listening = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if ($listening) {
        $listening | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object {
            Stop-Process -Id $_ -Force
            Write-Host "已停止端口 $Port 的进程 (PID $_)" -ForegroundColor Green
        }
    }
}

Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -like 'cloudflared*' } | ForEach-Object {
    Stop-Process -Id $_.Id -Force
    Write-Host "已停止 $($_.ProcessName) (PID $($_.Id))" -ForegroundColor Green
}
