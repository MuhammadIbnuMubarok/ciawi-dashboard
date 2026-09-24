/* js/sirene.js v3 — sirene bertingkat mengikuti event ciawi:siaga */
(function () {
  if (window.SireneCiawi) return;
  var CONFIG = { DURASI: { I: 20, II: 15, III: 10, IV: 8 }, VOLUME: 0.6, JEDA_MENIT: 5 };
  var KEY = 'ciawiSirenePref';
  var ctx = null;

  function prefOn() { return localStorage.getItem(KEY) !== 'off'; }
  function setPref(v) { localStorage.setItem(KEY, v ? 'on' : 'off'); }
  function unlock() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!ctx) ctx = new AC();
    if (ctx.state === 'suspended') ctx.resume();
  }
  document.addEventListener('click', unlock, true);
  function bunyi(durasi) {
    if (!prefOn()) return false;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      unlock();
      if (!ctx || ctx.state !== 'running') return false;
      var t0 = ctx.currentTime, total = durasi || 10, vol = CONFIG.VOLUME;
      var osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type = 'sawtooth';
      for (var t = 0; t < total; t += 2) {
        osc.frequency.setValueAtTime(520, t0 + t);
        osc.frequency.linearRampToValueAtTime(900, t0 + t + 1);
        osc.frequency.linearRampToValueAtTime(520, t0 + t + 2);
      }
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.3);
      g.gain.setValueAtTime(vol, t0 + Math.max(0.3, total - 0.6));
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + total);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(t0); osc.stop(t0 + total + 0.1);
      if (navigator.vibrate) navigator.vibrate([900, 300, 900, 300, 1500]);
      return true;
    } catch (e) { console.warn('[sirene] audio diblokir browser:', e); return false; }
  }
  function boleh(level, uji) {
    if (uji) return true;
    var k = 'ciawiSireneTS-' + level;
    var ts = Number(localStorage.getItem(k) || 0);
    if (Date.now() - ts < CONFIG.JEDA_MENIT * 60000) return false;
    localStorage.setItem(k, String(Date.now()));
    return true;
  }
  window.addEventListener('ciawi:siaga', function (e) {
    var d = e.detail || {};
    if (!d.level) return;
    if (boleh(d.level, d.uji)) bunyi(CONFIG.DURASI[d.level] || 10);
  });
  function tombolMute() {
    var pill = document.getElementById('ciawiNotifPill');
    if (!pill || document.getElementById('ciawiSireneBtn')) return;
    var b = document.createElement('button');
    b.id = 'ciawiSireneBtn'; b.type = 'button';
    b.style.cssText = 'cursor:pointer;background:#334155;border:0;color:#fff;border-radius:999px;padding:6px 10px;font-size:12px';
    b.textContent = prefOn() ? '🔊 Sirene ON' : '🔇 Sirene OFF';
    b.addEventListener('click', function () {
      setPref(!prefOn());
      b.textContent = prefOn() ? '🔊 Sirene ON' : '🔇 Sirene OFF';
      if (prefOn()) bunyi(2);
    });
    pill.appendChild(b);
  }
  function init() {
    var tM = setInterval(function () { tombolMute(); if (document.getElementById('ciawiSireneBtn')) clearInterval(tM); }, 1500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  window.SireneCiawi = {
    uji: function () { return bunyi(6); },
    ujiLevel: function (L) { return bunyi(CONFIG.DURASI[String(L).toUpperCase()] || 10); },
    aktif: function () { return prefOn(); },
    setAktif: function (v) { setPref(!!v); },
    config: CONFIG
  };
})();