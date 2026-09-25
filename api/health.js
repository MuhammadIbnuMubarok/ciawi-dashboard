// api/health.js — pusat alert kesehatan sistem (aditif, non-breaking)
const TG = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN}`;

export default async function handler(req, res) {
  const q = req.query || {};
  const event = String(q.event || 'check');
  const source = String(q.source || 'api');
  const waktu = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'short', timeStyle: 'medium' });

  if (event === 'offline' || event === 'online') {
    const teks = event === 'offline'
      ? '🛑 <b>TELEMETRI OFFLINE</b>\nSumber live tidak merespons ≥3 poll berturut-turut.\nWaktu: ' + waktu + ' WIB\nPelapor: ' + source + '\nTindakan: periksa sumber SCADA / rute /api/fleet.'
      : '✅ <b>TELEMETRI ONLINE KEMBALI</b>\nAliran data live pulih dan mengalir normal.\nWaktu: ' + waktu + ' WIB\nPelapor: ' + source;
    try {
      await fetch(`${TG}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text: teks, parse_mode: 'HTML' })
      });
    } catch (e) { /* jaringan TG gagal: alert berikutnya tetap terjadwal oleh throttle */ }
    res.status(200).json({ ok: true, sent: event });
    return;
  }

  // event=check: status JSON untuk pinger/cron/status-page (tanpa kirim pesan)
  let telemetry = 'offline'; let code = 0; const t0 = Date.now();
  try {
    const r = await fetch(`https://${req.headers.host}/api/fleet`, { cache: 'no-store' });
    code = r.status;
    if (r.ok) telemetry = 'online';
  } catch (e) { code = -1; }
  res.status(200).json({ ok: true, telemetry, fleetHttp: code, latencyMs: Date.now() - t0, waktu });
}