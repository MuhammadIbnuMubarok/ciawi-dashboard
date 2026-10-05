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

import fs from "node:fs";
import path from "node:path";

const DATA = path.join(process.cwd(), "data");

function baca(nama) {
  try {
    const p = path.join(DATA, nama);
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    return null;
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

  const master = baca("piezo-master.json");
  const history = baca("piezo-history.json");
  const arsip = baca("piezo-arsip.json");
  const excluded = baca("piezo-excluded.json");

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
  // Parameter dari pz-panel.js: ?seri=1&sta=<sta>&dari=<YYYY-MM-DD>
  // Mengembalikan { nama, sta, seri: [[tanggal, nilai], ...], ... } untuk
  // instruments yang benar-benar punya histori, sehingga grafik punya titik.
  if (q.seri !== undefined) {
    const sta = String(q.sta ?? "");
    const dari = String(q.dari ?? "");
    let idx = alat.findIndex((r) => r.sta === sta && H[r.name]);
    if (idx < 0) idx = alat.findIndex((r) => H[r.name]);
    if (idx < 0) {
      res.status(404).json({ error: "tidak ada instrumen dengan histori" });
      return;
    }

    const r = alat[idx];
    const seri = H[r.name] || {};
    let tgl = Object.keys(seri).sort();
    if (dari && /^\d{4}-\d{2}-\d{2}$/.test(dari)) {
      tgl = tgl.filter((t) => t >= dari);
    }
    const pts = tgl.map((t) => [t, seri[t]]);
    const akhir = pts.length ? pts[pts.length - 1] : null;
    const h = hitung(r, akhir ? akhir[1] : r.press);

    res.status(200).json({
      nama: r.name,
      sta: r.sta,
      dari: tgl.length ? tgl[0] : null,
      sampai: akhir ? akhir[0] : null,
      titik: pts.length,
      seri: pts,
      tip: r.tip,
      top: r.top,
      gamma: r.gamma,
      izin: r.izin,
      press: akhir ? akhir[1] : r.press,
      ru: h.ru,
      status: h.status,
      topSerie: Array.isArray(r.topSerie) ? r.topSerie : null,
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