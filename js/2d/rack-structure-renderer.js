/**
 * Cisco Enterprise Rack & Cabling Studio - Rack Structure Renderer Module
 * Handles physical rack slots (U1–U60), rails, canopy telemetry badges, floating rack controls,
 * and multi-rack container layout.
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
  const highlightDropSlots = (...args) => RS.highlightDropSlots && RS.highlightDropSlots(...args);
  const renderRackTabs = () => RS.renderRackTabs && RS.renderRackTabs();
  const switchActiveRack = (...args) => RS.switchActiveRack && RS.switchActiveRack(...args);
  const initDomReferences = () => RS.initDomReferences && RS.initDomReferences();
  const renderMountedDevices = () => RS.renderMountedDevices && RS.renderMountedDevices();
  const clearRackDevices = (...args) => RS.clearRackDevices && RS.clearRackDevices(...args);
  const clearRackCables = (...args) => RS.clearRackCables && RS.clearRackCables(...args);

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

  let rackVisibilityObserver = null;
  let rackVisibilityRefreshFrame = 0;

  function refreshVisibleRackContent(renderChanges = true) {
    if (STATE.viewMode !== 'multi') return false;
    const canvas = dom.viewportCanvas || document.getElementById('viewport-canvas');
    const rackStage = dom.rackStage || document.getElementById('rack-stage');
    if (!canvas || !rackStage) return false;
    const containers = Array.from(rackStage.querySelectorAll('.rack-container[data-rack-id]'));
    if (!containers.length) return false;

    // In normal multi-rack topologies (<= 20 racks), keep all racks stably mounted in DOM.
    // Tearing down and recreating devices mid-pan causes micro-stutters and appearance shifts.
    if (containers.length <= 20) {
      let changed = false;
      containers.forEach(container => {
        if (container.dataset.virtualVisible !== 'true') {
          container.dataset.virtualVisible = 'true';
          changed = true;
        }
      });
      return changed;
    }

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

    if (containers.length <= 20) {
      containers.forEach(container => { container.dataset.virtualVisible = 'true'; });
      return;
    }

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
                <button class="rack-action-btn rack-hdr-clear-cables" data-rack-id="${activeRack.id}" title="Bu kabindeki tüm kabloları temizle / sök">🧹 Kablo</button>
                <button class="rack-action-btn danger rack-hdr-clear-devices" data-rack-id="${activeRack.id}" title="Bu kabindeki tüm cihazları ve kablolarını boşalt">🗑️ Cihaz</button>
                <button class="rack-action-btn rack-hdr-duplicate" data-rack-id="${activeRack.id}" title="Kabini ve Cihazlarını Çoğalt (Yeni Kabin)">⧉ Klon</button>
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
          <svg class="cables-svg-layer" id="cables-svg" viewBox="0 0 618 ${heightU * 32}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" style="display:${STATE.cableRenderMode === 'pixi' ? 'none' : 'block'};">
            <defs>
              <filter id="cable-shadow" x="-10%" y="-10%" width="120%" height="120%">
                <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.6"/>
              </filter>
            </defs>
            <g id="cables-group"></g>
            <g id="connectors-group"></g>
            <g id="dring-overlay-group"></g>
          </svg>
          ${STATE.pixiViewportRendererV2 === false ? `<canvas class="cables-pixi-layer" id="cables-pixi-canvas" style="display:${STATE.cableRenderMode === 'pixi' ? 'block' : 'none'};"></canvas>` : ''}
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
      if (STATE.cableRenderMode === 'pixi') {
        svg.style.display = 'none';
      }
      rackStage.appendChild(svg);

      if (STATE.pixiViewportRendererV2 === false) {
        const pCanvas = document.createElement('canvas');
        pCanvas.id = 'cables-pixi-canvas';
        pCanvas.className = 'cables-pixi-layer';
        pCanvas.style.display = STATE.cableRenderMode === 'pixi' ? 'block' : 'none';
        rackStage.appendChild(pCanvas);
      }

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
              <button class="rack-action-btn rack-hdr-move-left" data-rack-id="${rack.id}" title="Kabini Sola Taşı"><span class="rack-action-icon">←</span><span class="rack-action-label">Sola</span></button>
              <button class="rack-action-btn rack-hdr-move-right" data-rack-id="${rack.id}" title="Kabini Sağa Taşı"><span class="rack-action-icon">→</span><span class="rack-action-label">Sağa</span></button>
              <button class="rack-action-btn rack-hdr-clear-cables" data-rack-id="${rack.id}" title="Bu kabindeki tüm kabloları temizle / sök"><span class="rack-action-icon">🧹</span><span class="rack-action-label">Kablo</span></button>
              <button class="rack-action-btn danger rack-hdr-clear-devices" data-rack-id="${rack.id}" title="Bu kabindeki tüm cihazları ve kablolarını boşalt"><span class="rack-action-icon">🗑️</span><span class="rack-action-label">Cihaz</span></button>
              <button class="rack-action-btn rack-hdr-duplicate" data-rack-id="${rack.id}" title="Kabini ve Cihazlarını Çoğalt"><span class="rack-action-icon">⧉</span><span class="rack-action-label">Klon</span></button>
              ${canDelete ? `<button class="rack-action-btn danger rack-hdr-delete" data-rack-id="${rack.id}" title="Kabini Sil"><span class="rack-action-icon">✕</span><span class="rack-action-label">Sil</span></button>` : ''}
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

  RS.createRackUnitAndSlot = createRackUnitAndSlot;
  RS._injectFloatingRackButtons = _injectFloatingRackButtons;
  RS._bindRackResizeHandle = _bindRackResizeHandle;
  RS.getRackTelemetry = getRackTelemetry;
  RS.updateRackHeaderTelemetry = updateRackHeaderTelemetry;
  RS.refreshVisibleRackContent = refreshVisibleRackContent;
  RS.configureMultiRackVisibility = configureMultiRackVisibility;
  RS.renderRackRailsAndSlots = renderRackRailsAndSlots;
})();
