// api/record.js - perekam server: dipanggil Vercel Cron tiap jam, idempoten per menit
const { put, get, list } = require("@vercel/blob");
async function fetchFleet(){
  const r = await fetch(process.env.FLEET_URL, { cache: "no-store" });
  if (!r.ok) throw new Error("fleet HTTP " + r.status);
  return r.json();
}
module.exports = async (req, res) => {
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








