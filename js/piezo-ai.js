(function(){
  var DATA=null, BRIEF="";
  function build(){
    if(!DATA) return "";
    var L=["PIEZOMETER & CURAH HUJAN ARSIP (sumber MONITORING V W Pizometer, "+DATA.meta.sheets.length+" sheet: "+DATA.meta.sheets.join(", ")+"):"];
    L.push("Interpretasi terkini "+(DATA.instrumen || []).length+" alat:");
    (DATA.instrumen || []).forEach(function(o){ L.push(o.kode+" STA"+o.sta+" tip="+o.elevTip+" top="+o.elevTop+" tekanan="+o.tekanan+"mH2O elvTekanan="+o.elvTekanan+" Ru="+o.ru+" ijin="+o.elvIjin+" "+o.ket); });
    var h=DATA.hujan; if(h&&h.length){ var tot=0, mx=h[0]; h.forEach(function(x){ tot+=x.mm; if(x.mm>mx.mm) mx=x; }); L.push("Hujan: "+h.length+" hari "+h[0].tanggal+" s/d "+h[h.length-1].tanggal+", total="+tot.toFixed(1)+"mm, harian maks="+mx.mm+"mm pada "+mx.tanggal); }
    var codes=Object.keys(DATA.seri).filter(function(k){ return k.charAt(0)!=="_"; });
    L.push("Seri bacaan "+codes.length+" instrumen:");
    codes.forEach(function(c){ var s=DATA.seri[c]; if(!s||!s.length) return; var last=s[s.length-1], first=s[0], mn=last[1], mxx=last[1]; s.forEach(function(p){ if(p[1]<mn)mn=p[1]; if(p[1]>mxx)mxx=p[1]; }); var old=s[Math.max(0,s.length-91)][1]; L.push(c+": n="+s.length+" "+first[0]+".."+last[0]+" min="+mn+" max="+mxx+" terakhir="+last[1]+" delta90hari="+(last[1]-old).toFixed(1)); });
    return L.join("\n");
  }
  function draw(cv, code){
    var g=cv.getContext("2d"), W=cv.width, H=cv.height; g.clearRect(0,0,W,H);
    var s=(DATA&&DATA.seri[code])||[]; if(!s.length) return;
    var pts=s.slice(-365), mn=1e18, mx=-1e18; pts.forEach(function(p){ if(p[1]<mn)mn=p[1]; if(p[1]>mx)mx=p[1]; });
    var hmap={}; (DATA.hujan||[]).slice(-365).forEach(function(x){ hmap[x.tanggal]=x.mm; }); var hmx=1; pts.forEach(function(p){ var v=hmap[p[0]]||0; if(v>hmx)hmx=v; });
    g.strokeStyle="#1c2a4b"; g.lineWidth=1; for(var y=0;y<5;y++){ g.beginPath(); g.moveTo(40,20+y*(H-50)/4); g.lineTo(W-10,20+y*(H-50)/4); g.stroke(); }
    g.fillStyle="#f59e0b"; pts.forEach(function(p,i){ var v=hmap[p[0]]||0; if(v<=0) return; var x=40+i*(W-50)/Math.max(1,pts.length-1); var bh=(v/hmx)*(H-60); g.fillRect(x-1, H-30-bh, 2, bh); });
    g.strokeStyle="#22d3ee"; g.lineWidth=2; g.beginPath();
    pts.forEach(function(p,i){ var x=40+i*(W-50)/Math.max(1,pts.length-1); var y=20+(1-(p[1]-mn)/Math.max(1e-9,mx-mn))*(H-50); if(i===0)g.moveTo(x,y); else g.lineTo(x,y); });
    g.stroke();
    g.fillStyle="#7dd3fc"; g.font="11px monospace"; g.fillText(code+"  min="+mn.toFixed(1)+" max="+mx.toFixed(1)+" terakhir="+pts[pts.length-1][1], 44, 14);
    g.fillStyle="#f59e0b"; g.fillText("batang = curah hujan (maks "+hmx+"mm)", W-230, 14);
  }
  function tombolArsip(){ if (document.getElementById("btn-arsip-scroll")) return; var tgt = null; var bs = document.querySelectorAll("button"); for (var i = 0; i < bs.length; i++) { if ((bs[i].textContent || "").trim() === "DASHBOARD") tgt = bs[i]; } var card = document.getElementById("piezo-arsip-card"); if (!tgt || !card) return; var nb = document.createElement("button"); nb.id = "btn-arsip-scroll"; nb.textContent = "GRAFIK ARSIP"; nb.style.cssText = tgt.style.cssText; nb.onclick = function () { card.scrollIntoView({ behavior: "smooth", block: "start" }); }; tgt.parentNode.insertBefore(nb, tgt.nextSibling); }
  function render(){
    if (document.getElementById("piezo-arsip-card")) return;
    var codes=Object.keys(DATA.seri).filter(function(k){ return k.charAt(0)!=="_"; });
    if(!codes.length) return;
    var card=document.createElement("section"); card.id="piezo-arsip-card";
    card.style.cssText="width:min(980px,96vw);margin:18px auto 90px auto;background:#0b132b;border:1px solid #1c2a4b;border-radius:12px;padding:12px;";
    card.innerHTML='<b style="color:#7dd3fc;font-size:13px;">GRAFIK ARSIP PIEZOMETER ('+DATA.meta.sheets.length+' SHEET) + CURAH HUJAN</b><div style="margin:8px 0;"><select id="pz-sel" style="background:#111c33;border:1px solid #1c2a4b;color:#e2e8f0;border-radius:8px;padding:6px;"></select> <span id="pz-info" style="color:#94a3b8;font-size:11px;"></span></div><canvas id="pz-cv" width="940" height="280" style="width:100%;background:#0b132b;border-radius:8px;"></canvas>';
    document.body.appendChild(card);
    var sel=card.querySelector("#pz-sel");
    codes.forEach(function(c){ var o=document.createElement("option"); o.value=c; o.textContent=c; sel.appendChild(o); });
    sel.onchange=function(){ draw(card.querySelector("#pz-cv"), sel.value); card.querySelector("#pz-info").textContent=(DATA.seri[sel.value]||[]).length+" bacaan"; };
    sel.value=codes[0]; draw(card.querySelector("#pz-cv"), codes[0]); card.querySelector("#pz-info").textContent=(DATA.seri[codes[0]]||[]).length+" bacaan";
  }
  function siap(){
    fetch("data/piezo-arsip.json?v=1").then(function(r){ if(!r.ok) throw 0; return r.json(); }).then(function(j){ DATA=j; BRIEF=build(); render(); tombolArsip(); if (!window._arsipBtnTimer) { window._arsipBtnTimer = setInterval(tombolArsip, 4000); } var orig=window.fetch; window.fetch=function(u,o){ try{ if(typeof u==="string"&&u.indexOf("/api/ai")>=0&&o&&o.body){ var b=JSON.parse(o.body); b.brief=(b.brief||"")+"\n"+BRIEF; o=Object.assign({},o,{body:JSON.stringify(b)}); } }catch(e){} return orig.call(window,u,o); }; }).catch(function(){});
  }
  if (document.readyState==="loading") document.addEventListener("DOMContentLoaded", siap); else siap();
})();