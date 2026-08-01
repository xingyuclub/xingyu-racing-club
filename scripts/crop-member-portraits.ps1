param(
  [string]$SourceDir = "$env:USERPROFILE\Desktop\车队网站图片\原图",
  [string]$OutputDir = (Join-Path $PSScriptRoot "..\public\images\members")
)

Add-Type -AssemblyName System.Drawing

$specs = @(
  @{ Source = '@*稳稳.jpg'; Output = 'wenwen.jpg'; X = 940; Y = 60; W = 488; H = 650 },
  @{ Source = '@*屿湍*.jpg'; Output = 'yutuan.jpg'; X = 1610; Y = 90; W = 863; H = 1150 },
  @{ Source = '2026-07-31_113353.PNG'; Output = 'q3-home.jpg'; X = 1080; Y = 100; W = 825; H = 1100 },
  @{ Source = 'fafa.png'; Output = 'fafa.jpg'; X = 1370; Y = 300; W = 990; H = 1320 },
  @{ Source = 'Q3.png'; Output = 'q3.jpg'; X = 1460; Y = 70; W = 848; H = 1130 },
  @{ Source = 'ROSIE.jpg'; Output = 'rosie.jpg'; X = 1505; Y = 80; W = 900; H = 1200 },
  @{ Source = '安安.jpg'; Output = 'anan.jpg'; X = 1360; Y = 70; W = 758; H = 1010 },
  @{ Source = '安好.jpg'; Output = 'anhao.jpg'; X = 1570; Y = 100; W = 825; H = 1100 },
  @{ Source = '白榆.jpg'; Output = 'baiyu.jpg'; X = 1370; Y = 70; W = 758; H = 1010 },
  @{ Source = '初心.png'; Output = 'chuxin.jpg'; X = 1350; Y = 230; W = 1010; H = 1347 },
  @{ Source = '道具老六.jpg'; Output = 'daoju-laoliu.jpg'; X = 1570; Y = 80; W = 863; H = 1150 },
  @{ Source = '咕噜丸.png'; Output = 'guluwan.jpg'; X = 1530; Y = 80; W = 915; H = 1220 },
  @{ Source = '黑岩.png'; Output = 'heiyan.jpg'; X = 1680; Y = 180; W = 650; H = 1850; Mode = 'compose' },
  @{ Source = '玖爺.jpg'; Output = 'jiuye.jpg'; X = 1400; Y = 80; W = 870; H = 1160 },
  @{ Source = '浪漫.jpg'; Output = 'langman.jpg'; X = 1340; Y = 70; W = 758; H = 1010 },
  @{ Source = '荔枝.png'; Output = 'lizhi.jpg'; X = 1540; Y = 80; W = 923; H = 1230 },
  @{ Source = '龙腾.jpg'; Output = 'longteng.jpg'; X = 1510; Y = 70; W = 848; H = 1130 },
  @{ Source = '猫猫球.png'; Output = 'maomaoqiu.jpg'; X = 1440; Y = 80; W = 840; H = 1120 },
  @{ Source = '美人书.jpg'; Output = 'meirenshu.jpg'; X = 0; Y = 220; W = 1478; H = 2200; Mode = 'contain' },
  @{ Source = '米米.jpg'; Output = 'mimi.jpg'; X = 1500; Y = 70; W = 885; H = 1180 },
  @{ Source = '暖暖.jpg'; Output = 'nuannuan.jpg'; X = 1520; Y = 70; W = 848; H = 1130 },
  @{ Source = '青岑.jpg'; Output = 'qingcen.jpg'; X = 1360; Y = 80; W = 840; H = 1120 },
  @{ Source = '青山.png'; Output = 'qingshan.jpg'; X = 1500; Y = 70; W = 848; H = 1130 },
  @{ Source = '十二.jpg'; Output = 'shier.jpg'; X = 1450; Y = 70; W = 885; H = 1180 },
  @{ Source = '妄念.jpg'; Output = 'wangnian.jpg'; X = 1480; Y = 70; W = 900; H = 1200 },
  @{ Source = '纤云.jpg'; Output = 'xianyun.jpg'; X = 1560; Y = 70; W = 855; H = 1140 },
  @{ Source = '小雨.jpg'; Output = 'xiaoyu.jpg'; X = 1540; Y = 70; W = 893; H = 1190 },
  @{ Source = '榆曲.jpg'; Output = 'yuqu.jpg'; X = 1530; Y = 70; W = 900; H = 1200 }
)

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
  Where-Object MimeType -eq 'image/jpeg'
