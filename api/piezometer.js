// api/piezometer.js v4
// Master + riwayat pembacaan + elevasi timbunan.
// Riwayat historis dari data/piezo-history.json, timbunan dari data/piezo-timbunan.json
// (keduanya statis). Isian baru disimpan ke Vercel Blob; tanpa token Blob -> berkas lokal.
//
// GET  /api/piezometer                                  status terkini (kompatibel v2/v3)
// GET  /api/piezometer?tanggal=YYYY-MM-DD               status per tanggal
// GET  /api/piezometer?format=csv                       unduh riwayat
// GET  /api/piezometer?seri=1&sta=310&dari=&sampai=     seri grafik + seri timbunan
// GET  /api/piezometer?rekap=1&dari=&sampai=            rekap bulanan
// POST /api/piezometer  {key,name,press,date}                       isi tekanan (m)
// POST /api/piezometer  {key,name,r1,date}                          isi R1 mentah
// POST /api/piezometer  {key,jenis:"timbunan",grup:"CP",nilai,date} isi elevasi timbunan
const fs = require("fs");
const path = require("path");

const MASTER = require("../data/piezo-master.json");
const ALAT = MASTER.alat;
const STORE = "piezo/records.json";
const STORE_TIMB = "piezo/timbunan.json";
const DATA_DIR = path.join(__dirname, "..", "data");
const LOKAL = path.join(DATA_DIR, "piezo-local.json");
const LOKAL_TIMB = path.join(DATA_DIR, "piezo-timbunan-local.json");
const KODE_GRUP = ["CP", "DU", "EL", "BN", "CF"];

const ADA_BLOB = !!process.env.BLOB_READ_WRITE_TOKEN;
let blob = null;
if (ADA_BLOB) { try { blob = require("@vercel/blob"); } catch (e) { blob = null; } }

let _hist = null, _timb = null;
function history() {
  if (!_hist) { try { _hist = require("../data/piezo-history.json"); } catch (e) { _hist = {}; } }
  return _hist;
}
function timbunanStatik() {
  if (!_timb) { try { _timb = require("../data/piezo-timbunan.json").grup || {}; } catch (e) { _timb = {}; } }
  return _timb;
}
function cari(nama) { return ALAT.find(function (a) { return a.name === String(nama); }); }

// nilai terakhir pada / sebelum tanggal, dari seri perubahan [[tanggal, nilai], ...]
function padaSeri(ser, tanggal, bawaan) {
  if (!ser || !ser.length) return bawaan;
  if (!tanggal) return ser[ser.length - 1][1];
  let out = ser[0][1];
  for (let i = 0; i < ser.length; i++) { if (ser[i][0] <= tanggal) out = ser[i][1]; else break; }
  return out;
}

// ---------- elevasi timbunan: gabung seri statis + isian pengguna
function grupSeri(kode, timbInput) {
  const statik = (timbunanStatik()[kode] || {}).serie || [];
  const inp = (timbInput || {})[kode] || {};
  const map = {};
  statik.forEach(function (p) { map[p[0]] = p[1]; });
  Object.keys(inp).forEach(function (d) { map[d] = inp[d]; });
  return Object.keys(map).sort().map(function (d) { return [d, map[d]]; });
}
function grupNilai(kode, timbInput) {
  const s = grupSeri(kode, timbInput);
  return s.length ? { nilai: s[s.length - 1][1], tanggal: s[s.length - 1][0], jumlah: s.length } : { nilai: null, tanggal: null, jumlah: 0 };
}
// elevasi timbunan PER ALAT: isian pengguna -> seri kelompok -> seri alat -> angka tetap
function topPada(a, tanggal, timbInput) {
  if (a.topGrup) {
    const inp = (timbInput || {})[a.topGrup] || {};
    const ds = Object.keys(inp).sort().filter(function (d) { return !tanggal || d <= tanggal; });
    if (ds.length) return inp[ds[ds.length - 1]];
    const statik = (timbunanStatik()[a.topGrup] || {}).serie;
    if (statik && statik.length) return padaSeri(statik, tanggal, a.top);
  }
  return padaSeri(a.topSerie, tanggal, a.top != null ? a.top : a.tip);
}
function izinPada(a, tanggal) { return padaSeri(a.izinSerie, tanggal, a.izin); }

