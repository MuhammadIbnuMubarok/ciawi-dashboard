/* LIVE LOG - penyimpan rekaman TMA realtime (localStorage) & penggabungan ke tabel neraca */
const LIVE_LOG_KEY="ciawi_live_log_v1";
const LIVE_LOG_MAX=20000;
function loadLiveLog(){try{const s=localStorage.getItem(LIVE_LOG_KEY);return s?JSON.parse(s):[];}catch(e){return [];}}
function saveLiveLog(arr){try{localStorage.setItem(LIVE_LOG_KEY,JSON.stringify(arr.slice(-LIVE_LOG_MAX)));}catch(e){console.warn("Gagal menyimpan live log:",e.message);}}
function appendLiveRecord(lr,tIn,tOut){const log=loadLiveLog();const o={};new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Jakarta",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false}).formatToParts(new Date()).forEach(p=>{o[p.type]=p.value;});const ts=o.year+"-"+o.month+"-"+o.day+"T"+o.hour+":"+o.minute;if(log.some(r=>r.ts===ts))return;log.push({ts:ts,tanggal:o.year+"-"+o.month+"-"+o.day,jam:o.hour+":"+o.minute,tmaIn:tIn,tmaOut:tOut,elevasi:lr.elevasi,vol:lr.vol,qoutK:lr.qoutK,qoutT:lr.qoutT,qin:lr.qIn,reduksi:lr.reduksi,status:lr.status});saveLiveLog(log);const c=document.getElementById("live-saved");if(c)c.textContent=log.length+" rekaman";}
function liveLogRows(){return loadLiveLog().map((r,i)=>({no:200001+i,tanggal:r.tanggal,jam:r.jam,elevasi:r.elevasi,sedimen:null,bukaan:r.tmaOut,vol:r.vol,qout_konduit:r.qoutK,qout_spillway:0,qout_total:r.qoutT,qin:r.qin,reduksi:r.reduksi,status:r.status,live:true}));}
function getBaseDataset(){const live=liveLogRows();const seen={};live.forEach(function(r){seen[r.tanggal+"T"+r.jam]=1;});const srv=serverHistoryRows().filter(function(r){return !seen[r.tanggal+"T"+r.jam];});return REAL_DATA.concat(srv).concat(live);}

// --- FASE 2 (patch 2026-09-24): riwayat server menyatu ke dataset ---
let SERVER_HISTORY = [];
async function loadServerHistory(){
  try {
    const f = function(d){ return d.toLocaleDateString("en-CA"); };
    const to = new Date(); const from = new Date(to.getTime() - 7 * 86400000);
    const r = await fetch("/api/history?from=" + f(from) + "&to=" + f(to), { cache: "no-store" });
    if (!r.ok) return;
    const j = await r.json();
    SERVER_HISTORY = j.rows || [];
  } catch (e) { SERVER_HISTORY = []; }
}
function serverHistoryRows(){
  const g = new Map();
  (SERVER_HISTORY || []).forEach(function(r){
    if (!g.has(r.ts)) g.set(r.ts, {});
    const o = g.get(r.ts);
    if (r.loc === "inletciawi") { o.inlet = r; } else if (r.loc === "outliteciawi") { o.outlet = r; }
  });
  const rows = []; let n = 300001;
  Array.from(g.entries()).sort(function(a, b){ return a[0] < b[0] ? -1 : 1; }).forEach(function(e){
    const ts = e[0], o = e[1];
    if (!o.inlet || !o.outlet) return;
    const tIn = o.inlet.tma / 100, tOut = o.outlet.tma / 100;
    if (!isFinite(tIn) || !isFinite(tOut)) return;
    const ms = new Date(ts.replace(" ", "T") + ":00+07:00").getTime();
    let lr = null;
    try { if (typeof computeLiveNeraca === "function") lr = computeLiveNeraca(tIn, tOut, ms); } catch (err) { lr = null; }
    if (!lr) return;
    rows.push({ no: n++, tanggal: ts.slice(0, 10), jam: ts.slice(11, 16), elevasi: lr.elevasi, sedimen: null, bukaan: tOut, vol: lr.vol, qout_konduit: lr.qoutK, qout_spillway: 0, qout_total: lr.qoutT, qin: lr.qin, reduksi: lr.reduksi, status: lr.status, live: "server" });
  });
  return rows;
}
document.addEventListener("DOMContentLoaded", function(){ loadServerHistory().then(function(){ if (typeof applyFilters === "function") applyFilters(); }); });
