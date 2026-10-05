#!/usr/bin/env bash
# Pasang token bot Telegram milik sendiri ke Cloudflare Pages.
#
# Jalankan dengan:
#   read -r -p "Token: " T && read -r -p "Chat ID: " C && ./install_bot.sh "$T" "$C"
#
# Token DATANG dari @BotFather (/newbot). Chat ID bisa didapat dari @userinfobot.
set -euo pipefail
cd /d/ciawi-dashboard
W=./node_modules/.bin/wrangler

if [ $# -lt 2 ]; then
  echo "Pakai: $0 <TOKEN> <CHAT_ID>"
  exit 1
fi
TOKEN="$1"
CHAT="$2"

# Validasi token dulu supaya tidak salah pasang.
echo "=== cek token ke Telegram ==="
if ! curl -s --max-time 25 "https://api.telegram.org/bot${TOKEN}/getMe" \
  | grep -q '"ok":true'; then
  echo "TOKEN TIDAK VALID. Cek lagi di @BotFather."
  exit 1
fi
NAME=$(curl -s --max-time 25 "https://api.telegram.org/bot${TOKEN}/getMe" \
  | sed -n 's/.*"username":"\([^"]*\)".*/\1/p')
echo "token valid -> @$NAME"

echo
echo "=== pasang ke Cloudflare Pages ==="
printf '{"TELEGRAM_BOT_TOKEN":"%s","TELEGRAM_CHAT_ID":"%s"}\n' "$TOKEN" "$CHAT" \
  | $W pages secret bulk --project-name=ciawi-scada

echo
echo "=== arahkan webhook ==="
curl -s --max-time 30 -X POST \
  "https://api.telegram.org/bot${TOKEN}/setWebhook?url=https%3A%2F%2Fciawi-scada.pages.dev%2Fapi%2Fwebhook&allowed_updates=%5B%22message%22%2C%22callback_query%22%5D" \
  | sed -n 's/.*"ok":\(true\|false\).*/setWebhook ok: \1/p'

echo
echo "=== deploy ulang ==="
$W pages deploy . --project-name=ciawi-scada --commit-dirty=true 2>&1 | tail -3

echo
echo "Selesai. Uji: kirim /start ke @$NAME, lalu buka:"
echo "  https://ciawi-scada.pages.dev/api/telegram?cuaca=-"