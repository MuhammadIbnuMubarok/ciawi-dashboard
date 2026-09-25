(function () {
  function siap() {
    var target = null;
    var sels = "nav a, nav button, header a, header button";
    sels += ", .nav a, .nav button, .tabs a, .tabs button";
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
    var cs = "display:none;position:fixed;inset:0;z-index:9999;";
    cs += "overflow:auto;background:#060B18;color:#E2E8F0;";
    cs += "font-family:Segoe UI,system-ui,sans-serif;padding:20px";
    ov.style.cssText = cs;
    var H = [];
    H.push(`<div style="max-width:1200px;margin:0 auto">`);
    H.push(`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">`);
    H.push(`<h1 style="font-size:20px;margin:0">??? PIEZOMETER <span style="color:#38BDF8">BENDUNGAN CIAWI</span></h1>`);
    H.push(`<div style="display:flex;gap:8px">`);
    var btn = "background:#0B132B;color:#38BDF8;border:1px solid #1C2A4B;border-radius:8px;padding:8px 14px";
    H.push(`<a href="/api/piezometer?format=csv" download style="${btn};text-decoration:none;font-size:13px">? UNDUH CSV</a>`);
    H.push(`<button id="pzBack" style="${btn};cursor:pointer">? DASHBOARD</button>`);
    H.push(`</div></div>`);
    var card = "background:#0B132B;border:1px solid #1C2A4B;border-radius:12px;padding:16px;margin-bottom:16px";
    var h2 = "font-size:13px;letter-spacing:1.2px;color:#8CA3C7;margin-bottom:12px";
    var inp = "width:100%;background:#070D1D;color:#E2E8F0;border:1px solid #1C2A4B;border-radius:8px;padding:9px";
    var lab = "font-size:11px;color:#8CA3C7;display:block;margin-bottom:4px";
    H.push(`<div style="${card}">`);
    H.push(`<h2 style="${h2}">UPDATE TEKANAN HARIAN</h2>`);
    H.push(`<form id="pzForm" style="display:grid;grid-template-columns:1fr 1.2fr 1fr 1fr auto;gap:10px">`);
    H.push(`<div><label style="${lab}">Tanggal</label><input id="pzDate" type="date" style="${inp}"></div>`);
    H.push(`<div><label style="${lab}">Instrumen</label><select id="pzName" style="${inp}"></select></div>`);
    H.push(`<div><label style="${lab}">Tekanan (m)</label><input id="pzPress" type="number" step="0.01" min="0" style="${inp}"></div>`);
    H.push(`<div><label style="${lab}">Kunci</label><input id="pzKey" type="password" style="${inp}"></div>`);
    H.push(`<button type="submit" style="background:#38BDF8;color:#04121F;border:none;border-radius:8px;padding:10px 18px;font-weight:700;align-self:end;cursor:pointer">SIMPAN</button>`);
    H.push(`</form><div id="pzToast" style="font-size:13px;margin-top:10px;min-height:18px"></div></div>`);
    H.push(`<div style="${card}">`);
    H.push(`<h2 style="${h2}">LIVE STATUS — PEMBACAAN TERAKHIR: <span id="pzLast" style="color:#38BDF8">-</span></h2>`);
    H.push(`<div id="pzGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px"></div></div>`);
    H.push(`<div style="${card}">`);
    H.push(`<h2 style="${h2}">TABEL REKAMAN TERAKHIR PER INSTRUMEN</h2>`);
    H.push(`<div style="overflow:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">`);
    H.push(`<thead><tr>`);
    var ths = ["Sta", "Nama", "Tanggal", "Tip", "Top", "Press", "Elev. Air", "Izin", "Ru", "Status"];
    ths.forEach(function (x) { H.push(`<th style="padding:8px;border-bottom:1px solid #1C2A4B;color:#8CA3C7;text-align:left">${x}</th>`); });
    H.push(`</tr></thead><tbody id="pzTb"></tbody></table></div></div></div>`);
    ov.innerHTML = H.join("");
    document.body.appendChild(ov);
    var td = "padding:8px;border-bottom:1px solid #1C2A4B";
    var tdn = td + ";font-family:Consolas,monospace;color:#38BDF8";
    function fmt(x, d) { var p = Math.pow(10, d); return (Math.round(x * p) / p).toFixed(d); }
    var DATA = [];
    function render() {
      document.getElementById("pzGrid").innerHTML = "";
      document.getElementById("pzTb").innerHTML = "";
      DATA.forEach(function (r) {
        var ok = r.status === "AMAN";
        var col = ok ? "#22C55E" : "#EF4444";
        var b = document.createElement("div");
        b.style.cssText = "background:#070D1D;border:1px solid #1C2A4B;border-radius:10px;padding:10px;display:flex;flex-direction:column;gap:6px";
        var s = `<div style="display:flex;justify-content:space-between;align-items:center">`;
        s += `<span style="font-weight:700;font-size:13px">${r.name}</span>`;
        s += `<span style="width:10px;height:10px;border-radius:50%;background:${col};box-shadow:0 0 8px ${col}"></span></div>`;
        s += `<div style="display:flex;justify-content:space-between;align-items:center">`;
        s += `<span style="font-size:11px;font-weight:700;color:${col}">${r.status}</span>`;
        s += `<span style="font-size:10px;color:#8CA3C7;border:1px solid #1C2A4B;border-radius:6px;padding:2px 6px">STA ${r.sta}</span></div>`;
        s += `<div style="font-size:11px;color:#8CA3C7">Ru <b style="color:#38BDF8;font-family:Consolas,monospace">${fmt(r.ru, 3)}</b> · press ${fmt(r.press, 2)} m</div>`;
        s += `<div style="font-size:10px;color:#8CA3C7">Update: ${r.tanggal || "master"}</div>`;
        b.innerHTML = s;
        document.getElementById("pzGrid").appendChild(b);
        var t = `<td style="${td}">${r.sta}</td>`;
        t += `<td style="${td};font-weight:700">${r.name}</td>`;
        t += `<td style="${td}">${r.tanggal || "-"}</td>`;
        t += `<td style="${tdn}">${fmt(r.tip, 2)}</td>`;
        t += `<td style="${tdn}">${fmt(r.top, 2)}</td>`;
        t += `<td style="${tdn}">${fmt(r.press, 2)}</td>`;
        t += `<td style="${tdn}">${fmt(r.tip + r.press, 2)}</td>`;
        t += `<td style="${tdn}">${fmt(r.izin, 2)}</td>`;
        t += `<td style="${tdn}">${fmt(r.ru, 3)}</td>`;
        t += `<td style="${td};font-weight:700;color:${col}">${r.status}</td>`;
        var tr = document.createElement("tr");
        tr.innerHTML = t;
        document.getElementById("pzTb").appendChild(tr);
      });
    }
    function load() {
      fetch("/api/piezometer", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (j) {
        DATA = j.data || [];
        document.getElementById("pzLast").textContent = j.terakhir || "-";
        var sel = document.getElementById("pzName");
        var cur = sel.value;
        sel.innerHTML = "";
        DATA.forEach(function (r) {
          var o = document.createElement("option");
          o.value = r.name;
          o.textContent = r.name + " (STA " + r.sta + ")";
          sel.appendChild(o);
        });
        if (cur) sel.value = cur;
        render();
      }).catch(function (e) {
        document.getElementById("pzToast").textContent = "Gagal memuat: " + e.message;
      });
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
      var url = "/api/piezometer?" + prm.toString();
      var opt = { method: "POST", headers: { "Content-Type": "application/json" } };
      opt.body = JSON.stringify({ name: name, press: press, key: key, date: date });
      fetch(url, opt).then(function (r) { return r.json(); }).then(function (j) {
        if (!j.ok) throw new Error(j.error || "gagal");
        var m = "? " + j.name + " tanggal " + j.date + " diperbarui: " + fmt(j.press, 2) + " m — " + j.status;
        document.getElementById("pzToast").innerHTML = `<span style="color:#22C55E">${m} (Ru ${fmt(j.ru, 3)})</span>`;
        load();
      }).catch(function (e) {
        document.getElementById("pzToast").innerHTML = `<span style="color:#EF4444">? ${e.message}</span>`;
      });
    });
    tab.addEventListener("click", function (e) {
      e.preventDefault();
      ov.style.display = "block";
      window.scrollTo(0, 0);
      load();
    });
    document.getElementById("pzBack").addEventListener("click", function () {
      ov.style.display = "none";
    });
    load();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", siap);
  else siap();
})();
