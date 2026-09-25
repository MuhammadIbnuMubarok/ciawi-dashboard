// api/cctv.js - pintu unggah snapshot CCTV dari PC kantor (kunci wajib); GET = daftar snapshot
const { put, list } = require("@vercel/blob");
module.exports = async (req, res) => {
  try {
    const q = req.query || {};
    if (!process.env.CCTV_UPLOAD_KEY || q.key !== process.env.CCTV_UPLOAD_KEY) { res.status(403).json({ error: "kunci salah" }); return; }
    if (req.method === "POST") {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const buf = Buffer.concat(chunks);
      if (buf.length < 5000) { res.status(400).json({ error: "byte terlalu kecil, bukan jpeg valid" }); return; }
      await put("cctv/inlet/latest.jpg", buf, { contentType: "image/jpeg", access: "private", allowOverwrite: true });
      res.json({ ok: true, size: buf.length });
      return;
    }
    const f = await list({ prefix: "cctv/inlet/" });
    res.json({ blobs: (f.blobs || []).map(function(x){ return { uploadedAt: x.uploadedAt, size: x.size }; }) });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
