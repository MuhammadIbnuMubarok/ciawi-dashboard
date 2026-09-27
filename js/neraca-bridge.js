(function(){
  function siap(){
    if (typeof REAL_DATA === "undefined" || !REAL_DATA || !REAL_DATA.length) { setTimeout(siap, 800); return; }
    var tb = null;
    var tables = document.querySelectorAll("table");
    for (var i=0;i<tables.length;i++){ var tt = tables[i].textContent || ""; if (tt.indexOf("QOUT KONDUIT") >= 0 && tt.indexOf("REDUKSI") >= 0) { tb = tables[i].querySelector("tbody"); break; } }
    if (!tb) return;
    var ins = [];
    var all = document.querySelectorAll("input[type=date]");
    for (var d=0;d<all.length;d++){ var el=all[d]; if (el.closest("#pzOverlay") || el.closest("#rtsOverlay")) continue; ins.push(el); }
    var dari = ins[0] || null, sd = ins[1] || null;
    var pageSizeSel = document.getElementById("page-size-select");
    var state = { page: 1 };
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
    function unified(){
      var rows = [];
      for (var a=0;a<REAL_DATA.length;a++){
        var r = REAL_DATA[a];
        if (!r || !r.tanggal) continue;
        rows.push({ no: a+1, tanggal: String(r.tanggal).slice(0,10), jam: r.jam || "-", elevasi: r.elevasi, sedimen: r.sedimen, bukaan: (r.bukaan_konduit!==undefined?r.bukaan_konduit:r.bukaan), volume: (r.volume!==undefined?r.volume:r.vol), qk: r.qout_konduit, qs: r.qout_spillway, qt: (r.qout_total!==undefined?r.qout_total:r.qout), qin: r.qin, red: r.reduksi, status: r.status, tag: "NERACA" });
      }
      var lv = liveRows();
      for (var b=0;b<lv.length;b++){
        var L = lv[b];
        rows.push({ no: L.no || (200000+b+1), tanggal: String(L.tanggal).slice(0,10), jam: L.jam || "-", elevasi: L.elevasi, sedimen: L.sedimen, bukaan: L.bukaan, volume: (L.vol!==undefined?L.vol:L.volume), qk: L.qoutK, qs: (L.qoutS!==undefined?L.qoutS:L.qout_spillway), qt: (L.qoutT!==undefined?L.qoutT:L.qout_total), qin: L.qin, red: L.reduksi, status: L.status, tag: "LIVE" });
      }
      rows.sort(function(x,y){ return x.tanggal<y.tanggal?1:(x.tanggal>y.tanggal?-1:0); });
      return rows;
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
        html += "<tr>" + "<td class=\"py-2 px-3\">" + r.no + " <span style=\"font-size:9px;opacity:.55\">" + r.tag + "</span></td>" + "<td class=\"py-2 px-3\">" + r.tanggal + "</td>" + "<td class=\"py-2 px-3\">" + (r.jam||"-") + "</td>" + "<td class=\"py-2 px-3\">" + fmt(r.elevasi) + "</td>" + "<td class=\"py-2 px-3\">" + fmt(r.sedimen) + "</td>" + "<td class=\"py-2 px-3\">" + fmt(r.bukaan) + "</td>" + "<td class=\"py-2 px-3\">" + fmt(r.volume) + "</td>" + "<td class=\"py-2 px-3\">" + fmt(r.qk) + "</td>" + "<td class=\"py-2 px-3\">" + fmt(r.qs) + "</td>" + "<td class=\"py-2 px-3\">" + fmt(r.qt) + "</td>" + "<td class=\"py-2 px-3\">" + fmt(r.qin) + "</td>" + "<td class=\"py-2 px-3\">" + fmt(r.red) + "</td>" + "<td class=\"py-2 px-3\">" + (r.status || "-") + "</td>" + "</tr>";
      }
      if (!slice.length) html = "<tr><td colspan=\"13\" style=\"padding:24px;text-align:center\">Tidak ada data pada rentang ini</td></tr>";
      tb.innerHTML = html;
      var rc = document.getElementById("tbl-rowcount");
      if (rc) rc.textContent = "Menampilkan " + (rows.length? start+1:0) + "-" + Math.min(start+ps, rows.length) + " dari " + rows.length + " rekaman";
      var bd = document.getElementById("tbl-badge-summary");
      if (bd) bd.textContent = rows.length + " REKAMAN (NERACA+LIVE)";
      var pg = document.getElementById("tbl-pagination");
      if (pg) {
        var h = "";
        h += "<button id=\"btn-prev-page\" onclick=\"bridgePage(-1)\"" + (state.page<=1?" disabled":"") + "> Sebelumnya</button> ";
        h += "<span>" + state.page + " / " + pages + "</span> ";
        h += "<button id=\"btn-next-page\" onclick=\"bridgePage(1)\"" + (state.page>=pages?" disabled":"") + "> Selanjutnya</button>";
        pg.innerHTML = h;
      }
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
