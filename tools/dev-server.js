#!/usr/bin/env node
/**
 * tools/dev-server.js - menjalankan dashboard LENGKAP di komputer lokal:
 *   - menyajikan file statis (index.html, js, css, data, ...)
 *   - menjalankan fungsi di folder api/*.js seperti di Vercel
 *
 * Pakai:
 *   node tools/dev-server.js            (port 8090)
 *   set PORT=9000 && node tools/dev-server.js
 *   set CCTV_UPLOAD_KEY=rahasia && node tools/dev-server.js
 *
 * Bila BLOB_READ_WRITE_TOKEN tidak diset, isian baru disimpan ke data/piezo-local.json
 * sehingga dashboard tetap bisa dipakai penuh tanpa internet.
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.PORT || 8090);

// muat .env.local kalau ada (tanpa dependency tambahan)
try {
  fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/).forEach(function (l) {
    const m = /^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/.exec(l);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  });
} catch (e) { /* tidak ada .env.local, lanjut saja */ }

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".csv": "text/csv; charset=utf-8", ".txt": "text/plain; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml", ".ico": "image/x-icon", ".webp": "image/webp",
  ".map": "application/json; charset=utf-8", ".woff2": "font/woff2"
};

function bacaBody(req) {
  return new Promise(function (resolve) {
    const chunks = [];
    req.on("data", function (c) { chunks.push(c); });
    req.on("end", function () { resolve(Buffer.concat(chunks).toString("utf8")); });
  });
}

const server = http.createServer(async function (req, res) {
  const u = url.parse(req.url, true);
  let pathname = decodeURIComponent(u.pathname);

  // ---------- API
  if (pathname === "/api" || pathname.startsWith("/api/")) {
    const name = pathname.replace(/^\/api\/?/, "").replace(/\/$/, "") || "index";
    const file = path.join(ROOT, "api", name + ".js");
    if (!file.startsWith(path.join(ROOT, "api")) || !fs.existsSync(file)) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "endpoint tidak ada: " + name }));
      return;
    }
    const raw = await bacaBody(req);
    let parsed = null;
    try { parsed = raw ? JSON.parse(raw) : null; } catch (e) { parsed = null; }
    const mockReq = req;
    mockReq.query = u.query || {};
    mockReq.body = parsed !== null ? parsed : (raw || undefined);
    mockReq.cookies = {};
    const mockRes = {
      statusCode: 200, _headers: {},
      setHeader: function (k, v) { this._headers[k] = v; },
      status: function (c) { this.statusCode = c; return this; },
      json: function (o) {
        if (!this._headers["Content-Type"]) this._headers["Content-Type"] = "application/json; charset=utf-8";
        res.writeHead(this.statusCode, this._headers);
        res.end(JSON.stringify(o));
      },
      send: function (b) {
        if (!this._headers["Content-Type"]) this._headers["Content-Type"] = "text/plain; charset=utf-8";
        res.writeHead(this.statusCode, this._headers);
        res.end(typeof b === "string" ? b : Buffer.from(b));
      },
      end: function (b) { res.writeHead(this.statusCode, this._headers); res.end(b); }
    };
    try {
      delete require.cache[require.resolve(file)];
      const handler = require(file);
      await handler(mockReq, mockRes);
    } catch (e) {
      console.error("[api] " + name + " ERROR:", e.message);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ error: e.message, stack: String(e.stack).split("\n").slice(0, 4) }));
      }
    }
    return;
  }

  // ---------- statis
  if (pathname === "/") pathname = "/index.html";
  const target = path.join(ROOT, pathname);
  if (!target.startsWith(ROOT)) { res.writeHead(403); res.end("403"); return; }
  fs.readFile(target, function (err, buf) {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404 - " + pathname);
      return;
    }
    res.writeHead(200, { "Content-Type": MIME[path.extname(target).toLowerCase()] || "application/octet-stream" });
    res.end(buf);
  });
});

server.listen(PORT, function () {
  console.log("================================================================");
  console.log("  DASHBOARD CIAWI - SERVER LOKAL");
  console.log("  http://localhost:" + PORT);
  console.log("  API aktif: /api/* dijalankan dari folder api/");
  console.log("  Penyimpanan: " + (process.env.BLOB_READ_WRITE_TOKEN ? "Vercel Blob" : "lokal (data/piezo-local.json)"));
  console.log("  Kunci isi data: " + (process.env.CCTV_UPLOAD_KEY ? "diset" : "BELUM DISET - isi akan ditolak"));
  console.log("  Tekan Ctrl+C untuk berhenti.");
  console.log("================================================================");
});
