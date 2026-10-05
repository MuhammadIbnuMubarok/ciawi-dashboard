# Dashboard Bendungan Ciawi

## Menjalankan dashboard lokal

Jalankan `JALANKAN-SERVER.bat` atau `npx vercel dev --listen 3000`, lalu buka
`http://localhost:3000`. Jangan membuka `index.html` langsung sebagai `file://`:
endpoint API dan pembaruan TMA tidak tersedia dalam mode tersebut.

## Konfigurasi layanan

Salin `.env.example` menjadi `.env.local` dan isi variabel yang dibutuhkan.
`FLEET_URL` wajib menunjuk ke sumber telemetri JSON yang dipercaya dan memuat
stasiun inlet/outlet Ciawi. Jangan gunakan endpoint HTML atau memasukkan rahasia
ke dalam kode. Untuk deployment, atur variabel yang sama melalui pengaturan
environment hosting.

Riwayat server memerlukan `BLOB_READ_WRITE_TOKEN`. Perekam riwayat dipicu oleh
workflow GitHub Actions `record.yml`; workflow sekarang menandai respons API
yang gagal sebagai gagal, bukan sukses semu.
