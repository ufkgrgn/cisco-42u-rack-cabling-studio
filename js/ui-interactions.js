/* Overlay ownership. Observe surfaces, never camera transforms or render loops. */
(() => {
  'use strict';
  const selector = '#hud-tools-panel, #compact-view-panel, #viewport-cable-dock, .instrument-overlay, dialog, .modal, #catalog-drawer, #cable-context-menu, #device-context-menu, .mobile-3d-controls details';
  const surfaces = new Map();
  let stack = [], scheduled = false, dismissUntil = 0;
  let lastExternalFocus = null;
  const visible = node => node.isConnected && !node.hidden && (node.tagName !== 'DIALOG' || node.open)
    && (node.tagName !== 'DETAILS' || node.open) && node.getAttribute('aria-hidden') !== 'true'
    && getComputedStyle(node).display !== 'none' && getComputedStyle(node).visibility !== 'hidden'
    && node.getClientRects().length > 0;
  const top = () => stack.at(-1);
  function clearHover() {
    const RS = window.RackStudio;
    RS?.setPixiCableHover?.(null, false);
    RS?.setPixiDeviceHover?.(null);
    const port = RS?.getHoveredDevicePortKey?.();
    if (port) { RS.setHoveredDevicePortKey?.(null); RS.restoreDevicePortTint?.(port); RS.dispatchDevicePortInteraction?.('leave'); }
    for (const id of ['tooltip', 'port-tooltip', 'studio3d-tooltip']) { const node = document.getElementById(id); if (node) node.style.display = 'none'; }
    if (RS?.dom?.tooltip) RS.dom.tooltip.style.display = 'none';
    document.body.style.cursor = '';
  }
  function close(node) {
    if (!node) return;
    if (node.id === 'hud-tools-panel') window.setToolsOpen?.(false);
    else if (node.id === 'catalog-drawer') document.getElementById('btn-3d-catalog')?.click();
    else if (node.id === 'cable-context-menu') window.RackStudio?.hideCableContextMenu?.();
    else if (node.id === 'device-context-menu') window.RackStudio?.hideDeviceContextMenu?.();
    else if (node.tagName === 'DIALOG') node.close();
    else if (node.tagName === 'DETAILS') node.open = false;
    else if (node.classList.contains('modal')) {
      const button = node.querySelector('[id*="close"], [data-close], .close-btn, .modal-close');
      if (button) button.click(); else { node.classList.remove('show', 'active'); node.style.display = 'none'; }
    } else { node.hidden = true; node.style.display = ''; }
    document.querySelector(`[aria-controls="${node.id}"]`)?.setAttribute('aria-expanded', 'false');
    const opener = surfaces.get(node)?.opener;
    if (opener?.isConnected) opener.focus({ preventScroll: true });
    refresh();
  }
  function refresh() {
    scheduled = false;
    for (const [node, entry] of surfaces) {
      if (!node.isConnected) { entry.observer.disconnect(); surfaces.delete(node); stack = stack.filter(n => n !== node); continue; }
      const open = visible(node);
      if (open && !entry.open) {
        entry.opener = node.contains(document.activeElement) ? lastExternalFocus : document.activeElement;
        // Non-modal menus form one surface; opening another releases the first.
        if (['hud-tools-panel', 'compact-view-panel', 'viewport-cable-dock'].includes(node.id)) {
          for (const old of stack.slice()) if (['hud-tools-panel', 'compact-view-panel', 'viewport-cable-dock'].includes(old.id) && old !== node) {
            old.hidden = true; surfaces.get(old).open = false; stack = stack.filter(n => n !== old);
            document.querySelector(`[aria-controls="${old.id}"]`)?.setAttribute('aria-expanded', 'false');
          }
        }
        stack.push(node); clearHover();
      } else if (!open && entry.open) {
        stack = stack.filter(n => n !== node);
        if (node.contains(document.activeElement) && entry.opener?.isConnected) entry.opener.focus({ preventScroll: true });
      }
      entry.open = open;
    }
    const blocked = stack.length > 0;
    document.body.classList.toggle('ui-surface-open', blocked);
    if (window.__STUDIO3D__?.controls) window.__STUDIO3D__.controls.enabled = !blocked;
  }
  function schedule() { if (!scheduled) { scheduled = true; queueMicrotask(refresh); } }
  function scan(root) {
    if (!(root instanceof Element || root === document)) return;
    const nodes = [...(root.matches?.(selector) ? [root] : []), ...root.querySelectorAll(selector)];
    for (const node of nodes) if (!surfaces.has(node)) {
      const observer = new MutationObserver(schedule);
      observer.observe(node, { attributes: true, attributeFilter: ['hidden', 'open', 'style', 'class', 'aria-hidden'] });
      surfaces.set(node, { observer, open: false, opener: null });
    }
    schedule();
  }
  const isScene = target => target instanceof Element && !!target.closest('#rack-viewport, #studio3d-container')
    && !target.closest('button, input, select, textarea, .viewport-zoom-dock, #device-floating-controls');
  window.UIInteraction = { isSceneBlocked: () => stack.length > 0 || performance.now() < dismissUntil, closeTop: () => close(top()), clearHover };
  document.addEventListener('focusin', event => { if (!event.target.closest?.(selector)) lastExternalFocus = event.target; });
  document.addEventListener('pointerdown', event => {
    if (!top() || !isScene(event.target)) return;
    event.preventDefault(); event.stopImmediatePropagation(); dismissUntil = performance.now() + 500;
    if (!top().matches('dialog, .modal, .instrument-overlay')) close(top());
  }, true);
  for (const type of ['click', 'dblclick', 'contextmenu', 'wheel']) document.addEventListener(type, event => {
    if (window.UIInteraction.isSceneBlocked() && isScene(event.target)) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, { capture: true, passive: false });
  document.addEventListener('keydown', event => {
    const node = top(); if (!node) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close(node); return; }
    if (event.key === 'Tab' && node.matches('dialog, .modal, .instrument-overlay')) {
      const controls = Array.from(node.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')).filter(el => el.getClientRects().length);
      if (!controls.length) return;
      if (event.shiftKey && (document.activeElement === controls[0] || !node.contains(document.activeElement))) { event.preventDefault(); controls.at(-1).focus(); }
      else if (!event.shiftKey && (document.activeElement === controls.at(-1) || !node.contains(document.activeElement))) { event.preventDefault(); controls[0].focus(); }
    }
  }, true);
  function init() {
    scan(document);
    new MutationObserver(records => { for (const record of records) for (const node of record.addedNodes) scan(node); if (records.some(r => r.removedNodes.length)) schedule(); })
      .observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
