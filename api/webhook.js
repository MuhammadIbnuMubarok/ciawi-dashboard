// api/webhook.js - webhook Telegram: /start /update /status /cctv /bantuan + tombol inline
module.exports = async (req, res) => {
  try {
    const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    let body = {};
    try {
      if (typeof req.body === "object" && req.body !== null) body = req.body;
      else {
        const chunks = [];
        for await (const c of req) chunks.push(c);
        body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
      }
    } catch (e) { body = {}; }
    res.status(200).json({ ok: true });
    let chatId = null;
    let text = "";
    let cbId = null;
    if (body.message) { chatId = body.message.chat.id; text = String(body.message.text || ""); }
    if (body.callback_query) {
      cbId = body.callback_query.id;
      chatId = body.callback_query.message.chat.id;
      text = String(body.callback_query.data || "");
    }
    if (!TOKEN || !chatId) return;
    const api = "https://api.telegram.org/bot" + TOKEN + "/";
    const send = async function (t, kb) {
      const p = { chat_id: chatId, text: t, parse_mode: "HTML" };
      if (kb) p.reply_markup = kb;
      await fetch(api + "sendMessage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) });
    };
    if (cbId) await fetch(api + "answerCallbackQuery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ callback_query_id: cbId }) });
    const menu = { inline_keyboard: [
      [{ text: "Update Lagi", callback_data: "/update" }, { text: "Status Siaga", callback_data: "/status" }],
      [{ text: "CCTV", callback_data: "/cctv" }, { text: "Bantuan", callback_data: "/bantuan" }]
    ] };
    if (text === "/start" || text === "/bantuan") {
      await send("<b>Bot UPB Update - Bendungan Ciawi</b>\n/update = laporan terkini (foto + angka)\n/status = status siaga & TMA\n/cctv = foto mata CCTV\n/bantuan = menu ini", menu);
      return;
    }
    if (text === "/update" || text === "/status" || text === "/cctv") {
      const r = await fetch("https://ciawi-dashboard.vercel.app/api/telegram?cuaca=-", { cache: "no-store", signal: AbortSignal.timeout(50000) });
      const j = await r.json().catch(function () { return null; });
      if (j && j.ok) await send("Update TMA terkirim di atas.", menu);
      else await send("Gagal mengirim update: " + (j && j.error ? j.error : "tidak diketahui"), menu);
      return;
    }
  } catch (e) { res.status(200).json({ ok: true }); }
};
