// api/fleet.js - kredensial hanya di env Vercel (FLEET_URL)
module.exports = async (req, res) => {
  const url = process.env.FLEET_URL;
  if (!url) { res.status(500).json({ error: "FLEET_URL belum diset di Vercel" }); return; }
  try {
    const up = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 ciawi-dashboard-fleet" },
      cache: "no-store",
    });
    const buf = Buffer.from(await up.arrayBuffer());
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.status(up.status).send(buf);
  } catch (e) {
    res.status(502).json({ error: "fleet gagal: " + e.message });
  }
};
