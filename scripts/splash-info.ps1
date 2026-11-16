$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$root = "C:\Programming.vsCode\WebPages\StudyZone"
Get-ChildItem -Path (Join-Path $root 'android\app\src\main\res') -Recurse -Filter splash.png | ForEach-Object {
  $img = [System.Drawing.Image]::FromFile($_.FullName)
  Write-Output ("{0}  {1}x{2}" -f $_.FullName.Replace($root + '\',''), $img.Width, $img.Height)
  $img.Dispose()
}
