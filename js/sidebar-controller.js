/**
 * Cisco Enterprise Rack & Cabling Studio - Sidebar, Topdeck & Viewport Controls
 */
(function () {
  'use strict';

  function initSidebarAndLayout() {
    const sidebarLeft = document.getElementById('sidebar-left');
    const btnToggleLeft = document.getElementById('btn-toggle-left-sidebar');
    const railBtnToggle = document.getElementById('rail-btn-toggle');
    const mobileCatalogButton = document.getElementById('btn-mobile-catalog');
    const mobileScheduleButton = document.getElementById('btn-mobile-schedule');
    const sidebarScrim = document.createElement('button');
    sidebarScrim.type = 'button';
    sidebarScrim.className = 'sidebar-scrim';
    sidebarScrim.setAttribute('aria-label', 'Donanım kataloğunu kapat');
    document.body.append(sidebarScrim);

    const isOverlaySidebar = () => window.matchMedia('(max-width: 1199px)').matches;

    function setLeftSidebarCollapsed(collapsed) {
      if (!sidebarLeft) return;
      sidebarLeft.classList.toggle('collapsed', collapsed);
      if (btnToggleLeft) {
        const iconSvg = window.getLucideIconSvg ? window.getLucideIconSvg(collapsed ? 'ChevronRight' : 'ChevronLeft', 14) : (collapsed ? '▶' : '◀');
        btnToggleLeft.innerHTML = iconSvg;
        btnToggleLeft.title = collapsed ? 'Kütüphaneyi Aç (Ctrl+B)' : 'Kütüphaneyi Katla (Ctrl+B)';
      }
      try { localStorage.setItem('rack_studio_left_sidebar_collapsed', collapsed ? '1' : '0'); } catch(e) {}
      document.body.classList.toggle('left-sidebar-open', isOverlaySidebar() && !collapsed);
      mobileCatalogButton?.setAttribute('aria-expanded', String(!collapsed));
      setTimeout(() => {
        if (!isOverlaySidebar()) window.dispatchEvent(new Event('resize'));
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
    sidebarScrim.addEventListener('click', () => setLeftSidebarCollapsed(true));
    mobileCatalogButton?.addEventListener('click', () => {
      const collapsed = sidebarLeft?.classList.contains('collapsed');
      if (collapsed && window.matchMedia('(max-width: 1023px)').matches) setRightSidebarCollapsed(true);
      setLeftSidebarCollapsed(!collapsed);
    });

    // 2D Collapsible Right Sidebar
    const sidebarRight = document.getElementById('sidebar-right');
    const btnToggleRight = document.getElementById('btn-toggle-right-sidebar');
    const rightScrim = document.createElement('button');
    rightScrim.type = 'button';
    rightScrim.className = 'sidebar-right-scrim';
    rightScrim.setAttribute('aria-label', 'Bağlantı listesini kapat');
    document.body.append(rightScrim);

    function setRightSidebarCollapsed(collapsed, persist = true) {
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
        const iconSvg = window.getLucideIconSvg ? window.getLucideIconSvg(collapsed ? 'ChevronLeft' : 'ChevronRight', 14) : (collapsed ? '◀' : '▶');
        btnToggleRight.innerHTML = iconSvg;
        btnToggleRight.title = collapsed ? 'Çizelgeyi Aç' : 'Çizelgeyi Katla';
      }
      mobileScheduleButton?.setAttribute('aria-expanded', String(!collapsed));
      document.body.classList.toggle('right-sidebar-open', window.matchMedia('(max-width: 1023px)').matches && !collapsed);
      if (persist) try { localStorage.setItem('rack_studio_right_sidebar_collapsed', collapsed ? '1' : '0'); } catch(e) {}
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 260);
    }
    window.setRightSidebarCollapsed = setRightSidebarCollapsed;

    btnToggleRight?.addEventListener('click', () => {
      const isCollapsed = sidebarRight?.classList.contains('collapsed');
      setRightSidebarCollapsed(!isCollapsed);
    });
    mobileScheduleButton?.addEventListener('click', () => {
      const collapsed = sidebarRight?.classList.contains('collapsed');
      if (collapsed) setLeftSidebarCollapsed(true);
      setRightSidebarCollapsed(!collapsed);
    });
    rightScrim.addEventListener('click', () => setRightSidebarCollapsed(true));

    // Keyboard shortcut Ctrl+B or Cmd+B to toggle left sidebar
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        const isCollapsed = sidebarLeft?.classList.contains('collapsed');
        setLeftSidebarCollapsed(!isCollapsed);
      } else if (e.key === 'Escape' && isOverlaySidebar() && !sidebarLeft?.classList.contains('collapsed')) {
        setLeftSidebarCollapsed(true);
      } else if (e.key === 'Escape' && window.matchMedia('(max-width: 1023px)').matches && !sidebarRight?.classList.contains('collapsed')) {
        setRightSidebarCollapsed(true);
      }
    });

    window.addEventListener('resize', () => {
      document.body.classList.toggle('left-sidebar-open', isOverlaySidebar() && !sidebarLeft?.classList.contains('collapsed'));
      document.body.classList.toggle('right-sidebar-open', window.matchMedia('(max-width: 1023px)').matches && !sidebarRight?.classList.contains('collapsed'));
    }, { passive: true });

    // Restore sidebar state from localStorage
    try {
      const savedLeftState = localStorage.getItem('rack_studio_left_sidebar_collapsed');
      if (savedLeftState === '1' || (savedLeftState === null && isOverlaySidebar())) {
        setLeftSidebarCollapsed(true);
      }
      if (window.matchMedia('(max-width: 1023px)').matches || localStorage.getItem('rack_studio_right_sidebar_collapsed') === '1') {
        setRightSidebarCollapsed(true, !window.matchMedia('(max-width: 1023px)').matches);
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
