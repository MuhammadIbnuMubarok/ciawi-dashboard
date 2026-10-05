// _handlers/telegram.js - laporan /update ke Telegram
//
// SATU perintah /update mengirim 4 foto real-time, masing-masing dengan
// keterangan TMA masing-masing:
//   1. Inlet Ciawi
//   2. Outlet Ciawi     (peucal /-Exigen Aufsatz: der Anker ist eingebettet)
//   3. Inlet Sukamahi
//   4. Outlet Sukamahi  (peucal terlihat)
//
// Semua sumber real-time dan tidak bergantung laptop / WiFi kantor:
//   TMA  -> https://sdatelemetry.com/fmsciawi/  (scraping, sudah live)
//   CCTV -> SINBAD go2rtc snapshot API (server PUBLIK)
//
// CATATAN SATUAN: kolom TMA pada sdatelemetry berlabel "cm" tetapi nilainya
// sudah dalam meter (1.46 = 1,46 m). /api/fleet menyimpan tmaMeter dalam
// meter - itu yang dipakai di sini.

import { ambilFrame } from "./_cctv.js";

const SELF = "https://" + (process.env.CF_PAGES_URL || "ciawi-scada.pages.dev");

function fmt2(x) {
  return (Math.round(Number(x) * 100) / 100).toFixed(2);
}

const m = (v) =>
  v === null || v === undefined || !isFinite(v) ? "tidak tersedia" : fmt2(v) + " m";

/**
 * TITIK ACUAN (m dpl) - angka elevasi dihitung dari TMA real-time:
 *   elevasi = titikAcuan + TMA
 * Jadi ketika TMA naik/turun, angka pada laporan otomatis ikut berubah.
 *
 * ACUAN_CIAWI: dari laporan lapangan Ciawi
 *   Inlet  505.66 - 1.46 = 504.20 ; Outlet 487.26 - 0.34 = 486.92
 * ACUAN_SUKAMAHI: dari laporan lapangan Sukamahi (diberi user 2026-10-05)
 *   Inlet  565.50 - 0.50 = 565.00 ; Outlet 545.60 - 0.20 = 545.40
 *
 * Kalau titik acuan berubah, ubah hanya di sini.
 */
const ACUAN = {
  ciawi: { inlet: 504.2, outlet: 486.92 },
  sukamahi: { inlet: 565.0, outlet: 545.4 },
};

/** hitung elevasi dari TMA real-time (meter) */
function elevasi(acuan, tma) {
  if (tma === null || tma === undefined || !isFinite(tma)) return null;
  return Number(acuan) + Number(tma);
}

/**
 * Ambil TMA real-time dari /api/fleet (yang meng-scrape sdatelemetry).
 * Mengembalikan { ciawi:{inlet,outlet}, sukamahi:{inlet,outlet} }
 */
async function ambilTma() {
  // Cloudflare memblokir fetch ke origin sendiri (403), jadi handler /api/fleet
  // dipanggil langsung dalam proses yang sama. Hasilnya identik.
  const { default: fleetHandler } = await import("./fleet.js");
  let payload = null;
  const stub = {
    _status: 200,
    status(c) {
      this._status = c;
      return this;
    },
    setHeader() {
      return this;
    },
    json(o) {
      payload = o;
      return this;
    },
    send(b) {
      payload = b;
      return this;
    },
  };
  await fleetHandler({ query: {}, method: "GET", headers: {} }, stub);
  if (stub._status !== 200 || !payload) {
    throw new Error("fleet internal HTTP " + stub._status);
  }
  const j = payload;
  const out = { ciawi: {}, sukamahi: {} };
  for (const e of j.telemetryjakarta || []) {
    const v = {
      tma: typeof e.tmaMeter === "number" ? e.tmaMeter : null,
      jam: e.ReceivedTime || "",
    };
    const dam = e.dam === "BENDUNGAN SUKAMAHI" ? out.sukamahi : out.ciawi;
    if (/INLET/.test(e.nama_alaat)) dam.inlet = v;
    else if (/OUTLET/.test(e.nama_alaat)) dam.outlet = v;
  }
  return out;
}

/**
 * Cuaca dari BMKG (sumber resmi). Bila kode wilayah tidak diisi atau endpoint
 * tidak terjangkau, ditulis "tidak tersedia" - tidak pernah dikarang.
 */
async function ambilCuaca() {
  const KODE = process.env.BMKG_ADM4 || "";
  if (!KODE) return "tidak tersedia";
  try {
    const r = await fetch(
      "https://api.bmkg.go.id/publik/prakiraan_cuaca?adm4=" + encodeURIComponent(KODE),
      { cache: "no-store" },
    );
    if (!r.ok) return "tidak tersedia";
    const j = await r.json();
    const h = j?.data?.[0];
    if (!h) return "tidak tersedia";
    return (
      (h.forecast || [])
        .slice(0, 2)
        .map((f) => `${f.ket}: ${f.weather_desc}`)
        .join(" • ") || "tidak tersedia"
    );
  } catch {
    return "tidak tersedia";
  }
}

async function kirimFoto(token, chat, bytes, nama, caption) {
  const fd = new FormData();
  fd.append("chat_id", String(chat));
  fd.append("caption", caption);
  fd.append("photo", new Blob([bytes], { type: "image/jpeg" }), nama + ".jpg");
  const r = await fetch("https://api.telegram.org/bot" + token + "/sendPhoto", {
    method: "POST",
    body: fd,
  });
  return r.json();
}

