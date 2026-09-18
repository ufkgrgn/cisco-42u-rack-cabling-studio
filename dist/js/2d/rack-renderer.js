/**
 * Cisco Enterprise Rack & Cabling Studio - Rack Renderer Module
 */
(function () {
  'use strict';

  const RS = window.RackStudio = window.RackStudio || {};

  const STATE = RS.STATE;
  const dom = RS.dom;
  const HARDWARE_CATALOG = RS.HARDWARE_CATALOG;
  const ZOOM_STATE = RS.ZOOM_STATE;

  const getActiveRack = () => (RS.getActiveRack ? RS.getActiveRack() : RS.STATE?.racks?.[0]);
  const escapeHtml = (val) => RS.escapeHtml ? RS.escapeHtml(val) : String(val ?? '');
  const showTemporaryTooltip = (...args) => RS.showTemporaryTooltip && RS.showTemporaryTooltip(...args);
  const renderAllCables = () => RS.renderAllCables && RS.renderAllCables();
  const cancelPendingConnection = () => RS.cancelPendingConnection && RS.cancelPendingConnection();
  const highlightDropSlots = (...args) => RS.highlightDropSlots && RS.highlightDropSlots(...args);
  const highlightCable = (...args) => RS.highlightCable && RS.highlightCable(...args);
  const showCableQuickHud = (...args) => RS.showCableQuickHud && RS.showCableQuickHud(...args);
  const renderScheduleTable = () => RS.renderScheduleTable && RS.renderScheduleTable();
  const renderRackTabs = () => RS.renderRackTabs && RS.renderRackTabs();
  const switchActiveRack = (...args) => RS.switchActiveRack && RS.switchActiveRack(...args);
  const initDomReferences = () => RS.initDomReferences && RS.initDomReferences();
  const portKey = (instanceId, portId) => (RS.portKey ? RS.portKey(instanceId, portId) : JSON.stringify([instanceId, portId]));
  const getNextCableId = () => (RS.getNextCableId ? RS.getNextCableId() : 'cable-' + Date.now());
  let occupiedPortKeys = new Set();

function createRackUnitAndSlot(rack, u, clickHandler, isSingleOrActive) {
  const leftU = document.createElement('div');
  leftU.className = 'u-unit';
  leftU.innerHTML = `
    <div class="rack-holes">
      <div class="hole"></div>
      <div class="hole"></div>
      <div class="hole"></div>
    </div>
    <div class="u-label">${u}</div>
  `;

  const rightU = document.createElement('div');
  rightU.className = 'u-unit';
  rightU.innerHTML = `
    <div class="u-label">${u}</div>
    <div class="rack-holes">
      <div class="hole"></div>
      <div class="hole"></div>
      <div class="hole"></div>
    </div>
  `;

  const slot = document.createElement('div');
  slot.className = 'rack-slot';
  slot.dataset.u = u;
  slot.dataset.rackId = rack.id;
  slot.id = isSingleOrActive ? `rack-slot-u${u}` : `rack-${rack.id}-slot-u${u}`;

  // Single click: informs the user without mounting (prevents accidental placement during pan/click)
  slot.addEventListener('click', (e) => {
    if (e.target.closest('.mounted-device')) return;
    if (ZOOM_STATE.hasMoved || ZOOM_STATE.isPanning) return;
    if (STATE.selectedLibraryItem) {
      const item = HARDWARE_CATALOG[STATE.selectedLibraryItem];
      const name = item ? item.name : 'Donanım';
      showTemporaryTooltip(e.clientX, e.clientY, `[${name}] eklemek için [${rack.name}] U${u} yuvasına ÇİFT TIKLAYIN veya sürükleyip bırakın.`);
    }
  });

  // Double click: mounts the device safely
  slot.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    if (e.target.closest('.mounted-device')) return;
    if (ZOOM_STATE.hasMoved || ZOOM_STATE.isPanning) return;
    if (clickHandler) clickHandler(u, e, rack.id);
  });

  // Drag and drop support
  slot.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    const draggedDev = window.__RACK_DRAGGED_DEVICE__ || STATE.selectedLibraryItem;
    highlightDropSlots(u, draggedDev, true, rack.id);
  });

  slot.addEventListener('dragleave', (e) => {
    if (!slot.contains(e.relatedTarget)) {
      highlightDropSlots(u, null, false, rack.id);
    }
  });

  slot.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    highlightDropSlots(u, null, false, rack.id);
    const devId = e.dataTransfer.getData('application/x-rack-device') || 
                  e.dataTransfer.getData('text/plain') || 
                  window.__RACK_DRAGGED_DEVICE__ || 
                  STATE.selectedLibraryItem;
    window.__RACK_DRAGGED_DEVICE__ = null;
    if (!devId) return;
    if (typeof window.mountDeviceFromAction === 'function') {
      window.mountDeviceFromAction(devId, u, e, rack.id);
    }
  });

  return { leftU, rightU, slot };
}

