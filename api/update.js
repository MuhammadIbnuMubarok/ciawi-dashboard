// api/update.js - snapshot update terjadwal: publish=1&time=HH:MM menyimpan snapshot mentah; GET membaca snapshot hari ini
const { put, get, list } = require("@vercel/blob");
async function fetchFleet(){ const r = await fetch(process.env.FLEET_URL, { cache: "no-store" }); if (!r.ok) throw new Error("fleet HTTP " + r.status); return r.json(); }
module.exports = async (req, res) => {
  try {
    const q = req.query || {};
    const now = new Date();
    const day = now.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
    const key = "updates/" + day + ".json";
    const readStore = async () => {
      const f = await list({ prefix: key });
      if (!(f.blobs && f.blobs.length)) return {};
      const b = await get(key, { access: "private", token: process.env.BLOB_READ_WRITE_TOKEN });
      if (b && b.stream) { return JSON.parse(await new Response(b.stream).text()); }
      return {};
    };
    if (q.publish === "1") {
      const j = await fetchFleet();
      const arr = (j && j.telemetryjakarta) || [];
      let inlet = null, outlet = null;
      for (const s of arr) {
        const loc = String(s.nama_lokasi || "").toLowerCase();
        if (loc === "inletciawi") inlet = s;
        else if (loc === "outliteciawi") outlet = s;
      }
      if (!inlet || !outlet) { res.status(502).json({ error: "fleet tanpa stasiun ciawi" }); return; }
      const time = String(q.time || "").slice(0, 5);
      const store = await readStore();
      store[time] = { time: time, ts: new Date().toISOString(), tmaIn: Number(inlet.WLevel), tmaOut: Number(outlet.WLevel), qIn: Number(inlet.debit), qOut: Number(outlet.debit), stIn: inlet.status, stOut: outlet.status };
      await put(key, JSON.stringify(store), { contentType: "application/json", access: "private", allowOverwrite: true });
      res.json({ ok: true, day: day, time: time, snapshot: store[time] });
      return;
    }
    const store = await readStore();
    res.setHeader("Cache-Control", "no-store");
    res.json({ day: day, updates: store });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
