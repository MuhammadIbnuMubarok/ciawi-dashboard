// api/_blob.js - shim kompatibilitas @vercel/blob -> Cloudflare Workers KV
//
// Modul ini mengekspor API yang sama dengan @vercel/blob (put/get/list/delete)
// di atas Cloudflare KV, supaya api/*.js tidak perlu diubah selain mengganti
// baris import. Memakai env: KV namespace binding bernama `BLOB`.
//
// Batas gratis KV: 1.000 write/hari, 100.000 read/hari, 1.000 delete/hari -
// cukup untuk snapshot harian dan cache foto.

// ---------- auth token (dari dashboard Cloudflare) ----------
function bearer(req) {
  const h = req?.headers?.get?.("authorization") || req?.headers?.get?.("Authorization");
  return h && h.startsWith("Bearer ") ? h.slice(7) : "";
}

// ---------- ringkasan untuk header ETag / validasi ----------
function parseMeta(text) {
  try { return JSON.parse(text); } catch { return null; }
}

function contentTypeFor(key, val) {
  const mt = /^data:(.+?)(;base64)?,/i.exec(val);
  return mt ? mt[1] : "application/octet-stream";
}

function buildPayload(key, value, opts = {}) {
  if (opts && typeof opts === "object" && !Array.isArray(opts) && "value" in opts) {
    return { data: opts.value, type: opts.type || "text/plain" };
  }
  if (typeof value === "string") {
    return { data: value, type: contentTypeFor(key, value) };
  }
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
    return { data: value, type: "application/octet-stream" };
  }
  if (value instanceof Blob) {
    return { data: value, type: value.type || "application/octet-stream" };
  }
  if (value && typeof value.stream === "function") {
    return { data: value, type: "application/octet-stream" };
  }
  return { data: JSON.stringify(value), type: "application/json" };
}

// ---------- Environment bindings ----------
// Cloudflare Pages Functions hanya mengoper `env` ke signature handler
// (req, ctx), sedangkan pemanggilan di dalam api/*.js tidak pernah
// meneruskannya. Karena itu shim menyimpan env pada module-scope lewat
// setEnv() yang dipanggil oleh wrapper di _worker.js pada setiap request.
let CURRENT_ENV = null;

export function setEnv(env) {
  CURRENT_ENV = env || null;
}

function ns(env) {
  const e = env || CURRENT_ENV;
  if (!e) throw new Error("KV binding 'BLOB' belum terpasang di environment ini");
  if (!e.BLOB) throw new Error("KV binding 'BLOB' belum ada - buat namespace di wrangler lalu binding di Pages");
  return e.BLOB;
}

/**
 * put(pathname, value, options)
 * returns { url, pathname, contentType, size, uploadedAt, downloadUrl }
 */
export async function put(pathname, value, options, env) {
  const store = ns(env);
  const { data, type } = buildPayload(pathname, value, options);
  const body = typeof data === "string" ? data : data;
  // Workers KV menimpa secara normal; allowOverwrite tidak relevan di sini
  // (perilaku itu hanya milik @vercel/blob).
  const meta = await store
    .put(pathname, body, { httpMetadata: { contentType: type } })
    .catch(async (e) => {
      // Beberapa binding KV menolak httpMetadata; coba lagi polos.
      if (e && /metadata|option|type/i.test(String(e))) {
        return store.put(pathname, body);
      }
      throw e;
    });

  const size =
    typeof body === "string" ? new TextEncoder().encode(body).length : body?.byteLength ?? 0;

  return {
    url: `https://cdn.ciawi-dashboard.pages.dev/${pathname}`,
    pathname,
    contentType: type,
    size,
    uploadedAt: new Date().toISOString(),
    downloadUrl: `/api/blob?path=${encodeURIComponent(pathname)}`,
  };
}

/**
 * get(pathname, options) -> { value, contentType, size, etag, downloadedAt }
 * | { value: null, notFound: true } | null
 */
export async function get(pathname, options, env) {
  const store = ns(env);
  const type = (options && options.type) || "text";
  const obj = await store.get(pathname, type === "arrayBuffer" ? "arrayBuffer" : "text");
  if (obj === null) return null;

  if (type === "stream") {
    // Pemanggil di record.js memeriksa `b.stream`, jadi sediakan objek
    // ReadableStream di sini (bentuk @vercel/blob).
    const rs = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(obj));
        controller.close();
      },
    });
    return { value: rs, stream: rs, contentType: "application/octet-stream", size: obj.length };
  }
  const meta = await store.getWithMetadata(pathname, type === "arrayBuffer" ? "arrayBuffer" : "text");
  if (meta === null) return null;
  // record.js (dan kemungkinan telegram.js) selalu membaca `b.stream`
  // meski tidak meminta type:"stream", jadi sertakan selalu.
  const rs = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(String(meta.value)));
      controller.close();
    },
  });
  return {
    value: meta.value,
    stream: rs,
    contentType: meta.metadata?.contentType || "text/plain",
    size: typeof meta.value === "string" ? meta.value.length : meta.value?.byteLength ?? 0,
    etag: meta.metadata?.etag,
    downloadedAt: meta.metadata?.uploadedAt,
  };
}

/**
 * head(pathname) -> metadata | null
 */
export async function head(pathname, env) {
  const store = ns(env);
  const meta = await store.getWithMetadata(pathname, "text");
  if (!meta) return null;
  return {
    size: meta.value ? meta.value.length : 0,
    contentType: meta.metadata?.contentType,
    etag: meta.metadata?.etag,
    uploadedAt: meta.metadata?.uploadedAt,
    httpEtag: meta.metadata?.etag,
  };
}

/**
 * list({ prefix, limit, cursor }) -> { blobs, hasMore, cursor }
 * Mirip bentuk @vercel/blob (v2) supaya pemanggil tidak perlu diubah.
 */
export async function list(options, env) {
  const store = ns(env);
  const prefix = (options && options.prefix) || "";
  const limit = Math.min((options && options.limit) || 1000, 1000);
  const res = await store.list({ prefix, limit, cursor: options && options.cursor });

  const blobs = (res.keys || []).map((k) => ({
    pathname: k.name,
    size: k.metadata?.size ?? 0,
    uploadedAt: k.metadata?.uploadedAt ?? new Date(k.metadata?.uploadedAt ?? Date.now()).toISOString(),
    url: `https://cdn.ciawi-dashboard.pages.dev/${k.name}`,
    downloadUrl: `/api/blob?path=${encodeURIComponent(k.name)}`,
    contentType: k.metadata?.contentType || "application/octet-stream",
  }));
  return { blobs, hasMore: !!res.list_complete === false, cursor: res.cursor, count: blobs.length };
}

/**
 * del(pathname | [pathnames])
 */
export async function del(pathname, env) {
  const store = ns(env);
  const keys = Array.isArray(pathname) ? pathname : [pathname];
  for (const k of keys) await store.delete(k);
}

export default { put, get, head, list, del };