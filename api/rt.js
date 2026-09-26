// api/rt.js - jembatan realtime: FLEET_URL sisi-server untuk mesin rt browser
module.exports = async (req, res) => {
  try {
    const r = await fetch(process.env.FLEET_URL, { cache: "no-store" });
    if (!r.ok) { res.status(502).json({ error: "fleet HTTP " + r.status }); return; }
    const j = await r.json();
    res.setHeader("Cache-Control", "no-store");
    res.json(j);
  } catch (e) { res.status(500).json({ error: e.message }); }
};
