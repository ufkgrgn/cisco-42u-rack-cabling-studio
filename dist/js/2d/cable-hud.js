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
    const ductIcon = currentDuct === 'left' ? '⬅️ Sol' : (currentDuct === 'right' ? '➡️ Sağ' : '⚖️ Oto');
    const ductTitle = `Kanal Güzergahı: ${currentDuct === 'left' ? 'Sol Dikey Tava' : (currentDuct === 'right' ? 'Sağ Dikey Tava' : 'Otomatik Dengeli')} (Değiştirmek için tıkla)`;
    const fullName = cable.name || cable.id;
    const compactName = formatCompactHudName(fullName, cable.id);

    hud.innerHTML = `
      <span class="hud-title" title="${escapeHtml(fullName)}"><span style="color:${cable.color};">●</span> ${escapeHtml(compactName)} <span class="hud-length-val" style="color:#94a3b8; font-size:0.72rem; margin-left:4px;">${Number(cable.lengthMeters || 0).toFixed(1)}m</span></span>
      <button type="button" class="hud-btn-duct" title="${escapeHtml(ductTitle)}">${escapeHtml(ductIcon)}</button>
      <button type="button" class="hud-btn-settings" title="Tüm Kablo Ayarları & Menü">⚙️ Menü</button>
      <button type="button" class="hud-btn-disconnect" title="Kabloyu Sök (Delete Tuşu)">✂️ Sök</button>
      <button type="button" class="hud-btn-color" title="Kablo Rengini Değiştir">🎨</button>
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

    const menu = document.createElement('div');
    menu.className = 'cable-context-menu';
    menu.id = 'cable-context-menu';
    menu.style.left = '0px';
    menu.style.top = '0px';
    menu.style.visibility = 'hidden';

    menu.innerHTML = `
      <div style="padding: 4px 8px; font-size: 0.7rem; color: #94a3b8; font-weight: 700; border-bottom: 1px solid #1e293b;">
        <span style="color:${cable.color};">●</span> ${escapeHtml(cable.name || cable.id)} (${cable.lengthMeters || 1.5}m)
      </div>
      <div class="menu-item ${currentDuct === 'auto' ? 'active' : ''}" id="ctx-duct-auto">
        ⚖️ Kanal: Otomatik Dengeli
      </div>
      <div class="menu-item ${currentDuct === 'left' ? 'active' : ''}" id="ctx-duct-left">
        ⬅️ Kanal: Sol Dikey Tava
      </div>
      <div class="menu-item ${currentDuct === 'right' ? 'active' : ''}" id="ctx-duct-right">
        ➡️ Kanal: Sağ Dikey Tava
      </div>
      <div class="menu-divider"></div>
      <div class="menu-item danger" id="ctx-disconnect">
        ✂️ Kabloyu Sök (Delete)
      </div>
      <div class="menu-item" id="ctx-rename">
        ✏️ Yeniden Adlandır
      </div>
      <div class="menu-item" id="ctx-change-color">
        🎨 Renk Değiştir
      </div>
      <div id="ctx-color-swatches" style="display:flex;flex-wrap:wrap;gap:5px;padding:6px 10px;"></div>
      <div class="menu-divider"></div>
      <div class="menu-item" id="ctx-cancel">
        ✕ Kapat
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
        swatch.style.cssText = `display:inline-block;width:16px;height:16px;border-radius:50%;background:${clr};cursor:pointer;border:2px solid ${clr === cable.color ? '#fff' : 'transparent'};box-sizing:border-box;transition:transform 0.1s;`;
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

    const menu = document.createElement('div');
    menu.className = 'cable-context-menu device-context-menu';
    menu.id = 'device-context-menu';

    let html = `
      <div class="context-menu-header" style="padding:6px 12px; font-weight:700; color:#38bdf8; border-bottom:1px solid #334155; font-size:12px; display:flex; align-items:center; justify-content:space-between; gap:6px;">
        <span>📦 ${escapeHtml(devName)}</span>
        <span style="font-size:10px; color:#94a3b8; background:#1e293b; padding:1px 4px; border-radius:3px;">U${dev?.topU || ''}</span>
      </div>
      <div class="context-menu-body" style="padding:4px 0;">
    `;

    if (hasFree && (cat.category === 'switch' || cat.category === 'fiber-switch' || cat.category === 'compact' || isPatch || cat.category === 'router')) {
      html += `<button class="context-menu-item" id="ctx-dev-autofill" style="display:flex; align-items:center; gap:8px; width:100%; padding:6px 12px; background:none; border:none; color:#e2e8f0; font-size:12px; text-align:left; cursor:pointer;">⚡ Boş Portları Otomatik Bağla (Auto-Fill)</button>`;
    }
    if (hasCables) {
      html += `<button class="context-menu-item" id="ctx-dev-color" style="display:flex; align-items:center; gap:8px; width:100%; padding:6px 12px; background:none; border:none; color:#e2e8f0; font-size:12px; text-align:left; cursor:pointer;">🎨 Kabloları Renklendir</button>`;
      html += `<button class="context-menu-item" id="ctx-dev-clear" style="display:flex; align-items:center; gap:8px; width:100%; padding:6px 12px; background:none; border:none; color:#e2e8f0; font-size:12px; text-align:left; cursor:pointer;">✂️ Tüm Kabloları Sök (${devCables.length} Kablo)</button>`;
    }
    if (isFinger) {
      html += `<button class="context-menu-item" id="ctx-dev-toggle-cover" style="display:flex; align-items:center; gap:8px; width:100%; padding:6px 12px; background:none; border:none; color:#e2e8f0; font-size:12px; text-align:left; cursor:pointer;">📂 Kanal Kapağını Aç/Kapat</button>`;
    }
    if (cat.category !== 'blank') {
      html += `<button class="context-menu-item" id="ctx-dev-config" style="display:flex; align-items:center; gap:8px; width:100%; padding:6px 12px; background:none; border:none; color:#e2e8f0; font-size:12px; text-align:left; cursor:pointer;">⚙️ Cihaz Bilgilerini Düzenle</button>`;
    }

    const delTitle = isBlank ? 'Kör Paneli Kaldır' : (isOrg ? 'Düzenleyiciyi Kaldır' : (isPatch ? 'Paneli Kaldır' : 'Cihazı Kaldır'));
    html += `
        <div style="height:1px; background:#334155; margin:4px 0;"></div>
        <button class="context-menu-item" id="ctx-dev-delete" style="display:flex; align-items:center; gap:8px; width:100%; padding:6px 12px; background:none; border:none; color:#ef4444; font-size:12px; text-align:left; cursor:pointer; font-weight:600;">🗑️ ${delTitle} (Sil)</button>
        <button class="context-menu-item" id="ctx-dev-cancel" style="display:flex; align-items:center; gap:8px; width:100%; padding:6px 12px; background:none; border:none; color:#94a3b8; font-size:11px; text-align:left; cursor:pointer;">✕ İptal</button>
      </div>
    `;

    menu.innerHTML = html;
    document.body.appendChild(menu);
    deviceContextMenuEl = menu;

    menu.querySelectorAll('.context-menu-item').forEach(btn => {
      btn.addEventListener('mouseenter', () => { btn.style.background = '#1e293b'; });
      btn.addEventListener('mouseleave', () => { btn.style.background = 'none'; });
    });

    const menuRect = menu.getBoundingClientRect();
    const left = Math.max(10, Math.min(window.innerWidth - menuRect.width - 10, clientX));
    const top = Math.max(10, Math.min(window.innerHeight - menuRect.height - 10, clientY));
    menu.style.position = 'fixed';
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    menu.style.zIndex = '1000';
    menu.style.background = '#0f172a';
    menu.style.border = '1px solid #334155';
    menu.style.borderRadius = '6px';
    menu.style.boxShadow = '0 8px 24px rgba(0,0,0,0.7)';

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
    else floatingControlsHideTimer = setTimeout(doHide, 150);
  }

  function updateDeviceFloatingControlsPosition(instanceId) {
    if (!deviceFloatingControlsEl || activeFloatingDeviceId !== instanceId) return;
    const viewportHost = document.getElementById('viewport-canvas');
    if (!viewportHost) return;
    const vRect = viewportHost.getBoundingClientRect();
    const devEl = document.getElementById(instanceId);
    let dRect = devEl ? devEl.getBoundingClientRect() : null;

    if (!dRect || dRect.width === 0) {
      const rec = RS.DeviceSceneRegistry?.getDeviceRecord?.(instanceId);
      if (rec) {
        const scale = Number(RS.ZOOM_STATE?.scale) || 1;
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
      const top = Math.round(dRect.top - vRect.top + 3);
      const right = Math.round(vRect.right - dRect.right + 18);
      deviceFloatingControlsEl.style.top = `${top}px`;
      deviceFloatingControlsEl.style.right = `${right}px`;
      deviceFloatingControlsEl.style.display = 'flex';
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
      const host = document.getElementById('viewport-canvas') || document.body;
      host.appendChild(deviceFloatingControlsEl);

      deviceFloatingControlsEl.addEventListener('mouseenter', () => {
        if (floatingControlsHideTimer) {
          clearTimeout(floatingControlsHideTimer);
          floatingControlsHideTimer = null;
        }
      });
      deviceFloatingControlsEl.addEventListener('mouseleave', () => {
        hideDeviceFloatingControls();
      });
    }

    activeFloatingDeviceId = instanceId;
    deviceFloatingControlsEl.dataset.instanceId = instanceId;

    let btns = '';
    if (hasFree && (isSwitch || isPatch || cat.category === 'router')) {
      btns += `<button type="button" class="dev-btn autofill-device-btn" data-instance-id="${instanceId}" title="Boş portları akıllıca bağla (Auto-Fill)">⚡</button>`;
    }
    if (hasCables) {
      btns += `<button type="button" class="dev-btn color-device-cables-btn" data-instance-id="${instanceId}" title="Cihazın tüm kablolarını renklendir">🎨</button>`;
      btns += `<button type="button" class="dev-btn clear-device-cables-btn" data-instance-id="${instanceId}" title="Kabloları temizle / sök">✂️</button>`;
    }
    if (isFinger) {
      btns += `<button type="button" class="dev-btn finger-toggle-btn" data-instance-id="${instanceId}" title="Kanal Kapağını Aç/Kapat">📂</button>`;
    }
    if (!isOrg && !isBlank) {
      btns += `<button type="button" class="dev-btn cfg-device-btn" data-instance-id="${instanceId}" title="Cihaz Ayarları & Bilgileri">⚙️</button>`;
    }
    const delTitle = isBlank ? 'Kör Paneli Kaldır' : (isOrg ? 'Düzenleyiciyi Kaldır' : (isPatch ? 'Paneli Kaldır' : 'Cihazı Kaldır'));
    btns += `<button type="button" class="dev-btn del-device-btn" data-instance-id="${instanceId}" title="${delTitle}">✕</button>`;
    deviceFloatingControlsEl.innerHTML = btns;

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
})();