function hitung(a, press, tanggal, timbInput) {
  const top = topPada(a, tanggal, timbInput);
  const gamma = a.gamma || 1.757;
  const ob = (top - a.tip) * gamma;
  const ru = ob > 0 ? press / ob : 0;
  const izin = izinPada(a, tanggal);
  const status = (a.tip + press) < izin ? "AMAN" : "HATI-HATI";
  return { ru: ru, status: status, top: top, ob: ob, izin: izin };
}
function hariIni() { return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" }); }

// ---------- simpanan
function bacaLokal(f) { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { return {}; } }
function tulisLokal(f, o) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(f, JSON.stringify(o));
    return true;
  } catch (e) { return false; }
}
async function bacaRecords() {
  if (blob) {
    try {
      const b = await blob.get(STORE, { access: "private", token: process.env.BLOB_READ_WRITE_TOKEN });
      return JSON.parse(await new Response(b.stream).text());
    } catch (e) { return {}; }
  }
  return bacaLokal(LOKAL);
}
async function tulisRecords(rec) {
  if (blob) {
    await blob.put(STORE, JSON.stringify(rec),
      { contentType: "application/json", access: "private", allowOverwrite: true });
    return "blob";
  }
  return tulisLokal(LOKAL, rec) ? "lokal" : "gagal";
}
async function bacaTimbInput() {
  if (blob) {
    try {
      const b = await blob.get(STORE_TIMB, { access: "private", token: process.env.BLOB_READ_WRITE_TOKEN });
      return JSON.parse(await new Response(b.stream).text());
    } catch (e) { return {}; }
  }
  return bacaLokal(LOKAL_TIMB);
}
async function tulisTimbInput(o) {
  if (blob) {
    await blob.put(STORE_TIMB, JSON.stringify(o),
      { contentType: "application/json", access: "private", allowOverwrite: true });
    return "blob";
  }
  return tulisLokal(LOKAL_TIMB, o) ? "lokal" : "gagal";
}

