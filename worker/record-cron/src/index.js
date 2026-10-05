// worker/record-cron/src/index.js
// Rekam TMA otomatis tiap jam untuk Bendungan Ciawi + Sukamahi.
//
// Dijadwalkan lewat Cloudflare Cron Triggers (lihat wrangler.toml di folder
// ini). Menulis ke Workers KV pada kunci history/<YYYY-MM-DD>.jsonl, format
// JSON Lines, satu baris per sensor per jam.
//
// Idempoten: bila baris untuk menit yang sama sudah ada, tidak ditulis lagi,
// sehingga trigger yang terpanggil dua kali tidak menghasilkan duplikat.
//
// Tidak menyimpan kredensial apa pun - hanya TMA, debit, status, dan waktu
// terima dari sensor.

const UPSTREAM = "https://sdatelemetry.com/fmsciawi/";
const M_KE_CM = 100; // kolom TMA sumber sudah dalam meter; disimpan sbg cm

/** Ambil HTML telemetry lalu parse lokasi + jam + tma + debit. */
async function bacaTma() {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const up = await fetch(UPSTREAM, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ciawi-record-cron",
        accept: "text/html,application/xhtml+xml",
      },
      signal: ctrl.signal,
    });
    if (!up.ok) return [];
    const src = Buffer.from(await up.arrayBuffer()).toString("utf8");

    const hasil = [];
    for (const m of src.matchAll(/<tr[\s\S]*?<\/tr>/gi)) {
      const tr = m[0];
      const link = /location=([a-z0-9_.-]+)/i.exec(tr);
      if (!link) continue;
      const loc = link[1].toLowerCase();
      // Hanya Ciawi dan Sukamahi.
      if (!/(ciawi|sukamahi)/.test(loc)) continue;
      // Buang AWS (bukan titik ukur bendungan).
      if (loc.startsWith("aws")) continue;

      const bersih = tr.replace(/<!--[\s\S]*?-->/g, "");
      const nums = [...cleanisAngka(bersih)];
      const jam = (bersih.match(/>(\d{1,2}:\d{2})</) || [])[1] || "";
      if (!nums.length) continue;

      // TMA <= 0 dianggap sensor mati - jangan simpan, agar histori tidak
      // penuh angka yang tidak bermakna.
      const tma = nums[0];
      if (!(tma > 0)) continue;

      hasil.push({
        loc,
        tma: tma * M_KE_CM,
        q: nums.length > 1 ? nums[1] : null,
        st: "live",
        rx: jam,
      });
    }
    return hasil;
  } finally {
    clearTimeout(t);
  }
}

function cleanisAngka(html) {
  const out = [];
  for (const m of html.matchAll(/>(\d+(?:[.,]\d+)?)</g)) {
    out.push(parseFloat(m[1].replace(",", ".")));
  }
  return out;
}

function waktuWIB(d = new Date()) {
  const p = {};
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .formatToParts(d)
    .forEach((x) => {
      p[x.type] = x.value;
    });
  return {
    day: `${p.year}-${p.month}-${p.day}`,
    time: `${p.hour}:${p.minute}`,
  };
}

export default {
  // Cron Trigger
  async scheduled(event, env, ctx) {
    ctx.waitUntil(rekam(env));
  },

  // Manual: GET /  (berguna untuk menguji)
  async fetch(request, env) {
    const hasil = await rekam(env);
    return new Response(JSON.stringify(hasil, null, 2), {
      headers: { "Content-Type": "application/json" },
    });
  },
};

async function rekam(env) {
  if (!env || !env.BLOB) {
    return { ok: false, error: "binding KV 'BLOB' belum ada" };
  }
  const { day, time } = waktuWIB();
  const ts = `${day} ${time}`;

  let picks = [];
  try {
    picks = await bacaTma();
  } catch (e) {
    return { ok: false, error: "gagal baca upstream: " + (e && e.message), ts };
  }
  if (!picks.length) {
    return { ok: false, error: "tidak ada baris Ciawi/Sukamahi", ts };
  }

  const key = `history/${day}.jsonl`;
  const prev = (await env.BLOB.get(key)) || "";

  // Idempoten per menit.
  if (prev.includes(`"ts":"${ts}"`)) {
    return { ok: true, duplikat: true, ts, baris: prev.trim() ? prev.trim().split("\n").length : 0 };
  }

  const baru = picks.map((p) => JSON.stringify({ ts, ...p })).join("\n");
  await env.BLOB.put(key, prev + baru + "\n");

  return {
    ok: true,
    ts,
    sensor: picks.length,
    total: (prev.trim() ? prev.trim().split("\n").length : 0) + picks.length,
  };
}