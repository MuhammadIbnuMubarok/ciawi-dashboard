# tools/upload-cctv.ps1 - ambil snapshot CCTV lalu unggah ke Cloudflare KV
#
# Foto disimpan di KV pada kunci cctv/<cam>/latest.jpg, lalu dibaca oleh
# _handlers/telegram.js saat perintah /update dikirim. Empat kamera:
#   inlet / outlet     -> Bendungan Ciawi
#   skinlet / skoutlet -> Bendungan Sukamahi
#
# Kredensial kamera dibaca dari tools/cctv-credentials.txt (di-ignore git)
# supaya tidak ada di dalam skrip ini.
# Format satu baris per kamera:  <cam>|<ip>|<user>|<pass>|<channel>
#
# Jalankan:  powershell -ExecutionPolicy Bypass -File .\tools\upload-cctv.ps1

$ErrorActionPreference = "Continue"
$credFile = Join-Path $PSScriptRoot "cctv-credentials.txt"
if (-not (Test-Path $credFile)) {
  Write-Host "cctv-credentials.txt belum ada. Isi dulu, satu baris per kamera:" -ForegroundColor Red
  Write-Host "  inlet|192.168.2.20|ADMIN|<password>|0" -ForegroundColor Yellow
  Write-Host "  skinlet|<ip>|<user>|<password>|<channel>" -ForegroundColor Yellow
  exit 1
}

# Kunci unggah = nilai CCTV_UPLOAD_KEY di Cloudflare Pages.
$key = $env:CCTV_UPLOAD_KEY
if (-not $key) { $key = "ciawi2026" }
$hostUrl = "https://ciawi-scada.pages.dev"

$sukses = 0
$gagal  = 0

foreach ($line in Get-Content $credFile) {
  if ($line -match '^\s*#' -or -not $line.Trim()) { continue }
  $p = $line.Split('|')
  if ($p.Count -lt 4) { continue }
  $cam = $p[0].Trim()
  $ip  = $p[1].Trim()
  $usr = $p[2].Trim()
  $pws = $p[3].Trim()
  $ch  = if ($p.Count -ge 5 -and $p[4].Trim()) { $p[4].Trim() } else { "0" }

  try {
    $pair = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("$usr`:$pws"))
    $url = "http://$ip/cgi-bin/snapshot.cgi?channel=$ch"
    $tmp = Join-Path $env:TEMP ("cctv-" + $cam + ".jpg")
    Invoke-WebRequest -Uri $url -Headers @{ Authorization = "Basic $pair" } `
      -TimeoutSec 12 -OutFile $tmp -UseBasicParsing
    $bytes = [System.IO.File]::ReadAllBytes($tmp)
    $r = Invoke-WebRequest -Uri "$hostUrl/api/cctv?key=$key&cam=$cam" `
      -Method Post -Body $bytes -ContentType "image/jpeg" -UseBasicParsing -TimeoutSec 60
    Write-Host "  $cam  OK ($($bytes.Length) byte)" -ForegroundColor Green
    $sukses++
  } catch {
    Write-Host "  $cam  GAGAL: $($_.Exception.Message)" -ForegroundColor Yellow
    $gagal++
  }
}

Write-Host "Selesai: $sukses berhasil, $gagal gagal." -ForegroundColor Cyan