function gabung(rec) {
  const base = history();
  const out = {};
  Object.keys(base).forEach(function (n) { out[n] = Object.assign({}, base[n]); });
  Object.keys(rec || {}).forEach(function (n) {
    out[n] = out[n] || {};
    Object.keys(rec[n]).forEach(function (d) { out[n][d] = rec[n][d]; });
  });
  return out;
}
function nilaiPada(all, nama, tanggal) {
  const h = all[nama];
  if (!h) return null;
  const ds = Object.keys(h).sort();
  if (!ds.length) return null;
  if (!tanggal) return h[ds[ds.length - 1]];
  let out = null;
  for (let i = 0; i < ds.length; i++) { if (ds[i] <= tanggal) out = h[ds[i]]; else break; }
  return out;
}
function bacaBody(req, q) {
  const body = {};
  ["key", "name", "press", "r1", "date", "jenis", "grup", "nilai"].forEach(function (k) {
    if (q[k] !== undefined) body[k] = q[k];
  });
  if (typeof req.body === "object" && req.body !== null) Object.assign(body, req.body);
  return body;
}
function daftarGrup(timbInput) {
  const st = timbunanStatik();
  return KODE_GRUP.map(function (k) {
    const g = st[k] || {};
    const n = grupNilai(k, timbInput);
    return {
      kode: k, sta: g.sta, label: g.label, alat: g.alat || [],
      nilai: n.nilai, tanggal: n.tanggal, jumlah: n.jumlah,
      nilaiSheet: (g.serie && g.serie.length) ? g.serie[g.serie.length - 1][1] : null,
      tanggalSheet: (g.serie && g.serie.length) ? g.serie[g.serie.length - 1][0] : null,
      adaIsianPengguna: !!(timbInput && timbInput[k] && Object.keys(timbInput[k]).length)
    };
  });
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const q = req.query || {};

    // ---------------- POST
    if (req.method === "POST") {
      const body = bacaBody(req, q);
      const key = String(body.key || "");
      if (!process.env.CCTV_UPLOAD_KEY || key !== process.env.CCTV_UPLOAD_KEY) {
        res.status(403).json({ error: "kunci salah" }); return;
      }
      const date = String(body.date || hariIni());
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { res.status(400).json({ error: "tanggal harus YYYY-MM-DD" }); return; }

      // ----- isi elevasi timbunan
      if (String(body.jenis || "") === "timbunan") {
        const kode = String(body.grup || "").toUpperCase();
        if (KODE_GRUP.indexOf(kode) < 0) {
          res.status(400).json({ error: "kelompok timbunan tidak dikenal (pakai: " + KODE_GRUP.join(", ") + ")" }); return;
        }
        const nilai = Number(body.nilai);
        if (!isFinite(nilai) || nilai < 400 || nilai > 650) {
          res.status(400).json({ error: "elevasi timbunan tidak valid (harus 400 s/d 650 m)" }); return;
        }
        const t = await bacaTimbInput();
        if (!t[kode]) t[kode] = {};
        t[kode][date] = Math.round(nilai * 1000) / 1000;
        const media = await tulisTimbInput(t);
        const n = grupNilai(kode, t);
        const g = (timbunanStatik()[kode] || {});
        const contoh = (g.alat || [])[0];
        const a = contoh ? cari(contoh) : null;
        res.json({ ok: true, jenis: "timbunan", grup: kode, label: g.label, date: date,
                   nilai: t[kode][date], terakhir: n, disimpan: media,
                   contohRu: a ? hitung(a, a.press || 0, date, t).ru : null, contohAlat: contoh || null });
        return;
      }

      // ----- isi pembacaan piezometer
      const a = cari(body.name);
      if (!a) { res.status(404).json({ error: "nama instrumen tidak dikenal" }); return; }
      let press, dari, r1 = null;
      if (body.r1 !== undefined && body.r1 !== null && String(body.r1) !== "") {
        r1 = Number(body.r1);
        if (!isFinite(r1)) { res.status(400).json({ error: "r1 tidak valid" }); return; }
        if (a.a == null || a.b == null || a.r0 == null) {
          res.status(400).json({ error: "alat ini belum punya koefisien A/B/R0, isi mode tekanan" }); return;
        }
        const C = -(a.a * a.r0 * a.r0 + a.b * a.r0);
        const E = a.a * r1 * r1 + a.b * r1 + C;
        press = E * 0.1022;
        dari = "r1";
      } else {
        press = Number(body.press);
        dari = "press";
      }
      if (!isFinite(press) || press < -5 || press > 60) {
        res.status(400).json({ error: "tekanan tidak valid (harus -5 s/d 60 m)" }); return;
      }
      press = Math.round(press * 100) / 100;

      const rec = await bacaRecords();
      if (!rec[a.name]) rec[a.name] = {};
      rec[a.name][date] = press;
      const media = await tulisRecords(rec);
      const ti = await bacaTimbInput();
      const h = hitung(a, press, date, ti);
      res.json({ ok: true, jenis: "pembacaan", name: a.name, date: date, press: press, ru: h.ru,
                 status: h.status, izin: h.izin, top: h.top, r1: r1, dari: dari, disimpan: media });
      return;
    }

    // ---------------- GET : data timbunan saja
    if (q.timbunan) {
      const ti = await bacaTimbInput();
      res.json({ grup: daftarGrup(ti), kode: KODE_GRUP, penyimpanan: blob ? "blob" : "lokal" });
      return;
    }

    // ---------------- GET : unduh CSV
    if (q.format === "csv") {
      const rec = await bacaRecords();
      const ti = await bacaTimbInput();
      const all = gabung(rec);
      const lines = ["tanggal;sta;nama;tip;elv_timbunan;gamma;press;elevasi_air;izin;ru;status"];
      Object.keys(all).sort().forEach(function (n) {
        const a = cari(n); if (!a) return;
        Object.keys(all[n]).sort().forEach(function (d) {
          const press = Number(all[n][d]);
          const h = hitung(a, press, d, ti);
          lines.push([d, a.sta, n, a.tip.toFixed(2), h.top.toFixed(3), a.gamma,
                      press.toFixed(2), (a.tip + press).toFixed(3), h.izin.toFixed(3),
                      h.ru.toFixed(4), h.status].join(";"));
        });
      });
      lines.push("");
      lines.push("# ELEVASI TIMBUNAN");
      lines.push("kode;sta;label;tanggal;nilai");
      KODE_GRUP.forEach(function (k) {
        const g = (timbunanStatik()[k] || {});
        grupSeri(k, ti).forEach(function (p) {
          lines.push([k, g.sta, g.label, p[0], p[1]].join(";"));
        });
      });
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="piezometer-ciawi.csv"');
      res.status(200).send("\ufeff" + lines.join("\n"));
      return;
    }

    // ---------------- GET : seri untuk grafik
    if (q.seri) {
      const rec = await bacaRecords();
      const ti = await bacaTimbInput();
      const all = gabung(rec);
      const sta = String(q.sta || "310");
      const dari = String(q.dari || ""), sampai = String(q.sampai || "9999-12-31");
      const alat = ALAT.filter(function (a) { return a.sta === sta; });
      const semuaTanggal = {};
      const seri = alat.map(function (a) {
        const h = all[a.name] || {};
        const titik = Object.keys(h).sort()
          .filter(function (d) { return d >= dari && d <= sampai; })
          .map(function (d) {
            semuaTanggal[d] = 1;
            const press = h[d];
            const hi = hitung(a, press, d, ti);
            return [d, Number(press), Number((a.tip + press).toFixed(3)), Number(hi.ru.toFixed(4)), hi.top];
          });
        return { name: a.name, sta: a.sta, tip: a.tip, gamma: a.gamma, izin: izinPada(a, null),
                 izinSerie: a.izinSerie || [], topGrup: a.topGrup, titik: titik, jumlah: titik.length };
      });
      seri.sort(function (x, y) { return y.jumlah - x.jumlah; });
      // seri timbunan untuk STA ini: kirim PENUH (tanpa filter rentang) karena
      // elevasi timbunan bergerak lambat - grafik khususnya menampilkan seluruh riwayat
      const grupSta = KODE_GRUP.filter(function (k) { return (timbunanStatik()[k] || {}).sta === sta; });
      const timbunan = grupSta.map(function (k) {
        const g = timbunanStatik()[k] || {};
        return { kode: k, label: g.label, alat: g.alat || [], titik: grupSeri(k, ti) };
      });
      res.json({ sta: sta, dari: dari, sampai: sampai, jumlahTanggal: Object.keys(semuaTanggal).length,
                 timbunan: timbunan, seri: seri });
      return;
    }

    // ---------------- GET : rekap bulanan
    if (q.rekap) {
      const rec = await bacaRecords();
      const ti = await bacaTimbInput();
      const all = gabung(rec);
      const dari = String(q.dari || "0000-01-01"), sampai = String(q.sampai || "9999-12-31");
      const bulan = {};
      ALAT.forEach(function (a) {
        const h = all[a.name] || {};
        Object.keys(h).forEach(function (d) {
          if (d < dari || d > sampai) return;
          const b = d.slice(0, 7);
          bulan[b] = bulan[b] || {};
          const m = bulan[b][a.name] = bulan[b][a.name] || { min: Infinity, max: -Infinity, jml: 0, sum: 0, ruMax: 0, top: null };
          const v = Number(h[d]);
          if (v < m.min) m.min = v;
          if (v > m.max) m.max = v;
          m.jml++; m.sum += v;
          const hi = hitung(a, v, d, ti);
          if (hi.ru > m.ruMax) m.ruMax = hi.ru;
          m.top = hi.top;
        });
      });
      const hasil = Object.keys(bulan).sort().reverse().map(function (b) {
        const baris = Object.keys(bulan[b]).map(function (n) {
          const m = bulan[b][n], a = cari(n);
          const iz = izinPada(a, b + "-28");
          return { name: n, sta: a.sta, min: +m.min.toFixed(2), max: +m.max.toFixed(2),
                   rata: +(m.sum / m.jml).toFixed(2), jml: m.jml, ruMax: +m.ruMax.toFixed(3),
                   elvTimbunan: m.top, izin: iz,
                   status: (a.tip + m.max) < iz ? "AMAN" : "HATI-HATI" };
        });
        baris.sort(function (x, y) { return x.sta.localeCompare(y.sta) || x.name.localeCompare(y.name); });
        return { bulan: b, baris: baris };
      });
      res.json({ dari: dari, sampai: sampai, bulan: hasil });
      return;
    }

    // ---------------- GET : status terkini / per tanggal
    const rec = await bacaRecords();
    const ti = await bacaTimbInput();
    const all = gabung(rec);
    const batas = String(q.tanggal || "");
    const pakaiBatas = /^\d{4}-\d{2}-\d{2}$/.test(batas);
    const semua = {};
    Object.keys(all).forEach(function (n) { Object.keys(all[n]).forEach(function (d) { semua[d] = 1; }); });
    const daftarTanggal = Object.keys(semua).sort().reverse();
    const terakhir = daftarTanggal[0] || "";
    const out = ALAT.map(function (a) {
      let press = a.press, tanggal = pakaiBatas ? "" : (a.tanggal || "");
      const v = nilaiPada(all, a.name, pakaiBatas ? batas : null);
      if (v != null) {
        press = v;
        const h = all[a.name];
        const ds = Object.keys(h).sort().filter(function (d) { return !pakaiBatas || d <= batas; });
        tanggal = ds.length ? ds[ds.length - 1] : "";
      }
      if (press == null) press = 0;
      const h = hitung(a, press, tanggal || null, ti);
      return { sta: a.sta, name: a.name, tip: a.tip, top: h.top, topGrup: a.topGrup, gamma: a.gamma,
               press: press, izin: h.izin, tanggal: tanggal, ru: h.ru, status: h.status,
               jumlah: a.jumlah || 0, a: a.a, b: a.b, c: a.c, r0: a.r0,
               namaSheet: a.namaSheet || a.name,
               punyaKoefisien: a.a != null && a.b != null && a.r0 != null };
    });
    const jumlah = ALAT.reduce(function (s, a) { return s + (a.jumlah || 0); }, 0);
    res.json({ terakhir: terakhir, sesuai: pakaiBatas ? batas : "", daftarTanggal: daftarTanggal,
               totalRiwayat: jumlah, penyimpanan: blob ? "blob" : "lokal",
               timbunan: daftarGrup(ti), data: out });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
