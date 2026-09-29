/* Decorate dynamic controls once; repair icons after legacy textContent updates. */
(() => {
  'use strict';
  const rules = [
    [/kapat|close|iptal|cancel|dismiss|^×$|^✕$|^x$/, 'X'],
    [/geri al|undo/, 'Undo2'], [/yinele|ileri al|redo/, 'Redo2'],
    [/sil|delete|temizle|sifirla|remove/, 'Trash2'], [/sok|disconnect|dismount|unplug/, 'Unplug'],
    [/kaydet|save|uygula|apply|onay|tamam/, 'Check'], [/yukle|import|dosya ac/, 'Upload'],
    [/indir|export|disa aktar/, 'Download'], [/odak|focus/, 'Focus'], [/sigdir|fit/, 'Scan'],
    [/yakin|zoom-in|^\+$/, 'ZoomIn'], [/uzak|zoom-out|^[-−]$/, 'ZoomOut'],
    [/renk|color|tema/, 'Palette'], [/ara|search/, 'Search'], [/filtre|filter/, 'Filter'],
    [/kopya|cogalt|copy|duplicate/, 'Copy'], [/duzenle|edit|adlandir|rename/, 'Pencil'],
    [/ayar|config|setting|tercih/, 'Settings2'], [/bagla|connect|patch/, 'Plug'],
    [/kablo|cable|baglanti/, 'Cable'], [/port/, 'Plug'], [/kabin|rack|mdf|idf/, 'Server'],
    [/cihaz|donanim|device|catalog/, 'Server'], [/ekle|yeni|add|new/, 'Plus'],
    [/ust|yukari|top|up/, 'ArrowUp'], [/alt|asagi|bottom|down/, 'ArrowDown'],
    [/sol|geri|left|previous/, 'ArrowLeft'], [/sag|ileri|right|next/, 'ArrowRight'],
    [/on yuz|front/, 'PanelTop'], [/arka|rear/, 'PanelBottom'], [/isometr|izometr|3d/, 'Box'],
    [/favori|star/, 'Star'], [/gorunum|view|goster|gizle|eye/, 'Eye'],
    [/tas[iı]|move|yon/, 'Move'], [/yenile|refresh|reset/, 'RefreshCw'],
    [/kapak|door/, 'DoorOpen'], [/isik|lighting/, 'Lightbulb'], [/ses|audio/, 'Volume2'],
    [/liste|list|detay|detail/, 'ClipboardList'], [/yardim|kisayol|help/, 'CircleHelp']
  ];
  function decorate(button) {
    if (button.closest('template') || button.matches('.port, .sidebar-scrim, .sidebar-right-scrim, [data-color], .color-swatch, .cable-color-swatch')) return;
    // Skip buttons that already have an icon — check both direct children AND nested (e.g. inside .rack-action-icon span)
    if (button.querySelector('svg.ui-icon')) return;
    // Skip buttons that manage their own icons via JS rendering
    if (button.matches('.rack-action-btn, .rail-btn, .dev-btn, .hud-btn-duct')) return;
    const action = window.UIActions?.get(button.id || button.dataset.shortcutFor);
    const label = button.textContent.trim();
    const search = window.UIActions?.normalize([button.dataset.action, button.dataset.command, button.dataset.cameraAction, button.dataset.cameraView, label, button.title, button.getAttribute('aria-label')].filter(Boolean).join(' ')) || label;
    const icon = button.dataset.icon || action?.icon || rules.find(([pattern]) => pattern.test(search))?.[1];
    if (!icon || !window.__UI_ICONS__?.[icon]) return;
    button.querySelectorAll(':scope > svg:not(.brand-logo)').forEach(node => node.remove());
    for (const child of button.childNodes) if (child.nodeType === Node.TEXT_NODE) {
      child.textContent = child.textContent.replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '');
    }
    button.insertAdjacentHTML('afterbegin', window.getLucideIconSvg(icon, 16));
    if (!button.getAttribute('aria-label') && !button.textContent.trim()) button.setAttribute('aria-label', button.title || action?.label || 'Kapat');
  }
  function refresh(root = document) {
    if (!(root instanceof Element || root === document) || root.closest?.('svg')) return;
    if (root.matches?.('button')) decorate(root);
    root.querySelectorAll('button').forEach(decorate);
  }
  window.UIIcons = { refresh };
  function init() {
    refresh();
    new MutationObserver(records => {
      const roots = new Set();
      for (const record of records) {
        const button = record.target.parentElement?.closest('button') || record.target.closest?.('button');
        if (button && !record.target.closest?.('svg')) roots.add(button);
        for (const node of record.addedNodes) if (node instanceof Element && !node.closest('svg')) roots.add(node);
      }
      roots.forEach(refresh);
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
