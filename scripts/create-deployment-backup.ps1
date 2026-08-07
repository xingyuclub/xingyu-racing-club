# 创建部署前完整私有备份，不写入 Git。
$ErrorActionPreference = 'Stop'

$rootDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupRoot = Join-Path $rootDir "output/deployment-backups/$stamp"
$requiredFiles = @(
  '.env',
  'server/config/admin.local.json',
  'server/data/site-config.json'
)
$copyItems = @(
  '.env',
  'package.json',
  'package-lock.json',
  'server/config/admin.local.json',
  'server/data/site-config.json',
  'server/data/site-config.json.bak',
  'server/data/score-recognition',
  'server/storage/uploads',
  'server/storage/score-recognition'
)

foreach ($relative in $requiredFiles) {
  if (-not (Test-Path (Join-Path $rootDir $relative))) {
    throw "缺少部署备份必需文件: $relative"
  }
}

New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
foreach ($relative in $copyItems) {
  $source = Join-Path $rootDir $relative
  if (-not (Test-Path $source)) {
    Write-Warning "跳过不存在的可选项: $relative"
    continue
  }

  $destination = Join-Path $backupRoot $relative
  New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
  if ((Get-Item $source).PSIsContainer) {
    Copy-Item -LiteralPath $source -Destination $destination -Recurse -Force
  } else {
    Copy-Item -LiteralPath $source -Destination $destination -Force
  }
}

$gitCommit = (& git -C $rootDir rev-parse HEAD).Trim()
$gitBranch = (& git -C $rootDir branch --show-current).Trim()
$meta = [ordered]@{
  createdAt = (Get-Date).ToString('o')
  gitCommit = $gitCommit
  gitBranch = $gitBranch
  root = $rootDir
}
$meta | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $backupRoot 'backup-meta.json') -Encoding utf8

$configPath = Join-Path $backupRoot 'server/data/site-config.json'
$configJson = [System.IO.File]::ReadAllText($configPath, [System.Text.Encoding]::UTF8)
$config = $configJson | ConvertFrom-Json
$rows = @($config.dailyScores | ForEach-Object { @($_.rows).Count } | Measure-Object -Sum).Sum
$weekendRows = @($config.weekendScores | ForEach-Object { @($_.rows).Count } | Measure-Object -Sum).Sum
$summary = [ordered]@{
  roster = @($config.roster).Count
  scoreMembers = @($config.scoreMembers).Count
  dailyDates = @($config.dailyScores).Count
  dailyRows = [int]$rows
  weekendDates = @($config.weekendScores).Count
  weekendRows = [int]$weekendRows
  albums = @($config.albums).Count
  news = @($config.news).Count
}
$summary | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $backupRoot 'runtime-summary.json') -Encoding utf8

$manifest = Get-ChildItem -LiteralPath $backupRoot -File -Recurse |
  Where-Object { $_.Name -notin @('manifest.json') } |
  ForEach-Object {
    $hash = Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256
    [ordered]@{
      path = $_.FullName.Substring($backupRoot.Length + 1)
      bytes = $_.Length
      sha256 = $hash.Hash.ToLowerInvariant()
    }
  }
$manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $backupRoot 'manifest.json') -Encoding utf8

Write-Host "部署备份已创建: $backupRoot"
Write-Host "文件数: $(@($manifest).Count)"
Write-Host "运行时摘要: $(Join-Path $backupRoot 'runtime-summary.json')"
Write-Host "校验清单: $(Join-Path $backupRoot 'manifest.json')"
