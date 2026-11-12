# Generates Study Zone launcher icons, splash screens and the notification beep.
# Run from the repository root: powershell -ExecutionPolicy Bypass -File scripts/generate-android-assets.ps1
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$res = Join-Path $root "android/app/src/main/res"
$iconPath = Join-Path $root "icons/icon-512.png"
$icon = [System.Drawing.Image]::FromFile($iconPath)

function Save-Resized([System.Drawing.Image]$source, [int]$width, [int]$height, [string]$target, [bool]$pad) {
  $bitmap = New-Object System.Drawing.Bitmap($width, $height)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  if ($pad) {
    $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml("#071C18"))
    $size = [int]([Math]::Min($width, $height) * 0.36)
    $x = [int](($width - $size) / 2)
    $y = [int](($height - $size) / 2)
    $graphics.DrawImage($source, $x, $y, $size, $size)
  } else {
    $graphics.DrawImage($source, 0, 0, $width, $height)
  }
  $graphics.Dispose()
  $bitmap.Save($target, [System.Drawing.Imaging.ImageFormat]::Png)
  $bitmap.Dispose()
}

$densities = @{
  "mdpi" = 48
  "hdpi" = 72
  "xhdpi" = 96
  "xxhdpi" = 144
  "xxxhdpi" = 192
}
foreach ($name in $densities.Keys) {
  $size = $densities[$name]
  $dir = Join-Path $res "mipmap-$name"
  Save-Resized $icon $size $size (Join-Path $dir "ic_launcher.png") $false
  Save-Resized $icon $size $size (Join-Path $dir "ic_launcher_round.png") $false
  Save-Resized $icon ([int]($size * 1.5)) ([int]($size * 1.5)) (Join-Path $dir "ic_launcher_foreground.png") $false
}

$splashes = @(
  @("drawable", 480, 320),
  @("drawable-land-mdpi", 480, 320),
  @("drawable-land-hdpi", 800, 480),
  @("drawable-land-xhdpi", 1280, 720),
  @("drawable-land-xxhdpi", 1600, 960),
  @("drawable-land-xxxhdpi", 1920, 1280),
  @("drawable-port-mdpi", 320, 480),
  @("drawable-port-hdpi", 480, 800),
  @("drawable-port-xhdpi", 720, 1280),
  @("drawable-port-xxhdpi", 960, 1600),
  @("drawable-port-xxxhdpi", 1280, 1920)
)
foreach ($entry in $splashes) {
  $dir = Join-Path $res $entry[0]
  Save-Resized $icon $entry[1] $entry[2] (Join-Path $dir "splash.png") $true
}

$icon.Dispose()

# 0.28s 880 Hz notification beep (16-bit mono PCM WAV).
$raw = Join-Path $res "raw"
New-Item -ItemType Directory -Force -Path $raw | Out-Null
$sampleRate = 44100
$seconds = 0.28
$samples = [int]($sampleRate * $seconds)
$data = New-Object byte[] ($samples * 2)
for ($i = 0; $i -lt $samples; $i++) {
  $t = $i / $sampleRate
  $envelope = [Math]::Min(1.0, [Math]::Min($i / ($sampleRate * 0.02), ($samples - $i) / ($sampleRate * 0.05)))
  $value = [int16]([Math]::Sin(2 * [Math]::PI * 880 * $t) * 12000 * $envelope)
  $bytes = [System.BitConverter]::GetBytes($value)
  $data[$i * 2] = $bytes[0]
  $data[$i * 2 + 1] = $bytes[1]
}
$stream = New-Object System.IO.MemoryStream
$writer = New-Object System.IO.BinaryWriter($stream)
$writer.Write([System.Text.Encoding]::ASCII.GetBytes("RIFF"))
$writer.Write([int32](36 + $data.Length))
$writer.Write([System.Text.Encoding]::ASCII.GetBytes("WAVEfmt "))
$writer.Write([int32]16)
$writer.Write([int16]1)
$writer.Write([int16]1)
$writer.Write([int32]$sampleRate)
$writer.Write([int32]($sampleRate * 2))
$writer.Write([int16]2)
$writer.Write([int16]16)
$writer.Write([System.Text.Encoding]::ASCII.GetBytes("data"))
$writer.Write([int32]$data.Length)
$writer.Write($data)
[System.IO.File]::WriteAllBytes((Join-Path $raw "beep.wav"), $stream.ToArray())
$writer.Dispose()
$stream.Dispose()

Write-Host "Study Zone Android icons, splash screens and beep.wav generated."
