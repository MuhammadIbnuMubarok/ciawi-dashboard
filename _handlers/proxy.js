// api/proxy.js - proxy telemetri SDA untuk realtime browser (inlet & outlet) [EDGE]
export const config = { runtime: "edge" };
export default async function handler(req) {
  const u = new URL(req.url);
  const url = u.searchParams.get("url");
  if (!url) { return new Response("url parameter required", { status: 400 }); }
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "Accept": "*/*" },
      cache: "no-store"
    });
    if (!r.ok) { return new Response("Upstream HTTP " + r.status, { status: r.status }); }
    const buf = await r.arrayBuffer();
    const contentType = r.headers.get("content-type") || "application/json";
    return new Response(buf, { status: 200, headers: { "Access-Control-Allow-Origin": "*", "Content-Type": contentType, "Cache-Control": "no-store, no-cache, must-revalidate" } });
  } catch (e) {
    return new Response("Proxy gagal: " + e.message, { status: 502 });
  }
}
