// functions/api/[[path]].js - adapter Cloudflare Pages Functions
//
// CATATAN PATH: file ini berada di functions/api/ sehinggahandler asli harus
// dipanggil dari "../../api/<nama>.js". Import relatif dihitung dari lokasi
// file, bukan dari root project.
//
// File ini menerjemahkan SEMUA handler di api/*.js (format Vercel Node.js
// `export default async (req, res)`) menjadi signature Cloudflare Pages
// Functions `(request, env, ctx)`.
//
// Kenapa perlu: kode yang sudah jalan di Vercel memakai objek `res` dengan
// res.status().json().send(), yang tidak ada di Workers runtime. Daripada
// menulis ulang 15 handler, adapter ini memberi objek `res` tiruan.
//
// Semua yang terkait KV ditangani oleh api/_blob.js (shim di atas
// @vercel/blob) dan env diteruskan lewat setEnv() pada setiap request.

import * as blobShim from "../../api/_blob.js";

const H = (n) => () => import("../../api/" + n + ".js");

// ---------- peta routing: path -> modul handler ----------
const ROUTES = {
  fleet: H("fleet"),
  piezometer: H("piezometer"),
  proxy: H("proxy"),
  health: H("health"),
  live: H("live"),
  rt: H("rt"),
  webhook: H("webhook"),
  ai: H("ai"),
  telegram: H("telegram"),
  update: H("update"),
  record: H("record"),
  rts: H("rts"),
  snap: H("snap"),
  cctv: H("cctv"),
  history: H("history"),
};

// ---------- objek res tiruan (API ala Node.js) ----------
function makeRes() {
  const headers = new Headers();
  let statusCode = 200;
  let finished = false;
  let resolveDone;
  const done = new Promise((r) => (resolveDone = r));

  const finish = () => {
    if (!finished) {
      finished = true;
      resolveDone();
    }
  };

  const res = {
    status(code) {
      statusCode = code;
      return res;
    },
    setHeader(k, v) {
      if (typeof k === "string" && k) headers.set(k, String(v));
      return res;
    },
    getHeader(k) {
      return headers.get(k);
    },
    removeHeader(k) {
      headers.delete(k);
      return res;
    },
    json(payload) {
      if (!headers.has("content-type")) {
        headers.set("content-type", "application/json; charset=utf-8");
      }
      headers.set("x-adapter", "cloudflare-pages");
      finish();
      const out = new Response(JSON.stringify(payload), { status: statusCode, headers });
      res.__response = out;
      return out;
    },
    send(body) {
      finish();
      if (body === undefined || body === null) {
        res.__response = new Response(null, { status: statusCode, headers });
        return res.__response;
      }
      let out;
      if (typeof body === "string") {
        if (!headers.has("content-type")) headers.set("content-type", "text/html; charset=utf-8");
        out = new Response(body, { status: statusCode, headers });
      } else if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
        out = new Response(body, { status: statusCode, headers });
      } else if (typeof Blob !== "undefined" && body instanceof Blob) {
        if (!headers.has("content-type")) headers.set("content-type", body.type || "application/octet-stream");
        out = new Response(body, { status: statusCode, headers });
      } else {
        out = new Response(JSON.stringify(body), { status: statusCode, headers });
      }
      res.__response = out;
      return out;
    },
    end() {
      finish();
      res.__response = new Response(null, { status: statusCode, headers });
      return res.__response;
    },
    redirect(code, loc) {
      return new Response(null, { status: code, headers: { Location: loc } });
    },
    _done: done,
    _headers: headers,
    _status: () => statusCode,
  };
  return res;
}

// ---------- req tiruan (API ala Node.js) ----------
function makeReq(request, env, ctx) {
  const url = new URL(request.url);
  const query = {};
  for (const [k, v] of url.searchParams) {
    if (k in query) {
      query[k] = Array.isArray(query[k]) ? [...query[k], v] : [query[k], v];
    } else {
      query[k] = v;
    }
  }

  let bodyPromise = null;
  const parseBody = async () => {
    if (bodyPromise) return bodyPromise;
    bodyPromise = (async () => {
      const ct = request.headers.get("content-type") || "";
      try {
        if (request.method === "GET" || request.method === "HEAD") return undefined;
        if (ct.includes("application/json")) return await request.json();
        const txt = await request.text();
        if (!txt) return undefined;
        if (ct.includes("application/x-www-form-urlencoded")) {
          return Object.fromEntries(new URLSearchParams(txt));
        }
        return txt;
      } catch {
        return undefined;
      }
    })();
    return bodyPromise;
  };

  return {
    method: request.method,
    url: request.url,
    headers: Object.fromEntries(request.headers.entries()),
    query,
    body: undefined, // diisi lazy oleh handler yang membacanya
    env,
    ctx,
    _rawBody: parseBody,
    // Beberapa handler membaca req.body langsung; sediakan getter lazy.
    get bodyParsed() {
      return undefined;
    },
  };
}

export async function onRequest(context) {
  const { request, env, ctx } = context;

  let path = new URL(request.url).pathname.replace(/^\/+|\/+$/g, "");
  // request datang untuk /api/<nama>; buang prefix "api"
  if (path.startsWith("api/")) path = path.slice(4);
  const route = path.split("/")[0];

  const loader = ROUTES[route];
  if (!loader) {
    return new Response(
      JSON.stringify({
        error: "route tidak dikenal: /api/" + route,
        tersedia: Object.keys(ROUTES).map((r) => "/api/" + r),
      }),
      { status: 404, headers: { "content-type": "application/json" } },
    );
  }

  // shim KV butuh env
  blobShim.setEnv(env);

  const mod = await loader();
  const handler = mod.default || mod.handler;
  if (typeof handler !== "function") {
    return new Response(JSON.stringify({ error: "handler tidak valid di " + route }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  const req = makeReq(request, env, ctx);
  // handler yang membaca req.body: parse lebih dulu
  if (["POST", "PUT", "PATCH"].includes(request.method)) {
    req.body = await req._rawBody();
  }

  const res = makeRes();

  try {
    const out = await handler(req, res);
    // Bentuk paling umum: `return res.json(...)` / `return res.send(...)`.
    // makeRes() mengembalikan Response sungguhan, jadi `out` sudah Response.
    if (out instanceof Response) return out;
    // Bentuk lain: handler mengisi res lalu `return;` (void). Tunggu settle.
    await res._done;
    return res.__response || new Response(null, { status: res._status(), headers: res._headers });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String((err && err.message) || err) }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }
}