// api/piezometer.js — v6: baca data piezo-*.json dari repo (histori penuh)
//
// DIPERBAIKI 2026-10-05. Versi v5 hanya mengembalikan satu snapshot `press`
// per instrumen dengan `daftarTanggal: []`, sehingga grafik tidak punya apa pun
// untuk diplot. Versi ini membaca file data yang sudah ada di repo:
//
//   data/piezo-master.json    -> 31 instrumen (sta, tip, gamma, izin, a/b/r0/c)
//   data/piezo-history.json   -> {INSTRUMEN: {"YYYY-MM-DD": tekanan pori}}
//   data/piezo-arsip.json     -> {meta, hujan, seri} (elevasi timbunan)
//   data/piezo-excluded.json  -> {jumlah, baris} (baris dibuang validator)
//
// Bentuk respons dipertahankan kompatibel dengan frontend yang sudah ada:
//   { terakhir, sesuai, daftarTanggal, data, ... }
//
// Status: pakai `ket` dari sumber bila ada; bila tidak, ambang resmi modul
// (tip + press) < izin. Ru = press / ((top - tip) * gamma).

// Workers/Pages tidak punya node:fs / node:path. Import-nya dilakukan lewat
// dynamic import di dalam baca() agar tidak gagal saat modul dimuat di Workers.
import {
  PIEZO_MASTER as masterImported,
  PIEZO_HISTORY as historyImported,
  PIEZO_ARSIP as arsipImported,
  PIEZO_EXCLUDED as excludedImported,
} from "./_piezo-data.js";

let _fs = null;
let _path = null;

async function muatNode() {
  if (_fs) return true;
  if (typeof process === "undefined" || !process.versions?.node) return false;
  try {
    _fs = await import("node:fs");
    _path = await import("node:path");
    return true;
  } catch {
    return false;
  }
}

const DATA_DIR = "data";

let CACHE = null;

async function baca(nama) {
  const bundled = {
    "piezo-master.json": masterImported,
    "piezo-history.json": historyImported,
    "piezo-arsip.json": arsipImported,
    "piezo-excluded.json": excludedImported,
  };
  // Cloudflare Workers/Pages tidak punya filesystem -> pakai data ter-bundle.
  if (!(await muatNode()) || !_fs) return bundled[nama] ?? null;
  try {
    const p = _path.default ? _path.default.join(process.cwd(), DATA_DIR, nama)
                           : _path.join(process.cwd(), DATA_DIR, nama);
    if (!_fs.existsSync(p)) return bundled[nama] ?? null;
    const txt = _fs.readFileSync(p, "utf8");
    return JSON.parse(txt.replace(/^\uFEFF/, ""));
  } catch {
    return bundled[nama] ?? null;
  }
}

function hariIni() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
}

function hitung(r, press) {
  const pressNum = Number(press);
  const tinggi = (Number(r.top) - Number(r.tip)) * Number(r.gamma);
  const ru = tinggi > 0 ? pressNum / tinggi : null;
  const aman = Number(r.tip) + pressNum < Number(r.izin);
  return {
    ru: ru === null ? null : parseFloat(ru.toFixed(4)),
    status: aman ? "AMAN" : "HATI-HATI",
  };
}

