# MULAI DI VS CODE — 3 LANGKAH

## Cara tercepat (dobel-klik)

Buka folder `D:\ciawi-dashboard` di File Explorer, lalu **dobel-klik
`JALANKAN-PIEZOMETER.bat`**.

Browser akan terbuka sendiri di panel Piezometer. Selesai.

---

## Cara lewat PowerShell di VS Code

### 1. Buka folder aplikasi
VS Code → **File > Open Folder** → pilih `D:\ciawi-dashboard`

### 2. Buka terminal PowerShell
Menu **Terminal > New Terminal** (atau tekan `` Ctrl+` ``).
Pastikan tertulis `PowerShell` di kanan atas terminal.

### 3. Jalankan
Ketik satu per satu, tekan Enter tiap baris:

```powershell
$env:CCTV_UPLOAD_KEY = "ciawi-lokal"
```

```powershell
node tools/dev-server.js
```

Akan muncul:

```
================================================================
  DASHBOARD CIAWI - SERVER LOKAL
  http://localhost:8090
  API aktif: /api/* dijalankan dari folder api/
  Penyimpanan: lokal (data/piezo-local.json)
  Kunci isi data: diset
================================================================
```

### 4. Buka di browser
Buka **http://localhost:8090/#piezometer**

Atau lewat PowerShell:

```powershell
Start-Process "http://localhost:8090/#piezometer"
```

### 5. Pakai
1. **Tarik tuas** di layar "Ruang Kontrol Bendungan Ciawi"
2. Klik tab **Piezometer** (di sebelah "Data Teknis & Operasional")
3. Isi form:
   - Tanggal (sudah terisi hari ini)
   - Instrumen (mis. `PPU1 (STA 310)`)
   - Cara isi → **R1 (angka alat)** atau **Tekanan (m)**
   - Nilai
   - Kunci → `ciawi-lokal`
4. **SIMPAN**

### 6. Berhenti
Klik di terminal, tekan **Ctrl+C**.

---

## Masalah yang sering muncul

| Gejala | Sebab & solusi |
|---|---|
| `node : command not found` | Node belum di PATH. Pakai `JALANKAN-PIEZOMETER.bat` saja, atau jalankan `C:\Users\Hp\tools\nodejs\node.exe tools/dev-server.js` |
| `EADDRINUSE` / port 8090 dipakai | Server lama masih jalan. Tutup jendela `JALANKAN-SERVER.bat`, atau pakai port lain: `$env:PORT = "8091"` lalu `node tools/dev-server.js` |
| Panel muncul tapi form bilang "kunci salah" | `$env:CCTV_UPLOAD_KEY` belum diset di jendela terminal itu. Ulangi langkah 3. |
| Grafik kosong | Rentang diubah ke **"semua data"** — data terakhir 2025-12-29, jadi "3 bulan terakhir" dari hari ini kosong |
| Halaman tidak berubah setelah edit | Tekan **Ctrl+Shift+R** di browser |

---

## Catatan penting

- Yang jalan di komputer ini **terpisah dari Vercel**. Data yang Anda isi di lokal masuk
  ke `data/piezo-local.json`, tidak mengirim apa pun ke internet.
- Kunci lokal `ciawi-lokal` **berbeda** dari kunci produksi. Kalau ingin memakai kunci
  produksi, jalankan `vercel env pull .env.local` lalu salin nilai `CCTV_UPLOAD_KEY`.
- Riwayat 32.034 pembacaan sudah ikut, jadi grafik dan rekap langsung terisi tanpa
  perlu impor apa pun.

---

## Kalau mau langsung dipasang ke internet (Vercel)

```powershell
vercel --prod
```

Setelah selesai, buka alamat produksi Anda lalu tambahkan `#piezometer` di belakangnya.

Untuk memindahkan riwayat ke penyimpanan Vercel (opsional):

```powershell
node tools/import-piezo.js --dry-run
node tools/import-piezo.js
```
