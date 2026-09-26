/* LIVE REALTIME v2.25 - mesin tunggal telemetri resmi */
const RT_SOURCE="https://bbwscc.sdatelemetry.com/data/gettelem.php?mod=rt";
function rtBase(){return location.protocol==="https:"?location.origin+"/api/proxy?url=":"http://localhost:8080/?url=";}
function rtPick(arr,t){for(let i=0;i<arr.length;i++){const n=(arr[i].nama||"").replace(/\s+/g," ").trim().toUpperCase();if(n.indexOf(t)>=0)return arr[i];}return null;}
async function rtTick(){return; // pensiun: mesin fleet live-service.js yang berwenangconst b=document.getElementById("live-badge");try{const r=await fetch(rtBase()+encodeURIComponent(RT_SOURCE),{cache:"no-store"});if(!r.ok)throw new Error("HTTP "+r.status);const buf=await r.arrayBuffer();const u8=new Uint8Array(buf);let txt;
if(u8[0]===31&&u8[1]===139&&typeof DecompressionStream!=="undefined"){txt=await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"))).text();}else{txt=new TextDecoder().decode(buf);}
const j=JSON.parse(txt);const arr=(j&&j.data)||[];const tgt=[["inlet","INLET BENDUNGAN CIAWI"],["outlet","OUTLET BENDUNGAN CIAWI"]];let found=0;let tIn=NaN;let tOut=NaN;
tgt.forEach(function(p){const rec=rtPick(arr,p[1]);if(!rec)return;found++;const wl=parseFloat(rec.WLevel);const dt=String(rec.last_update||"");const jam=dt.length>=16?dt.substring(11,16):"";const tma=isNaN(wl)?"-":(wl/100).toFixed(2);
const set=function(id,v){const el=document.getElementById("live-"+p[0]+"-"+id);if(el)el.textContent=v;};set("jam",jam||"--:--");set("tma",tma);set("debit","-");if(p[0]==="inlet"){tIn=wl/100;}else{tOut=wl/100;}});
if(!found)throw new Error("Stasiun tidak ditemukan");if(b){b.textContent="LIVE";b.className="text-[10px] px-2 py-0.5 rounded bg-siaga-normal/15 text-siaga-normal border border-siaga-normal/40 font-bold";}
const ut=document.getElementById("live-update-time");if(ut)ut.textContent="WIB "+new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Jakarta",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}).format(new Date());
if(!isNaN(tIn)&&!isNaN(tOut)&&typeof computeLiveNeraca==="function"){const now=Date.now();const d2=(typeof liveLastTs!=="undefined"&&liveLastTs)?(now-liveLastTs)/1000:0;if(typeof liveLastTs!=="undefined"){liveLastTs=now;}const lr=computeLiveNeraca(tIn,tOut,d2);
if(typeof appendLiveRecord==="function")appendLiveRecord(lr,tIn,tOut);if(typeof renderLiveNeraca==="function")renderLiveNeraca(lr);if(typeof updateDamLive==="function")updateDamLive(lr);if(typeof applyFilters==="function")applyFilters();}
}catch(e){console.warn("RT offline: "+e.message);if(b){b.textContent="OFFLINE";b.className="text-[10px] px-2 py-0.5 rounded bg-siaga-2/15 text-siaga-2 border border-siaga-2/40 font-bold";}}}
window.setLiveBadge=function(){};
document.addEventListener("DOMContentLoaded",function(){if(typeof liveTimer!=="undefined"&&liveTimer){clearInterval(liveTimer);liveTimer=null;}rtTick();setInterval(rtTick,60000);});

