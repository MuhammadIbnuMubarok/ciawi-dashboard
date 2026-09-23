/* LIVE SERVICE - TMA realtime dari sdatelemetry.com/fmsciawi (khusus inlet & outlet Bendungan Ciawi) */
const LIVE_SOURCE="https://bbwscc.sdatelemetry.com/data/gettelem.php?mod=rt";
const LIVE_PROXIES=["/api/live?url=","/live?url="];
const LIVE_TARGETS=["INLET BENDUNGAN CIAWI","OUTLET BENDUNGAN CIAWI"];
let liveTimer=null;let liveLastTs=null;
function liveNorm(s){return (s||"").replace(/\s+/g," ").trim().toUpperCase();}
async function fetchWithTimeout(url,ms){const c=new AbortController();const t=setTimeout(()=>c.abort(),ms);try{const r=await fetch(url,{signal:c.signal});if(!r.ok)throw new Error("HTTP "+r.status);const b=await r.arrayBuffer();const u=new Uint8Array(b);
if(u[0]===31&&u[1]===139&&typeof DecompressionStream!=="undefined"){const st=new Blob([b]).stream().pipeThrough(new DecompressionStream("gzip"));return await new Response(st).text();}return new TextDecoder().decode(b);}finally{clearTimeout(t);}}
async function fetchLiveHtml(){const base=(location.protocol==="https:")?(location.origin+"/api/proxy?url="):LIVE_PROXIES[0];try{return await fetchWithTimeout(base+encodeURIComponent(LIVE_SOURCE),12000);}catch(e){console.warn("Proxy gagal: "+base);throw new Error("Semua proxy gagal");}}
function parseLiveTable(raw){let j;try{j=JSON.parse(raw);}catch(e){return {};}const arr=(j&&j.data)||[];const out={};LIVE_TARGETS.forEach(function(t){let r=null;for(let i=0;i<arr.length;i++){if(liveNorm(arr[i].nama).indexOf(t)>=0){r=arr[i];break;}}if(!r)return;const wl=parseFloat(r.WLevel);const dt=String(r.last_update||"");out[t]={jam:dt.length>=16?dt.substring(11,16):"",tma:isNaN(wl)?"-":(wl/100).toFixed(2),debit:"-"};});return out;}
function setLiveBadge(mode){const b=document.getElementById("live-badge");if(!b)return;if(mode==="live"){b.textContent="LIVE";b.className="text-[10px] px-2 py-0.5 rounded bg-siaga-normal/15 text-siaga-normal border border-siaga-normal/40 font-bold";}else if(mode==="offline"){b.textContent="OFFLINE";b.className="text-[10px] px-2 py-0.5 rounded bg-siaga-2/15 text-siaga-2 border border-siaga-2/40 font-bold";}else{b.textContent="MENYAMBUNG";b.className="text-[10px] px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-bold";}}
function renderLive(data){const map={"INLET BENDUNGAN CIAWI":"inlet","OUTLET BENDUNGAN CIAWI":"outlet"};let found=0;LIVE_TARGETS.forEach(t=>{const k=map[t];const d=data[t];if(!d)return;found++;const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};set("live-"+k+"-jam",d.jam||"--:--");set("live-"+k+"-tma",(d.tma===""?"—":d.tma)+" m");set("live-"+k+"-debit",(d.debit===""?"—":d.debit)+" m³/s");});const now=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Jakarta",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}).format(new Date());const u=document.getElementById("live-update-time");if(u)u.textContent=now+" WIB";setLiveBadge(found>0?"live":"offline");return found;}
async function refreshLiveNow(){setLiveBadge("loading");try{const html=await fetchFleet();const data=parseFleet(html);if(!data||Object.keys(data).length===0)throw new Error("Fleet telemetri tak tersedia");const tIn=parseFloat((data["INLET BENDUNGAN CIAWI"]||{}).tma);const tOut=parseFloat((data["OUTLET BENDUNGAN CIAWI"]||{}).tma);if(!isNaN(tIn)&&!isNaN(tOut)&&typeof computeLiveNeraca==="function"){const now=Date.now();const dt=liveLastTs?((now-liveLastTs)/1000):0;liveLastTs=now;const lr=computeLiveNeraca(tIn,tOut,dt);if(typeof appendLiveRecord==="function"){appendLiveRecord(lr,tIn,tOut);}renderLiveNeraca(lr);if(typeof updateDamLive==="function")updateDamLive(lr);if(typeof applyFilters==="function"){applyFilters();}}if(typeof refreshAllScenarios==="function"){refreshAllScenarios();if(typeof currentChart!=="undefined"&&currentChart==="all-overview"&&typeof renderChart==="function"){renderChart("all-overview");}}renderLive(data);}catch(e){console.warn("Live telemetry offline: "+e.message);setLiveBadge("offline");}}
function startLivePolling(ms){refreshLiveNow();if(liveTimer)clearInterval(liveTimer);liveTimer=setInterval(refreshLiveNow,ms||60000);}
document.addEventListener("DOMContentLoaded",function(){startLivePolling(60000);});









// --- fetcher & parser fleet telemetri (patch 2026-09-23) ---
async function fetchFleet(){
  const res = await fetch('/api/fleet', { cache: 'no-store' });
  if (!res.ok) throw new Error('fleet HTTP ' + res.status);
  return res.json();
}
function parseFleet(json){
  const out = {};
  const list = (json && json.telemetryjakarta) || [];
  for (const s of list) {
    const name = String(s.nama_alat || '').toLowerCase();
    const loc  = String(s.nama_lokasi || '').toLowerCase();
    const wcm  = Number(s.WLevel);
    const tma  = Number.isFinite(wcm) ? wcm / 100 : null;
    const jam  = String(s.ReceivedTime || '').slice(0,5);
    const age  = (s.ReceivedDate || '') + ' ' + (s.ReceivedTime || '');
    if (name.includes('outlet') && name.includes('ciawi')) {
      out['OUTLET BENDUNGAN CIAWI'] = { jam: jam, tma: tma, debit: s.debit, siaga: s.status, age: age };
    } else if (loc === 'inletciawi' || (name.includes('inlet') && name.includes('ciawi'))) {
      out['INLET BENDUNGAN CIAWI'] = { jam: jam, tma: tma, debit: s.debit, siaga: s.status, age: age };
    }
  }
  return out;
}
