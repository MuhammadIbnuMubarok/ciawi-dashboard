(function () {
  function esc(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
  var host = null, log = null, inp = null, btn = null, fab = null, hist = [];
  function buildBrief(){
    var L = [];
    L.push("WAKTU SEKARANG: " + new Date().toString());
    if (typeof REAL_DATA !== "undefined" && REAL_DATA && REAL_DATA.length) {
      var d = REAL_DATA;
      L.push("NERACA: " + d.length + " rekaman; rentang " + d[0].tanggal + " s/d " + d[d.length-1].tanggal);
      var by = {};
      d.forEach(function (r) { if (!r || !r.tanggal) return; var k = String(r.tanggal).slice(0,7); var o = by[k] || (by[k] = { n:0, maxEl:-1e9, maxQin:-1e9, maxQout:-1e9, sed:0 }); o.n++; if ((r.elevasi||-1e9) > o.maxEl) o.maxEl = r.elevasi; if ((r.qin||-1e9) > o.maxQin) o.maxQin = r.qin; var qt = (r.qout_total!==undefined?r.qout_total:r.qout); if ((qt||-1e9) > o.maxQout) o.maxQout = qt; o.sed += (r.sedimen||0); });
      Object.keys(by).sort().slice(-36).forEach(function (k) { var o = by[k]; L.push(k + ": n=" + o.n + " elevMaks=" + (o.maxEl===-1e9?"-":o.maxEl.toFixed(2)) + " qinMaks=" + (o.maxQin===-1e9?"-":o.maxQin.toFixed(2)) + " qoutMaks=" + (o.maxQout===-1e9?"-":o.maxQout.toFixed(2)) + " sedTotal=" + o.sed.toFixed(2)); });
      var last = d[d.length-1];
      L.push("REKAM TERAKHIR: " + last.tanggal + " " + (last.jam||"") + " elev=" + last.elevasi + " vol=" + (last.vol!==undefined?last.vol:last.volume) + " qout=" + (last.qout_total!==undefined?last.qout_total:last.qout) + " qin=" + last.qin + " status=" + (last.status||"-"));
    }
    var g = function (id) { var e = document.getElementById(id); return e ? (e.textContent || "").trim() : null; };
    var le = g("live-elv"), lv = g("live-vol"), lq = g("live-qout"), lr = g("live-red"), ls = g("live-status");
    if (le) L.push("LIVE SEKARANG: ELV=" + le + " VOL=" + lv + " QOUT=" + lq + " RED=" + lr + " STATUS=" + ls);
    return L.join("\n");
  }
  function addBubble(role, text){
    var d = document.createElement("div");
    d.style.cssText = "margin:6px 0;padding:8px 10px;border-radius:10px;max-width:85%;white-space:pre-wrap;font-size:12px;line-height:1.5;" + (role === "user" ? "margin-left:auto;background:#0e7490;color:#e0f2fe;" : "background:#111c33;color:#dbe7f7;border:1px solid #1c2a4b;");
    d.innerHTML = esc(text);
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
    return d;
  }
  function kirim(){
    var q = (inp.value || "").trim();
    if (!q) return;
    inp.value = "";
    addBubble("user", q);
    hist.push({ role: "user", text: q });
    var think = addBubble("model", "…menganalisis…");
    fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brief: buildBrief(), messages: hist.slice(-6) }) })
      .then(function (r) { return r.json().catch(function () { return null; }); })
      .then(function (j) {
        think.remove();
        if (j && j.ok) { addBubble("model", j.reply); hist.push({ role: "model", text: j.reply }); }
        else { addBubble("model", "Maaf, analis gagal menjawab: " + ((j && j.error) || "tidak diketahui")); }
      })
      .catch(function () { think.remove(); addBubble("model", "Jaringan terputus - coba lagi."); });
  }
  function siap(){
    if (document.getElementById("ai-fab")) return;
    fab = document.createElement("button");
    fab.id = "ai-fab";
    fab.textContent = "?? AI ANALIS";
    fab.style.cssText = "position:fixed;right:18px;bottom:18px;z-index:70;padding:10px 14px;border-radius:999px;background:#0e7490;color:#e0f2fe;font-weight:700;border:1px solid #22d3ee;cursor:pointer;";
    host = document.createElement("div");
    host.id = "ai-host";
    host.style.cssText = "position:fixed;right:18px;bottom:64px;z-index:70;width:340px;max-width:92vw;height:420px;background:#0b132b;border:1px solid #1c2a4b;border-radius:12px;display:none;flex-direction:column;box-shadow:0 10px 30px rgba(0,0,0,.5);";
    host.innerHTML = "<div style=\"padding:8px 10px;border-bottom:1px solid #1c2a4b;display:flex;justify-content:space-between;align-items:center;\"><b style=\"color:#7dd3fc;font-size:12px;\">?? AI ANALIS BENDUNGAN CIAWI</b><button id=\"ai-close\" style=\"background:none;border:none;color:#94a3b8;cursor:pointer;font-size:14px;\">?</button></div><div id=\"ai-log\" style=\"flex:1;overflow-y:auto;padding:8px;\"></div><div style=\"display:flex;gap:6px;padding:8px;border-top:1px solid #1c2a4b;\"><input id=\"ai-inp\" placeholder=\"Tanya apa saja…\" style=\"flex:1;background:#111c33;border:1px solid #1c2a4b;color:#e2e8f0;border-radius:8px;padding:8px;font-size:12px;\" /><button id=\"ai-send\" style=\"background:#0e7490;border:none;color:#e0f2fe;border-radius:8px;padding:8px 10px;cursor:pointer;font-weight:700;\">?</button></div>";
    document.body.appendChild(fab);
    document.body.appendChild(host);
    log = document.getElementById("ai-log");
    inp = document.getElementById("ai-inp");
    btn = document.getElementById("ai-send");
    fab.onclick = function () { host.style.display = host.style.display === "none" ? "flex" : "none"; if (host.style.display === "flex") inp.focus(); };
    document.getElementById("ai-close").onclick = function () { host.style.display = "none"; };
    btn.onclick = kirim;
    inp.addEventListener("keydown", function (e) { if (e.key === "Enter") kirim(); });
    addBubble("model", "Halo! Saya AI Analis Bendungan Ciawi. Tanya apa saja - data neraca, piezometer, banjir, atau hal lain di luar bendungan. Saya menjawab dari data riil bila menyangkut bendungan.");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", siap); else siap();
})();
