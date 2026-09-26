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
      [{ text: "Update Lagi", callback_data: "/update" }, { text: "Status Siaga", callback_data: "/status" }],
      [{ text: "CCTV", callback_data: "/cctv" }, { text: "Bantuan", callback_data: "/bantuan" }]
    ] };
    try {
      if (cbId) await fetch(api + "answerCallbackQuery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ callback_query_id: cbId }) });
      if (text === "/start" || text === "/bantuan") {
        await send("Bot UPB Update - Bendungan Ciawi\n/update = laporan terkini (foto + angka)\n/status = status siaga dan TMA\n/cctv = foto mata CCTV\n/bantuan = menu ini", menu);
      } else if (text === "/update" || text === "/status" || text === "/cctv") {
        ctx.waitUntil((async function () {
          const r = await fetch("https://ciawi-dashboard.vercel.app/api/telegram?cuaca=-", { cache: "no-store" });
          const j = await r.json().catch(function () { return null; });
          if (j && j.ok) await send("Update TMA terkirim di atas.", menu);
          else await send("Gagal mengirim update: " + (j && j.error ? j.error : "tidak diketahui"), menu);
        })());
      } else if (text) {
        await send("Perintah tidak dikenal: " + text + "\nKetik /bantuan untuk menu.", menu);
      }
    } catch (e) {}
  }
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
};
