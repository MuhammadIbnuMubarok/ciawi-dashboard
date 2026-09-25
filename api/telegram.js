// api/telegram.js - REAL-TIME: foto ber-keterangan berurutan (inlet Ciawi -> outlet Ciawi -> Sukamahi), tanpa baris kamera
const { list, get } = require("@vercel/blob");
module.exports.maxDuration = 60;
function fmt2(x){ return (Math.round(x * 100) / 100).toFixed(2); }
async function fotoCam(cam) {
  try {
    const gb = await get("cctv/" + cam + "/latest.jpg", { access: "private", token: process.env.BLOB_READ_WRITE_TOKEN });
    if (!gb || !gb.stream) return null;
    const bufs = []; const rd = gb.stream.getReader();
    for (;;) { const d = await rd.read(); if (d.done) break; bufs.push(Buffer.from(d.value)); }
    const b = Buffer.concat(bufs);
    return b.length > 5000 ? b : null;
  } catch (e) { return null; }
}
module.exports = async (req, res) => {
  try {
    const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const q = req.query || {};
    const CHAT_ID = q.chat || process.env.TELEGRAM_CHAT_ID;
    if (!TOKEN || !CHAT_ID) { res.status(500).json({ error: "token/chat belum di-env" }); return; }
    const cuaca = String(q.cuaca || "-");
    const wantT = /^\d{1,2}:\d{2}$/.test(String(q.time || "")) ? String(q.time) : "";
    const pp = {}; new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date()).forEach(function(x){ pp[x.type] = x.value; });
    const tnow = pp.hour + ":" + pp.minute;
    try { await fetch("https://ciawi-dashboard.vercel.app/api/update?publish=1&time=" + encodeURIComponent(wantT || tnow), { cache: "no-store" }); } catch (e) {}
    try { await fetch("https://ciawi-dashboard.vercel.app/api/snap?key=" + process.env.CCTV_UPLOAD_KEY, { cache: "no-store" }); } catch (e) {}
    const day = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
    const f = await list({ prefix: "updates/" + day + ".json" });
    if (!(f.blobs && f.blobs.length)) { res.status(404).json({ error: "telemetri gagal disegarkan" }); return; }
    const b = await get("updates/" + day + ".json", { access: "private", token: process.env.BLOB_READ_WRITE_TOKEN });
    const store = JSON.parse(await new Response(b.stream).text());
    const ks = Object.keys(store).filter(function (k) { return /^\d{1,2}:\d{2}$/.test(k); }).sort();
    const sn = store[wantT || ks[ks.length - 1]] || store[ks[ks.length - 1]];
    if (!sn) { res.status(404).json({ error: "snapshot tidak ketemu" }); return; }
    const tIn = sn.tmaIn / 100, tOut = sn.tmaOut / 100;
    const elv = fmt2(504.20 + tIn);
    const outElv = fmt2(486.92 + tOut);
    const p = {}; new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", day: "2-digit", month: "2-digit", year: "numeric" }).formatToParts(new Date(sn.ts)).forEach(function(x){ p[x.type] = x.value; });
    const st = String(sn.stIn || "normal"); const Status = st.charAt(0).toUpperCase() + st.slice(1);
    const tgl = p.day + "/" + p.month + "/" + p.year;
    const text = "<b>📊 Update Bendungan Ciawi</b>\n" + tgl + " pukul " + sn.time + " WIB\n\n<b>Status:</b> " + Status + "\n<b>Inlet:</b> +" + elv + " (tma " + fmt2(tIn) + " m)\n<b>Outlet:</b> +" + outElv + " (tma " + fmt2(tOut) + " m)\n\n<i>Cuaca: " + cuaca + "</i>";
    const CAMS = [
      ["inlet", "ciawi-inlet", text],
      ["outlet", "ciawi-outlet", "<b>Outlet Ciawi (pintu)</b> — " + tgl + " " + sn.time + " WIB"],
      ["skinlet", "sukamahi-inlet", "<b>Inlet Sukamahi</b> — " + tgl + " " + sn.time + " WIB"],
      ["skoutlet", "sukamahi-outlet", "<b>Outlet Sukamahi (pintu)</b> — " + tgl + " " + sn.time + " WIB"]
    ];
    let pertama = null;
    let jumlah = 0;
    for (const c of CAMS) {
      const buf = await fotoCam(c[0]);
      if (!buf) continue;
      const fd = new FormData();
      fd.append("chat_id", String(CHAT_ID));
      fd.append("caption", c[2]);
      fd.append("parse_mode", "HTML");
      fd.append("photo", new Blob([buf], { type: "image/jpeg" }), c[1] + ".jpg");
      const rp = await fetch("https://api.telegram.org/bot" + TOKEN + "/sendPhoto", { method: "POST", body: fd });
      const jr = await rp.json();
      if (jr.ok) { jumlah++; if (!pertama) pertama = jr; }
    }
    if (!pertama) {
      const r2 = await fetch("https://api.telegram.org/bot" + TOKEN + "/sendMessage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: CHAT_ID, text: text, parse_mode: "HTML", disable_web_page_preview: true }) });
      pertama = await r2.json();
    }
    if (!pertama || !pertama.ok) { res.status(502).json({ error: "telegram gagal", detail: pertama }); return; }
    res.json({ ok: true, foto: jumlah, message_id: pertama.result && pertama.result.message_id, waktu: sn.time });
  } catch (e) { res.status(500).json({ error: e.message }); }
};