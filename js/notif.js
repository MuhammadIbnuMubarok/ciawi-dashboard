/* js/notif.js v3 — Notifikasi Ciawi, patokan resmi TMA OUTLET */
(function () {
  if (window.NotifCiawi) return;
  var CONFIG = {
    SUMBER_DATA: '/api/live',            // SESUAIKAN bila endpoint live-mu berbeda
    INTERVAL_DETIK: 60,
    ICON: '/icon-192.png',
    PATOKAN: { IV: 0.64, III: 1.86, II: 2.55, I: 3.48 },
    POSISI: 'kiri-bawah'
  };
  var ROMAWI = { '1':'I','2':'II','3':'III','4':'IV','i':'I','ii':'II','iii':'III','iv':'IV' };
  var KEY_PREF = 'ciawiNotifPref';
  var reg = null, timer = null, lastLevel = null, lastStatus = null;
  var didukung = ('Notification' in window) && ('serviceWorker' in navigator);

  function pref() { return localStorage.getItem(KEY_PREF) === 'on'; }
  function setPref(v) { localStorage.setItem(KEY_PREF, v ? 'on' : 'off'); }
  function izin() { return didukung ? Notification.permission : 'unsupported'; }
  function aktif() { return didukung && pref() && izin() === 'granted'; }
  function fmtF(f) { return (f == null || isNaN(f)) ? '-' : Number(f).toLocaleString('id-ID', { maximumFractionDigits: 2 }); }

  function cari(obj, keys, depth) {
    if ((depth || 0) > 4 || !obj || typeof obj !== 'object') return undefined;
    var ks = Object.keys(obj);
    for (var i = 0; i < ks.length; i++) {
      var kl = ks[i].toLowerCase();
      for (var j = 0; j < keys.length; j++) if (kl.indexOf(keys[j]) >= 0) return obj[ks[i]];
      var v = cari(obj[ks[i]], keys, (depth || 0) + 1);
      if (v !== undefined) return v;
    }
    return undefined;
  }
  function cariCombo(obj, a, b, depth) {
    if ((depth || 0) > 4 || !obj || typeof obj !== 'object') return undefined;
    var ks = Object.keys(obj);
    for (var i = 0; i < ks.length; i++) {
      var kl = ks[i].toLowerCase(), ok = true;
      for (var x = 0; x < a.length; x++) if (kl.indexOf(a[x]) < 0) ok = false;
      if (ok) for (var y = 0; y < b.length; y++) if (kl.indexOf(b[y]) < 0) ok = false;
      if (ok) return obj[ks[i]];
      var v = cariCombo(obj[ks[i]], a, b, (depth || 0) + 1);
      if (v !== undefined) return v;
    }
    return undefined;
  }
  function cariExact(obj, name, depth) {
    if ((depth || 0) > 4 || !obj || typeof obj !== 'object') return undefined;
    var ks = Object.keys(obj);
    for (var i = 0; i < ks.length; i++) {
      if (ks[i].toLowerCase() === name) return obj[ks[i]];
      var v = cariExact(obj[ks[i]], name, (depth || 0) + 1);
      if (v !== undefined) return v;
    }
    return undefined;
  }
  function tmaOutlet(d) {
    if (!d || typeof d !== 'object') return NaN;
    var v = cariCombo(d, ['tma'], ['out'], 0);
    if (v !== undefined) return Number(v);
    var o = cari(d, ['outlet'], 0);
    if (o && typeof o === 'object') { var t = cari(o, ['tma'], 0); if (t !== undefined) return Number(t); }
    var f = cari(d, ['f_now', 'fsekarang', 'f_skrg'], 0);
    if (f === undefined) f = cariExact(d, 'f', 0);
    return f === undefined ? NaN : Number(f);
  }
  function levelDariTMA(f) {
    if (f == null || isNaN(f)) return null;
    if (f >= CONFIG.PATOKAN.I) return 'I';
    if (f >= CONFIG.PATOKAN.II) return 'II';
    if (f >= CONFIG.PATOKAN.III) return 'III';
    if (f >= CONFIG.PATOKAN.IV) return 'IV';
    return null;
  }
  function levelSiaga(s) {
    if (!s) return null;
    var m = String(s).toLowerCase().match(/siaga\s*(i|ii|iii|iv|1|2|3|4)/);
    return m ? ROMAWI[m[1]] : null;
  }
  function levelDariData(d) {
    var statusStr = (d && typeof d === 'object') ? cari(d, ['status', 'level']) : d;
    var f = (d && typeof d === 'object') ? tmaOutlet(d) : NaN;
    return { level: levelSiaga(statusStr) || levelDariTMA(f), f: f, statusStr: statusStr == null ? null : String(statusStr) };
  }

  function opsiNotif(p) {
    p = p || {};
    return {
      body: p.body || p.isi || '',
      icon: p.icon || CONFIG.ICON,
      badge: p.icon || CONFIG.ICON,
      timestamp: p.timestamp ? new Date(p.timestamp).getTime() : Date.now(),
      tag: p.tag || 'ciawi-notif',
      data: { url: p.url || '/', aksi: p.aksi || null },
      actions: p.aksi
        ? [{ action: 'open', title: p.aksi }, { action: 'close', title: 'Tutup' }]
        : [{ action: 'open', title: 'Buka Dashboard' }]
    };
  }
  function kirim(payload) {
    if (!aktif()) return Promise.resolve(false);
    var p = payload || {};
    return navigator.serviceWorker.ready.then(function (r) {
      return r.showNotification(p.title || 'Ciawi Dashboard', opsiNotif(p));
    }).then(function () { return true; }).catch(function () { return false; });
  }

  function evaluasi(d, opts) {
    var r = levelDariData(d);
    if (r.level !== lastLevel) {
      var prev = lastLevel;
      if (r.level) {
        kirim({
          title: '🚨 SIAGA ' + r.level + ' — Bendungan Ciawi',
          body: 'TMA outlet ' + fmtF(r.f) + ' m (patokan Siaga ' + r.level + ' ≥ ' + fmtF(CONFIG.PATOKAN[r.level]) + ' m).' +
                (r.statusStr ? ' Status sistem: ' + r.statusStr + '.' : '') + ' Segera periksa dashboard.',
          url: '/', aksi: 'Buka Dashboard', tag: 'siaga-' + r.level
        });
      } else if (prev) {
        kirim({ title: '✅ KEMBALI NORMAL — Bendungan Ciawi', body: 'TMA outlet ' + fmtF(r.f) + ' m, di bawah patokan 0,64 m.', url: '/', aksi: 'Buka Dashboard', tag: 'normal' });
      }
      lastLevel = r.level;
      window.dispatchEvent(new CustomEvent('ciawi:siaga', { detail: { level: r.level, prev: prev, f: r.f, uji: !!(opts && opts.uji) } }));
    } else if (r.statusStr && lastStatus && r.statusStr.toLowerCase() !== lastStatus) {
      kirim({ title: 'Perubahan Status: ' + r.statusStr.toUpperCase(), body: 'Status sistem: ' + r.statusStr + '. TMA outlet ' + fmtF(r.f) + ' m.', url: '/', aksi: 'Buka Dashboard', tag: 'status-' + r.statusStr.toLowerCase() });
    }
    if (r.statusStr) lastStatus = r.statusStr.toLowerCase();
  }

  function isMin() { var p = document.getElementById('ciawiNotifPill'); return !!p && p.classList.contains('min'); }
  function setMin(v) { var p = document.getElementById('ciawiNotifPill'); if (!p) return; p.classList.toggle('min', v); localStorage.setItem('ciawiNotifMin', v ? '1' : '0'); var b = document.getElementById('ciawiNotifMin'); if (b) { b.textContent = v ? '🔔' : '—'; b.title = v ? 'Buka panel notifikasi' : 'Kecilkan'; } }
  function gambarUI() {
    if (document.getElementById('ciawiNotifPill')) return;
    var st = document.createElement('style');
    st.textContent = '#ciawiNotifPill{position:fixed;z-index:99999;touch-action:none;user-select:none;-webkit-user-select:none;cursor:grab;display:flex;align-items:center;gap:8px;background:#0f172a;color:#e2e8f0;border:1px solid #334155;padding:8px 12px;border-radius:999px;font:12px/1.2 system-ui,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.35)}#ciawiNotifPill.pos-kiri-bawah{left:16px;bottom:16px}#ciawiNotifPill.pos-kanan-bawah{right:16px;bottom:16px}#ciawiNotifPill.pos-kiri-atas{left:16px;top:16px}#ciawiNotifPill.pos-kanan-atas{right:16px;top:16px}#ciawiNotifPill.min{padding:0;border:0;background:transparent;box-shadow:none}#ciawiNotifPill.min #ciawiNotifStatus,#ciawiNotifPill.min #ciawiNotifBtn,#ciawiNotifPill.min #ciawiSireneBtn{display:none}#ciawiNotifMin{cursor:pointer;background:#334155;border:0;color:#fff;border-radius:999px;padding:6px 10px;font-size:12px}#ciawiNotifPill.min #ciawiNotifMin{background:#1d4ed8;padding:10px 12px;font-size:16px;box-shadow:0 4px 14px rgba(0,0,0,.35)}#ciawiNotifBtn{cursor:pointer;background:#1d4ed8;border:0;color:#fff;border-radius:999px;padding:6px 10px;font-size:12px}';
    document.head.appendChild(st);
    var pill = document.createElement('div');
    pill.id = 'ciawiNotifPill';
    pill.innerHTML = '<button id="ciawiNotifBtn" type="button">🔔 Aktifkan</button><span id="ciawiNotifStatus">Notifikasi Nonaktif</span><button id="ciawiNotifMin" type="button" title="Kecilkan">—</button>';
    document.body.appendChild(pill);
    document.getElementById('ciawiNotifBtn').addEventListener('click', toggle);
    var xy = null; try { xy = JSON.parse(localStorage.getItem('ciawiNotifXY') || 'null'); } catch (e) {}
    if (xy && typeof xy.x === 'number' && typeof xy.y === 'number') { pill.style.left = xy.x + 'px'; pill.style.top = xy.y + 'px'; }
    else { pill.classList.add('pos-' + (localStorage.getItem('ciawiNotifPos') || CONFIG.POSISI || 'kiri-bawah')); }
    var drag = null, dragMoved = 0;
    function dragMove(ev) {
      if (!drag) return;
      if (Math.abs(ev.clientX - drag.sx) + Math.abs(ev.clientY - drag.sy) > 6) dragMoved = 1;
      var x = Math.min(Math.max(4, ev.clientX - drag.dx), window.innerWidth - pill.offsetWidth - 4);
      var y = Math.min(Math.max(4, ev.clientY - drag.dy), window.innerHeight - pill.offsetHeight - 4);
      pill.style.left = x + 'px'; pill.style.top = y + 'px';
    }
    function dragUp() {
      if (!drag) return;
      drag = null;
      document.removeEventListener('pointermove', dragMove);
      document.removeEventListener('pointerup', dragUp);
      if (dragMoved) localStorage.setItem('ciawiNotifXY', JSON.stringify({ x: pill.offsetLeft, y: pill.offsetTop }));
    }
    pill.addEventListener('pointerdown', function (ev) {
      if (ev.target.closest('button') && ev.target.id !== 'ciawiNotifMin') return;
      drag = { sx: ev.clientX, sy: ev.clientY, dx: ev.clientX - pill.offsetLeft, dy: ev.clientY - pill.offsetTop };
      dragMoved = 0;
      document.addEventListener('pointermove', dragMove);
      document.addEventListener('pointerup', dragUp);
    });
    var bMin = document.getElementById('ciawiNotifMin'); bMin.addEventListener('click', function () { if (dragMoved) { dragMoved = 0; return; } setMin(!isMin()); }); setMin(localStorage.getItem('ciawiNotifMin') === '1');
    segarkanStatus();
  }
  function segarkanStatus() {
    var el = document.getElementById('ciawiNotifStatus');
    var btn = document.getElementById('ciawiNotifBtn');
    if (!el) return;
    if (!didukung) { el.textContent = 'Browser tidak mendukung notifikasi'; if (btn) btn.style.display = 'none'; return; }
    if (izin() === 'denied') { el.textContent = 'Notifikasi diblokir browser (buka izin situs di address bar)'; if (btn) { btn.textContent = '🔕 Terblokir'; btn.disabled = true; } return; }
    if (aktif()) { el.textContent = 'Notifikasi Aktif'; if (btn) btn.textContent = '🔕 Matikan'; }
    else { el.textContent = 'Notifikasi Nonaktif'; if (btn) btn.textContent = '🔔 Aktifkan'; }
  }
  function sambutan() {
    kirim({ title: 'Notifikasi Diaktifkan', body: 'Pemberitahuan Siaga I-IV (patokan TMA outlet 0,64/1,86/2,55/3,48 m) akan masuk ke perangkat ini.', url: '/', aksi: 'Buka Dashboard' });
  }
  function toggle() {
    if (!didukung) return;
    if (aktif()) { nonaktifkan(); return; }
    if (izin() === 'granted') { setPref(true); segarkanStatus(); sambutan(); mulaiWatcher(); return; }
    Notification.requestPermission().then(function (perm) {
      if (perm === 'granted') { setPref(true); segarkanStatus(); pastikanSW().then(sambutan); mulaiWatcher(); }
      else { setPref(false); segarkanStatus(); }
    });
  }
  function nonaktifkan() {
    setPref(false);
    if (reg) reg.getNotifications().then(function (list) { list.forEach(function (n) { n.close(); }); });
    segarkanStatus();
  }
  function pastikanSW() {
    if (reg) return Promise.resolve(reg);
    return navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(function (r) { reg = r; return navigator.serviceWorker.ready; })
      .then(function (r) { reg = r; return r; })
      .catch(function (e) { console.warn('[notif] SW gagal:', e); return null; });
  }
  function mulaiWatcher() {
    if (timer || !CONFIG.SUMBER_DATA) return;
    timer = setInterval(poll, CONFIG.INTERVAL_DETIK * 1000);
    poll();
  }
  function poll() {
    if (!aktif()) return;
    fetch(CONFIG.SUMBER_DATA, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { if (d) evaluasi(d); })
      .catch(function () { });
  }
  window.addEventListener('ciawi:status', function (e) { if (e && e.detail) evaluasi(e.detail); });

  function init() {
    gambarUI();
    if (didukung && pref() && izin() === 'granted') { pastikanSW(); mulaiWatcher(); }
    segarkanStatus();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.NotifCiawi = {
    kirim: kirim,
    aktif: aktif,
    aktifkan: function () { if (!aktif()) toggle(); },
    nonaktifkan: nonaktifkan,
    status: function () { return aktif() ? 'Notifikasi Aktif' : 'Notifikasi Nonaktif'; },
    ujiSiaga: function (lvl) {
      var L = ROMAWI[String(lvl).toLowerCase()] || String(lvl).toUpperCase();
      return kirim({ title: '🚨 SIAGA ' + L + ' — Bendungan Ciawi', body: 'SIMULASI notifikasi Siaga ' + L + '.', url: '/', aksi: 'Buka Dashboard', tag: 'siaga-' + L });
    },
    ujiTMA: function (f) { evaluasi({ tma_outlet: f }, { uji: true }); },
    levelDariData: levelDariData,
    config: CONFIG,
    pindah: function (pos) { var p = document.getElementById('ciawiNotifPill'); if (!p) return; p.classList.remove('pos-kiri-bawah', 'pos-kanan-bawah', 'pos-kiri-atas', 'pos-kanan-atas'); p.classList.add('pos-' + pos); localStorage.setItem('ciawiNotifPos', pos); },
    kecilkan: function (v) { setMin(v !== false); },
    resetPos: function () { localStorage.removeItem('ciawiNotifXY'); localStorage.removeItem('ciawiNotifPos'); location.reload(); }
  };
})();