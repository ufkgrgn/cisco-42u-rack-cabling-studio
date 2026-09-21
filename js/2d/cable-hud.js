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
    if (!isOver || !targetU) return;
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
  }

  // Global keydown and click listeners for keyboard shortcuts & auto-dismiss
  if (typeof window !== 'undefined' && !window.__CABLE_INTERACTIONS_BOUND__) {
    window.__CABLE_INTERACTIONS_BOUND__ = true;

    document.addEventListener('click', (e) => {
      if (Date.now() - lastHudOpenTime < 250) {
        return;
      }
      if (e.target.closest('#cable-quick-hud') || e.target.closest('#cable-context-menu')) {
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
      if (quickHudEl || contextMenuEl || STATE.highlightedCableId) {
        hideCableQuickHud();
        hideCableContextMenu();
        highlightCable(null);
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        hideCableQuickHud();
        hideCableContextMenu();
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
        }
      }
    });
  }

  RS.showCableQuickHud = showCableQuickHud;
  RS.hideCableQuickHud = hideCableQuickHud;
  RS.showCableContextMenu = showCableContextMenu;
  RS.hideCableContextMenu = hideCableContextMenu;
  RS.highlightDropSlots = highlightDropSlots;
})();
