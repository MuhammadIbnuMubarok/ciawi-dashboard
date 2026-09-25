[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$base = "https://sinbad.sda.pu.go.id"
$key = "ciawi-cctv-0926"
$sv = New-Object Microsoft.PowerShell.Commands.WebRequestSession
Invoke-WebRequest "$base/login.php" -WebSession $sv -UseBasicParsing -TimeoutSec 20 | Out-Null
$md5 = [System.Security.Cryptography.MD5]::Create()
$hash = -join ($md5.ComputeHash([Text.Encoding]::UTF8.GetBytes("upbbisa")) | ForEach-Object { $_.ToString("x2") })
$body = @{ uname = "upb_ciliwungcisadane"; upass = $hash; sessionid = ""; lat = "0"; lon = "0" }
Invoke-WebRequest "$base/dologin2.php" -Method Post -Body $body -WebSession $sv -UseBasicParsing -TimeoutSec 25 | Out-Null
$cams = @{ inlet = "CiawiInlet"; outlet = "CiawiPOutlet" }
foreach ($c in $cams.Keys) {
  $jpg = "$PSScriptRoot\cam-$c.jpg"
  try {
    Invoke-WebRequest ("$base/cctv-stream/api/frame.jpeg?src=" + $cams[$c]) -WebSession $sv -UseBasicParsing -TimeoutSec 30 -OutFile $jpg
    $bytes = [System.IO.File]::ReadAllBytes($jpg)
    $r = Invoke-WebRequest -Uri "https://ciawi-dashboard.vercel.app/api/cctv?key=$key&cam=$c" -Method Post -Body $bytes -ContentType "image/jpeg" -UseBasicParsing -TimeoutSec 90
    "$c unggah OK: " + $r.Content
  } catch { "$c GAGAL: " + $_.Exception.Message }
}
