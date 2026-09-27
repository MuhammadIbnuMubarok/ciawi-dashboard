(function(){
  function siap(){
    if (typeof REAL_DATA === "undefined" || !REAL_DATA || !REAL_DATA.length) { setTimeout(siap, 800); return; }
    var tb = null;
    var tables = document.querySelectorAll("table");
    for (var i=0;i<tables.length;i++){ var tt = tables[i].textContent || ""; if (tt.indexOf("QOUT KONDUIT") >= 0 && tt.indexOf("REDUKSI") >= 0) { tb = tables[i].querySelector("tbody"); break; } }
    if (!tb) return;
    var tbl = tb.closest("table");
    if (tbl) tbl.classList.add("tbl-rapi");
    var ins = [];
    var all = document.querySelectorAll("input[type=date]");
    for (var d=0;d<all.length;d++){ var el=all[d]; if (el.closest("#pzOverlay") || el.closest("#rtsOverlay")) continue; ins.push(el); }
    var dari = ins[0] || null, sd = ins[1] || null;
    var pageSizeSel = document.getElementById("page-size-select");
    var state = { page: 1 };
    var st2 = document.createElement("style");
    st2.textContent = ".tbl-rapi{table-layout:fixed;width:100%;} .tbl-rapi th{white-space:normal;vertical-align:middle;} .tbl-rapi td{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;vertical-align:middle;} .tbl-rapi td:nth-child(1){width:86px;} .tbl-rapi td:nth-child(2){width:96px;} .tbl-rapi td:nth-child(3){width:64px;} .tbl-rapi td:nth-child(13){width:92px;}";
    document.head.appendChild(st2);
    function liveRows(){
      var out = [];
      for (var k=0;k<localStorage.length;k++){
        var key = localStorage.key(k);
        if (key.indexOf("ciawi") !== 0) continue;
        try {
          var v = JSON.parse(localStorage.getItem(key));
          if (Object.prototype.toString.call(v) === "[object Array]") {
            for (var q=0;q<v.length;q++){ var r=v[q]; if (r && r.tanggal && (r.elevasi!==undefined || r.tmaIn!==undefined)) out.push(r); }
          }
        } catch(e){}
      }
      return out;
    }
    function pick(r, pats, excl) {
      var ks = Object.keys(r);
      for (var i=0;i<pats.length;i++){
        for (var k=0;k<ks.length;k++){
          var key = ks[k].toLowerCase();
          if (key.indexOf(pats[i]) < 0) continue;
          var bad = false;
          if (excl) { for (var x=0;x<excl.length;x++){ if (key.indexOf(excl[x]) >= 0) { bad = true; break; } } }
          if (bad) continue;
          var v = parseFloat(String(r[ks[k]]).replace(",","."));
          if (!isNaN(v)) return v;
        }
      }
      return null;
    }
    function picks(r, pats) {
      var ks = Object.keys(r);
      for (var i=0;i<pats.length;i++){
        for (var k=0;k<ks.length;k++){
          var key = ks[k].toLowerCase();
          if (key.indexOf(pats[i]) >= 0) { var v = String(r[ks[k]]); if (v) return v; }
        }
      }
      return null;
    }
    function norm(r, no, tag) {
      var tanggal = picks(r, ["tanggal","date"]) || "";
      var jam = picks(r, ["jam","waktu"]) || "-";
      var elevasi = pick(r, ["elevasi","elev","tma"], ["izin"]);
      var sedimen = pick(r, ["sedimen","sediment"]);
      var bukaan = pick(r, ["bukaan","opening","gate"]);
      var qs = pick(r, ["spillway","pelimpah","qouts"]);
      var qk = pick(r, ["konduit","qoutk"], ["bukaan","spillway","total"]);
      var qt = pick(r, ["total","qoutt"]);
      var qin = pick(r, ["qin","inflow","masuk"], ["qout"]);
      var red = pick(r, ["reduksi","redaman","reduction"]);
      var volume = pick(r, ["volume","tampungan","vol"]);
      var status = picks(r, ["status","kondisi"]) || null;
      if (qt === null && qk !== null && qs !== null) qt = qk + qs;
      if (qs === null && qt !== null && qk !== null) qs = qt - qk;
      if (qk === null && qt !== null && qs !== null) qk = qt - qs;
      if (red === null && qin !== null && qt !== null) red = qin - qt;
      return { no: no, tanggal: String(tanggal).slice(0,10), jam: jam, elevasi: elevasi, sedimen: sedimen, bukaan: bukaan, volume: volume, qk: qk, qs: qs, qt: qt, qin: qin, red: red, status: status, tag: tag };
    }
    function unified(){
      var rows = [];
      for (var a=0;a<REAL_DATA.length;a++){
        var r = REAL_DATA[a];
        if (!r || !r.tanggal) continue;
        rows.push(norm(r, a+1, "NERACA"));
      }
      var lv = liveRows();
      for (var b=0;b<lv.length;b++){
        var L = lv[b];
        if (typeof computeLiveNeraca === "function" && L.tmaIn !== undefined && L.tmaOut !== undefined) {
          try {
            var lr = computeLiveNeraca(L.tmaIn, L.tmaOut, 0);
            if (lr) { var ks2 = Object.keys(lr); for (var z=0;z<ks2.length;z++){ if (L[ks2[z]] === undefined) L[ks2[z]] = lr[ks2[z]]; } if (L.bukaan === undefined && L.F !== undefined) L.bukaan = L.F; }
          } catch(e){}
        }
        rows.push(norm(L, L.no || (200000+b+1), "LIVE"));
      }
      rows.sort(function(x,y){ return x.tanggal<y.tanggal?1:(x.tanggal>y.tanggal?-1:0); });
      return rows;
    }
    function probeBukaan(qk, elev){
      if (qk===null||qk===undefined) return null;
      var names = ["bukaanKonduit","hitungBukaan","bukaanDariQ","konduitBukaan","ratingBukaan","bukaanFromQout","qoutToBukaan","bukaanK"];
      for (var i=0;i<names.length;i++){ var f = window[names[i]]; if (typeof f === "function") { try { var v = f(qk, elev); if (typeof v === "number" && !isNaN(v)) return v; } catch(e){} } }
      return null;
    }
    function fmt(x,d){ if (x===null||x===undefined||isNaN(x)) return "-"; var p=Math.pow(10,d||2); return (Math.round(x*p)/p).toLocaleString("id-ID",{minimumFractionDigits:0,maximumFractionDigits:d||2}); }
    function render(){
      var all = unified();
      var d1 = dari ? dari.value : "";
      var d2 = sd ? sd.value : "";
      var rows = all.filter(function(r){ return (!d1 || r.tanggal >= d1) && (!d2 || r.tanggal <= d2); });
      var ps = (pageSizeSel && pageSizeSel.value !== "all") ? parseInt(pageSizeSel.value,10) : rows.length;
      var pages = Math.max(1, Math.ceil(rows.length / ps));
      if (state.page > pages) state.page = pages;
      var start = (state.page-1)*ps;
      var slice = rows.slice(start, start+ps);
      var html = "";
      for (var i=0;i<slice.length;i++){
        var r = slice[i];
        var F = (typeof fmt2==="function")?fmt2:fmt;
        var st = (typeof statusBadge==="function" && r.status) ? statusBadge(r.status) : (r.status || "-");
        var bk = r.bukaan;
        if (bk===null || bk===undefined) bk = probeBukaan(r.qk, r.elevasi);
        html += "<tr>" + "<td class=\"py-2 px-3\">" + r.no + " <span style=\"font-size:9px;opacity:.55\">" + r.tag + "</span></td>" + "<td class=\"py-2 px-3\">" + r.tanggal + "</td>" + "<td class=\"py-2 px-3\">" + (r.jam||"-") + "</td>" + "<td class=\"py-2 px-3\">" + F(r.elevasi) + "</td>" + "<td class=\"py-2 px-3\">" + F(r.sedimen) + "</td>" + "<td class=\"py-2 px-3\">" + F(bk) + "</td>" + "<td class=\"py-2 px-3\">" + F(r.volume) + "</td>" + "<td class=\"py-2 px-3\">" + F(r.qk) + "</td>" + "<td class=\"py-2 px-3\">" + F(r.qs) + "</td>" + "<td class=\"py-2 px-3\">" + F(r.qt) + "</td>" + "<td class=\"py-2 px-3\">" + F(r.qin) + "</td>" + "<td class=\"py-2 px-3\">" + F(r.red) + "</td>" + "<td class=\"py-2 px-3\">" + st + "</td>" + "</tr>";
      }
      if (!slice.length) html = "<tr><td colspan=\"13\" style=\"padding:24px;text-align:center\">Tidak ada data pada rentang ini</td></tr>";
      tb.innerHTML = html;
      var rc = document.getElementById("tbl-rowcount");
      if (rc) rc.textContent = "Menampilkan " + (rows.length? start+1:0) + "-" + Math.min(start+ps, rows.length) + " dari " + rows.length + " rekaman";
      var bd = document.getElementById("tbl-badge-summary");
      if (bd) bd.textContent = rows.length + " REKAMAN (NERACA+LIVE)";
      var pg = document.getElementById("tbl-pagination");
      if (pg) { pg.innerHTML = "<span>" + state.page + " / " + pages + "</span>"; }
      var bp = document.getElementById("btn-prev-page");
      if (bp) { bp.onclick = function(){ bridgePage(-1); }; bp.disabled = state.page <= 1; }
      var bn = document.getElementById("btn-next-page");
      if (bn) { bn.onclick = function(){ bridgePage(1); }; bn.disabled = state.page >= pages; }
    }
    window.bridgePage = function(d){ state.page += d; render(); };
    if (dari) dari.addEventListener("change", function(){ state.page=1; render(); });
    if (sd) sd.addEventListener("change", function(){ state.page=1; render(); });
    if (pageSizeSel) pageSizeSel.addEventListener("change", function(){ state.page=1; render(); });
    var origAF = window.applyFilters;
    window.applyFilters = function(){ var r = origAF ? origAF.apply(this, arguments) : undefined; setTimeout(render, 30); return r; };
    render();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function(){ setTimeout(siap, 500); });
  else setTimeout(siap, 500);
})();
