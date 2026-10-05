// api/cctv.js - pintu unggah snapshot CCTV (kunci wajib); parameter cam = inlet|outlet; GET = daftar snapshot
import {put, list} from "./_blob.js";
export default async (req, res) => {
  try {
    const q = req.query || {};
    if (!process.env.CCTV_UPLOAD_KEY || q.key !== process.env.CCTV_UPLOAD_KEY) { res.status(403).json({ error: "kunci salah" }); return; }
    const cam = String(q.cam || "inlet");
    // snap.js dan telegram.js meminta 4 kamera: inlet, outlet (Ciawi) serta
// skinlet, skoutlet (Sukamahi). Versi ini hanya menerima inlet|outlet sehingga
// dua kamera Sukamahi selalu ditolak dan foto tidak pernah tersimpan.
const CAM_VALID = ["inlet", "outlet", "skinlet", "skoutlet"];
if (!CAM_VALID.includes(cam)) {
  res.status(400).json({ error: "cam harus salah satu: " + CAM_VALID.join(", ") });
  return;
}
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