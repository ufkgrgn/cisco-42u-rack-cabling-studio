/**
 * Cisco Enterprise Rack & Cabling Studio - Cable HUD & Context Menu Module
 * Handles floating Quick HUD, right-click context menu, slot drag drop highlight,
 * and keyboard navigation/shortcuts (Esc, Delete/Backspace).
 */
(function () {
  'use strict';

  const RS = window.RackStudio = window.RackStudio || {};

  const STATE = RS.STATE;
  const dom = RS.dom;
  const HARDWARE_CATALOG = RS.HARDWARE_CATALOG;

  const getActiveRack = () => (RS.getActiveRack ? RS.getActiveRack() : RS.STATE?.racks?.[0]);
  const escapeHtml = (val) => RS.escapeHtml ? RS.escapeHtml(val) : String(val ?? '');
  const toggleCableDuctSide = (...args) => RS.toggleCableDuctSide && RS.toggleCableDuctSide(...args);
  const disconnectCable = (...args) => RS.disconnectCable && RS.disconnectCable(...args);
  const highlightCable = (...args) => RS.highlightCable && RS.highlightCable(...args);
  const renameCable2D = (...args) => RS.renameCable2D && RS.renameCable2D(...args);
  const renderAllCables = () => RS.renderAllCables && RS.renderAllCables();
  const renderScheduleTable = () => RS.renderScheduleTable && RS.renderScheduleTable();

  let quickHudEl = null;
  let contextMenuEl = null;
  let previewCableId = null;
  let lastHudOpenTime = 0;

  function hideCableQuickHud() {
    if (quickHudEl) {
      quickHudEl.remove();
      quickHudEl = null;
    }
  }

  function hideCableContextMenu() {
    if (previewCableId && RS.setPixiCablePreviewColor) {
      RS.setPixiCablePreviewColor(previewCableId, null);
      previewCableId = null;
    }
    if (contextMenuEl) {
      contextMenuEl.remove();
      contextMenuEl = null;
    }
  }

  function formatCompactHudName(name, id) {
    if (!name || name === id) return id;
    if (name.includes('➔') || name.includes('->')) {
      const sep = name.includes('➔') ? '➔' : '->';
      const parts = name.split(sep);
      if (parts.length === 2) {
        const p1 = parts[0].trim()
          .replace(/^Cisco\s+(Catalyst\s+)?/i, '')
          .replace(/\s+\d+\s+Port\s+Gigabit\s+PoE\+?$/i, '')
          .replace(/^(\d+\s+Port\s+Cat\d+e?\s+RJ45\s+Patch\s+Panel)/i, 'Cat6 PP-24')
          .replace(/^ODF\s+\d+\s+Port\s+(LC|SC)\s+(OS2|OM4)\s+Fiber\s+Patch\s+Panel/i, 'ODF-24 $1')
          .replace(/\s+Patch\s+Panel$/i, ' PP');
        const p2 = parts[1].trim()
          .replace(/^Cisco\s+(Catalyst\s+)?/i, '')
          .replace(/\s+\d+\s+Port\s+Gigabit\s+PoE\+?$/i, '')
          .replace(/^(\d+\s+Port\s+Cat\d+e?\s+RJ45\s+Patch\s+Panel)/i, 'Cat6 PP-24')
          .replace(/^ODF\s+\d+\s+Port\s+(LC|SC)\s+(OS2|OM4)\s+Fiber\s+Patch\s+Panel/i, 'ODF-24 $1')
          .replace(/\s+Patch\s+Panel$/i, ' PP');
        return `${p1} ➔ ${p2}`;
      }
    }
    return name;
  }

  function showCableQuickHud(cableId, clientX, clientY) {
    if (STATE.multiSelectMode || (STATE.multiSelectedDevices && STATE.multiSelectedDevices.size > 0) || RS.isDraggingDevice) return;
    hideCableQuickHud();
    hideCableContextMenu();
    lastHudOpenTime = Date.now();
    if (dom?.tooltip) dom.tooltip.style.display = 'none';
    highlightCable(cableId, true);

    const cable = STATE.cables.find(c => c.id === cableId);
    if (!cable) return;

    const hud = document.createElement('div');
    hud.className = 'cable-quick-hud';
    hud.id = 'cable-quick-hud';
    const left = Math.max(80, Math.min(window.innerWidth - 80, clientX));
    const isNearTop = clientY < 85;
    const top = isNearTop ? Math.max(70, clientY + 30) : clientY;
    if (isNearTop) {
      hud.style.transform = 'translate(-50%, 0)';
    }
    hud.style.left = `${left}px`;
    hud.style.top = `${top}px`;

    const currentDuct = cable.ductSide || 'auto';
    const ductIcon = currentDuct === 'left' ? 'Sol' : (currentDuct === 'right' ? 'Sağ' : 'Otomatik');
    const ductTitle = `Kanal Güzergahı: ${currentDuct === 'left' ? 'Sol Dikey Tava' : (currentDuct === 'right' ? 'Sağ Dikey Tava' : 'Otomatik Dengeli')} (Değiştirmek için tıkla)`;
    const fullName = cable.name || cable.id;
    const compactName = formatCompactHudName(fullName, cable.id);

    hud.innerHTML = `
      <span class="hud-title" title="${escapeHtml(fullName)}"><span style="color:${cable.color};">●</span> ${escapeHtml(compactName)} <span class="hud-length-val" style="color:#94a3b8; font-size:0.72rem; margin-left:4px;">${Number(cable.lengthMeters || 0).toFixed(1)}m</span></span>
      <button type="button" class="hud-btn-duct" title="${escapeHtml(ductTitle)}">${escapeHtml(ductIcon)}</button>
      <button type="button" class="hud-btn-settings" title="Tüm Kablo Ayarları & Menü">Menü</button>
      <button type="button" class="hud-btn-disconnect" title="Kabloyu Sök (Delete Tuşu)">Sök</button>
      <button type="button" class="hud-btn-color" title="Kablo Rengini Değiştir">Renk</button>
      <button type="button" class="hud-btn-close" title="Kapat">✕</button>
    `;

    hud.querySelector('.hud-btn-duct').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleCableDuctSide(cableId);
      showCableQuickHud(cableId, left, top);
    });

    hud.querySelector('.hud-btn-settings').addEventListener('click', (e) => {
      e.stopPropagation();
      showCableContextMenu(cableId, left, top);
    });

    hud.querySelector('.hud-btn-disconnect').addEventListener('click', (e) => {
      e.stopPropagation();
      disconnectCable(cableId);
    });

    hud.querySelector('.hud-btn-color').addEventListener('click', (e) => {
      e.stopPropagation();
      const colors = ['#0070d2', '#00d2ff', '#10b981', '#f59e0b', '#ef4444', '#a855f7', '#ec4899', '#ffffff'];
      const currentIdx = colors.indexOf(cable.color);
      cable.color = colors[(currentIdx + 1) % colors.length];
      renderAllCables();
      renderScheduleTable();
      document.dispatchEvent(new CustomEvent('rackstudio:change', { bubbles: true }));
      showCableQuickHud(cableId, left, top);
    });

    hud.querySelector('.hud-btn-close').addEventListener('click', (e) => {
      e.stopPropagation();
      hideCableQuickHud();
      highlightCable(null);
    });

    document.body.appendChild(hud);
    quickHudEl = hud;
  }

  function showCableContextMenu(cableId, clientX, clientY) {
    if (STATE.multiSelectMode || (STATE.multiSelectedDevices && STATE.multiSelectedDevices.size > 0) || RS.isDraggingDevice) return;
    hideCableContextMenu();
    hideCableQuickHud();
    lastHudOpenTime = Date.now();
    if (dom?.tooltip) dom.tooltip.style.display = 'none';
    highlightCable(cableId, true);

    const cable = STATE.cables.find(c => c.id === cableId);
    if (!cable) return;

    const currentDuct = cable.ductSide || 'auto';
    const iconRoute = window.getLucideIconSvg ? window.getLucideIconSvg('Route', 13) : '';
    const iconTrash = window.getLucideIconSvg ? window.getLucideIconSvg('Trash2', 13) : '';
    const iconEdit = window.getLucideIconSvg ? window.getLucideIconSvg('Pencil', 13) : '';
    const iconPalette = window.getLucideIconSvg ? window.getLucideIconSvg('Palette', 13) : '';
    const iconClose = window.getLucideIconSvg ? window.getLucideIconSvg('X', 13) : '';

    const menu = document.createElement('div');
    menu.className = 'cable-context-menu';
    menu.id = 'cable-context-menu';
    menu.style.left = '0px';
    menu.style.top = '0px';
    menu.style.visibility = 'hidden';

    menu.innerHTML = `
      <div class="context-menu-header">
        <span class="context-menu-title" title="${escapeHtml(cable.name || cable.id)}"><span style="color:${cable.color}; flex-shrink:0;">●</span><span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(formatCompactHudName(cable.name || cable.id, cable.id))}</span></span>
        <span class="context-menu-badge">${Number(cable.lengthMeters || 1.5).toFixed(1)}m</span>
      </div>
      <div class="context-menu-body">
        <div class="context-menu-section-title">Kanal Güzergahı</div>
        <button class="context-menu-item menu-item ${currentDuct === 'auto' ? 'active' : ''}" id="ctx-duct-auto">
          <span class="context-menu-icon">${iconRoute}</span>
          <span>Otomatik (Dengeli)</span>
        </button>
        <button class="context-menu-item menu-item ${currentDuct === 'left' ? 'active' : ''}" id="ctx-duct-left">
          <span class="context-menu-icon">${iconRoute}</span>
          <span>Sol Dikey Tava</span>
        </button>
        <button class="context-menu-item menu-item ${currentDuct === 'right' ? 'active' : ''}" id="ctx-duct-right">
          <span class="context-menu-icon">${iconRoute}</span>
          <span>Sağ Dikey Tava</span>
        </button>
        <div class="menu-divider"></div>
        <button class="context-menu-item menu-item" id="ctx-rename">
          <span class="context-menu-icon">${iconEdit}</span>
          <span>Yeniden adlandır</span>
        </button>
        <button class="context-menu-item menu-item" id="ctx-change-color">
          <span class="context-menu-icon">${iconPalette}</span>
          <span>Renk değiştir</span>
        </button>
        <div id="ctx-color-swatches" class="context-swatches-row"></div>
        <div class="menu-divider"></div>
        <button class="context-menu-item menu-item danger" id="ctx-disconnect">
          <span class="context-menu-icon">${iconTrash}</span>
          <span>Kabloyu sök</span>
        </button>
        <button class="context-menu-item menu-item" id="ctx-cancel">
          <span class="context-menu-icon">${iconClose}</span>
          <span>Kapat</span>
        </button>
      </div>
    `;

    const setDuct = (side) => {
      cable.ductSide = side;
      renderAllCables();
      renderScheduleTable();
      hideCableContextMenu();
      document.dispatchEvent(new CustomEvent('rackstudio:change', { bubbles: true }));
      document.dispatchEvent(new CustomEvent('rackstudio:refresh', { bubbles: true }));
      window.dispatchEvent(new CustomEvent('rackstudio:refresh'));
    };

    menu.querySelector('#ctx-duct-auto').addEventListener('click', (e) => {
      e.stopPropagation();
      setDuct('auto');
    });

    menu.querySelector('#ctx-duct-left').addEventListener('click', (e) => {
      e.stopPropagation();
      setDuct('left');
    });

    menu.querySelector('#ctx-duct-right').addEventListener('click', (e) => {
      e.stopPropagation();
      setDuct('right');
    });

    menu.querySelector('#ctx-disconnect').addEventListener('click', (e) => {
      e.stopPropagation();
      disconnectCable(cableId);
    });

    menu.querySelector('#ctx-rename').addEventListener('click', (e) => {
      e.stopPropagation();
      hideCableContextMenu();
      renameCable2D(cable.id);
    });

    const CABLE_COLORS = ['#0070d2', '#00d2ff', '#10b981', '#f59e0b', '#ef4444', '#a855f7', '#ec4899', '#ffffff'];
    const swatchContainer = menu.querySelector('#ctx-color-swatches');
    if (swatchContainer) {
      CABLE_COLORS.forEach(clr => {
        const swatch = document.createElement('span');
        swatch.className = 'context-color-swatch';
        swatch.dataset.color = clr;
        swatch.style.background = clr;
        if (clr === cable.color) swatch.classList.add('selected');
        swatch.title = clr;
        swatch.addEventListener('mouseenter', () => {
          previewCableId = cableId;
          if (RS.setPixiCablePreviewColor) RS.setPixiCablePreviewColor(cableId, clr);
        });
        swatch.addEventListener('mouseleave', () => {
          if (RS.setPixiCablePreviewColor) RS.setPixiCablePreviewColor(cableId, null);
          if (previewCableId === cableId) previewCableId = null;
        });
        swatch.addEventListener('click', (e) => {
          e.stopPropagation();
          cable.color = clr;
          if (RS.setPixiCablePreviewColor) RS.setPixiCablePreviewColor(cableId, null);
          previewCableId = null;
          renderAllCables();
          renderScheduleTable();
          document.dispatchEvent(new CustomEvent('rackstudio:change', { bubbles: true }));
          hideCableContextMenu();
          highlightCable(cableId, true);
        });
        swatchContainer.appendChild(swatch);
      });
    }

    menu.querySelector('#ctx-change-color').addEventListener('click', (e) => {
      e.stopPropagation();
      const colors = CABLE_COLORS;
      const currentIdx = colors.indexOf(cable.color);
      cable.color = colors[(currentIdx + 1) % colors.length];
      renderAllCables();
      renderScheduleTable();
      document.dispatchEvent(new CustomEvent('rackstudio:change', { bubbles: true }));
      hideCableContextMenu();
    });

    menu.querySelector('#ctx-cancel').addEventListener('click', (e) => {
      e.stopPropagation();
      hideCableContextMenu();
      highlightCable(null);
    });

    document.body.appendChild(menu);
    contextMenuEl = menu;
    const menuRect = menu.getBoundingClientRect();
    const viewportMargin = 10;
    const left = Math.max(viewportMargin, Math.min(window.innerWidth - menuRect.width - viewportMargin, clientX));
    const top = Math.max(viewportMargin, Math.min(window.innerHeight - menuRect.height - viewportMargin, clientY));
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    menu.style.visibility = 'visible';
  }

  function highlightDropSlots(targetU, catalogKey, isOver, targetRackId) {
    document.querySelectorAll('.rack-slot.drag-valid, .rack-slot.drag-invalid').forEach(el => {
      el.classList.remove('drag-valid', 'drag-invalid');
    });
    if (!isOver || !targetU) {
      RS.PixiCabinScene?.clearDropHighlight?.();
      return;
    }
    const targetRack = (targetRackId && RS.getRackById ? RS.getRackById(targetRackId) : null) ||
                       (targetRackId && STATE.racks ? STATE.racks.find(r => r && r.id === targetRackId) : null) ||
                       getActiveRack();
    const cat = RS.resolveCatalogItem
      ? RS.resolveCatalogItem(catalogKey || STATE.selectedLibraryItem)
      : (catalogKey
        ? (HARDWARE_CATALOG[catalogKey] || (RS.catalog && RS.catalog[catalogKey]) || (STATE.customCatalog && STATE.customCatalog[catalogKey]) || (Array.isArray(window.CISCO_MASTER_CATALOG) ? window.CISCO_MASTER_CATALOG.find(m => m && m.id === catalogKey) : window.CISCO_MASTER_CATALOG?.[catalogKey]))
        : (STATE.selectedLibraryItem ? (HARDWARE_CATALOG[STATE.selectedLibraryItem] || (RS.catalog && RS.catalog[STATE.selectedLibraryItem]) || (STATE.customCatalog && STATE.customCatalog[STATE.selectedLibraryItem]) || (Array.isArray(window.CISCO_MASTER_CATALOG) ? window.CISCO_MASTER_CATALOG.find(m => m && m.id === STATE.selectedLibraryItem) : window.CISCO_MASTER_CATALOG?.[STATE.selectedLibraryItem])) : null));
    const reqU = cat ? (cat.u || 1) : 1;
    const endU = targetU - reqU + 1;
    const isOut = endU < 1;
    let isBlocked = isOut;
    if (targetRack && !isOut) {
      for (let u = endU; u <= targetU; u++) {
        if (targetRack.units && targetRack.units[u] !== null) {
          isBlocked = true;
          break;
        }
      }
    }
    const cls = isBlocked ? 'drag-invalid' : 'drag-valid';
    for (let u = Math.max(1, endU); u <= targetU; u++) {
      let el = targetRack ? document.querySelector(`.rack-slot[data-rack-id="${targetRack.id}"][data-u="${u}"]`) : null;
      if (!el) el = document.getElementById(`rack-slot-u${u}`);
      if (el) el.classList.add(cls);
    }
    RS.PixiCabinScene?.updateDropHighlight?.(targetU, reqU, !isBlocked, targetRack?.id);
  }

  let deviceContextMenuEl = null;

  function hideDeviceContextMenu() {
    if (deviceContextMenuEl) {
      deviceContextMenuEl.remove();
      deviceContextMenuEl = null;
    }
  }

  function showDeviceContextMenu(instanceId, clientX, clientY) {
    if (instanceId) STATE.selectedDeviceId = instanceId;
    hideCableQuickHud();
    hideCableContextMenu();
    hideDeviceContextMenu();

    const dev = RS.getDeviceById ? RS.getDeviceById(instanceId) : null;
    const cat = dev ? (HARDWARE_CATALOG[dev.catalogKey] || (RS.catalog && RS.catalog[dev.catalogKey]) || {}) : {};
    const devName = dev?.hostname || dev?.name || dev?.panelLabel || cat.name || 'Cihaz';
    const isPatch = cat.category === 'patch' || cat.category === 'fiber';
    const isOrg = cat.category === 'organizer';
    const isBlank = cat.category === 'blank';
    const isFinger = isOrg && (cat.subType === 'finger-duct' || /finger/i.test(cat.name || ''));

    const devCables = (STATE.cables || []).filter(c => c.from?.instanceId === instanceId || c.to?.instanceId === instanceId);
    const hasCables = devCables.length > 0;
    const connPorts = cat.ports ? cat.ports.filter(p => p.type !== 'power').length : 0;
    const hasFree = connPorts > devCables.length;

    const iconPlug = window.getLucideIconSvg ? window.getLucideIconSvg('Plug', 13) : '';
    const iconPalette = window.getLucideIconSvg ? window.getLucideIconSvg('Palette', 13) : '';
    const iconUnplug = window.getLucideIconSvg ? window.getLucideIconSvg('Unplug', 13) : '';
    const iconDoor = window.getLucideIconSvg ? window.getLucideIconSvg('DoorOpen', 13) : '';
    const iconSettings = window.getLucideIconSvg ? window.getLucideIconSvg('Settings2', 13) : '';
    const iconTrash = window.getLucideIconSvg ? window.getLucideIconSvg('Trash2', 13) : '';
    const iconClose = window.getLucideIconSvg ? window.getLucideIconSvg('X', 13) : '';

    const menu = document.createElement('div');
    menu.className = 'cable-context-menu device-context-menu';
    menu.id = 'device-context-menu';
    menu.style.left = '0px';
    menu.style.top = '0px';
    menu.style.visibility = 'hidden';

    let html = `
      <div class="context-menu-header">
        <span class="context-menu-title" title="${escapeHtml(devName)}"><span>${escapeHtml(devName)}</span></span>
        <span class="context-menu-badge">U${dev?.topU || ''}</span>
      </div>
      <div class="context-menu-body">
    `;

    if (hasFree && (cat.category === 'switch' || cat.category === 'fiber-switch' || cat.category === 'compact' || isPatch || cat.category === 'router')) {
      html += `<button class="context-menu-item" id="ctx-dev-autofill"><span class="context-menu-icon">${iconPlug}</span><span>Boş portları bağla</span></button>`;
    }
    if (hasCables) {
      html += `<button class="context-menu-item" id="ctx-dev-color"><span class="context-menu-icon">${iconPalette}</span><span>Kabloları renklendir</span></button>`;
      html += `<button class="context-menu-item" id="ctx-dev-clear"><span class="context-menu-icon">${iconUnplug}</span><span>Kabloları sök (${devCables.length})</span></button>`;
    }
    if (isFinger) {
      html += `<button class="context-menu-item" id="ctx-dev-toggle-cover"><span class="context-menu-icon">${iconDoor}</span><span>Kanal kapağı</span></button>`;
    }
    if (cat.category !== 'blank') {
      html += `<button class="context-menu-item" id="ctx-dev-config"><span class="context-menu-icon">${iconSettings}</span><span>Cihaz bilgisi</span></button>`;
    }

    const delTitle = isBlank ? 'Kör Paneli Kaldır' : (isOrg ? 'Düzenleyiciyi Kaldır' : (isPatch ? 'Paneli Kaldır' : 'Cihazı Kaldır'));
    html += `
        <div class="menu-divider"></div>
        <button class="context-menu-item danger" id="ctx-dev-delete"><span class="context-menu-icon">${iconTrash}</span><span>${delTitle}</span></button>
        <button class="context-menu-item" id="ctx-dev-cancel"><span class="context-menu-icon">${iconClose}</span><span>Kapat</span></button>
      </div>
    `;

    menu.innerHTML = html;
    document.body.appendChild(menu);
    deviceContextMenuEl = menu;

    const menuRect = menu.getBoundingClientRect();
    const viewportMargin = 10;
    const left = Math.max(viewportMargin, Math.min(window.innerWidth - menuRect.width - viewportMargin, clientX));
    const top = Math.max(viewportMargin, Math.min(window.innerHeight - menuRect.height - viewportMargin, clientY));
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    menu.style.visibility = 'visible';

    menu.querySelector('#ctx-dev-delete')?.addEventListener('click', (e) => {
      e.stopPropagation();
      hideDeviceContextMenu();
      const targetEl = document.getElementById(instanceId) || document.body;
      if (RS.showInlineDeleteConfirm) {
        RS.showInlineDeleteConfirm(targetEl, devName, { category: cat.category, cableCount: devCables.length }, () => {
          RS.removeDevice?.(instanceId);
        });
      } else {
        RS.removeDevice?.(instanceId);
      }
    });

    menu.querySelector('#ctx-dev-autofill')?.addEventListener('click', (e) => {
      e.stopPropagation();
      hideDeviceContextMenu();
      const devEl = document.getElementById(instanceId);
      const btn = devEl?.querySelector('.autofill-device-btn') || menu;
      RS.openSwitchAutoFillPopover?.(btn, instanceId);
    });

    menu.querySelector('#ctx-dev-color')?.addEventListener('click', (e) => {
      e.stopPropagation();
      hideDeviceContextMenu();
      const devEl = document.getElementById(instanceId);
      const btn = devEl?.querySelector('.color-device-cables-btn') || menu;
      RS.openSwitchBulkColorPopover?.(btn, instanceId);
    });

    menu.querySelector('#ctx-dev-clear')?.addEventListener('click', (e) => {
      e.stopPropagation();
      hideDeviceContextMenu();
      RS.clearDeviceCables?.(instanceId);
    });

    menu.querySelector('#ctx-dev-toggle-cover')?.addEventListener('click', (e) => {
      e.stopPropagation();
      hideDeviceContextMenu();
      RS.toggleOrganizerCover?.(instanceId);
    });

    menu.querySelector('#ctx-dev-config')?.addEventListener('click', (e) => {
      e.stopPropagation();
      hideDeviceContextMenu();
      RS.openDeviceMetadataEditor?.(instanceId);
    });

    menu.querySelector('#ctx-dev-cancel')?.addEventListener('click', (e) => {
      e.stopPropagation();
      hideDeviceContextMenu();
    });
  }

  // Global keydown and click listeners for keyboard shortcuts & auto-dismiss
  if (typeof window !== 'undefined' && !window.__CABLE_INTERACTIONS_BOUND__) {
    window.__CABLE_INTERACTIONS_BOUND__ = true;

    document.addEventListener('click', (e) => {
      if (Date.now() - lastHudOpenTime < 250) {
        return;
      }
      if (e.target.closest('#cable-quick-hud') || e.target.closest('#cable-context-menu') || e.target.closest('#device-context-menu')) {
        return;
      }
      if (e.target.closest('.cable-path') || e.target.closest('.cable-boot')) {
        return;
      }
      if (e.target.closest('#schedule-table, #schedule-tbody, [data-cable-id], .schedule-cable-card, .tree-cable-row')) {
        return;
      }
      if (STATE?.cableRenderMode === 'pixi' && RS.hitTestPixiCable && RS.hitTestPixiCable(e.clientX, e.clientY)) {
        return;
      }
      if (quickHudEl || contextMenuEl || deviceContextMenuEl || STATE.highlightedCableId) {
        hideCableQuickHud();
        hideCableContextMenu();
        hideDeviceContextMenu();
        highlightCable(null);
      }
    });

    window.addEventListener('keydown', (e) => {
      if (window.UIInteraction?.isSceneBlocked()) return;
      if (e.key === 'Escape') {
        hideCableQuickHud();
        hideCableContextMenu();
        hideDeviceContextMenu();
        highlightCable(null);
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const activeEl = document.activeElement;
        const isEditing = activeEl && (
          activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.isContentEditable
        );
        if (isEditing) return;

        if (STATE.highlightedCableId) {
          e.preventDefault();
          disconnectCable(STATE.highlightedCableId);
          return;
        }

        const selectedDevId = STATE.selectedDeviceId || document.querySelector('.mounted-device.studio-selected')?.id;
        if (selectedDevId && RS.removeDevice) {
          e.preventDefault();
          const dev = RS.getDeviceById ? RS.getDeviceById(selectedDevId) : null;
          const cat = dev ? (HARDWARE_CATALOG[dev.catalogKey] || (RS.catalog && RS.catalog[dev.catalogKey]) || {}) : {};
          const devName = dev?.hostname || dev?.name || dev?.panelLabel || cat.name || 'Cihaz';
          const targetEl = document.getElementById(selectedDevId) || document.body;
          if (RS.showInlineDeleteConfirm) {
            RS.showInlineDeleteConfirm(targetEl, devName, { category: cat.category }, () => {
              RS.removeDevice(selectedDevId);
            });
          } else {
            RS.removeDevice(selectedDevId);
          }
        }
      }
    });
  }

  let deviceFloatingControlsEl = null;
  let activeFloatingDeviceId = null;
  let floatingControlsHideTimer = null;

  function hideDeviceFloatingControls(immediate = false) {
    if (floatingControlsHideTimer) {
      clearTimeout(floatingControlsHideTimer);
      floatingControlsHideTimer = null;
    }
    const doHide = () => {
      if (deviceFloatingControlsEl) {
        deviceFloatingControlsEl.style.display = 'none';
      }
      activeFloatingDeviceId = null;
    };
    if (immediate) doHide();
    else floatingControlsHideTimer = setTimeout(doHide, 250);
  }

  function isPointerOverActiveDevice(clientX, clientY) {
    if (!activeFloatingDeviceId) return false;
    if (deviceFloatingControlsEl && deviceFloatingControlsEl.style.display !== 'none') {
      const cRect = deviceFloatingControlsEl.getBoundingClientRect();
      if (clientX >= cRect.left - 4 && clientX <= cRect.right + 4 &&
          clientY >= cRect.top - 4 && clientY <= cRect.bottom + 4) {
        return true;
      }
    }
    const devEl = document.getElementById(activeFloatingDeviceId);
    let dRect = devEl ? devEl.getBoundingClientRect() : null;
    if (!dRect || dRect.width === 0) {
      const rec = RS.DeviceSceneRegistry?.getDeviceRecord?.(activeFloatingDeviceId);
      if (rec) {
        const viewportHost = document.getElementById('viewport-canvas');
        const vRect = viewportHost ? viewportHost.getBoundingClientRect() : { left: 0, top: 0 };
        const scale = Number(RS.ZOOM_STATE?.scale) || 1;
        const panX = Number(RS.ZOOM_STATE?.panX) || 0;
        const panY = Number(RS.ZOOM_STATE?.panY) || 0;
        const left = vRect.left + panX + rec.x * scale;
        const top = vRect.top + panY + rec.y * scale;
        dRect = { left, top, right: left + rec.width * scale, bottom: top + rec.height * scale };
      }
    }
    if (dRect) {
      return clientX >= dRect.left - 6 && clientX <= dRect.right + 6 &&
             clientY >= dRect.top - 6 && clientY <= dRect.bottom + 6;
    }
    return false;
  }

  function updateDeviceFloatingControlsPosition(instanceId) {
    if (!deviceFloatingControlsEl || activeFloatingDeviceId !== instanceId) return;
    const viewportHost = document.getElementById('viewport-canvas');
    if (!viewportHost) return;
    const scale = Number(RS.ZOOM_STATE?.scale) || 1;
    const vRect = viewportHost.getBoundingClientRect();
    const region = document.getElementById('rack-viewport')?.getBoundingClientRect() || vRect;
    const devEl = document.getElementById(instanceId);
    let dRect = devEl ? devEl.getBoundingClientRect() : null;

    if (!dRect || dRect.width === 0) {
      const rec = RS.DeviceSceneRegistry?.getDeviceRecord?.(instanceId);
      if (rec) {
        const panX = Number(RS.ZOOM_STATE?.panX) || 0;
        const panY = Number(RS.ZOOM_STATE?.panY) || 0;
        const left = vRect.left + panX + rec.x * scale;
        const top = vRect.top + panY + rec.y * scale;
        const width = rec.width * scale;
        const height = rec.height * scale;
        dRect = { left, top, right: left + width, bottom: top + height, width, height };
      }
    }

    if (dRect && dRect.width > 0) {
      const width = deviceFloatingControlsEl.offsetWidth;
      const height = deviceFloatingControlsEl.offsetHeight;
      const anchorX = dRect.left + dRect.width / 2;
      const anchorY = dRect.top + dRect.height / 2;
      const roomLeft = dRect.left - region.left;
      const roomRight = region.right - dRect.right;
      let side, left, top;
      if (roomLeft >= width + 12 || roomRight >= width + 12) {
        side = roomLeft >= width + 12 ? 'left' : 'right';
        left = side === 'left' ? dRect.left - width - 8 : dRect.right + 8;
        top = Math.max(region.top + 4, Math.min(region.bottom - height - 4, anchorY - height / 2));
      } else {
        side = dRect.top - region.top >= height + 12 ? 'above' : 'below';
        left = Math.max(region.left + 4, Math.min(region.right - width - 4, anchorX - width / 2));
        const preferredTop = side === 'above' ? dRect.top - height - 8 : dRect.bottom + 8;
        top = Math.max(region.top + 4, Math.min(region.bottom - height - 4, preferredTop));
      }
      deviceFloatingControlsEl.style.top = `${top}px`;
      deviceFloatingControlsEl.style.left = `${Math.round(left)}px`;
      deviceFloatingControlsEl.style.right = 'auto';
      deviceFloatingControlsEl.style.setProperty('--device-anchor-x', `${Math.max(12, Math.min(width - 12, anchorX - left))}px`);
      deviceFloatingControlsEl.style.setProperty('--device-anchor-y', `${Math.max(10, Math.min(height - 10, anchorY - top))}px`);
      deviceFloatingControlsEl.dataset.side = side;
      deviceFloatingControlsEl.style.transform = 'none';
      deviceFloatingControlsEl.style.display = 'flex';
    } else {
      deviceFloatingControlsEl.style.display = 'none';
    }
  }

  function showDeviceFloatingControls(instanceId) {
    if (!instanceId) {
      hideDeviceFloatingControls();
      return;
    }
    if (floatingControlsHideTimer) {
      clearTimeout(floatingControlsHideTimer);
      floatingControlsHideTimer = null;
    }
    if (activeFloatingDeviceId === instanceId && deviceFloatingControlsEl && deviceFloatingControlsEl.style.display !== 'none') {
      updateDeviceFloatingControlsPosition(instanceId);
      return;
    }

    const dev = RS.getDeviceById ? RS.getDeviceById(instanceId) : null;
    if (!dev) {
      hideDeviceFloatingControls(true);
      return;
    }
    const cat = (HARDWARE_CATALOG && HARDWARE_CATALOG[dev.catalogKey]) || (RS.catalog && RS.catalog[dev.catalogKey]) || RS.resolveCatalogItem?.(dev.catalogKey) || {};
    const devCables = (STATE.cables || []).filter(c => c.from?.instanceId === instanceId || c.to?.instanceId === instanceId);
    const occupiedCount = devCables.length;
    const hasCables = occupiedCount > 0;
    const isSwitch = cat.category === 'switch' || cat.category === 'fiber-switch' || cat.category === 'compact';
    const isPatch = cat.category === 'patch' || cat.category === 'fiber';
    const isOrg = cat.category === 'organizer';
    const isBlank = cat.category === 'blank';
    const isFinger = isOrg && (cat.subType === 'finger-duct' || /finger/i.test(cat.name || ''));
    const connPorts = cat.ports ? cat.ports.filter(p => p.type !== 'power').length : 0;
    const hasFree = connPorts > occupiedCount;

    if (!deviceFloatingControlsEl) {
      deviceFloatingControlsEl = document.createElement('div');
      deviceFloatingControlsEl.id = 'device-floating-controls';
      deviceFloatingControlsEl.className = 'device-controls-floating';
      deviceFloatingControlsEl.setAttribute('role', 'group');
      deviceFloatingControlsEl.setAttribute('aria-label', 'Cihaz işlemleri');
      document.body.appendChild(deviceFloatingControlsEl);

      deviceFloatingControlsEl.addEventListener('mouseenter', () => {
        if (floatingControlsHideTimer) {
          clearTimeout(floatingControlsHideTimer);
          floatingControlsHideTimer = null;
        }
      });
    }

    activeFloatingDeviceId = instanceId;
    deviceFloatingControlsEl.dataset.instanceId = instanceId;
    const rack = (STATE.racks || []).find(item => (item.devices || []).some(itemDev => itemDev.instanceId === instanceId));
    const deviceName = dev.hostname || dev.panelLabel || dev.name || cat.modelTag || cat.name || 'Cihaz';
    const location = `${rack?.name || 'Kabin'} · U${dev.topU || dev.uSlot || '?'}`;
    deviceFloatingControlsEl.setAttribute('aria-label', `${deviceName}, ${location} işlemleri`);

    const actionIcon = (name, fallback) => window.getLucideIconSvg?.(name, 14) || fallback;
    let btns = '';
    if (hasFree && (isSwitch || isPatch || cat.category === 'router')) {
      btns += `<button type="button" class="dev-btn autofill-device-btn" data-instance-id="${instanceId}" title="Boş portları bağla" aria-label="Boş portları bağla" aria-haspopup="dialog" aria-expanded="false">${actionIcon('Plug', 'Bağla')}</button>`;
    }
    if (hasCables) {
      btns += `<button type="button" class="dev-btn color-device-cables-btn" data-instance-id="${instanceId}" title="Kabloları renklendir" aria-label="Kabloları renklendir" aria-haspopup="dialog" aria-expanded="false">${actionIcon('Palette', 'Renk')}</button>`;
      btns += `<button type="button" class="dev-btn clear-device-cables-btn" data-instance-id="${instanceId}" title="Kabloları sök" aria-label="Kabloları sök">${actionIcon('Unplug', 'Sök')}</button>`;
    }
    if (isFinger) {
      btns += `<button type="button" class="dev-btn finger-toggle-btn" data-instance-id="${instanceId}" title="Kanal kapağını aç/kapat" aria-label="Kanal kapağını aç/kapat">${actionIcon('PanelTop', 'Kapak')}</button>`;
    }
    if (!isOrg && !isBlank) {
      btns += `<button type="button" class="dev-btn cfg-device-btn" data-instance-id="${instanceId}" title="Cihaz ayarları ve bilgileri" aria-label="Cihaz ayarları ve bilgileri">${actionIcon('Settings2', 'Ayar')}</button>`;
    }
    const delTitle = isBlank ? 'Kör Paneli Kaldır' : (isOrg ? 'Düzenleyiciyi Kaldır' : (isPatch ? 'Paneli Kaldır' : 'Cihazı Kaldır'));
    btns += `<button type="button" class="dev-btn del-device-btn" data-instance-id="${instanceId}" title="${delTitle}" aria-label="${delTitle}">${actionIcon('X', '✕')}</button>`;
    deviceFloatingControlsEl.innerHTML = `<span class="device-controls-identity" title="${escapeHtml(deviceName)} · ${escapeHtml(location)}"><strong>${escapeHtml(deviceName)}</strong><small>${escapeHtml(location)}</small></span><span class="device-controls-actions">${btns}</span>`;

    deviceFloatingControlsEl.querySelectorAll('.dev-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const instId = activeFloatingDeviceId;
        if (!instId) return;

        if (btn.classList.contains('del-device-btn')) {
          const d = RS.getDeviceById ? RS.getDeviceById(instId) : null;
          const c = d ? ((HARDWARE_CATALOG && HARDWARE_CATALOG[d.catalogKey]) || RS.resolveCatalogItem?.(d.catalogKey) || {}) : {};
          const name = d?.hostname || d?.name || d?.panelLabel || c.name || 'Cihaz';
          const cables = (STATE.cables || []).filter(item => item.from?.instanceId === instId || item.to?.instanceId === instId);
          if (RS.showInlineDeleteConfirm) {
            RS.showInlineDeleteConfirm(btn, name, { category: c.category, cableCount: cables.length }, () => {
              hideDeviceFloatingControls(true);
              RS.removeDevice?.(instId);
            });
          } else {
            hideDeviceFloatingControls(true);
            RS.removeDevice?.(instId);
          }
        } else if (btn.classList.contains('autofill-device-btn')) {
          RS.openSwitchAutoFillPopover?.(btn, instId);
        } else if (btn.classList.contains('color-device-cables-btn')) {
          RS.openSwitchBulkColorPopover?.(btn, instId);
        } else if (btn.classList.contains('clear-device-cables-btn')) {
          RS.clearDeviceCables?.(instId, btn);
          showDeviceFloatingControls(instId);
        } else if (btn.classList.contains('cfg-device-btn')) {
          window.DeviceMetadataEditor?.open2D(instId);
        } else if (btn.classList.contains('finger-toggle-btn')) {
          RS.toggleOrganizerCover?.(instId);
        }
      });
    });

    updateDeviceFloatingControlsPosition(instanceId);
  }

  window.addEventListener('rackstudio:zoom', () => {
    if (activeFloatingDeviceId) updateDeviceFloatingControlsPosition(activeFloatingDeviceId);
  });
  window.addEventListener('resize', () => {
    if (activeFloatingDeviceId) updateDeviceFloatingControlsPosition(activeFloatingDeviceId);
  });

  RS.showCableQuickHud = showCableQuickHud;
  RS.hideCableQuickHud = hideCableQuickHud;
  RS.showCableContextMenu = showCableContextMenu;
  RS.hideCableContextMenu = hideCableContextMenu;
  RS.showDeviceContextMenu = showDeviceContextMenu;
  RS.hideDeviceContextMenu = hideDeviceContextMenu;
  RS.highlightDropSlots = highlightDropSlots;
  RS.showDeviceFloatingControls = showDeviceFloatingControls;
  RS.hideDeviceFloatingControls = hideDeviceFloatingControls;
  RS.updateDeviceFloatingControlsPosition = updateDeviceFloatingControlsPosition;
  RS.getActiveFloatingDeviceId = () => activeFloatingDeviceId;
  RS.isPointerOverActiveDevice = isPointerOverActiveDevice;
})();
