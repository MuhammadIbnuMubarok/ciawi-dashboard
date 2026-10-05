(function(){
  var DATA=null, BRIEF="";
  var PAL=["#22d3ee","#f59e0b","#a78bfa","#34d399","#f472b6","#60a5fa","#fbbf24","#4ade80","#e879f9","#38bdf8","#fb7185","#84cc16","#c084fc","#f97316","#2dd4bf","#818cf8","#facc15","#4d7c0f","#be185d","#0ea5e9","#65a30d","#d946ef","#dc2626","#16a34a","#7c3aed"];
  function build(){
    if(!DATA) return "";
    var L=["PIEZOMETER & CURAH HUJAN ARSIP (sumber MONITORING V W Pizometer, "+DATA.meta.sheets.length+" sheet: "+DATA.meta.sheets.join(", ")+"):"];
    L.push("Interpretasi terkini "+(DATA.instrumen || []).length+" alat:");
    (DATA.instrumen || []).forEach(function (o) { L.push(o.kode+" STA"+o.sta+" tip="+o.elevTip+" top="+o.elevTop+" tekanan="+o.tekanan+"mH2O elvTekanan="+o.elvTekanan+" Ru="+o.ru+" ijin="+o.elvIjin+" "+o.ket); });
    var h=DATA.hujan; if(h&&h.length){ var tot=0, mx=h[0]; h.forEach(function(x){ tot+=x.mm; if(x.mm>mx.mm) mx=x; }); L.push("Hujan: "+h.length+" hari "+h[0].tanggal+" s/d "+h[h.length-1].tanggal+", total="+tot.toFixed(1)+"mm, harian maks="+mx.mm+"mm pada "+mx.tanggal); }
    var codes=Object.keys(DATA.seri);
    L.push("Seri bacaan "+codes.length+" instrumen:");
    codes.forEach(function(c){ var s=DATA.seri[c]; if(!s||!s.length) return; var last=s[s.length-1], first=s[0], mn=last[1], mxx=last[1]; s.forEach(function(p){ if(p[1]<mn)mn=p[1]; if(p[1]>mxx)mxx=p[1]; }); var old=s[Math.max(0,s.length-91)][1]; L.push(c+": n="+s.length+" "+first[0]+".."+last[0]+" min="+mn+" max="+mxx+" terakhir="+last[1]+" delta90hari="+(last[1]-old).toFixed(1)); });
    return L.join("\n");
  }
  function groupOf(k){ if (k.indexOf("@310")>=0) return "STA 0+310"; if (k.indexOf("@377.5")>=0) return "STA 0+377.5"; return "LAINNYA"; }
  function codeOf(k){ return k.split("@")[0]; }
  function tOf(d){ return Date.parse(d)/86400000; }
  function draw(cv, group){
    var g=cv.getContext("2d"), W=cv.width, H=cv.height;
    g.clearRect(0,0,W,H); g.fillStyle="#0b132b"; g.fillRect(0,0,W,H);
    var keys=Object.keys(DATA.seri).filter(function(k){ return groupOf(k)===group; });
    if(!keys.length) return;
    var t0=1e18,t1=-1e18,v0=1e18,v1=-1e18;
    keys.forEach(function(k){ DATA.seri[k].forEach(function(p){ var t=tOf(p[0]); if(t<t0)t0=t; if(t>t1)t1=t; if(p[1]<v0)v0=p[1]; if(p[1]>v1)v1=p[1]; }); });
    v0=Math.min(v0,551.367)-1; v1=Math.max(v1,551.367)+1;
    var L=46,R=W-12,T=26,B=H-34;
    function X(t){ return L+(t-t0)/Math.max(1,t1-t0)*(R-L); }
    function Y(v){ return T+(1-(v-v0)/(v1-v0))*(B-T); }
    g.strokeStyle="#1c2a4b"; g.fillStyle="#64748b"; g.font="10px monospace"; g.lineWidth=1;
    for(var i=0;i<=5;i++){ var v=v0+(v1-v0)*i/5; var y=Y(v); g.beginPath(); g.moveTo(L,y); g.lineTo(R,y); g.stroke(); g.fillText(v.toFixed(1), 6, y+3); }
    var yr0=new Date(t0*86400000).getFullYear(), yr1=new Date(t1*86400000).getFullYear();
    for(var yy=yr0; yy<=yr1; yy++){ var tt=Date.parse(yy+"-01-01")/86400000; if(tt<t0||tt>t1) continue; var x=X(tt); g.strokeStyle="#233150"; g.beginPath(); g.moveTo(x,T); g.lineTo(x,B); g.stroke(); g.fillStyle="#64748b"; g.fillText(String(yy), x+2, H-22); }
    var hmax=1; (DATA.hujan||[]).forEach(function(h){ var t=tOf(h.tanggal); if(t>=t0&&t<=t1&&h.mm>hmax) hmax=h.mm; });
    g.fillStyle="rgba(245,158,11,.55)";
    (DATA.hujan||[]).forEach(function(h){ var t=tOf(h.tanggal); if(t<t0||t>t1||h.mm<=0) return; var x=X(t); var bh=(h.mm/hmax)*(B-T)*0.22; g.fillRect(x-0.6, B-bh, 1.2, bh); });
    g.strokeStyle="#e2e8f0"; g.setLineDash([6,4]); g.beginPath(); g.moveTo(L,Y(551.367)); g.lineTo(R,Y(551.367)); g.stroke(); g.setLineDash([]);
    g.fillStyle="#e2e8f0"; g.fillText("ELV. TOP MAINDAM 551.367", L+4, Y(551.367)-4);
    keys.forEach(function(k,ki){
      g.strokeStyle=PAL[ki%PAL.length]; g.lineWidth=1.4; g.beginPath();
      DATA.seri[k].forEach(function(p,idx){ var x=X(tOf(p[0])), y=Y(p[1]); if(idx===0) g.moveTo(x,y); else g.lineTo(x,y); });
      g.stroke();
    });
    g.lineWidth=1;
    g.fillStyle="#7dd3fc"; g.font="12px monospace"; g.fillText("GRAFIK TEKANAN AIR PORI (mH2O) - PIEZOMETER VIBRATING WIRE - "+group, L, 14);
    g.fillStyle="#f59e0b"; g.font="10px monospace"; g.fillText("batang = curah hujan harian (maks "+hmax.toFixed(0)+" mm)", R-260, 14);
    var leg=document.getElementById("pz-leg");
    if(leg){ leg.innerHTML=""; keys.forEach(function(k,ki){ var s=document.createElement("span"); s.style.cssText="display:inline-block;margin:2px 8px 2px 0;font:10px monospace;color:"+PAL[ki%PAL.length]; s.textContent="# "+codeOf(k); leg.appendChild(s); }); }
  }
  // Card arsip tidak lagi dimount ke dashboard pemantauan (permintaan 2026-10-05).
    // Grafik interaktif Piezometer di header (pz-panel.js) TIDAK terpengaruh -
    // file ini hanya menyediakan card tambahan + fallback jawaban AI.
    function render(){
      var lama=document.getElementById("piezo-arsip-card"); if(lama) lama.remove();
      return;
      /* eslint-disable no-unreachable */
      if (document.getElementById("piezo-arsip-card")) return;
    var groups=["STA 0+310","STA 0+377.5","LAINNYA"].filter(function(gp){ return Object.keys(DATA.seri).some(function(k){ return groupOf(k)===gp; }); });
    if(!groups.length) return;
    var card=document.createElement("section"); card.id="piezo-arsip-card";
    card.style.cssText="width:min(1100px,96vw);margin:18px auto 90px auto;background:#0b132b;border:1px solid #1c2a4b;border-radius:12px;padding:12px;";
    card.innerHTML='<b style="color:#7dd3fc;font-size:13px;">GRAFIK ARSIP PIEZOMETER (9 SHEET) - GAYA EXCEL: garis per instrumen + batang hujan + garis puncak 551.367</b><div style="margin:8px 0;"><select id="pz-sel" style="background:#111c33;border:1px solid #1c2a4b;color:#e2e8f0;border-radius:8px;padding:6px;"></select> <span id="pz-info" style="color:#94a3b8;font-size:11px;"></span></div><canvas id="pz-cv" width="1060" height="340" style="width:100%;background:#0b132b;border-radius:8px;"></canvas><div id="pz-leg" style="margin-top:6px;"></div>';
    document.body.appendChild(card);
    var sel=card.querySelector("#pz-sel");
    groups.forEach(function(gp){ var o=document.createElement("option"); o.value=gp; o.textContent=gp; sel.appendChild(o); });
    function info(gp){ var n=Object.keys(DATA.seri).filter(function(k){ return groupOf(k)===gp; }).length; card.querySelector("#pz-info").textContent=n+" instrumen/seri"; }
    sel.onchange=function(){ draw(card.querySelector("#pz-cv"), sel.value); info(sel.value); };
    sel.value=groups[0]; draw(card.querySelector("#pz-cv"), groups[0]); info(groups[0]);
  }
  function tombolArsip(){
    // tombol GRAFIK ARSIP ikut dihapus dari nav dashboard; card-nya sudah tidak
    // ada. Pembersihan defensif kalau ada sisa dari cache DOM.
    var b=document.getElementById("btn-arsip-scroll"); if(b) b.remove();
    return;
    if (document.getElementById("btn-arsip-scroll")) return; var tgt=null; var bs=document.querySelectorAll("button"); for (var i=0;i<bs.length;i++){ if ((bs[i].textContent||"").trim()==="DASHBOARD") tgt=bs[i]; } var card=document.getElementById("piezo-arsip-card"); if (!tgt||!card) return; var nb=document.createElement("button"); nb.id="btn-arsip-scroll"; nb.textContent="GRAFIK ARSIP"; nb.style.cssText=tgt.style.cssText; nb.onclick=function(){ card.scrollIntoView({behavior:"smooth",block:"start"}); }; tgt.parentNode.insertBefore(nb, tgt.nextSibling); }
  function jawabLokal(q){ if(!DATA) return "MODE CADANGAN: arsip belum dimuat - segarkan halaman."; var s=(q||"").toLowerCase(); var L=["MODE CADANGAN (tanpa LLM) - dihitung langsung dari arsip ter-audit (9 sheet, "+Object.keys(DATA.seri).length+" seri, "+(DATA.hujan||[]).length+" hari hujan):"]; var h=DATA.hujan||[]; if(/hujan|curah/.test(s) && h.length){ var mx=h[0], tot=0; h.forEach(function(x){ tot+=x.mm; if(x.mm>mx.mm) mx=x; }); var top=h.slice().sort(function(a,b){ return b.mm-a.mm; }).slice(0,5); L.push("Curah hujan: "+h.length+" hari ("+h[0].tanggal+" s/d "+h[h.length-1].tanggal+"), total "+tot.toFixed(1)+" mm."); L.push("Harian maksimum: "+mx.mm+" mm pada "+mx.tanggal+"."); L.push("5 hari terbasah: "+top.map(function(x){ return x.tanggal+" ("+x.mm+" mm)"; }).join(", ")+"."); } var codes=Object.keys(DATA.seri); var sebut=(s.match(/(ppu|ppd|ppa|ptu|pta|ptd|osp)\s?\d+/g)||[])[0]; if(sebut){ var cs=sebut.replace(/\s/g,"").toUpperCase(), key=null; codes.forEach(function(k){ if(!key && k.split("@")[0]===cs) key=k; }); if(key){ var ser=DATA.seri[key], last=ser[ser.length-1], first=ser[0]; var mn=1e18, mxx=-1e18; ser.forEach(function(pp){ if(pp[1]<mn)mn=pp[1]; if(pp[1]>mxx)mxx=pp[1]; }); var old=ser[Math.max(0,ser.length-91)][1]; L.push(cs+" ("+key+"): n="+ser.length+" bacaan "+first[0]+" s/d "+last[0]+"; terakhir "+last[1]+" m; min "+mn.toFixed(2)+" m; maks "+mxx.toFixed(2)+" m; delta 90 hari "+(last[1]-old).toFixed(2)+" m."); } else L.push("Kode "+cs+" tidak ditemukan di arsip."); } if(/tren|naik|turun|cepat|perubahan/.test(s)){ var mv=codes.map(function(k){ var ser=DATA.seri[k]; var old=ser[Math.max(0,ser.length-91)][1]; return { k:k, d:ser[ser.length-1][1]-old }; }).sort(function(a,b){ return b.d-a.d; }); L.push("Kenaikan tercepat 90 hari: "+mv.slice(0,3).map(function(x){ return x.k+" (+"+x.d.toFixed(2)+" m)"; }).join(", ")+"."); L.push("Perubahan terendah 90 hari: "+mv.slice(-2).map(function(x){ return x.k+" ("+x.d.toFixed(2)+" m)"; }).join(", ")+"."); } if(/korelasi|hubungan|pengaruh/.test(s)){ var hm={}; h.forEach(function(x){ hm[x.tanggal]=x.mm; }); var ups=0,n=0,base=0,nb=0; codes.slice(0,8).forEach(function(k){ var ser=DATA.seri[k]; for(var i=1;i<ser.length-3;i++){ var d0=ser[i-1][1], d3=ser[i+3][1]; var rain=(hm[ser[i][0]]||0)+(hm[ser[i-1][0]]||0); if(rain>=20){ ups+=d3-d0; n++; } else if(rain===0){ base+=d3-d0; nb++; } } }); if(n&&nb) L.push("Korelasi kasar: rata-rata perubahan elevasi tekanan 3 hari selepas hujan >=20 mm = "+(ups/n).toFixed(2)+" m ("+n+" kejadian); pada hari kering = "+(base/nb).toFixed(2)+" m ("+nb+" kejadian)."); } if(L.length<=1){ var tot2=0, mnD="9999-99-99", mxD="0000-00-00"; codes.forEach(function(k){ var ser=DATA.seri[k]; tot2+=ser.length; if(ser[0][0]<mnD)mnD=ser[0][0]; if(ser[ser.length-1][0]>mxD)mxD=ser[ser.length-1][0]; }); L.push("Ringkasan arsip: "+codes.length+" seri ("+tot2+" titik) lintas STA 0+310 & 0+377.5; rentang "+mnD+" s/d "+mxD+"; hujan "+h.length+" hari total "+h.reduce(function(a,x){ return a+x.mm; },0).toFixed(1)+" mm; acuan puncak 551.367 m."); L.push("Tanya spesifik: hujan maksimum, tren instrumen (sebut kode mis. PTA2), atau korelasi hujan-tekanan."); } return L.join("\n"); }
function cadangan(q){ return new Response(JSON.stringify({ ok:true, reply: jawabLokal(q), mode:"cadangan" }), { status:200, headers:{ "Content-Type":"application/json" } }); }
function siap(){
    fetch("data/piezo-arsip.json?v=1").then(function(r){ if(!r.ok) throw 0; return r.json(); }).then(function(j){ DATA=j; BRIEF=build(); render(); tombolArsip(); if (!window._arsipBtnTimer) { window._arsipBtnTimer = setInterval(tombolArsip, 4000); } var orig=window.fetch; window.fetch=function(u,o){ try{ if(typeof u==="string"&&u.indexOf("/api/ai")>=0&&o&&o.body){ var b=JSON.parse(o.body); b.brief=(b.brief||"")+"\n"+BRIEF; o=Object.assign({},o,{body:JSON.stringify(b)}); } }catch(e){} return orig.call(window,u,o).then(function(resp){ if(!(typeof u==="string"&&u.indexOf("/api/ai")>=0)) return resp; var q=""; try{ q=((JSON.parse((o&&o.body)||"{}").messages)||[]).slice(-1)[0].text||""; }catch(e){} if(resp&&resp.ok){ return resp.json().then(function(j){ if(j&&j.ok) return new Response(JSON.stringify(j),{status:200,headers:{"Content-Type":"application/json"}}); return cadangan(q); }).catch(function(){ return cadangan(q); }); } return cadangan(q); }).catch(function(){ var q2=""; try{ q2=((JSON.parse((o&&o.body)||"{}").messages)||[]).slice(-1)[0].text||""; }catch(e){} return cadangan(q2); }); }; }).catch(function(){});
  }
  if (document.readyState==="loading") document.addEventListener("DOMContentLoaded", siap); else siap();
})();