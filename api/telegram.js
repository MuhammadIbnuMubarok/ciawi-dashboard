// api/telegram.js - kirim snapshot terformat ke grup Telegram
const { list, get } = require("@vercel/blob");
function fmt2(x){ return (Math.round(x * 100) / 100).toFixed(2); }
module.exports = async (req, res) => {
  try {
    const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const q0 = req.query || {}; const CHAT_ID = q0.chat || process.env.TELEGRAM_CHAT_ID;
    if (!TOKEN || !CHAT_ID) { res.status(500).json({ error: "TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID belum di-env" }); return; }
    const q = req.query || {};
    const time = String(q.time || "");
    const cuaca = String(q.cuaca || "-");
    const now = new Date();
    const day = now.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
    const key = "updates/" + day + ".json";
    let f = await list({ prefix: key });
    if (!(f.blobs && f.blobs.length)) { const pp = {}; new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date()).forEach(function(x){ pp[x.type] = x.value; }); const auto = pp.hour + ":" + pp.minute; try { await fetch("https://ciawi-dashboard.vercel.app/api/update?publish=1&time=" + encodeURIComponent(auto), { cache: "no-store" }); } catch (e) {} f = await list({ prefix: key }); if (!(f.blobs && f.blobs.length)) { res.status(404).json({ error: "snapshot otomatis gagal" }); return; } }
    const b = await get(key, { access: "private", token: process.env.BLOB_READ_WRITE_TOKEN });
    const store = JSON.parse(await new Response(b.stream).text());
    let sn = null;
    if (time && store[time]) sn = store[time];
    else { const keys = Object.keys(store).sort(); sn = store[keys[keys.length - 1]]; }
    if (!sn) { res.status(404).json({ error: "snapshot tidak ketemu" }); return; }
    const tIn = sn.tmaIn / 100, tOut = sn.tmaOut / 100;
    const elv = fmt2(504.20 + tIn);
    const outElv = fmt2(486.92 + tOut);
    const p = {}; new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", day: "2-digit", month: "2-digit", year: "numeric" }).formatToParts(new Date(sn.ts)).forEach(function(x){ p[x.type] = x.value; });
    const st = String(sn.stIn || "normal"); const Status = st.charAt(0).toUpperCase() + st.slice(1);
    const text = "<b>📊 Update Bendungan Ciawi</b>\n" +
                 p.day + "/" + p.month + "/" + p.year + " pukul " + sn.time + " WIB\n\n" +
                 "<b>Status:</b> " + Status + "\n" +
                 "<b>Inlet:</b> +" + elv + " (tma " + fmt2(tIn) + " m)\n" +
                 "<b>Outlet:</b> +" + outElv + " (tma " + fmt2(tOut) + " m)\n\n" +
                 "<i>Cuaca: " + cuaca + "</i>";
    const tgUrl = "https://api.telegram.org/bot" + TOKEN + "/sendMessage";
    const r = await fetch(tgUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: CHAT_ID, text: text, parse_mode: "HTML", disable_web_page_preview: true })
    });
    const jr = await r.json();
    if (!jr.ok) { res.status(502).json({ error: "telegram gagal", detail: jr }); return; }
    res.json({ ok: true, message_id: jr.result && jr.result.message_id, text: text });
  } catch (e) { res.status(500).json({ error: e.message }); }
};


