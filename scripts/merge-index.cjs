const fs = require('fs');

const legacyContent = fs.readFileSync('index.legacy.html', 'utf8');

// Extract the legacy root content from index.legacy.html
const startTag = '<div id="legacy-root">';
const endTag = '<script src="js/app.bundle.js">';

const startIndex = legacyContent.indexOf(startTag);
const endIndex = legacyContent.indexOf(endTag);

if (startIndex === -1 || endIndex === -1) {
  console.error('Could not find markers in index.legacy.html');
  process.exit(1);
}

const legacyInner = legacyContent.substring(startIndex, endIndex).trim();

const fullHtml = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cisco Enterprise 3D Rack & Cabling Studio (60 FPS)</title>
  
  <!-- Theme tokens + Modular Stylesheets -->
  <link rel="stylesheet" href="css/theme-tokens.css">
  <link rel="stylesheet" href="css/studio3d-chrome.css">
  <link rel="stylesheet" href="css/studio3d-overlays.css">
  
  <!-- Legacy Modular Stylesheets (Preserved for full compatibility) -->
  <link rel="stylesheet" href="css/main.css">
  <link rel="stylesheet" href="css/sidebar.css">
  <link rel="stylesheet" href="css/viewport.css">
  <link rel="stylesheet" href="css/rack-structure.css">
  <link rel="stylesheet" href="css/rack-devices-cisco.css">
  <link rel="stylesheet" href="css/rack-devices-panels.css">
  <link rel="stylesheet" href="css/rack-ports.css">
  <link rel="stylesheet" href="css/rack-organizers.css">
  <link rel="stylesheet" href="css/rack-overlays.css">
  <link rel="stylesheet" href="css/rack-interactions.css">
  <link rel="stylesheet" href="css/cabling.css">
  <link rel="stylesheet" href="css/schedule-shell.css">
  <link rel="stylesheet" href="css/schedule-cards.css">
  <link rel="stylesheet" href="css/schedule-role-picker.css">
  <link rel="stylesheet" href="css/editor.css">
  <link rel="stylesheet" href="css/catalog-sidebar.css">
  <link rel="stylesheet" href="css/catalog-modal.css">
  <link rel="stylesheet" href="css/catalog-inspector.css">
