// api/snap.js - jepret real-time empat mata (Ciawi inlet/outlet + Sukamahi inlet/outlet) langsung dari SINBAD
const crypto = require("crypto");
const { put } = require("@vercel/blob");
async function login() {
  const base = "https://sinbad.sda.pu.go.id";
  const cookies = {};
  const chead = () => Object.entries(cookies).map(function (x) { return x[0] + "=" + x[1]; }).join("; ");
  const setc = (r) => { const sc = (r.headers.getSetCookie ? r.headers.getSetCookie() : []); sc.forEach(function (s) { const kv = s.split(";")[0]; const i = kv.indexOf("="); cookies[kv.slice(0, i).trim()] = kv.slice(i + 1).trim(); }); };
  let r = await fetch(base + "/login.php", { headers: { "User-Agent": "Mozilla/5.0" } }); setc(r); await r.text();
  const hash = crypto.createHash("md5").update(String(process.env.SINBAD_PASS), "utf8").digest("hex");
  const body = new URLSearchParams({ uname: String(process.env.SINBAD_USER), upass: hash, sessionid: "", lat: "0", lon: "0" });
  r = await fetch(base + "/dologin2.php", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Mozilla/5.0", "Cookie": chead() }, body: body.toString() }); setc(r); await r.text();
  return { base: base, chead: chead };
}
module.exports = async (req, res) => {
  try {
    const q = req.query || {};
    if (!process.env.CCTV_UPLOAD_KEY || q.key !== process.env.CCTV_UPLOAD_KEY) { res.status(403).json({ error: "kunci salah" }); return; }
    const s = await login();
    const out = {};
    const cams = [["inlet", "CiawiInlet"], ["outlet", "CiawiPOutlet"], ["skinlet", "SukamahiInlet"], ["skoutlet", "SukamahiPOutlet"]];
    for (const c of cams) {
      try {
        const r = await fetch(s.base + "/cctv-stream/api/frame.jpeg?src=" + c[1], { headers: { "User-Agent": "Mozilla/5.0", "Cookie": s.chead() } });
        if (!r.ok) { out[c[0]] = "http " + r.status; continue; }
        const buf = Buffer.from(await r.arrayBuffer());
        if (buf.length < 5000) { out[c[0]] = "byte kecil"; continue; }
        await put("cctv/" + c[0] + "/latest.jpg", buf, { contentType: "image/jpeg", access: "private", allowOverwrite: true });
        out[c[0]] = buf.length;
      } catch (e) { out[c[0]] = e.message; }
    }
    res.json({ ok: true, cams: out });
  } catch (e) { res.status(500).json({ error: e.message }); }
};