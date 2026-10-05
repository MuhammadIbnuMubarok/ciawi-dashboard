# install_bot.ps1 - pasang bot Telegram ke Cloudflare Pages (Windows)
#
# CARA PAKAI:
#   1. Buka file bot-config.txt, isi BOT_TOKEN (dari @BotFather).
#   2. Di PowerShell jalankan:
#        cd D:\ciawi-dashboard
#        powershell -ExecutionPolicy Bypass -File .\install_bot.ps1
#
# Token TIDAK pernah dicetak ke layar atau dikirim ke mana pun.

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$cfgPath = Join-Path $PSScriptRoot "bot-config.txt"
if (-not (Test-Path $cfgPath)) { Write-Host "bot-config.txt tidak ditemukan" -ForegroundColor Red; exit 1 }

$token = ""
$chat  = ""
foreach ($line in Get-Content $cfgPath) {
  if ($line -match '^\s*#' -or -not $line.Trim()) { continue }
  $k, $v = $line -split '=', 2
  $k = $k.Trim(); $v = $v.Trim()
  if ($k -eq "BOT_TOKEN") { $token = $v }
  if ($k -eq "CHAT_ID")   { $chat  = $v }
}

if (-not $token) {
  Write-Host "BOT_TOKEN masih kosong di bot-config.txt" -ForegroundColor Red
  Write-Host "Isi dulu: salin token dari @BotFather (/newbot)" -ForegroundColor Yellow
  exit 1
}
if (-not $chat) {
  Write-Host "CHAT_ID kosong di bot-config.txt" -ForegroundColor Red
  exit 1
}

# --- validasi token ke Telegram ---
Write-Host "`n=== Validasi token ===" -ForegroundColor Cyan
try {
  $me = Invoke-RestMethod -Uri "https://api.telegram.org/bot$token/getMe" -TimeoutSec 25
} catch {
  Write-Host "Gagal menghubungi Telegram: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
if (-not $me.ok) { Write-Host "TOKEN TIDAK VALID" -ForegroundColor Red; exit 1 }
Write-Host "Token valid -> @$($me.result.username)" -ForegroundColor Green

$wrangler = Join-Path $PSScriptRoot "node_modules\.bin\wrangler.cmd"
if (-not (Test-Path $wrangler)) { Write-Host "wrangler tidak ditemukan di node_modules" -ForegroundColor Red; exit 1 }

# --- pasang secret ---
Write-Host "`n=== Memasang secret ke Cloudflare Pages ===" -ForegroundColor Cyan
$json = '"{0}":"{1}","TELEGRAM_CHAT_ID":"{2}"' -f "TELEGRAM_BOT_TOKEN", $token, $chat
$json = '{"TELEGRAM_BOT_TOKEN":"' + $token + '","TELEGRAM_CHAT_ID":"' + $chat + '"}'
$tmp = Join-Path $env:TEMP "tg-secrets.json"
Set-Content -Path $tmp -Value $json -Encoding UTF8
Get-Content $tmp -Raw | & $wrangler pages secret bulk --project-name=ciawi-scada
Remove-Item $tmp -Force

# --- webhook ---
Write-Host "`n=== Mengarahkan webhook ===" -ForegroundColor Cyan
$hook = "https://api.telegram.org/bot$token/setWebhook?url=https%3A%2F%2Fciawi-scada.pages.dev%2Fapi%2Fwebhook&allowed_updates=%5B%22message%22%2C%22callback_query%22%5D"
try {
  $r = Invoke-RestMethod -Method Post -Uri $hook -TimeoutSec 30
  Write-Host "setWebhook ok: $($r.ok)" -ForegroundColor Green
} catch {
  Write-Host "setWebhook gagal: $($_.Exception.Message)" -ForegroundColor Red
}

# --- deploy ulang supaya secret aktif ---
Write-Host "`n=== Deploy ulang ===" -ForegroundColor Cyan
& $wrangler pages deploy . --project-name=ciawi-scada --commit-dirty=true 2>&1 | Select-Object -Last 4

Write-Host "`nSelesai. Sekarang kirim /start ke @$($me.result.username) di Telegram." -ForegroundColor Green
Write-Host "Lalu cek: https://ciawi-scada.pages.dev/api/telegram" -ForegroundColor Cyan