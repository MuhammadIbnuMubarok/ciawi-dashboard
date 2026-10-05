// api/fleet.js - TMA real-time Bendungan Ciawi
//
// PERBAIKAN 2026-10-05. Sebelumnya handler ini proxy ke FLEET_URL, yang di
// environment Vercel berisi placeholder (bukan URL) sehingga selalu
// "fetch failed" -> TMA tidak pernah tampil. Sekarang scraping langsung dari
// sumber resmi Ciawi yang juga dipakai UPB-DASHBOARD:
//
//   https://sdatelemetry.com/fmsciawi/
//
// Output sengaja dipertahankan kompatibel dengan parseFleet() di
// js/live-service.js: { telemetryjakarta: [...] } dengan WLevel dalam
// CENTIMETER (parser frontend melakukan WLevel/100 -> meter).
//
// Catatan: HTML sumber menyebut kolom TMA dalam "cm" padahal nilainya sudah
// dalam meter (mis. 1.46 = 1,46 m). Karena itu dikonversi ke cm di sini agar
// pembagian 100 di frontend menghasilkan meter yang benar.

const UPSTREAM = "https://sdatelemetry.com/fmsciawi/";
const M_KE_CM = 100;

function teks(h) {
  return h
    .replace(/<!--[\s\S]*?-->/g, "") // buang komentar (ada kolom lama di dalamnya)
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

// Satu baris tabel: sel pertama <a href="...location=xxx">LOKASI</a>,
// lalu JAM, TMA, DEBIT.
function parseBaris(tr) {
  const link = /location=([a-z0-9_-]+)/i.exec(tr);
  if (!link) return null;
  const lokasi = link[1].toLowerCase();

  const h = teks(tr);
  const angka = h
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s && /^-?\d+(?:[.,]\d+)?$/.test(s));

  const jam = (h.match(/\b(\d{1,2}:\d{2})\b/) || [])[1] || null;
  const tma = angka.length ? parseFloat(angka[0].replace(",", ".")) : null;
  const debit = angka.length > 1 ? parseFloat(angka[1].replace(",", ".")) : null;

  return { lokasi, jam, tma, debit };
}

function keEntri(d) {
  if (d.tma === null || !isFinite(d.tma)) return null;

  // PENTING: upstream menulis "outliteciawi" (huruf 'e' nyasar) dan juga
  // punya "awsciawi" (stak AWS, bukan bendungan). Klasifikasi harus eksplisit,
  // bukan startsWith, atau outlet terklasifikasi jadi inlet dan AWS menimpa
  // nilai inlet karena barisnyamdatang belakangan.
  const loc = d.lokasi;
  const isOutlet = /outlet|outlite/.test(loc);
  const isInlet = /inlet/.test(loc);
  if (!isOutlet && !isInlet) return null; // buang awsciawi & lainnya

  return {
    // Bentuk nama HARUS memuat "outlet"/"inlet" DAN "ciawi": parseFleet() di
    // live-service.js mencocokkan dengan
    //   name.includes('outlet') && name.includes('ciawi')
    // milik "outliteciawi" tidak mengandung substring "ciawi", jadi outlet
    // tidak akan pernah dikenali sebagai OUTLET.
    nama_alaat: isOutlet ? "OUTLET BENDUNGAN CIAWI" : "INLET BENDUNGAN CIAWI",
    nama_lokasi: loc,
    WLevel: d.tma * M_KE_CM, // frontend membagi 100 -> meter
    debit: d.debit === null ? "" : d.debit,
    ReceivedTime: d.jam || null,
    ReceivedDate: "",
    status: "live",
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");

  let doc;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    const up = await fetch(UPSTREAM, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ciawi-dashboard",
        accept: "text/html,application/xhtml+xml",
      },
      cache: "no-store",
      signal: ctrl.signal,
    }).finally(() => clearTimeout(timer));

    if (!up.ok) {
      res.status(502).json({ error: "upstream HTTP " + up.status });
      return;
    }
    doc = await up.arrayBuffer();
  } catch (e) {
    res.status(502).json({
      error: "upstream gagal: " + (e && e.message ? e.message : String(e)),
    });
    return;
  }

  const src = Buffer.from(doc).toString("utf8");
  const telemetryjakarta = [];

  for (const m of src.matchAll(/<tr[\s\S]*?<\/tr>/gi)) {
    const d = parseBaris(m[0]);
    if (!d || !d.lokasi.includes("ciawi")) continue; // hanya Ciawi
    const e = keEntri(d);
    if (e) telemetryjakarta.push(e);
  }

  if (!telemetryjakarta.length) {
    res.status(502).json({
      error: "tidak ada baris Ciawi di sumber",
      tanggal: (src.match(/dt=(\d{4}-\d{2}-\d{2})/) || [])[1] || null,
    });
    return;
  }

  res.status(200).json({
    telemetryjakarta,
    sumber: UPSTREAM,
    tanggal: (src.match(/dt=(\d{4}-\d{2}-\d{2})/) || [])[1] || null,
    catatan: "TMA sumber sudah dalam meter; dikonversi ke cm agar frontend (/100) benar.",
  });
}