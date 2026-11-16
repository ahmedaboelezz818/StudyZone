$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$root = "C:\Programming.vsCode\WebPages\StudyZone"
$srcPath = Join-Path $root "assets\images\second-brain-emblem.png"
$src = [System.Drawing.Bitmap]::FromFile($srcPath)
Write-Output "source: $($src.Width)x$($src.Height)"

# --- 1) Splash screens: dark brand background with centered emblem ----------
$splashTargets = @{
  'drawable'              = @{ w = 480;  h = 320 };
  'drawable-land-hdpi'    = @{ w = 800;  h = 480 };
  'drawable-land-mdpi'    = @{ w = 480;  h = 320 };
  'drawable-land-xhdpi'   = @{ w = 1280; h = 720 };
  'drawable-land-xxhdpi'  = @{ w = 1600; h = 960 };
  'drawable-land-xxxhdpi' = @{ w = 1920; h = 1280 };
  'drawable-port-hdpi'    = @{ w = 480;  h = 800 };
  'drawable-port-mdpi'    = @{ w = 320;  h = 480 };
  'drawable-port-xhdpi'   = @{ w = 720;  h = 1280 };
  'drawable-port-xxhdpi'  = @{ w = 960;  h = 1600 };
  'drawable-port-xxxhdpi' = @{ w = 1280; h = 1920 };
}
$bg = [System.Drawing.Color]::FromArgb(255, 7, 28, 24)   # #071C18
foreach ($dir in $splashTargets.GetEnumerator()) {
    $w = $dir.Value.w; $h = $dir.Value.h
    $dest = Join-Path (Join-Path $root "android\app\src\main\res\$($dir.Key)") "splash.png"
    $canvas = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($canvas)
    $g.Clear($bg)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $target = [int]([math]::Round([math]::Min($w, $h) * 0.46))
    $ratio = $target / [math]::Max($src.Width, $src.Height)
    $dw = [int]([math]::Round($src.Width * $ratio)); $dh = [int]([math]::Round($src.Height * $ratio))
    $x = [int](($w - $dw) / 2); $y = [int](($h - $dh) / 2)
    $g.DrawImage($src, $x, $y, $dw, $dh)
    $g.Dispose()
    $canvas.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png)
    $canvas.Dispose()
    Write-Output "splash: $($dir.Key) $w x $h"
}

# --- 2) Notification small icon: white silhouette from the emblem alpha -----
$notif = New-Object System.Drawing.Bitmap($src.Width, $src.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
for ($y = 0; $y -lt $src.Height; $y += 1) {
    for ($x = 0; $x -lt $src.Width; $x += 1) {
        $p = $src.GetPixel($x, $y)
        if ($p.A -gt 40) {
            $notif.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, 255, 255, 255))
        } else {
            $notif.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 255, 255, 255))
        }
    }
}
# density buckets for the notification icon (24dp base)
$buckets = @( @{ n='drawable-mdpi'; s=24 }, @{ n='drawable-hdpi'; s=36 }, @{ n='drawable-xhdpi'; s=48 }, @{ n='drawable-xxhdpi'; s=72 }, @{ n='drawable-xxxhdpi'; s=96 } )
foreach ($b in $buckets) {
    $size = $b.s
    $destDir = Join-Path $root "android\app\src\main\res\$($b.n)"
    New-Item -ItemType Directory -Force $destDir | Out-Null
    $dest = Join-Path $destDir "ic_stat_studyzone.png"
    $small = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($small)
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.DrawImage($notif, 0, 0, $size, $size)
    $g.Dispose()
    $small.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png)
    $small.Dispose()
    Write-Output "notification icon: $($b.n) ic_stat_studyzone.png ($size x $size)"
}
$notif.Dispose()

# --- 2b) Replace the base vector notification icon with a bitmap wrapper ------
# The density buckets above already carry white-silhouette PNGs. The base
# vector (old white bar chart) is replaced so no code path shows the old glyph.
$statBase = New-Object System.Drawing.Bitmap(24, 24, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($statBase)
$g.Clear([System.Drawing.Color]::Transparent)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$silhouette = [System.Drawing.Bitmap]::FromFile((Join-Path $root 'android\app\src\main\res\drawable-xxxhdpi\ic_stat_studyzone.png'))
$g.DrawImage($silhouette, 0, 0, 24, 24)
$g.Dispose()
$statPath = Join-Path $root "android\app\src\main\res\drawable\ic_stat_second_brain.png"
$statBase.Save($statPath, [System.Drawing.Imaging.ImageFormat]::Png)
$statBase.Dispose()
$silhouette.Dispose()
$statVector = Join-Path $root "android\app\src\main\res\drawable\ic_stat_studyzone.xml"
Set-Content -Path $statVector -Value "<?xml version=`"1.0`" encoding=`"utf-8`"?>`r`n<bitmap xmlns:android=`"http://schemas.android.com/apk/res/android`" android:src=`"@drawable/ic_stat_second_brain`" android:gravity=`"center`" />`r`n" -Encoding UTF8
Write-Output "notification base: ic_stat_second_brain.png + bitmap wrapper in ic_stat_studyzone.xml"


# --- 3) Adaptive-icon base bitmap (108dp fallback) ----------------------------
$fg = New-Object System.Drawing.Bitmap(108, 108, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($fg)
$g.Clear([System.Drawing.Color]::Transparent)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$pad = [int](108 * 0.18); $maxSide = 108 - 2 * $pad
$ratio = [math]::Min($maxSide / $src.Width, $maxSide / $src.Height)
$w = [int]([math]::Round($src.Width * $ratio)); $h = [int]([math]::Round($src.Height * $ratio))
$g.DrawImage($src, [int]((108 - $w) / 2), [int]((108 - $h) / 2), $w, $h)
$g.Dispose()
$fgPath = Join-Path $root "android\app\src\main\res\drawable\second_brain_foreground.png"
$fg.Save($fgPath, [System.Drawing.Imaging.ImageFormat]::Png)
$fg.Dispose()
Write-Output "adaptive base: second_brain_foreground.png (108 x 108)"

# --- 4) Replace the old bar-chart vector foregrounds with a bitmap wrapper ----
$bitmap = "<?xml version=`"1.0`" encoding=`"utf-8`"?>`r`n<bitmap xmlns:android=`"http://schemas.android.com/apk/res/android`" android:src=`"@drawable/second_brain_foreground`" android:gravity=`"center`" />`r`n"
$drawableDir = Join-Path $root "android\app\src\main\res\drawable"
$v24Dir = Join-Path $root "android\app\src\main\res\drawable-v24"
$replaced = 0; $removed = 0
foreach ($file in Get-ChildItem -Path $drawableDir, $v24Dir -Filter "ic_launcher_foreground*.xml") {
    Set-Content -Path $file.FullName -Value $bitmap -Encoding UTF8
    $replaced += 1
}
# Base drawable vector would clash with second_brain_foreground.png? No clash (different names).
# Remove the base vector that pointed at bars? It was overwritten above. Keep the same filename scheme.
Write-Output "replaced adaptive foreground vectors: $replaced"

$src.Dispose()
Write-Output "done"
