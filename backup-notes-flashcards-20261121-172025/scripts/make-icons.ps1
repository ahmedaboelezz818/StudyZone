# Builds the Second Brain icon set from the original emblem PNG.
# Preserves transparency (PNG24 with alpha) and aspect ratio.
# Does NOT modify the original file.
$ErrorActionPreference = 'Stop'
$root = "C:\Programming.vsCode\WebPages\StudyZone"
$srcPath = Join-Path $root "Brain and Plant Growth Emblem.png"

Add-Type -AssemblyName System.Drawing

$src = [System.Drawing.Image]::FromFile($srcPath)
Write-Output "source: $($src.Width)x$($src.Height) px"

# Output locations
$assetsDir   = Join-Path $root "assets\images"
$webIconsDir = Join-Path $root "icons"
$androidDir  = Join-Path $root "android\app\src\main\res"
New-Item -ItemType Directory -Force $assetsDir   | Out-Null
New-Item -ItemType Directory -Force $webIconsDir | Out-Null

# 1) Working copy of the emblem (full resolution, transparent)
$emblemPath = Join-Path $assetsDir "second-brain-emblem.png"
if (Test-Path $emblemPath) { Remove-Item $emblemPath -Force }
[System.Drawing.Bitmap]::new($src).Save($emblemPath, [System.Drawing.Imaging.ImageFormat]::Png)
Write-Output "created: $emblemPath"

function New-IconSize($size, $dest, $paddingFraction) {
    $canvas = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($canvas)
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    # fit into (1 - 2*padding) of the canvas keeping aspect ratio
    $pad = [int]([math]::Round($size * $paddingFraction))
    $maxSide = $size - 2 * $pad
    $ratio = [math]::Min($maxSide / $src.Width, $maxSide / $src.Height)
    $w = [int]([math]::Round($src.Width * $ratio))
    $h = [int]([math]::Round($src.Height * $ratio))
    $x = [int](($size - $w) / 2)
    $y = [int](($size - $h) / 2)
    $g.DrawImage($src, $x, $y, $w, $h)
    $g.Dispose()
    $dir = Split-Path $dest
    New-Item -ItemType Directory -Force $dir | Out-Null
    $canvas.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png)
    $canvas.Dispose()
    Write-Output "created: $dest ($size x $size)"
}

# 2) Web icons (PWA / browser). Keep emblem aspect ratio, no crop.
New-IconSize 32  (Join-Path $webIconsDir "icon-32.png")   0.06
New-IconSize 48  (Join-Path $webIconsDir "icon-48.png")   0.06
New-IconSize 96  (Join-Path $webIconsDir "icon-96.png")   0.06
New-IconSize 180 (Join-Path $webIconsDir "apple-touch-icon.png") 0.06
New-IconSize 192 (Join-Path $webIconsDir "icon-192.png")  0.06
New-IconSize 512 (Join-Path $webIconsDir "icon-512.png")  0.06
# Extra sizes used elsewhere / useful
New-IconSize 180 (Join-Path $root "apple-touch-icon.png") 0.06
New-IconSize 192 (Join-Path $root "favicon-192.png")      0.06   # may be unused
# 3) Maskable icons for Android/Adaptive: emblem ~72% safe zone with transparent bg
New-IconSize 192 (Join-Path $webIconsDir "maskable-192.png") 0.14
New-IconSize 512 (Join-Path $webIconsDir "maskable-512.png") 0.14

# 4) Favicon.ico: 32px PNG content (modern browsers accept it) — write 16+32 manually
New-IconSize 16 (Join-Path $webIconsDir "favicon-16.png")  0.04
New-IconSize 32 (Join-Path $webIconsDir "favicon-32.png")  0.04

# 5) Android adaptive icon foreground (drawable-xxxhdpi etc.) and mipmaps
# mipmap buckets for classic launcher icons
$mipmaps = @{ "mipmap-mdpi" = 48; "mipmap-hdpi" = 72; "mipmap-xhdpi" = 96; "mipmap-xxhdpi" = 144; "mipmap-xxxhdpi" = 192 }
foreach ($bucket in $mipmaps.GetEnumerator()) {
    $size = $bucket.Value
    New-IconSize $size (Join-Path $androidDir "$($bucket.Key)\ic_launcher.png") 0.08
    New-IconSize $size (Join-Path $androidDir "$($bucket.Key)\ic_launcher_round.png") 0.08
}
# Adaptive icon foreground drawables: 108dp layers at each density
$drawables = @{ "drawable-mdpi" = 108; "drawable-hdpi" = 162; "drawable-xhdpi" = 216; "drawable-xxhdpi" = 324; "drawable-xxxhdpi" = 432 }
foreach ($bucket in $drawables.GetEnumerator()) {
    $size = $bucket.Value
    New-IconSize $size (Join-Path $androidDir "$($bucket.Key)\ic_launcher_foreground.png") 0.18
}

$src.Dispose()
Write-Output "done"
