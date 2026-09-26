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
    leftU.dataset.u = u;
    leftU.dataset.rackId = rack.id;
    leftU.innerHTML = `
      <div class="rack-holes">
        <div class="hole"></div>
        <div class="hole"></div>
        <div class="hole"></div>
      </div>
      <div class="u-label interactive-u-label" data-u="${u}" data-rack-id="${rack.id}" title="U ${u} — Araya U Ekle / Boşluğu Kapat / Çoklu Seçim"><span class="u-num">${u}</span><span class="u-dot">▾</span></div>
    `;

    const rightU = document.createElement('div');
    rightU.className = 'u-unit';
    rightU.dataset.u = u;
    rightU.dataset.rackId = rack.id;
    rightU.innerHTML = `
      <div class="u-label interactive-u-label" data-u="${u}" data-rack-id="${rack.id}" title="U ${u} — Araya U Ekle / Boşluğu Kapat / Çoklu Seçim"><span class="u-num">${u}</span><span class="u-dot">▾</span></div>
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

    // Listeners are delegated at #rack-stage for high performance

    return { leftU, rightU, slot };
  }

  // --- RACK MODULE ---

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
  let rackViewportEntries = [];
  let rackViewportMaxBottom = 0;
  let rackViewportBottoms = [];
  let rackViewportSignature = null;
  let rackViewportSize = { width: 0, height: 0 };
  let rackViewportResizeObserver = null;
  const rackViewportTelemetry = {
    passes: 0,
    racksTested: 0,
    visibilityChanges: 0,
    paintContainmentChanges: 0,
    unchangedSkips: 0,
    visibleRacks: 0,
    culledRacks: 0,
    signatureSkips: 0
  };

  function rebuildRackViewportEntries(rackStage) {
    rackViewportEntries = Array.from(rackStage?.querySelectorAll('.rack-container[data-rack-id]') || []).map((container, index) => {
      const rack = STATE.racks.find(candidate => candidate.id === container.dataset.rackId);
      const left = 60 + index * (634 + 64);
      return {
        container,
        left,
        right: left + 634,
        top: 10,
        bottom: 76 + (rack?.heightU || 42) * 32 + 84
      };
    });
    rackViewportMaxBottom = rackViewportEntries.reduce((max, entry) => Math.max(max, entry.bottom), 0);
    rackViewportBottoms = [...new Set(rackViewportEntries.map(entry => entry.bottom))].sort((a, b) => a - b);
    rackViewportSignature = null;
  }

  function observeRackViewportSize(canvas) {
    const updateSize = () => {
      const width = Math.max(0, canvas.clientWidth || 0);
      const height = Math.max(0, canvas.clientHeight || 0);
      if (width === rackViewportSize.width && height === rackViewportSize.height) return;
      rackViewportSize = { width, height };
      rackViewportSignature = null;
      syncRackViewportVisibility(RS.ZOOM_STATE);
    };
    rackViewportResizeObserver?.disconnect();
    rackViewportResizeObserver = null;
    updateSize();
    if (typeof ResizeObserver === 'function') {
      rackViewportResizeObserver = new ResizeObserver(updateSize);
      rackViewportResizeObserver.observe(canvas);
    }
  }

  function syncRackViewportVisibility(camera = RS.ZOOM_STATE || {}) {
    const rackStage = dom.rackStage || document.getElementById('rack-stage');
    const canvas = dom.viewportCanvas || document.getElementById('viewport-canvas');
    const entries = rackViewportEntries.length
      ? rackViewportEntries
      : Array.from(rackStage?.querySelectorAll('.rack-container[data-rack-id]') || []).map(container => ({ container }));
    const isMulti = STATE.viewMode === 'multi' && entries.length > 1;
    if (!isMulti || !canvas) {
      entries.forEach(({ container }) => {
        container.style.visibility = '';
        container.style.contentVisibility = '';
        delete container.dataset.viewportVisible;
      });
      rackViewportTelemetry.visibleRacks = entries.length;
      rackViewportTelemetry.culledRacks = 0;
      rackViewportSignature = null;
      return false;
    }

    const scale = Number.isFinite(camera.scale) && camera.scale > 0 ? camera.scale : 1;
    const viewportWorldLeft = -(camera.panX || 0) / scale;
    const viewportWorldTop = -(camera.panY || 0) / scale;
    const viewportWorldWidth = rackViewportSize.width / scale;
    const viewportWorldHeight = rackViewportSize.height / scale;
    const marginX = Math.max(320, viewportWorldWidth * 0.35);
    const marginY = Math.max(180, viewportWorldHeight * 0.2);
    const minX = viewportWorldLeft - marginX;
    const maxX = viewportWorldLeft + viewportWorldWidth + marginX;
    const minY = viewportWorldTop - marginY;
    const maxY = viewportWorldTop + viewportWorldHeight + marginY;
    const firstRack = Math.max(0, Math.ceil((minX - 60 - 634) / (634 + 64)));
    const lastRack = Math.min(entries.length - 1, Math.floor((maxX - 60) / (634 + 64)));
    const verticalVisible = maxY >= 10 && minY <= rackViewportMaxBottom;
    // Every distinct cabinet height is a visibility boundary. The tallest
    // cabinet alone cannot describe shorter cabinets leaving/reentering view.
    let low = 0;
    let high = rackViewportBottoms.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (rackViewportBottoms[middle] < minY) low = middle + 1;
      else high = middle;
    }
    const signature = `${firstRack}:${lastRack}:${verticalVisible ? 1 : 0}:${low}:${entries.length}`;
    if (signature === rackViewportSignature) {
      rackViewportTelemetry.signatureSkips++;
      rackViewportTelemetry.unchangedSkips += entries.length;
      return false;
    }
    rackViewportSignature = signature;
    let visibleRacks = 0;
    let culledRacks = 0;
    rackViewportTelemetry.passes++;

    entries.forEach(({ container, left, right, top, bottom }, index) => {
      const visible = verticalVisible && index >= firstRack && index <= lastRack && right >= minX && left <= maxX && bottom >= minY && top <= maxY;
      const next = visible ? 'true' : 'false';
      rackViewportTelemetry.racksTested++;
      if (visible) visibleRacks++;
      else culledRacks++;
      if (container.dataset.viewportVisible === next) {
        rackViewportTelemetry.unchangedSkips++;
        return;
      }
      container.dataset.viewportVisible = next;
      container.style.visibility = visible ? 'visible' : 'hidden';
      const contentVisibility = visible ? 'auto' : 'hidden';
      if (container.style.contentVisibility !== contentVisibility) {
        container.style.contentVisibility = contentVisibility;
        rackViewportTelemetry.paintContainmentChanges++;
      }
      rackViewportTelemetry.visibilityChanges++;
    });
    rackViewportTelemetry.visibleRacks = visibleRacks;
    rackViewportTelemetry.culledRacks = culledRacks;
    return true;
  }

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
    syncRackViewportVisibility(RS.ZOOM_STATE);
    if (changed && renderChanges) {
      renderMountedDevices();
      if (typeof RS.renderAllCables === 'function') RS.renderAllCables();
    }
    return changed;
  }

  function configureMultiRackVisibility(rackStage, isMulti) {
    rackVisibilityObserver?.disconnect();
    rackVisibilityObserver = null;
    rackViewportResizeObserver?.disconnect();
    rackViewportResizeObserver = null;
    rackViewportEntries.forEach(({ container }) => {
      container.style.visibility = '';
      container.style.contentVisibility = '';
      delete container.dataset.viewportVisible;
    });
    rackViewportEntries = [];
    rackViewportMaxBottom = 0;
    rackViewportBottoms = [];
    rackViewportSignature = null;
    rackViewportSize = { width: 0, height: 0 };
    if (!isMulti) return;

    const canvas = dom.viewportCanvas || document.getElementById('viewport-canvas');
    const containers = Array.from(rackStage.querySelectorAll('.rack-container[data-rack-id]'));
    if (!canvas || !containers.length) return;

    rebuildRackViewportEntries(rackStage);
    observeRackViewportSize(canvas);

    const nativeVirtualization = typeof CSS !== 'undefined' && CSS.supports?.('content-visibility', 'auto');
    rackStage.dataset.nativeRackVirtualization = nativeVirtualization ? 'true' : 'false';
    containers.forEach(container => {
      const rack = STATE.racks.find(candidate => candidate.id === container.dataset.rackId);
      container.style.setProperty('--rack-intrinsic-height', `${(rack?.heightU || 42) * 32 + 84}px`);
    });

    if (containers.length <= 20) {
      containers.forEach(container => { container.dataset.virtualVisible = 'true'; });
      syncRackViewportVisibility(RS.ZOOM_STATE);
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
                <span class="rack-header-rename-hint" title="Adı düzenle"></span>
              </span>
              <span class="rack-header-standard-badge" title="EIA-310-D Standart 19 İnç Kabin Çerçevesi">EIA-310-D Standard</span>
              <span class="rack-header-actions">
                <button class="rack-action-btn rack-hdr-clear-cables" data-rack-id="${activeRack.id}" title="Bu kabindeki tüm kabloları temizle / sök">Kablo</button>
                <button class="rack-action-btn danger rack-hdr-clear-devices" data-rack-id="${activeRack.id}" title="Bu kabindeki tüm cihazları ve kablolarını boşalt">Cihaz</button>
                <button class="rack-action-btn rack-hdr-duplicate" data-rack-id="${activeRack.id}" title="Kabini ve Cihazlarını Çoğalt (Yeni Kabin)">Klon</button>
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
          <svg class="cables-svg-layer" id="cables-svg" viewBox="0 0 618 ${heightU * 32}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" style="display:none;">
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
        RS._bindRackResizeHandle?.(resizeHandle, activeRack);
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
      RS._injectFloatingRackButtons?.(activeRack);

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
        const iconServer = window.getLucideIconSvg ? window.getLucideIconSvg('Server', 14) : '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect width="20" height="8" x="2" y="2" rx="2"/><rect width="20" height="8" x="2" y="14" rx="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/></svg>';
        const iconLeft = window.getLucideIconSvg ? window.getLucideIconSvg('ArrowLeft', 12) : '←';
        const iconRight = window.getLucideIconSvg ? window.getLucideIconSvg('ArrowRight', 12) : '→';
        const iconCables = window.getLucideIconSvg ? window.getLucideIconSvg('Unplug', 12) : '';
        const iconDevices = window.getLucideIconSvg ? window.getLucideIconSvg('Trash2', 12) : '';
        const iconDuplicate = window.getLucideIconSvg ? window.getLucideIconSvg('Copy', 12) : '';
        const iconDelete = window.getLucideIconSvg ? window.getLucideIconSvg('Trash2', 12) : '✕';
        headerPlate.innerHTML = `
          <div class="rack-header-top-tier">
            <span class="rack-header-title">
              ${iconServer}
              <span class="rack-header-name-editable" data-rack-id="${rack.id}" title="Adı düzenlemek için tıklayın">${escapeHtml(rack.name)}</span>
              <span class="rack-header-rename-hint" title="Adı düzenle"></span>
            </span>
            <span class="rack-header-standard-badge" title="EIA-310-D Standart 19 İnç Kabin Çerçevesi">EIA-310-D Standard</span>
            <span class="rack-header-actions">
              <button class="rack-action-btn rack-hdr-move-left" data-rack-id="${rack.id}" title="Kabini Sola Taşı"><span class="rack-action-icon">${iconLeft}</span><span class="rack-action-label">Sola</span></button>
              <button class="rack-action-btn rack-hdr-move-right" data-rack-id="${rack.id}" title="Kabini Sağa Taşı"><span class="rack-action-icon">${iconRight}</span><span class="rack-action-label">Sağa</span></button>
              <button class="rack-action-btn rack-hdr-clear-cables" data-rack-id="${rack.id}" title="Bu kabindeki tüm kabloları temizle / sök"><span class="rack-action-icon">${iconCables}</span><span class="rack-action-label">Kablo</span></button>
              <button class="rack-action-btn danger rack-hdr-clear-devices" data-rack-id="${rack.id}" title="Bu kabindeki tüm cihazları ve kablolarını boşalt"><span class="rack-action-icon">${iconDevices}</span><span class="rack-action-label">Cihaz</span></button>
              <button class="rack-action-btn rack-hdr-duplicate" data-rack-id="${rack.id}" title="Kabini ve Cihazlarını Çoğalt"><span class="rack-action-icon">${iconDuplicate}</span><span class="rack-action-label">Klon</span></button>
              ${canDelete ? `<button class="rack-action-btn danger rack-hdr-delete" data-rack-id="${rack.id}" title="Kabini Sil"><span class="rack-action-icon">${iconDelete}</span><span class="rack-action-label">Sil</span></button>` : ''}
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
          if (RS.isDraggingDevice || RS.ZOOM_STATE?.hasMoved || RS.isSpacePressed) return;
          if (e.target.closest('.port, button, input, select, textarea, .dev-btn, .rack-action-btn, .rack-header-name-editable, .color-swatch, .quick-hud-container, .popover-menu')) return;
          if (STATE.activeRackId !== rack.id) {
            switchActiveRack(rack.id, { smoothFocus: false });
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
        RS._bindRackResizeHandle?.(resizeHandle, rack);

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
    ensureRackStageDelegation();
  }

  RS.createRackUnitAndSlot = createRackUnitAndSlot;
  RS.getRackTelemetry = getRackTelemetry;
  RS.updateRackHeaderTelemetry = updateRackHeaderTelemetry;
  RS.refreshVisibleRackContent = refreshVisibleRackContent;
  RS.configureMultiRackVisibility = configureMultiRackVisibility;
  RS.syncRackViewportVisibility = syncRackViewportVisibility;
  RS.getRackVirtualizationState = () => {
    const stage = dom.rackStage || document.getElementById('rack-stage');
    const racks = Array.from(stage?.querySelectorAll('.rack-container[data-rack-id]') || []);
    return {
      enabled: stage?.dataset.nativeRackVirtualization === 'true',
      rackCount: racks.length,
      browserManagedRackCount: racks.filter(rack => getComputedStyle(rack).contentVisibility === 'auto').length,
      paintSuppressedRackCount: racks.filter(rack => getComputedStyle(rack).contentVisibility === 'hidden').length,
      observerManagedRackCount: racks.filter(rack => rack.dataset.virtualVisible === 'false').length,
      viewportVisibleRackCount: rackViewportTelemetry.visibleRacks,
      viewportCulledRackCount: rackViewportTelemetry.culledRacks,
      viewportPasses: rackViewportTelemetry.passes,
      viewportRacksTested: rackViewportTelemetry.racksTested,
      viewportVisibilityChanges: rackViewportTelemetry.visibilityChanges,
      viewportPaintContainmentChanges: rackViewportTelemetry.paintContainmentChanges,
      viewportUnchangedSkips: rackViewportTelemetry.unchangedSkips,
      viewportSignatureSkips: rackViewportTelemetry.signatureSkips
    };
  };

  const ensureRackStageDelegation = () => RS.ensureRackStageDelegation?.();

  RS.renderRackRailsAndSlots = renderRackRailsAndSlots;
})();
