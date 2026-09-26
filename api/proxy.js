// api/proxy.js — proxy telemetri SDA untuk realtime browser (inlet & outlet)
module.exports = async function handler(req, res) {
  const url = req.query.url;
  if (!url) {
    res.status(400).send("url parameter required");
    return;
  }
  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Accept": "*/*"
      },
      cache: "no-store"
    });
    if (!r.ok) {
      res.status(r.status).send("Upstream HTTP " + r.status);
      return;
    }
    const buf = await r.arrayBuffer();
    const contentType = r.headers.get("content-type") || "application/json";
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.status(200).send(Buffer.from(buf));
  } catch (e) {
    res.status(502).send("PROXY ERROR: " + (e.message || "failed"));
  }
};
