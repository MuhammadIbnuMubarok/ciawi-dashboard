// api/webhook.js v3 - EDGE runtime: body dijamin terbaca via req.json()
export const config = { runtime: "edge" };
export default async (req, ctx) => {
  let body = {};
  try { body = await req.json(); } catch (e) { body = {}; }
  const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  let chatId = null;
  let text = "";
  let cbId = null;
  if (body.message) { chatId = body.message.chat.id; text = String(body.message.text || ""); }
  if (body.callback_query) {
    cbId = body.callback_query.id;
    chatId = body.callback_query.message.chat.id;
    text = String(body.callback_query.data || "");
  }
  if (TOKEN && chatId) {
    const api = "https://api.telegram.org/bot" + TOKEN + "/";
    const send = async function (t, kb) {
      const p = { chat_id: chatId, text: t };
      if (kb) p.reply_markup = kb;
      await fetch(api + "sendMessage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) });
    };
    const menu = { inline_keyboard: [
      [{ text: "🔄 Update Lagi", callback_data: "/update" }, { text: "🚨 Status Siaga", callback_data: "/status" }],
      [{ text: "📷 CCTV", callback_data: "/cctv" }, { text: "❓ Bantuan", callback_data: "/bantuan" }]
    ] };
    try {
      if (cbId) await fetch(api + "answerCallbackQuery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ callback_query_id: cbId }) });
      if (text === "/start" || text === "/bantuan") {
        await send("🛰️ Bot UPB Update - Bendungan Ciawi\n📊 /update = laporan terkini (foto + angka)\n🚦 /status = status siaga dan TMA\n📷 /cctv = foto mata CCTV\n📖 /bantuan = menu ini", menu);
      } else if (text === "/update") {
        ctx.waitUntil((async function () {
          // Cloudflare: CF_PAGES_URL. Vercel: VERCEL_URL. Fallback ke domain Cloudflare
          // yang sekarang aktif (domain Vercel lama sudah DEPLOYMENT_DISABLED).
          const HOST = "https://" + (process.env.CF_PAGES_URL || process.env.VERCEL_URL || "ciawi-scada.pages.dev");
                    const r = await fetch(HOST + "/api/update?publish=1&time=" + encodeURIComponent(wantT || "") + "&cuaca=-", { cache: "no-store" });
                    const pub = await r.json().catch(function () { return null; });
                    // Panggil /api/telegram supaya report lengkap (Ciawi + Sukamahi)
                    // plus foto CCTV benar-benar terkirim, bukan hanya konfirmasi.
                    const t = await fetch(HOST + "/api/telegram?cuaca=-&time=" + encodeURIComponent(wantT || ""), { cache: "no-store" });
                    const j = await t.json().catch(function () { return null; });
                    if (j && j.ok) await send("✅ Update terkirim • Ciawi + Sukamahi • foto: " + (j.foto || 0), menu);
                    else await send("Gagal mengirim update: " + (j && j.error ? j.error : "tidak diketahui"), menu);
        })());
      } else if (text === "/status") {
  ctx.waitUntil((async function () {
    const r = await fetch("https://ciawi-dashboard.vercel.app/api/record", { cache: "no-store" });
    const j = await r.json().catch(function () { return null; });
    const ks = j && j.updates ? Object.keys(j.updates).sort() : [];
    const u = ks.length ? j.updates[ks[ks.length - 1]] : null;
    if (!u) { await send("🚦 Status: tiada rekaman tersimpan.", menu); return; }
    const ambang = [18.82, 100.72, 163.22, 250.07, 292.38, 310.95, 751.76];
    const labels = ["Normal", "Siaga IV", "Siaga III", "Siaga II", "Siaga I - Waspada I RTD", "Waspada 2 RTD", "Siaga RTD", "Awasi RTD"];
    let st = labels[7];
    for (let i = 0; i < ambang.length; i++) { if ((u.qOut || 0) <= ambang[i]) { st = labels[i]; break; } }
    await send("🚦 STATUS: " + st + "\n🕐 " + (u.time || "-") + " WIB\n📥 Inlet: TMA " + (u.tmaIn || 0) + " m • Q " + (u.qIn || 0) + " m³/s\n📤 Outlet: TMA " + (u.tmaOut || 0) + " m • Q " + (u.qOut || 0) + " m³/s\n✅ laporan status tersampaikan", menu);
  })());
} else if (text === "/cctv") {
  ctx.waitUntil((async function () {
    const HOST = "https://" + (process.env.CF_PAGES_URL || process.env.VERCEL_URL || "ciawi-scada.pages.dev");
    const r = await fetch(HOST + "/api/snap", { cache: "no-store" });
    const j = await r.json().catch(function () { return null; });
    const cams = (j && (j.urls || j.cams || j.foto)) || null;
    if (!cams || !cams.length) { await send("📷 CCTV: tiada foto tersedia saat ini.", menu); return; }
    for (let i = 0; i < cams.length; i++) {
      const url = typeof cams[i] === "string" ? cams[i] : (cams[i].url || cams[i].foto);
      if (!url) continue;
      await fetch(api + "sendPhoto", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, photo: url, caption: "📷 CCTV Ciawi • mata " + (i + 1) }) });
    }
    await send("✅ " + cams.length + " foto CCTV tersampaikan", menu);
  })());
} else if (text) {
        await send("Perintah tidak dikenal: " + text + "\nKetik /bantuan untuk menu.", menu);
      }
    } catch (e) {}
  }
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
};
