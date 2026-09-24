// api/webhook.js v2 — bot dua arah + tombol perintah (aditif, fungsi lama dipertahankan)
const TG = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN}`;
const PATOKAN = { IV: 0.64, III: 1.86, II: 2.55, I: 3.48 };

async function tg(method, body) {
  const r = await fetch(`${TG}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return r.json();
}
async function send(chatId, text, extra) {
  return tg('sendMessage', Object.assign({ chat_id: chatId, text, parse_mode: 'HTML' }, extra || {}));
}
const KB_UTAMA = { reply_markup: { keyboard: [
  [{ text: '📊 Update TMA' }, { text: '🚨 Status Siaga' }],
  [{ text: '📷 CCTV' }, { text: '❔ Bantuan' }]
], resize_keyboard: true, is_persistent: true } };
const IK_AKSI = { reply_markup: { inline_keyboard: [
  [{ text: '🔄 Update Lagi', callback_data: 'tma' }, { text: '🚨 Status Siaga', callback_data: 'siaga' }],
  [{ text: '📷 CCTV', callback_data: 'cctv' }, { text: '❔ Bantuan', callback_data: 'bantuan' }]
] } };

function cari(obj, keys, depth) {
  if ((depth || 0) > 4 || !obj || typeof obj !== 'object') return undefined;
  var ks = Object.keys(obj);
  for (var i = 0; i < ks.length; i++) {
    var kl = ks[i].toLowerCase();
    for (var j = 0; j < keys.length; j++) if (kl.indexOf(keys[j]) >= 0) return obj[ks[i]];
    var v = cari(obj[ks[i]], keys, (depth || 0) + 1);
    if (v !== undefined) return v;
  }
  return undefined;
}
function tmaOutlet(d) {
  if (!d || typeof d !== 'object') return NaN;
  var ks = Object.keys(d);
  for (var i = 0; i < ks.length; i++) {
    var kl = ks[i].toLowerCase();
    if (kl.indexOf('tma') >= 0 && kl.indexOf('out') >= 0) return Number(d[ks[i]]);
  }
  var v = cari(d, ['tma_out', 'tmaout'], 0);
  if (v !== undefined) return Number(v);
  var o = cari(d, ['outlet'], 0);
  if (o && typeof o === 'object') { var t = cari(o, ['tma'], 0); if (t !== undefined) return Number(t); }
  var f = cari(d, ['f_now', 'fsekarang', 'f_skrg'], 0);
  return f === undefined ? NaN : Number(f);
}
function levelDariTMA(f) {
  if (f == null || isNaN(f)) return null;
  if (f >= PATOKAN.I) return 'I';
  if (f >= PATOKAN.II) return 'II';
  if (f >= PATOKAN.III) return 'III';
  if (f >= PATOKAN.IV) return 'IV';
  return null;
}
async function dataLive(live) {
  try { const r = await fetch(live, { cache: 'no-store' }); if (!r.ok) return null; return await r.json(); }
  catch (e) { return null; }
}

