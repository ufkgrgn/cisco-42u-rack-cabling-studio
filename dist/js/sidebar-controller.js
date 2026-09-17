/**
 * Cisco Enterprise Rack & Cabling Studio - Sidebar, Topdeck & Viewport Controls
 */
(function () {
  'use strict';

  function initSidebarAndLayout() {
    const sidebarLeft = document.getElementById('sidebar-left');
    const btnToggleLeft = document.getElementById('btn-toggle-left-sidebar');
    const railBtnToggle = document.getElementById('rail-btn-toggle');

    function setLeftSidebarCollapsed(collapsed) {
      if (!sidebarLeft) return;
      sidebarLeft.classList.toggle('collapsed', collapsed);
      if (btnToggleLeft) {
        btnToggleLeft.textContent = collapsed ? '▶' : '◀';
        btnToggleLeft.title = collapsed ? 'Kütüphaneyi Aç (Ctrl+B)' : 'Kütüphaneyi Katla (Ctrl+B)';
      }
      try { localStorage.setItem('rack_studio_left_sidebar_collapsed', collapsed ? '1' : '0'); } catch(e) {}
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 260);
    }
    window.setLeftSidebarCollapsed = setLeftSidebarCollapsed;

    btnToggleLeft?.addEventListener('click', () => {
      const isCollapsed = sidebarLeft?.classList.contains('collapsed');
      setLeftSidebarCollapsed(!isCollapsed);
    });

    railBtnToggle?.addEventListener('click', () => {
      const isCollapsed = sidebarLeft?.classList.contains('collapsed');
      setLeftSidebarCollapsed(!isCollapsed);
    });

    // 2D Collapsible Right Sidebar
    const sidebarRight = document.getElementById('sidebar-right');
    const btnToggleRight = document.getElementById('btn-toggle-right-sidebar');

    function setRightSidebarCollapsed(collapsed) {
      if (!sidebarRight) return;
      sidebarRight.classList.toggle('collapsed', collapsed);
      if (collapsed) {
        sidebarRight.style.width = '44px';
        sidebarRight.style.minWidth = '44px';
        sidebarRight.style.maxWidth = '44px';
      } else {
        let savedW = '450';
        try {
          const raw = localStorage.getItem('rack_studio_right_sidebar_width');
          if (raw && Number(raw) >= 360 && Number(raw) <= 750) savedW = raw;
        } catch(e) {}
        sidebarRight.style.width = savedW + 'px';
        sidebarRight.style.minWidth = '360px';
        sidebarRight.style.maxWidth = '750px';
      }
      if (btnToggleRight) {
        btnToggleRight.textContent = collapsed ? '◀' : '▶';
        btnToggleRight.title = collapsed ? 'Çizelgeyi Aç' : 'Çizelgeyi Katla';
      }
      try { localStorage.setItem('rack_studio_right_sidebar_collapsed', collapsed ? '1' : '0'); } catch(e) {}
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 260);
    }
    window.setRightSidebarCollapsed = setRightSidebarCollapsed;

    btnToggleRight?.addEventListener('click', () => {
      const isCollapsed = sidebarRight?.classList.contains('collapsed');
      setRightSidebarCollapsed(!isCollapsed);
    });

    // Keyboard shortcut Ctrl+B or Cmd+B to toggle left sidebar
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        const isCollapsed = sidebarLeft?.classList.contains('collapsed');
        setLeftSidebarCollapsed(!isCollapsed);
      }
    });

    // Restore sidebar state from localStorage
    try {
      if (localStorage.getItem('rack_studio_left_sidebar_collapsed') === '1') {
        setLeftSidebarCollapsed(true);
      }
      if (localStorage.getItem('rack_studio_right_sidebar_collapsed') === '1') {
        setRightSidebarCollapsed(true);
      } else {
        const savedRightW = localStorage.getItem('rack_studio_right_sidebar_width');
        if (savedRightW && Number(savedRightW) >= 360 && Number(savedRightW) <= 750 && sidebarRight) {
          sidebarRight.style.width = savedRightW + 'px';
        }
      }
    } catch(e) {}

    // Right Sidebar Draggable Edge Resizer
    const resizerRight = document.getElementById('sidebar-right-resizer');
    if (resizerRight && sidebarRight) {
      let isResizing = false;
      let startX = 0;
      let startW = 0;

      resizerRight.addEventListener('mousedown', (e) => {
        isResizing = true;
        startX = e.clientX;
        startW = sidebarRight.getBoundingClientRect().width;
        resizerRight.classList.add('resizing');
        document.body.style.cursor = 'ew-resize';
        document.body.style.userSelect = 'none';
      });

      window.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        const dx = startX - e.clientX;
        const newW = Math.max(360, Math.min(750, startW + dx));
        sidebarRight.style.width = newW + 'px';
      });

      window.addEventListener('mouseup', () => {
        if (isResizing) {
          isResizing = false;
          resizerRight.classList.remove('resizing');
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
          try {
            localStorage.setItem('rack_studio_right_sidebar_width', String(Math.round(sidebarRight.getBoundingClientRect().width)));
          } catch(e) {}
          window.dispatchEvent(new Event('resize'));
        }
      });
    }

    // 2D Sidebar Collapse / Expand All
    document.getElementById('btn-collapse-all')?.addEventListener('click', () => {
      document.querySelectorAll('.sidebar-left details.collapsible-section').forEach(d => { d.open = false; });
    });
    document.getElementById('btn-expand-all')?.addEventListener('click', () => {
      document.querySelectorAll('.sidebar-left details.collapsible-section').forEach(d => { d.open = true; });
    });

    // Floating Top Deck Collapse/Expand Toggle
    const btnToggleTopdeck = document.getElementById('btn-toggle-rack-topbar');
    const topdeck = document.getElementById('rack-floating-topdeck');
    const toggleIcon = document.getElementById('rack-toggle-icon');
    if (btnToggleTopdeck && topdeck) {
      btnToggleTopdeck.addEventListener('click', () => {
        topdeck.classList.toggle('collapsed');
        const isCollapsed = topdeck.classList.contains('collapsed');
        if (toggleIcon) toggleIcon.textContent = isCollapsed ? '▶' : '◀';
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
    btnRouting2D?.addEventListener('click', () => {
      if (window.RackStudio && window.RackStudio.STATE) {
        const cur = window.RackStudio.STATE.cableRoutingMode || 'structured';
        const next = cur === 'structured' ? 'direct' : 'structured';
        window.RackStudio.STATE.cableRoutingMode = next;
        btnRouting2D.textContent = next === 'structured' ? '〰️ Düzenli' : '〰️ Serbest';
        if (window.RackStudio.renderAllCables) window.RackStudio.renderAllCables();
      }
    });

    // 2D Clear Action & Face Toggle
    document.getElementById('btn-2d-clear-action')?.addEventListener('click', () => {
      document.getElementById('btn-clear-all')?.click();
      if (typeof window.updateTelemetry === 'function') window.updateTelemetry();
    });

    document.getElementById('btn-2d-face-toggle')?.addEventListener('click', () => {
      if (window.RackStudio && window.RackStudio.toggleActiveFace) {
        window.RackStudio.toggleActiveFace();
      } else {
        const toggleBtn = document.querySelector('[data-action="toggle-face"]') || document.getElementById('btn-toggle-face');
        if (toggleBtn) toggleBtn.click();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSidebarAndLayout);
  } else {
    initSidebarAndLayout();
  }
})();
