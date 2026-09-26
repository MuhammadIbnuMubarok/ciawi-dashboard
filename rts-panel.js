(function () {
  var WARN = 0.100;
  var DANGER = 0.150;
  function siap() {
    var target = null;
    var sels = "nav a, nav button, header a, header button";
    sels += ", .nav a, .nav button, .tabs a, .tabs button";
    document.querySelectorAll(sels).forEach(function (el) {
      if (/^Piezometer$/i.test((el.textContent || "").trim())) target = el;
    });
    if (!target || document.getElementById("rtsTab")) return;
    var tab = document.createElement("a");
    tab.id = "rtsTab";
    tab.href = "#rts";
    tab.textContent = "RTS";
    tab.className = target.className;
    tab.style.cssText = target.style.cssText;
    target.parentNode.insertBefore(tab, target.nextSibling);
    var ov = document.createElement("div");
    ov.id = "rtsOverlay";
    var cs = "display:none;position:fixed;inset:0;z-index:9999;overflow:auto;";
    cs += "background:#060B18;color:#E2E8F0;font-family:Segoe UI,system-ui,sans-serif;padding:20px";
    ov.style.cssText = cs;
    var H = [];
    H.push(`<div style="max-width:1280px;margin:0 auto">`);
    H.push(`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">`);
    H.push(`<h1 style="font-size:20px;margin:0">RTS <span style="color:#38BDF8">DEFORMASI BENDUNGAN CIAWI</span> `);
    H.push(`<span id="rtsLive" style="font-size:11px;padding:3px 8px;border-radius:6px;border:1px solid #1C2A4B;color:#8CA3C7">-</span></h1>`);
    var btn = "background:#0B132B;color:#38BDF8;border:1px solid #1C2A4B;border-radius:8px;padding:8px 14px";
    H.push(`<div style="display:flex;gap:8px">`);
    H.push(`<button id="rtsRefresh" style="${btn};cursor:pointer">SEGARKAN</button>`);
    H.push(`<a href="/api/rts?format=csv" download style="${btn};text-decoration:none;font-size:13px">UNDUH CSV</a>`);
    H.push(`<button id="rtsBack" style="${btn};cursor:pointer">DASHBOARD</button>`);
    H.push(`</div></div>`);
    var card = "background:#0B132B;border:1px solid #1C2A4B;border-radius:12px;padding:16px;margin-bottom:16px";
    var h2 = "font-size:13px;letter-spacing:1.2px;color:#8CA3C7;margin-bottom:12px";
    H.push(`<div style="${card}"><h2 style="${h2}">STATUS POS ADR / RTS - PEMBACAAN: `);
    H.push(`<span id="rtsTgl" style="color:#38BDF8">-</span></h2>`);
    H.push(`<div id="rtsCards" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px"></div></div>`);
    H.push(`<div style="${card}"><h2 style="${h2}">PERGESERAN PRISMA - MAKS: <span id="rtsMax" style="color:#38BDF8">-</span></h2>`);
    H.push(`<div style="overflow:auto"><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr>`);
    var ths = ["No", "Prisma", "Nama", "Waktu", "dX (m)", "dY (m)", "dZ (m)", "Linier (m)", "Linier (mm)", "Arah (deg)", "Status"];
    ths.forEach(function (x) {
      H.push(`<th style="padding:8px;border-bottom:1px solid #1C2A4B;color:#8CA3C7;text-align:left">${x}</th>`);
    });
    H.push(`</tr></thead><tbody id="rtsTb"></tbody></table></div></div></div>`);
    ov.innerHTML = H.join("");
    document.body.appendChild(ov);
    var td = "padding:7px;border-bottom:1px solid #1C2A4B";
    var tdn = td + ";font-family:Consolas,monospace;color:#38BDF8";
    function fmt(x, d) { var p = Math.pow(10, d); return (Math.round(x * p) / p).toFixed(d); }
    function statusOf(r) {
      if (r.id === "P1") return { t: "REFERENSI", c: "#8CA3C7" };
      if (!r.ok) return { t: "GAGAL", c: "#EF4444" };
      if (r.lin >= DANGER) return { t: "BAHAYA", c: "#EF4444" };
      if (r.lin >= WARN) return { t: "WASPADA", c: "#F59E0B" };
      return { t: "AMAN", c: "#22C55E" };
    }
    function renderCards(d) {
      var g = document.getElementById("rtsCards");
      g.innerHTML = "";
      var items = [
        ["Status RTS", d.statusRts || "-", (d.statusRts === "Connected") ? "#22C55E" : "#EF4444"],
        ["Power RTS", d.power || "-", "#38BDF8"],
        ["Battery Logger", d.battery || "-", "#38BDF8"],
        ["Humidity Logger", d.humidity || "-", "#38BDF8"],
        ["Temperature Logger", d.temperature || "-", "#38BDF8"],
        ["Status Logger", d.statusLogger || "-", "#8CA3C7"],
        ["Status SD Card", d.statusSd || "-", "#8CA3C7"]
      ];
      items.forEach(function (it) {
        var b = document.createElement("div");
        b.style.cssText = "background:#070D1D;border:1px solid #1C2A4B;border-radius:10px;padding:10px";
        b.innerHTML = `<div style="font-size:11px;color:#8CA3C7">${it[0]}</div><div style="font-weight:700;color:${it[2]};margin-top:4px">${it[1]}</div>`;
        g.appendChild(b);
      });
    }
    function render(d) {
      document.getElementById("rtsTgl").textContent = d.tanggal || "-";
      renderCards(d);
      var rows = (d.rows || []).filter(function (r) { return r.id !== "P1"; });
      var max = null;
      rows.forEach(function (r) { if (r.ok && (!max || r.lin > max.lin)) max = r; });
      document.getElementById("rtsMax").textContent = max ? (max.nama + " " + fmt(max.lin * 1000, 1) + " mm") : "-";
      var tb = document.getElementById("rtsTb");
      tb.innerHTML = "";
      (d.rows || []).forEach(function (r, i) {
        var st = statusOf(r);
        var bs = (r.id === "P1") ? "-" : fmt(r.dx, 3);
        var be = (r.id === "P1") ? "-" : fmt(r.dy, 3);
        var bz = (r.id === "P1") ? "-" : fmt(r.dz, 3);
        var bl = (r.id === "P1") ? "-" : fmt(r.lin, 4);
        var bm = (r.id === "P1") ? "-" : fmt(r.lin * 1000, 1);
        var ba = (r.id === "P1") ? "-" : fmt(r.arah, 1);
        var tr = document.createElement("tr");
        tr.innerHTML = `<td style="${td}">${i + 1}</td><td style="${td};font-weight:700">${r.id}</td><td style="${td}">${r.nama}</td><td style="${td}">${r.waktu}</td>` +
          `<td style="${tdn}">${bs}</td><td style="${tdn}">${be}</td><td style="${tdn}">${bz}</td><td style="${tdn}">${bl}</td>` +
          `<td style="${tdn}">${bm}</td><td style="${tdn}">${ba}</td><td style="${td};font-weight:700;color:${st.c}">${st.t}</td>`;
        tb.appendChild(tr);
      });
    }
    function load() {
      fetch("/api/rts", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (j) {
        var d = j.data || {};
        var lv = document.getElementById("rtsLive");
        lv.textContent = j.live ? "LIVE" : "CACHE";
        lv.style.color = j.live ? "#22C55E" : "#F59E0B";
        render(d);
      }).catch(function (e) {
        document.getElementById("rtsLive").textContent = "GAGAL: " + e.message;
      });
    }
    document.getElementById("rtsRefresh").addEventListener("click", load);
    document.getElementById("rtsBack").addEventListener("click", function () { ov.style.display = "none"; });
    tab.addEventListener("click", function (e) {
      e.preventDefault();
      ov.style.display = "block";
      window.scrollTo(0, 0);
      load();
    });
    load();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", siap);
  else siap();
})();
