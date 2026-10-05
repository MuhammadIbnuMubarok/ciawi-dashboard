// Konversi data RTS lokal (duplikat dari folder UPB-DASHBOARD) menjadi
// bentuk yang Consumption 'rts-panel.js' dan '_handlers/rts.js' pakai.
//
// File lokal memakai bentuk sederhana:
//   rts-latest.json  : { rows:[{no,nama,base,x,y,z,dx,dy,dz,linier}], sumber, waktu }
//   rts-snapshot.json: [ {prisma,nama,nilai,header,waktu} ]
//
// Bentuk yang dibutuhkan portal:
//   { statusRts, power, battery, humidity, temperature, statusLogger,
//     statusSd, tanggal, rows:[{id,nama,waktu,x0,y0,z0,x1,y1,z1,dx,dy,dz,lin,arah,ok}] }
//
// Data ini BUKAN live. Panel harus menandainya "CACHE" - rts-panel.js sudah
// melakukan itu dari field `live`. Nilai status logger TIDAK boleh dikarang
// karena portal tidak menyediakannya di file lokal; dikosongkan agar UI
// menampilkan "-" (= tidak tersedia) alih-alih angka palsu.

import LATEST from "../data/rts-latest.json" with { type: "json" };

// Jarak acuan antar-prisma untuk arah (azimuth) dan kelurusan. Dua koordinat
// X,Y adalah koordinat absolut desimeter, bukan nilai deformasi - DX/DY/DZ
// pada file lokal itulah bagian yang bermakna.
function hitungArah(dx, dy) {
  if (dx == null && dy == null) return null;
  const a = (Math.atan2(Number(dx || 0), Number(dy || 0)) * 180) / Math.PI;
  return (a + 360) % 360;
}

function keRows(latest, snap) {
  // snap sengaja kosong: kolom nilainya adalah koordinat Y, bukan Z.
  const snapMap = new Map();
  snap.forEach((s) => {
    snapMap.set(String(s.prisma), { nilai: s.nilai, waktu: s.waktu });
  });

  return (latest.rows || []).map((r) => {
    const id = "P" + r.no;
    const s = snapMap.get(id) || {};
    const zAwal = r.z == null ? null : Number(r.z);
    // CATATAN PENTING: rts-snapshot.json kolom 'nilai' berisi KOORDINAT Y
    // (terbukti identik dengan latest.y), BUKAN elevasi hasil pembacaan.
    // Versi pertama keliru memakainya sebagai Z sehingga P1 (prisma acuan)
    // melaporkan dz = 9.263.308 m. Snapshot karena itu tidak dipakai lagi
    // untuk menghitung Z; hanya waktu reader-nya yang diambil.
    const zHasil = null;
    const dz = r.dz != null ? Number(r.dz) : null;
    const lin = r.linier != null ? Math.abs(Number(r.linier)) / 1000 : (dz != null ? Math.abs(dz) : null);
    return {
      id,
      nama: r.nama,
      waktu: s.waktu || latest.waktu || null,
      x0: r.x == null ? null : Number(r.x),
      y0: r.y == null ? null : Number(r.y),
      z0: zAwal,
      x1: r.x == null ? null : Number(r.x),
      y1: r.y == null ? null : Number(r.y),
      z1: zHasil,
      dx: r.dx != null ? Number(r.dx) : null,
      dy: r.dy != null ? Number(r.dy) : null,
      dz,
      lin,
      arah: hitungArah(r.dx, r.dy),
      // Tandai hanya bila ada DX/DY/DZ terekam - bukan-butang-asumsikan valid.
      ok: r.dx != null || r.dy != null || r.dz != null,
    };
  });
}

export function rtsDariBerkas() {
  const rows = keRows(LATEST, []);
  return {
    statusRts: null, // tidak tersedia di arsip lokal - UI tampilkan "-"
    power: null,
    battery: null,
    humidity: null,
    temperature: null,
    statusLogger: null,
    statusSd: null,
    tanggal: LATEST.waktu ? String(LATEST.waktu).slice(0, 10) : null,
    sumber: LATEST.sumber || null,
    rows,
  };
}

export default rtsDariBerkas;