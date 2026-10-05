#!/usr/bin/env node
/**
 * tools/import-piezo.js - dorong riwayat historis ke Vercel Blob (sekali jalan).
 *
 * Riwayat 2020-2025 sudah tersedia sebagai data/piezo-history.json (statis), jadi
 * dashboard SUDAH bisa menampilkan grafik tanpa langkah ini. Skrip ini menyalinnya
 * ke Blob supaya Vercel juga menyimpannya (sesuai pilihan "keduanya").
 *
 * Pakai:
 *   node tools/import-piezo.js --dry-run          (lihat rencana, tidak menulis)
 *   set BLOB_READ_WRITE_TOKEN=xxx && node tools/import-piezo.js
 *   node tools/import-piezo.js --gabung           (gabung dengan isian yang sudah ada)
 *
 * Tanpa BLOB_READ_WRITE_TOKEN, skrip berhenti dan memberi tahu cara mengambilnya.
 */
const fs = require("fs");
const path = require("path");

const DRY = process.argv.includes("--dry-run");
const GABUNG = process.argv.includes("--gabung");
const STORE = "piezo/records.json";
const ROOT = path.resolve(__dirname, "..");

let blob = null;
const TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

if (!DRY && !TOKEN) {
  console.error("X BLOB_READ_WRITE_TOKEN belum diset.\n");
  console.error("  Ambil dari Vercel: Project > Settings > Environment Variables,");
  console.error("  atau jalankan `vercel env pull .env.local` di folder ini.\n");
  console.error("  Sementara itu dashboard TETAP jalan memakai data/piezo-history.json.");
  process.exit(1);
}

// paket @vercel/blob hanya perlu saat benar-benar menulis, jadi --dry-run tetap bisa dijalankan
if (!DRY) {
  try { blob = require("@vercel/blob"); } catch (e) {
    console.error("X paket @vercel/blob tidak ada. Jalankan: npm install");
    process.exit(1);
  }
}

const histPath = path.join(ROOT, "data", "piezo-history.json");
const masterPath = path.join(ROOT, "data", "piezo-master.json");
if (!fs.existsSync(histPath)) { console.error("X tidak ada " + histPath); process.exit(1); }

const hist = JSON.parse(fs.readFileSync(histPath, "utf8"));
const master = JSON.parse(fs.readFileSync(masterPath, "utf8"));
const nama = new Set(master.alat.map(function (a) { return a.name; }));

const bersih = {};
let dibuang = 0, total = 0;
Object.keys(hist).sort().forEach(function (n) {
  if (!nama.has(n)) { dibuang += Object.keys(hist[n]).length; return; }
  bersih[n] = {};
  Object.keys(hist[n]).sort().forEach(function (d) {
    const v = hist[n][d];
    if (typeof v !== "number" || !isFinite(v) || v > 60 || v < -5) { dibuang++; return; }
    bersih[n][d] = v; total++;
  });
});

(async function () {
  console.log("================================================================");
  console.log("  IMPOR RIWAYAT PIEZOMETER KE VERCEL BLOB");
  console.log("================================================================");
  console.log("  alat            : " + Object.keys(bersih).length);
  console.log("  pembacaan       : " + total.toLocaleString("id-ID"));
  console.log("  dibuang         : " + dibuang.toLocaleString("id-ID"));
  const ukuran = Buffer.byteLength(JSON.stringify(bersih));
  console.log("  ukuran payload  : " + (ukuran / 1024).toFixed(1) + " KB");
  console.log("  tujuan          : " + STORE);
  console.log("  mode            : " + (DRY ? "DRY-RUN (tidak menulis)" : (GABUNG ? "GABUNG" : "TIMPA")));
  console.log("================================================================");

  if (DRY) { console.log("\nDRY-RUN selesai. Tidak ada yang ditulis."); return; }

  let akhir = bersih;
  if (GABUNG) {
    try {
      const b = await blob.get(STORE, { access: "private", token: TOKEN });
      const ada = JSON.parse(await new Response(b.stream).text());
      let n = 0;
      Object.keys(ada).forEach(function (nm) {
        akhir[nm] = akhir[nm] || {};
        Object.keys(ada[nm]).forEach(function (d) {
          if (akhir[nm][d] === undefined) { akhir[nm][d] = ada[nm][d]; n++; }
        });
      });
      console.log("\n  isian yang sudah ada dan dipertahankan: " + n.toLocaleString("id-ID"));
    } catch (e) {
      console.log("\n  (belum ada data lama di Blob, lanjut timpa)");
    }
  }

  process.stdout.write("\n  mengunggah... ");
  const res = await blob.put(STORE, JSON.stringify(akhir), {
    contentType: "application/json", access: "private", allowOverwrite: true
  });
  console.log("selesai");
  console.log("  url    : " + (res && res.url ? res.url : "-"));
  console.log("  jumlah : " + Object.keys(akhir).length + " alat");
  console.log("\nSelesai. Buka dashboard di Vercel dan cek tab Piezometer.");
})().catch(function (e) {
  console.error("\nX gagal: " + e.message);
  process.exit(1);
});
