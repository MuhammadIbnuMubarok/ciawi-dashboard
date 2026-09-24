// api/history.js - pustakawan riwayat: GET /api/history?from=YYYY-MM-DD&to=YYYY-MM-DD
const { list, get } = require("@vercel/blob");
module.exports = async (req, res) => {
  try {
    const from = String(req.query.from || "");
    const to = String(req.query.to || from);
    const d0 = new Date(from); const d1 = new Date(to);
    if (isNaN(d0.getTime()) || isNaN(d1.getTime())) { res.status(400).json({ error: "from/to wajib YYYY-MM-DD" }); return; }
    const out = [];
    for (let d = new Date(d0); d <= d1; d.setDate(d.getDate() + 1)) {
      const day = d.toLocaleDateString("en-CA", { timeZone: "UTC" });
      const key = "history/" + day + ".jsonl";
      const f = await list({ prefix: key });
      if (f.blobs && f.blobs.length) {
        const b = await get(key, { access: "private", token: process.env.BLOB_READ_WRITE_TOKEN });
        let txt = ""; if (b && b.stream) { txt = await new Response(b.stream).text(); } if (b && !txt) { res.status(500).json({ error: "stream blob tidak ada", bentuk: b ? Object.keys(b) : null }); return; }
        txt.split("\n").forEach(l => { if (l.trim()) out.push(JSON.parse(l)); });
      }
    }
    res.setHeader("Cache-Control", "no-store");
    res.json({ count: out.length, rows: out });
  } catch (e) { res.status(500).json({ error: e.message }); }
};







