// api/cctv.js - pintu unggah snapshot CCTV (kunci wajib); parameter cam = inlet|outlet; GET = daftar snapshot
const { put, list } = require("@vercel/blob");
module.exports = async (req, res) => {
  try {
    const q = req.query || {};
    if (!process.env.CCTV_UPLOAD_KEY || q.key !== process.env.CCTV_UPLOAD_KEY) { res.status(403).json({ error: "kunci salah" }); return; }
    const cam = String(q.cam || "inlet");
    if (cam !== "inlet" && cam !== "outlet") { res.status(400).json({ error: "cam harus inlet|outlet" }); return; }
    const key = "cctv/" + cam + "/latest.jpg";
    if (req.method === "POST") {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const buf = Buffer.concat(chunks);
      if (buf.length < 5000) { res.status(400).json({ error: "byte terlalu kecil, bukan jpeg valid" }); return; }
      await put(key, buf, { contentType: "image/jpeg", access: "private", allowOverwrite: true });
      res.json({ ok: true, cam: cam, size: buf.length });
      return;
    }
    const out = {};
    for (const c of ["inlet", "outlet"]) {
      const f = await list({ prefix: "cctv/" + c + "/" });
      out[c] = (f.blobs || []).map(function (x) { return { uploadedAt: x.uploadedAt, size: x.size }; });
    }
    res.json(out);
  } catch (e) { res.status(500).json({ error: e.message }); }
};