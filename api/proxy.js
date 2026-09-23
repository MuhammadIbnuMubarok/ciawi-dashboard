/* PROXY SDA serverless - kunci host agar bukan open-proxy */
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  const target = String(req.query.url || "");
  if (target.indexOf("https://sdatarupublic.sda.go.id/") !== 0) { res.status(403).json({ error: "host tidak diizinkan" }); return; }
  try {
    const r = await fetch(target, { headers: { "User-Agent": "ciawi-scada/2.16" } });
    const t = await r.text();
    res.setHeader("Cache-Control", "s-maxage=20, stale-while-revalidate=40");
    res.status(r.status).send(t);
  } catch (e) { res.status(502).json({ error: "upstream gagal" }); }
}