async function aksiTMA(chatId, BASE) {
  const waktu = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' });
  const url = `${BASE}/api/telegram?chat=${chatId}&time=${encodeURIComponent('req bot ' + waktu)}&cuaca=-`;
  const r = await fetch(url);
  const j = await r.json().catch(() => ({}));
  if (j && j.ok) await send(chatId, '✅ Update TMA terkirim di atas.', IK_AKSI);
  else await send(chatId, '⚠️ Gagal kirim update: ' + JSON.stringify(j).slice(0, 200));
}
async function aksiSiaga(chatId, BASE) {
  const d = await dataLive(process.env.LIVE_URL || (BASE + '/api/live'));
  if (!d) { await send(chatId, '⚠️ Data live tidak terbaca server. Pakai 📊 Update TMA untuk laporan lengkap.', IK_AKSI); return; }
  const f = tmaOutlet(d);
  const st = cari(d, ['status', 'level']);
  const lvl = levelDariTMA(f);
  await send(chatId,
    '🚦 <b>Status Siaga Bendungan Ciawi</b>\n' +
    'TMA outlet: ' + (isNaN(f) ? '-' : f) + ' m\n' +
    'Level: <b>' + (lvl ? 'SIAGA ' + lvl : 'NORMAL') + '</b>\n' +
    'Status sistem: ' + (st || '-') + '\n' +
    'Patokan: IV≥0,64 | III≥1,86 | II≥2,55 | I≥3,48 m', IK_AKSI);
}
async function aksiCCTV(chatId) {
  await send(chatId, '📷 Snapshot CCTV masih dalam pengerjaan (jalur NVR 192.168.2.81 belum reachable dari jaringan dashboard). Akan aktif begitu jalur kamera selesai.', IK_AKSI);
}
async function aksiBantuan(chatId) {
  await send(chatId,
    '<b>Perintah tersedia</b>\n' +
    '📊 Update TMA — laporan lengkap ke chat ini\n' +
    '🚨 Status Siaga — level siaga dari TMA outlet\n' +
    '📷 CCTV — status kamera\n' +
    '❔ Bantuan — pesan ini\n\n' +
    'Ketik bebas juga bisa: "update tma", "status siaga", "cctv".', KB_UTAMA);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ ok: false }); return; }
  const secret = req.headers['x-telegram-bot-api-secret-token'];
  if (process.env.WEBHOOK_SECRET && secret !== process.env.WEBHOOK_SECRET) { res.status(403).json({ ok: false }); return; }
  const up = req.body || {};
  const BASE = `https://${req.headers.host}`;
  try {
    if (up.callback_query) {
      const cq = up.callback_query;
      const chatId = cq.message && cq.message.chat ? cq.message.chat.id : null;
      await tg('answerCallbackQuery', { callback_query_id: cq.id });
      if (chatId) {
        if (cq.data === 'tma') await aksiTMA(chatId, BASE);
        else if (cq.data === 'siaga') await aksiSiaga(chatId, BASE);
        else if (cq.data === 'cctv') await aksiCCTV(chatId);
        else if (cq.data === 'bantuan') await aksiBantuan(chatId);
      }
      res.status(200).json({ ok: true }); return;
    }
    const msg = up.message || up.channel_post; // pesan diedit TIDAK memicu balasan ganda
    if (!msg || !msg.text) { res.status(200).json({ ok: true }); return; }
    const chatId = msg.chat.id;
    const raw = msg.text.trim();
    const low = raw.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').trim();
    const cmd = raw.startsWith('/') ? raw.split(/\s+/)[0].split('@')[0].toLowerCase() : null;
    const isPrivate = msg.chat.type === 'private';
    if (!isPrivate && !cmd) { res.status(200).json({ ok: true }); return; }

    const mauTMA = ['/tma', '/laporan', '/cekbendungan'].indexOf(cmd) >= 0 ||
                   ((/update|kirim/.test(low)) && (/tma|laporan/.test(low))) || low === 'update';
    const mauSiaga = cmd === '/siaga' || /siaga/.test(low);
    const mauCCTV = cmd === '/cctv' || /cctv|kamera/.test(low);
    const mauBantuan = ['/bantuan', '/help'].indexOf(cmd) >= 0 || /bantuan|help/.test(low);

    if (cmd === '/start') await send(chatId, '<b>Bot Bendungan Ciawi</b> siap.\nTap tombol di bawah atau ketik perintah bebas.', KB_UTAMA);
    else if (mauTMA) await aksiTMA(chatId, BASE);
    else if (mauSiaga) await aksiSiaga(chatId, BASE);
    else if (mauCCTV) await aksiCCTV(chatId);
    else if (mauBantuan) await aksiBantuan(chatId);
    else if (isPrivate) await send(chatId, 'Perintah tidak dikenal. Tap ❔ Bantuan atau ketik /help.', KB_UTAMA);
  } catch (e) {
    try {
      const m = up.message || (up.callback_query && up.callback_query.message);
      if (m && m.chat) await send(m.chat.id, '⚠️ Error: ' + String(e.message || e).slice(0, 200));
    } catch (_) {}
  }
  res.status(200).json({ ok: true });
}