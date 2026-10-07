/**
 * Ctrl+K command palette and ? shortcut card.
 * Actions call controls that already exist on the page.
 */
(function () {
  'use strict';

  const SHORTCUTS = [
    ['Ctrl+K', 'Komut paleti'],
    ['Ctrl+Z / Ctrl+Y', 'Geri al / ileri al'],
    ['Ctrl+B', 'Kütüphaneyi aç veya kapat'],
    ['F', 'Kabini ekrana sığdır'],
    ['Delete', 'Seçili kabloyu sök'],
    ['Tekerlek', 'Yakınlaştır'],
    ['Sürükle', 'Tuvali kaydır'],
    ['?', 'Bu kısayol kartı']
  ];

  let overlay = null;
  let input = null;
  let list = null;
  let shortcutOverlay = null;
  let activeIndex = 0;
  let visible = [];
  let paletteOpener = null;
  const normalize = value => window.UIActions?.normalize(value) || String(value || '').toLowerCase();

  function isTypingTarget(el) {
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
  }

  function clickId(id) {
    window.UIActions?.run(id);
  }

  function actions() {
    if (window.UIActions) return window.UIActions.list().map(action => ({ ...action,
      disabledReason: window.UIActions.reason(action), run: () => window.UIActions.run(action.id)
    })).concat({ label: 'Kısayollar', icon: 'Keyboard', group: 'Yardım', hint: '?', run: openShortcuts });
    return [
      { label: '2D görünüme geç', hint: '', run: () => clickId('btn-view-2d') },
      { label: '3D görünüme geç', hint: '', run: () => clickId('btn-view-3d') },
      { label: 'Kabini sığdır', hint: 'F', run: () => clickId('btn-zoom-fit') },
      { label: 'Geri al', hint: 'Ctrl+Z', run: () => clickId('btn-3d-undo') },
      { label: 'İleri al', hint: 'Ctrl+Y', run: () => clickId('btn-3d-redo') },
      { label: 'MDF şablonu', hint: '', run: () => clickId('btn-3d-preset-mdf') },
      { label: 'IDF şablonu', hint: '', run: () => clickId('btn-3d-preset-idf') },
      { label: 'Saha şablonu', hint: '', run: () => clickId('btn-3d-preset-site') },
      { label: 'Bağlantı listesi', hint: '', run: () => clickId('btn-3d-schedule-modal') },
      { label: 'Saha kartı', hint: '', run: () => clickId('btn-field-sheet') },
      { label: 'Proje denetimi', hint: '', run: () => clickId('btn-project-checks') },
      { label: 'Kayıtlı görünümler', hint: '', run: () => clickId('btn-saved-views') },
      { label: 'Devre izi', hint: '', run: () => clickId('btn-circuit-trace') },
      { label: 'Port kalibrasyonu', hint: '', run: () => clickId('btn-port-calibrator') },
      { label: 'Saha görünümü', hint: '', run: () => clickId('btn-field-mode') },
      { label: 'Visio SVG', hint: '', run: () => clickId('btn-export-visio') },
      { label: 'Projeyi kaydet', hint: '', run: () => clickId('btn-export-json-3d') },
      { label: 'Proje yükle', hint: '', run: () => clickId('btn-import-json-3d') },
      { label: 'Envanter karşılaştır', hint: '', run: () => clickId('btn-inventory-import') },
      { label: 'Anlık görüntü', hint: '', run: () => clickId('btn-snapshot-modal') },
      { label: 'Tema değiştir', hint: '', run: () => document.getElementById('btn-theme-toggle')?.focus() },
      { label: 'Ağ kuralları', hint: '', run: () => clickId('btn-network-compliance') },
      { label: 'Ön / arka yüz', hint: '', run: () => clickId('btn-2d-face-toggle') },
      { label: 'Kısayollar', hint: '?', run: () => openShortcuts() },
      { label: 'Tüm kabinleri sıfırla', hint: '', run: () => clickId('btn-2d-clear-action') }
    ];
  }

  function ensurePalette() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.className = 'instrument-overlay';
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="command-panel" role="dialog" aria-modal="true" aria-label="Komut paleti">
        <input type="text" placeholder="Komut, cihaz, kabin veya kablo ara" aria-label="Komut ara" role="combobox" aria-expanded="true" aria-controls="command-results" autocomplete="off">
        <div class="command-list" id="command-results" role="listbox" aria-label="Komut sonuçları"></div>
      </div>`;
    document.body.appendChild(overlay);
    input = overlay.querySelector('input');
    list = overlay.querySelector('.command-list');
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closePalette();
    });
    input.addEventListener('input', () => renderList(input.value));
    input.addEventListener('keydown', onInputKey);
  }

  function ensureShortcuts() {
    if (shortcutOverlay) return;
    shortcutOverlay = document.createElement('div');
    shortcutOverlay.className = 'instrument-overlay';
    shortcutOverlay.hidden = true;
    const rows = SHORTCUTS.map(([key, label]) =>
      `<div class="shortcut-row"><span>${label}</span><kbd>${key}</kbd></div>`
    ).join('');
    shortcutOverlay.innerHTML = `
      <div class="shortcut-panel" role="dialog" aria-modal="true" aria-label="Kısayollar">
        <h2>Kısayollar</h2>
        ${rows}
        <div class="overlay-actions">
          <button type="button" id="btn-shortcut-dpad">3D yön düğmeleri</button>
          <button type="button" data-close-shortcuts>Kapat</button>
        </div>
      </div>`;
    document.body.appendChild(shortcutOverlay);
    shortcutOverlay.addEventListener('click', (e) => {
      if (e.target === shortcutOverlay || e.target.closest('[data-close-shortcuts]')) closeShortcuts();
    });
    shortcutOverlay.querySelector('#btn-shortcut-dpad')?.addEventListener('click', () => {
      document.body.classList.toggle('show-nav-dpad');
    });
  }

  function renderList(query) {
    const q = normalize(query).trim();
    visible = actions().filter(a => !q || normalize(a.label + ' ' + (a.keywords || '')).includes(q));
    if (q.length >= 2) visible.push(...projectResults(q));
    visible.sort((a, b) => (a.group || '').localeCompare(b.group || '', 'tr'));
    activeIndex = 0;
    list.innerHTML = '';
    let lastGroup = null;
    if (!visible.length) {
      const empty = document.createElement('p'); empty.className = 'command-empty';
      empty.textContent = 'Sonuç bulunamadı. Model, IP adresi, kabin adı veya işlem adı deneyin.';
      list.append(empty);
      input.removeAttribute('aria-activedescendant');
    }
    visible.forEach((action, index) => {
      if (action.group !== lastGroup) {
        const heading = document.createElement('div'); heading.className = 'command-group';
        heading.setAttribute('role', 'presentation'); heading.textContent = action.group || 'Komutlar';
        list.append(heading); lastGroup = action.group;
      }
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'command-item' + (index === 0 ? ' is-active' : '');
      btn.setAttribute('role', 'option');
      btn.id = `command-option-${index}`;
      btn.setAttribute('aria-selected', String(index === activeIndex));
      btn.dataset.icon = action.icon || 'Search';
      if (action.disabledReason) { btn.setAttribute('aria-disabled', 'true'); btn.title = action.disabledReason; }
      btn.innerHTML = `<span></span><kbd></kbd>`;
      btn.querySelector('span').textContent = action.label;
      btn.querySelector('kbd').textContent = action.hint || '';
      btn.addEventListener('click', () => runIndex(index));
      list.appendChild(btn);
    });
    if (visible.length) input.setAttribute('aria-activedescendant', 'command-option-0');
    window.UIIcons?.refresh(list);
  }

  function projectResults(query) {
    const RS = window.RackStudio;
    const state = RS?.STATE;
    if (!state) return [];
    const projectId=state.projectDocument?.projectId;
    const matches = value => normalize(value).includes(query);
    const results = [];
    const add = (label, run) => {
      const prefix = label.split(':')[0];
      const categories = { Kabin: ['Kabinler', 'Server'], Cihaz: ['Cihazlar', 'Server'], Port: ['Portlar', 'Plug'], Kablo: ['Kablolar', 'Cable'] };
      const [group, icon] = categories[prefix] || ['Proje', 'Search'];
      if (results.length < 30) results.push({ label, hint: 'Proje', run:()=>{if(RS.STATE.projectDocument?.projectId!==projectId){window.UIActions?.notify('Açık proje değişti; aramayı yenileyin.');return;}run();}, group, icon });
    };
    for (const rack of state.racks || []) {
      if (matches(rack.name) || matches(rack.id)) {
        add(`Kabin: ${rack.name}`, () => window.is3DMode ? window.__STUDIO3D__?.fitCameraToRacks('front', rack.id) : RS.focusOnRack?.(rack.id));
      }
      for (const device of rack.devices || []) {
        const catalog = RS.catalog?.[device.catalogKey] || RS.HARDWARE_CATALOG?.[device.catalogKey];
        const deviceLabel = device.hostname || device.name || catalog?.name || device.catalogKey;
        if ([deviceLabel, device.ipAddress, device.serialNumber, device.instanceId, catalog?.modelTag].some(matches)) {
          add(`Cihaz: ${deviceLabel} · ${rack.name}`, () => {
            RS.WorkflowSelection?.choose('device',device.instanceId,window.is3DMode?'3d':'2d');
            if(window.is3DMode){window.__STUDIO3D__?.selectDevice?.(device.instanceId);window.__STUDIO3D__?.focusDevice?.(device.instanceId);}else RS.focusOnDevice?.(device.instanceId);
          });
        }
        for (const port of catalog?.ports || []) {
          if (!matches(port.id) && !matches(port.name)) continue;
          add(`Port: ${deviceLabel} / ${port.name || port.id}`, () => window.is3DMode
            ? window.__STUDIO3D__?.focusDevice?.(device.instanceId) : RS.focusOnDevice?.(device.instanceId));
          if (results.length >= 30) break;
        }
        if (results.length >= 30) break;
      }
      if (results.length >= 30) break;
    }
    for (const cable of state.cables || []) {
      if (!matches(cable.id) && !matches(cable.name)) continue;
      add(`Kablo: ${cable.name || cable.id}`, () => {
        RS.highlightCable?.(cable.id, true);
        if (window.is3DMode) window.__STUDIO3D__?.focusCable?.(cable.id);
        else RS.focusOnCable?.(cable.id);
      });
      if (results.length >= 30) break;
    }
    return results;
  }

  function moveActive(delta) {
    if (!visible.length) return;
    activeIndex = (activeIndex + delta + visible.length) % visible.length;
    list.querySelectorAll('.command-item').forEach((el, i) => {
      el.classList.toggle('is-active', i === activeIndex);
      el.setAttribute('aria-selected', String(i === activeIndex));
    });
    list.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' });
    input.setAttribute('aria-activedescendant', `command-option-${activeIndex}`);
  }

  function runIndex(index) {
    const action = visible[index];
    if (action?.disabledReason) { window.UIActions?.notify(action.disabledReason); return; }
    closePalette();
    action?.run();
  }

  function onInputKey(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveActive(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveActive(-1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      runIndex(activeIndex);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closePalette();
    }
  }

  function openPalette() {
    ensurePalette();
    closeShortcuts();
    paletteOpener = document.activeElement;
    window.setToolsOpen?.(false);
    overlay.hidden = false;
    input.value = '';
    renderList('');
    input.focus();
  }

  function closePalette() {
    if (overlay) overlay.hidden = true;
    if (paletteOpener?.isConnected) paletteOpener.focus({ preventScroll: true });
  }

  function openShortcuts() {
    ensureShortcuts();
    closePalette();
    shortcutOverlay.hidden = false;
  }

  function closeShortcuts() {
    if (shortcutOverlay) shortcutOverlay.hidden = true;
  }

  function onKey(e) {
    const key = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && key === 'k') {
      e.preventDefault();
      if (overlay && !overlay.hidden) closePalette();
      else openPalette();
      return;
    }
    if (e.key === 'Escape') {
      closePalette();
      closeShortcuts();
      return;
    }
    if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey && !isTypingTarget(e.target)) {
      e.preventDefault();
      if (shortcutOverlay && !shortcutOverlay.hidden) closeShortcuts();
      else openShortcuts();
    }
  }

  function init() {
    document.getElementById('btn-command-palette')?.addEventListener('click', openPalette);
    document.getElementById('btn-show-dpad')?.addEventListener('click', () => {
      document.body.classList.toggle('show-nav-dpad');
    });
    document.addEventListener('keydown', onKey);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.RackStudioCommands = { open: openPalette, shortcuts: openShortcuts };
})();
