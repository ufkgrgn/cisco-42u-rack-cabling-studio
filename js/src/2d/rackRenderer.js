/**
 * Rack Renderer Module (Rail slots, faceplates, drag & drop mounting)
 */
import { STATE, dom, getActiveRack, ZOOM_STATE, initDomReferences } from './state.js';
import { HARDWARE_CATALOG } from './catalogData.js';
import { escapeHtml, showTemporaryTooltip } from './utils.js';
import { renderAllCables, cancelPendingConnection, highlightDropSlots, highlightCable, showCableQuickHud } from './cablingEngine.js';
import { renderScheduleTable } from './scheduleTable.js';
import { renderRackTabs, switchActiveRack } from './rackManager.js';

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
  if (isSingleOrActive) {
    slot.id = `rack-slot-u${u}`;
  } else {
    slot.id = `rack-${rack.id}-slot-u${u}`;
  }

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
  function renderRackRailsAndSlots(onSlotClick) {
    if (typeof onSlotClick === 'function') STATE.onSlotClick = onSlotClick;
    const clickHandler = typeof onSlotClick === 'function' ? onSlotClick : STATE.onSlotClick;
    const rackStage = dom.rackStage || document.getElementById('rack-stage');
    if (!rackStage) return;

    const isMulti = STATE.viewMode === 'multi' && STATE.racks && STATE.racks.length > 1;
    rackStage.classList.toggle('multi-rack-stage', isMulti);

    if (!isMulti) {
      // SINGLE RACK FOCUS MODE
      let container = document.getElementById('rack-container');
      if (!container) {
        rackStage.innerHTML = `
          <div class="rack-container" id="rack-container">
            <div class="rack-rail left" id="rail-left"></div>
            <div class="rack-main-space" id="rack-space"></div>
            <div class="rack-rail right" id="rail-right"></div>
            <svg class="cables-svg-layer" id="cables-svg" viewBox="0 0 618 1344" xmlns="http://www.w3.org/2000/svg">
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
      } else {
        rackStage.querySelectorAll('.rack-container').forEach(c => {
          if (c !== container) c.remove();
        });
        container.classList.remove('active-rack-target');
        const existingPlate = container.querySelector('.rack-header-plate');
        if (existingPlate) existingPlate.remove();

        const svg = document.getElementById('cables-svg');
        if (svg && svg.parentElement !== container) {
          container.appendChild(svg);
        }
      }

      initDomReferences();
      if (!dom.railLeft || !dom.railRight || !dom.rackSpace) return;
      dom.railLeft.innerHTML = '';
      dom.railRight.innerHTML = '';
      dom.rackSpace.innerHTML = '';

      const activeRack = getActiveRack();
      const heightU = activeRack?.heightU || 42;
      if (dom.cablesSvg) dom.cablesSvg.setAttribute("viewBox", `0 0 618 ${heightU * 32}`);

      for (let u = heightU; u >= 1; u--) {
        const { leftU, rightU, slot } = createRackUnitAndSlot(activeRack, u, clickHandler, true);
        dom.railLeft.appendChild(leftU);
        dom.railRight.appendChild(rightU);
        dom.rackSpace.appendChild(slot);
      }
    } else {
      // MULTI-RACK (SIDE-BY-SIDE) MODE
      rackStage.querySelectorAll('.rack-container').forEach(c => c.remove());

      let svg = document.getElementById('cables-svg');
      if (!svg) {
        svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'cables-svg-layer');
        svg.setAttribute('id', 'cables-svg');
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
      }
      rackStage.appendChild(svg);

      const numRacks = STATE.racks.length;
      const maxU = Math.max(...STATE.racks.map(r => r.heightU || 42));
      const baseW = numRacks * 634 + (numRacks - 1) * 64 + 120;
      const baseH = maxU * 32 + 156;
      svg.setAttribute('viewBox', `0 0 ${baseW} ${baseH}`);

      STATE.racks.forEach((rack) => {
        const isAct = rack.id === STATE.activeRackId;
        const cont = document.createElement('div');
        cont.className = `rack-container ${isAct ? 'active-rack-target' : ''}`;
        cont.dataset.rackId = rack.id;
        if (isAct) {
          cont.id = 'rack-container';
        } else {
          cont.id = `rack-container-${rack.id}`;
        }

        const headerPlate = document.createElement('div');
        headerPlate.className = 'rack-header-plate';
        headerPlate.dataset.rackId = rack.id;
        headerPlate.innerHTML = `
          <span class="rack-header-title">
            <svg width="12" height="12" fill="currentColor" viewBox="0 0 16 16"><path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v1.077a2.5 2.5 0 0 1-.95 1.956L4.5 6.786V14.5a.5.5 0 0 0 .5.5h6a.5.5 0 0 0 .5-.5V6.786l-1.55-1.253A2.5 2.5 0 0 1 9 3.577V2.5A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v11a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 13.5v-11z"/></svg>
            ${escapeHtml(rack.name)}
          </span>
          <span class="rack-header-meta">${rack.heightU || 42}U · ${rack.devices ? rack.devices.length : 0} Cihaz</span>
        `;
        cont.appendChild(headerPlate);

        cont.addEventListener('click', (e) => {
          if (e.target.closest('.port') || e.target.closest('.dev-btn')) return;
          if (STATE.activeRackId !== rack.id) {
            switchActiveRack(rack.id);
          }
        });

        const railL = document.createElement('div');
        railL.className = 'rack-rail left';
        if (isAct) railL.id = 'rail-left';
        else railL.id = `rail-left-${rack.id}`;
        cont.appendChild(railL);

        const space = document.createElement('div');
        space.className = 'rack-main-space';
        if (isAct) space.id = 'rack-space';
        else space.id = `rack-space-${rack.id}`;
        cont.appendChild(space);

        const railR = document.createElement('div');
        railR.className = 'rack-rail right';
        if (isAct) railR.id = 'rail-right';
        else railR.id = `rail-right-${rack.id}`;
        cont.appendChild(railR);

        const rHeightU = rack.heightU || 42;
        for (let u = rHeightU; u >= 1; u--) {
          const { leftU, rightU, slot } = createRackUnitAndSlot(rack, u, clickHandler, isAct);
          railL.appendChild(leftU);
          railR.appendChild(rightU);
          space.appendChild(slot);
        }

        rackStage.appendChild(cont);
      });

      initDomReferences();
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
    return devObj;
  }

  function removeDevice(instanceId) {
    const activeRack = getActiveRack();
    if (!activeRack) return;

    STATE.cables = STATE.cables.filter(c => c.from.instanceId !== instanceId && c.to.instanceId !== instanceId);

    for (let u = 1; u <= (activeRack.heightU || 42); u++) {
      if (activeRack.units[u] === instanceId) {
        activeRack.units[u] = null;
      }
    }

    activeRack.devices = activeRack.devices.filter(d => d.instanceId !== instanceId);

    if (STATE.pendingConnection && STATE.pendingConnection.instanceId === instanceId) {
      cancelPendingConnection();
    }

    renderRackTabs();
    renderMountedDevices();
    renderScheduleTable();
    renderAllCables();
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

  function renderMountedDevices() {
    // Remove all currently mounted device elements
    document.querySelectorAll('.mounted-device').forEach(el => el.remove());

    const isMulti = STATE.viewMode === 'multi' && STATE.racks && STATE.racks.length > 1;
    const racksToRender = isMulti ? STATE.racks : [getActiveRack()].filter(Boolean);

    if (!racksToRender.length) return;

    // Ensure slots exist for active rack
    const activeRack = getActiveRack();
    if (!isMulti && dom.rackSpace && dom.rackSpace.querySelectorAll('.rack-slot').length !== (activeRack?.heightU || 42)) {
      renderRackRailsAndSlots();
    }

    occupiedPortKeys = new Set(STATE.cables.flatMap(c => [portKey(c.from.instanceId, c.from.portId), portKey(c.to.instanceId, c.to.portId)]));

    racksToRender.forEach(rack => {
      if (!rack) return;
      rack.devices.forEach(dev => {
        const cat = HARDWARE_CATALOG[dev.catalogKey];
        if (!cat) return;

        // Find the slot element for this device - in multi mode, use rack-specific slot IDs
        const isActiveRack = rack.id === STATE.activeRackId;
        let slotEl = null;
        if (isActiveRack || !isMulti) {
          slotEl = document.getElementById(`rack-slot-u${dev.topU}`);
        } else {
          slotEl = document.getElementById(`rack-${rack.id}-slot-u${dev.topU}`);
        }
        if (!slotEl) return;

        const devEl = document.createElement('div');
        devEl.className = 'mounted-device';
        devEl.id = dev.instanceId;
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
            if (e.target.closest('.port, .del-device-btn')) return;
            window.DeviceMetadataEditor?.open2D(dev.instanceId);
          });
          devEl.querySelector('.bezel-badge')?.addEventListener('click', (e) => {
            e.stopPropagation();
            window.DeviceMetadataEditor?.open2D(dev.instanceId);
          });
        }

        const delBtn = devEl.querySelector('.del-device-btn');
        if (delBtn) {
          delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(`${escapeHtml(cat.name)} cihazını ve bağlı kablolarını kaldırmak istiyor musunuz?`)) {
              removeDevice(dev.instanceId);
            }
          });
        }
      });
    });

    bindPortInteractions();
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

    return `
      <div class="device-faceplate" style="background:linear-gradient(90deg, #131b2c 0%, #1e293b 100%);">
        <div class="device-controls">
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
        <div class="organizer-faceplate dring-faceplate">
          <div class="device-controls">
            <button class="dev-btn del-device-btn" title="Cihazı Kaldır">✕</button>
          </div>
          <div class="dring-ring-container">
            ${rings}
          </div>
        </div>
      `;
    }

    return `
      <div class="organizer-faceplate" style="${is2U ? 'background: #0d121c;' : ''}">
        <div class="device-controls">
          <button class="dev-btn del-device-btn" title="Cihazı Kaldır">✕</button>
        </div>
        <div style="font-size:0.6rem; color:#64748b; font-family:monospace; font-weight:700; padding:0 8px;">
          ${escapeHtml(cat.modelTag)}
        </div>
        <div class="organizer-brush" style="${is2U ? 'height:24px;' : ''}"></div>
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

  function renderSwitchOrPatchFaceplate(cat, dev) {
    const isRouter = cat.category === 'router';
    const isSwitch = cat.category === 'switch' || cat.category === 'fiber-switch' || isRouter;
    const isFiberPanel = cat.category === 'fiber';
    const isPatchPanel = cat.category === 'patch' || isFiberPanel;
    const typeLabel = isRouter ? 'ROUTER' : isSwitch ? 'SWITCH' : isFiberPanel ? 'FIBER PANEL' : 'PATCH PANEL';
    const typeClass = isSwitch ? 'faceplate-switch' : isFiberPanel ? 'faceplate-fiber-panel' : 'faceplate-patch-panel';
    const configuredLabel = isPatchPanel
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
      const bayClass = isUplinkGroup ? 'cisco-uplink-bay' : (isPatchPanel ? 'patch-port-bay' : 'cisco-port-bay');

      let patchStrip = '';
      if (isPatchPanel && groupPorts.length > 0) {
        const firstPortName = groupPorts[0]?.name || '1';
        const lastPortName = groupPorts[groupPorts.length - 1]?.name || String(groupPorts.length);
        patchStrip = `<div class="patch-id-strip"><span>${escapeHtml(firstPortName)}</span><span>-</span><span>${escapeHtml(lastPortName)}</span></div>`;
      }

      if (isTwoRows) {
        const row0 = groupPorts.filter(p => p.row === 0);
        const row1 = groupPorts.filter(p => p.row === 1);

        portsHtml += `
          <div class="port-group ${bayClass}">
            ${patchStrip}
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
            ${patchStrip}
            <div class="port-row">
              ${groupPorts.map(p => renderPortIcon(dev.instanceId, p)).join('')}
            </div>
          </div>
        `;
      }
    });

    let leftSection = '';
    if (isCisco) {
      // Option A: Integrated Compact Cisco Bezel (~74px width, zero overflow)
      const modelText = cat.modelTag || cat.name || 'Cisco';
      leftSection = `
        <div class="cisco-integrated-bezel" title="${escapeHtml([cat.name, cat.modelTag, configuredLabel, 'Cisco Catalyst Managed Switch'].filter(Boolean).join(' · '))}">
          <div class="cisco-bezel-top">
            <span class="cisco-brand-logo">CISCO</span>
            <div class="cisco-bezel-leds">
              <span class="cisco-mini-mode" title="Mode Button"></span>
              <span class="cisco-mini-led" title="SYST: Normal"><i></i></span>
              <span class="cisco-mini-led" title="STAT: Active"><i></i></span>
            </div>
          </div>
          <div class="cisco-bezel-bot">
            <span class="cisco-model-code" title="${escapeHtml(modelText)}">${escapeHtml(modelText)}</span>
            <span class="cisco-console-mini" title="Cisco RJ45 Console Port">CONS</span>
          </div>
        </div>
      `;
    } else if (isPatchPanel) {
      // Integrated Compact Patch Panel Bezel (~74px width, perfectly aligned with Cisco switches)
      const modelText = cat.modelTag || cat.name || 'Patch Panel';
      const brandText = isFiberPanel ? (cat.logo || 'FIBER') : (cat.logo && cat.logo !== 'PANEL' ? cat.logo : 'PATCH');
      const badgeText = isFiberPanel ? 'FIBER' : (cat.category === 'patch' && /cat6a/i.test(cat.name || cat.modelTag || '') ? 'CAT6A' : 'CAT6');
      const typeMini = isFiberPanel ? 'LC-DPX' : '110 IDC';

      leftSection = `
        <div class="patch-integrated-bezel" title="${escapeHtml([cat.name, cat.modelTag, configuredLabel, isFiberPanel ? 'Fiber Dağıtım Paneli' : 'Pasif Patch Panel'].filter(Boolean).join(' · '))}">
          <div class="patch-bezel-top">
            <span class="patch-brand-logo">${escapeHtml(brandText)}</span>
            <span class="patch-kind-badge">${escapeHtml(badgeText)}</span>
          </div>
          <div class="patch-bezel-bot">
            <span class="patch-model-code" title="${escapeHtml(configuredLabel || modelText)}">${escapeHtml(configuredLabel || modelText)}</span>
            <span class="patch-type-mini" title="${isFiberPanel ? 'LC Duplex Adaptör Yuvası' : '110 IDC Punch Down Bloğu'}">${escapeHtml(typeMini)}</span>
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

    return `
      <div class="device-faceplate ${typeClass}">
        <div class="device-controls">
          <button class="dev-btn del-device-btn" title="Cihazı Kaldır">✕</button>
        </div>
        ${leftSection}
        <div class="ports-area">
          ${portsHtml}
        </div>
      </div>
    `;
  }

  const portKey = (instanceId, portId) => JSON.stringify([instanceId, portId]);
  let occupiedPortKeys = new Set();
  function renderPortIcon(instanceId, port) {
    let typeClass = 'port-rj45';
    let inner = '';
    if (port.type === 'sfp') {
      typeClass = 'port-sfp';
    } else if (port.type === 'lc') {
      typeClass = 'port-lc';
      inner = '<div class="port-lc-inner"></div><div class="port-lc-inner"></div>';
    }

    const isConnected = occupiedPortKeys.has(portKey(instanceId, port.id));
    const activeRack = getActiveRack ? getActiveRack() : (STATE.racks && STATE.racks[0]);
    const dev = activeRack && activeRack.devices.find(d => d.instanceId === instanceId);
    const portCfg = dev && dev.portsConfig && (dev.portsConfig[port.id] || dev.portsConfig[port.id.replace('p', '')] || dev.portsConfig[port.name]);

    let specialClass = '';
    let specialStyle = '';

    if (portCfg) {
      const role = (portCfg.role || (portCfg.isTrunk ? 'trunk' : '')).toLowerCase();
      const hasVlan = Boolean(portCfg.vlan);
      const customColor = portCfg.color;

      if (role === 'trunk' || portCfg.isTrunk) {
        const color = customColor || '#a855f7';
        specialClass = 'port-special port-trunk';
        specialStyle = `style="--port-role-color: ${color}; --custom-color: ${color}; --trunk-color: ${color}; --port-badge-text: 'T';"`;
      } else if (role === 'uplink') {
        const color = customColor || '#00d2ff';
        specialClass = 'port-special port-uplink';
        specialStyle = `style="--port-role-color: ${color}; --custom-color: ${color}; --port-badge-text: '▲';"`;
      } else if (role === 'poe') {
        const color = customColor || '#f59e0b';
        specialClass = 'port-special port-poe';
        specialStyle = `style="--port-role-color: ${color}; --custom-color: ${color}; --port-badge-text: '⚡';"`;
      } else if (role === 'management' || role === 'mgmt') {
        const color = customColor || '#10b981';
        specialClass = 'port-special port-mgmt';
        specialStyle = `style="--port-role-color: ${color}; --custom-color: ${color}; --port-badge-text: 'M';"`;
      } else if (hasVlan || (role === 'access' && hasVlan)) {
        const color = customColor || '#3b82f6';
        const vlanLabel = String(portCfg.vlan).trim().split(/[, ]+/)[0];
        const badgeText = vlanLabel ? `V${vlanLabel.slice(0, 3)}` : 'V';
        specialClass = 'port-special port-vlan';
        specialStyle = `style="--port-role-color: ${color}; --custom-color: ${color}; --port-badge-text: '${badgeText}';"`;
      } else if (customColor) {
        specialClass = 'port-special';
        specialStyle = `style="--port-role-color: ${customColor}; --custom-color: ${customColor}; --port-badge-text: '●';"`;
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

  function bindPortInteractions() {
    const portElements = document.querySelectorAll('.port');
    portElements.forEach(portEl => {
      portEl.addEventListener('mouseenter', handlePortHover);
      portEl.addEventListener('mouseleave', handlePortLeave);
      portEl.addEventListener('click', (e) => {
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
        handlePortClick(e);
      });
      portEl.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const devId = portEl.dataset.instanceId;
        const portId = portEl.dataset.portId;
        if (window.PortConfigEditor) {
          window.PortConfigEditor.open(devId, portId, '2d');
        }
      });
    });
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

    const portCfg = dev.portsConfig && (dev.portsConfig[portId] || dev.portsConfig[portId.replace('p', '')] || dev.portsConfig[portName]);
    const isTrunk = portCfg && (portCfg.role === 'trunk' || portCfg.isTrunk);
    const trunkColor = (portCfg && portCfg.color) || '#a855f7';
    let trunkDetail = '';
    if (isTrunk && portCfg) {
      const cName = portCfg.ciscoName ? ` · ${escapeHtml(portCfg.ciscoName)}` : '';
      const vText = portCfg.vlan ? ` | VLAN: ${escapeHtml(portCfg.vlan)}` : '';
      const dText = portCfg.description ? `<div style="color:#94a3b8; font-size:10px; font-style:italic;">"${escapeHtml(portCfg.description)}"</div>` : '';
      trunkDetail = `
        <div style="background:rgba(168,85,247,0.2); border-left:3px solid ${trunkColor}; padding:2px 6px; margin:4px 0; border-radius:2px;">
          <span style="color:${trunkColor}; font-weight:700;">⚡ 802.1Q TRUNK${cName}${vText}</span>
          ${dText}
        </div>
      `;
    }

    if (dom.inspectorInfo) {
      dom.inspectorInfo.innerHTML = `
        <div style="font-weight:700; color:#fff; margin-bottom:3px;">${escapeHtml(cat.name)} (${escapeHtml(activeRack.name)} - U${dev.topU})</div>
        <div><b>Port:</b> ${escapeHtml(portName)} (${escapeHtml(portSpeed)})</div>
        <div><b>Tip:</b> ${escapeHtml(portEl.dataset.portType.toUpperCase())}</div>
        ${trunkDetail}
        <div><b>Durum:</b> ${connectionInfo}</div>
      `;
    }

    if (dom.tooltip) {
      const rect = portEl.getBoundingClientRect();
      dom.tooltip.style.display = 'block';
      dom.tooltip.style.left = `${rect.right + 10}px`;
      dom.tooltip.style.top = `${rect.top - 5}px`;
      const trunkBadge = isTrunk ? `<div style="color:${trunkColor}; font-weight:bold; font-size:10px;">⚡ 802.1Q TRUNK</div>` : '';
      dom.tooltip.innerHTML = `<b>${escapeHtml(cat.modelTag)}</b> &bull; ${escapeHtml(portName)}${trunkBadge}<br><span style="color:#94a3b8; font-size:0.68rem;">${escapeHtml(portSpeed)}</span><br><span style="color:#38bdf8; font-size:0.65rem;">Ayarlar: <b>Sağ Tık / Shift+Tık</b></span>`;
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
      const cableId = getNextCableId();

      // Check trunk role and color inheritance
      const sourceDev = STATE.racks?.find(r => r.id === source.rackId)?.devices?.find(d => d.instanceId === source.instanceId);
      const targetDev = devRack.devices?.find(d => d.instanceId === instanceId);
      const sourcePortCfg = sourceDev?.portsConfig && (sourceDev.portsConfig[source.portId] || sourceDev.portsConfig[source.portId.replace('p', '')]);
      const targetPortCfg = targetDev?.portsConfig && (targetDev.portsConfig[portId] || targetDev.portsConfig[portId.replace('p', '')]);
      const isTrunkLink = (sourcePortCfg && sourcePortCfg.isTrunk) || (targetPortCfg && targetPortCfg.isTrunk);
      const trunkColor = (sourcePortCfg && sourcePortCfg.isTrunk && sourcePortCfg.color) || (targetPortCfg && targetPortCfg.isTrunk && targetPortCfg.color) || '#a855f7';
      const effectiveCableColor = (isTrunkLink && ((sourcePortCfg && sourcePortCfg.autoCableColor !== false) || (targetPortCfg && targetPortCfg.autoCableColor !== false))) ? trunkColor : STATE.selectedCableColor;
      const trunkPrefix = isTrunkLink ? '[TRUNK] ' : '';

      const newCable = {
        id: cableId,
        name: trunkPrefix + cableId,
        from: { rackId: source.rackId, instanceId: source.instanceId, portId: source.portId },
        to: { rackId: devRack.id, instanceId, portId },
        color: effectiveCableColor,
        lengthMeters: calculateCableLengthMeters(source.instanceId, instanceId, isInterRack)
      };

      STATE.cables.push(newCable);
      cancelPendingConnection();

      renderMountedDevices();
      renderScheduleTable();
      renderAllCables();
    }
  }

  function calculateCableLengthMeters(instA, instB, isInterRack) {
    if (isInterRack) return 15.0; // Inter-rack structured tie cable
    const activeRack = getActiveRack();
    if (!activeRack) return 1.5;
    const devA = activeRack.devices.find(d => d.instanceId === instA);
    const devB = activeRack.devices.find(d => d.instanceId === instB);
    if (!devA || !devB) return 1.5;
    const uDiff = Math.abs(devA.topU - devB.topU);
    const length = 0.5 + (uDiff * 0.045) + (uDiff > 5 ? 0.8 : 0.2);
    return parseFloat(length.toFixed(2));
  }

export {
  getActiveRack,
  renderRackRailsAndSlots,
  mountDeviceAt,
  removeDevice,
  updateDeviceMetadata,
  renderMountedDevices,
  renderRouterFaceplate,
  renderOrganizerFaceplate,
  renderBlankFaceplate,
  renderSwitchOrPatchFaceplate,
  renderPortIcon,
  bindPortInteractions,
  handlePortHover,
  handlePortLeave,
  handlePortClick,
  calculateCableLengthMeters
};