async function kirimPesan(token, chat, text) {
  const r = await fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chat,
      text,
      disable_web_page_preview: true,
    }),
  });
  return r.json();
}

export default async function handler(req, res) {
  try {
    const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const q = req.query || {};
    const CHAT_ID = q.chat || process.env.TELEGRAM_CHAT_ID;
    if (!TOKEN || !CHAT_ID) {
      res.status(500).json({ error: "token/chat belum di-env" });
      return;
    }

    const p = {};
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Jakarta",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
      .formatToParts(new Date())
      .forEach((x) => {
        p[x.type] = x.value;
      });
    const jam = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Jakarta",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date());
    const tgl = p.day + "/" + p.month + "/" + p.year;

    const [tma, cuaca] = await Promise.all([ambilTma(), ambilCuaca()]);

    const cIn = tma.ciawi.inlet?.tma ?? null;
    const cOut = tma.ciawi.outlet?.tma ?? null;
    const sIn = tma.sukamahi.inlet?.tma ?? null;
    const sOut = tma.sukamahi.outlet?.tma ?? null;

    // Elevasi dihitung dari TMA real-time: elevasi = titikAcuan + TMA.
    const cInEl = elevasi(ACUAN.ciawi.inlet, cIn);
    const cOutEl = elevasi(ACUAN.ciawi.outlet, cOut);
    const sInEl = elevasi(ACUAN.sukamahi.inlet, sIn);
    const sOutEl = elevasi(ACUAN.sukamahi.outlet, sOut);

    // "tidak tersedia" bila TMA sensor tidak terbaca (mis. null).
    const el = (v) => (v === null ? "tidak tersedia" : "+" + fmt2(v));

    // Keterangan per foto. Mengikuti format laporan lapangan:
    //   Update Bendungan Ciawi
    //   05/10/2026 pukul 15:01 WIB
    //   Status: Normal
    //   Inlet: +505.66 (tma 1.46 m)
    //   Outlet: +487.26 (tma 0.34 m)
    //   Cuaca: Mendung
    // Outlet memakai elevasi (kenaikan dari titik acuan Tailrace); Inlet
    // memakai TMA, sesuai format yang dipakai di lapangan.
    const ket = [
      {
        stream: "CiawiInlet",
        nama: "ciawi-inlet",
        cap:
          `Update Bendungan Ciawi\n` +
          `${tgl} pukul ${jam} WIB\n\n` +
          `Status: Normal\n` +
          `Inlet: ${el(cInEl)} (tma ${m(cIn)})\n` +
          `Outlet: ${el(cOutEl)} (tma ${m(cOut)})\n\n` +
          `Cuaca: ${cuaca}`,
      },
      {
        stream: "CiawiOutlet",
        nama: "ciawi-outlet",
        cap:
          `Update Bendungan Ciawi - Pintu Pengatur\n` +
          `${tgl} pukul ${jam} WIB\n\n` +
          `Status: Normal\n` +
          `Outlet: ${el(cOutEl)} (tma ${m(cOut)})\n\n` +
          `Cuaca: ${cuaca}`,
      },
      {
        stream: "SukamahiInlet",
        nama: "sukamahi-inlet",
        cap:
          `Bendungan Sukamahi ( Normal )\n` +
          `Inlet ${el(sInEl)} (tma ${m(sIn)})\n` +
          `Outlet ${el(sOutEl)} (tma ${m(sOut)})\n\n` +
          `Cuaca : ${cuaca}`,
      },
      {
        stream: "SukamahiOutlet",
        nama: "sukamahi-outlet",
        cap:
          `Bendungan Sukamahi - Pintu Pengatur ( Normal )\n` +
          `${tgl} pukul ${jam} WIB\n\n` +
          `Outlet ${el(sOutEl)} (tma ${m(sOut)})\n\n` +
          `Cuaca : ${cuaca}`,
      },
    ];

    let terkirim = 0;
    const rincian = [];

    for (const k of ket) {
      const fr = await ambilFrame(k.stream);
      rincian.push({ stream: k.stream, ok: fr.ok, byte: fr.bytes?.length || 0 });
      if (!fr.ok || !fr.bytes) {
        // kamera gagal - tetap kirim keterangan agar tidak ada slot kosong
        const j = await kirimPesan(TOKEN, CHAT_ID, k.cap);
        if (j.ok) {
          terkirim++;
          rincian[rincian.length - 1].teks = true;
        }
        continue;
      }
      const j = await kirimFoto(TOKEN, CHAT_ID, fr.bytes, k.nama, k.cap);
      if (j.ok) terkirim++;
      rincian[rincian.length - 1].telegram = j.ok ? j.result?.message_id : null;
    }

    if (terkirim === 0) {
      res.status(502).json({ error: "tidak ada foto maupun teks yang terkirim", rincian });
      return;
    }

    res.json({
      ok: true,
      terkirim,
      waktu: jam,
      cuaca,
      tma: {
        ciawi: { inlet: cIn, outlet: cOut },
        sukamahi: { inlet: sIn, outlet: sOut },
      },
      rincian,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}