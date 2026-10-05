# PANDUAN PIEZOMETER — Dashboard Ciawi

Modul piezometer untuk `D:\ciawi-dashboard`. Tim operasional cukup mengisi pembacaan
harian dari aplikasi; grafik dan rekap ikut terbarui sendiri.

---

## 1. APA YANG BARU

| Berkas | Status | Keterangan |
|---|---|---|
| `data/piezo-master.json` | **baru** | 31 alat + koefisien A/B/R0, `topSerie`, `izinSerie`, `topGrup` |
| `data/piezo-timbunan.json` | **baru** | 5 kelompok elevasi timbunan + seluruh riwayatnya |
| `data/piezo-history.json` | **baru** | 32.034 pembacaan nyata 2020-10-01 s/d 2025-12-29 |
| `data/piezo-harian.json` | **baru** | garis puncak timbunan per STA (cadangan) |
| `data/piezo-excluded.json` | **baru** | 912 baris yang dibuang + alasannya (transparansi) |
| `api/piezometer.js` | **diganti v4** | tetap kompatibel v2/v3 + endpoint timbunan |
| `pz-panel.js` | **diganti v3** | form pembacaan + form timbunan, grafik, rekap |
| `tools/dev-server.js` | **baru** | jalankan dashboard + API di komputer lokal |
| `tools/import-piezo.js` | **baru** | dorong riwayat ke Vercel Blob (sekali jalan) |

Berkas lain **tidak disentuh**. `index.html` tidak perlu diubah — `pz-panel.js` sudah
dipanggil di baris 195, jadi tab Piezometer langsung memakai panel baru.

---

## 2. CARA PAKAI SEHARI-HARI (tim operasional)

1. Buka dashboard, tarik tuas di Ruang Kontrol.
2. Klik tab **Piezometer**.
3. Isi form **Input Pembacaan Harian**:
   - **Tanggal** — default hari ini
   - **Instrumen** — pilih PPU1, PPD2, dan seterusnya
   - **Cara isi** — pilih salah satu:
     - **R1 (angka alat)** — ketik angka yang terbaca di layar alat. Aplikasi hitung
       sendiri `E = A x R1² + B x R1 + C`, lalu `mH2O = E x 0,1022`, lalu Elevasi, Ru, Status.
     - **Tekanan (m)** — ketik langsung tekanan air pori dalam meter.
   - **Nilai**, lalu **Kunci** (sekali saja; berikutnya tersimpan otomatis di browser)
4. Tekan **SIMPAN**. Muncul konfirmasi berisi hasil hitungan dan status AMAN / HATI-HATI.

Tiga tab di bawahnya:

- **STATUS** — kartu + tabel kondisi semua alat, bisa dilihat per tanggal atau per riwayat.
- **GRAFIK** — grafik gabungan per STA (semua alat dalam satu grafik, bisa pilih
  Tekanan / Elevasi / Ru, rentang 3 bulan / 1 tahun / semua) dan tren Ru per alat.
- **REKAP BULANAN** — min, maks, rata-rata, Ru maksimum, dan jumlah pembacaan per alat.

Tombol **UNDUH CSV** mengunduh seluruh riwayat dalam format siap Excel.

---

## 2b. ELEVASI TIMBUNAN (Elv. Timbunan)

Elevasi timbunan dipakai menghitung `Ru`. Workbook Anda punya **5 seri berbeda**, dan
tiap seri dipakai kelompok alat yang berbeda:

| Kode | STA | Dipakai oleh | Nilai terakhir (dari workbook) |
|---|---|---|---|
| `CP` | 0+310 | PPU1 s/d PTD9 (13 alat) | 551,367 m (2023-09-13) |
| `DU` | 0+310 | PTU10 s/d PTU13 (4 alat) | 536,000 m (2021-11-24) |
| `EL` | 0+310 | PTD21 dan PTD22 (2 alat) | 542,500 m (2022-05-16) |
| `BN` | 0+377.5 | PPU5 s/d PTD20 (9 alat) | 551,032 m (2023-07-14) |
| `CF` | 0+377.5 | PTU14 dan PTU15 (2 alat) | 535,500 m (2021-11-22) |

**Cara mengisi:** form **INPUT ELEVASI TIMBUNAN** → pilih Tanggal, Kelompok, isi
Elevasi (m), Kunci, lalu SIMPAN. Isian ini **menimpa** nilai workbook sejak tanggal
yang Anda pilih, dan otomatis dipakai semua alat dalam kelompok itu.

**Penting soal tanggal.** `Ru` dihitung memakai elevasi timbunan **pada tanggal
pembacaan** — sama seperti workbook (`Interpretasi Grafik` membaca ELEVASI TOP dari
baris tanggal yang sama). Jadi kalau Anda menaikkan timbunan tetapi tidak ada
pembacaan baru setelahnya, `Ru` pembacaan lama **tidak berubah**. Isilah elevasi
timbunan dan pembacaan alat pada tanggal yang sama supaya keduanya sejalan.

Di tab **GRAFIK** ada kartu **ELEVASI TIMBUNAN PER KELOMPOK**: tabel 5 kelompok
(lengkap dengan kolom Sumber: `workbook` atau `isian aplikasi`) dan grafik seluruh
riwayat timbunan per STA. Grafik ini **selalu menampilkan riwayat penuh**, tidak ikut
filter rentang, karena elevasi timbunan bergerak lambat.

