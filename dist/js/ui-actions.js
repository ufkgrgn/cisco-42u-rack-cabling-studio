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
    ['btn-field-sheet', 'Saha kartı', 'ClipboardList', 'Proje', 'yazdir print'],
    ['btn-project-checks', 'Projeyi denetle', 'ShieldCheck', 'Gelişmiş', 'kontrol hata'],
    ['btn-saved-views', 'Kayıtlı görünümler', 'Bookmark', 'Görünüm', 'kamera'],
    ['btn-circuit-trace', 'Devre izi', 'Route', 'Bağlantılar', 'trace takip'],
    ['btn-port-calibrator', 'Port kalibrasyonu', 'SlidersHorizontal', 'Gelişmiş', 'hizalama'],
    ['btn-field-mode', 'Saha görünümü', 'PanelRight', 'Görünüm', '', '2d'],
    ['btn-export-visio', 'Visio SVG dışa aktar', 'FileCode', 'Proje', 'export'],
    ['btn-export-json-3d', 'Projeyi dosyaya kaydet', 'Download', 'Proje', 'json export indir'],
    ['btn-import-json-3d', 'Proje dosyası aç', 'Upload', 'Proje', 'json import yukle'],
    ['btn-inventory-import', 'Envanteri karşılaştır', 'ListChecks', 'Proje', 'import'],
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
    ['btn-2d-clear-action', 'Tüm kabinleri sıfırla', 'Trash2', 'Proje', 'sil temizle']
  ].map(([id, label, icon, group, keywords, context]) => ({ id, label, icon, group, keywords, context }));
  const byId = new Map(definitions.map(action => [action.id, action]));
  function reason(action) {
    if (action?.context && action.context !== mode()) return `${action.context.toUpperCase()} görünümünde kullanılabilir`;
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
  window.UIActions = { definitions, get: id => byId.get(id), normalize, reason, run, notify,
    list: () => definitions.filter(a => !a.context || a.context === mode()) };
})();
