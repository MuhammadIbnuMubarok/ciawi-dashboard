# install_ai.ps1 - pasang API key AI ke Cloudflare Pages
#
# CARA PAKAI:
#   1. Isi GROQ_API_KEY di ai-config.txt (key dari console.groq.com/keys)
#   2. Jalankan:
#        cd D:\ciawi-dashboard
#        powershell -ExecutionPolicy Bypass -File .\install_ai.ps1
#
# Key tidak pernah dicetak ke layar atau dikirim ke chat.

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$cfg = Join-Path $PSScriptRoot "ai-config.txt"
if (-not (Test-Path $cfg)) { Write-Host "ai-config.txt tidak ditemukan" -ForegroundColor Red; exit 1 }

$provider = ""
$key = ""
foreach ($line in Get-Content $cfg) {
  if ($line -match '^\s*#' -or -not $line.Trim()) { continue }
  $k, $v = $line -split '=', 2
  $k = $k.Trim(); $v = $v.Trim()
  if ($k -eq "AI_PROVIDER")   { $provider = $v }
  if ($k -eq "GROQ_API_KEY")  { $key = $v }
}

if (-not $provider) { Write-Host "AI_PROVIDER kosong" -ForegroundColor Red; exit 1 }
if (-not $key) {
  Write-Host "GROQ_API_KEY masih kosong di ai-config.txt" -ForegroundColor Red
  Write-Host "Ambil key gratis di https://console.groq.com/keys" -ForegroundColor Yellow
  exit 1
}

# Validasi key ke Groq sebelum memasang.
Write-Host "`n=== Validasi key ke Groq ===" -ForegroundColor Cyan
try {
  $r = Invoke-RestMethod -Uri "https://api.groq.com/openai/v1/models" `
       -Headers @{ Authorization = "Bearer $key" } -TimeoutSec 25
  $n = ($r.data | Measure-Object).Count
  Write-Host "Key valid. $n model tersedia." -ForegroundColor Green
} catch {
  Write-Host "Key TIDAK VALID: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}

# Pasang ke Cloudflare Pages.
$wrangler = Join-Path $PSScriptRoot "node_modules\.bin\wrangler.cmd"
if (-not (Test-Path $wrangler)) { Write-Host "wrangler tidak ditemukan" -ForegroundColor Red; exit 1 }

Write-Host "`n=== Memasang secret ke Cloudflare Pages ===" -ForegroundColor Cyan
$json = '{"AI_PROVIDER":"' + $provider + '","GROQ_API_KEY":"' + $key + '"}'
$tmp = Join-Path $env:TEMP "ai-secrets.json"
Set-Content -Path $tmp -Value $json -Encoding UTF8
Get-Content $tmp -Raw | & $wrangler pages secret bulk --project-name=ciawi-scada
Remove-Item $tmp -Force

Write-Host "`n=== Deploy ulang ===" -ForegroundColor Cyan
& $wrangler pages deploy . --project-name=ciawi-scada --commit-dirty=true 2>&1 | Select-Object -Last 3

Write-Host "`nSelesai. Buka https://ciawi-scada.pages.dev lalu tanya chatbot AI Analis." -ForegroundColor Green
Write-Host "Kalau masih MODE CADANGAN, tunggu ~30 detik lalu refresh." -ForegroundColor Cyan