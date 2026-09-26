// api/piezometer.js v2 - master + rekaman harian; GET terkini bertanggal; POST bertanggal; ?format=csv unduh riwayat
const { put, get } = require("@vercel/blob");
const MASTER_PIEZO = [
  { sta: "310", name: "PPU1", tip: 475.00, top: 551.37, gamma: 1.757, press: 24.79, izin: 542.09 },
  { sta: "310", name: "PPD2", tip: 475.00, top: 551.37, gamma: 1.757, press: 28.35, izin: 542.09 },
  { sta: "310", name: "PPU3", tip: 485.00, top: 551.37, gamma: 1.757, press: 23.05, izin: 543.30 },
  { sta: "310", name: "PPD4", tip: 485.00, top: 551.37, gamma: 1.757, press: 23.04, izin: 544.88 },
  { sta: "310", name: "PTU1", tip: 498.00, top: 551.37, gamma: 1.757, press: 16.23, izin: 544.88 },
  { sta: "310", name: "PTA2", tip: 498.00, top: 551.37, gamma: 1.757, press: 17.21, izin: 544.88 },
  { sta: "310", name: "PTD3", tip: 498.00, top: 551.37, gamma: 1.757, press: 15.61, izin: 544.88 },
  { sta: "310", name: "PTD4", tip: 500.00, top: 551.37, gamma: 1.757, press: 13.28, izin: 545.72 },
  { sta: "310", name: "PTU5", tip: 510.00, top: 551.37, gamma: 1.757, press: 14.29, izin: 546.34 },
  { sta: "310", name: "PTA6", tip: 510.00, top: 551.37, gamma: 1.757, press: 18.60, izin: 546.34 },
  { sta: "310", name: "PTD7", tip: 510.00, top: 551.37, gamma: 1.757, press: 15.95, izin: 546.82 },
  { sta: "310", name: "PTU8", tip: 520.00, top: 551.37, gamma: 1.757, press: 7.13, izin: 547.92 },
  { sta: "310", name: "PTD9", tip: 520.00, top: 551.37, gamma: 1.757, press: 2.90, izin: 547.56 },
  { sta: "310", name: "PTU10", tip: 520.00, top: 536.00, gamma: 1.757, press: 2.07, izin: 534.24 },
  { sta: "310", name: "PTU11", tip: 520.00, top: 536.00, gamma: 1.757, press: 1.03, izin: 534.24 },
  { sta: "310", name: "PTU12", tip: 510.00, top: 536.00, gamma: 1.757, press: 8.05, izin: 533.14 },
  { sta: "310", name: "PTU13", tip: 510.00, top: 536.00, gamma: 1.757, press: 8.28, izin: 533.63 },
  { sta: "310", name: "PTD21", tip: 510.00, top: 542.50, gamma: 1.757, press: 12.77, izin: 538.93 },
  { sta: "310", name: "PTD22", tip: 510.00, top: 542.50, gamma: 1.757, press: 13.37, izin: 538.93 },
  { sta: "377.5", name: "PPU5", tip: 475.00, top: 551.03, gamma: 1.757, press: 31.16, izin: 541.79 },
  { sta: "377.5", name: "PPA6", tip: 475.00, top: 551.03, gamma: 1.757, press: 31.48, izin: 541.79 },
  { sta: "377.5", name: "PPU7", tip: 485.00, top: 551.03, gamma: 1.757, press: 20.84, izin: 543.01 },
  { sta: "377.5", name: "PPD8", tip: 485.00, top: 551.03, gamma: 1.757, press: 18.13, izin: 543.01 },
  { sta: "377.5", name: "PTU16", tip: 510.00, top: 551.03, gamma: 1.757, press: 12.07, izin: 546.05 },
  { sta: "377.5", name: "PTA17", tip: 510.00, top: 551.03, gamma: 1.757, press: 12.89, izin: 546.05 },
  { sta: "377.5", name: "PTD18", tip: 510.00, top: 551.03, gamma: 1.757, press: 10.69, izin: 546.05 },
  { sta: "377.5", name: "PTU19", tip: 520.00, top: 551.03, gamma: 1.757, press: 10.00, izin: 546.05 },
  { sta: "377.5", name: "PTD20", tip: 520.00, top: 551.03, gamma: 1.757, press: 6.33, izin: 547.26 },
  { sta: "377.5", name: "PTU14", tip: 520.00, top: 535.50, gamma: 1.757, press: 1.34, izin: 534.09 },
  { sta: "377.5", name: "PTU15", tip: 520.00, top: 535.50, gamma: 1.757, press: 1.88, izin: 534.09 },
  { sta: "377.5", name: "OSP", tip: 499.50, top: 540.90, gamma: 1.757, press: 17.30, izin: 535.93 }
];
const STORE = "piezo/records.json";
function hitung(r, press) {
  const ru = press / ((r.top - r.tip) * r.gamma);
  const status = (r.tip + press) < r.izin ? "AMAN" : "HATI-HATI";
  return { ru: ru, status: status };
}
function hariIni() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
}
async function bacaRecords() {
  try {
    const b = await get(STORE, { access: "private", token: process.env.BLOB_READ_WRITE_TOKEN });
    return JSON.parse(await new Response(b.stream).text());
  } catch (e) { return {}; }
}
module.exports = async (req, res) => {
  try {
    const q = req.query || {};
    const rec = await bacaRecords();
    if (q.format === "csv") {
      const lines = ["tanggal;sta;nama;tip;top;gamma;press;izin;ru;status"];
      Object.keys(rec).sort().forEach(function (n) {
        Object.keys(rec[n]).sort().forEach(function (d) {
          const r = MASTER_PIEZO.find(function (x) { return x.name === n; });
          if (!r) return;
          const h = hitung(r, rec[n][d]);
          lines.push([d, r.sta, n, r.tip.toFixed(2), r.top.toFixed(2), r.gamma, Number(rec[n][d]).toFixed(2), r.izin.toFixed(2), h.ru.toFixed(4), h.status].join(";"));
        });
      });
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", "attachment; filename=\"piezometer-ciawi.csv\"");
      res.status(200).send(lines.join("\n"));
      return;
    }
    if (req.method === "POST") {
      let body = {};
      try {
        if (typeof req.body === "object" && req.body !== null) body = req.body;
        else if (typeof req.body === "string" && req.body) body = JSON.parse(req.body);
        else {
          const chunks = [];
          for await (const c of req) chunks.push(c);
          const raw = Buffer.concat(chunks).toString("utf8");
          if (raw) body = JSON.parse(raw);
        }
      } catch (e) { body = {}; }
      const key = String(body.key || q.key || "");
      if (body.name === undefined && q.name !== undefined) body.name = q.name;
      if (body.press === undefined && q.press !== undefined) body.press = q.press;
      if (body.date === undefined && q.date !== undefined) body.date = q.date;
      if (!process.env.CCTV_UPLOAD_KEY || key !== process.env.CCTV_UPLOAD_KEY) { res.status(403).json({ error: "kunci salah" }); return; }
      const row = MASTER_PIEZO.find(function (r) { return r.name === String(body.name); });
      const press = Number(body.press);
      if (!row) { res.status(404).json({ error: "nama instrumen tidak dikenal" }); return; }
      if (!isFinite(press) || press < 0 || press > 200) { res.status(400).json({ error: "press tidak valid" }); return; }
      const date = String(body.date || hariIni());
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { res.status(400).json({ error: "tanggal harus YYYY-MM-DD" }); return; }
      if (!rec[row.name]) rec[row.name] = {};
      rec[row.name][date] = Math.round(press * 100) / 100;
      await put(STORE, JSON.stringify(rec), { contentType: "application/json", access: "private", allowOverwrite: true });
      const h = hitung(row, press);
      res.json({ ok: true, name: row.name, date: date, press: rec[row.name][date], ru: h.ru, status: h.status });
      return;
    }
    let lastDate = "";
    const semua = {};
    Object.keys(rec).forEach(function (n) { Object.keys(rec[n]).forEach(function (d) { semua[d] = 1; }); });
    const daftarTanggal = Object.keys(semua).sort().reverse();
    const batas = String(q.tanggal || "");
    const pakaiBatas = /^\d{4}-\d{2}-\d{2}$/.test(batas);
    const out = MASTER_PIEZO.map(function (r) {
      let press = r.press;
      let tanggal = "";
      const hist = rec[r.name];
      if (hist) {
        const ds = Object.keys(hist).sort();
        const pilih = pakaiBatas ? ds.filter(function (d) { return d <= batas; }) : ds;
        if (pilih.length) {
          press = hist[pilih[pilih.length - 1]];
          tanggal = pilih[pilih.length - 1];
        }
        if (ds.length && ds[ds.length - 1] > lastDate) lastDate = ds[ds.length - 1];
      }
      const h = hitung(r, press);
      return { sta: r.sta, name: r.name, tip: r.tip, top: r.top, gamma: r.gamma, press: press, izin: r.izin, tanggal: tanggal, ru: h.ru, status: h.status };
    });
    res.json({ terakhir: lastDate, sesuai: pakaiBatas ? batas : "", daftarTanggal: daftarTanggal, data: out });
  } catch (e) { res.status(500).json({ error: e.message }); }
};