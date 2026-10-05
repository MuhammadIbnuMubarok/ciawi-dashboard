// api/record.js - perekam server: dipanggil Vercel Cron tiap jam, idempoten per menit
import {put, get, list} from "./_blob.js";
async function fetchFleet(){
  // Cloudflare Pages memblokir fetch ke origin sendiri lewat /api/fleet (403),
  // jadi panggil handler-nya langsung di dalam proses yang sama - identik
  // hasilnya dan tanpa satu round-trip jaringan.
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
    const j = await fetchFleet();
    const arr = (j && j.telemetryjakarta) || [];
    const now = new Date();
    const day = now.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
    const ts = day + " " + now.toLocaleTimeString("en-GB", { timeZone: "Asia/Jakarta", hour12: false }).slice(0, 5);
    const picks = [];
    for (const s of arr) {
      const loc = String(s.nama_lokasi || "").toLowerCase();
      if (loc === "inletciawi" || loc === "outliteciawi") {
        picks.push({ ts: ts, loc: loc, tma: Number(s.WLevel), q: s.debit, st: s.status, rx: (s.ReceivedDate || "") + " " + (s.ReceivedTime || "") });
      }
    }
    if (!picks.length) { res.status(502).json({ error: "fleet tanpa stasiun ciawi" }); return; }
    const key = "history/" + day + ".jsonl";
    let prev = "";
    const found = await list({ prefix: key });
    if (found.blobs && found.blobs.length) {
      const b = await get(key, { access: "private", token: process.env.BLOB_READ_WRITE_TOKEN });
      if (b && b.stream) { prev = await new Response(b.stream).text(); } else { res.status(500).json({ error: "stream blob tidak ada, menolak overwrite", bentuk: b ? Object.keys(b) : null }); return; }
    }
    if (prev.indexOf('"ts":"' + ts + '"') >= 0) { res.json({ ok: true, dup: true, lines: prev.trim().split("\n").length }); return; }
    const body = prev + picks.map(p => JSON.stringify(p)).join("\n") + "\n";
    await put(key, body, { contentType: "text/plain", access: "private", allowOverwrite: true });
    res.json({ ok: true, lines: body.trim().split("\n").length, ts: ts });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

