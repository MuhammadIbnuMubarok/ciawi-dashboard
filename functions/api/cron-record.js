// functions/api/cron-record.js - rekam TMA otomatis tiap jam
//
// Dijadwalkan lewat Cloudflare Cron Triggers (lihat wrangler.toml):
//   [triggers] crons = ["5 * * * *"]   -> setiap jam menit ke-5
//
// TUJUAN: mengisi histori TMA (history/<tanggal>.jsonl di Workers KV) tanpa
// perlu seseorang mengirim /update. Idempoten per menit, jadi re-trigger
// pada menit yang sama tidak menduplikasi baris.
//
// Bao: setiap rekaman hanya menyimpan TMA/debit/status beserta waktu terima
// dari sensor, tanpa kredensial apa pun.

import recordHandler from "./_handlers/record.js";

export async function onRequest(context) {
  const { request, env } = context;

  // Secret Cloudflare hanya tersedia lewat `env`; handler gaya Vercel membaca
  // process.env. Samakan di sini supaya _handlers/record.js tetap bisa jalan
  // tanpa diubah.
  if (typeof globalThis.process === "undefined") globalThis.process = { env: {} };
  if (!globalThis.process.env) globalThis.process.env = {};
  for (const [k, v] of Object.entries(env || {})) {
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      globalThis.process.env[k] = String(v);
    }
  }

  // Setel env KV untuk shim _blob.js
  const { setEnv } = await import("./_handlers/_blob.js");
  setEnv(env);

  // Waktu rekam dalam zona WIB, format "YYYY-MM-DD HH:MM"
  const now = new Date();
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
    .formatToParts(now)
    .forEach((x) => {
      p[x.type] = x.value;
    });
  const day = `${p.year}-${p.month}-${p.day}`;
  const time = `${p.hour}:${p.minute}`;
  const ts = `${day} ${time}`;

  const headers = { "Content-Type": "application/json" };
  let payload = null;
  let status = 200;
  const stub = {
    status(c) {
      status = c;
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

  try {
    await recordHandler(
      { query: { publish: "1", time }, method: "GET", headers: request.headers },
      stub,
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: String(e && e.message ? e.message : e) }),
      { status: 500, headers },
    );
  }

  return new Response(
    JSON.stringify({
      ok: status === 200 && !!(payload && payload.ok),
      jadwal: ts,
      hasil: payload,
    }),
    { status, headers },
  );
}