$encoderParameters = [System.Drawing.Imaging.EncoderParameters]::new(1)
$encoderParameters.Param[0] = [System.Drawing.Imaging.EncoderParameter]::new(
  [System.Drawing.Imaging.Encoder]::Quality,
  90L
)

foreach ($spec in $specs) {
  $matches = @(Get-ChildItem -LiteralPath $SourceDir -File | Where-Object Name -Like $spec.Source)
  if ($matches.Count -ne 1) {
    throw "Expected one source matching '$($spec.Source)', found $($matches.Count)."
  }

  $source = [System.Drawing.Image]::FromFile($matches[0].FullName)
  $target = [System.Drawing.Bitmap]::new(900, 1200, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $graphics = [System.Drawing.Graphics]::FromImage($target)
  $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

  $sourceRect = [System.Drawing.Rectangle]::new($spec.X, $spec.Y, $spec.W, $spec.H)
  $targetRect = [System.Drawing.Rectangle]::new(0, 0, 900, 1200)

  if ($spec.Mode -eq 'compose') {
    $background = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
      $targetRect,
      [System.Drawing.Color]::FromArgb(24, 24, 54),
      [System.Drawing.Color]::FromArgb(194, 194, 224),
      90
    )
    $graphics.FillRectangle($background, $targetRect)
    $background.Dispose()

    $scale = [Math]::Min(900 / $spec.W, 1200 / $spec.H)
    $fitWidth = [Math]::Round($spec.W * $scale)
    $fitHeight = [Math]::Round($spec.H * $scale)
    $fitRect = [System.Drawing.Rectangle]::new(
      [Math]::Floor((900 - $fitWidth) / 2),
      [Math]::Floor((1200 - $fitHeight) / 2),
      $fitWidth,
      $fitHeight
    )
    $graphics.DrawImage($source, $fitRect, $sourceRect, [System.Drawing.GraphicsUnit]::Pixel)
  } elseif ($spec.Mode -eq 'contain') {
    $coverHeight = [Math]::Floor($spec.W / 0.75)
    $coverY = $spec.Y + [Math]::Floor(($spec.H - $coverHeight) / 2)
    $coverRect = [System.Drawing.Rectangle]::new($spec.X, $coverY, $spec.W, $coverHeight)
    $graphics.DrawImage($source, $targetRect, $coverRect, [System.Drawing.GraphicsUnit]::Pixel)

    $scale = [Math]::Min(900 / $spec.W, 1200 / $spec.H)
    $fitWidth = [Math]::Round($spec.W * $scale)
    $fitHeight = [Math]::Round($spec.H * $scale)
    $fitRect = [System.Drawing.Rectangle]::new(
      [Math]::Floor((900 - $fitWidth) / 2),
      [Math]::Floor((1200 - $fitHeight) / 2),
      $fitWidth,
      $fitHeight
    )
    $graphics.DrawImage($source, $fitRect, $sourceRect, [System.Drawing.GraphicsUnit]::Pixel)
  } else {
    $graphics.DrawImage($source, $targetRect, $sourceRect, [System.Drawing.GraphicsUnit]::Pixel)
  }

  $destination = Join-Path $OutputDir $spec.Output
  $target.Save($destination, $jpegCodec, $encoderParameters)
  $graphics.Dispose()
  $target.Dispose()
  $source.Dispose()
  Write-Host "Created $destination"
}

$encoderParameters.Dispose()
