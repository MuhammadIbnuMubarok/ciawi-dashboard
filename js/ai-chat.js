(function () {
  function esc(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
  var host = null, log = null, inp = null, btn = null, fab = null, hist = [];
  function buildBrief(){
    var lines = [];
    lines.push("WAKTU SEKARANG: " + new Date().toString());
    if (typeof REAL_DATA !== "undefined" && REAL_DATA && REAL_DATA.length) {
      var d = REAL_DATA;
      lines.push("NERACA: " + d.length + " rekaman; rentang " + d[0].tanggal + " s/d " + d[d.length-1].tanggal);
      var by = {};
      d.forEach(function (row) {
        if (!row || !row.tanggal) return;
        var key = String(row.tanggal).slice(0,7);
        var obj = by[key] || (by[key] = { n:0, maxEl:-1e9, maxQin:-1e9, maxQout:-1e9, sed:0 });
        obj.n++;
        if ((row.elevasi||-1e9) > obj.maxEl) obj.maxEl = row.elevasi;
        if ((row.qin||-1e9) > obj.maxQin) obj.maxQin = row.qin;
        var qt = (row.qout_total!==undefined?row.qout_total:row.qout);
        if ((qt||-1e9) > obj.maxQout) obj.maxQout = qt;
        obj.sed += (row.sedimen||0);
      });
      var keys = Object.keys(by).sort().slice(-36);
      keys.forEach(function (key) {
        var obj = by[key];
        lines.push(key + ": n=" + obj.n + " elevMaks=" + (obj.maxEl===-1e9?"-":obj.maxEl.toFixed(2)) + " qinMaks=" + (obj.maxQin===-1e9?"-":obj.maxQin.toFixed(2)) + " qoutMaks=" + (obj.maxQout===-1e9?"-":obj.maxQout.toFixed(2)) + " sedTotal=" + obj.sed.toFixed(2));
      });
      var last = d[d.length-1];
      lines.push("REKAM TERAKHIR: " + last.tanggal + " " + (last.jam||"") + " elev=" + last.elevasi + " vol=" + (last.vol!==undefined?last.vol:last.volume) + " qout=" + (last.qout_total!==undefined?last.qout_total:last.qout) + " qin=" + last.qin + " status=" + (last.status||"-"));
    }
    var getter = function (id) {
      var el = document.getElementById(id);
      return el ? (el.textContent || "").trim() : null;
    };
    var le = getter("live-elv"), lv = getter("live-vol"), lq = getter("live-qout"), lr = getter("live-red"), ls = getter("live-status");
    if (le) lines.push("LIVE SEKARANG: ELV=" + le + " VOL=" + lv + " QOUT=" + lq + " RED=" + lr + " STATUS=" + ls);
    return lines.join("\n");
  }
  function addBubble(role, text){
    var div = document.createElement("div");
    div.style.cssText = "margin:6px 0;padding:8px 10px;border-radius:10px;max-width:85%;white-space:pre-wrap;font-size:12px;line-height:1.5;" + (role === "user" ? "margin-left:auto;background:#0e7490;color:#e0f2fe;" : "background:#111c33;color:#dbe7f7;border:1px solid #1c2a4b;");
    div.innerHTML = esc(text);
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
    return div;
  }
  function kirim(){
    var q = (inp.value || "").trim();
    if (!q) return;
    inp.value = "";
    addBubble("user", q);
    hist.push({ role: "user", text: q });
    var think = addBubble("model", "...menganalisis...");
    fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brief: buildBrief(), messages: hist.slice(-6) }) })
      .then(function (resp) { return resp.json().catch(function () { return null; }); })
      .then(function (json) {
        think.remove();
        if (json && json.ok) { addBubble("model", json.reply); hist.push({ role: "model", text: json.reply }); }
        else { addBubble("model", "Maaf, analis gagal menjawab: " + ((json && json.error) || "tidak diketahui")); }
      })
      .catch(function () { think.remove(); addBubble("model", "Jaringan terputus - coba lagi."); });
  }
  function siap(){
    if (document.getElementById("ai-fab")) return;
    fab = document.createElement("button");
    fab.id = "ai-fab";
    fab.textContent = "🤖 AI ANALIS";
    fab.style.cssText = "position:fixed;left:18px;bottom:18px;z-index:70;padding:10px 14px;border-radius:999px;background:#0e7490;color:#e0f2fe;font-weight:700;border:1px solid #22d3ee;cursor:pointer;";
    host = document.createElement("div");
    host.id = "ai-host";
    host.style.cssText = "position:fixed;left:18px;bottom:64px;z-index:70;width:340px;max-width:92vw;height:420px;background:#0b132b;border:1px solid #1c2a4b;border-radius:12px;display:none;flex-direction:column;box-shadow:0 10px 30px rgba(0,0,0,.5);";
    host.innerHTML = '<div style="padding:8px 10px;border-bottom:1px solid #1c2a4b;display:flex;justify-content:space-between;align-items:center;"><b style="color:#7dd3fc;font-size:12px;">🤖 AI ANALIS BENDUNGAN CIAWI</b><button id="ai-close" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:14px;">✕</button></div><div id="ai-log" style="flex:1;overflow-y:auto;padding:8px;"></div><div style="display:flex;gap:6px;padding:8px;border-top:1px solid #1c2a4b;"><input id="ai-inp" placeholder="Tanya apa saja..." style="flex:1;background:#111c33;border:1px solid #1c2a4b;color:#e2e8f0;border-radius:8px;padding:8px;font-size:12px;" /><button id="ai-send" style="background:#0e7490;border:none;color:#e0f2fe;border-radius:8px;padding:8px 10px;cursor:pointer;font-weight:700;">➤</button></div>';
    document.body.appendChild(fab);
    document.body.appendChild(host);
    log = document.getElementById("ai-log");
    inp = document.getElementById("ai-inp");
    btn = document.getElementById("ai-send");
    fab.onclick = function () { host.style.display = host.style.display === "none" ? "flex" : "none"; if (host.style.display === "flex") inp.focus(); };
    document.getElementById("ai-close").onclick = function () { host.style.display = "none"; };
    btn.onclick = kirim;
    inp.addEventListener("keydown", function (ev) { if (ev.key === "Enter") kirim(); });
    addBubble("model", "Halo! Saya AI Analis Bendungan Ciawi. Tanya apa saja - data neraca, piezometer, banjir, atau hal lain di luar bendungan. Saya menjawab dari data riil bila menyangkut bendungan.");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", siap); else siap();
})();