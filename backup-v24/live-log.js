/* LIVE LOG - penyimpan rekaman TMA realtime (localStorage) & penggabungan ke tabel neraca */
const LIVE_LOG_KEY="ciawi_live_log_v1";
const LIVE_LOG_MAX=20000;
function loadLiveLog(){try{const s=localStorage.getItem(LIVE_LOG_KEY);return s?JSON.parse(s):[];}catch(e){return [];}}
function saveLiveLog(arr){try{localStorage.setItem(LIVE_LOG_KEY,JSON.stringify(arr.slice(-LIVE_LOG_MAX)));}catch(e){console.warn("Gagal menyimpan live log:",e.message);}}
function appendLiveRecord(lr,tIn,tOut){const log=loadLiveLog();const o={};new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Jakarta",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false}).formatToParts(new Date()).forEach(p=>{o[p.type]=p.value;});const ts=o.year+"-"+o.month+"-"+o.day+"T"+o.hour+":"+o.minute;if(log.some(r=>r.ts===ts))return;log.push({ts:ts,tanggal:o.year+"-"+o.month+"-"+o.day,jam:o.hour+":"+o.minute,tmaIn:tIn,tmaOut:tOut,elevasi:lr.elevasi,vol:lr.vol,qoutK:lr.qoutK,qoutT:lr.qoutT,qin:lr.qIn,reduksi:lr.reduksi,status:lr.status});saveLiveLog(log);const c=document.getElementById("live-saved");if(c)c.textContent=log.length+" rekaman";}
function liveLogRows(){return loadLiveLog().map((r,i)=>({no:200001+i,tanggal:r.tanggal,jam:r.jam,elevasi:r.elevasi,sedimen:null,bukaan:r.tmaOut,vol:r.vol,qout_konduit:r.qoutK,qout_spillway:0,qout_total:r.qoutT,qin:r.qin,reduksi:r.reduksi,status:r.status,live:true}));}
function getBaseDataset(){return REAL_DATA.concat(liveLogRows());}