export default async function handler(req, res) {
  const q = req.query || {};

  const master = await baca("piezo-master.json");
    const history = await baca("piezo-history.json");
    const arsip = await baca("piezo-arsip.json");
    const excluded = await baca("piezo-excluded.json");

  if (!master || !Array.isArray(master.alat)) {
    res.status(500).json({
      error: "data/piezo-master.json tidak terbaca",
      hint: "pastikan file ikut ter-deploy (vercel.json -> functions includeFiles)",
    });
    return;
  }

  const alat = master.alat;
    const H = history && typeof history === "object" ? history : {};
    const seriTimb = arsip && arsip.seri ? arsip.seri : {};

    // Kunci piezo-arsip.seri berbentuk "NAMA@sta@..." (atau "GRUP@sta@...").
    // Peta dua arah supaya bisa cari elevasi per instrumen maupun per grup.
    const timbInstrumen = {};
    const grupTimb = {};
    for (const [k, v] of Object.entries(seriTimb)) {
      if (!Array.isArray(v) || !k.includes("@")) continue;
      const kode = String(k).split("@")[0];
      (grupTimb[kode] = grupTimb[kode] || []).push(...v);
      if (H[kode]) timbInstrumen[kode] = v;
    }

  // ---------- CSV export: histori panjang per instrumen ----------
  if (q.format === "csv") {
    const lines = ["tanggal;sta;nama;tip;top;gamma;press;izin;ru;status;elevasi"];
    for (const r of alat) {
      const seri = H[r.name] || {};
      const elv = seriTimb[r.name];
      const elvVal = elv && elv.length ? elv[elv.length - 1][1] : "";
      for (const tgl of Object.keys(seri).sort()) {
        const h = hitung(r, seri[tgl]);
        lines.push(
          [
            tgl,
            r.sta,
            r.name,
            Number(r.tip).toFixed(2),
            Number(r.top).toFixed(2),
            r.gamma,
            Number(seri[tgl]).toFixed(3),
            Number(r.izin).toFixed(2),
            h.ru === null ? "" : h.ru.toFixed(4),
            h.status,
            elvVal,
          ].join(";"),
        );
      }
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="piezometer-ciawi.csv"',
    );
    res.status(200).send(lines.join("\n"));
    return;
  }

  // ---------- POST: validasi satu pembacaan ----------
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
    } catch {
      body = {};
    }

    const key = String(body.key || q.key || "");
    const name = String(body.name || q.name || "");
    const press = Number(body.press ?? q.press);
    const date = String(body.date || q.date || hariIni());

    if (!process.env.CCTV_UPLOAD_KEY || key !== process.env.CCTV_UPLOAD_KEY) {
      res.status(403).json({ error: "kunci salah" });
      return;
    }
    const row = alat.find((r) => r.name === name);
    if (!row) {
      res.status(404).json({ error: "nama instrumen tidak dikenal" });
      return;
    }
    if (!isFinite(press) || press < 0 || press > 200) {
      res.status(400).json({ error: "press tidak valid" });
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ error: "tanggal harus YYYY-MM-DD" });
      return;
    }

    const h = hitung(row, press);
    res.json({
      ok: true,
      name,
      date,
      press,
      ru: h.ru,
      status: h.status,
      catatan:
        "Vercel serverless tidak menyimpan; masukkan lewat modul offline.",
    });
    return;
  }

  // ---------- GET: satu seri untuk grafik ----------
    // Kontrak pz-panel.js (WAJIB DIPERHATIKAN):
    //   seri    : [{ name, jumlah, titik:[[tanggal, press, elevasi, ru], ...] }]
    //   timbunan: [{ kode, titik:[[tanggal, elevasi], ...] }]
    // Parameter: ?seri=1&sta=<sta>&dari=<YYYY-MM-DD>
    // Versi lama (yang hanya bisa mengembalikan satu nilai) tidak cocok dengan
    // bentuk ini sehingga gambarSemua() gagal dan grafik tetap kosong.
    if (q.seri !== undefined) {
      const sta = String(q.sta ?? "");
      const dari = String(q.dari ?? "");
      const setelahDari = (t) => !dari || !/^\d{4}-\d{2}-\d{2}$/.test(dari) || t >= dari;

      // --- tiap instrumen yang punya histori jadi satu seri ---
      const seri = alat
        .filter((r) => H[r.name])
        .map((r) => {
          const s = H[r.name];
          const tgl = Object.keys(s).filter(setelahDari).sort();
                    const timb = timbInstrumen[r.name];
          const elvOf = (t) => {
            if (!timb || !timb.length) return null;
            // timbunan di stepwise: ambil nilai terakhir yang <= tanggal ini
            let v = null;
            for (const [td, val] of timb) {
              if (td <= t) v = val;
              else break;
            }
            return v;
          };
          const titik = tgl.map((t) => {
            const h = hitung(r, s[t]);
            return [t, s[t], elvOf(t), h.ru];
          });
          const akhir = titik.length ? titik[titik.length - 1] : null;
          const h = hitung(r, akhir ? akhir[1] : r.press);
          return {
            name: r.name,
            sta: r.sta,
            tip: r.tip,
            top: r.top,
            gamma: r.gamma,
            izin: r.izin,
            jumlah: titik.length,
            tanggalAwal: titik.length ? titik[0][0] : null,
            tanggalAkhir: akhir ? akhir[0] : null,
            press: akhir ? akhir[1] : r.press,
            ru: h.ru,
            status: h.status,
            ket: r.ket || null,
            titik,
          };
        })
        .filter((s) => s.jumlah > 0);

      if (!seri.length) {
        res.status(404).json({ error: "tidak ada instrumen dengan histori" });
        return;
      }

      // --- grup timbunan untuk garis elevasi (dipakai saat metrik = elevasi) ---
          // Kunci piezo-arsip.seri bercampur: sebagian "KODE@sta@..." (titik
          // elevasi timbunan) dan sebagian nama instrumen mentah. Hanya kunci yang
          // mengandung "@" yang benar-benar grup timbunan.
          const grupTimb = {};
          for (const [k, v] of Object.entries(seriTimb)) {
            if (!Array.isArray(v) || !k.includes("@")) continue;
            const kode = String(k).split("@")[0];
            const t = v.filter((p) => Array.isArray(p) && setelahDari(p[0]));
            if (!t.length) continue;
            (grupTimb[kode] = grupTimb[kode] || []).push(...t);
          }
      const timbunan = Object.entries(grupTimb).map(([kode, t]) => {
        const seen = new Map();
        for (const [td, val] of t) seen.set(td, val); // dedup per tanggal
        return { kode, titik: [...seen.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1) };
      });

      res.status(200).json({
        seri,
        timbunan,
        meta: {
          instrumen: seri.length,
          titik: seri.reduce((n, s) => n + s.jumlah, 0),
          rentangDari: dari || null,
          sta: sta || "(semua)",
        },
      });
      return;
    }

    // ---------- GET: rekap ----------
    if (q.rekap !== undefined) {
      res.status(200).json({
        rekap: alat.map((r) => {
          const s = H[r.name] || {};
          const tgl = Object.keys(s).sort();
          const terakhir = tgl.length ? tgl[tgl.length - 1] : null;
          const h = hitung(r, terakhir ? s[terakhir] : r.press);
          return {
            name: r.name, sta: r.sta, izin: r.izin,
            press: terakhir ? s[terakhir] : r.press,
            tanggal: terakhir || "", ru: h.ru, status: h.status,
            jumlah: tgl.length,
          };
        }),
        sesuai: master.generated || null,
      });
      return;
    }

    // ---------- GET: data lengkap ----------
  const semuaTanggal = new Set();
  let totalPembacaan = 0;
  for (const s of Object.values(H)) {
    if (!s || typeof s !== "object") continue;
    for (const t of Object.keys(s)) {
      semuaTanggal.add(t);
      totalPembacaan++;
    }
  }
  const daftarTanggal = [...semuaTanggal].sort();

  const data = alat.map((r) => {
    const seri = H[r.name] || {};
    const tgl = Object.keys(seri).sort();
    const terakhir = tgl.length ? tgl[tgl.length - 1] : null;
    const press = terakhir ? seri[terakhir] : r.press;
    const h = hitung(r, press);
    const timb = seriTimb[r.name];

    return {
      sta: r.sta,
      name: r.name,
      tip: r.tip,
      top: r.top,
      gamma: r.gamma,
      izin: r.izin,
      press,
      tanggal: terakhir || "",
      ru: h.ru,
      status: h.status,
      ket: r.ket || null,
      jumlah: tgl.length,
      tanggalAwal: tgl.length ? tgl[0] : null,
      tanggalAkhir: terakhir,
      elevation: timb && timb.length ? timb[timb.length - 1][1] : null,
      seri: tgl.map((t) => [t, seri[t]]),
      topSerie: Array.isArray(r.topSerie) ? r.topSerie : null,
    };
  });

  res.status(200).json({
    terakhir: hariIni(),
    sesuai: master.generated || null,
    daftarTanggal,
    data,
    meta: {
      instrumen: alat.length,
      denganHistori: Object.keys(H).length,
      totalPembacaan,
      rentang: daftarTanggal.length
        ? [daftarTanggal[0], daftarTanggal[daftarTanggal.length - 1]]
        : null,
      sumber: master.sumber || null,
    },
    hujan: arsip && Array.isArray(arsip.hujan) ? arsip.hujan : [],
    dibuang: excluded
      ? { jumlah: excluded.jumlah, contoh: (excluded.baris || []).slice(0, 20) }
      : { jumlah: 0, contoh: [] },
  });
}