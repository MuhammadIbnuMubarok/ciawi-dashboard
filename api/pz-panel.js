(function () {
  function siap() {
    var target = null;
    document.querySelectorAll("nav a, nav button, header a, header button, .nav a, .nav button, .tabs a, .tabs button").forEach(function (el) {
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
    ov.style.cssText = "display:none;position:fixed;inset:0;z-index:9999;overflow:auto;background:#060B18;color:#E2E8F0;font-family:Segoe UI,system-ui,sans-serif;padding:20px";
    ov.innerHTML = `
<div style="max-width:1200px;margin:0 auto">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
    <h1 style="font-size:20px;margin:0">🛰️ PIEZOMETER <span style="color:#38BDF8">BENDUNGAN CIAWI</span></h1>
    <div style="display:flex;gap:8px">
      <a id="pzDl" href="/api/piezometer?format=csv" download style="background:#0B132B;color:#38BDF8;border:1px solid #1C2A4B;border-radius:8px;padding:8px 14px;text-decoration:none;font-size:13px">⬇ UNDUH CSV</a>
      <button id="pzBack" style="background:#0B132B;color:#38BDF8;border:1px solid #1C2A4B;border-radius:8px;padding:8px 14px;cursor:pointer">← DASHBOARD</button>
    </div>
  </div>
  <div style="background:#0B132B;border:1px solid #1C2A4B;border-radius:12px;padding:16px;margin-bottom:16px">
    <h2 style="font-size:13px;letter-spacing:1.2px;color:#8CA3C7;margin-bottom:12px">UPDATE TEKANAN HARIAN</h2>
    <form id="pzForm" style="display:grid;grid-template-columns:1fr 1.2fr 1fr 1fr auto;gap:10px">
      <div><label style="font-size:11px;color:#8CA3C7;display:block;margin-bottom:4px">Tanggal</label><input id="pzDate" type="date" style="width:100%;background:#070D1D;color:#E2E8F0;border:1px solid #1C2A4B;border-radius:8px;padding:9px"></div>
      <div><label style="font-size:11px;color:#8CA3C7;display:block;margin-bottom:4px">Instrumen</label><select id="pzName" style="width:100%;background:#070D1D;color:#E2E8F0;border:1px solid #1C2A4B;border-radius:8px;padding:9px"></select></div>
      <div><label style="font-size:11px;color:#8CA3C7;display:block;margin-bottom:4px">Tekanan (m)</label><input id="pzPress" type="number" step="0.01" min="0" style="width:100%;background:#070D1D;color:#E2E8F0;border:1px solid #1C2A4B;border-radius:8px;padding:9px"></div>
      <div><label style="font-size:11px;color:#8CA3C7;display:block;margin-bottom:4px">Kunci</label><input id="pzKey" type="password" style="width:100%;background:#070D1D;color:#E2E8F0;border:1px solid #1C2A4B;border-radius:8px;padding:9px"></div>
      <button type="submit" style="background:#38BDF8;color:#04121F;border:none;border-radius:8px;padding:10px 18px;font-weight:700;align-self:end;cursor:pointer">SIMPAN</button>
    </form>
    <div id="pzToast" style="font-size:13px;margin-top:10px;min-height:18px"></div>
  </div>
  <div style="background:#0B132B;border:1px solid #1C2A4B;border-radius:12px;padding:16px;margin-bottom:16px">
    <h2 style="font-size:13px;letter-spacing:1.2px;color:#8CA3C7;margin-bottom:12px">LIVE STATUS — PEMBACAAN TERAKHIR: <span id="pzLast" style="color:#38BDF8">-</span></h2>
    <div id="pzGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px"></div>
  </div>
  <div style="background:#0B132B;border:1px solid #1C2A4B;border-radius:12px;padding:16px">
    <h2 style="font-size:13px;letter-spacing:1.2px;color:#8CA3C7;margin-bottom:12px">TABEL REKAMAN TERAKHIR PER INSTRUMEN</h2>
    <div style="overflow:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr><th style="padding:8px;border-bottom:1px solid #1C2A4B;color:#8CA3C7;text-align:left">Sta</th><th style="padding:8px;border-bottom:1px solid #1C2A4B;color:#8CA3C7;text-align:left">Nama</th><th style="padding:8px;border-bottom:1px solid #1C2A4B;color:#8CA3C7;text-align:left">Tanggal</th><th style="padding:8px;border-bottom:1px solid #1C2A4B;color:#8CA3C7;text-align:left">Tip</th><th style="padding:8px;border-bottom:1px solid #1C2A4B;color:#8CA3C7;text-align:left">Top</th><th style="padding:8px;border-bottom:1px solid #1C2A4B;color:#8CA3C7;text-align:left">Press</th><th style="padding:8px;border-bottom:1px solid #1C2A4B;color:#8CA3C7;text-align:left">Elev. Air</th><th style="padding:8px;border-bottom:1px solid #1C2A4B;color:#8CA3C7;text-align:left">Izin</th><th style="padding:8px;border-bottom:1px solid #1C2A4B;color:#8CA3C7;text-align:left">Ru</th><th style="padding:8px;border-bottom:1px solid #1C2A4B;color:#8CA3C7;text-align:left">Status</th></tr></thead>
      <tbody id="pzTb"></tbody>
    </table></div>
  </div>
</div>`;
    document.body.appendChild(ov);
    var td = "padding:8px;border-bottom:1px solid #1C2A4B";
    var tdn = td + ";font-family:Consolas,monospace;color:#38BDF8";
    function fmt(x, d) { const p = Math.pow(10, d); return (Math.round(x * p) / p).toFixed(d); }
    var DATA = [];
    function render() {
      var g = document.getElementById("pzGrid");
      g.innerHTML = "";
      var tb = document.getElementById("pzTb");
      tb.innerHTML = "";
      DATA.forEach(function (r) {
        var ok = r.status === "AMAN";
        var col = ok ? "#22C55E" : "#EF4444";
        var b = document.createElement("div");
        b.style.cssText = "background:#070D1D;border:1px solid #1C2A4B;border-radius:10px;padding:10px;display:flex;flex-direction:column;gap:6px";
        b.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center"><span style="font-weight:700;font-size:13px">${r.name}</span><span style="width:10px;height:10px;border-radius:50%;background:${col};box-shadow:0 0 8px ${col}"></span></div>
<div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:11px;font-weight:700;color:${col}">${r.status}</span><span style="font-size:10px;color:#8CA3C7;border:1px solid #1C2A4B;border-radius:6px;padding:2px 6px">STA ${r.sta}</span></div>
<div style="font-size:11px;color:#8CA3C7">Ru <b style="color:#38BDF8;font-family:Consolas,monospace">${fmt(r.ru, 3)}</b> · press ${fmt(r.press, 2)} m</div>
<div style="font-size:10px;color:#8CA3C7">Update: ${r.tanggal || "master"}</div>`;
        g.appendChild(b);
        var tr = document.createElement("tr");
        tr.innerHTML = `<td style="${td}">${r.sta}</td><td style="${td};font-weight:700">${r.name}</td><td style="${td}">${r.tanggal || "-"}</td><td style="${tdn}">${fmt(r.tip, 2)}</td><td style="${tdn}">${fmt(r.top, 2)}</td>
<td style="${tdn}">${fmt(r.press, 2)}</td><td style="${tdn}">${fmt(r.tip + r.press, 2)}</td><td style="${tdn}">${fmt(r.izin, 2)}</td><td style="${tdn}">${fmt(r.ru, 3)}</td><td style="${td};font-weight:700;color:${col}">${r.status}</td>`;
        tb.appendChild(tr);
      });
    }
    function load() {
      fetch("/api/piezometer", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (j) {
        DATA = j.data || [];
        document.getElementById("pzLast").textContent = j.terakhir || "-";
        var sel = document.getElementById("pzName");
        var cur = sel.value;
        sel.innerHTML = "";
        DATA.forEach(function (r) { var o = document.createElement("option"); o.value = r.name; o.textContent = r.name + " (STA " + r.sta + ")"; sel.appendChild(o); });
        if (cur) sel.value = cur;
        render();
      }).catch(function (e) { document.getElementById("pzToast").textContent = "Gagal memuat: " + e.message; });
    }
    document.getElementById("pzDate").value = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
    document.getElementById("pzForm").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var key = document.getElementById("pzKey").value || localStorage.getItem("piezoKey") || "";
      if (key) localStorage.setItem("piezoKey", key);
      var name = document.getElementById("pzName").value;
      var press = parseFloat(document.getElementById("pzPress").value);
      var date = document.getElementById("pzDate").value;
      var prm = new URLSearchParams({ key: key, name: name, press: String(press), date: date });
      fetch("/api/piezometer?" + prm.toString(), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name, press: press, key: key, date: date }) }).then(function (r) { return r.json(); }).then(function (j) {
        if (!j.ok) throw new Error(j.error || "gagal");
        document.getElementById("pzToast").innerHTML = `<span style="color:#22C55E">✔ ${j.name} tanggal ${j.date} diperbarui: ${fmt(j.press, 2)} m — ${j.status} (Ru ${fmt(j.ru, 3)})</span>`;
        load();
      }).catch(function (e) { document.getElementById("pzToast").innerHTML = `<span style="color:#EF4444">✘ ${e.message}</span>`; });
    });
    tab.addEventListener("click", function (e) { e.preventDefault(); ov.style.display = "block"; window.scrollTo(0, 0); load(); });
    document.getElementById("pzBack").addEventListener("click", function () { ov.style.display = "none"; });
    load();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", siap); else siap();
})();