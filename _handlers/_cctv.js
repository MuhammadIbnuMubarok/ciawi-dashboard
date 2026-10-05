// _handlers/_cctv.js - ambil snapshot CCTV dari SINBAD (go2rtc snapshot API)
//
// Sumber: https://sinbad.sda.pu.go.id/cctv-stream/api/frame.jpeg?src=<stream>
//
// Ini endpoint go2rtc yang mengekspos RTSP kamera sebagai JPEG per frame.
// Karena SINBAD adalah server PUBLIK, Cloudflare bisa mengambil foto
// langsung tanpa perlu laptop berada di jaringan internal kantor - berbeda
// dengan kamera NVR 192.168.2.x yang hanya bisa dijangkau dari dalam.
//
// Nama stream yang tersedia (terverifikasi mengembalikan JPEG):
//   CiawiInlet, CiawiMaindam, CiawiOutlet, CiawiPOutlet
//   SukamahiInlet, SukamahiMaindam, SukamahiOutlet, SukamahiPOutlet

const BASE = "https://sinbad.sda.pu.go.id/cctv-stream/api/frame.jpeg";

// nama stream SINBAD -> kunci yang dipakai modul lain
export const STREAM_MAP = {
  inlet: "CiawiInlet",
  outlet: "CiawiOutlet",
  maindam: "CiawiMaindam",
  poutlet: "CiawiPOutlet",
  skinlet: "SukamahiInlet",
  skoutlet: "SukamahiOutlet",
  skmaindam: "SukamahiMaindam",
  skpoutlet: "SukamahiPOutlet",
};

export const LABEL = {
  CiawiInlet: "Ciawi - Inlet",
  CiawiMaindam: "Ciawi - Bendungan Utama",
  CiawiOutlet: "Ciawi - Outlet",
  CiawiPOutlet: "Ciawi - Pintu Pengatur",
  SukamahiInlet: "Sukamahi - Inlet",
  SukamahiMaindam: "Sukamahi - Bendungan Utama",
  SukamahiOutlet: "Sukamahi - Outlet",
  SukamahiPOutlet: "Sukamahi - Pintu Pengatur",
};

/**
 * Ambil satu frame JPEG dari stream SINBAD.
 * @param {string} stream nama stream, mis. "CiawiInlet"
 * @returns {Promise<{ok:boolean, bytes:Uint8Array|null, status:number, label:string}>}
 */
export async function ambilFrame(stream, timeoutMs = 20000) {
  const label = LABEL[stream] || stream;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(`${BASE}?src=${encodeURIComponent(stream)}`, {
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ciawi-cctv",
        accept: "image/jpeg,image/*;q=0.8",
      },
      cache: "no-store",
      signal: ctrl.signal,
    });
    if (!r.ok) return { ok: false, bytes: null, status: r.status, label };

    const ct = (r.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("jpeg") && !ct.includes("image")) {
      return { ok: false, bytes: null, status: r.status, label };
    }

    const buf = new Uint8Array(await r.arrayBuffer());
    // snapshot go2rtc yang kosong biasanya < 5 KB ( gambar hitam )
    if (!buf || buf.length < 5000) {
      return { ok: false, bytes: null, status: r.status, label, note: "frame kosong" };
    }
    return { ok: true, bytes: buf, status: r.status, label };
  } catch (e) {
    return {
      ok: false,
      bytes: null,
      status: 0,
      label,
      note: e && e.message ? e.message : String(e),
    };
  } finally {
    clearTimeout(t);
  }
}

/**
 * Ambil beberapa kamera sekaligus (dengan batas concurrency sederhana).
 * @param {string[]} streams daftar nama stream
 */
export async function ambilSemua(streams) {
  const hasil = [];
  for (const s of streams) {
    hasil.push({ stream: s, ...(await ambilFrame(s)) });
  }
  return hasil;
}

export default { STREAM_MAP, LABEL, ambilFrame, ambilSemua, BASE };