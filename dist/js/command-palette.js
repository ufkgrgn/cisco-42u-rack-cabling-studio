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

  function isTypingTarget(el) {
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
  }

  function clickId(id) {
    document.getElementById(id)?.click();
  }

  function actions() {
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
      { label: 'Saha görünümü', hint: '', run: () => clickId('btn-field-mode') },
      { label: 'Visio SVG', hint: '', run: () => clickId('btn-export-visio') },
      { label: 'Projeyi kaydet', hint: '', run: () => clickId('btn-export-json-3d') },
      { label: 'Proje yükle', hint: '', run: () => clickId('btn-import-json-3d') },
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
        <input type="text" placeholder="Komut ara" aria-label="Komut ara" autocomplete="off">
        <div class="command-list" role="listbox"></div>
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
    const q = (query || '').trim().toLocaleLowerCase('tr');
    visible = actions().filter(a => !q || a.label.toLocaleLowerCase('tr').includes(q));
    activeIndex = 0;
    list.innerHTML = '';
    visible.forEach((action, index) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'command-item' + (index === 0 ? ' is-active' : '');
      btn.setAttribute('role', 'option');
      btn.innerHTML = `<span></span><kbd></kbd>`;
      btn.querySelector('span').textContent = action.label;
      btn.querySelector('kbd').textContent = action.hint || '';
      btn.addEventListener('click', () => runIndex(index));
      list.appendChild(btn);
    });
  }

  function moveActive(delta) {
    if (!visible.length) return;
    activeIndex = (activeIndex + delta + visible.length) % visible.length;
    list.querySelectorAll('.command-item').forEach((el, i) => {
      el.classList.toggle('is-active', i === activeIndex);
    });
    list.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' });
  }

  function runIndex(index) {
    const action = visible[index];
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
    overlay.hidden = false;
    input.value = '';
    renderList('');
    input.focus();
  }

  function closePalette() {
    if (overlay) overlay.hidden = true;
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
