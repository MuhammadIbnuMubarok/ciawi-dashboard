export default async function handler(req, res) {
  const url = req.query.url;
  if (!url) { res.status(400).send("url required"); return; }
  try {
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } });
    const t = await r.text();
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(t);
  } catch (e) { res.status(502).send("PROXY ERROR"); }
}
