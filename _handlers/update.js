// api/update.js - snapshot update terjadwal: publish=1&time=HH:MM menyimpan snapshot mentah; GET membaca snapshot hari ini
import {put, get, list} from "./_blob.js";
// Cloudflare Pages memblokir fetch ke origin sendiri (403), jadi panggil
// handler /api/fleet langsung di proses yang sama.
async function fetchFleet(){
  const { default: fleetHandler } = await import("./fleet.js");
  let payload = null;
  const res = {
    _status: 200,
    status(c) { this._status = c; return this; },
    setHeader() { return this; },
    json(o) { payload = o; return this; },
    send(b) { payload = b; return this; },
  };
  await fleetHandler({ query: {}, method: "GET", headers: {} }, res);
  if (res._status !== 200 || !payload) throw new Error("fleet internal HTTP " + res._status);
  return payload;
}
export default async (req, res) => {
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
