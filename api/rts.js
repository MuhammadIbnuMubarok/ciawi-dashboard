// api/rts.js - live scrape RTS/ADR monitoring4system (login sesi) + cache Blob + CSV
const { put, get } = require("@vercel/blob");
const BASE = "https://ciawi.monitoring4system.com";
const STORE = "rts/latest.json";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)";
const Q = "\u0027";
async function vendorHtml() {
  const cookies = {};
  const chead = function () { return Object.entries(cookies).map(function (x) { return x[0] + "=" + x[1]; }).join("; "); };
  const setc = function (r) {
    const sc = r.headers.getSetCookie ? r.headers.getSetCookie() : [];
    sc.forEach(function (s) { const kv = s.split(";")[0]; const i = kv.indexOf("="); cookies[kv.slice(0, i).trim()] = kv.slice(i + 1).trim(); });
  };
  let r = await fetch(BASE + "/login", { headers: { "User-Agent": UA } });
  setc(r); await r.text();
  const body = new URLSearchParams({ username: String(process.env.RTS_USER), password: String(process.env.RTS_PASS) });
  const opt = { method: "POST", redirect: "manual", body: body.toString() };
  opt.headers = { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA, "Cookie": chead(), "Referer": BASE + "/login" };
  r = await fetch(BASE + "/login/validasi_login", opt);
  setc(r); await r.text();
  r = await fetch(BASE + "/beranda", { headers: { "User-Agent": UA, "Cookie": chead() } });
  if (!r.ok) throw new Error("beranda http " + r.status);
  const html = await r.text();
  if (html.indexOf("Date Selected") < 0) throw new Error("sesi vendor gagal");
  return html;
}
function ambil(html, re) { const m = html.match(re); return m ? m[1].trim() : ""; }
function parse(html) {
  const out = {};
  out.statusRts = ambil(html, /Status RTS<\/h3>\s*<h3[^>]*>([^<]+)</);
  out.power = ambil(html, /Power RTS<\/h3><\/a>\s*<h2[^>]*>([^<]+)</);
  out.humidity = ambil(html, /Humidity Logger<\/h3><\/a>\s*<h2[^>]*>([^<]+)</);
  out.battery = ambil(html, /Battery Logger<\/h3><\/a>\s*<h2[^>]*>([^<]+)</);
  out.temperature = ambil(html, /Temperature Logger<\/h3><\/a>\s*<h2[^>]*>([^<]+)</);
  out.statusLogger = ambil(html, /Status Logger<\/a><\/strong>\s*<label[^>]*>\s*([^<]+?)\s*<\/label>/);
  out.statusSd = ambil(html, /Status SD Card<\/a><\/strong>\s*<label[^>]*>\s*([^<]+?)\s*<\/label>/);
  out.tanggal = ambil(html, /Date Selected : ([^<]+)</);
  out.prisma = [];
  const marker = "parameter\" value=" + Q;
  const s = html.indexOf(marker);
  if (s >= 0) {
    const s2 = s + marker.length;
    const e2 = html.indexOf(Q, s2);
    if (e2 > s2) {
      const clean = html.slice(s2, e2).replace(/\r/g, "\\r").replace(/\n/g, "\\n");
      try { out.prisma = JSON.parse(clean); } catch (err) { out.prisma = []; }
    }
  }
  out.rows = (out.prisma || []).map(function (p) {
    const t = p.temp_tembak || {};
    const lin = Number(t.linear);
    const nm = String(p.nama_prisma || "").replace(/\r/g, "").replace(/\n/g, "").trim();
    const o = { id: p.id_prisma, nama: nm, waktu: p.waktu || "" };
    o.x0 = Number(p.N0); o.y0 = Number(p.E0); o.z0 = Number(p.Z0);
    o.x1 = Number(p.N1); o.y1 = Number(p.E1); o.z1 = Number(p.Z1);
    o.dx = Number(t.DN); o.dy = Number(t.DE); o.dz = Number(t.DZ);
    o.lin = isFinite(lin) ? lin : 0;
    o.arah = Number(t.arah_pergeseran);
    o.ok = String(p.status_get) === "1" && isFinite(lin) && lin < 1000;
    return o;
  });
  return out;
}
module.exports = async (req, res) => {
  try {
    const q = req.query || {};
    let payload = null;
    let live = false;
    try {
      const html = await vendorHtml();
      payload = parse(html);
      if (payload.rows && payload.rows.length) {
        live = true;
        payload.diambil = new Date().toISOString();
        await put(STORE, JSON.stringify(payload), { contentType: "application/json", access: "private", allowOverwrite: true });
      }
    } catch (e) { payload = null; }
    if (!payload || !payload.rows || !payload.rows.length) {
      try {
        const b = await get(STORE, { access: "private", token: process.env.BLOB_READ_WRITE_TOKEN });
        payload = JSON.parse(await new Response(b.stream).text());
      } catch (e2) { payload = null; }
    }
    if (!payload) { res.status(502).json({ error: "sumber RTS tidak terjangkau dan cache kosong" }); return; }
    if (q.format === "csv") {
      const L = ["id_prisma;nama;waktu;X_awal;Y_awal;Z_awal;X_hasil;Y_hasil;Z_hasil;dX;dY;dZ;linier_m;linier_mm;arah_derajat;valid"];
      payload.rows.forEach(function (r) {
        const c = [r.id, r.nama, r.waktu, r.x0, r.y0, r.z0, r.x1, r.y1, r.z1];
        c.push(r.dx, r.dy, r.dz, r.lin.toFixed(4), (r.lin * 1000).toFixed(1));
        c.push(r.arah.toFixed(2), r.ok ? "YA" : "TIDAK");
        L.push(c.join(";"));
      });
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", "attachment; filename=\"rts-ciawi.csv\"");
      res.status(200).send(L.join("\n"));
      return;
    }
    res.json({ live: live, data: payload });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
