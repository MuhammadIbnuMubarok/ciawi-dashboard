/**
 * pz-panel.js v2 - Panel Piezometer Bendungan Ciawi
 * Menempel pada dashboard yang sudah ada (mencari tab "Data Teknis").
 *
 * Bagian:
 *   1. FORM     - isi pembacaan harian, 2 mode: R1 mentah atau Tekanan (m)
 *   2. STATUS   - kartu + tabel kondisi (per tanggal / riwayat)
 *   3. GRAFIK   - grafik gabungan per STA + tren Ru per alat
 *   4. REKAP    - rekap bulanan min / maks / rata-rata + Ru maksimum
 *
 * Grafik digambar dengan SVG langsung (dashboard ini tidak memakai pustaka grafik).
 */
(function () {
  "use strict";

  var WARNA = ["#38BDF8", "#22C55E", "#F59E0B", "#EF4444", "#A78BFA", "#14B8A6", "#F472B6",
    "#84CC16", "#FB923C", "#60A5FA", "#E879F9", "#34D399", "#FBBF24", "#F87171", "#818CF8",
    "#2DD4BF", "#FDA4AF", "#A3E635", "#FDBA74", "#93C5FD", "#C084FC", "#4ADE80"];

  function siap() {
    var target = null;
    var sels = "nav a, nav button, header a, header button, .nav a, .nav button, .tabs a, .tabs button";
    document.querySelectorAll(sels).forEach(function (el) {
      if (/Data Teknis/i.test(el.textContent || "")) target = el;
    });
    if (!target || document.getElementById("pzTab")) return;

    var tab = document.createElement("a");
    tab.id = "pzTab";
    tab.href = "#piezometer";
    tab.textContent = "Piezometer";
    tab.className = target.className;
    tab.style.cssText = target.style.cssText;
    target.parentNode.insertBefore(tab, target.nextSibling);

    var ov = document.createElement("div");
    ov.id = "pzOverlay";
    ov.style.cssText = "display:none;position:fixed;inset:0;z-index:9999;overflow:auto;" +
      "background:#060B18;color:#E2E8F0;font-family:Segoe UI,system-ui,sans-serif;padding:20px";
    document.body.appendChild(ov);

    var B = "background:#0B132B;color:#38BDF8;border:1px solid #1C2A4B;border-radius:8px;padding:8px 14px";
    var CARD = "background:#0B132B;border:1px solid #1C2A4B;border-radius:12px;padding:16px;margin-bottom:16px";
    var H2 = "font-size:13px;letter-spacing:1.2px;color:#8CA3C7;margin-bottom:12px";
    var INP = "width:100%;background:#070D1D;color:#E2E8F0;border:1px solid #1C2A4B;border-radius:8px;padding:9px";
    var LAB = "font-size:11px;color:#8CA3C7;display:block;margin-bottom:4px";

    var H = [];
    H.push('<div style="max-width:1400px;margin:0 auto">');
    H.push('<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">');
    H.push('<h1 style="font-size:20px;margin:0">PIEZOMETER <span style="color:#38BDF8">BENDUNGAN CIAWI</span></h1>');
    H.push('<div style="display:flex;gap:8px;flex-wrap:wrap">');
    H.push('<span id="pzInfo" style="font-size:11px;color:#8CA3C7;align-self:center"></span>');
    H.push('<button id="pzRefresh" style="' + B + ';cursor:pointer">SEGARKAN</button>');
    H.push('<a href="/api/piezometer?format=csv" download style="' + B + ';text-decoration:none;font-size:13px">UNDUH CSV</a>');
    H.push('<button id="pzBack" style="' + B + ';cursor:pointer">DASHBOARD</button>');
    H.push('</div></div>');

    // ---- form
    H.push('<div style="' + CARD + '">');
    H.push('<h2 style="' + H2 + '">INPUT PEMBACAAN HARIAN</h2>');
    H.push('<form id="pzForm" style="display:grid;grid-template-columns:1fr 1.2fr 1fr 1fr 1fr auto;gap:10px;align-items:end">');
    H.push('<div><label style="' + LAB + '">Tanggal</label><input id="pzDate" type="date" style="' + INP + '"></div>');
    H.push('<div><label style="' + LAB + '">Instrumen</label><select id="pzName" style="' + INP + '"></select></div>');
    H.push('<div><label style="' + LAB + '">Cara isi</label><select id="pzMode" style="' + INP + '">' +
      '<option value="r1">R1 (angka alat)</option><option value="press">Tekanan (m)</option></select></div>');
    H.push('<div><label style="' + LAB + '" id="pzValLab">R1</label><input id="pzVal" type="number" step="0.1" style="' + INP + '"></div>');
    H.push('<div><label style="' + LAB + '">Kunci</label><input id="pzKey" type="password" style="' + INP + '"></div>');
    H.push('<button type="submit" style="background:#38BDF8;color:#04121F;border:none;border-radius:8px;padding:10px 18px;font-weight:700;cursor:pointer;white-space:nowrap">SIMPAN</button>');
    H.push('</form>');
    H.push('<div id="pzHint" style="font-size:11px;color:#5B7290;margin-top:8px"></div>');
    H.push('<div id="pzToast" style="font-size:13px;margin-top:6px;min-height:18px"></div>');
    H.push('</div>');

    // ---- form elevasi timbunan
    H.push('<div style="' + CARD + '">');
    H.push('<h2 style="' + H2 + '">INPUT ELEVASI TIMBUNAN (Elv. Timbunan)</h2>');
    H.push('<div style="font-size:11px;color:#5B7290;margin:-6px 0 12px">' +
      'Elevasi timbunan dipakai menghitung Ru. Workbook punya 5 seri berbeda - pilih kelompok yang sesuai.</div>');
    H.push('<form id="pzFormTimb" style="display:grid;grid-template-columns:1fr 2fr 1fr 1fr auto;gap:10px;align-items:end">');
    H.push('<div><label style="' + LAB + '">Tanggal</label><input id="pzTimbDate" type="date" style="' + INP + '"></div>');
    H.push('<div><label style="' + LAB + '">Kelompok</label><select id="pzTimbGrup" style="' + INP + '"></select></div>');
    H.push('<div><label style="' + LAB + '">Elevasi (m)</label><input id="pzTimbNilai" type="number" step="0.001" style="' + INP + '"></div>');
    H.push('<div><label style="' + LAB + '">Kunci</label><input id="pzTimbKey" type="password" style="' + INP + '"></div>');
    H.push('<button type="submit" style="background:#38BDF8;color:#04121F;border:none;border-radius:8px;padding:10px 18px;font-weight:700;cursor:pointer;white-space:nowrap">SIMPAN</button>');
    H.push('</form>');
    H.push('<div id="pzTimbInfo" style="font-size:11px;color:#5B7290;margin-top:8px"></div>');
    H.push('<div id="pzTimbToast" style="font-size:13px;margin-top:6px;min-height:18px"></div>');
    H.push('</div>');

    // ---- sub-tab
    var TABON = "background:#38BDF8;color:#04121F;border:none;border-radius:8px;padding:8px 16px;font-weight:700;cursor:pointer";
    var TABOFF = "background:#0B132B;color:#8CA3C7;border:1px solid #1C2A4B;border-radius:8px;padding:8px 16px;cursor:pointer";
    H.push('<div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">');
    H.push('<button class="pzSub" data-sub="status" style="' + TABON + '">STATUS</button>');
    H.push('<button class="pzSub" data-sub="grafik" style="' + TABOFF + '">GRAFIK</button>');
    H.push('<button class="pzSub" data-sub="rekap" style="' + TABOFF + '">REKAP BULANAN</button>');
    H.push('</div>');

    // ---- STATUS
    H.push('<div id="pzSub-status">');
    H.push('<div style="' + CARD + '">');
    H.push('<h2 style="' + H2 + '">KONDISI TERAKHIR: <span id="pzLast" style="color:#38BDF8">-</span></h2>');
    H.push('<div id="pzGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(168px,1fr));gap:10px"></div></div>');
    H.push('<div style="' + CARD + '">');
    H.push('<h2 style="' + H2 + '">TABEL KONDISI - <span id="pzAsOf" style="color:#38BDF8">TERKINI</span></h2>');
    H.push('<div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap">');
    H.push('<label style="font-size:11px;color:#8CA3C7;margin:0">Kondisi per tanggal:</label>');
    H.push('<input id="pzTanggal" type="date" style="background:#070D1D;color:#E2E8F0;border:1px solid #1C2A4B;border-radius:8px;padding:8px">');
    H.push('<select id="pzRiwayat" style="background:#070D1D;color:#E2E8F0;border:1px solid #1C2A4B;border-radius:8px;padding:8px"><option value="">- riwayat -</option></select>');
    H.push('<button id="pzTerapkan" type="button" style="background:#38BDF8;color:#04121F;border:none;border-radius:8px;padding:9px 14px;font-weight:700;cursor:pointer">TERAPKAN</button>');
    H.push('<button id="pzTerkini" type="button" style="' + B + ';cursor:pointer">TERKINI</button>');
    H.push('<label style="font-size:11px;color:#8CA3C7;margin:0 0 0 auto"><input type="checkbox" id="pzHanyaAktif"> sembunyikan OSP</label>');
    H.push('</div>');
    H.push('<div style="overflow:auto;max-height:60vh"><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr>');
    ["Sta", "Nama", "Tip", "Elv. Timbunan", "Press", "Elev. Air", "Izin", "Ru", "Status", "Terakhir"].forEach(function (x) {
      H.push('<th style="padding:8px;border-bottom:1px solid #1C2A4B;color:#8CA3C7;text-align:left;position:sticky;top:0;background:#0B132B">' + x + '</th>');
    });
    H.push('</tr></thead><tbody id="pzTb"></tbody></table></div></div></div>');

    // ---- GRAFIK
    H.push('<div id="pzSub-grafik" style="display:none">');
    H.push('<div style="' + CARD + '">');
    H.push('<h2 style="' + H2 + '">ELEVASI TIMBUNAN PER KELOMPOK</h2>');
    H.push('<div id="pzTimbTabel" style="overflow:auto"></div>');
    H.push('<div id="pzTimbChart" style="background:#070D1D;border:1px solid #1C2A4B;border-radius:10px;padding:8px;margin-top:12px"></div>');
    H.push('</div>');
    H.push('<div style="' + CARD + '">');
    H.push('<h2 style="' + H2 + '">GRAFIK GABUNGAN PER STA</h2>');
    H.push('<div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap">');
    H.push('<select id="pzSta" style="background:#070D1D;color:#E2E8F0;border:1px solid #1C2A4B;border-radius:8px;padding:8px">' +
      '<option value="310">STA 0+310</option><option value="377.5">STA 0+377.5</option></select>');
    H.push('<select id="pzRentang" style="background:#070D1D;color:#E2E8F0;border:1px solid #1C2A4B;border-radius:8px;padding:8px">' +
      '<option value="90">3 bulan terakhir</option><option value="365" selected>1 tahun terakhir</option>' +
      '<option value="0">semua data</option></select>');
    H.push('<select id="pzMetrik" style="background:#070D1D;color:#E2E8F0;border:1px solid #1C2A4B;border-radius:8px;padding:8px">' +
      '<option value="press">Tekanan air pori (mH2O)</option>' +
      '<option value="elv">Elevasi air pori (m)</option>' +
      '<option value="ru">Ru (rasio)</option></select>');
    H.push('<button id="pzGambarUlang" style="' + B + ';cursor:pointer">GAMBAR</button>');
    H.push('<span id="pzLegendaInfo" style="font-size:11px;color:#5B7290;margin-left:auto">klik legenda untuk sembunyikan garis</span>');
    H.push('</div>');
    H.push('<div id="pzLegenda" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px"></div>');
    H.push('<div id="pzChartGabung" style="background:#070D1D;border:1px solid #1C2A4B;border-radius:10px;padding:8px"></div>');
    H.push('</div>');
    H.push('<div style="' + CARD + '">');
    H.push('<h2 style="' + H2 + '">TREN Ru PER ALAT</h2>');
    H.push('<div id="pzRuGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px"></div>');
    H.push('</div></div>');

    // ---- REKAP
    H.push('<div id="pzSub-rekap" style="display:none">');
    H.push('<div style="' + CARD + '">');
    H.push('<h2 style="' + H2 + '">REKAP BULANAN PER ALAT</h2>');
    H.push('<div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap">');
    H.push('<label style="font-size:11px;color:#8CA3C7;margin:0">Bulan:</label>');
    H.push('<select id="pzBulan" style="background:#070D1D;color:#E2E8F0;border:1px solid #1C2A4B;border-radius:8px;padding:8px"></select>');
    H.push('<label style="font-size:11px;color:#8CA3C7;margin:0 0 0 auto"><input type="checkbox" id="pzRekapSemua"> tampilkan semua bulan</label>');
    H.push('</div>');
    H.push('<div style="overflow:auto;max-height:65vh"><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr>');
    ["Bulan", "Sta", "Nama", "Min", "Maks", "Rata-rata", "Ru maks", "Jml baca", "Status"].forEach(function (x) {
      H.push('<th style="padding:8px;border-bottom:1px solid #1C2A4B;color:#8CA3C7;text-align:left;position:sticky;top:0;background:#0B132B">' + x + '</th>');
    });
    H.push('</tr></thead><tbody id="pzRekapTb"></tbody></table></div></div></div>');

    H.push('</div>');
    ov.innerHTML = H.join("");

    // ===================================================================== state
    var DATA = [];           // status terkini
    var SERI = null;         // seri grafik
    var REKAP = null;        // rekap bulanan
    var SEMBUNYI = {};       // legenda yang dimatikan
    var ACUAN = null;        // tanggal pembacaan terakhir (patokan rentang grafik)
    var TIMBUNAN = [];       // 5 kelompok elevasi timbunan
    var RENTANG_DARI = "";   // batas awal grafik gabungan (untuk menyaring garis timbunan)
    var WARNA_TIMB = { CP: "#E2E8F0", BN: "#E2E8F0", DU: "#7DD3FC", EL: "#FCA5A5", CF: "#A7F3D0" };
    var el = function (id) { return document.getElementById(id); };
    function fmt(x, d) { if (x == null || isNaN(x)) return "-"; var p = Math.pow(10, d); return (Math.round(x * p) / p).toFixed(d); }
    function warna(i) { return WARNA[i % WARNA.length]; }

    // ===================================================================== SVG util
    function skala(min, max, a, b) {
      if (max - min < 1e-9) { max = min + 1; }
      return function (v) { return a + (b - a) * (v - min) / (max - min); };
    }
    function tglMs(s) { var p = String(s).split("-"); return Date.UTC(+p[0], +p[1] - 1, +p[2]); }
    function labelTgl(s, rapat) {
      var p = String(s).split("-");
      return rapat ? (p[1] + "/" + p[2]) : (p[2] + "/" + p[1] + "/" + p[0].slice(2));
    }

    /** grafik garis SVG. opt = {deret:[{name,color,titik:[[tgl,val],...]}], tinggi, satuan, desimal} */
    function gambarGaris(host, opt) {
      var W = 1300, Hh = opt.tinggi || 420;
      var PL = 62, PR = 14, PT = 14, PB = 34;
      var deret = opt.deret.filter(function (d) { return d.titik && d.titik.length && !SEMBUNYI[d.name]; });
      if (!deret.length) { host.innerHTML = '<div style="color:#8CA3C7;font-size:13px;padding:30px;text-align:center">Tidak ada data pada rentang ini.</div>'; return; }
      var semua = [].concat.apply([], deret.map(function (d) { return d.titik.map(function (t) { return t[1]; }); }));
      var mn = Math.min.apply(null, semua), mx = Math.max.apply(null, semua);
      var pad = (mx - mn) * 0.08 || 1;
      // nilai besar di ATAS: skala dibalik (bawah = minimum, atas = maksimum)
      var y = skala(mn - pad, mx + pad, Hh - PB, PT);
      var t0 = Infinity, t1 = -Infinity;
      deret.forEach(function (d) { d.titik.forEach(function (t) { var m = tglMs(t[0]); if (m < t0) t0 = m; if (m > t1) t1 = m; }); });
      var x = skala(t0, t1, PL, W - PR);

      var s = ['<svg viewBox="0 0 ' + W + ' ' + Hh + '" style="width:100%;height:auto;display:block" xmlns="http://www.w3.org/2000/svg">'];
      // grid + label Y
      var nY = 5;
      for (var i = 0; i <= nY; i++) {
        var v = mn - pad + (mx + pad - (mn - pad)) * i / nY;
        var yy = y(v);
        s.push('<line x1="' + PL + '" y1="' + yy.toFixed(1) + '" x2="' + (W - PR) + '" y2="' + yy.toFixed(1) + '" stroke="#152340" stroke-width="1"/>');
        s.push('<text x="' + (PL - 8) + '" y="' + (yy + 4).toFixed(1) + '" fill="#5B7290" font-size="11" text-anchor="end">' + fmt(v, opt.desimal) + '</text>');
      }
      // grid + label X
      var nX = 6;
      for (var j = 0; j <= nX; j++) {
        var ms = t0 + (t1 - t0) * j / nX;
        var xx = x(ms);
        var d = new Date(ms);
        var ds = d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0") + "-" + String(d.getUTCDate()).padStart(2, "0");
        s.push('<line x1="' + xx.toFixed(1) + '" y1="' + PT + '" x2="' + xx.toFixed(1) + '" y2="' + (Hh - PB) + '" stroke="#152340" stroke-width="1"/>');
        s.push('<text x="' + xx.toFixed(1) + '" y="' + (Hh - PB + 18) + '" fill="#5B7290" font-size="11" text-anchor="middle">' + labelTgl(ds, (t1 - t0) < 4e11) + '</text>');
      }
      // garis
      deret.forEach(function (d) {
        var pts = d.titik.map(function (t) { return x(tglMs(t[0])).toFixed(1) + "," + y(t[1]).toFixed(1); }).join(" ");
        s.push('<polyline fill="none" stroke="' + d.color + '" stroke-width="' + (d.tebal || 1.4) + '" stroke-linejoin="round" points="' + pts + '"/>');
      });
      s.push('<line id="pzCross" x1="0" y1="' + PT + '" x2="0" y2="' + (Hh - PB) + '" stroke="#38BDF8" stroke-width="1" stroke-dasharray="3,3" opacity="0"/>');
      s.push('<g id="pzTitik"></g>');
      s.push('<rect id="pzHit" x="' + PL + '" y="' + PT + '" width="' + (W - PL - PR) + '" height="' + (Hh - PT - PB) + '" fill="transparent"/>');
      s.push('</svg>');
      s.push('<div id="pzTip" style="position:fixed;pointer-events:none;display:none;background:#0B132B;border:1px solid #1C2A4B;' +
        'border-radius:8px;padding:8px 10px;font-size:12px;z-index:10000;max-width:280px;box-shadow:0 6px 20px rgba(0,0,0,.5)"></div>');
      host.innerHTML = s.join("");

      // hover
      var svg = host.querySelector("svg"), hit = host.querySelector("#pzHit");
      var cross = host.querySelector("#pzCross"), tip = host.querySelector("#pzTip"), titik = host.querySelector("#pzTitik");
      hit.addEventListener("mousemove", function (ev) {
        var r = svg.getBoundingClientRect();
        var px = (ev.clientX - r.left) / r.width * W;
        if (px < PL || px > W - PR) return;
        var ms = t0 + (t1 - t0) * (px - PL) / (W - PL - PR);
        cross.setAttribute("x1", px.toFixed(1)); cross.setAttribute("x2", px.toFixed(1)); cross.setAttribute("opacity", "0.7");
        titik.innerHTML = "";
        var baris = [];
        deret.forEach(function (d) {
          var best = null, bd = Infinity;
          d.titik.forEach(function (t) { var dd = Math.abs(tglMs(t[0]) - ms); if (dd < bd) { bd = dd; best = t; } });
          if (!best || bd > 8 * 864e5) return;
          titik.innerHTML += '<circle cx="' + x(tglMs(best[0])).toFixed(1) + '" cy="' + y(best[1]).toFixed(1) + '" r="3" fill="' + d.color + '"/>';
          baris.push('<div style="display:flex;justify-content:space-between;gap:10px"><span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:' + d.color + '"></span> ' + d.name + '</span><b style="font-family:Consolas,monospace">' + fmt(best[1], opt.desimal) + '</b></div>');
        });
        if (!baris.length) { tip.style.display = "none"; return; }
        tip.innerHTML = '<div style="color:#8CA3C7;margin-bottom:5px">' + new Date(ms).toISOString().slice(0, 10) + (opt.satuan ? " - " + opt.satuan : "") + '</div>' + baris.join("");
        tip.style.display = "block";
        var tw = tip.offsetWidth, th = tip.offsetHeight;
        tip.style.left = Math.min(ev.clientX + 14, window.innerWidth - tw - 8) + "px";
        tip.style.top = Math.max(8, Math.min(ev.clientY - th - 10, window.innerHeight - th - 8)) + "px";
      });
      hit.addEventListener("mouseleave", function () { tip.style.display = "none"; cross.setAttribute("opacity", "0"); titik.innerHTML = ""; });
    }

    /** sparkline kecil untuk tren Ru */
    function sparkline(titik, color, tinggi) {
      var W = 220, Hh = tinggi || 46, P = 4;
      if (!titik.length) return '<svg viewBox="0 0 ' + W + ' ' + Hh + '" style="width:100%;height:' + Hh + 'px"></svg>';
      var vs = titik.map(function (t) { return t[1]; });
      var mn = Math.min.apply(null, vs), mx = Math.max.apply(null, vs);
      if (mx - mn < 1e-9) { mx = mn + 0.01; }
      var t0 = tglMs(titik[0][0]), t1 = tglMs(titik[titik.length - 1][0]);
      var xs = skala(t0, t1 === t0 ? t0 + 864e5 : t1, P, W - P);
      var ys = skala(mn, mx, Hh - P, P);
      var pts = titik.map(function (t) { return xs(tglMs(t[0])).toFixed(1) + "," + ys(t[1]).toFixed(1); }).join(" ");
      return '<svg viewBox="0 0 ' + W + ' ' + Hh + '" style="width:100%;height:' + Hh + 'px" preserveAspectRatio="none">' +
        '<polyline fill="none" stroke="' + color + '" stroke-width="1.6" points="' + pts + '"/></svg>';
    }

    // ===================================================================== STATUS
    function renderStatus() {
      var g = el("pzGrid"), tb = el("pzTb");
      g.innerHTML = ""; tb.innerHTML = "";
      var hanyaAktif = el("pzHanyaAktif").checked;
      var td = "padding:8px;border-bottom:1px solid #1C2A4B";
      var tdn = td + ";font-family:Consolas,monospace;color:#38BDF8";
      DATA.forEach(function (r) {
        if (hanyaAktif && r.name === "OSP") return;
        var ok = r.status === "AMAN";
        var col = ok ? "#22C55E" : "#EF4444";
        var b = document.createElement("div");
        b.style.cssText = "background:#070D1D;border:1px solid #1C2A4B;border-radius:10px;padding:10px;display:flex;flex-direction:column;gap:6px";
        b.innerHTML =
          '<div style="display:flex;justify-content:space-between;align-items:center">' +
          '<span style="font-weight:700;font-size:13px">' + r.name + '</span>' +
          '<span style="width:10px;height:10px;border-radius:50%;background:' + col + ';box-shadow:0 0 8px ' + col + '"></span></div>' +
          '<div style="display:flex;justify-content:space-between;align-items:center">' +
          '<span style="font-size:11px;font-weight:700;color:' + col + '">' + r.status + '</span>' +
          '<span style="font-size:10px;color:#8CA3C7;border:1px solid #1C2A4B;border-radius:6px;padding:2px 6px">STA ' + r.sta + '</span></div>' +
          '<div style="font-size:11px;color:#8CA3C7">Ru <b style="color:#38BDF8;font-family:Consolas,monospace">' + fmt(r.ru, 3) + '</b> - press ' + fmt(r.press, 2) + ' m</div>' +
          '<div style="font-size:11px;color:#8CA3C7">Elv. timbunan <b style="font-family:Consolas,monospace">' + fmt(r.top, 3) + '</b> m' +
          (r.topGrup ? ' <span style="font-size:9px;border:1px solid #1C2A4B;border-radius:4px;padding:0 4px">' + r.topGrup + '</span>' : '') + '</div>' +
          '<div style="font-size:10px;color:#8CA3C7">Update: ' + (r.tanggal || "master") + (r.jumlah ? " - " + r.jumlah + " baca" : "") + '</div>';
        g.appendChild(b);
        var tr = document.createElement("tr");
        tr.innerHTML = '<td style="' + td + '">' + r.sta + '</td><td style="' + td + ';font-weight:700">' + r.name + '</td>' +
          '<td style="' + tdn + '">' + fmt(r.tip, 2) + '</td><td style="' + tdn + '">' + fmt(r.top, 3) + '</td>' +
          '<td style="' + tdn + '">' + fmt(r.press, 2) + '</td><td style="' + tdn + '">' + fmt(r.tip + r.press, 3) + '</td>' +
          '<td style="' + tdn + '">' + fmt(r.izin, 3) + '</td><td style="' + tdn + '">' + fmt(r.ru, 3) + '</td>' +
          '<td style="' + td + ';font-weight:700;color:' + col + '">' + r.status + '</td>' +
          '<td style="' + td + ';font-size:11px;color:#8CA3C7">' + (r.tanggal || "-") + '</td>';
        tb.appendChild(tr);
      });
    }

    function isiNama() {
      var sel = el("pzName"), cur = sel.value;
      sel.innerHTML = "";
      DATA.forEach(function (r) {
        var o = document.createElement("option");
        o.value = r.name;
        o.textContent = r.name + " (STA " + r.sta + ")";
        sel.appendChild(o);
      });
      if (cur) sel.value = cur;
      perbaruiHint();
    }

    // ---- tabel kelompok elevasi timbunan
    function renderTimbunan() {
      var host = el("pzTimbTabel");
      if (!TIMBUNAN.length) { host.innerHTML = '<div style="color:#8CA3C7;font-size:13px">Belum ada data elevasi timbunan.</div>'; return; }
      var td = "padding:8px;border-bottom:1px solid #1C2A4B";
      var tdn = td + ";font-family:Consolas,monospace;color:#38BDF8";
      var s = '<table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr>';
      ["Kode", "Kelompok", "Elevasi (m)", "Tanggal", "Sumber", "Alat yang memakai"].forEach(function (x) {
        s += '<th style="padding:8px;border-bottom:1px solid #1C2A4B;color:#8CA3C7;text-align:left">' + x + '</th>';
      });
      s += '</tr></thead><tbody>';
      TIMBUNAN.forEach(function (g) {
        var c = WARNA_TIMB[g.kode] || "#38BDF8";
        var sumber = g.adaIsianPengguna
          ? '<span style="color:#22C55E">isian aplikasi</span>'
          : '<span style="color:#8CA3C7">workbook</span>';
        s += '<tr>' +
          '<td style="' + td + ';font-weight:700;color:' + c + '">' + g.kode + '</td>' +
          '<td style="' + td + '">' + (g.label || "-") + '</td>' +
          '<td style="' + tdn + '">' + fmt(g.nilai, 3) + '</td>' +
          '<td style="' + td + ';font-size:11px;color:#8CA3C7">' + (g.tanggal || "-") + '</td>' +
          '<td style="' + td + ';font-size:11px">' + sumber + '</td>' +
          '<td style="' + td + ';font-size:11px;color:#8CA3C7">' + ((g.alat || []).join(", ") || "-") + '</td>' +
          '</tr>';
      });
      s += '</tbody></table>';
      host.innerHTML = s;
    }

    function isiGrupTimbunan() {
      var sel = el("pzTimbGrup"), cur = sel.value;
      sel.innerHTML = "";
      TIMBUNAN.forEach(function (g) {
        var o = document.createElement("option");
        o.value = g.kode;
        o.textContent = g.kode + " - " + (g.label || "");
        sel.appendChild(o);
      });
      if (cur) sel.value = cur;
      perbaruiTimbInfo();
    }

    function perbaruiTimbInfo() {
      var k = el("pzTimbGrup").value;
      var g = TIMBUNAN.find(function (x) { return x.kode === k; });
      if (!g) { el("pzTimbInfo").textContent = ""; return; }
      el("pzTimbInfo").innerHTML = 'Nilai terakhir kelompok <b>' + g.kode + '</b>: <b style="color:#38BDF8">' +
        fmt(g.nilai, 3) + ' m</b> (' + (g.tanggal || "-") + ', ' + (g.adaIsianPengguna ? "isian aplikasi" : "dari workbook") + '). ' +
        'Dipakai oleh ' + ((g.alat || []).length) + ' alat: ' + ((g.alat || []).join(", ") || "-") + '.';
    }

    function perbaruiHint() {
      var nm = el("pzName").value, mode = el("pzMode").value;
      var r = DATA.find(function (x) { return x.name === nm; });
      el("pzValLab").textContent = mode === "r1" ? "R1 (angka alat)" : "Tekanan (m)";
      if (!r) { el("pzHint").textContent = ""; return; }
      if (mode === "r1") {
        if (!r.punyaKoefisien) el("pzHint").innerHTML = '<span style="color:#F59E0B">' + r.name + ' belum punya koefisien A/B/R0 - pakai mode Tekanan (m).</span>';
        else el("pzHint").innerHTML = 'R1 akan dihitung otomatis: E = A x R1&sup2; + B x R1 + C, lalu mH2O = E x 0,1022.' +
          ' Koefisien: A=' + Number(r.a).toExponential(4) + ', B=' + fmt(r.b, 6) + ', C=' + fmt(r.c, 4) + '. Terakhir: ' + fmt(r.press, 2) + ' m.';
      } else {
        el("pzHint").innerHTML = 'Isi langsung tekanan air pori (mH2O). Terakhir tercatat: <b>' + fmt(r.press, 2) + ' m</b> (' + (r.tanggal || "belum ada") + ').';
      }
    }

    function load(tgl) {
      var url = "/api/piezometer";
      if (tgl) url += "?tanggal=" + encodeURIComponent(tgl);
      fetch(url, { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (j) {
        if (j.error) throw new Error(j.error);
        DATA = j.data || [];
        ACUAN = j.terakhir || ACUAN;
        el("pzLast").textContent = j.terakhir || "-";
        el("pzAsOf").textContent = j.sesuai ? ("KONDISI PER " + j.sesuai) : "TERKINI";
        el("pzInfo").textContent = (j.totalRiwayat ? j.totalRiwayat.toLocaleString("id-ID") + " pembacaan" : "") +
          " - simpan: " + (j.penyimpanan || "-");
        var rw = el("pzRiwayat"), curw = rw.value;
        rw.innerHTML = '<option value="">- riwayat -</option>';
        (j.daftarTanggal || []).forEach(function (d) {
          var o = document.createElement("option"); o.value = d; o.textContent = d; rw.appendChild(o);
        });
        if (curw) rw.value = curw;
        TIMBUNAN = j.timbunan || [];
        isiNama(); renderStatus(); renderTimbunan(); isiGrupTimbunan();
      }).catch(function (e) { el("pzToast").innerHTML = '<span style="color:#EF4444">Gagal memuat: ' + e.message + '</span>'; });
    }

    // ===================================================================== GRAFIK
    function rentangDari() {
      var n = parseInt(el("pzRentang").value, 10);
      if (!n) return "";
      // patokan = pembacaan terakhir, bukan tanggal hari ini, supaya grafik tidak
      // memperlihatkan separuh kanvas kosong saat data terakhir sudah lewat
      var base = ACUAN ? new Date(ACUAN + "T00:00:00Z") : new Date();
      return new Date(base.getTime() - n * 864e5).toISOString().slice(0, 10);
    }

    function muatSeri() {
      var sta = el("pzSta").value, dari = rentangDari();
      RENTANG_DARI = dari;
      el("pzChartGabung").innerHTML = '<div style="color:#8CA3C7;font-size:13px;padding:30px;text-align:center">memuat...</div>';
      fetch("/api/piezometer?seri=1&sta=" + encodeURIComponent(sta) + "&dari=" + dari, { cache: "no-store" })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (j.error) throw new Error(j.error);
          SERI = j; SEMBUNYI = {};
          gambarSemua();
        }).catch(function (e) {
          el("pzChartGabung").innerHTML = '<div style="color:#EF4444;font-size:13px;padding:30px">Gagal: ' + e.message + '</div>';
        });
    }

    function titikMetrik(s, metrik) {
      if (metrik === "elv") return s.titik.map(function (t) { return [t[0], t[2]]; });
      if (metrik === "ru") return s.titik.map(function (t) { return [t[0], t[3]]; });
      return s.titik.map(function (t) { return [t[0], t[1]]; });
    }

    function gambarSemua() {
      if (!SERI) return;
      var metrik = el("pzMetrik").value;
      var desimal = metrik === "ru" ? 3 : 2;
      var satuan = metrik === "ru" ? "Ru" : (metrik === "elv" ? "m" : "mH2O");
      // legenda
      var leg = el("pzLegenda");
      leg.innerHTML = "";
      SERI.seri.forEach(function (s, i) {
        var c = warna(i);
        var b = document.createElement("button");
        var on = !SEMBUNYI[s.name];
        b.style.cssText = "cursor:pointer;font-size:11px;padding:3px 9px;border-radius:20px;font-family:Consolas,monospace;" +
          "border:1px solid " + (on ? c : "#1C2A4B") + ";background:" + (on ? "rgba(56,189,248,.08)" : "transparent") +
          ";color:" + (on ? c : "#5B7290");
        b.textContent = s.name;
        b.title = s.jumlah + " pembacaan - klik untuk " + (on ? "sembunyikan" : "tampilkan");
        b.onclick = function () { SEMBUNYI[s.name] = on; gambarSemua(); };
        leg.appendChild(b);
      });

      var deret = SERI.seri.map(function (s, i) {
        return { name: s.name, color: warna(i), titik: titikMetrik(s, metrik) };
      });
      // garis elevasi timbunan hanya sepadan pada metrik elevasi (satuannya sama, meter).
      // Seri dari API penuh, jadi disaring di sini mengikuti rentang grafik gabungan.
      if (metrik === "elv" && SERI.timbunan) {
        SERI.timbunan.forEach(function (g) {
          var t = (g.titik || []).filter(function (p) { return !RENTANG_DARI || p[0] >= RENTANG_DARI; });
          if (!t.length) return;
          deret.push({ name: "Timbunan " + g.kode, color: WARNA_TIMB[g.kode] || "#E2E8F0",
                       titik: t, tebal: 2.2 });
        });
      }
      gambarGaris(el("pzChartGabung"), { deret: deret, desimal: desimal, satuan: satuan, tinggi: 430 });
      gambarTimbunan();
      gambarRu();
    }

    // grafik khusus elevasi timbunan - selalu tampil, tidak tergantung metrik
    function gambarTimbunan() {
      if (!SERI || !SERI.timbunan || !SERI.timbunan.length) {
        el("pzTimbChart").innerHTML = '<div style="color:#8CA3C7;font-size:12px;padding:16px;text-align:center">' +
          'Tidak ada data elevasi timbunan pada rentang ini.</div>';
        return;
      }
      var deret = SERI.timbunan.filter(function (g) { return g.titik && g.titik.length; })
        .map(function (g) {
          return { name: "Timbunan " + g.kode, color: WARNA_TIMB[g.kode] || "#E2E8F0", titik: g.titik, tebal: 2.2 };
        });
      gambarGaris(el("pzTimbChart"), { deret: deret, desimal: 2, satuan: "m (elevasi timbunan)", tinggi: 240 });
    }

    function gambarRu() {
      if (!SERI) return;
      var host = el("pzRuGrid");
      host.innerHTML = "";
      SERI.seri.forEach(function (s, i) {
        var c = warna(i);
        var ru = s.titik.map(function (t) { return [t[0], t[3]]; });
        if (!ru.length) return;
        var terakhir = ru[ru.length - 1][1];
        var maks = Math.max.apply(null, ru.map(function (t) { return t[1]; }));
        var d = document.createElement("div");
        d.style.cssText = "background:#070D1D;border:1px solid #1C2A4B;border-radius:10px;padding:10px";
        d.innerHTML =
          '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px">' +
          '<span style="font-weight:700;font-size:12px">' + s.name + '</span>' +
          '<span style="font-size:10px;color:#8CA3C7">' + s.jumlah + ' titik</span></div>' +
          sparkline(ru, c) +
          '<div style="display:flex;justify-content:space-between;font-size:11px;color:#8CA3C7;margin-top:4px">' +
          '<span>kini <b style="color:' + c + ';font-family:Consolas,monospace">' + fmt(terakhir, 3) + '</b></span>' +
          '<span>maks <b style="font-family:Consolas,monospace">' + fmt(maks, 3) + '</b></span></div>';
        host.appendChild(d);
      });
      if (!host.children.length) host.innerHTML = '<div style="color:#8CA3C7;font-size:13px">Tidak ada data.</div>';
    }

    // ===================================================================== REKAP
    function muatRekap() {
      fetch("/api/piezometer?rekap=1", { cache: "no-store" }).then(function (r) { return r.json(); })
        .then(function (j) {
          if (j.error) throw new Error(j.error);
          REKAP = j;
          var sel = el("pzBulan"), cur = sel.value;
          sel.innerHTML = "";
          (j.bulan || []).forEach(function (b) {
            var o = document.createElement("option"); o.value = b.bulan; o.textContent = b.bulan; sel.appendChild(o);
          });
          if (cur) sel.value = cur;
          renderRekap();
        }).catch(function (e) {
          el("pzRekapTb").innerHTML = '<tr><td colspan="9" style="padding:20px;color:#EF4444">Gagal: ' + e.message + '</td></tr>';
        });
    }

    function renderRekap() {
      if (!REKAP) return;
      var tb = el("pzRekapTb"); tb.innerHTML = "";
      var semua = el("pzRekapSemua").checked;
      var pilih = el("pzBulan").value;
      var td = "padding:8px;border-bottom:1px solid #1C2A4B";
      var tdn = td + ";font-family:Consolas,monospace;color:#38BDF8";
      var n = 0;
      (REKAP.bulan || []).forEach(function (b) {
        if (!semua && b.bulan !== pilih) return;
        b.baris.forEach(function (r) {
          n++;
          var ok = r.status === "AMAN";
          var tr = document.createElement("tr");
          tr.innerHTML = '<td style="' + td + '">' + b.bulan + '</td><td style="' + td + '">' + r.sta + '</td>' +
            '<td style="' + td + ';font-weight:700">' + r.name + '</td>' +
            '<td style="' + tdn + '">' + fmt(r.min, 2) + '</td><td style="' + tdn + '">' + fmt(r.max, 2) + '</td>' +
            '<td style="' + tdn + '">' + fmt(r.rata, 2) + '</td><td style="' + tdn + '">' + fmt(r.ruMax, 3) + '</td>' +
            '<td style="' + td + '">' + r.jml + '</td>' +
            '<td style="' + td + ';font-weight:700;color:' + (ok ? "#22C55E" : "#EF4444") + '">' + r.status + '</td>';
          tb.appendChild(tr);
        });
      });
      if (!n) tb.innerHTML = '<tr><td colspan="9" style="padding:20px;color:#8CA3C7">Tidak ada data.</td></tr>';
    }

    // ===================================================================== event
    el("pzTerapkan").addEventListener("click", function () { load(el("pzTanggal").value); });
    el("pzTerkini").addEventListener("click", function () { el("pzTanggal").value = ""; el("pzRiwayat").value = ""; load(""); });
    el("pzRiwayat").addEventListener("change", function () { el("pzTanggal").value = this.value; load(this.value); });
    el("pzRefresh").addEventListener("click", function () { load(el("pzTanggal").value); });
    el("pzHanyaAktif").addEventListener("change", renderStatus);
    el("pzBack").addEventListener("click", function () { ov.style.display = "none"; });
    el("pzMode").addEventListener("change", perbaruiHint);
    el("pzName").addEventListener("change", perbaruiHint);
    el("pzGambarUlang").addEventListener("click", muatSeri);
    el("pzSta").addEventListener("change", muatSeri);
    el("pzRentang").addEventListener("change", muatSeri);
    el("pzMetrik").addEventListener("change", gambarSemua);
    el("pzBulan").addEventListener("change", renderRekap);
    el("pzRekapSemua").addEventListener("change", renderRekap);

    document.querySelectorAll(".pzSub").forEach(function (b) {
      b.addEventListener("click", function () {
        var sub = b.getAttribute("data-sub");
        document.querySelectorAll(".pzSub").forEach(function (x) {
          var on = x === b;
          x.style.cssText = on ? TABON : TABOFF;
        });
        ["status", "grafik", "rekap"].forEach(function (k) {
          el("pzSub-" + k).style.display = (k === sub) ? "block" : "none";
        });
        if (sub === "grafik" && !SERI) muatSeri();
        if (sub === "rekap" && !REKAP) muatRekap();
      });
    });

    el("pzDate").value = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
    el("pzKey").value = localStorage.getItem("piezoKey") || "";

    el("pzForm").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var key = el("pzKey").value || "";
      if (key) localStorage.setItem("piezoKey", key);
      var name = el("pzName").value;
      var mode = el("pzMode").value;
      var val = parseFloat(el("pzVal").value);
      var date = el("pzDate").value;
      if (!isFinite(val)) { el("pzToast").innerHTML = '<span style="color:#EF4444">Nilai belum diisi.</span>'; return; }
      var body = { key: key, name: name, date: date };
      body[mode === "r1" ? "r1" : "press"] = val;
      el("pzToast").innerHTML = '<span style="color:#8CA3C7">menyimpan...</span>';
      fetch("/api/piezometer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (!j.ok) throw new Error(j.error || "gagal");
          var m = "BERHASIL: " + j.name + " " + j.date + " &rarr; " + fmt(j.press, 2) + " m" +
            (j.r1 != null ? " (dari R1 " + j.r1 + ")" : "") + " - Ru " + fmt(j.ru, 3) + " - " + j.status;
          el("pzToast").innerHTML = '<span style="color:#22C55E">' + m + '</span>';
          el("pzVal").value = "";
          load(el("pzTanggal").value);
        }).catch(function (e) {
          el("pzToast").innerHTML = '<span style="color:#EF4444">GAGAL: ' + e.message + '</span>';
        });
    });

    // ---- form elevasi timbunan
    el("pzTimbDate").value = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
    el("pzTimbKey").value = localStorage.getItem("piezoKey") || "";
    el("pzTimbGrup").addEventListener("change", perbaruiTimbInfo);

    el("pzFormTimb").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var key = el("pzTimbKey").value || "";
      if (key) localStorage.setItem("piezoKey", key);
      var grup = el("pzTimbGrup").value;
      var nilai = parseFloat(el("pzTimbNilai").value);
      var date = el("pzTimbDate").value;
      if (!isFinite(nilai)) { el("pzTimbToast").innerHTML = '<span style="color:#EF4444">Elevasi belum diisi.</span>'; return; }
      el("pzTimbToast").innerHTML = '<span style="color:#8CA3C7">menyimpan...</span>';
      fetch("/api/piezometer", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: key, jenis: "timbunan", grup: grup, nilai: nilai, date: date })
      }).then(function (r) { return r.json(); }).then(function (j) {
        if (!j.ok) throw new Error(j.error || "gagal");
        var m = "BERHASIL: elevasi timbunan " + j.grup + " tanggal " + j.date + " &rarr; " + fmt(j.nilai, 3) + " m";
        if (j.contohAlat && j.contohRu != null) m += " (Ru " + j.contohAlat + " jadi " + fmt(j.contohRu, 3) + ")";
        el("pzTimbToast").innerHTML = '<span style="color:#22C55E">' + m + '</span>';
        el("pzTimbNilai").value = "";
        load(el("pzTanggal").value);
        if (SERI) muatSeri();
      }).catch(function (e) {
        el("pzTimbToast").innerHTML = '<span style="color:#EF4444">GAGAL: ' + e.message + '</span>';
      });
    });

    tab.addEventListener("click", function (e) {
      e.preventDefault();
      if (location.hash !== "#piezometer") { try { location.hash = "#piezometer"; } catch (x) {} }
      bukaPanel();
    });

    function bukaPanel() {
      ov.style.display = "block";
      window.scrollTo(0, 0);
      load(el("pzTanggal").value);
    }

    // tautan langsung: .../#piezometer membuka panel ini otomatis
    window.addEventListener("hashchange", function () {
      if (location.hash === "#piezometer") bukaPanel();
      else if (ov.style.display === "block" && !location.hash) ov.style.display = "none";
    });
    if (location.hash === "#piezometer") bukaPanel();
    else load("");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", siap);
  else siap();
})();
