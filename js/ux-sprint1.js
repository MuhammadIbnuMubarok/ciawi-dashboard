(function () {
  function jalanTeks(fn) {
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    var n;
    while ((n = w.nextNode())) {
      var r = fn(n.nodeValue);
      if (r !== null) n.nodeValue = r;
    }
  }
  function rapikan() {
    jalanTeks(function (s) {
      if (s.indexOf("TERSIMPAN:") >= 0) return s.replace("TERSIMPAN:", "REKAMAN NERACA:");
      if (s.trim() === "sumber") return s.replace("sumber", "LIHAT SUMBER DATA");
      if (s.trim() === "REFRESH") return s.replace("REFRESH", "SEGARKAN");
      return null;
    });
    var els = document.querySelectorAll("span, div, b");
    els.forEach(function (el) {
      if (el.children.length === 0) {
        var t = (el.textContent || "").trim();
        if (t === "HULU TERPUTUS" || t === "OFFLINE") {
          if ((el.textContent || "").indexOf("SUMBER:") !== 0) el.textContent = "SUMBER: " + t;
          el.style.opacity = "0.8";
        }
      }
    });
  }
  function siap() {
    ["pzOverlay", "rtsOverlay"].forEach(function (id) {
      var ov = document.getElementById(id);
      if (ov) { ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); }
    });
    ["pzToast", "dam-live-status"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.setAttribute("aria-live", "polite");
    });
    var st = document.createElement("style");
    st.textContent = "#dam-live-status{font-size:11px;opacity:.85}";
    document.head.appendChild(st);
    var lastFocus = null;
    var obs = new MutationObserver(function () {
      ["pzOverlay", "rtsOverlay"].forEach(function (id) {
        var ov = document.getElementById(id);
        if (!ov) return;
        var open = ov.style.display === "block";
        if (open && ov.dataset.uxOpen !== "1") { ov.dataset.uxOpen = "1"; lastFocus = document.activeElement; }
        if (!open && ov.dataset.uxOpen === "1") { ov.dataset.uxOpen = "0"; if (lastFocus && lastFocus.focus) lastFocus.focus(); }
      });
    });
    obs.observe(document.body, { attributes: true, subtree: true, attributeFilter: ["style"] });
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      ["pzOverlay", "rtsOverlay"].forEach(function (id) {
        var ov = document.getElementById(id);
        if (!ov || ov.style.display !== "block") return;
        var btn = ov.querySelector("#pzBack") || ov.querySelector("#rtsBack");
        if (!btn) {
          var bs = ov.querySelectorAll("button");
          for (var i = 0; i < bs.length; i++) {
            if (/DASHBOARD/.test(bs[i].textContent || "")) { btn = bs[i]; break; }
          }
        }
        if (btn) btn.click();
      });
    });
    rapikan();
    setInterval(rapikan, 15000);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", siap);
  else siap();
})();
