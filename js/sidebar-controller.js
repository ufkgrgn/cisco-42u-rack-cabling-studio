/**
 * Cisco Enterprise Rack & Cabling Studio - Sidebar, Topdeck & Viewport Controls
 */
(function () {
  'use strict';

  function initSidebarAndLayout() {
    // 2D Sidebar Collapse / Expand All
    document.getElementById('btn-collapse-all')?.addEventListener('click', () => {
      document.querySelectorAll('.workspace-library details.collapsible-section').forEach(d => { d.open = false; });
    });
    document.getElementById('btn-expand-all')?.addEventListener('click', () => {
      document.querySelectorAll('.workspace-library details.collapsible-section').forEach(d => { d.open = true; });
    });

    // Floating Top Deck Collapse/Expand Toggle
    const btnToggleTopdeck = document.getElementById('btn-toggle-rack-topbar');
    const topdeck = document.getElementById('rack-floating-topdeck');
    const toggleIcon = document.getElementById('rack-toggle-icon');
    if (btnToggleTopdeck && topdeck) {
      btnToggleTopdeck.addEventListener('click', () => {
        topdeck.classList.toggle('collapsed');
        const isCollapsed = topdeck.classList.contains('collapsed');
        if (toggleIcon) toggleIcon.innerHTML = window.getLucideIconSvg ? window.getLucideIconSvg(isCollapsed ? 'ChevronRight' : 'ChevronLeft', 14) : (isCollapsed ? '▶' : '◀');
        btnToggleTopdeck.title = isCollapsed ? 'Kabin Düzenleme Araçlarını Göster' : 'Kabin Düzenleme Araçlarını Gizle (Dikey Alan Aç)';
      });
    }

    // 2D Zoom Controls
    document.getElementById('btn-2d-zoom-in')?.addEventListener('click', () => {
      document.getElementById('btn-zoom-in')?.click();
    });
    document.getElementById('btn-2d-zoom-out')?.addEventListener('click', () => {
      document.getElementById('btn-zoom-out')?.click();
    });
    document.getElementById('btn-2d-zoom-fit')?.addEventListener('click', () => {
      document.getElementById('btn-zoom-fit')?.click();
    });

    // 2D Cable Routing Mode Toggle
    const btnRouting2D = document.getElementById('btn-2d-routing-mode');
    try {
      const savedRouting = localStorage.getItem('rack-studio-cable-routing-mode');
      if (savedRouting && window.RackStudio && window.RackStudio.STATE) {
        window.RackStudio.STATE.cableRoutingMode = savedRouting;
        if (btnRouting2D) btnRouting2D.textContent = savedRouting === 'structured' ? 'Düzenli' : 'Serbest';
      }
    } catch (e) {}

    btnRouting2D?.addEventListener('click', () => {
      if (window.RackStudio && window.RackStudio.STATE) {
        const cur = window.RackStudio.STATE.cableRoutingMode || 'structured';
        const next = cur === 'structured' ? 'direct' : 'structured';
        window.RackStudio.STATE.cableRoutingMode = next;
        btnRouting2D.textContent = next === 'structured' ? 'Düzenli' : 'Serbest';
        try { localStorage.setItem('rack-studio-cable-routing-mode', next); } catch (e) {}
        if (window.RackStudio.renderAllCables) window.RackStudio.renderAllCables();
        document.dispatchEvent(new CustomEvent('rackstudio:change', { bubbles: true }));
        document.dispatchEvent(new CustomEvent('rackstudio:refresh', { bubbles: true }));
        window.dispatchEvent(new CustomEvent('rackstudio:refresh'));
      }
    });

    document.getElementById('btn-2d-face-toggle')?.addEventListener('click', () => {
      if (window.RackStudio && window.RackStudio.toggleActiveFace) {
        window.RackStudio.toggleActiveFace();
      } else {
        const toggleBtn = document.querySelector('[data-action="toggle-face"]') || document.getElementById('btn-toggle-face');
        if (toggleBtn) toggleBtn.click();
      }
    });

    // Dismissible viewport hint
    const hintEl = document.getElementById('viewport-bottom-hint');
    const HINT_KEY = 'rack_studio_viewport_hint_dismissed';
    try {
      if (localStorage.getItem(HINT_KEY) === '1') hintEl?.classList.add('is-dismissed');
    } catch (_) {}
    document.getElementById('btn-dismiss-viewport-hint')?.addEventListener('click', () => {
      hintEl?.classList.add('is-dismissed');
      try { localStorage.setItem(HINT_KEY, '1'); } catch (_) {}
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSidebarAndLayout);
  } else {
    initSidebarAndLayout();
  }
})();
