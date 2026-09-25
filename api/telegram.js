// api/telegram.js - kirim update ke grup: foto inlet+outlet segar (bila ada) + caption angka real-time; fallback teks
const { list, get } = require("@vercel/blob");
function fmt2(x){ return (Math.round(x * 100) / 100).toFixed(2); }
async function fotoCam(cam) {
  try {
    const f = await list({ prefix: "cctv/" + cam + "/" });
    if (!(f.blobs && f.blobs.length)) return null;
    const age = Date.now() - new Date(f.blobs[0].uploadedAt).getTime();
    if (age > 3600000) return null;
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
    if (!TOKEN || !CHAT_ID) { res.status(500).json({ error: "TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID belum di-env" }); return; }
    const time = String(q.time || "");
    const cuaca = String(q.cuaca || "-");
    const now = new Date();
    const day = now.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
    const key = "updates/" + day + ".json";
    let f = await list({ prefix: key });
    if (!(f.blobs && f.blobs.length)) {
      const pp = {}; new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date()).forEach(function(x){ pp[x.type] = x.value; });
      const auto = pp.hour + ":" + pp.minute;
      try { await fetch("https://ciawi-dashboard.vercel.app/api/update?publish=1&time=" + encodeURIComponent(auto), { cache: "no-store" }); } catch (e) {}
      f = await list({ prefix: key });
      if (!(f.blobs && f.blobs.length)) { res.status(404).json({ error: "snapshot otomatis gagal" }); return; }
    }
    const b = await get(key, { access: "private", token: process.env.BLOB_READ_WRITE_TOKEN });
    const store = JSON.parse(await new Response(b.stream).text());
    let sn = null;
    if (time && store[time]) sn = store[time];
    else { const ks = Object.keys(store).sort(); sn = store[ks[ks.length - 1]]; }
    if (!sn) { res.status(404).json({ error: "snapshot tidak ketemu" }); return; }
    const tIn = sn.tmaIn / 100, tOut = sn.tmaOut / 100;
    const elv = fmt2(504.20 + tIn);
    const outElv = fmt2(486.92 + tOut);
    const p = {}; new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", day: "2-digit", month: "2-digit", year: "numeric" }).formatToParts(new Date(sn.ts)).forEach(function(x){ p[x.type] = x.value; });
    const st = String(sn.stIn || "normal"); const Status = st.charAt(0).toUpperCase() + st.slice(1);
    const text = "<b>📊 Update Bendungan Ciawi</b>\n" + p.day + "/" + p.month + "/" + p.year + " pukul " + sn.time + " WIB\n\n<b>Status:</b> " + Status + "\n<b>Inlet:</b> +" + elv + " (tma " + fmt2(tIn) + " m)\n<b>Outlet:</b> +" + outElv + " (tma " + fmt2(tOut) + " m)\n\n<i>Cuaca: " + cuaca + "</i>";
    const fotoIn = await fotoCam("inlet");
    const fotoOut = await fotoCam("outlet");
    let jr = null;
    if (fotoIn) {
      const fd = new FormData();
      fd.append("chat_id", String(CHAT_ID));
      fd.append("caption", text);
      fd.append("parse_mode", "HTML");
      fd.append("photo", new Blob([fotoIn], { type: "image/jpeg" }), "inlet.jpg");
      const rp = await fetch("https://api.telegram.org/bot" + TOKEN + "/sendPhoto", { method: "POST", body: fd });
      jr = await rp.json();
    }
    if (!jr || !jr.ok) {
      const r2 = await fetch("https://api.telegram.org/bot" + TOKEN + "/sendMessage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: CHAT_ID, text: text, parse_mode: "HTML", disable_web_page_preview: true }) });
      jr = await r2.json();
    }
    if (!jr.ok) { res.status(502).json({ error: "telegram gagal", detail: jr }); return; }
    let jr2 = null;
    if (fotoOut) {
      const cap2 = "<b>📷 Outlet Ciawi (pintu)</b> — " + p.day + "/" + p.month + "/" + p.year + " " + sn.time + " WIB";
      const fd2 = new FormData();
      fd2.append("chat_id", String(CHAT_ID));
      fd2.append("caption", cap2);
      fd2.append("parse_mode", "HTML");
      fd2.append("photo", new Blob([fotoOut], { type: "image/jpeg" }), "outlet.jpg");
      const rp2 = await fetch("https://api.telegram.org/bot" + TOKEN + "/sendPhoto", { method: "POST", body: fd2 });
      jr2 = await rp2.json();
    }
    res.json({ ok: true, message_id: jr.result && jr.result.message_id, fotoInlet: !!fotoIn, fotoOutlet: !!(jr2 && jr2.ok), text: text });
  } catch (e) { res.status(500).json({ error: e.message }); }
};