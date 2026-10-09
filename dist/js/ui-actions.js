/* Shared commands for toolbar shortcuts and the command palette. */
(() => {
  'use strict';
  const mode = () => window.is3DMode ? '3d' : '2d';
  const normalize = value => String(value || '').toLocaleLowerCase('tr').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i');
  const definitions = [
    ['btn-view-2d', '2D görünüme geç', 'Server', 'Görünüm', ''],
    ['btn-view-3d', '3D görünüme geç', 'Box', 'Görünüm', ''],
    ['btn-zoom-fit', 'Kabini ekrana sığdır', 'Scan', 'Görünüm', 'fit yakinlastir F'],
    ['btn-3d-undo', 'Geri al', 'Undo2', 'Düzenle', 'undo Ctrl+Z'],
    ['btn-3d-redo', 'Yinele', 'Redo2', 'Düzenle', 'redo ileri Ctrl+Y'],
    ['btn-3d-preset-mdf', 'MDF şablonu', 'Server', 'Kabin', 'omurga'],
    ['btn-3d-preset-idf', 'IDF şablonu', 'Layers', 'Kabin', 'kat'],
    ['btn-3d-preset-site', 'Saha şablonu', 'LayoutGrid', 'Kabin', 'site'],
    ['btn-3d-schedule-modal', 'Bağlantı listesi', 'Cable', 'Bağlantılar', 'kablo schedule'],
    ['btn-delivery-center', 'Teslim merkezi', 'Package', 'Proje', 'rapor pdf bom malzeme etiket teslim zip'],
    ['btn-field-sheet', 'Saha kartı', 'ClipboardList', 'Proje', 'yazdir print'],
    ['btn-project-checks', 'Projeyi denetle', 'ShieldCheck', 'Gelişmiş', 'kontrol hata'],
    ['btn-saved-views', 'Kayıtlı görünümler', 'Bookmark', 'Görünüm', 'kamera'],
    ['btn-onboarding', 'İlk kullanım', 'BookOpen', 'Yardım', 'rehber örnek baslangic'],
    ['btn-circuit-trace', 'Devre izi', 'Route', 'Bağlantılar', 'trace takip'],
    ['btn-port-calibrator', 'Port kalibrasyonu', 'SlidersHorizontal', 'Gelişmiş', 'hizalama'],
    ['btn-field-mode', 'Saha görünümü', 'PanelRight', 'Görünüm', ''],
    ['btn-export-visio', 'Visio SVG dışa aktar', 'FileCode', 'Proje', 'export'],
    ['btn-export-json-3d', 'Projeyi dosyaya kaydet', 'Download', 'Proje', 'json export indir'],
    ['btn-import-json-3d', 'Proje dosyası aç', 'Upload', 'Proje', 'json import yukle'],
    ['btn-inventory-import', 'Envanteri karşılaştır', 'ListChecks', 'Proje', 'import'],
    ['btn-netbox-import', 'NetBox gözlemleri', 'ListChecks', 'Proje', 'netbox import envanter'],
    ['btn-workspace', 'Ekip çalışma alanı', 'Users', 'Proje', 'ortak çalışma senkronizasyon taslak'],
    ['btn-diagnostics', 'Yerel teşhis', 'Activity', 'Proje', 'teşhis destek tanılama'],
    ['btn-field-observations', 'Gözlem geçmişi', 'History', 'Proje', 'saha fark gözlem observations'],
    ['btn-field-workflow', 'Saha iş akışı', 'ClipboardList', 'Proje', 'uygulama etiket test kanıt'],
    ['btn-field-qr', 'Saha QR kodu', 'ScanLine', 'Proje', 'kamera kimlik'],
    ['btn-field-offline', 'Çevrimdışı saha', 'WifiOff', 'Proje', 'offline önbellek'],
    ['btn-snapshot-modal', 'Anlık görüntü', 'Camera', 'Proje', 'snapshot'],
    ['btn-theme-toggle', 'Tema seç', 'Palette', 'Tercihler', 'renk'],
    ['btn-network-compliance', 'Ağ kuralları', 'ShieldCheck', 'Tercihler', 'network'],
    ['btn-2d-face-toggle', 'Ön / arka yüz', 'FlipHorizontal', 'Görünüm', 'on arka rear front', '2d'],
    ['cam-iso', 'İzometrik görünüm', 'Box', 'Görünüm', '', '3d'],
    ['cam-front', 'Önden görünüm', 'PanelTop', 'Görünüm', 'front', '3d'],
    ['cam-rear', 'Arkadan görünüm', 'PanelBottom', 'Görünüm', 'rear', '3d'],
    ['cam-top', 'Üstten görünüm', 'PanelsTopLeft', 'Görünüm', 'top', '3d'],
    ['cam-focus', 'Seçime odaklan', 'Focus', 'Görünüm', 'focus', '3d'],
    ['btn-audio-toggle', 'Ses efektleri', 'Volume2', 'Tercihler', 'audio'],
    ['btn-show-dpad', 'Yön düğmeleri', 'Move', 'Görünüm', 'navigation', '3d'],
    ['btn-mode-layout', 'Kabin yerleşim modu', 'Layers', 'Görünüm', 'yerlesim layout montaj', '2d'],
    ['btn-mode-cabling', 'Kablolama', 'Cable', 'Görünüm', 'kablolama cabling baglanti', '2d'],
    ['btn-toggle-cables', 'Kabloları göster / gizle', 'Eye', 'Görünüm', 'kablo gizle goster C', '2d'],
    ['btn-2d-clear-action', 'Tüm kabinleri sıfırla', 'Trash2', 'Proje', 'sil temizle']
  ].map(([id, label, icon, group, keywords, context]) => ({ id, label, icon, group, keywords, context }));
  const byId = new Map(definitions.map(action => [action.id, action]));
  function reason(action) {
    if (action?.context && action.context !== mode()) return `${action.context.toUpperCase()} görünümünde kullanılabilir`;
    if (action?.id === 'btn-toggle-cables' && window.RackStudio?.STATE.studioWorkMode !== 'cabling') return 'Kablolama görünümünde kullanılabilir';
    if (action?.id === 'btn-view-mode-multi' && matchMedia('(max-width: 767px)').matches) return 'Telefonda etkin kabin gösterilir';
    const control = document.getElementById(action?.id);
    if (!control) return 'Bu işlem henüz hazır değil';
    if (control.disabled || control.getAttribute('aria-disabled') === 'true') return control.title || 'Bu işlem şu anda kullanılamıyor';
    return '';
  }
  function notify(message) {
    let status = document.getElementById('ui-action-status');
    if (!status) {
      status = document.createElement('div'); status.id = 'ui-action-status';
      status.setAttribute('role', 'status'); document.body.append(status);
    }
    status.textContent = message; status.hidden = false;
    clearTimeout(notify.timer); notify.timer = setTimeout(() => { status.hidden = true; }, 4000);
  }
  function run(id) {
    const action = byId.get(id) || { id };
    const unavailable = reason(action);
    if (unavailable) { notify(unavailable); return false; }
    if (id === 'btn-zoom-fit' && window.is3DMode) window.__STUDIO3D__?.fitCameraToRacks('front');
    else if (id === 'btn-theme-toggle') {
      window.setToolsOpen?.(true);
      const select = document.getElementById(id);
      select.closest('details')?.setAttribute('open', '');
      select.scrollIntoView({ block: 'nearest' }); select.focus();
    } else document.getElementById(id).click();
    return true;
  }
  function getState(id) {
    const action = byId.get(id) || {id};
    const control = document.getElementById(id);
    const why = reason(action);
    const pressed = control?.getAttribute('aria-pressed');
    const toggles = /^(btn-view-(2d|3d|mode-single|mode-multi)|cam-|btn-mode-)/.test(id);
    return {id, label: action.label || control?.textContent.trim() || id, enabled: !why, reason: why, pressed: pressed === null || pressed === undefined ? (toggles ? !!control?.classList.contains('active') : null) : pressed === 'true'};
  }
  window.UIActions = {getState, definitions, get: id => byId.get(id), normalize, reason, run, notify,
    list: () => definitions.filter(a => !a.context || a.context === mode()) };
})();