// --- RACK MODULE ---

  /**
   * Injects two floating "+" buttons into the viewport canvas (parent of rack-stage)
   * so they sit beside the rack without being affected by the zoom/pan transform.
   * Buttons are absolutely positioned and use CSS transitions for a subtle hover reveal.
   */
  function _injectFloatingRackButtons(activeRack) {
    const canvas = dom.viewportCanvas || document.getElementById('viewport-canvas');
    if (!canvas) return;

    // Remove previously injected floating buttons
    canvas.querySelectorAll('.rack-float-add-btn').forEach(b => b.remove());

    function makeAddBtn(direction) {
      const btn = document.createElement('button');
      btn.className = 'rack-float-add-btn rack-float-add-' + direction;
      btn.title = direction === 'left' ? 'Sola Yeni Kabin Ekle' : 'Sağa Yeni Kabin Ekle';
      btn.textContent = '+';
      btn.addEventListener('click', () => {
        if (!RS.addNewRack) return;
        const newRack = RS.addNewRack();
        if (newRack && direction === 'left') {
          const newIdx = STATE.racks.findIndex(r => r.id === newRack.id);
          const activeIdx = STATE.racks.findIndex(r => r.id === activeRack.id);
          if (newIdx !== -1 && activeIdx !== -1) {
            STATE.racks.splice(newIdx, 1);
            const insertAt = STATE.racks.findIndex(r => r.id === activeRack.id);
            STATE.racks.splice(insertAt, 0, newRack);
            if (RS.renderRackTabs) RS.renderRackTabs();
          }
        }
        // Switch to multi mode so both racks are visible
        if (RS.setViewMode) {
          RS.setViewMode('multi');
        } else {
          STATE.viewMode = 'multi';
          const modeToggle = document.getElementById('btn-view-mode-multi') || document.getElementById('btn-view-multi');
          if (modeToggle) modeToggle.click();
          else renderRackRailsAndSlots(STATE.onSlotClick);
        }
      });
      return btn;
    }

    canvas.appendChild(makeAddBtn('left'));
    canvas.appendChild(makeAddBtn('right'));
  }

  /**
   * Binds pointer events on a rack's bottom resize handle to allow dragging to change U height (12U-60U).
   */
  function _bindRackResizeHandle(handleEl, rack) {
    if (!handleEl || !rack) return;
    let startY = 0;
    let startU = 0;
    let isDragging = false;

    const onPointerMove = (e) => {
      if (!isDragging) return;
      const deltaY = e.clientY - startY;
      const uHeightPx = 32 * (ZOOM_STATE.scale || 1);
      // Moving down increases U height, moving up decreases U height
      const deltaU = Math.round(deltaY / uHeightPx);
      const targetU = Math.max(12, Math.min(60, startU + deltaU));

      if (RS.showTemporaryTooltip) {
        RS.showTemporaryTooltip(e.clientX, e.clientY - 30, `📐 Kabin Boyutu: ${targetU}U (Bırakıldığında uygulanır)`);
      }
    };

    const onPointerUp = (e) => {
      if (!isDragging) return;
      isDragging = false;
      handleEl.classList.remove('active');
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);

      const deltaY = e.clientY - startY;
      const uHeightPx = 32 * (ZOOM_STATE.scale || 1);
      const deltaU = Math.round(deltaY / uHeightPx);
      const targetU = Math.max(12, Math.min(60, startU + deltaU));

      if (targetU !== startU && RS.resizeRackHeight) {
        RS.resizeRackHeight(rack.id, targetU);
      }
    };

    handleEl.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();
      isDragging = true;
      startY = e.clientY;
      startU = rack.heightU || 42;
      handleEl.classList.add('active');
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
    });
  }

  function getRackTelemetry(rack) {
    let totalWatts = 0;
    const devices = rack?.devices || [];
    devices.forEach(d => {
      const cat = (RS.catalog && RS.catalog[d.catalogId || d.catalogKey]) || 
                  (HARDWARE_CATALOG && HARDWARE_CATALOG[d.catalogKey]) || {};
      let w = 150;
      if (typeof d.powerWatts === 'number' && d.powerWatts > 0) {
        w = d.powerWatts;
      } else if (typeof cat.powerWatts === 'number') {
        w = cat.powerWatts;
      } else if (['organizer', 'blank', 'patch', 'passive', 'fiber'].includes(cat.category)) {
        w = 0;
      }
      totalWatts += w;
    });
    const totalAmps = Number((totalWatts / (230 * 0.95)).toFixed(1));
    const totalBtu = Math.round(totalWatts * 3.412142);
    const totalKw = (totalWatts / 1000).toFixed(2);
    const pduPercent = Math.min(100, Math.round((totalWatts / 3680) * 100));
    const isOverload = totalWatts > 3680 || totalAmps > 16.0;
    return { totalWatts, totalAmps, totalBtu, totalKw, pduPercent, isOverload };
  }
  RS.getRackTelemetry = getRackTelemetry;

  function updateRackHeaderTelemetry(targetRackId) {
    const plates = document.querySelectorAll('.rack-header-plate');
    plates.forEach(plate => {
      const rId = plate.dataset.rackId;
      if (targetRackId && rId !== targetRackId) return;
      const rack = STATE.racks?.find(r => r.id === rId);
      if (!rack) return;
      const telem = getRackTelemetry(rack);
      const devCount = rack.devices ? rack.devices.length : 0;
      const heightU = rack.heightU || 42;

      const pVal = plate.querySelector('.rack-telem-val-power');
      if (pVal) pVal.textContent = `${telem.totalWatts}W`;
      const aVal = plate.querySelector('.rack-telem-val-amp');
      if (aVal) aVal.textContent = `(${telem.totalAmps}A)`;
      const hVal = plate.querySelector('.rack-telem-val-heat');
      if (hVal) hVal.textContent = telem.totalBtu.toLocaleString();
      const pduVal = plate.querySelector('.rack-telem-val-pdu');
      if (pduVal) pduVal.textContent = `%${telem.pduPercent} PDU`;

      const powerBadge = plate.querySelector('.rack-telemetry-badge.power');
      if (powerBadge) powerBadge.classList.toggle('overload', telem.isOverload);
      const pduBadge = plate.querySelector('.rack-telemetry-badge.pdu');
      if (pduBadge) pduBadge.classList.toggle('overload', telem.isOverload);

      const uEl = plate.querySelector('.rack-header-u-count');
      if (uEl) uEl.textContent = `${heightU}U`;
      const devEl = plate.querySelector('.rack-header-dev-count');
      if (devEl) devEl.textContent = `${devCount} Cihaz`;
    });
  }
  RS.updateRackHeaderTelemetry = updateRackHeaderTelemetry;

  let rackVisibilityObserver = null;
  let rackVisibilityRefreshFrame = 0;

  function refreshVisibleRackContent(renderChanges = true) {
    if (STATE.viewMode !== 'multi') return false;
    const canvas = dom.viewportCanvas || document.getElementById('viewport-canvas');
    const rackStage = dom.rackStage || document.getElementById('rack-stage');
    if (!canvas || !rackStage) return false;
    const containers = Array.from(rackStage.querySelectorAll('.rack-container[data-rack-id]'));
    const viewportRect = canvas.getBoundingClientRect();
    const preloadMargin = Math.max(320, viewportRect.width * 0.3);
    let changed = false;
    containers.forEach(container => {
      const rect = container.getBoundingClientRect();
      const nearViewport = container.dataset.rackId === STATE.activeRackId || (
        rect.right >= viewportRect.left - preloadMargin &&
        rect.left <= viewportRect.right + preloadMargin &&
        rect.bottom >= viewportRect.top - preloadMargin &&
        rect.top <= viewportRect.bottom + preloadMargin
      );
      const next = nearViewport ? 'true' : 'false';
      if (container.dataset.virtualVisible !== next) {
        container.dataset.virtualVisible = next;
        changed = true;
      }
    });
    if (changed && renderChanges) {
      renderMountedDevices();
      if (typeof RS.renderAllCables === 'function') RS.renderAllCables();
    }
    return changed;
  }

  function configureMultiRackVisibility(rackStage, isMulti) {
    rackVisibilityObserver?.disconnect();
    rackVisibilityObserver = null;
    if (!isMulti) return;

    const canvas = dom.viewportCanvas || document.getElementById('viewport-canvas');
    const containers = Array.from(rackStage.querySelectorAll('.rack-container[data-rack-id]'));
    if (!canvas || !containers.length) return;

    const viewportRect = canvas.getBoundingClientRect();
    const preloadMargin = Math.max(320, viewportRect.width * 0.3);
    refreshVisibleRackContent(false);

    if (typeof IntersectionObserver !== 'function') {
      containers.forEach(container => { container.dataset.virtualVisible = 'true'; });
      return;
    }

    rackVisibilityObserver = new IntersectionObserver(entries => {
      let changed = false;
      entries.forEach(entry => {
        const next = entry.isIntersecting ? 'true' : 'false';
        if (entry.target.dataset.virtualVisible !== next) {
          entry.target.dataset.virtualVisible = next;
          changed = true;
        }
      });
      if (!changed || rackVisibilityRefreshFrame) return;
      rackVisibilityRefreshFrame = requestAnimationFrame(() => {
        rackVisibilityRefreshFrame = 0;
        renderMountedDevices();
        if (typeof RS.renderAllCables === 'function') RS.renderAllCables();
      });
    }, { root: canvas, rootMargin: `${Math.round(preloadMargin)}px` });
    containers.forEach(container => rackVisibilityObserver.observe(container));
  }

  function renderRackRailsAndSlots(onSlotClick) {
    if (typeof onSlotClick === 'function') STATE.onSlotClick = onSlotClick;
    const clickHandler = typeof onSlotClick === 'function' ? onSlotClick : STATE.onSlotClick;
    const rackStage = dom.rackStage || document.getElementById('rack-stage');
    if (!rackStage) return;

    const isMulti = STATE.viewMode === 'multi' && STATE.racks && STATE.racks.length > 1;
    rackStage.classList.toggle('multi-rack-stage', isMulti);

    if (!isMulti) {
      // SINGLE RACK FOCUS MODE — rack renders exactly as before, no controls inside
      const activeRack = getActiveRack() || STATE.racks?.[0];
      const heightU = activeRack?.heightU || 42;

      const canDelete = STATE.racks.length > 1;
      const devCount = activeRack.devices ? activeRack.devices.length : 0;
      const telem = getRackTelemetry(activeRack);

      rackStage.innerHTML = `
        <div class="rack-container" id="rack-container" data-rack-id="${activeRack.id}">
          <div class="rack-header-plate" data-rack-id="${activeRack.id}">
            <div class="rack-header-top-tier">
              <span class="rack-header-title">
                <svg width="13" height="13" fill="currentColor" viewBox="0 0 16 16"><path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v1.077a2.5 2.5 0 0 1-.95 1.956L4.5 6.786V14.5a.5.5 0 0 0 .5.5h6a.5.5 0 0 0 .5-.5V6.786l-1.55-1.253A2.5 2.5 0 0 1 9 3.577V2.5A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v11a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 13.5v-11z"/></svg>
                <span class="rack-header-name-editable" data-rack-id="${activeRack.id}" title="Adı düzenlemek için tıklayın">${escapeHtml(activeRack.name)}</span>
                <span class="rack-header-rename-hint" title="Adı düzenle">✏️</span>
              </span>
              <span class="rack-header-standard-badge" title="EIA-310-D Standart 19 İnç Kabin Çerçevesi">EIA-310-D Standard</span>
              <span class="rack-header-actions">
                <button class="rack-action-btn rack-hdr-clear-cables" data-rack-id="${activeRack.id}" title="Bu kabindeki tüm kabloları temizle / sök">🧹 Kablolar</button>
                <button class="rack-action-btn danger rack-hdr-clear-devices" data-rack-id="${activeRack.id}" title="Bu kabindeki tüm cihazları ve kablolarını boşalt">🗑️ Cihazlar</button>
                <button class="rack-action-btn rack-hdr-duplicate" data-rack-id="${activeRack.id}" title="Kabini ve Cihazlarını Çoğalt (Yeni Kabin)">⧉ Çoğalt</button>
                ${canDelete ? `<button class="rack-action-btn danger rack-hdr-delete" data-rack-id="${activeRack.id}" title="Kabini Sil">✕ Sil</button>` : ''}
              </span>
            </div>
            <div class="rack-header-bottom-tier">
              <div class="rack-header-meta-group">
                <span class="rack-header-meta rack-header-u-count">${heightU}U</span>
                <span class="rack-header-meta rack-header-dev-count">${devCount} Cihaz</span>
              </div>
              <div class="rack-header-telemetry-group">
                <span class="rack-telemetry-badge power ${telem.isOverload ? 'overload' : ''}" title="Kabin Güç Tüketimi (230V @ 0.95 PF)">
                  ⚡ <b class="rack-telem-val-power">${telem.totalWatts}W</b> <span class="rack-telem-val-amp" style="font-size:9.5px; opacity:0.85;">(${telem.totalAmps}A)</span>
                </span>
                <span class="rack-telemetry-badge heat" title="Kabin Termal Isı Yayılımı (~${(telem.totalWatts * 0.000293).toFixed(2)} Ton Soğutma)">
                  🔥 <b class="rack-telem-val-heat">${telem.totalBtu.toLocaleString()}</b> <span style="font-size:9.5px; opacity:0.85;">BTU/h</span>
                </span>
                <span class="rack-telemetry-badge pdu ${telem.isOverload ? 'overload' : ''}" title="16A PDU Sigorta Kapasitesi Kullanımı">
                  <span class="rack-telem-val-pdu">%${telem.pduPercent} PDU</span>
                </span>
              </div>
            </div>
          </div>
          <div class="rack-rail left" id="rail-left"></div>
          <div class="rack-main-space" id="rack-space"></div>
          <div class="rack-rail right" id="rail-right"></div>
          <div class="rack-resize-handle" id="rack-resize-handle" title="Kabin Yüksekliğini Ayarlamak İçin Sürükleyin (Alt Kenar)">
            <span class="rack-resize-grip"></span>
          </div>
          <svg class="cables-svg-layer" id="cables-svg" viewBox="0 0 618 ${heightU * 32}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <filter id="cable-shadow" x="-10%" y="-10%" width="120%" height="120%">
                <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.6"/>
              </filter>
            </defs>
            <g id="cables-group"></g>
            <g id="connectors-group"></g>
            <g id="dring-overlay-group"></g>
          </svg>
        </div>
      `;
      initDomReferences();
      configureMultiRackVisibility(rackStage, false);
      if (!dom.railLeft || !dom.railRight || !dom.rackSpace) return;

      // Wire bottom resize handle for single rack
      const resizeHandle = document.getElementById('rack-resize-handle');
      if (resizeHandle) {
        _bindRackResizeHandle(resizeHandle, activeRack);
      }

      // Wire header actions for single rack
      const sHdr = rackStage.querySelector('.rack-header-plate');
      if (sHdr) {
        const nameEl = sHdr.querySelector('.rack-header-name-editable');
        if (nameEl) {
          nameEl.addEventListener('click', (e) => {
            e.stopPropagation();
            const current = activeRack.name;
            nameEl.setAttribute('contenteditable', 'true');
            nameEl.focus();
            const range = document.createRange();
            range.selectNodeContents(nameEl);
            window.getSelection().removeAllRanges();
            window.getSelection().addRange(range);
            const commit = () => {
              nameEl.removeAttribute('contenteditable');
              const newName = nameEl.textContent.trim();
              if (newName && newName !== current) {
                activeRack.name = newName;
                if (RS.renderRackTabs) RS.renderRackTabs();
                if (RS.renderScheduleTable) RS.renderScheduleTable();
                document.dispatchEvent(new CustomEvent('rackstudio:change', { bubbles: true, detail: { immediate: true } }));
              } else {
                nameEl.textContent = current;
              }
            };
            nameEl.addEventListener('blur', commit, { once: true });
            nameEl.addEventListener('keydown', (ev) => {
              if (ev.key === 'Enter') { ev.preventDefault(); nameEl.blur(); }
              if (ev.key === 'Escape') { nameEl.textContent = current; nameEl.removeAttribute('contenteditable'); nameEl.blur(); }
            }, { once: true });
          });
        }
        const clearCablesBtn = sHdr.querySelector('.rack-hdr-clear-cables');
        if (clearCablesBtn) {
          clearCablesBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            clearRackCables(activeRack.id, clearCablesBtn);
          });
        }
        const clearDevsBtn = sHdr.querySelector('.rack-hdr-clear-devices');
        if (clearDevsBtn) {
          clearDevsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            clearRackDevices(activeRack.id, clearDevsBtn);
          });
        }
        const delBtn = sHdr.querySelector('.rack-hdr-delete');
        if (delBtn) {
          delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (RS.deleteRack) RS.deleteRack(activeRack.id);
          });
        }
        const dupBtn = sHdr.querySelector('.rack-hdr-duplicate');
        if (dupBtn) {
          dupBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (RS.duplicateRack) RS.duplicateRack(activeRack.id);
          });
        }
      }

      // Inject floating + buttons into the viewport canvas (NOT the scaled rack-stage)
      // so they are unaffected by zoom/pan transforms and stay visually beside the rack.
      _injectFloatingRackButtons(activeRack);

      for (let u = heightU; u >= 1; u--) {
        const { leftU, rightU, slot } = createRackUnitAndSlot(activeRack, u, clickHandler, true);
        dom.railLeft.appendChild(leftU);
        dom.railRight.appendChild(rightU);
        dom.rackSpace.appendChild(slot);
      }
    } else {
      // MULTI-RACK (SIDE-BY-SIDE) MODE
      rackStage.innerHTML = '';

      const numRacks = STATE.racks.length;
      const maxU = Math.max(...STATE.racks.map(r => r.heightU || 42));
      const baseW = numRacks * 634 + (numRacks - 1) * 64 + 120;
      const baseH = maxU * 32 + 156;

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'cables-svg-layer');
      svg.setAttribute('id', 'cables-svg');
      svg.setAttribute('preserveAspectRatio', 'none');
      svg.setAttribute('viewBox', `0 0 ${baseW} ${baseH}`);
      svg.innerHTML = `
        <defs>
          <filter id="cable-shadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.6"/>
          </filter>
        </defs>
        <g id="cables-group"></g>
        <g id="connectors-group"></g>
        <g id="dring-overlay-group"></g>
      `;
      rackStage.appendChild(svg);

      STATE.racks.forEach((rack) => {
        const isAct = rack.id === STATE.activeRackId;
        const cont = document.createElement('div');
        cont.className = `rack-container ${isAct ? 'active-rack-target' : ''}`;
        cont.dataset.rackId = rack.id;
        cont.id = `rack-container-${rack.id}`;

        const canDelete = STATE.racks.length > 1;
        const devCount = rack.devices ? rack.devices.length : 0;

        const telem = getRackTelemetry(rack);

        const headerPlate = document.createElement('div');
        headerPlate.className = 'rack-header-plate';
        headerPlate.dataset.rackId = rack.id;
        headerPlate.innerHTML = `
          <div class="rack-header-top-tier">
            <span class="rack-header-title">
              <svg width="13" height="13" fill="currentColor" viewBox="0 0 16 16"><path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v1.077a2.5 2.5 0 0 1-.95 1.956L4.5 6.786V14.5a.5.5 0 0 0 .5.5h6a.5.5 0 0 0 .5-.5V6.786l-1.55-1.253A2.5 2.5 0 0 1 9 3.577V2.5A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v11a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 13.5v-11z"/></svg>
              <span class="rack-header-name-editable" data-rack-id="${rack.id}" title="Adı düzenlemek için tıklayın">${escapeHtml(rack.name)}</span>
              <span class="rack-header-rename-hint" title="Adı düzenle">✏️</span>
            </span>
            <span class="rack-header-standard-badge" title="EIA-310-D Standart 19 İnç Kabin Çerçevesi">EIA-310-D Standard</span>
            <span class="rack-header-actions">
              <button class="rack-action-btn rack-hdr-move-left" data-rack-id="${rack.id}" title="Kabini Sola Taşı">←</button>
              <button class="rack-action-btn rack-hdr-move-right" data-rack-id="${rack.id}" title="Kabini Sağa Taşı">→</button>
              <button class="rack-action-btn rack-hdr-clear-cables" data-rack-id="${rack.id}" title="Bu kabindeki tüm kabloları temizle / sök">🧹 Kablolar</button>
              <button class="rack-action-btn danger rack-hdr-clear-devices" data-rack-id="${rack.id}" title="Bu kabindeki tüm cihazları ve kablolarını boşalt">🗑️ Cihazlar</button>
              <button class="rack-action-btn rack-hdr-duplicate" data-rack-id="${rack.id}" title="Kabini ve Cihazlarını Çoğalt">⧉ Çoğalt</button>
              ${canDelete ? `<button class="rack-action-btn danger rack-hdr-delete" data-rack-id="${rack.id}" title="Kabini Sil">✕ Sil</button>` : ''}
            </span>
          </div>
          <div class="rack-header-bottom-tier">
            <div class="rack-header-meta-group">
              <span class="rack-header-meta rack-header-u-count">${rack.heightU || 42}U</span>
              <span class="rack-header-meta rack-header-dev-count">${devCount} Cihaz</span>
            </div>
            <div class="rack-header-telemetry-group">
              <span class="rack-telemetry-badge power ${telem.isOverload ? 'overload' : ''}" title="Kabin Güç Tüketimi (230V @ 0.95 PF)">
                ⚡ <b class="rack-telem-val-power">${telem.totalWatts}W</b> <span class="rack-telem-val-amp" style="font-size:9.5px; opacity:0.85;">(${telem.totalAmps}A)</span>
              </span>
              <span class="rack-telemetry-badge heat" title="Kabin Termal Isı Yayılımı (~${(telem.totalWatts * 0.000293).toFixed(2)} Ton Soğutma)">
                🔥 <b class="rack-telem-val-heat">${telem.totalBtu.toLocaleString()}</b> <span style="font-size:9.5px; opacity:0.85;">BTU/h</span>
              </span>
              <span class="rack-telemetry-badge pdu ${telem.isOverload ? 'overload' : ''}" title="16A PDU Sigorta Kapasitesi Kullanımı">
                <span class="rack-telem-val-pdu">%${telem.pduPercent} PDU</span>
              </span>
            </div>
          </div>
        `;
        cont.appendChild(headerPlate);

        // Header action handlers
        const moveLeftBtn = headerPlate.querySelector('.rack-hdr-move-left');
        if (moveLeftBtn) {
          moveLeftBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (RS.moveRackOrder) RS.moveRackOrder(rack.id, -1);
          });
        }
        const moveRightBtn = headerPlate.querySelector('.rack-hdr-move-right');
        if (moveRightBtn) {
          moveRightBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (RS.moveRackOrder) RS.moveRackOrder(rack.id, 1);
          });
        }
        const clearCablesBtn = headerPlate.querySelector('.rack-hdr-clear-cables');
        if (clearCablesBtn) {
          clearCablesBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            clearRackCables(rack.id, clearCablesBtn);
          });
        }
        const clearDevsBtn = headerPlate.querySelector('.rack-hdr-clear-devices');
        if (clearDevsBtn) {
          clearDevsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            clearRackDevices(rack.id, clearDevsBtn);
          });
        }
        const dupBtn = headerPlate.querySelector('.rack-hdr-duplicate');
        if (dupBtn) {
          dupBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (RS.duplicateRack) RS.duplicateRack(rack.id);
          });
        }

        // Inline rename on header name click
        const nameEl = headerPlate.querySelector('.rack-header-name-editable');
        if (nameEl) {
          nameEl.addEventListener('click', (e) => {
            e.stopPropagation();
            const current = rack.name;
            nameEl.setAttribute('contenteditable', 'true');
            nameEl.focus();
            const range = document.createRange();
            range.selectNodeContents(nameEl);
            window.getSelection().removeAllRanges();
            window.getSelection().addRange(range);
            const commit = () => {
              nameEl.removeAttribute('contenteditable');
              const newName = nameEl.textContent.trim();
              if (newName && newName !== current) {
                rack.name = newName;
                if (RS.renderRackTabs) RS.renderRackTabs();
                if (RS.renderScheduleTable) RS.renderScheduleTable();
                document.dispatchEvent(new CustomEvent('rackstudio:change', { bubbles: true, detail: { immediate: true } }));
              } else {
                nameEl.textContent = current;
              }
            };
            nameEl.addEventListener('blur', commit, { once: true });
            nameEl.addEventListener('keydown', (ev) => {
              if (ev.key === 'Enter') { ev.preventDefault(); nameEl.blur(); }
              if (ev.key === 'Escape') { nameEl.textContent = current; nameEl.removeAttribute('contenteditable'); nameEl.blur(); }
            }, { once: true });
          });
        }

        // Delete button handler
        const delBtn = headerPlate.querySelector('.rack-hdr-delete');
        if (delBtn) {
          delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (RS.deleteRack) RS.deleteRack(rack.id);
          });
        }

        cont.addEventListener('click', (e) => {
          if (e.target.closest('.port') || e.target.closest('.dev-btn') || e.target.closest('.rack-header-plate')) return;
          if (STATE.activeRackId !== rack.id) {
            switchActiveRack(rack.id);
          }
        });

        const railL = document.createElement('div');
        railL.className = 'rack-rail left';
        railL.id = `rack-${rack.id}-rail-left`;
        cont.appendChild(railL);

        const space = document.createElement('div');
        space.className = 'rack-main-space';
        space.id = `rack-${rack.id}-space`;
        cont.appendChild(space);

        const railR = document.createElement('div');
        railR.className = 'rack-rail right';
        railR.id = `rack-${rack.id}-rail-right`;
        cont.appendChild(railR);

        // Bottom resize handle for multi rack container
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'rack-resize-handle';
        resizeHandle.title = 'Kabin Yüksekliğini Ayarlamak İçin Sürükleyin (Alt Kenar)';
        resizeHandle.innerHTML = '<span class="rack-resize-grip"></span>';
        cont.appendChild(resizeHandle);
        _bindRackResizeHandle(resizeHandle, rack);

        const rHeightU = rack.heightU || 42;
        for (let u = rHeightU; u >= 1; u--) {
          const { leftU, rightU, slot } = createRackUnitAndSlot(rack, u, clickHandler, false);
          railL.appendChild(leftU);
          railR.appendChild(rightU);
          space.appendChild(slot);
        }

        rackStage.appendChild(cont);
      });

      initDomReferences();
      configureMultiRackVisibility(rackStage, true);
    }
  }

  function mountDeviceAt(catalogKey, topU, targetRackId) {
    const cat = Object.hasOwn(HARDWARE_CATALOG, catalogKey) ? HARDWARE_CATALOG[catalogKey] : null;
    if (!cat) return null;
    const targetRack = targetRackId ? STATE.racks.find(r => r.id === targetRackId) : getActiveRack();
    if (!targetRack) return null;

    const endU = topU - cat.u + 1;
    if (!Number.isInteger(topU) || !Number.isInteger(cat.u) || cat.u < 1 || endU < 1 || topU > (targetRack.heightU || 42)) return null;
    if (targetRack.devices.some(d => topU >= d.topU - d.uHeight + 1 && endU <= d.topU)) return null;
    const instanceId = 'dev-' + Math.random().toString(36).substring(2, 9);
    for (let u = endU; u <= topU; u++) {
      targetRack.units[u] = instanceId;
    }
    const devObj = {
      instanceId,
      catalogKey,
      topU,
      uHeight: cat.u
    };
    targetRack.devices.push(devObj);
    if (window.SoundFX) window.SoundFX.playDeviceMount();
    return devObj;
  }

  function removeDevice(instanceId) {
    const targetRack = (STATE.racks && STATE.racks.find(r => r.devices && r.devices.some(d => d.instanceId === instanceId))) || getActiveRack();
    if (!targetRack) return;

    if (window.SoundFX) window.SoundFX.playCableCut();
    STATE.cables = (STATE.cables || []).filter(c => c.from?.instanceId !== instanceId && c.to?.instanceId !== instanceId);

    if (targetRack.devices) {
      targetRack.devices = targetRack.devices.filter(d => d.instanceId !== instanceId);
      targetRack.units = Array((targetRack.heightU || 42) + 1).fill(null);
      targetRack.devices.forEach(d => {
        for (let u = d.topU - d.uHeight + 1; u <= d.topU; u++) {
          if (u > 0 && u <= (targetRack.heightU || 42)) {
            targetRack.units[u] = d.instanceId;
          }
        }
      });
    }

    if (STATE.pendingConnection && STATE.pendingConnection.instanceId === instanceId) {
      cancelPendingConnection();
    }

    renderRackTabs();
    renderMountedDevices();
    renderScheduleTable();
    renderAllCables();

    if (window.__STUDIO3D__ && window.is3DMode && typeof window.__STUDIO3D__.removeDevice === 'function') {
      try { window.__STUDIO3D__.removeDevice(instanceId); } catch (_) {}
    }

    // CRITICAL: Dispatch change & refresh events for persistence (editor.js, indexedDB, localStorage)
    document.dispatchEvent(new CustomEvent('rackstudio:change', { bubbles: true, detail: { immediate: true } }));
    document.dispatchEvent(new CustomEvent('rackstudio:refresh', { bubbles: true }));
    window.dispatchEvent(new CustomEvent('rackstudio:change', { detail: { immediate: true } }));
    window.dispatchEvent(new CustomEvent('rackstudio:refresh'));
  }

  function updateDeviceMetadata(instanceId, metadata) {
    const rack = STATE.racks.find(item => item.devices.some(dev => dev.instanceId === instanceId));
    const dev = rack && rack.devices.find(item => item.instanceId === instanceId);
    if (!dev) return false;
    dev.name = String(metadata.name || '').trim();
    dev.hostname = dev.name;
    dev.ipAddress = String(metadata.ipAddress || '').trim();
    dev.macAddress = String(metadata.macAddress || '').trim();
    dev.serialNumber = String(metadata.serialNumber || '').trim();
    dev.panelLabel = String(metadata.panelLabel || '').trim();
    renderMountedDevices();
    renderScheduleTable();
    renderAllCables();
    window.dispatchEvent(new CustomEvent('rackstudio:refresh'));
    return true;
  }

  function clearRackCables(rackId, targetBtn) {
    const rack = (STATE.racks && STATE.racks.find(r => r.id === rackId)) || getActiveRack();
    if (!rack) return;
    const devIds = new Set((rack.devices || []).map(d => d.instanceId));
    const rackCables = (STATE.cables || []).filter(c => devIds.has(c.from?.instanceId) || devIds.has(c.to?.instanceId));
    if (rackCables.length === 0) {
      if (targetBtn) {
        const rect = targetBtn.getBoundingClientRect();
        showTemporaryTooltip(rect.left, rect.bottom + 10, `[${rack.name}] kabininde bağlı kablo bulunmuyor.`);
      } else {
        alert(`[${rack.name}] kabininde bağlı kablo bulunmuyor.`);
      }
      return;
    }

    const doClear = () => {
      if (window.SoundFX) window.SoundFX.playCableCut();
      STATE.cables = (STATE.cables || []).filter(c => !devIds.has(c.from?.instanceId) && !devIds.has(c.to?.instanceId));
      if (STATE.pendingConnection && devIds.has(STATE.pendingConnection.instanceId)) {
        cancelPendingConnection();
      }
      renderMountedDevices();
      renderScheduleTable();
      renderAllCables();
      updateRackHeaderTelemetry(rack.id);
      document.dispatchEvent(new CustomEvent('rackstudio:change', { bubbles: true, detail: { immediate: true } }));
      document.dispatchEvent(new CustomEvent('rackstudio:refresh', { bubbles: true }));
    };

    if (targetBtn) {
      showInlineDeleteConfirm(targetBtn, rack.name, {
        title: '🧹 KABLO TEMİZLE?',
        msg: `<strong>${escapeHtml(rack.name)}</strong> kabinine bağlı <strong>${rackCables.length} adet kablo</strong> sökülecektir.`,
        confirmText: '🧹 Kabloları Sil'
      }, doClear);
    } else {
      if (confirm(`[${rack.name}] kabinindeki ${rackCables.length} adet kablo silinsin mi?`)) {
        doClear();
      }
    }
  }

  function clearRackDevices(rackId, targetBtn) {
    const rack = (STATE.racks && STATE.racks.find(r => r.id === rackId)) || getActiveRack();
    if (!rack) return;
    const devCount = (rack.devices || []).length;
    if (devCount === 0) {
      if (targetBtn) {
        const rect = targetBtn.getBoundingClientRect();
        showTemporaryTooltip(rect.left, rect.bottom + 10, `[${rack.name}] kabininde takılı cihaz bulunmuyor.`);
      } else {
        alert(`[${rack.name}] kabininde takılı cihaz bulunmuyor.`);
      }
      return;
    }

    const doClear = () => {
      if (window.SoundFX) window.SoundFX.playCableCut();
      const devIds = new Set(rack.devices.map(d => d.instanceId));
      STATE.cables = (STATE.cables || []).filter(c => !devIds.has(c.from?.instanceId) && !devIds.has(c.to?.instanceId));
      if (STATE.pendingConnection && devIds.has(STATE.pendingConnection.instanceId)) {
        cancelPendingConnection();
      }
      if (window.__STUDIO3D__ && window.is3DMode && typeof window.__STUDIO3D__.removeDevice === 'function') {
        devIds.forEach(id => {
          try { window.__STUDIO3D__.removeDevice(id); } catch (_) {}
        });
      }
      rack.devices = [];
      rack.units = Array((rack.heightU || 42) + 1).fill(null);
      renderRackTabs();
      renderMountedDevices();
      renderScheduleTable();
      renderAllCables();
      updateRackHeaderTelemetry(rack.id);
      document.dispatchEvent(new CustomEvent('rackstudio:change', { bubbles: true, detail: { immediate: true } }));
      document.dispatchEvent(new CustomEvent('rackstudio:refresh', { bubbles: true }));
    };

    if (targetBtn) {
      showInlineDeleteConfirm(targetBtn, rack.name, {
        title: '🗑️ CİHAZLARI BOŞALT?',
        msg: `<strong>${escapeHtml(rack.name)}</strong> kabinindeki <strong>${devCount} adet cihaz</strong> ve tüm kablolar kaldırılacaktır.<br><small style="color:#94a3b8;">(Kabin boşaltılacak, kabin çerçevesi silinmeyecektir)</small>`,
        confirmText: '🗑️ Cihazları Boşalt'
      }, doClear);
    } else {
      if (confirm(`[${rack.name}] kabinindeki ${devCount} adet cihaz ve bunlara bağlı tüm kablolar kaldırılsın mı?\n(Kabin boşaltılacak, kabin silinmeyecektir)`)) {
        doClear();
      }
    }
  }

  function clearDeviceCables(instanceId, targetBtn) {
    const devCables = (STATE.cables || []).filter(c => c.from?.instanceId === instanceId || c.to?.instanceId === instanceId);
    if (devCables.length === 0) return;
    const rack = STATE.racks?.find(r => r.devices && r.devices.some(d => d.instanceId === instanceId));
    const dev = rack?.devices?.find(d => d.instanceId === instanceId);
    const cat = dev ? (HARDWARE_CATALOG[dev.catalogKey] || {}) : {};
    const isPanel = cat.category === 'patch' || cat.category === 'fiber';
    const devName = dev?.hostname || dev?.name || dev?.panelLabel || cat.name || (isPanel ? 'Patch Panel' : 'Cihaz');

    const doClear = () => {
      if (window.SoundFX) window.SoundFX.playCableCut();
      STATE.cables = (STATE.cables || []).filter(c => c.from?.instanceId !== instanceId && c.to?.instanceId !== instanceId);
      if (STATE.pendingConnection && STATE.pendingConnection.instanceId === instanceId) {
        cancelPendingConnection();
      }
      renderMountedDevices();
      renderScheduleTable();
      renderAllCables();
      updateRackHeaderTelemetry(rack?.id);
      document.dispatchEvent(new CustomEvent('rackstudio:change', { bubbles: true, detail: { immediate: true } }));
      document.dispatchEvent(new CustomEvent('rackstudio:refresh', { bubbles: true }));
    };

    if (targetBtn) {
      showInlineDeleteConfirm(targetBtn, devName, {
        title: '✂️ KABLOLARI TEMİZLE?',
        msg: `<strong>${escapeHtml(devName)}</strong> üzerindeki <strong>${devCables.length} adet kablo</strong> sökülecektir.`,
        confirmText: '✂️ Kabloları Sök'
      }, doClear);
    } else {
      if (confirm(`[${devName}] üzerindeki ${devCables.length} adet kablo sökülsün mü?`)) {
        doClear();
      }
    }
  }

  function showInlineDeleteConfirm(targetBtn, deviceName, optionsOrConfirm, maybeConfirm) {
    const onConfirm = typeof optionsOrConfirm === 'function' ? optionsOrConfirm : maybeConfirm;
    const options = typeof optionsOrConfirm === 'object' && optionsOrConfirm !== null ? optionsOrConfirm : {};

    document.querySelectorAll('.inline-delete-popover').forEach(el => el.remove());

    const popover = document.createElement('div');
    popover.className = 'inline-delete-popover';

    let title = options.title || '⚠️ CİHAZI SİL?';
    let msg = options.msg || `<strong>${escapeHtml(deviceName)}</strong> ve bağlı tüm kablolar kaldırılacaktır.`;
    let confirmText = options.confirmText || '✕ Sil';

    if (!options.title && !options.msg) {
      if (options.category === 'organizer') {
        title = '🗑️ DÜZENLEYİCİYİ KALDIR?';
        msg = `<strong>${escapeHtml(deviceName)}</strong> kabin yuvasından kaldırılacaktır.`;
      } else if (options.category === 'blank') {
        title = '🗑️ KÖR PANELİ KALDIR?';
        msg = `<strong>${escapeHtml(deviceName)}</strong> kabin yuvasından kaldırılacaktır.`;
      } else if (typeof options.cableCount === 'number') {
        if (options.cableCount > 0) {
          title = '⚠️ CİHAZI SİL?';
          msg = `<strong>${escapeHtml(deviceName)}</strong> ve bu cihaza bağlı <strong>${options.cableCount} kablo</strong> sökülecektir.`;
        } else {
          title = '⚠️ CİHAZI SİL?';
          msg = `<strong>${escapeHtml(deviceName)}</strong> kabinden kaldırılacaktır (bağlı kablo yok).`;
        }
      }
    }

    popover.innerHTML = `
      <div class="inline-delete-title">${title}</div>
      <div class="inline-delete-msg">${msg}</div>
      <div class="inline-delete-actions">
        <button type="button" class="inline-del-btn-cancel">İptal</button>
        <button type="button" class="inline-del-btn-confirm">${escapeHtml(confirmText)}</button>
      </div>
    `;

    document.body.appendChild(popover);

    const rect = targetBtn.getBoundingClientRect();
    const popoverWidth = 240;
    const popoverHeight = 110;

    let left = rect.left - popoverWidth - 8;
    let top = rect.top + (rect.height / 2) - (popoverHeight / 2);
    if (left < 10 || top < 20) {
      left = Math.min(Math.max(10, rect.left - popoverWidth / 2 + rect.width / 2), window.innerWidth - popoverWidth - 10);
      top = rect.bottom + 6;
    }
    if (top + popoverHeight > window.innerHeight - 10) {
      top = Math.max(10, rect.top - popoverHeight - 6);
    }

    popover.style.left = `${Math.round(left)}px`;
    popover.style.top = `${Math.round(top)}px`;

    const close = () => {
      popover.remove();
      document.removeEventListener('click', onOutsideClick);
      document.removeEventListener('keydown', onKeyDown);
    };

    const onOutsideClick = (e) => {
      if (!popover.contains(e.target) && e.target !== targetBtn) {
        close();
      }
    };

    const onKeyDown = (e) => {
      if (e.key === 'Escape') close();
      if (e.key === 'Enter') {
        close();
        onConfirm();
      }
    };

    popover.querySelector('.inline-del-btn-confirm').addEventListener('click', (e) => {
      e.stopPropagation();
      close();
      onConfirm();
    });

    popover.querySelector('.inline-del-btn-cancel').addEventListener('click', (e) => {
      e.stopPropagation();
      close();
    });

    setTimeout(() => {
      document.addEventListener('click', onOutsideClick);
      document.addEventListener('keydown', onKeyDown);
    }, 20);
  }

  function showConnectionErrorToast(x, y, msg) {
    document.querySelectorAll('.connection-error-toast').forEach(el => el.remove());

    const toast = document.createElement('div');
    toast.className = 'connection-error-toast';
    toast.innerHTML = `
      <div class="error-toast-icon">⛔</div>
      <div class="error-toast-body">
        <div class="error-toast-title">BAĞLANTI ENGELLENDİ</div>
        <div class="error-toast-msg">${escapeHtml(msg)}</div>
      </div>
      <button type="button" class="error-toast-close" title="Kapat">✕</button>
    `;

    document.body.appendChild(toast);

    const toastWidth = 320;
    const toastHeight = 70;
    let left = x - (toastWidth / 2);
    let top = y - toastHeight - 12;

    if (left < 10) left = 10;
    if (left + toastWidth > window.innerWidth - 10) left = window.innerWidth - toastWidth - 10;
    if (top < 10) top = y + 25;

    toast.style.left = `${left}px`;
    toast.style.top = `${top}px`;

    const close = () => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-6px)';
      setTimeout(() => toast.remove(), 200);
    };

    toast.querySelector('.error-toast-close').addEventListener('click', close);

    setTimeout(() => {
      if (toast.isConnected) close();
    }, 4500);
  }

  function showUplinkVisualConfirmModal(options, onDecision) {
    document.querySelectorAll('.uplink-modal-backdrop').forEach(el => el.remove());

    const backdrop = document.createElement('div');
    backdrop.className = 'uplink-modal-backdrop';

    const isSwitchToSwitch = !!(options.isSwitchToSwitch || options.disallowStandard);
    const roleName = (options.role || (isSwitchToSwitch ? 'trunk' : 'uplink')).toUpperCase();
    const isUplink = options.role === 'uplink';
    const roleColor = options.color || (isSwitchToSwitch ? '#7c3aed' : (isUplink ? '#00d2ff' : '#7c3aed'));

    const headerBadgeHtml = isSwitchToSwitch
      ? `<span style="font-size:15px;">⚡</span> SWİTCHLER ARASI BAĞLANTI (802.1Q TRUNK / ACCESS)`
      : `<span style="font-size:14px;">⚡</span> OTOMATİK ${roleName} / TRUNK ALGILANDI`;

    const descriptionHtml = isSwitchToSwitch
      ? `İki switch arasında doğrudan bağlantı algılandı. Ağ omurga bütünlüğü ve STP performansı için <b>802.1Q TRUNK</b> önerilir. İsteğe bağlı olarak standart Access bağlantısı da kurulabilir.`
      : `${escapeHtml(options.reason || 'İki switch / omurga portu arasında doğrudan bağlantı algılandı.')} Bu bağlantının ağ rolünü otomatik olarak tanımlamak istiyor musunuz?`;

    const choiceCardsHtml = isSwitchToSwitch
      ? `
        <div class="uplink-choice-card recommended" id="opt-uplink-recommend" style="border-color: rgba(124, 58, 237, 0.65); background: linear-gradient(180deg, rgba(124, 58, 237, 0.16) 0%, rgba(15, 23, 42, 0.9) 100%);">
          <span class="choice-tag" style="background: rgba(124, 58, 237, 0.25); color: #c084fc; border: 1px solid rgba(124, 58, 237, 0.5);">ÖNERİLEN OMURGA STANDARDI</span>
          <div class="choice-title" style="color:#c084fc;">✨ 802.1Q TRUNK Olarak Yapılandır</div>
          <div class="choice-desc">
            Tüm VLAN trafiği güvenle taşınır, STP / Loop koruması aktif tutulur, omurga portu rozeti atanır ve mor/neon kablo rengi uygulanır.
          </div>
        </div>
        <div class="uplink-choice-card" id="opt-uplink-standard">
          <span class="choice-tag gray">MANUEL / ACCESS</span>
          <div class="choice-title">Standart Access Olarak Bağla</div>
          <div class="choice-desc">
            Özel omurga rolü atanmaz; mevcut seçili kablo rengi ve standart erişim portu ayarları korunur.
          </div>
        </div>
      `
      : `
        <div class="uplink-choice-card recommended" id="opt-uplink-recommend">
          <span class="choice-tag cyan">ÖNERİLEN STANDART</span>
          <div class="choice-title" style="color:${roleColor};">✨ Otomatik ${roleName} Ata</div>
          <div class="choice-desc">
            802.1Q omurga port rozeti atanır, kablo ${roleName === 'UPLINK' ? 'Neon Cyan' : 'Mor'} rengine bürünür ve port konfigürasyonu kaydedilir.
          </div>
        </div>
        <div class="uplink-choice-card" id="opt-uplink-standard">
          <span class="choice-tag gray">MANUEL / ACCESS</span>
          <div class="choice-title">Standart Kablo Olarak Bağla</div>
          <div class="choice-desc">
            Özel rol veya rozet atanmaz, mevcut seçili kablo rengi ve standart erişim portu ayarları korunur.
          </div>
        </div>
      `;

    const footerButtonsHtml = isSwitchToSwitch
      ? `
        <button type="button" class="btn-secondary" id="btn-uplink-cancel">İptal</button>
        <button type="button" class="btn-secondary" id="btn-uplink-standard">Standart Access Olarak Bağla</button>
        <button type="button" class="btn-primary" id="btn-uplink-approve" style="background: linear-gradient(135deg, #7c3aed, #6d28d9); border-color: #a855f7; box-shadow: 0 2px 14px rgba(124, 58, 237, 0.5);">✨ 802.1Q TRUNK Olarak Yapılandır</button>
      `
      : `
        <button type="button" class="btn-secondary" id="btn-uplink-cancel">İptal</button>
        <button type="button" class="btn-secondary" id="btn-uplink-standard">Standart Kablo Olarak Bağla</button>
        <button type="button" class="btn-primary" id="btn-uplink-approve">✨ ${roleName} Olarak Yapılandır</button>
      `;

    backdrop.innerHTML = `
      <div class="uplink-modal-card" role="dialog" aria-modal="true">
        <div class="uplink-modal-header" style="${isSwitchToSwitch ? 'background: rgba(45, 20, 60, 0.6);' : ''}">
          <div class="header-badge" style="${isSwitchToSwitch ? 'color: #c084fc;' : ''}">
            ${headerBadgeHtml}
          </div>
          <button type="button" class="close-btn" title="Kapat (İptal)">✕</button>
        </div>
        <div class="uplink-modal-body">
          <div class="uplink-connection-strip">
            <span>${escapeHtml(options.srcDeviceName)} (${escapeHtml(options.srcPortName)})</span>
            <span class="arrow" style="${isSwitchToSwitch ? 'color: #c084fc;' : ''}">➔</span>
            <span>${escapeHtml(options.tgtDeviceName)} (${escapeHtml(options.tgtPortName)})</span>
          </div>
          <p class="uplink-modal-desc">
            ${descriptionHtml}
          </p>
          <div class="uplink-choices-grid">
            ${choiceCardsHtml}
          </div>
        </div>
        <div class="uplink-modal-footer">
          ${footerButtonsHtml}
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);

    let resolved = false;
    const close = (decision) => {
      if (resolved) return;
      resolved = true;
      backdrop.remove();
      document.removeEventListener('keydown', handleKey);
      onDecision(decision);
    };

    const handleKey = (e) => {
      if (e.key === 'Escape') close('cancel');
      if (e.key === 'Enter') close('trunk');
    };

    document.addEventListener('keydown', handleKey);

    backdrop.querySelector('.close-btn').addEventListener('click', () => close('cancel'));
    const btnCancel = backdrop.querySelector('#btn-uplink-cancel');
    if (btnCancel) btnCancel.addEventListener('click', () => close('cancel'));
    const btnStandard = backdrop.querySelector('#btn-uplink-standard');
    if (btnStandard) btnStandard.addEventListener('click', () => close('standard'));
    backdrop.querySelector('#btn-uplink-approve').addEventListener('click', () => close('trunk'));

    backdrop.querySelector('#opt-uplink-recommend').addEventListener('click', () => close('trunk'));
    const optStandard = backdrop.querySelector('#opt-uplink-standard');
    if (optStandard) optStandard.addEventListener('click', () => close('standard'));

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) close('cancel');
    });
  }

  function renderMountedDevices() {
    // Retain unchanged device DOM. Faceplates contain dozens of ports, so a
    // keyed update is substantially cheaper than deleting the whole rack.
    const existingDevices = new Map(
      Array.from(document.querySelectorAll('.mounted-device')).map(el => [el.id, el])
    );
    const desiredDeviceIds = new Set();

    const isMulti = STATE.viewMode === 'multi' && STATE.racks && STATE.racks.length > 1;
    const racksToRender = isMulti
      ? STATE.racks.filter(rack => {
          if (rack.id === STATE.activeRackId) return true;
          const container = document.getElementById(`rack-container-${rack.id}`);
          return !container || container.dataset.virtualVisible !== 'false';
        })
      : [getActiveRack()].filter(Boolean);

    if (!racksToRender.length) return;

    // Ensure slots exist for active rack
    const activeRack = getActiveRack();
    if (!isMulti && dom.rackSpace && dom.rackSpace.querySelectorAll('.rack-slot').length !== (activeRack?.heightU || 42)) {
      renderRackRailsAndSlots();
    }

    occupiedPortKeys = new Set();
    const cableStateByDevice = new Map();
    if (Array.isArray(STATE.cables)) {
      for (let i = 0; i < STATE.cables.length; i++) {
        const c = STATE.cables[i];
        if (c.from) {
          occupiedPortKeys.add(portKey(c.from.instanceId, c.from.portId));
          const ports = cableStateByDevice.get(c.from.instanceId) || [];
          ports.push(`${c.from.portId}:${c.id}:${c.color || ''}:${c.role || ''}`);
          cableStateByDevice.set(c.from.instanceId, ports);
        }
        if (c.to) {
          occupiedPortKeys.add(portKey(c.to.instanceId, c.to.portId));
          const ports = cableStateByDevice.get(c.to.instanceId) || [];
          ports.push(`${c.to.portId}:${c.id}:${c.color || ''}:${c.role || ''}`);
          cableStateByDevice.set(c.to.instanceId, ports);
        }
      }
    }

    racksToRender.forEach(rack => {
      if (!rack) return;
      rack.devices.forEach(dev => {
        const cat = HARDWARE_CATALOG[dev.catalogKey];
        if (!cat) return;
        desiredDeviceIds.add(dev.instanceId);

        // Find the slot element for this device (handles single and multi rack mode gracefully)
        let slotEl = document.getElementById(`rack-${rack.id}-slot-u${dev.topU}`);
        if (!slotEl) {
          slotEl = document.getElementById(`rack-slot-u${dev.topU}`);
        }
        if (!slotEl) {
          const rackCont = document.getElementById(`rack-container-${rack.id}`) || document.getElementById('rack-container');
          if (rackCont) {
            slotEl = rackCont.querySelector(`.rack-slot[data-u="${dev.topU}"]`);
          }
        }
        if (!slotEl) return;

        const cableState = (cableStateByDevice.get(dev.instanceId) || []).sort();
        const renderKey = JSON.stringify([
          dev,
          cableState,
          STATE.deviceLabelMode || 'name'
        ]);
        let devEl = existingDevices.get(dev.instanceId);
        if (devEl && devEl.dataset.renderKey === renderKey) {
          if (devEl.parentElement !== slotEl) slotEl.appendChild(devEl);
          return;
        }
        if (devEl) devEl.remove();
        devEl = document.createElement('div');
        devEl.className = 'mounted-device';
        devEl.id = dev.instanceId;
        devEl.dataset.renderKey = renderKey;
        devEl.style.height = `${dev.uHeight * 32}px`;
        devEl.style.top = '0px';
        devEl.dataset.rackId = rack.id;

        if (cat.category === 'organizer') {
          devEl.innerHTML = renderOrganizerFaceplate(cat, dev);
        } else if (cat.category === 'blank') {
          devEl.innerHTML = renderBlankFaceplate(cat, dev);
        } else if (cat.category === 'router') {
          devEl.innerHTML = renderRouterFaceplate(cat, dev);
        } else {
          devEl.innerHTML = renderSwitchOrPatchFaceplate(cat, dev);
        }

        slotEl.appendChild(devEl);

        if (!['organizer', 'blank'].includes(cat.category)) {
          devEl.addEventListener('dblclick', (e) => {
            if (e.target.closest('.port, .del-device-btn, .color-device-cables-btn, .clear-device-cables-btn')) return;
            window.DeviceMetadataEditor?.open2D(dev.instanceId);
          });
          const bezel = devEl.querySelector('.bezel-badge, .cisco-integrated-bezel, .patch-integrated-bezel');
          bezel?.addEventListener('click', (e) => {
            e.stopPropagation();
            window.DeviceMetadataEditor?.open2D(dev.instanceId);
          });
        }

        const colorBtn = devEl.querySelector('.color-device-cables-btn');
        if (colorBtn) {
          colorBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (RS.openSwitchBulkColorPopover) {
              RS.openSwitchBulkColorPopover(colorBtn, dev.instanceId);
            }
          });
        }

        const clearCablesBtn = devEl.querySelector('.clear-device-cables-btn');
        if (clearCablesBtn) {
          clearCablesBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            clearDeviceCables(dev.instanceId, clearCablesBtn);
          });
        }

        const delBtn = devEl.querySelector('.del-device-btn');
        if (delBtn) {
          delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const devCables = (STATE.cables || []).filter(c => c.from.instanceId === dev.instanceId || c.to.instanceId === dev.instanceId);
            const devName = dev.hostname || dev.name || dev.panelLabel || cat.name || 'Cihaz';
            showInlineDeleteConfirm(delBtn, devName, { category: cat.category, cableCount: devCables.length }, () => {
              removeDevice(dev.instanceId);
            });
          });
        }

        const toggleCoverBtn = devEl.querySelector('.finger-toggle-btn');
        if (toggleCoverBtn) {
          toggleCoverBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dev.coverOpen = !dev.coverOpen;
            renderMountedDevices();
            if (typeof RS.renderAllCables === 'function') {
              RS.renderAllCables();
            }
            document.dispatchEvent(new CustomEvent('rackstudio:change', { bubbles: true }));
          });
        }
      });
    });

    existingDevices.forEach((element, instanceId) => {
      if (!desiredDeviceIds.has(instanceId)) element.remove();
    });

    bindPortInteractions();
    updateRackHeaderTelemetry();
  }

  function renderRouterFaceplate(cat, dev) {
    const groups = {};
    cat.ports.forEach(p => {
      if (!groups[p.group]) groups[p.group] = [];
      groups[p.group].push(p);
    });

    let portsHtml = '';
    Object.keys(groups).forEach(gId => {
      const groupPorts = groups[gId];
      portsHtml += `
        <div class="port-group" style="background:rgba(15,23,42,0.85); border-color:#0284c7;">
          <div class="port-row">
            ${groupPorts.map(p => renderPortIcon(dev.instanceId, p)).join('')}
          </div>
        </div>
      `;
    });

    const hasCables = (STATE.cables || []).some(c => c.from?.instanceId === dev.instanceId || c.to?.instanceId === dev.instanceId);
    return `
      <div class="device-faceplate" style="background:linear-gradient(90deg, #131b2c 0%, #1e293b 100%);">
        <div class="device-controls">
          ${hasCables ? `<button type="button" class="dev-btn color-device-cables-btn" data-instance-id="${dev.instanceId}" title="Cihazın tüm kablolarını renklendir">🎨</button>` : ''}
          ${hasCables ? `<button type="button" class="dev-btn clear-device-cables-btn" data-instance-id="${dev.instanceId}" title="Cihazın tüm kablolarını temizle / sök">✂️</button>` : ''}
          <button class="dev-btn del-device-btn" title="Cihazı Kaldır">✕</button>
        </div>
        <div class="bezel-badge">
          <span class="bezel-logo" style="color:#38bdf8;">CISCO</span>
          <span class="bezel-model">${escapeHtml(cat.modelTag)}</span>
        </div>
        <div class="device-status-leds">
          <div class="status-led" title="PWR1: Active" style="background:#22c55e;"></div>
          <div class="status-led" title="PWR2: Standby" style="background:#38bdf8;"></div>
          <div class="status-led" title="WAN: Up" style="background:#22c55e;"></div>
        </div>
        <div class="ports-area">
          ${portsHtml}
          <!-- NIM Modules visual simulation -->
          <div style="display:flex; gap:3px; margin-left:auto; opacity:0.85;">
            <div style="font-size:0.5rem; font-family:monospace; color:#64748b; border:1px dashed #334155; padding:2px 4px; border-radius:2px;">NIM-1</div>
            <div style="font-size:0.5rem; font-family:monospace; color:#64748b; border:1px dashed #334155; padding:2px 4px; border-radius:2px;">NIM-2</div>
            <div style="font-size:0.5rem; font-family:monospace; color:#475569; border:1px solid #1e293b; padding:2px 4px; border-radius:2px;">SM-X</div>
          </div>
        </div>
      </div>
    `;
  }

  function renderOrganizerFaceplate(cat, dev) {
    const is2U = dev.uHeight === 2;
    const isDring = (cat && (cat.id === 'organizer-dring-1u' ||
                    (cat.modelTag && cat.modelTag.includes('D-RING')) ||
                    (cat.name && cat.name.toLowerCase().includes('d-ring')))) ||
                    (dev && dev.catalogKey && dev.catalogKey.includes('dring'));

    if (isDring) {
      const rings = [1, 2, 3, 4, 5].map(idx => `
        <div class="dring-bracket" data-ring="${idx}">
          <div class="dring-loop"></div>
        </div>
      `).join('');

      return `
        <div class="organizer-faceplate dring-faceplate" data-instance-id="${dev.instanceId}">
          <div class="device-controls">
            <button class="dev-btn del-device-btn" title="Cihazı Kaldır">✕</button>
          </div>
          <div class="dring-ring-container">
            ${rings}
          </div>
        </div>
      `;
    }

    const isFingerDuct = is2U || (cat && (cat.id === 'organizer-2u' ||
                         (cat.modelTag && cat.modelTag.includes('FINGER')) ||
                         (cat.name && (cat.name.toLowerCase().includes('parmak') || cat.name.toLowerCase().includes('finger'))))) ||
                         (dev && dev.catalogKey && (dev.catalogKey.includes('organizer-2u') || dev.catalogKey.includes('finger')));

    if (isFingerDuct) {
      const isCoverOpen = Boolean(dev.coverOpen);
      const tineCount = 24;
      const topTines = Array.from({ length: tineCount }, (_, i) => `<div class="finger-tine" data-tine="${i}"></div>`).join('');
      const bottomTines = Array.from({ length: tineCount }, (_, i) => `<div class="finger-tine" data-tine="${i}"></div>`).join('');

      return `
        <div class="organizer-faceplate finger-duct-faceplate" data-instance-id="${dev.instanceId}">
          <div class="device-controls">
            <button class="dev-btn del-device-btn" title="Cihazı Kaldır">✕</button>
          </div>
          <div class="finger-duct-tines-row top">
            ${topTines}
          </div>
          <div class="finger-duct-cover ${isCoverOpen ? 'open' : ''}" data-instance-id="${dev.instanceId}">
            <div class="finger-cover-info">
              <span class="finger-cover-tag">${escapeHtml(cat.modelTag || '2U FINGER-DUCT ORGANIZER')}</span>
            </div>
            <div class="finger-cover-grip">
              <span></span><span></span><span></span><span></span><span></span>
            </div>
            <button class="finger-toggle-btn" data-action="toggle-finger-cover" data-instance-id="${dev.instanceId}" title="${isCoverOpen ? 'Kapağı Kapat' : 'Kapağı Aç'}">
              ${isCoverOpen ? '🔓 Kapak Açık' : '🔒 Kapak Kapalı'}
            </button>
          </div>
          <div class="finger-duct-tines-row bottom">
            ${bottomTines}
          </div>
        </div>
      `;
    }

    // Default: 1U Brush Organizer (organizer-1u)
    return `
      <div class="organizer-faceplate brush-faceplate" data-instance-id="${dev.instanceId}">
        <div class="device-controls">
          <button class="dev-btn del-device-btn" title="Cihazı Kaldır">✕</button>
        </div>
        <div class="brush-tag">
          <span class="brush-tag-icon"></span>
          ${escapeHtml(cat.modelTag || '1U BRUSH PASS-THROUGH')}
        </div>
        <div class="brush-slot">
          <div class="brush-bristles-top"></div>
          <div class="brush-slit"></div>
          <div class="brush-bristles-bottom"></div>
        </div>
      </div>
    `;
  }

  function renderBlankFaceplate(cat, dev) {
    return `
      <div class="blank-faceplate" style="width:100%; height:100%; background:#0b0d13; border-top:1px solid #1c212b; border-bottom:1px solid #030406; border-left:4px solid #334155; display:flex; align-items:center; justify-content:center; position:relative;">
        <div class="device-controls">
          <button class="dev-btn del-device-btn" title="Paneli Kaldır">✕</button>
        </div>
        <span style="font-size:0.6rem; color:#475569; font-family:monospace; letter-spacing:2px;">BLANK COVER PANEL 1U</span>
      </div>
    `;
  }

  function getShortModelName(modelTag, name) {
    const raw = String(modelTag || name || '').trim();
    if (!raw) return 'Cisco';
    let clean = raw.replace(/^Cisco\s+(?:Catalyst\s+)?/i, '');
    clean = clean.replace(/^WS-/i, '');
    const parts = clean.split('-');
    if (parts.length > 1 && /^\d+/.test(parts[1])) {
      return parts[0];
    }
    const isrMatch = clean.match(/^(ISR\s*\d+|ASR\s*\d+)/i);
    if (isrMatch) {
      return isrMatch[1].toUpperCase();
    }
    if (/^N9K/i.test(clean)) {
      return 'N9K';
    }
    const firstToken = clean.split(/[-/\s]/)[0];
    if (firstToken && firstToken.length >= 3 && firstToken.length <= 8) {
      return firstToken;
    }
    return clean.slice(0, 8);
  }

  function getContrastColor(hexColor) {
    if (!hexColor || typeof hexColor !== 'string') return '#ffffff';
    let hex = hexColor.trim().replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    if (hex.length !== 6) return '#ffffff';
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return '#ffffff';
    // ITU-R BT.709 perceived luminance
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return lum > 0.52 ? '#020617' : '#ffffff';
  }

  function renderSwitchOrPatchFaceplate(cat, dev) {
    const isRouter = cat.category === 'router';
    const isSwitch = cat.category === 'switch' || cat.category === 'fiber-switch' || cat.category === 'compact' || isRouter;
    const isFiberPanel = cat.category === 'fiber';
    const isPdu = cat.category === 'pdu' || cat.category === 'power';
    const isPatchPanel = cat.category === 'patch' || isFiberPanel;
    const typeLabel = isRouter ? 'ROUTER' : isSwitch ? 'SWITCH' : isFiberPanel ? 'FIBER PANEL' : isPdu ? 'PDU' : 'PATCH PANEL';
    const typeClass = isSwitch ? 'faceplate-switch' : isFiberPanel ? 'faceplate-fiber-panel' : isPdu ? 'faceplate-pdu' : 'faceplate-patch-panel';
    const configuredLabel = (isPatchPanel || isPdu)
      ? (dev.panelLabel || dev.name || '')
      : (dev.hostname || dev.name || '');
    const isCisco = isSwitch && (/cisco/i.test(cat.logo || '') || /cisco/i.test(cat.name || '') || /cisco/i.test(dev.catalogKey || ''));

    const groups = {};
    cat.ports.forEach(p => {
      if (!groups[p.group]) groups[p.group] = [];
      groups[p.group].push(p);
    });

    let portsHtml = '';
    Object.keys(groups).forEach(gId => {
      const groupPorts = groups[gId];
      const isTwoRows = groupPorts.some(p => p.row === 1);
      const isUplinkGroup = isSwitch && groupPorts.every(p => p.type === 'sfp' || p.type === 'sfp+' || p.type === 'qsfp28');
      const bayClass = isUplinkGroup ? 'cisco-uplink-bay' : (isPatchPanel ? 'patch-port-bay' : (isPdu ? 'pdu-port-bay' : 'cisco-port-bay'));

      let bayHeader = '';
      if (isPatchPanel && groupPorts.length > 0) {
        const firstPortName = groupPorts[0]?.name || '1';
        const lastPortName = groupPorts[groupPorts.length - 1]?.name || String(groupPorts.length);
        bayHeader = `<div class="patch-id-strip"><span>${escapeHtml(firstPortName)}</span><span>-</span><span>${escapeHtml(lastPortName)}</span></div>`;
      }

      if (isTwoRows) {
        const row0 = groupPorts.filter(p => p.row === 0);
        const row1 = groupPorts.filter(p => p.row === 1);

        portsHtml += `
          <div class="port-group ${bayClass}">
            ${bayHeader}
            <div class="port-row">
              ${row0.map(p => renderPortIcon(dev.instanceId, p)).join('')}
            </div>
            <div class="port-row">
              ${row1.map(p => renderPortIcon(dev.instanceId, p)).join('')}
            </div>
          </div>
        `;
      } else {
        portsHtml += `
          <div class="port-group ${bayClass}">
            ${bayHeader}
            <div class="port-row">
              ${groupPorts.map(p => renderPortIcon(dev.instanceId, p)).join('')}
            </div>
          </div>
        `;
      }
    });

    let leftSection = '';
    if (isCisco) {
      // Series-specific Bezel styling & signature LEDs
      const seriesKey = cat.series || (
        cat.modelTag?.includes('9300') || cat.modelTag?.includes('9200') || cat.modelTag?.includes('9500') ? 'cat9k' :
        cat.modelTag?.includes('2960-X') || cat.modelTag?.includes('2960X') ? 'cat2960x' :
        cat.modelTag?.includes('2960') ? 'cat2960' :
        cat.modelTag?.includes('N9K') || cat.modelTag?.includes('Nexus') ? 'nexus' :
        cat.modelTag?.includes('ISR') ? 'isr' : ''
      );
      const bezelClass = seriesKey ? `bezel-${seriesKey}` : '';
      const beaconHtml = (seriesKey === 'cat9k') ? '<span class="cisco-beacon-led" title="Cisco Blue Locator Beacon (Cat9K Signature)"></span>' : '';

      const shortModel = getShortModelName(cat.modelTag, cat.name);
      leftSection = `
        <div class="cisco-integrated-bezel ${bezelClass}" title="${escapeHtml([cat.name, cat.modelTag, configuredLabel, 'Cisco Catalyst Managed Switch'].filter(Boolean).join(' · '))}">
          <div class="cisco-bezel-top">
            <span class="cisco-brand-logo">CISCO</span>
            <div class="cisco-bezel-leds">
              ${beaconHtml}
              <span class="cisco-mini-mode" title="Mode Button"></span>
              <span class="cisco-mini-led" title="SYST: Normal"></span>
              <span class="cisco-mini-led" title="STAT: Active"></span>
            </div>
          </div>
          <div class="cisco-bezel-bot">
            <span class="cisco-model-code" title="${escapeHtml([cat.name, cat.modelTag].filter(Boolean).join(' · '))}">${escapeHtml(shortModel)}</span>
          </div>
        </div>
      `;
    } else if (isPatchPanel) {
      // Integrated Compact Patch Panel Bezel (~74px width, perfectly aligned with Cisco switches)
      const isSc = /sc/i.test(cat.modelTag || cat.name || '') || cat.ports?.some(p => p.type === 'sc');
      const isOs2 = /os2/i.test(cat.modelTag || cat.name || '');
      const isOm4 = /om4/i.test(cat.modelTag || cat.name || '');
      const isCat6A = /cat6a/i.test(cat.name || cat.modelTag || '');
      const totalPorts = cat.ports?.length || 24;

      let titleText = configuredLabel;
      let badgeText = '';
      let specBadge = '';

      if (isFiberPanel) {
        if (!titleText) titleText = 'Fiber Patch';
        badgeText = isSc ? 'SC Duplex' : 'LC Duplex';
        specBadge = isOs2 ? 'OS2' : (isOm4 ? 'OM4' : '');
      } else {
        if (!titleText) titleText = 'Patch Panel';
        badgeText = isCat6A ? 'Cat6A' : 'Cat6';
        specBadge = `${totalPorts}P`;
      }

      leftSection = `
        <div class="patch-integrated-bezel" title="${escapeHtml([cat.name, cat.modelTag, configuredLabel, isFiberPanel ? 'Fiber Dağıtım Paneli' : 'Pasif Patch Panel'].filter(Boolean).join(' · '))}">
          <div class="patch-bezel-top">
            <span class="patch-brand-logo" title="${escapeHtml(titleText)}">${escapeHtml(titleText)}</span>
          </div>
          <div class="patch-bezel-bot">
            <span class="patch-kind-badge">${escapeHtml(badgeText)}</span>
            ${specBadge ? `<span class="patch-spec-badge">${escapeHtml(specBadge)}</span>` : ''}
          </div>
        </div>
      `;
    } else if (isPdu) {
      const modelText = cat.modelTag || cat.name || 'PDU';
      leftSection = `
        <div class="patch-integrated-bezel pdu-integrated-bezel" title="${escapeHtml([cat.name, cat.modelTag, configuredLabel, '16A Rack Montajlı PDU'].filter(Boolean).join(' · '))}">
          <div class="patch-bezel-top">
            <span class="patch-brand-logo" style="color:#22c55e;">230V</span>
            <span class="patch-kind-badge" style="background:rgba(34,197,94,0.15); color:#22c55e; border-color:rgba(34,197,94,0.4);">16A</span>
          </div>
          <div class="patch-bezel-bot">
            <span class="patch-model-code" title="${escapeHtml(configuredLabel || modelText)}">${escapeHtml(configuredLabel || modelText)}</span>
            <span class="patch-type-mini" style="color:#38bdf8;" title="1U PDU Güç Dağıtım">POWER</span>
          </div>
        </div>
      `;
    } else {
      const statusSection = `
        <div class="device-status-leds">
          <div class="status-led" title="Power: OK"></div>
          <div class="status-led" style="background:#38bdf8;" title="Status: Active"></div>
        </div>
      `;

      leftSection = `
        <div class="bezel-badge" title="${escapeHtml([cat.logo, cat.modelTag, typeLabel, configuredLabel].filter(Boolean).join(' · '))}">
          <div class="bezel-primary-row">
            <span class="bezel-logo">${escapeHtml(cat.logo)}</span>
            <span class="device-kind-badge">${typeLabel}</span>
          </div>
          <div class="bezel-secondary-row">
            <span class="bezel-model">${escapeHtml(cat.modelTag)}</span>
            ${configuredLabel ? `<span class="device-config-label">${escapeHtml(configuredLabel)}</span>` : ''}
          </div>
        </div>
        ${statusSection}
      `;
    }

    const hasCables = (STATE.cables || []).some(c => c.from?.instanceId === dev.instanceId || c.to?.instanceId === dev.instanceId);
    return `
      <div class="device-faceplate ${typeClass}">
        <div class="device-controls">
          ${hasCables ? `<button type="button" class="dev-btn color-device-cables-btn" data-instance-id="${dev.instanceId}" title="Cihazın tüm kablolarını renklendir">🎨</button>` : ''}
          ${hasCables ? `<button type="button" class="dev-btn clear-device-cables-btn" data-instance-id="${dev.instanceId}" title="${isPatchPanel ? 'Paneli tüm kablolarını temizle / sök' : 'Cihazın tüm kablolarını temizle / sök'}">✂️</button>` : ''}
          <button class="dev-btn del-device-btn" title="${isPatchPanel ? 'Paneli Kaldır' : 'Cihazı Kaldır'}">✕</button>
        </div>
        ${leftSection}
        <div class="ports-area">
          ${portsHtml}
        </div>
      </div>
    `;
  }

  function renderPortIcon(instanceId, port) {
    let typeClass = 'port-rj45';
    let inner = '';
    if (port.type === 'sfp') {
      typeClass = 'port-sfp';
    } else if (port.type === 'lc') {
      typeClass = 'port-lc';
      inner = '<div class="port-lc-inner"><span class="lc-ferrule"></span></div><div class="port-lc-inner"><span class="lc-ferrule"></span></div>';
    } else if (port.type === 'sc') {
      typeClass = 'port-sc';
      inner = '<div class="port-sc-inner"><span class="sc-ferrule"></span></div><div class="port-sc-inner"><span class="sc-ferrule"></span></div>';
    } else if (port.type === 'power') {
      typeClass = 'port-power';
      inner = '<div class="port-power-pin"></div><div class="port-power-pin"></div>';
    }

    const isConnected = occupiedPortKeys.has(portKey(instanceId, port.id));
    const allDevices = STATE.racks ? STATE.racks.flatMap(r => r.devices || []) : [];
    const dev = allDevices.find(d => d.instanceId === instanceId);
    const pIdStr = String(port.id || '');
    const pNumStr = pIdStr.replace(/\D+/g, '');
    let portCfg = dev && dev.portsConfig && (
      dev.portsConfig[port.id] ||
      (pNumStr && dev.portsConfig[pNumStr]) ||
      (pNumStr && dev.portsConfig['p' + pNumStr]) ||
      (pNumStr && dev.portsConfig['pt' + pNumStr]) ||
      (pNumStr && dev.portsConfig['lc' + pNumStr]) ||
      (pNumStr && dev.portsConfig['sc' + pNumStr]) ||
      dev.portsConfig[port.name]
    );

    // Fallback: If port is connected but dev.portsConfig has no role set, derive from connected cable or remote endpoint
    if (!portCfg && isConnected && Array.isArray(STATE.cables)) {
      const connCable = STATE.cables.find(c => {
        const fromMatch = c.from && c.from.instanceId === instanceId && (
          c.from.portId === port.id ||
          (pNumStr && String(c.from.portId).replace(/\D+/g, '') === pNumStr)
        );
        const toMatch = c.to && c.to.instanceId === instanceId && (
          c.to.portId === port.id ||
          (pNumStr && String(c.to.portId).replace(/\D+/g, '') === pNumStr)
        );
        return fromMatch || toMatch;
      });
      if (connCable) {
        // Inspect remote connected endpoint's portsConfig to inherit VLAN / role badges bidirectionally
        const isFromMe = connCable.from && connCable.from.instanceId === instanceId;
        const remoteEndpoint = isFromMe ? connCable.to : connCable.from;
        const remoteDev = remoteEndpoint ? allDevices.find(d => d.instanceId === remoteEndpoint.instanceId) : null;
        let remoteCfg = null;
        if (remoteDev && remoteDev.portsConfig && remoteEndpoint.portId) {
          const remId = String(remoteEndpoint.portId);
          const remNum = remId.replace(/\D+/g, '');
          remoteCfg = remoteDev.portsConfig[remId] ||
                      (remNum && remoteDev.portsConfig[remNum]) ||
                      (remNum && remoteDev.portsConfig['p' + remNum]) ||
                      (remNum && remoteDev.portsConfig['pt' + remNum]) ||
                      (remNum && remoteDev.portsConfig['lc' + remNum]) ||
                      (remNum && remoteDev.portsConfig['sc' + remNum]);
        }

        if (remoteCfg && (remoteCfg.vlan || remoteCfg.role || remoteCfg.color || remoteCfg.isTrunk)) {
          portCfg = { ...remoteCfg };
        } else if (connCable.color === '#facc15' || connCable.name?.includes('[FIBER]') || connCable.role === 'fiber' || port.type === 'sfp' || port.type === 'lc' || port.type === 'sc') {
          portCfg = { role: 'fiber', color: '#facc15' };
        } else if (connCable.role) {
          portCfg = { role: connCable.role, color: connCable.color };
        } else if (connCable.name?.includes('[UPLINK]')) {
          portCfg = { role: 'uplink', color: connCable.color || '#00d2ff' };
        } else if (connCable.name?.includes('[TRUNK]')) {
          portCfg = { role: 'trunk', color: connCable.color || '#7c3aed' };
        }
      }
    }

    let specialClass = '';
    let specialStyle = '';

    if (portCfg) {
      const role = (portCfg.role || (portCfg.isTrunk ? 'trunk' : '')).toLowerCase();
      const hasVlan = Boolean(portCfg.vlan);
      const customColor = portCfg.color;

      if (role === 'trunk' || portCfg.isTrunk) {
        const color = customColor || '#7c3aed';
        const badgeColor = getContrastColor(color);
        specialClass = 'port-special port-trunk';
        specialStyle = `style="--port-role-color: ${color}; --custom-color: ${color}; --trunk-color: ${color}; --port-badge-text: 'T'; --port-badge-color: ${badgeColor};"`;
      } else if (role === 'uplink') {
        const color = customColor || '#00d2ff';
        const badgeColor = getContrastColor(color);
        specialClass = 'port-special port-uplink';
        specialStyle = `style="--port-role-color: ${color}; --custom-color: ${color}; --port-badge-text: '▲'; --port-badge-color: ${badgeColor};"`;
      } else if (role === 'trunk-ap') {
        const color = customColor || '#ec4899';
        const badgeColor = getContrastColor(color);
        specialClass = 'port-special port-trunk-ap';
        specialStyle = `style="--port-role-color: ${color}; --custom-color: ${color}; --port-badge-text: 'W'; --port-badge-color: ${badgeColor};"`;
      } else if (role === 'routed') {
        const color = customColor || '#b91c1c';
        const badgeColor = getContrastColor(color);
        specialClass = 'port-special port-routed';
        specialStyle = `style="--port-role-color: ${color}; --custom-color: ${color}; --port-badge-text: 'R'; --port-badge-color: ${badgeColor};"`;
      } else if (role === 'poe') {
        const color = customColor || '#f59e0b';
        const badgeColor = getContrastColor(color);
        specialClass = 'port-special port-poe';
        specialStyle = `style="--port-role-color: ${color}; --custom-color: ${color}; --port-badge-text: '⚡'; --port-badge-color: ${badgeColor};"`;
      } else if (role === 'management' || role === 'mgmt') {
        const color = customColor || '#059669';
        const badgeColor = getContrastColor(color);
        specialClass = 'port-special port-mgmt';
        specialStyle = `style="--port-role-color: ${color}; --custom-color: ${color}; --port-badge-text: 'M'; --port-badge-color: ${badgeColor};"`;
      } else if (role === 'console') {
        const color = customColor || '#00bceb';
        const badgeColor = getContrastColor(color);
        specialClass = 'port-special port-console';
        specialStyle = `style="--port-role-color: ${color}; --custom-color: ${color}; --port-badge-text: 'C'; --port-badge-color: ${badgeColor};"`;
      } else if (role === 'fiber') {
        const color = customColor || '#facc15';
        const badgeColor = getContrastColor(color);
        specialClass = 'port-special port-fiber';
        specialStyle = `style="--port-role-color: ${color}; --custom-color: ${color}; --port-badge-text: 'F'; --port-badge-color: ${badgeColor};"`;
      } else if (hasVlan || (role === 'access' && hasVlan)) {
        const color = customColor || '#38bdf8';
        const badgeColor = getContrastColor(color);
        const vlanLabel = String(portCfg.vlan).trim().split(/[, ]+/)[0];
        const badgeText = vlanLabel ? `V${vlanLabel.slice(0, 3)}` : 'V';
        specialClass = 'port-special port-vlan';
        specialStyle = `style="--port-role-color: ${color}; --custom-color: ${color}; --port-badge-text: '${badgeText}'; --port-badge-color: ${badgeColor};"`;
      } else if (customColor) {
        const badgeColor = getContrastColor(customColor);
        specialClass = 'port-special';
        specialStyle = `style="--port-role-color: ${customColor}; --custom-color: ${customColor}; --port-badge-text: '●'; --port-badge-color: ${badgeColor};"`;
      }

      if (portCfg.poeState === 'never') {
        specialClass += ' port-poe-disabled';
      }
    }

    return `
      <div class="port ${typeClass} ${isConnected ? 'connected' : ''} ${specialClass}" 
           ${specialStyle}
           data-instance-id="${instanceId}" 
           data-port-id="${port.id}"
           data-port-name="${escapeHtml(port.name)}"
           data-port-type="${escapeHtml(port.type)}"
           data-port-speed="${escapeHtml(port.speed)}"
           id="port-${instanceId}-${port.id}">
        ${inner}
      </div>
    `;
  }

  // --- PORT ROLE CYCLE on EMPTY PORT double-click ---
  // Copper/generic cycle: none → access → trunk → uplink → routed → poe → management → console → none
  // Fiber-type cycle   : none → fiber → none
  const PORT_ROLE_CYCLES = {
    copper: [null, 'access', 'trunk', 'uplink', 'routed', 'poe', 'management', 'console'],
    fiber:  [null, 'fiber'],
  };
  const PORT_ROLE_META = {
    null:       { label: 'Boş (Rol Yok)',   icon: '⚪', color: '#475569' },
    access:     { label: 'Access',           icon: '🔵', color: '#38bdf8' },
    trunk:      { label: 'Trunk 802.1Q',     icon: '🟣', color: '#7c3aed' },
    uplink:     { label: 'Uplink ▲',         icon: '🔷', color: '#00d2ff' },
    routed:     { label: 'Routed (L3)',      icon: '🔴', color: '#b91c1c' },
    poe:        { label: 'PoE ⚡',           icon: '🟡', color: '#f59e0b' },
    management: { label: 'Management',       icon: '🟢', color: '#059669' },
    console:    { label: 'Console',          icon: '🔵', color: '#00bceb' },
    fiber:      { label: 'Fiber',            icon: '🟡', color: '#facc15' },
  };

  function cyclePortRole(instanceId, portId, portType) {
    const isFiber = ['lc', 'sc', 'sfp', 'sfp+', 'qsfp28'].includes((portType || '').toLowerCase());
    const cycle = isFiber ? PORT_ROLE_CYCLES.fiber : PORT_ROLE_CYCLES.copper;

    // Find device across all racks
    const devRack = STATE.racks.find(r => r.devices.some(d => d.instanceId === instanceId));
    if (!devRack) return;
    const dev = devRack.devices.find(d => d.instanceId === instanceId);
    if (!dev) return;

    // Ensure portsConfig exists
    if (!dev.portsConfig) dev.portsConfig = {};

    const pIdStr = String(portId || '');
    const pNumStr = pIdStr.replace(/^p/i, '');
    // Resolve the key used in portsConfig
    const cfgKey = (dev.portsConfig[portId] !== undefined)     ? portId
                 : (dev.portsConfig[pNumStr] !== undefined)    ? pNumStr
                 : (dev.portsConfig['p' + pNumStr] !== undefined) ? 'p' + pNumStr
                 : portId; // default to portId

    const currentCfg = dev.portsConfig[cfgKey];
    const currentRole = currentCfg?.role || null;

    // Find current index in cycle
    const idx = cycle.indexOf(currentRole);
    const nextRole = cycle[(idx + 1) % cycle.length];

    if (nextRole === null) {
      // Clear config completely
      delete dev.portsConfig[cfgKey];
    } else {
      const meta = PORT_ROLE_META[nextRole] || {};
      dev.portsConfig[cfgKey] = {
        ...(currentCfg || {}),
        role: nextRole,
        color: meta.color,
      };
    }

    // Persist & re-render
    renderMountedDevices();
    renderAllCables();
    document.dispatchEvent(new CustomEvent('rackstudio:change', { bubbles: true, detail: { immediate: true } }));
    window.dispatchEvent(new CustomEvent('rackstudio:refresh'));

    // Show mini toast feedback
    const meta = PORT_ROLE_META[nextRole] || PORT_ROLE_META['null'];
    showPortRoleCycleToast(portId, nextRole, meta);
  }

  function showPortRoleCycleToast(portId, role, meta) {
    let toast = document.getElementById('port-role-cycle-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'port-role-cycle-toast';
      toast.style.cssText = [
        'position:fixed', 'bottom:80px', 'left:50%', 'transform:translateX(-50%)',
        'background:rgba(15,23,42,0.96)', 'border:1px solid #334155',
        'border-radius:8px', 'padding:8px 18px',
        'font-size:0.78rem', 'font-family:monospace', 'font-weight:600',
        'color:#f8fafc', 'z-index:99999',
        'box-shadow:0 4px 24px rgba(0,0,0,0.5)',
        'pointer-events:none', 'transition:opacity 0.25s',
      ].join(';');
      document.body.appendChild(toast);
    }
    const label = meta.label || role || 'Boş';
    const color = meta.color || '#94a3b8';
    toast.innerHTML = `${meta.icon || '⚪'} <span style="color:#94a3b8">Port ${escapeHtml(portId)}:</span> <span style="color:${color}">${escapeHtml(label)}</span>`;
    toast.style.opacity = '1';
    clearTimeout(toast.__hideTimer);
    toast.__hideTimer = setTimeout(() => { toast.style.opacity = '0'; }, 1800);
  }
  // --- END PORT ROLE CYCLE ---

  let portDelegationBound = false;
  function bindPortInteractions() {
    const stage = dom.rackStage || document.getElementById('rack-stage') || document.body;
    if (!portDelegationBound && stage) {
      portDelegationBound = true;
      stage.addEventListener('mouseover', (e) => {
        const portEl = e.target.closest('.port');
        if (portEl) handlePortHover({ currentTarget: portEl, target: portEl });
      });
      stage.addEventListener('mouseout', (e) => {
        const portEl = e.target.closest('.port');
        if (portEl) {
          const next = e.relatedTarget ? e.relatedTarget.closest('.port') : null;
          if (next !== portEl) handlePortLeave();
        }
      });
      stage.addEventListener('click', (e) => {
        const portEl = e.target.closest('.port');
        if (!portEl) return;
        if (e.shiftKey) {
          e.preventDefault();
          e.stopPropagation();
          const devId = portEl.dataset.instanceId;
          const portId = portEl.dataset.portId;
          if (window.PortConfigEditor) {
            window.PortConfigEditor.open(devId, portId, '2d');
          }
          return;
        }
        handlePortClick({ currentTarget: portEl, target: portEl, stopPropagation: () => e.stopPropagation() });
      });
      stage.addEventListener('dblclick', (e) => {
        const portEl = e.target.closest('.port');
        if (!portEl) return;
        e.stopPropagation();
        e.preventDefault();
        const instanceId = portEl.dataset.instanceId;
        const portId = portEl.dataset.portId;
        const portType = portEl.dataset.portType;
        if (!instanceId || !portId) return;

        const isOccupied = occupiedPortKeys.has(portKey(instanceId, portId));
        if (isOccupied) return;

        if (STATE.pendingConnection) cancelPendingConnection();
        cyclePortRole(instanceId, portId, portType);
      });
      stage.addEventListener('contextmenu', (e) => {
        const portEl = e.target.closest('.port');
        if (!portEl) return;
        e.preventDefault();
        e.stopPropagation();
        const devId = portEl.dataset.instanceId;
        const portId = portEl.dataset.portId;
        if (window.PortConfigEditor) {
          window.PortConfigEditor.open(devId, portId, '2d');
        }
      });
    }
  }

  function handlePortHover(e) {
    const portEl = e.currentTarget;
    const instanceId = portEl.dataset.instanceId;
    const portId = portEl.dataset.portId;
    const portName = portEl.dataset.portName;
    const portSpeed = portEl.dataset.portSpeed;

    const activeRack = getActiveRack();
    if (!activeRack) return;

    const dev = activeRack.devices.find(d => d.instanceId === instanceId);
    if (!dev) return;
    const cat = HARDWARE_CATALOG[dev.catalogKey];

    const connectedCable = STATE.cables.find(c =>
      (c.from.instanceId === instanceId && c.from.portId === portId) ||
      (c.to.instanceId === instanceId && c.to.portId === portId)
    );

    let connectionInfo = '<span style="color:#94a3b8;">Boş / Bağlantı Yok</span>';
    if (connectedCable) {
      const isFrom = (connectedCable.from.instanceId === instanceId && connectedCable.from.portId === portId);
      const otherEndpoint = isFrom ? connectedCable.to : connectedCable.from;
      const otherRack = STATE.racks.find(r => r.id === otherEndpoint.rackId);
      const otherDev = otherRack ? otherRack.devices.find(d => d.instanceId === otherEndpoint.instanceId) : null;
      const otherCat = otherDev ? HARDWARE_CATALOG[otherDev.catalogKey] : null;
      const otherPort = otherCat ? otherCat.ports.find(p => p.id === otherEndpoint.portId) : null;

      const isInterRack = otherEndpoint.rackId !== activeRack.id;
      connectionInfo = `<span style="color:${isInterRack ? '#38bdf8' : '#22c55e'}; font-weight:600;">
        Bağlı -> ${isInterRack ? `[${escapeHtml(otherRack ? otherRack.name : 'Dış Kabin')}] ` : ''}${escapeHtml(otherCat ? otherCat.name : '')} [${escapeHtml(otherPort ? otherPort.name : otherEndpoint.portId)}]
      </span>`;
    }

    const pIdStr = String(portId || '');
    const pNumStr = pIdStr.replace(/^p/i, '');
    const portCfg = dev.portsConfig && (
      dev.portsConfig[portId] ||
      dev.portsConfig[pNumStr] ||
      dev.portsConfig['p' + pNumStr] ||
      dev.portsConfig[portName]
    );

    const isTrunk = Boolean(portCfg && (portCfg.role === 'trunk' || portCfg.isTrunk));
    const trunkColor = (portCfg && portCfg.color) || '#7c3aed';

    let configDetail = '';
    if (portCfg) {
      const role = (portCfg.role || (portCfg.isTrunk ? 'trunk' : 'access')).toUpperCase();
      const cfgColor = portCfg.color || '#38bdf8';
      const cName = portCfg.ciscoName ? ` · ${escapeHtml(portCfg.ciscoName)}` : '';
      const vText = portCfg.vlan ? ` | VLAN: ${escapeHtml(portCfg.vlan)}` : '';
      const poeText = portCfg.poeState === 'never' ? ' | PoE: Kapalı' : '';
      const dText = portCfg.description ? `<div style="color:#94a3b8; font-size:10px; font-style:italic;">"${escapeHtml(portCfg.description)}"</div>` : '';
      configDetail = `
        <div style="background:rgba(15,23,42,0.6); border-left:3px solid ${cfgColor}; padding:2px 6px; margin:4px 0; border-radius:2px;">
          <span style="color:${cfgColor}; font-weight:700;">⚡ ${role}${cName}${vText}${poeText}</span>
          ${dText}
        </div>
      `;
    }

    if (dom.inspectorInfo) {
      dom.inspectorInfo.innerHTML = `
        <div style="font-weight:700; color:#fff; margin-bottom:3px;">${escapeHtml(cat.name)} (${escapeHtml(activeRack.name)} - U${dev.topU})</div>
        <div><b>Port:</b> ${escapeHtml(portName)} (${escapeHtml(portSpeed)})</div>
        <div><b>Tip:</b> ${escapeHtml(portEl.dataset.portType.toUpperCase())}</div>
        ${configDetail}
        <div><b>Durum:</b> ${connectionInfo}</div>
      `;
    }

    if (dom.tooltip) {
      const rect = portEl.getBoundingClientRect();
      dom.tooltip.style.display = 'block';
      dom.tooltip.style.left = `${rect.right + 12}px`;
      dom.tooltip.style.top = `${rect.top - 6}px`;

      // If currently connecting a cable, show connection validation & target status
      if (STATE.pendingConnection) {
        const src = STATE.pendingConnection;
        const isSelf = src.instanceId === instanceId && src.portId === portId;
        if (isSelf) {
          dom.tooltip.innerHTML = `
            <div style="font-weight:800; font-size:0.75rem; color:#f59e0b; padding-bottom:3px; margin-bottom:4px;">
              ⚠️ Kaynak Port Seçildi
            </div>
            <div style="color:#cbd5e1; font-size:0.68rem;">Bağlantıyı iptal etmek için bu porta tekrar tıklayın.</div>
          `;
          return;
        }

        const isOccupied = STATE.cables.some(c =>
          (c.from.instanceId === instanceId && c.from.portId === portId) ||
          (c.to.instanceId === instanceId && c.to.portId === portId)
        );

        if (isOccupied) {
          dom.tooltip.innerHTML = `
            <div style="font-weight:800; font-size:0.75rem; color:#ef4444; padding-bottom:3px; margin-bottom:4px;">
              ⛔ Port Dolu
            </div>
            <div style="color:#cbd5e1; font-size:0.68rem;">Bu porta zaten başka bir kablo bağlı.</div>
          `;
          return;
        }

        const rules = RS.NetworkRules || window.NetworkRules;
        const strict = STATE.strictCompliance !== false;
        const validation = rules && typeof rules.validateConnection === 'function'
          ? rules.validateConnection(src, { rackId: activeRack.id, instanceId, portId }, STATE, HARDWARE_CATALOG, strict)
          : { allowed: true };

        if (!validation.allowed) {
          dom.tooltip.innerHTML = `
            <div style="font-weight:800; font-size:0.75rem; color:#ef4444; border-bottom:1px solid #7f1d1d; padding-bottom:3px; margin-bottom:4px;">
              ⛔ Bağlantı Uyumsuz
            </div>
            <div style="color:#f87171; font-size:0.68rem; line-height:1.3;">${escapeHtml(validation.reason || 'Bu porta bağlanamaz')}</div>
          `;
          return;
        }

        if (validation.warning) {
          const isPatchPassThrough = validation.warning.includes('Patch Panel Ara Bağlantı') || validation.warning.includes('Patch Panel Çapraz');
          if (isPatchPassThrough) {
            // Panel-to-panel cross-connect: show blue info card (allowed, just informational)
            dom.tooltip.innerHTML = `
              <div style="font-weight:800; font-size:0.75rem; color:#38bdf8; border-bottom:1px solid #0369a1; padding-bottom:3px; margin-bottom:4px;">
                ℹ️ Panel Çapraz Aktarma
              </div>
              <div style="color:#bae6fd; font-size:0.68rem; line-height:1.3; margin-bottom:4px;">${escapeHtml(validation.warning)}</div>
              <div style="color:#cbd5e1; font-size:0.68rem;"><b>Hedef:</b> ${escapeHtml(cat.modelTag || cat.name)} · <b>${escapeHtml(portName)}</b></div>
              <div style="color:#86efac; font-size:0.65rem; margin-top:2px;">Bağlamak için tıklayın.</div>
            `;
          } else {
            // Other warnings (e.g. same-panel loopback)
            dom.tooltip.innerHTML = `
              <div style="font-weight:800; font-size:0.75rem; color:#f59e0b; border-bottom:1px solid #78350f; padding-bottom:3px; margin-bottom:4px;">
                ⚠️ Bağlantı Uyarısı
              </div>
              <div style="color:#fde68a; font-size:0.68rem; line-height:1.3; margin-bottom:4px;">${escapeHtml(validation.warning)}</div>
              <div style="color:#cbd5e1; font-size:0.68rem;"><b>Hedef:</b> ${escapeHtml(cat.modelTag || cat.name)} · <b>${escapeHtml(portName)}</b></div>
              <div style="color:#86efac; font-size:0.65rem; margin-top:2px;">Bağlamak için tıklayın.</div>
            `;
          }
          return;
        }

        dom.tooltip.innerHTML = `
          <div style="font-weight:800; font-size:0.75rem; color:#22c55e; border-bottom:1px solid #14532d; padding-bottom:3px; margin-bottom:4px;">
            🔗 Bağlantıyı Tamamla
          </div>
          <div style="color:#cbd5e1; font-size:0.68rem;"><b>Hedef:</b> ${escapeHtml(cat.modelTag || cat.name)} · <b>${escapeHtml(portName)}</b></div>
          <div style="color:#86efac; font-size:0.65rem; margin-top:2px;">Bağlamak için tıklayın.</div>
        `;
        return;
      }

      const trunkBadge = isTrunk ? `<span style="background:${trunkColor}; color:#fff; font-size:9px; font-weight:800; padding:1px 4px; border-radius:2px; margin-left:6px;">802.1Q TRUNK</span>` : '';
      const vlanInfo = portCfg?.vlan ? `<div style="color:#38bdf8; font-size:0.68rem; margin-top:2px;">🏷️ VLAN: <b>${escapeHtml(portCfg.vlan)}</b></div>` : '';
      const connInfo = connectedCable ? `<div style="color:#22c55e; font-size:0.68rem; margin-top:3px;">🔗 ${connectionInfo}</div>` : `<div style="color:#64748b; font-size:0.68rem; margin-top:3px;">⚪ Bağlantı Yok (Boş)</div>`;
      
      dom.tooltip.innerHTML = `
        <div style="font-weight:800; font-size:0.75rem; color:#f8fafc; border-bottom:1px solid #334155; padding-bottom:3px; margin-bottom:4px; display:flex; align-items:center; justify-content:space-between;">
          <span>${escapeHtml(cat.modelTag || cat.name)}</span>
          <span style="color:#38bdf8; font-family:monospace; font-size:0.75rem;">${escapeHtml(portName)}</span>
          ${trunkBadge}
        </div>
        <div style="color:#cbd5e1; font-size:0.68rem;">⚡ <b>Hız:</b> ${escapeHtml(portSpeed)}</div>
        <div style="color:#94a3b8; font-size:0.66rem;">🔌 <b>Tip:</b> ${escapeHtml(portEl.dataset.portType.toUpperCase())}</div>
        ${vlanInfo}
        ${connInfo}
        <div style="color:#0ea5e9; font-size:0.63rem; margin-top:4px; border-top:1px dashed #1e293b; padding-top:2px;">⚙️ Sağ Tık / Shift+Tık: <i>Port Yapılandırması</i></div>
      `;
    }
  }

  function handlePortLeave() {
    if (dom.tooltip) dom.tooltip.style.display = 'none';
  }

  function handlePortClick(e) {
    e.stopPropagation();
    const portEl = e.currentTarget;
    const instanceId = portEl.dataset.instanceId;
    const portId = portEl.dataset.portId;
    if (!instanceId || !portId) return;

    // Find which rack this device belongs to (important for multi-rack mode)
    const devRack = STATE.racks.find(r => r.devices.some(d => d.instanceId === instanceId)) || getActiveRack();
    if (!devRack) return;

    if (!STATE.pendingConnection) {
      const isOccupied = STATE.cables.some(c =>
        (c.from.instanceId === instanceId && c.from.portId === portId) ||
        (c.to.instanceId === instanceId && c.to.portId === portId)
      );

      if (isOccupied) {
        const connectedCable = STATE.cables.find(c => 
          (c.from.instanceId === instanceId && c.from.portId === portId) ||
          (c.to.instanceId === instanceId && c.to.portId === portId)
        );
        if (connectedCable) {
          highlightCable(connectedCable.id);
          const rect = portEl.getBoundingClientRect();
          showCableQuickHud(connectedCable.id, rect.left + rect.width / 2, rect.top);
        }
        return;
      }

      STATE.pendingConnection = {
        rackId: devRack.id,
        instanceId,
        portId,
        element: portEl
      };

      portEl.classList.add('selected');
      const dev = devRack.devices.find(d => d.instanceId === instanceId);
      const cat = dev ? HARDWARE_CATALOG[dev.catalogKey] : null;
      const port = cat ? cat.ports.find(p => p.id === portId) : null;
      if (window.SoundFX) {
        window.SoundFX.playPortClick(port?.type || 'copper');
      }

      if (dom.connectionStatusHint && cat && port) {
        dom.connectionStatusHint.innerHTML = `Kaynak: <span style="color:#38bdf8;">[${escapeHtml(devRack.name)}] ${escapeHtml(cat.modelTag)} (${escapeHtml(port.name)})</span> &rarr; <b>Hedef Porta Tıklayın (Kabin değiştirebilirsiniz)</b>`;
      }
    } else {
      const source = STATE.pendingConnection;

      if (source.rackId === devRack.id && source.instanceId === instanceId && source.portId === portId) {
        cancelPendingConnection();
        return;
      }

      const isTargetOccupied = STATE.cables.some(c =>
        (c.from.instanceId === instanceId && c.from.portId === portId) ||
        (c.to.instanceId === instanceId && c.to.portId === portId)
      );

      if (isTargetOccupied) {
        alert("Hedef port dolu! Lütfen boş bir port seçin.");
        return;
      }

      const isInterRack = source.rackId !== devRack.id;

      // Validate connection against network engineering rules (Loop prevention, Media compatibility)
      if (RS.NetworkRules && typeof RS.NetworkRules.validateConnection === 'function') {
        const validation = RS.NetworkRules.validateConnection(source, { rackId: devRack.id, instanceId, portId });
        if (!validation.allowed) {
          if (window.SoundFX && typeof window.SoundFX.playError === 'function') {
            window.SoundFX.playError();
          }
          if (dom.connectionStatusHint) {
            dom.connectionStatusHint.innerHTML = `<span style="color:#ef4444; font-weight:bold;">⛔ ${escapeHtml(validation.reason || 'Kural İhlali!')}</span>`;
          }
          const rect = portEl.getBoundingClientRect();
          showConnectionErrorToast(rect.left + rect.width / 2, rect.top, validation.reason || 'Bağlantı kuralı ihlali!');
          cancelPendingConnection();
          return;
        }
        if (validation.warning && dom.connectionStatusHint) {
          dom.connectionStatusHint.innerHTML = `<span style="color:#f59e0b; font-weight:600;">${escapeHtml(validation.warning)}</span>`;
        }
      }

      const cableId = getNextCableId();

      // Find source and target devices
      const sourceDev = STATE.racks?.find(r => r.id === source.rackId)?.devices?.find(d => d.instanceId === source.instanceId);
      const targetDev = devRack.devices?.find(d => d.instanceId === instanceId);

      const sourceCat = sourceDev ? HARDWARE_CATALOG[sourceDev.catalogKey] : null;
      const targetCat = targetDev ? HARDWARE_CATALOG[targetDev.catalogKey] : null;
      const srcPort = sourceCat?.ports?.find(p => p.id === source.portId);
      const tgtPort = targetCat?.ports?.find(p => p.id === portId);

      const getCfg = (dev, pId) => {
        if (!dev || !dev.portsConfig || !pId) return null;
        const strId = String(pId);
        const numId = strId.replace(/^p/i, '');
        return dev.portsConfig[strId] || dev.portsConfig[numId] || null;
      };

      const sourcePortCfg = getCfg(sourceDev, source.portId);
      const targetPortCfg = getCfg(targetDev, portId);

      const ROLE_DEFAULT_COLORS = {
        trunk: '#7c3aed',
        uplink: '#00d2ff',
        'trunk-ap': '#ec4899',
        routed: '#b91c1c',
        mgmt: '#059669',
        management: '#059669',
        access: '#38bdf8',
        poe: '#f59e0b',
        fiber: '#facc15'
      };

      // Check if source or target port is marked/configured
      const isSourceConfigured = Boolean(sourcePortCfg && (sourcePortCfg.color || sourcePortCfg.role || sourcePortCfg.isTrunk || sourcePortCfg.vlan || sourcePortCfg.description));
      const isTargetConfigured = Boolean(targetPortCfg && (targetPortCfg.color || targetPortCfg.role || targetPortCfg.isTrunk || targetPortCfg.vlan || targetPortCfg.description));

      // Intelligent Auto-Uplink & Fiber Detection
      let detectedUplink = null;
      if (RS.NetworkRules && typeof RS.NetworkRules.detectUplinkConnection === 'function') {
        detectedUplink = RS.NetworkRules.detectUplinkConnection(sourceDev, srcPort, targetDev, tgtPort);
      }

      let detectedFiber = null;
      if (RS.NetworkRules && typeof RS.NetworkRules.detectFiberConnection === 'function') {
        detectedFiber = RS.NetworkRules.detectFiberConnection(sourceDev, srcPort, targetDev, tgtPort);
      } else {
        const isOptic = (srcPort?.type === 'lc' || srcPort?.type === 'sc' || srcPort?.type === 'fiber') &&
                        (tgtPort?.type === 'lc' || tgtPort?.type === 'sc' || tgtPort?.type === 'fiber') &&
                        srcPort?.type !== 'rj45' && tgtPort?.type !== 'rj45';
        if (isOptic) {
          detectedFiber = { isFiber: true, color: '#facc15', role: 'fiber', prefix: '[FIBER]', reason: 'Single-Mode OS2 Fiber Optik' };
        }
      }

      let effectiveRole = 'standard';
      let effectiveColor = STATE.selectedCableColor;
      let isTrunk = false;

      if (isSourceConfigured && !isTargetConfigured) {
        // Master is source: target inherits configuration, marking, and cable color
        effectiveRole = sourcePortCfg.role || (sourcePortCfg.isTrunk ? 'trunk' : 'access');
        isTrunk = effectiveRole === 'trunk' || effectiveRole === 'uplink' || effectiveRole === 'trunk-ap' || !!sourcePortCfg.isTrunk;
        effectiveColor = sourcePortCfg.color || ROLE_DEFAULT_COLORS[effectiveRole] || (detectedFiber ? '#facc15' : STATE.selectedCableColor);

        if (targetDev) {
          if (!targetDev.portsConfig) targetDev.portsConfig = {};
          const inheritedCfg = {
            role: effectiveRole,
            isTrunk: isTrunk,
            poeState: sourcePortCfg.poeState || 'auto',
            color: effectiveColor,
            vlan: sourcePortCfg.vlan || '',
            description: sourcePortCfg.description || '',
            ciscoName: sourcePortCfg.ciscoName || '',
            autoCableColor: sourcePortCfg.autoCableColor !== false
          };
          targetDev.portsConfig[portId] = inheritedCfg;
          const pNumTgt = String(portId).replace(/\D+/g, '');
          if (pNumTgt) targetDev.portsConfig[pNumTgt] = inheritedCfg;
        }
      } else if (!isSourceConfigured && isTargetConfigured) {
        // Master is target: source inherits configuration, marking, and cable color
        effectiveRole = targetPortCfg.role || (targetPortCfg.isTrunk ? 'trunk' : 'access');
        isTrunk = effectiveRole === 'trunk' || effectiveRole === 'uplink' || effectiveRole === 'trunk-ap' || !!targetPortCfg.isTrunk;
        effectiveColor = targetPortCfg.color || ROLE_DEFAULT_COLORS[effectiveRole] || (detectedFiber ? '#facc15' : STATE.selectedCableColor);

        if (sourceDev) {
          if (!sourceDev.portsConfig) sourceDev.portsConfig = {};
          const inheritedCfg = {
            role: effectiveRole,
            isTrunk: isTrunk,
            poeState: targetPortCfg.poeState || 'auto',
            color: effectiveColor,
            vlan: targetPortCfg.vlan || '',
            description: targetPortCfg.description || '',
            ciscoName: targetPortCfg.ciscoName || '',
            autoCableColor: targetPortCfg.autoCableColor !== false
          };
          sourceDev.portsConfig[source.portId] = inheritedCfg;
          const pNumSrc = String(source.portId).replace(/\D+/g, '');
          if (pNumSrc) sourceDev.portsConfig[pNumSrc] = inheritedCfg;
        }
      } else if (isSourceConfigured && isTargetConfigured) {
        // Both already configured: prioritize source for cable attributes
        effectiveRole = sourcePortCfg.role || (sourcePortCfg.isTrunk ? 'trunk' : 'standard');
        isTrunk = effectiveRole === 'trunk' || effectiveRole === 'uplink' || effectiveRole === 'trunk-ap' || !!sourcePortCfg.isTrunk;
        effectiveColor = sourcePortCfg.color || ROLE_DEFAULT_COLORS[effectiveRole] || (detectedFiber ? '#facc15' : STATE.selectedCableColor);
      } else if (detectedFiber) {
        // Single-Mode OS2 Fiber connection auto-recognized
        effectiveRole = 'fiber';
        effectiveColor = detectedFiber.color || '#facc15';
      } else {
        effectiveRole = 'standard';
        effectiveColor = STATE.selectedCableColor;
      }

      function commitConnection(userApproved) {
        if (detectedUplink) {
          if (userApproved) {
            effectiveRole = detectedUplink.role;
            effectiveColor = detectedUplink.color;
            isTrunk = detectedUplink.role === 'trunk' || detectedUplink.role === 'uplink' || !!detectedUplink.isTrunk;

            const autoCfg = {
              role: effectiveRole,
              isTrunk: isTrunk,
              color: effectiveColor,
              description: detectedUplink.reason,
              autoCableColor: true
            };

            if (sourceDev) {
              if (!sourceDev.portsConfig) sourceDev.portsConfig = {};
              sourceDev.portsConfig[source.portId] = autoCfg;
              const pNumSrc = String(source.portId).replace(/\D+/g, '');
              if (pNumSrc) sourceDev.portsConfig[pNumSrc] = autoCfg;
            }
            if (targetDev) {
              if (!targetDev.portsConfig) targetDev.portsConfig = {};
              targetDev.portsConfig[portId] = autoCfg;
              const pNumTgt = String(portId).replace(/\D+/g, '');
              if (pNumTgt) targetDev.portsConfig[pNumTgt] = autoCfg;
            }
          } else {
            effectiveRole = 'standard';
            effectiveColor = STATE.selectedCableColor;
            isTrunk = false;
          }
        } else if (detectedFiber) {
          effectiveRole = 'fiber';
          effectiveColor = detectedFiber.color || '#facc15';
          isTrunk = false;

          const autoFiberCfg = {
            role: 'fiber',
            isTrunk: false,
            color: effectiveColor,
            description: detectedFiber.reason || 'Single-Mode OS2 Fiber Optik',
            autoCableColor: true
          };

          if (sourceDev) {
            if (!sourceDev.portsConfig) sourceDev.portsConfig = {};
            sourceDev.portsConfig[source.portId] = autoFiberCfg;
            const pNumSrc = String(source.portId).replace(/\D+/g, '');
            if (pNumSrc) sourceDev.portsConfig[pNumSrc] = autoFiberCfg;
          }
          if (targetDev) {
            if (!targetDev.portsConfig) targetDev.portsConfig = {};
            targetDev.portsConfig[portId] = autoFiberCfg;
            const pNumTgt = String(portId).replace(/\D+/g, '');
            if (pNumTgt) targetDev.portsConfig[pNumTgt] = autoFiberCfg;
          }
        }

        let rolePrefix = '';
        if (effectiveRole === 'trunk') rolePrefix = '[TRUNK] ';
        else if (effectiveRole === 'uplink') rolePrefix = '[UPLINK] ';
        else if (effectiveRole === 'trunk-ap') rolePrefix = '[AP-TRUNK] ';
        else if (effectiveRole === 'routed') rolePrefix = '[ROUTED] ';
        else if (effectiveRole === 'poe') rolePrefix = '[POE] ';
        else if (effectiveRole === 'mgmt' || effectiveRole === 'management') rolePrefix = '[MGMT] ';
        else if (effectiveRole === 'fiber') rolePrefix = '[FIBER] ';
        else if (isTrunk) rolePrefix = '[TRUNK] ';

        const newCable = {
          id: cableId,
          name: rolePrefix + cableId,
          role: effectiveRole,
          isTrunk: !!isTrunk,
          from: { rackId: source.rackId, instanceId: source.instanceId, portId: source.portId },
          to: { rackId: devRack.id, instanceId, portId },
          color: effectiveColor,
          lengthMeters: calculateCableLengthMeters(source.instanceId, instanceId, isInterRack)
        };

        // Sync to 3D engine if active
        if (window.__STUDIO3D__ && window.__STUDIO3D__.updatePortConfig) {
          try {
            const pIdxSrc = parseInt(String(source.portId).replace(/\D+/g, ''), 10) || 1;
            const pIdxTgt = parseInt(String(portId).replace(/\D+/g, ''), 10) || 1;
            const dev3DSrc = sourceDev?.id || sourceDev?.instanceId;
            const dev3DTgt = targetDev?.id || targetDev?.instanceId;
            if (isSourceConfigured && !isTargetConfigured && dev3DTgt) {
              window.__STUDIO3D__.updatePortConfig(dev3DTgt, pIdxTgt, targetDev.portsConfig[portId]);
            } else if (!isSourceConfigured && isTargetConfigured && dev3DSrc) {
              window.__STUDIO3D__.updatePortConfig(dev3DSrc, pIdxSrc, sourceDev.portsConfig[source.portId]);
            } else if (detectedUplink && userApproved) {
              if (dev3DSrc) window.__STUDIO3D__.updatePortConfig(dev3DSrc, pIdxSrc, sourceDev.portsConfig[source.portId]);
              if (dev3DTgt) window.__STUDIO3D__.updatePortConfig(dev3DTgt, pIdxTgt, targetDev.portsConfig[portId]);
            } else if (detectedFiber && dev3DSrc && dev3DTgt) {
              window.__STUDIO3D__.updatePortConfig(dev3DSrc, pIdxSrc, sourceDev.portsConfig[source.portId]);
              window.__STUDIO3D__.updatePortConfig(dev3DTgt, pIdxTgt, targetDev.portsConfig[portId]);
            }
          } catch (e) {
            console.warn('3D port sync warning:', e);
          }
        }

        STATE.cables.push(newCable);
        cancelPendingConnection();

        if (window.SoundFX) {
          const tgtPort = targetCat?.ports?.find(p => p.id === portId);
          window.SoundFX.playPortClick(tgtPort?.type || 'copper');
        }

        renderMountedDevices();
        renderScheduleTable();
        renderAllCables();

        if (typeof window.sync2Dto3D === 'function') {
          window.sync2Dto3D();
        }
        window.dispatchEvent(new CustomEvent('rackstudio:refresh'));
      }

      if (detectedUplink && detectedUplink.requiresPrompt) {
        const isSwitchToSwitch = !!(detectedUplink.isSwitchToSwitch || detectedUplink.disallowStandard);
        const modalColor = detectedUplink.color || (detectedFiber ? (detectedFiber.color || '#facc15') : '#7c3aed');
        const modalReason = detectedUplink.reason;
        showUplinkVisualConfirmModal({
          role: detectedUplink.role,
          color: modalColor,
          reason: modalReason,
          isSwitchToSwitch: isSwitchToSwitch,
          disallowStandard: detectedUplink.disallowStandard,
          srcDeviceName: sourceDev?.hostname || sourceDev?.name || sourceCat?.name || 'Kaynak',
          srcPortName: srcPort?.name || source.portId,
          tgtDeviceName: targetDev?.hostname || targetDev?.name || targetCat?.name || 'Hedef',
          tgtPortName: tgtPort?.name || portId
        }, (decision) => {
          if (decision === 'cancel') {
            cancelPendingConnection();
            return;
          }
          if (decision === 'trunk' || decision === true) {
            commitConnection(true);
          } else {
            commitConnection(false);
          }
        });
      } else if (detectedUplink && !detectedUplink.requiresPrompt) {
        // Dedicated hardware uplink / SFP port: connect automatically without blocking modal
        commitConnection(true);
      } else if (detectedFiber && !detectedFiber.requiresPrompt) {
        commitConnection(true);
      } else {
        commitConnection(false);
      }
    }
  }

  function findRoutingOrganizers(rack, devA, devB) {
    if (!rack || !rack.devices || !devA || !devB) return [];
    const minU = Math.min(devA.topU, devB.topU);
    const maxU = Math.max(devA.topU, devB.topU);

    return rack.devices.filter(d => {
      const cat = HARDWARE_CATALOG[d.catalogKey];
      if (!cat || cat.category !== 'organizer') return false;
      const u = Number(d.topU);
      return (u >= minU && u <= maxU) || Math.abs(u - devA.topU) <= 1 || Math.abs(u - devB.topU) <= 1;
    }).sort((a, b) => {
      return devA.topU > devB.topU ? (b.topU - a.topU) : (a.topU - b.topU);
    });
  }

  function calculateCableLengthMeters(instA, instB, isInterRack) {
    if (isInterRack) {
      if (STATE.cableRoutingMode === 'direct') {
        return 3.0; // Direct aerial jumper between adjacent cabinets
      }
      // Inter-rack structured tie cable (overhead ladder rack + vertical drops + service loops)
      const baseTieRun = 14.0;
      return parseFloat((baseTieRun * 1.10).toFixed(2)); // 15.40m
    }
    const activeRack = getActiveRack();
    if (!activeRack) return 1.5;
    const devA = activeRack.devices.find(d => d.instanceId === instA);
    const devB = activeRack.devices.find(d => d.instanceId === instB);
    if (!devA || !devB) return 1.5;

    const uDiff = Math.abs(devA.topU - devB.topU);
    const catA = HARDWARE_CATALOG[devA.catalogKey];
    const catB = HARDWARE_CATALOG[devB.catalogKey];
    const isFiber = (catA && catA.category === 'fiber') || (catB && catB.category === 'fiber') ||
                    (devA.portsConfig && Object.values(devA.portsConfig).some(c => c.role === 'fiber')) ||
                    (devB.portsConfig && Object.values(devB.portsConfig).some(c => c.role === 'fiber'));

    // Routing Mode: Direct (Sıkı Doğrudan) vs Structured (Yapısal Kanal)
    const isDirect = STATE.cableRoutingMode === 'direct';
    if (isDirect) {
      // Sıkı Doğrudan: Point-to-Point direct patch cord between adjacent patch panels and switches.
      // 1. Direct vertical distance between ports: uDiff * 0.0445m (1U = 44.45mm EIA-310-D)
      // 2. Direct horizontal span / curve allowance: 0.12m
      // 3. Connector & bend radius allowance: 0.08m (copper) / 0.12m (fiber)
      // For adjacent devices (uDiff <= 1): (1 * 0.0445) + 0.12 + 0.08 = ~0.25m -> standard 30cm short patch cord!
      const directVertical = uDiff * 0.0445;
      const directHorizontal = 0.12;
      const directBend = isFiber ? 0.12 : 0.08;
      const rawDirect = directVertical + directHorizontal + directBend;
      const withMargin = rawDirect * 1.05;
      return Math.max(0.25, parseFloat(withMargin.toFixed(2)));
    }

    const routingOrganizers = findRoutingOrganizers(activeRack, devA, devB);
    const hasOrganizer = routingOrganizers.length > 0;

    // Field Metrology Standard (Yapısal Yan Kanal):
    // 1. Horizontal duct traverse: 2x 0.25m = 0.50m (port to vertical wire manager)
    // 2. Vertical duct traverse: uDiff * 0.0445m (1U = 44.45mm EIA-310-D)
    // 3. Horizontal wire manager / brush organizer traversal: 0.25m
    // 4. Bend radius & dressing allowance: 0.15m copper / 0.20m fiber
    // 5. Field Service Loop (Servis Halkası Payı): +10% standard margin
    const horizontalToDuct = 0.50;
    const verticalDuct = uDiff * 0.0445;
    let organizerAllowance = 0.0;
    if (hasOrganizer) {
      const hasBrush = routingOrganizers.some(d => {
        const c = HARDWARE_CATALOG[d.catalogKey];
        return d.catalogKey === 'organizer-1u' || (c?.modelTag && c.modelTag.includes('BRUSH')) || (c?.name && c.name.toLowerCase().includes('fırça'));
      });
      const hasFinger = routingOrganizers.some(d => {
        const c = HARDWARE_CATALOG[d.catalogKey];
        return d.catalogKey === 'organizer-2u' || (c?.modelTag && c.modelTag.includes('FINGER')) || (c?.name && c.name.toLowerCase().includes('parmak'));
      });
      if (hasBrush) organizerAllowance = 0.35; // Front-to-rear brush pass-through traverse
      else if (hasFinger) organizerAllowance = 0.25; // 2U internal slotted duct channel traverse
      else organizerAllowance = 0.20; // D-Ring hoop loop traverse
    }
    const bendRadiusAllowance = isFiber ? 0.20 : 0.15;

    const rawLength = horizontalToDuct + verticalDuct + organizerAllowance + bendRadiusAllowance;
    const withServiceLoop = rawLength * 1.10;

    return Math.max(0.5, parseFloat(withServiceLoop.toFixed(2)));
  }

  RS.renderRackRailsAndSlots = renderRackRailsAndSlots;
  RS.refreshVisibleRackContent = refreshVisibleRackContent;
  RS.mountDeviceAt = mountDeviceAt;
  RS.removeDevice = removeDevice;
  RS.clearRackCables = clearRackCables;
  RS.clearRackDevices = clearRackDevices;
  RS.clearDeviceCables = clearDeviceCables;
  RS.updateDeviceMetadata = updateDeviceMetadata;
  RS.renderMountedDevices = renderMountedDevices;
  RS.renderRouterFaceplate = renderRouterFaceplate;
  RS.renderOrganizerFaceplate = renderOrganizerFaceplate;
  RS.renderBlankFaceplate = renderBlankFaceplate;
  RS.renderSwitchOrPatchFaceplate = renderSwitchOrPatchFaceplate;
  RS.renderPortIcon = renderPortIcon;
  RS.bindPortInteractions = bindPortInteractions;
  RS.handlePortHover = handlePortHover;
  RS.handlePortLeave = handlePortLeave;
  RS.handlePortClick = handlePortClick;
  RS.findRoutingOrganizers = findRoutingOrganizers;
  RS.calculateCableLengthMeters = calculateCableLengthMeters;
})();
