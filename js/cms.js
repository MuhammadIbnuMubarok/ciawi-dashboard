/* ============================================================
   CMS MODULE v1.0 — Content Management System
   Bendungan Ciawi Dashboard
   
   Fitur:
   1. Inline editing teks/label di dashboard
   2. Panel edit data teknis bendungan
   3. CMS halaman untuk berita/pengumuman/galeri
   4. Semua perubahan disimpan di localStorage
   ============================================================ */

(function () {
  'use strict';

  // ─── STORAGE KEY ────────────────────────────────────────────
  const CMS_KEY = 'ciawi-cms-data';
  const CMS_VER = 1;

  // ─── DEFAULT CMS DATA ──────────────────────────────────────
  function defaultCMS() {
    return {
      _v: CMS_VER,
      editMode: false,
      // --- Teks/Label yang bisa diedit inline ---
      labels: {},
      // --- Data Teknis Bendungan ---
      teknis: {
        tipeStruktur: 'DRY DAM (BENDUNGAN KERING)',
        fungsi: 'PENGENDALI BANJIR CILIWUNG HULU',
        panjangPuncak: '334,50 m',
        elvPelimpah: '546,75 m',
        elvPMF: '550,39 m',
        batasNormal: '< 520,00 m',
        sumberData: 'NERACA.csv',
        sumberLembaga: 'BBWS CILIWUNG-CISADANE',
      },
      // --- Berita / Pengumuman ---
      berita: [
        {
          id: 'b1',
          judul: 'Pemeliharaan Rutin Konduit Bendungan Ciawi',
          tanggal: '2026-09-20',
          kategori: 'pengumuman',
          isi: 'Pemeliharaan rutin konduit bawah Bendungan Ciawi akan dilaksanakan pada tanggal 25-27 September 2026. Selama pemeliharaan, bukaan konduit akan diatur minimal untuk menjaga keselamatan.',
          gambar: '',
          pinned: true,
        },
        {
          id: 'b2',
          judul: 'Laporan Evaluasi Banjir Juli 2025 Tersedia',
          tanggal: '2026-08-15',
          kategori: 'berita',
          isi: 'Laporan evaluasi lengkap kejadian banjir rekor Juli 2025 dengan elevasi 532,20 m telah tersedia. Bendungan Ciawi berhasil mereduksi debit puncak secara signifikan.',
          gambar: '',
          pinned: false,
        },
        {
          id: 'b3',
          judul: 'Update Sistem Telemetri SCADA',
          tanggal: '2026-07-10',
          kategori: 'berita',
          isi: 'Sistem telemetri SCADA telah diperbarui dengan sensor baru di inlet dan outlet bendungan. Data TMA kini lebih akurat dengan resolusi lebih tinggi.',
          gambar: '',
          pinned: false,
        },
      ],
      // --- Galeri Foto ---
      galeri: [
        {
          id: 'g1',
          judul: 'Inlet Bendungan Ciawi',
          src: 'inlet.jpg',
          keterangan: 'Tampak saluran inlet saat kondisi normal',
        },
        {
          id: 'g2',
          judul: 'Outlet Bendungan Ciawi',
          src: 'outlet.jpg',
          keterangan: 'Tampak konduit outlet dari sisi hilir',
        },
      ],
    };
  }

  // ─── LOAD / SAVE ───────────────────────────────────────────
  function loadCMS() {
    const def = defaultCMS();
    try {
      const raw = localStorage.getItem(CMS_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d && d._v === CMS_VER) {
          return {
            _v: CMS_VER,
            editMode: Boolean(d.editMode),
            labels: Object.assign({}, def.labels, d.labels || {}),
            teknis: Object.assign({}, def.teknis, d.teknis || {}),
            berita: Array.isArray(d.berita) ? d.berita : def.berita,
            galeri: Array.isArray(d.galeri) ? d.galeri : def.galeri,
          };
        }
      }
    } catch (e) {
      console.warn('CMS: gagal membaca cache localStorage, gunakan konfigurasi default.', e);
    }
    return def;
  }
  function saveCMS(data) {
    try {
      localStorage.setItem(CMS_KEY, JSON.stringify(data));
    } catch (e) {}
  }

  let cms = loadCMS();

  // ─── UTILITIES ─────────────────────────────────────────────
  function eid(id) {
    return document.getElementById(id);
  }
  function uuid() {
    return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }
  function escHTML(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }
  function tglFormat(iso) {
    if (!iso) return '—';
    const d = new Date(iso + 'T00:00:00');
    const mn = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    return d.getDate() + ' ' + mn[d.getMonth()] + ' ' + d.getFullYear();
  }

  // ─────────────────────────────────────────────────────────
  // 1. INLINE EDITING — teks/label bisa diedit langsung
  // ─────────────────────────────────────────────────────────
  const EDITABLE_SELECTORS = [
    // header
    { sel: 'header .font-headline.text-primary', key: 'header-brand' },
    { sel: 'header h1.font-headline .cms-title-main', key: 'header-title' },
    // nav buttons
    { sel: 'nav > .nav-item:nth-child(1)', key: 'nav-dashboard' },
    { sel: 'nav > .nav-item:nth-child(2)', key: 'nav-hidrograf' },
    { sel: 'nav > .nav-item:nth-child(3)', key: 'nav-neraca' },
    { sel: 'nav > .nav-item:nth-child(4)', key: 'nav-teknis' },
    { sel: 'nav > .nav-item:nth-child(5)', key: 'nav-konten' },
    // section titles
    { sel: '#section-teknis h2', key: 'title-teknis', multi: true },
    { sel: '#section-hidrograf h3', key: 'title-hidrograf' },
    { sel: '#section-tabel-telemetri h3', key: 'title-tabel' },
  ];

  function setupInlineEditing() {
    if (!cms.editMode) return;
    EDITABLE_SELECTORS.forEach(function (cfg) {
      const els = cfg.multi ? document.querySelectorAll(cfg.sel) : [document.querySelector(cfg.sel)];
      els.forEach(function (el, idx) {
        if (!el || el.dataset.cmsInline) return;
        el.dataset.cmsInline = '1';
        el.contentEditable = 'true';
        el.classList.add('cms-editable');
        // restore saved
        const k = cfg.key + (cfg.multi ? '-' + idx : '');
        if (cms.labels[k]) el.textContent = cms.labels[k];

        // Mencegah klik navigasi ketika sedang dalam mode edit agar bisa fokus mengedit
        el.addEventListener('click', function (e) {
          if (cms.editMode) {
            e.stopPropagation();
          }
        });

        el.addEventListener('blur', function () {
          cms.labels[k] = el.textContent.trim();
          saveCMS(cms);
          showCmsToast('Label disimpan');
        });
        el.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') {
            e.preventDefault();
            el.blur();
          }
        });
      });
    });
  }

  function restoreLabels() {
    EDITABLE_SELECTORS.forEach(function (cfg) {
      const els = cfg.multi ? document.querySelectorAll(cfg.sel) : [document.querySelector(cfg.sel)];
      els.forEach(function (el, idx) {
        if (!el) return;
        const k = cfg.key + (cfg.multi ? '-' + idx : '');
        if (cms.labels[k]) el.textContent = cms.labels[k];
      });
    });
  }

  function removeInlineEditing() {
    document.querySelectorAll('[data-cms-inline]').forEach(function (el) {
      el.contentEditable = 'false';
      el.classList.remove('cms-editable');
      el.removeAttribute('data-cms-inline');
    });
  }

  // ─────────────────────────────────────────────────────────
  // 2. PANEL EDIT DATA TEKNIS
  // ─────────────────────────────────────────────────────────
  function applyTeknisData() {
    const t = cms.teknis;
    const rows = document.querySelectorAll('#teknis-body > div');
    const map = [
      'tipeStruktur', 'fungsi', 'panjangPuncak', 'elvPelimpah',
      'elvPMF', 'batasNormal', 'sumberData',
    ];
    rows.forEach(function (row, i) {
      if (i >= map.length) return;
      // Gunakan children[1] untuk menghindari seleksi span anak bersarang
      const val = row.children[1] || row.querySelector('span:last-child');
      if (val && t[map[i]]) {
        if (map[i] === 'sumberData') {
          val.innerHTML = escHTML(t.sumberData) + '<br><span class="text-[9px] text-on-surface-variant font-normal">' + escHTML(t.sumberLembaga || '') + '</span>';
        } else {
          val.textContent = t[map[i]];
        }
      }
    });
  }

  function openTeknisEditor() {
    const t = cms.teknis;
    const fields = [
      { key: 'tipeStruktur', label: 'Tipe Struktur' },
      { key: 'fungsi', label: 'Fungsi' },
      { key: 'panjangPuncak', label: 'Panjang Puncak' },
      { key: 'elvPelimpah', label: 'Elv. Pelimpah (Spillway)' },
      { key: 'elvPMF', label: 'Elv. PMF' },
      { key: 'batasNormal', label: 'Batas Operasi Normal' },
      { key: 'sumberData', label: 'Sumber Data' },
      { key: 'sumberLembaga', label: 'Sumber Lembaga' },
    ];
    let html = '<div class="cms-modal-overlay" id="cms-teknis-modal">';
    html += '<div class="cms-modal">';
    html += '<div class="cms-modal-header"><span class="material-symbols-outlined" style="font-size:20px;color:#4cd7f6">architecture</span><h3>Edit Data Teknis Bendungan</h3><button class="cms-btn-close" onclick="document.getElementById(\'cms-teknis-modal\').remove()">✕</button></div>';
    html += '<div class="cms-modal-body">';
    fields.forEach(function (f) {
      html += '<div class="cms-field"><label>' + f.label + '</label><input type="text" id="cms-tek-' + f.key + '" value="' + escHTML(t[f.key] || '') + '"></div>';
    });
    html += '</div>';
    html += '<div class="cms-modal-footer"><button class="cms-btn cms-btn-secondary" onclick="document.getElementById(\'cms-teknis-modal\').remove()">Batal</button><button class="cms-btn cms-btn-primary" onclick="window.__cms.saveTeknisEditor()">Simpan</button></div>';
    html += '</div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
  }

  function saveTeknisEditor() {
    const fields = ['tipeStruktur', 'fungsi', 'panjangPuncak', 'elvPelimpah', 'elvPMF', 'batasNormal', 'sumberData', 'sumberLembaga'];
    fields.forEach(function (k) {
      const inp = eid('cms-tek-' + k);
      if (inp) cms.teknis[k] = inp.value.trim();
    });
    saveCMS(cms);
    applyTeknisData();
    const m = eid('cms-teknis-modal');
    if (m) m.remove();
    showCmsToast('Data teknis disimpan');
  }

  // ─────────────────────────────────────────────────────────
  // 3. CMS BERITA / PENGUMUMAN
  // ─────────────────────────────────────────────────────────
  function renderBerita() {
    const container = eid('cms-berita-list');
    if (!container) return;
    const items = cms.berita.sort(function (a, b) {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return b.tanggal.localeCompare(a.tanggal);
    });
    if (!items.length) {
      container.innerHTML = '<div class="cms-empty">Belum ada berita atau pengumuman. Klik tombol "Tambah" untuk membuat baru.</div>';
      return;
    }
    container.innerHTML = items.map(function (item) {
      const catColor = item.kategori === 'pengumuman' ? '#fbbf24' : '#4cd7f6';
      const catLabel = item.kategori === 'pengumuman' ? 'PENGUMUMAN' : 'BERITA';
      const pinnedBadge = item.pinned ? '<span class="cms-badge-pin">📌 DISEMATKAN</span>' : '';
      return '<div class="cms-berita-card" data-id="' + item.id + '">'
        + '<div class="cms-berita-header">'
        + '<div class="cms-berita-meta">'
        + '<span class="cms-berita-cat" style="color:' + catColor + ';border-color:' + catColor + '">' + catLabel + '</span>'
        + pinnedBadge
        + '<span class="cms-berita-date">' + tglFormat(item.tanggal) + '</span>'
        + '</div>'
        + (cms.editMode ? '<div class="cms-berita-actions">'
          + '<button class="cms-btn-icon" onclick="window.__cms.editBerita(\'' + item.id + '\')" title="Edit"><span class="material-symbols-outlined" style="font-size:16px">edit</span></button>'
          + '<button class="cms-btn-icon" onclick="window.__cms.pinBerita(\'' + item.id + '\')" title="' + (item.pinned ? 'Lepas Pin' : 'Sematkan') + '"><span class="material-symbols-outlined" style="font-size:16px">' + (item.pinned ? 'push_pin' : 'keep') + '</span></button>'
          + '<button class="cms-btn-icon cms-btn-danger" onclick="window.__cms.deleteBerita(\'' + item.id + '\')" title="Hapus"><span class="material-symbols-outlined" style="font-size:16px">delete</span></button>'
          + '</div>' : '')
        + '</div>'
        + '<h4 class="cms-berita-title">' + escHTML(item.judul) + '</h4>'
        + '<p class="cms-berita-isi">' + escHTML(item.isi) + '</p>'
        + (item.gambar ? '<img class="cms-berita-img" src="' + escHTML(item.gambar) + '" alt="' + escHTML(item.judul) + '">' : '')
        + '</div>';
    }).join('');
  }

  function openBeritaEditor(item) {
    const isNew = !item;
    item = item || { id: uuid(), judul: '', tanggal: new Date().toISOString().slice(0, 10), kategori: 'berita', isi: '', gambar: '', pinned: false };
    let html = '<div class="cms-modal-overlay" id="cms-berita-modal">';
    html += '<div class="cms-modal cms-modal-lg">';
    html += '<div class="cms-modal-header"><span class="material-symbols-outlined" style="font-size:20px;color:#4cd7f6">' + (isNew ? 'add_circle' : 'edit') + '</span><h3>' + (isNew ? 'Tambah Berita / Pengumuman' : 'Edit: ' + escHTML(item.judul)) + '</h3><button class="cms-btn-close" onclick="document.getElementById(\'cms-berita-modal\').remove()">✕</button></div>';
    html += '<div class="cms-modal-body">';
    html += '<div class="cms-field"><label>Judul</label><input type="text" id="cms-brt-judul" value="' + escHTML(item.judul) + '" placeholder="Judul berita / pengumuman..."></div>';
    html += '<div class="cms-field-row"><div class="cms-field"><label>Tanggal</label><input type="date" id="cms-brt-tanggal" value="' + item.tanggal + '"></div>';
    html += '<div class="cms-field"><label>Kategori</label><select id="cms-brt-kategori"><option value="berita"' + (item.kategori === 'berita' ? ' selected' : '') + '>Berita</option><option value="pengumuman"' + (item.kategori === 'pengumuman' ? ' selected' : '') + '>Pengumuman</option></select></div></div>';
    html += '<div class="cms-field"><label>Isi Konten</label><textarea id="cms-brt-isi" rows="5" placeholder="Tulis isi berita / pengumuman...">' + escHTML(item.isi) + '</textarea></div>';
    html += '<div class="cms-field"><label>URL Gambar (opsional)</label><input type="text" id="cms-brt-gambar" value="' + escHTML(item.gambar) + '" placeholder="contoh: inlet.jpg atau https://..."></div>';
    html += '<div class="cms-field"><label class="cms-checkbox"><input type="checkbox" id="cms-brt-pinned"' + (item.pinned ? ' checked' : '') + '> Sematkan di atas (pinned)</label></div>';
    html += '</div>';
    html += '<div class="cms-modal-footer"><button class="cms-btn cms-btn-secondary" onclick="document.getElementById(\'cms-berita-modal\').remove()">Batal</button><button class="cms-btn cms-btn-primary" onclick="window.__cms.saveBerita(\'' + item.id + '\',' + isNew + ')">Simpan</button></div>';
    html += '</div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
  }

  function saveBerita(id, isNew) {
    const judul = (eid('cms-brt-judul') || {}).value || '';
    const tanggal = (eid('cms-brt-tanggal') || {}).value || '';
    const kategori = (eid('cms-brt-kategori') || {}).value || 'berita';
    const isi = (eid('cms-brt-isi') || {}).value || '';
    const gambar = (eid('cms-brt-gambar') || {}).value || '';
    const pinned = (eid('cms-brt-pinned') || {}).checked || false;
    if (!judul.trim()) { alert('Judul harus diisi.'); return; }
    const item = { id: id, judul: judul.trim(), tanggal: tanggal, kategori: kategori, isi: isi.trim(), gambar: gambar.trim(), pinned: pinned };
    if (isNew) {
      cms.berita.push(item);
    } else {
      const idx = cms.berita.findIndex(function (b) { return b.id === id; });
      if (idx >= 0) cms.berita[idx] = item;
    }
    saveCMS(cms);
    renderBerita();
    const m = eid('cms-berita-modal');
    if (m) m.remove();
    showCmsToast(isNew ? 'Berita berhasil ditambahkan' : 'Berita berhasil diperbarui');
  }

  function editBerita(id) {
    const item = cms.berita.find(function (b) { return b.id === id; });
    if (item) openBeritaEditor(item);
  }

  function deleteBerita(id) {
    if (!confirm('Hapus berita ini?')) return;
    cms.berita = cms.berita.filter(function (b) { return b.id !== id; });
    saveCMS(cms);
    renderBerita();
    showCmsToast('Berita dihapus');
  }

  function pinBerita(id) {
    const item = cms.berita.find(function (b) { return b.id === id; });
    if (item) { item.pinned = !item.pinned; saveCMS(cms); renderBerita(); }
  }

  // ─────────────────────────────────────────────────────────
  // 4. CMS GALERI FOTO
  // ─────────────────────────────────────────────────────────
  function renderGaleri() {
    const container = eid('cms-galeri-grid');
    if (!container) return;
    if (!cms.galeri.length) {
      container.innerHTML = '<div class="cms-empty">Belum ada foto di galeri. Klik tombol "Tambah" untuk menambahkan.</div>';
      return;
    }
    container.innerHTML = cms.galeri.map(function (g) {
      return '<div class="cms-galeri-item" data-id="' + g.id + '">'
        + '<div class="cms-galeri-img-wrap"><img src="' + escHTML(g.src) + '" alt="' + escHTML(g.judul) + '" onerror="this.style.display=\'none\'"></div>'
        + '<div class="cms-galeri-info">'
        + '<h5>' + escHTML(g.judul) + '</h5>'
        + '<p>' + escHTML(g.keterangan) + '</p>'
        + '</div>'
        + (cms.editMode ? '<div class="cms-galeri-actions">'
          + '<button class="cms-btn-icon" onclick="window.__cms.editGaleri(\'' + g.id + '\')" title="Edit"><span class="material-symbols-outlined" style="font-size:14px">edit</span></button>'
          + '<button class="cms-btn-icon cms-btn-danger" onclick="window.__cms.deleteGaleri(\'' + g.id + '\')" title="Hapus"><span class="material-symbols-outlined" style="font-size:14px">delete</span></button>'
          + '</div>' : '')
        + '</div>';
    }).join('');
  }

  function openGaleriEditor(item) {
    const isNew = !item;
    item = item || { id: uuid(), judul: '', src: '', keterangan: '' };
    let html = '<div class="cms-modal-overlay" id="cms-galeri-modal">';
    html += '<div class="cms-modal">';
    html += '<div class="cms-modal-header"><span class="material-symbols-outlined" style="font-size:20px;color:#4cd7f6">photo_library</span><h3>' + (isNew ? 'Tambah Foto' : 'Edit Foto') + '</h3><button class="cms-btn-close" onclick="document.getElementById(\'cms-galeri-modal\').remove()">✕</button></div>';
    html += '<div class="cms-modal-body">';
    html += '<div class="cms-field"><label>Judul Foto</label><input type="text" id="cms-gal-judul" value="' + escHTML(item.judul) + '" placeholder="Judul foto..."></div>';
    html += '<div class="cms-field"><label>URL / Path Gambar</label><input type="text" id="cms-gal-src" value="' + escHTML(item.src) + '" placeholder="contoh: inlet.jpg atau https://..."></div>';
    html += '<div class="cms-field"><label>Keterangan</label><textarea id="cms-gal-ket" rows="3" placeholder="Keterangan singkat...">' + escHTML(item.keterangan) + '</textarea></div>';
    html += '</div>';
    html += '<div class="cms-modal-footer"><button class="cms-btn cms-btn-secondary" onclick="document.getElementById(\'cms-galeri-modal\').remove()">Batal</button><button class="cms-btn cms-btn-primary" onclick="window.__cms.saveGaleri(\'' + item.id + '\',' + isNew + ')">Simpan</button></div>';
    html += '</div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
  }

  function saveGaleri(id, isNew) {
    const judul = (eid('cms-gal-judul') || {}).value || '';
    const src = (eid('cms-gal-src') || {}).value || '';
    const ket = (eid('cms-gal-ket') || {}).value || '';
    if (!judul.trim() || !src.trim()) { alert('Judul dan URL gambar harus diisi.'); return; }
    const item = { id: id, judul: judul.trim(), src: src.trim(), keterangan: ket.trim() };
    if (isNew) { cms.galeri.push(item); } else {
      const idx = cms.galeri.findIndex(function (g) { return g.id === id; });
      if (idx >= 0) cms.galeri[idx] = item;
    }
    saveCMS(cms);
    renderGaleri();
    const m = eid('cms-galeri-modal');
    if (m) m.remove();
    showCmsToast(isNew ? 'Foto ditambahkan ke galeri' : 'Foto diperbarui');
  }

  function editGaleri(id) {
    const item = cms.galeri.find(function (g) { return g.id === id; });
    if (item) openGaleriEditor(item);
  }

  function deleteGaleri(id) {
    if (!confirm('Hapus foto ini dari galeri?')) return;
    cms.galeri = cms.galeri.filter(function (g) { return g.id !== id; });
    saveCMS(cms);
    renderGaleri();
    showCmsToast('Foto dihapus dari galeri');
  }

  // ─────────────────────────────────────────────────────────
  // 5. TOGGLE EDIT MODE & CMS PANEL
  // ─────────────────────────────────────────────────────────
  function toggleEditMode() {
    cms.editMode = !cms.editMode;
    saveCMS(cms);
    updateEditModeUI();
    if (cms.editMode) {
      setupInlineEditing();
      showCmsToast('Mode Edit AKTIF — klik teks untuk mengedit');
    } else {
      removeInlineEditing();
      showCmsToast('Mode Edit NONAKTIF');
    }
    renderBerita();
    renderGaleri();
  }

  function updateEditModeUI() {
    const btn = eid('cms-edit-toggle');
    const indicator = eid('cms-mode-indicator');
    if (btn) {
      btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px">' + (cms.editMode ? 'edit_off' : 'edit') + '</span>' + (cms.editMode ? 'KELUAR EDIT' : 'MODE EDIT');
      btn.classList.toggle('active', cms.editMode);
    }
    if (indicator) {
      indicator.style.display = cms.editMode ? 'flex' : 'none';
    }
    // show/hide edit-only buttons
    document.querySelectorAll('.cms-edit-only').forEach(function (el) {
      el.style.display = cms.editMode ? '' : 'none';
    });
    // teknis edit button
    const teknisBtn = eid('cms-btn-edit-teknis');
    if (teknisBtn) teknisBtn.style.display = cms.editMode ? 'inline-flex' : 'none';
  }

  function openCMSPanel() {
    const existing = eid('cms-panel-overlay');
    if (existing) { existing.remove(); return; }
    let html = '<div class="cms-modal-overlay" id="cms-panel-overlay">';
    html += '<div class="cms-modal cms-modal-xl">';
    html += '<div class="cms-modal-header"><span class="material-symbols-outlined" style="font-size:20px;color:#4cd7f6">dashboard_customize</span><h3>Content Management System (CMS)</h3><button class="cms-btn-close" onclick="document.getElementById(\'cms-panel-overlay\').remove()">✕</button></div>';
    html += '<div class="cms-modal-body" style="max-height:75vh;overflow-y:auto">';
    
    // Tabs
    html += '<div class="cms-tabs"><button class="cms-tab active" data-tab="labels" onclick="window.__cms.switchCmsTab(\'labels\',this)">Label & Teks</button><button class="cms-tab" data-tab="teknis" onclick="window.__cms.switchCmsTab(\'teknis\',this)">Data Teknis</button><button class="cms-tab" data-tab="berita" onclick="window.__cms.switchCmsTab(\'berita\',this)">Berita</button><button class="cms-tab" data-tab="galeri" onclick="window.__cms.switchCmsTab(\'galeri\',this)">Galeri</button><button class="cms-tab" data-tab="export" onclick="window.__cms.switchCmsTab(\'export\',this)">Ekspor/Impor</button></div>';

    // Tab: Labels
    html += '<div class="cms-tab-content active" id="cms-tc-labels">';
    html += '<p class="cms-hint">Aktifkan Mode Edit pada dashboard, lalu klik langsung pada teks yang ingin diedit. Perubahan tersimpan otomatis.</p>';
    html += '<div class="cms-saved-labels">';
    const keys = Object.keys(cms.labels);
    if (keys.length) {
      html += '<table class="cms-table"><thead><tr><th>Key</th><th>Nilai</th><th></th></tr></thead><tbody>';
      keys.forEach(function (k) {
        html += '<tr><td><code>' + escHTML(k) + '</code></td><td>' + escHTML(cms.labels[k]) + '</td><td><button class="cms-btn-icon cms-btn-danger" onclick="window.__cms.deleteLabel(\'' + escHTML(k) + '\')"><span class="material-symbols-outlined" style="font-size:14px">delete</span></button></td></tr>';
      });
      html += '</tbody></table>';
    } else {
      html += '<p class="cms-hint">Belum ada label yang diedit. Aktifkan Mode Edit untuk mulai.</p>';
    }
    html += '</div></div>';

    // Tab: Teknis
    html += '<div class="cms-tab-content" id="cms-tc-teknis" style="display:none">';
    var tFields = [
      { key: 'tipeStruktur', label: 'Tipe Struktur' },
      { key: 'fungsi', label: 'Fungsi' },
      { key: 'panjangPuncak', label: 'Panjang Puncak' },
      { key: 'elvPelimpah', label: 'Elv. Pelimpah' },
      { key: 'elvPMF', label: 'Elv. PMF' },
      { key: 'batasNormal', label: 'Batas Operasi Normal' },
      { key: 'sumberData', label: 'Sumber Data' },
      { key: 'sumberLembaga', label: 'Lembaga' },
    ];
    tFields.forEach(function (f) {
      html += '<div class="cms-field"><label>' + f.label + '</label><input type="text" id="cms-p-tek-' + f.key + '" value="' + escHTML(cms.teknis[f.key] || '') + '"></div>';
    });
    html += '<button class="cms-btn cms-btn-primary" onclick="window.__cms.saveTeknisCMS()">Simpan Data Teknis</button>';
    html += '</div>';

    // Tab: Berita
    html += '<div class="cms-tab-content" id="cms-tc-berita" style="display:none">';
    html += '<button class="cms-btn cms-btn-primary" style="margin-bottom:12px" onclick="window.__cms.addBerita()"><span class="material-symbols-outlined" style="font-size:16px">add</span> Tambah Berita</button>';
    html += '<div class="cms-berita-list-cms">';
    cms.berita.forEach(function (b) {
      html += '<div class="cms-berita-row"><div class="cms-berita-row-info"><span class="cms-berita-cat" style="color:' + (b.kategori === 'pengumuman' ? '#fbbf24' : '#4cd7f6') + ';border-color:' + (b.kategori === 'pengumuman' ? '#fbbf24' : '#4cd7f6') + '">' + (b.kategori === 'pengumuman' ? 'PENGUMUMAN' : 'BERITA') + '</span><strong>' + escHTML(b.judul) + '</strong><span class="cms-berita-date">' + tglFormat(b.tanggal) + '</span></div>';
      html += '<div class="cms-berita-row-actions"><button class="cms-btn-icon" onclick="window.__cms.editBerita(\'' + b.id + '\');document.getElementById(\'cms-panel-overlay\').remove();" title="Edit"><span class="material-symbols-outlined" style="font-size:16px">edit</span></button><button class="cms-btn-icon cms-btn-danger" onclick="window.__cms.deleteBeritaCMS(\'' + b.id + '\')" title="Hapus"><span class="material-symbols-outlined" style="font-size:16px">delete</span></button></div></div>';
    });
    html += '</div></div>';

    // Tab: Galeri
    html += '<div class="cms-tab-content" id="cms-tc-galeri" style="display:none">';
    html += '<button class="cms-btn cms-btn-primary" style="margin-bottom:12px" onclick="window.__cms.addGaleriCMS()"><span class="material-symbols-outlined" style="font-size:16px">add</span> Tambah Foto</button>';
    html += '<div class="cms-galeri-list-cms">';
    cms.galeri.forEach(function (g) {
      html += '<div class="cms-berita-row"><div class="cms-berita-row-info"><strong>' + escHTML(g.judul) + '</strong><span class="cms-berita-date">' + escHTML(g.src) + '</span></div>';
      html += '<div class="cms-berita-row-actions"><button class="cms-btn-icon" onclick="window.__cms.editGaleri(\'' + g.id + '\');document.getElementById(\'cms-panel-overlay\').remove();" title="Edit"><span class="material-symbols-outlined" style="font-size:16px">edit</span></button><button class="cms-btn-icon cms-btn-danger" onclick="window.__cms.deleteGaleriCMS(\'' + g.id + '\')" title="Hapus"><span class="material-symbols-outlined" style="font-size:16px">delete</span></button></div></div>';
    });
    html += '</div></div>';

    // Tab: Export/Import
    html += '<div class="cms-tab-content" id="cms-tc-export" style="display:none">';
    html += '<p class="cms-hint">Ekspor seluruh konfigurasi CMS (label, data teknis, berita, galeri) ke file JSON, atau impor dari file JSON sebelumnya.</p>';
    html += '<div style="display:flex;gap:8px;flex-wrap:wrap">';
    html += '<button class="cms-btn cms-btn-primary" onclick="window.__cms.exportCMS()"><span class="material-symbols-outlined" style="font-size:16px">download</span> Ekspor CMS</button>';
    html += '<button class="cms-btn cms-btn-secondary" onclick="document.getElementById(\'cms-import-file\').click()"><span class="material-symbols-outlined" style="font-size:16px">upload</span> Impor CMS</button>';
    html += '<input type="file" id="cms-import-file" accept=".json" style="display:none" onchange="window.__cms.importCMS(this)">';
    html += '<button class="cms-btn cms-btn-danger" onclick="window.__cms.resetCMS()"><span class="material-symbols-outlined" style="font-size:16px">restart_alt</span> Reset ke Default</button>';
    html += '</div></div>';

    html += '</div></div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
  }

  function switchCmsTab(tabKey, btn) {
    document.querySelectorAll('.cms-tab').forEach(function (t) { t.classList.remove('active'); });
    document.querySelectorAll('.cms-tab-content').forEach(function (tc) { tc.style.display = 'none'; tc.classList.remove('active'); });
    const b = btn || document.querySelector('.cms-tab[data-tab="' + tabKey + '"]');
    if (b) b.classList.add('active');
    var tc = eid('cms-tc-' + tabKey);
    if (tc) { tc.style.display = ''; tc.classList.add('active'); }
  }

  function saveTeknisCMS() {
    var fields = ['tipeStruktur', 'fungsi', 'panjangPuncak', 'elvPelimpah', 'elvPMF', 'batasNormal', 'sumberData', 'sumberLembaga'];
    fields.forEach(function (k) {
      var inp = eid('cms-p-tek-' + k);
      if (inp) cms.teknis[k] = inp.value.trim();
    });
    saveCMS(cms);
    applyTeknisData();
    showCmsToast('Data teknis disimpan dari CMS');
  }

  function deleteLabel(k) {
    delete cms.labels[k];
    saveCMS(cms);
    showCmsToast('Label "' + k + '" dihapus');
    var overlay = eid('cms-panel-overlay');
    if (overlay) { overlay.remove(); openCMSPanel(); }
  }

  function deleteBeritaCMS(id) {
    if (!confirm('Hapus berita ini?')) return;
    cms.berita = cms.berita.filter(function (b) { return b.id !== id; });
    saveCMS(cms);
    renderBerita();
    var overlay = eid('cms-panel-overlay');
    if (overlay) { overlay.remove(); openCMSPanel(); switchCmsTab('berita'); }
    showCmsToast('Berita dihapus');
  }

  function addBerita() { openBeritaEditor(null); }

  function addGaleriCMS() {
    var overlay = eid('cms-panel-overlay');
    if (overlay) overlay.remove();
    openGaleriEditor(null);
  }

  function deleteGaleriCMS(id) {
    if (!confirm('Hapus foto ini?')) return;
    cms.galeri = cms.galeri.filter(function (g) { return g.id !== id; });
    saveCMS(cms);
    renderGaleri();
    var overlay = eid('cms-panel-overlay');
    if (overlay) { overlay.remove(); openCMSPanel(); switchCmsTab('galeri'); }
    showCmsToast('Foto dihapus');
  }

  // ─── EXPORT / IMPORT / RESET ──────────────────────────────
  function exportCMS() {
    var blob = new Blob([JSON.stringify(cms, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ciawi-cms-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
    showCmsToast('CMS diekspor ke file JSON');
  }

  function importCMS(input) {
    if (!input.files || !input.files[0]) return;
    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var data = JSON.parse(e.target.result);
        if (!data || !data._v) throw new Error('Invalid');
        cms = data;
        saveCMS(cms);
        applyTeknisData();
        restoreLabels();
        renderBerita();
        renderGaleri();
        updateEditModeUI();
        showCmsToast('CMS berhasil diimpor');
        var overlay = eid('cms-panel-overlay');
        if (overlay) { overlay.remove(); openCMSPanel(); }
      } catch (ex) {
        alert('File JSON tidak valid atau format tidak sesuai.');
      }
    };
    reader.readAsText(input.files[0]);
    input.value = '';
  }

  function resetCMS() {
    if (!confirm('Reset seluruh CMS ke default? Semua perubahan akan hilang.')) return;
    try {
      localStorage.removeItem(CMS_KEY);
    } catch (e) {}
    cms = defaultCMS();
    saveCMS(cms);
    window.location.reload();
  }

  // ─── TOAST ─────────────────────────────────────────────────
  function showCmsToast(msg) {
    if (typeof toast === 'function') {
      toast(msg, 'info');
    } else {
      var t = document.createElement('div');
      t.className = 'cms-toast';
      t.textContent = msg;
      document.body.appendChild(t);
      setTimeout(function () { t.style.opacity = '0'; setTimeout(function () { t.remove(); }, 400); }, 3000);
    }
  }

  // ─── EXPOSE TO WINDOW (Early before init) ─────────────────
  window.__cms = {
    toggleEditMode: toggleEditMode,
    openCMSPanel: openCMSPanel,
    openTeknisEditor: openTeknisEditor,
    saveTeknisEditor: saveTeknisEditor,
    editBerita: editBerita,
    saveBerita: saveBerita,
    deleteBerita: deleteBerita,
    pinBerita: pinBerita,
    addBerita: addBerita,
    editGaleri: editGaleri,
    saveGaleri: saveGaleri,
    deleteGaleri: deleteGaleri,
    addGaleriCMS: addGaleriCMS,
    deleteBeritaCMS: deleteBeritaCMS,
    deleteGaleriCMS: deleteGaleriCMS,
    switchCmsTab: switchCmsTab,
    saveTeknisCMS: saveTeknisCMS,
    deleteLabel: deleteLabel,
    exportCMS: exportCMS,
    importCMS: importCMS,
    resetCMS: resetCMS,
    openBeritaEditor: openBeritaEditor,
    openGaleriEditor: openGaleriEditor,
  };

  // ─── INIT ──────────────────────────────────────────────────
  function initCMS() {
    try {
      // Restore saved teknis data
      applyTeknisData();
      // Restore saved labels
      restoreLabels();
      // Render content sections
      renderBerita();
      renderGaleri();
      // Setup edit mode UI
      updateEditModeUI();
      // If edit mode was left on, enable inline editing
      if (cms.editMode) {
        setupInlineEditing();
      }
    } catch (err) {
      console.error('CMS init error:', err);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCMS);
  } else {
    initCMS();
  }
})();