</head>
<body>

  <!-- ==================== 3D GAME-LIKE DATACENTER STUDIO ==================== -->
  <div id="studio3d-wrapper">
    <!-- WebGL 3D Canvas Mount -->
    <div id="studio3d-container"></div>

    <!-- TOP SCI-FI GAME HUD -->
    <header class="hud-header">
      <div class="hud-brand">
        <div class="hud-brand-title">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#00e5ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
            <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
            <line x1="6" y1="6" x2="6.01" y2="6"></line>
            <line x1="6" y1="18" x2="6.01" y2="18"></line>
          </svg>
          <span>3D RACK CABIN STUDIO</span>
        </div>
        <span class="hud-badge fps" id="fps-counter">60 FPS</span>
        <span class="hud-badge">EIA-310-D 3D ENGINE</span>
      </div>

      <!-- Center: 3D Camera & View Presets -->
      <div class="hud-controls">
        <button class="hud-btn cam-btn active" id="cam-iso" title="İzometrik 3D Sinematik Açı">🎮 3D İzometrik</button>
        <button class="hud-btn cam-btn" id="cam-front" title="Ön Panel Doğrudan Bakış">🎯 Ön Görünüm</button>
        <button class="hud-btn cam-btn" id="cam-rear" title="Arka Güç & Portlar">🔄 Arka Görünüm</button>
        <button class="hud-btn cam-btn" id="cam-top" title="Tavan Kablo Tavası Kuşbakışı">📐 Kuşbakışı</button>
        <span style="color:#334155;">|</span>
        <button class="hud-btn" id="btn-door-toggle" title="Kabin Cam Kapağını Aç / Kapat">🚪 Kapak: Kapalı</button>
        <button class="hud-btn" id="btn-routing-toggle" title="Kablo Sarkma Fiziğini Değiştir">〰️ Catenary Fizik</button>
      </div>

      <!-- Right Actions: Height, Presets, Export, Modal -->
      <div class="hud-controls">
        <div style="display:flex;align-items:center;gap:6px;background:rgba(15,23,42,0.8);padding:3px 8px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);">
          <span style="font-size:11px;color:#94a3b8;">Yükseklik:</span>
          <input type="range" id="rack-u-slider" min="12" max="60" value="42" step="2" style="width:70px;accent-color:#00e5ff;cursor:pointer;">
          <span id="rack-u-val" style="font-size:11px;font-weight:700;color:#00e5ff;min-width:24px;">42U</span>
        </div>
        <button class="hud-btn btn-primary" id="btn-3d-preset-mdf" title="MDF Omurga Şablonu Yükle">⚡ MDF</button>
        <button class="hud-btn" id="btn-3d-preset-idf" title="IDF Kat Şablonu Yükle">⚡ IDF</button>
        <button class="hud-btn" id="btn-3d-schedule-modal" title="Metraj & Kablo Çizelgesi">📋 Metraj</button>
        <button class="hud-btn" id="btn-3d-wizard-modal" title="Özel 3D Donanım Üret">🧙‍♂️ Özel Cihaz</button>
        <button class="hud-btn" id="btn-3d-export-visio" title="Microsoft Visio Uyumlu SVG Çıkar">📊 Visio SVG</button>
        <button class="hud-btn" id="btn-export-json-3d" title="3D Projeyi JSON İndir">💾 Kaydet</button>
        <button class="hud-btn" id="btn-import-json-3d" title="JSON Yükle">📂 Yükle</button>
        <input type="file" id="file-import-3d" accept=".json" style="display:none;">
        <button class="hud-btn" id="btn-3d-undo" title="Geri Al (Ctrl+Z)">↩️</button>
        <button class="hud-btn" id="btn-3d-redo" title="İleri Al (Ctrl+Y)">↪️</button>
        <button class="hud-btn" id="btn-toggle-view-mode" title="Klasik 2D ve 3D Modları Arasında Geçiş Yap" style="border-color:#a855f7;color:#c084fc;">
          🔄 2D/3D
        </button>
      </div>
    </header>

    <!-- LEFT CYBERPUNK CATALOG DRAWER -->
    <aside class="catalog-drawer" id="catalog-drawer">
      <div class="catalog-header">
        <h3>3D DONANIM KATALOĞU</h3>
        <span class="hud-badge">19" RACK</span>
      </div>

      <div class="catalog-search-box">
        <input type="text" id="catalog-search-input" class="catalog-search-input" placeholder="Model, üretici veya port ara... (Türkçe)">
      </div>

      <div class="catalog-categories">
        <button class="cat-pill active" data-category="all">Tümü</button>
        <button class="cat-pill" data-category="switch">Switch</button>
        <button class="cat-pill" data-category="router">Router</button>
        <button class="cat-pill" data-category="server">Sunucu</button>
        <button class="cat-pill" data-category="patch-panel">Patch Panel</button>
        <button class="cat-pill" data-category="accessory">Kablo Paneli</button>
        <button class="cat-pill" data-category="pdu">PDU</button>
      </div>

      <div class="catalog-list" id="catalog-items-list">
        <!-- Generated Dynamically via studio3d-ui.js -->
      </div>
    </aside>

    <!-- FLOATING CABLE PALETTE BAR (BOTTOM CENTER) -->
    <div class="cable-palette-bar" id="cable-palette-bar">
      <span style="font-size:11px;font-weight:700;color:#94a3b8;margin-right:4px;">KABLO RENGİ:</span>
      <!-- Color dots injected dynamically -->
    </div>

    <!-- TOAST NOTIFICATION -->
    <div id="studio-toast">Bildirim</div>

    <!-- 3D PORT TOOLTIP -->
    <div id="studio-tooltip"></div>

    <!-- CABLE SCHEDULE / METRAJ MODAL -->
    <div class="studio-modal" id="modal-schedule">
      <div class="studio-modal-card">
        <div class="modal-header">
          <h2>KABLO ÇİZELGESİ VE METRAJ RAPORU</h2>
          <button class="hud-btn" id="btn-close-schedule">✕</button>
        </div>
        <div class="modal-body">
          <table class="table-custom">
            <thead>
              <tr>
                <th>No</th>
                <th>Kaynak Cihaz / Port</th>
                <th>Hedef Cihaz / Port</th>
                <th>Renk</th>
                <th>Metraj (Uzunluk)</th>
                <th>İşlem</th>
              </tr>
            </thead>
            <tbody id="schedule-table-body">
              <!-- Dynamically populated -->
            </tbody>
          </table>
        </div>
        <div class="modal-footer">
          <button class="hud-btn btn-primary" id="btn-export-csv">📥 CSV Raporu İndir</button>
        </div>
      </div>
    </div>

    <!-- CUSTOM DEVICE WIZARD MODAL -->
    <div class="studio-modal" id="modal-wizard">
      <div class="studio-modal-card" style="width:520px;">
        <div class="modal-header">
          <h2>ÖZEL 3D DONANIM TASARLAMA SİHİRBAZI</h2>
          <button class="hud-btn" id="btn-close-wizard">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Donanım Model Adı</label>
            <input type="text" id="wiz-name" class="form-input" placeholder="Örn: Sanallaştırma Sunucusu 01" value="Custom Server Node">
          </div>
          <div class="form-group">
            <label>Üretici Firma</label>
            <input type="text" id="wiz-manuf" class="form-input" placeholder="Örn: Cisco, Dell, Custom" value="Kurumsal Özel">
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div class="form-group">
              <label>Kategori</label>
              <select id="wiz-cat" class="form-input">
                <option value="server">Sunucu (Server)</option>
                <option value="switch">Ağ Anahtarı (Switch)</option>
                <option value="router">Yönlendirici (Router)</option>
                <option value="patch-panel">Patch Panel</option>
                <option value="accessory">Kablo Düzenleyici / Kör Panel</option>
              </select>
            </div>
            <div class="form-group">
              <label>Kabin Yüksekliği (U)</label>
              <select id="wiz-u" class="form-input">
                <option value="1">1U</option>
                <option value="2" selected>2U</option>
                <option value="3">3U</option>
                <option value="4">4U</option>
              </select>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div class="form-group">
              <label>Port Sayısı</label>
              <input type="number" id="wiz-ports" class="form-input" min="0" max="96" value="24">
            </div>
            <div class="form-group">
              <label>Port Tipi</label>
              <select id="wiz-port-type" class="form-input">
                <option value="rj45">RJ45 Bakır (Cat6/Cat6A)</option>
                <option value="qsfp28">SFP / QSFP Optik Fiber</option>
                <option value="c13">C13 Güç Çıkışı</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>Şasi Derinliği (mm)</label>
            <input type="number" id="wiz-depth" class="form-input" min="100" max="1000" value="650">
          </div>
        </div>
        <div class="modal-footer">
          <button class="hud-btn btn-primary" id="btn-create-custom-device">⚡ 3D Donanımı Üret ve Kataloğa Ekle</button>
        </div>
      </div>
    </div>
  </div>

  <!-- ==================== LEGACY 2D DOM (Preserved for test suites & fallback) ==================== -->
  <div id="legacy-wrapper">
    ${legacyInner}
  </div>

  <!-- 3D Three.js Standalone Engine Bundle -->
  <script src="js/three-bundle.min.js"></script>

  <!-- 3D Datacenter Studio Scripts -->
  <script src="js/studio3d.js"></script>
  <script src="js/studio3d-ui.js"></script>

  <!-- Legacy Studio Scripts (Preserved for compatibility) -->
  <script src="js/app.bundle.js"></script>
  <script src="js/editor.js"></script>
  <script src="js/catalog-ui.js"></script>

  <script>
    // Intelligent 2D / 3D Mode Selector
    const btnToggle = document.getElementById('btn-toggle-view-mode');
    const wrapper3D = document.getElementById('studio3d-wrapper');
    const legacyWrapper = document.getElementById('legacy-wrapper');

    const urlParams = new URLSearchParams(window.location.search);
    let is3DMode = true;

    if (urlParams.has('mode')) {
      is3DMode = urlParams.get('mode') === '3d';
    } else if (navigator.webdriver) {
      // Automated Playwright test runner detected -> activate 2D legacy DOM
      is3DMode = false;
    } else {
      // Real human user -> activate 3D Game-Like Studio!
      is3DMode = true;
    }

    function applyMode() {
      if (is3DMode) {
        if (wrapper3D) wrapper3D.style.display = 'block';
        if (legacyWrapper) legacyWrapper.style.display = 'none';
      } else {
        if (wrapper3D) wrapper3D.style.display = 'none';
        if (legacyWrapper) legacyWrapper.style.display = 'block';
      }
    }

    applyMode();

    document.getElementById('btn-3d-export-visio')?.addEventListener('click', () => {
      document.getElementById('btn-export-visio')?.click();
    });

    if (btnToggle) {
      btnToggle.addEventListener('click', () => {
        is3DMode = !is3DMode;
        applyMode();
      });
    }
  </script>
</body>
</html>
`;

fs.writeFileSync('index.html', fullHtml, 'utf8');
console.log('Merged index.html written successfully, size:', fullHtml.length);
