// api/_piezo-data.js - data piezometer di-bundle sebagai modul ES
//
// Workers/Cloudflare Pages tidak punya filesystem, jadi api/piezometer.js
// tidak bisa fs.readFileSync("data/piezo-*.json") seperti di Vercel.
// Solusinya: file JSON di-import langsung (Cloudflare membundel hasilnya).
//
// Dihasilkan oleh tools/build-piezo-data.py - jangan diedit manual.

import master from "../data/piezo-master.json" with { type: "json" };
import history from "../data/piezo-history.json" with { type: "json" };
import arsip from "../data/piezo-arsip.json" with { type: "json" };
import excluded from "../data/piezo-excluded.json" with { type: "json" };

export const PIEZO_MASTER = master;
export const PIEZO_HISTORY = history;
export const PIEZO_ARSIP = arsip;
export const PIEZO_EXCLUDED = excluded;

export default { PIEZO_MASTER, PIEZO_HISTORY, PIEZO_ARSIP, PIEZO_EXCLUDED };