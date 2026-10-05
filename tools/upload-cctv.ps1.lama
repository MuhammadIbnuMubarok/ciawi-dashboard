$ip = "192.168.2.20"
$user = "ADMIN"
$pass = "admin12345"
$key = "ciawi-cctv-0926"
$pair = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("$user`:$pass"))
try {
  Invoke-WebRequest -Uri "http://$ip/cgi-bin/snapshot.cgi?channel=0" -Headers @{ Authorization = "Basic $pair" } -TimeoutSec 10 -OutFile "$PSScriptRoot\cctv-latest.jpg" -UseBasicParsing
  $bytes = [System.IO.File]::ReadAllBytes("$PSScriptRoot\cctv-latest.jpg")
  $r = Invoke-WebRequest -Uri "https://ciawi-dashboard.vercel.app/api/cctv?key=$key" -Method Post -Body $bytes -ContentType "image/jpeg" -UseBasicParsing -TimeoutSec 90
  "unggah OK: " + $r.Content
} catch { "unggah GAGAL: " + $_.Exception.Message }
