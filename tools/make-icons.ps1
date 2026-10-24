# Regenerates overlay/img/icon_*.png (on) and icon_*_off.png (paused) from one shield shape.
# Windows PowerShell 5.1 with System.Drawing; the PNGs are committed, so the build does not need this.
param([string]$Out = (Join-Path $PSScriptRoot '..\overlay\img'))
Add-Type -AssemblyName System.Drawing
New-Item -ItemType Directory -Force $Out | Out-Null

function Draw-Shield([int]$size, [string]$fill, [string]$path) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.Clear([System.Drawing.Color]::Transparent)
  $s = $size / 64.0
  # Shield outline on a 64x64 grid: flat top, straight sides, pointed bottom.
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $p.AddBezier((32*$s), (3*$s), (24*$s), (8*$s), (14*$s), (10*$s), (7*$s), (10*$s))
  $p.AddLine((7*$s), (10*$s), (7*$s), (30*$s))
  $p.AddBezier((7*$s), (30*$s), (7*$s), (46*$s), (18*$s), (56*$s), (32*$s), (61*$s))
  $p.AddBezier((32*$s), (61*$s), (46*$s), (56*$s), (57*$s), (46*$s), (57*$s), (30*$s))
  $p.AddLine((57*$s), (30*$s), (57*$s), (10*$s))
  $p.AddBezier((57*$s), (10*$s), (50*$s), (10*$s), (40*$s), (8*$s), (32*$s), (3*$s))
  $p.CloseFigure()
  $g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml($fill))), $p)
  # Inner cut: a dark diagonal bar, the "no ads" mark.
  $pen = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml('#0a0b09')), ([Math]::Max(1.5, 6*$s))
  $pen.StartCap = 'Round'; $pen.EndCap = 'Round'
  $g.DrawLine($pen, (21*$s), (42*$s), (43*$s), (20*$s))
  $g.Dispose()
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

foreach ($size in 16, 32, 64, 128, 512) {
  Draw-Shield $size '#b7ff2e' (Join-Path $Out "icon_$size.png")
  if ($size -ne 512) { Draw-Shield $size '#5a6154' (Join-Path $Out "icon_${size}_off.png") }
}
