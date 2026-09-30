// api/ai.js - Edge: analis interaktif multi-provider (gemini|openai|groq)
export const config = { runtime: "edge" };
const RATE = new Map();
export default async (req) => {
  if (req.method !== "POST") return new Response(JSON.stringify({ ok: false, error: "method" }), { status: 405 });
  const ip = (req.headers.get("x-forwarded-for") || "anon").split(",")[0].trim();
  const now = Date.now();
  const w = RATE.get(ip) || { t: now, n: 0 };
  if (now - w.t > 60000) { w.t = now; w.n = 0; }
  w.n++; RATE.set(ip, w);
  if (w.n > 20) return new Response(JSON.stringify({ ok: false, error: "terlalu banyak permintaan" }), { status: 429, headers: { "Content-Type": "application/json" } });
  let body = {};
  try { body = await req.json(); } catch (e) { return new Response(JSON.stringify({ ok: false, error: "body" }), { status: 400 }); }
  const brief = String(body.brief || "").slice(0, 60000);
  const msgs = Array.isArray(body.messages) ? body.messages.slice(-6) : [];
  if (!msgs.length) return new Response(JSON.stringify({ ok: false, error: "pesan kosong" }), { status: 400 });
  const provider = (process.env.AI_PROVIDER || "gemini").toLowerCase();
  const sys = "Kamu adalah AI ANALIS BENDUNGAN CIAWI, asisten interaktif pada dashboard telemetri Bendungan Ciawi. Kamu BISA MENJAWAB PERTANYAAN APA PUN: analisis data, hidrologi, laporan, matematika, pengetahuan umum, seni, chit-chat, apa saja. Aturan besi: (1) bila pertanyaan menyangkut data bendungan/neraca/piezometer/telemetri, jawab HANYA berdasar DATA BRIEF riil di bawah; sebut angka persis sebagaimana brief; bila brief tidak memuat data yang diminta, katakan jujur bahwa data itu tidak ada dalam ringkasan dan tawarkan alternatif; JANGAN pernah mengarang angka. (2) Bila pertanyaan di luar data bendungan, jawablah membantu dan cerdas seperti asisten umum. (3) Bahasa Indonesia kecuali diminta lain. (4) Gaya: ringkas, terstruktur, boleh poin dan tabel teks. DATA BRIEF RIIL:\n" + brief;
  let reply = null;
  if (provider === "openai" || provider === "groq") {
    const key = provider === "openai" ? process.env.OPENAI_API_KEY : process.env.GROQ_API_KEY;
    if (!key) return new Response(JSON.stringify({ ok: false, error: "kunci " + provider + " belum dipasang" }), { status: 503 });
    const url = provider === "openai" ? "https://api.openai.com/v1/chat/completions" : "https://api.groq.com/openai/v1/chat/completions";
    const model = provider === "openai" ? "gpt-4o-mini" : "llama-3.3-70b-versatile";
    const mm = [{ role: "system", content: sys }];
    msgs.forEach(function (m) { mm.push({ role: m.role === "model" ? "assistant" : "user", content: String(m.text || "").slice(0, 8000) }); });
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + key }, body: JSON.stringify({ model: model, messages: mm, temperature: 0.4 }) });
    const j = await r.json().catch(function () { return null; });
    reply = j && j.choices && j.choices[0] && j.choices[0].message ? j.choices[0].message.content : null;
  } else {
    const key = process.env.GEMINI_API_KEY;
    if (!key) return new Response(JSON.stringify({ ok: false, error: "kunci gemini belum dipasang" }), { status: 503 });
    const contents = [];
    msgs.forEach(function (m) { contents.push({ role: m.role === "model" ? "model" : "user", parts: [{ text: String(m.text || "").slice(0, 8000) }] }); });
    const r = await fetch("https://generativelanguage.googleapis.com/v1/models/" + (process.env.AI_MODEL || "gemini-3-flash") + ":generateContent", { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: JSON.stringify({ systemInstruction: { parts: [{ text: sys }] }, contents: contents, generationConfig: { temperature: 0.4 } }) });
    const raw = await r.text();
    let j = null; try { j = JSON.parse(raw); } catch (e) { j = null; }
    if (!r.ok) return new Response(JSON.stringify({ ok: false, error: "upstream " + r.status + ": " + raw.slice(0, 200) }), { status: 502, headers: { "Content-Type": "application/json" } });
    reply = j && j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts ? j.candidates[0].content.parts.map(function (p) { return p.text || ""; }).join("") : null;
  }
  if (!reply) return new Response(JSON.stringify({ ok: false, error: "mesin AI tidak membalas" }), { status: 502 });
  return new Response(JSON.stringify({ ok: true, reply: reply }), { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
};