Di tab **STATUS**, tiap kartu alat menampilkan baris `Elv. timbunan` beserta kode
kelompoknya, dan tabel kondisi memakai kolom **Elv. Timbunan** (dulu berlabel "Top").

---

## 3. MENJALANKAN DI KOMPUTER LOKAL

Dashboard bisa dipakai penuh tanpa internet:

```bat
node tools/dev-server.js
```

lalu buka `http://localhost:8090`.

- `server.ps1` yang lama hanya menyajikan berkas statis — API tidak jalan, jadi form
  tidak bisa menyimpan. `tools/dev-server.js` menjalankan folder `api/` juga.
- Tanpa `BLOB_READ_WRITE_TOKEN`, isian baru disimpan ke `data/piezo-local.json`.
- Set kunci isi supaya form bisa menyimpan:

```bat
set CCTV_UPLOAD_KEY=kuncirahasiaanda
node tools/dev-server.js
```

Tautan langsung ke panel: `http://localhost:8090/#piezometer`

---

## 4. MENDORONG RIWAYAT KE VERCEL BLOB

Riwayat historis **sudah** tersedia sebagai berkas statis, jadi grafik langsung jalan
setelah deploy. Langkah ini opsional, untuk memenuhi pilihan "keduanya":

```bat
node tools/import-piezo.js --dry-run     :: lihat rencana dulu
vercel env pull .env.local               :: ambil BLOB_READ_WRITE_TOKEN
node tools/import-piezo.js               :: jalankan impor
node tools/import-piezo.js --gabung      :: kalau sudah ada isian baru yang mau dijaga
```

Sesudah impor, panel akan menampilkan `simpan: blob` (sebelumnya `simpan: lokal`).

---

## 5. CARA KERJA PERHITUNGAN

Rumusnya **sama persis dengan workbook Excel** dan sudah diuji cocok untuk seluruh alat:

```
C      = -(A x R0² + B x R0)
E(kPa) = A x R1² + B x R1 + C
mH2O   = E x 0,1022
Elevasi air pori = tip + mH2O
Overburden       = (top(tanggal) - tip) x gamma
Ru               = mH2O / overburden
Status           = "AMAN" bila (tip + mH2O) < izin(tanggal), selain itu "HATI-HATI"
```

**Penting — `top` dan `izin` berubah menurut tanggal.** Selama pembangunan, elevasi
timbunan naik dari ±494 m (2020) ke ±542 m (2025). Karena itu aplikasi menyimpan
`topSerie` dan `izinSerie` per alat sebagai seri tangga, bukan satu angka tetap.
Kalau memakai angka tetap, alat akan selalu tampak "AMAN" padahal dulu ambangnya jauh
lebih rendah.

`gamma` juga **per alat** dan tidak seragam: 1,757 / 1,78 / 1,818. Versi lama
`MASTER_PIEZO` memakai 1,757 untuk semua, sehingga Ru beberapa alat berbeda dari Excel.
Contoh setelah diperbaiki (data 2025-10-30, cocok dengan sheet `Interpretasi Grafik`):

| Alat | gamma | Ru aplikasi | Ru Excel |
|---|---|---|---|
| PPU1 | 1,757 | 0,1920 | 0,1920 |
| PTD4 | 1,78 | 0,1544 | 0,1544 |
| PTU10 | 1,78 | 0,2583 | 0,2583 |
| PTU13 | 1,818 | 0,2958 | 0,2958 |
| PTU14 | 1,818 | 0,2640 | 0,2639 |

---

## 6. CATATAN DATA

- Nama **`PPA6`** dipakai dashboard untuk alat yang di sheet tertulis **`PPD6`**
  (kolom L sheet `STA 0+377.5`). Nama asli disimpan di kolom `namaSheet`.
- **912 pembacaan dibuang** saat impor, tercatat lengkap di `data/piezo-excluded.json`:
  - **907 baris** dengan sel R1 kosong. Rumusnya tetap menghitung memakai R1 = 0,
    sehingga menghasilkan `E = C` — angka tetap yang bukan hasil pengukuran.
  - **5 baris** di luar batas wajar: PTD21 2025-12-15/22/29 (602 m), PTD21 2024-02-10
    (77 m), PPU7 2022-10-11 (98,8 m).
  - Nilai **negatif kecil tetap dipakai** (mis. -0,1 m) karena wajar sebagai hisapan air pori.
- **OSP** ada di master tetapi belum punya kolom data mentah di workbook, jadi belum
  ada riwayatnya. Bisa diisi lewat form mulai sekarang.
- Tanggal acuan grafik memakai **pembacaan terakhir** (2025-12-29), bukan tanggal hari ini.

---

## 7. DEPLOY

```bat
vercel --prod
```

Tidak ada variabel lingkungan baru yang wajib. Kalau ingin memakai Blob, pastikan
`BLOB_READ_WRITE_TOKEN` sudah ada di pengaturan Environment Variables Vercel.

---

## 8. PERINTAH UJI

```bat
node --check pz-panel.js
node --check api/piezometer.js
node tools/import-piezo.js --dry-run
```
