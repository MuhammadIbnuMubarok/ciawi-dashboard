Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName Microsoft.VisualBasic
# 1) bangunkan jendela SmartPSS dulu
$p = Get-Process | Where-Object { $_.MainWindowTitle -like "*SmartPSS*" -or $_.MainWindowTitle -like "*Smart PSS*" -or $_.ProcessName -like "*SmartPSS*" } | Where-Object { $_.MainWindowTitle -ne "" } | Select-Object -First 1
if ($p) { try { [Microsoft.VisualBasic.Interaction]::AppActivate($p.Id); Start-Sleep -Milliseconds 900 } catch {} }
# 2) potret layar penuh
$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap $screen.Width, $screen.Height
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($screen.Location, [System.Drawing.Point]::Empty, $screen.Size)
# 3) crop area video (kalibrasi: ubah angka ini bila bingkai belum pas)
$top = 40; $bottom = 80; $left = 0; $right = 0
$rect = New-Object System.Drawing.Rectangle $left, $top, ($screen.Width - $left - $right), ($screen.Height - $top - $bottom)
$crop = $bmp.Clone($rect, $bmp.PixelFormat)
$out = "$PSScriptRoot\cctv-latest.jpg"
$crop.Save($out, [System.Drawing.Imaging.ImageFormat]::Jpeg)
$g.Dispose(); $bmp.Dispose(); $crop.Dispose()
# 4) unggah ke Blob
$key = "ciawi-cctv-0926"
$bytes = [System.IO.File]::ReadAllBytes($out)
$r = Invoke-WebRequest -Uri "https://ciawi-dashboard.vercel.app/api/cctv?key=$key" -Method Post -Body $bytes -ContentType "image/jpeg" -UseBasicParsing -TimeoutSec 90
"unggah OK: " + $r.Content
