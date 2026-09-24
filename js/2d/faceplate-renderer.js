/**
 * Cisco Enterprise Rack & Cabling Studio - Faceplate Renderer Module
 * Handles visual rendering of mounted devices, realistic front bezels, status LEDs,
 * and port icons (RJ45, SFP, LC/SC Fiber, PDU Power).
 */
(function () {
  'use strict';

  const RS = window.RackStudio = window.RackStudio || {};

  const STATE = RS.STATE;
  const dom = RS.dom;
  const HARDWARE_CATALOG = RS.HARDWARE_CATALOG;

  RS.occupiedPortKeys = RS.occupiedPortKeys || new Set();

  const getActiveRack = () => (RS.getActiveRack ? RS.getActiveRack() : RS.STATE?.racks?.[0]);
  const escapeHtml = (val) => RS.escapeHtml ? RS.escapeHtml(val) : String(val ?? '');
  const portKey = (instanceId, portId) => (RS.portKey ? RS.portKey(instanceId, portId) : JSON.stringify([instanceId, portId]));
  const renderRackRailsAndSlots = () => RS.renderRackRailsAndSlots && RS.renderRackRailsAndSlots();
  const bindPortInteractions = () => RS.bindPortInteractions && RS.bindPortInteractions();
  const updateRackHeaderTelemetry = () => RS.updateRackHeaderTelemetry && RS.updateRackHeaderTelemetry();
  const showInlineDeleteConfirm = (...args) => RS.showInlineDeleteConfirm && RS.showInlineDeleteConfirm(...args);
  const removeDevice = (...args) => RS.removeDevice && RS.removeDevice(...args);
  const clearDeviceCables = (...args) => RS.clearDeviceCables && RS.clearDeviceCables(...args);
  let lastDeviceSceneLayoutSignature = '';

  const resolveCatalogItem = (key) => {
    if (!key) return null;
    return (HARDWARE_CATALOG && HARDWARE_CATALOG[key]) ||
           (RS.catalog && RS.catalog[key]) ||
           (STATE.customCatalog && STATE.customCatalog[key]) ||
           (Array.isArray(window.CISCO_MASTER_CATALOG) ? window.CISCO_MASTER_CATALOG.find(m => m.id === key) : null) ||
           null;
  };

  function renderDeviceControlsHtml(cat, dev, occupiedCount, hasCables) {
    const isSwitch = cat.category === 'switch' || cat.category === 'fiber-switch' || cat.category === 'compact';
    const isPatch = cat.category === 'patch' || cat.category === 'fiber';
    const isOrg = cat.category === 'organizer';
    const isBlank = cat.category === 'blank';
    const isFinger = isOrg && (cat.subType === 'finger-duct' || /finger/i.test(cat.name || ''));
    const connPorts = cat.ports ? cat.ports.filter(p => p.type !== 'power').length : 0;
    const hasFree = connPorts > occupiedCount;
    let btns = '';
    if (hasFree && (isSwitch || isPatch || cat.category === 'router')) {
      btns += `<button type="button" class="dev-btn autofill-device-btn" data-instance-id="${dev.instanceId}" title="Boş portları akıllıca patch panele bağla (Auto-Fill)">⚡</button>`;
    }
    if (hasCables) {
      btns += `<button type="button" class="dev-btn color-device-cables-btn" data-instance-id="${dev.instanceId}" title="Cihazın tüm kablolarını renklendir">🎨</button>`;
      btns += `<button type="button" class="dev-btn clear-device-cables-btn" data-instance-id="${dev.instanceId}" title="${isPatch ? 'Panelin tüm kablolarını temizle / sök' : 'Cihazın tüm kablolarını temizle / sök'}">✂️</button>`;
    }
    if (isFinger) {
      btns += `<button type="button" class="dev-btn finger-toggle-btn" data-instance-id="${dev.instanceId}" title="Kanal Kapağını Aç/Kapat">📂</button>`;
    }
    const delTitle = isBlank ? 'Kör Paneli Kaldır' : (isOrg ? 'Düzenleyiciyi Kaldır' : (isPatch ? 'Paneli Kaldır' : 'Cihazı Kaldır'));
    btns += `<button type="button" class="dev-btn del-device-btn" data-instance-id="${dev.instanceId}" title="${delTitle}">✕</button>`;
    return `<div class="device-controls" data-instance-id="${dev.instanceId}">${btns}</div>`;
  }

  function renderMountedDevices() {
    ensureDeviceFaceplateDelegation();
    const isMulti = STATE.viewMode === 'multi' && STATE.racks && STATE.racks.length > 1;
    const activeRack = getActiveRack();

    // Ensure slots exist for active rack BEFORE querying DOM elements
    if (!isMulti && dom.rackSpace && dom.rackSpace.querySelectorAll('.rack-slot').length !== (activeRack?.heightU || 42)) {
      renderRackRailsAndSlots();
    }

    // Retain unchanged device DOM. Faceplates contain dozens of ports, so a
    // keyed update is substantially cheaper than deleting the whole rack.
    const existingDevices = new Map(
      Array.from(document.querySelectorAll('.mounted-device')).map(el => [el.id, el])
    );
    const desiredDeviceIds = new Set();

    const racksToRender = isMulti
      ? (STATE.racks.length > 20
          ? STATE.racks.filter(rack => {
              if (rack.id === STATE.activeRackId) return true;
              const container = document.getElementById(`rack-container-${rack.id}`);
              return !container || container.dataset.virtualVisible !== 'false';
            })
          : STATE.racks)
      : [getActiveRack()].filter(Boolean);

    if (!racksToRender.length) return;

    RS.occupiedPortKeys.clear();
    const occupiedPortKeys = RS.occupiedPortKeys;
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
        const catKey = dev.catalogKey || dev.catalogId;
        const cat = resolveCatalogItem(catKey);
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
        const devIdentity = {
          instanceId: dev.instanceId,
          catalogKey: catKey,
          uHeight: dev.uHeight,
          name: dev.name || '',
          hostname: dev.hostname || '',
          portsConfig: dev.portsConfig || null,
          customAttrs: dev.customAttrs || null
        };
        const renderKey = JSON.stringify([
          devIdentity,
          cableState,
          STATE.deviceLabelMode || 'name'
        ]);
        let devEl = existingDevices.get(dev.instanceId);
        const needsPortMeasure = !!(cat.ports && cat.ports.length) && !RS.DeviceSceneRegistry?.hasTemplate?.(catKey);
        const devCables = (STATE.cables || []).filter(c => c.from?.instanceId === dev.instanceId || c.to?.instanceId === dev.instanceId);
        const hasCables = devCables.length > 0;
        const occupiedCount = devCables.length;
        const controlsHtml = renderDeviceControlsHtml(cat, dev, occupiedCount, hasCables);

        if (devEl && devEl.dataset.renderKey === renderKey && !needsPortMeasure) {
          devEl.dataset.instanceId = dev.instanceId;
          devEl.dataset.catalogKey = catKey;
          devEl.dataset.category = cat.category || '';
          devEl.dataset.rackId = rack.id;
          if (devEl.parentElement !== slotEl) slotEl.appendChild(devEl);
          const existingControls = devEl.querySelector('.device-controls');
          if (existingControls) {
            existingControls.outerHTML = controlsHtml;
          } else {
            devEl.insertAdjacentHTML('beforeend', controlsHtml);
          }
          return;
        }
        if (devEl) devEl.remove();
        devEl = document.createElement('div');
        devEl.className = 'mounted-device';
        devEl.id = dev.instanceId;
        devEl.dataset.instanceId = dev.instanceId;
        devEl.dataset.catalogKey = catKey;
        devEl.dataset.category = cat.category || '';
        devEl.dataset.renderKey = renderKey;
        devEl.style.height = `${dev.uHeight * 32}px`;
        devEl.style.top = '0px';
        devEl.dataset.rackId = rack.id;

        if (needsPortMeasure && cat.category === 'router') {
          devEl.innerHTML = renderRouterFaceplate(cat, dev) + controlsHtml;
        } else if (needsPortMeasure) {
          devEl.innerHTML = renderSwitchOrPatchFaceplate(cat, dev) + controlsHtml;
        } else {
          devEl.innerHTML = '<div class="pixi-device-body" aria-hidden="true"></div>' + controlsHtml;
        }

        const earScrewsCount = Math.max(2, (dev.uHeight || 1) * 2);
        const earScrewsHtml = Array.from({ length: earScrewsCount }, () => '<span class="ear-screw"></span>').join('');

        const leftEar = document.createElement('div');
        leftEar.className = 'device-ear-handle device-ear-left';
        leftEar.dataset.dragHandle = 'true';
        leftEar.title = 'Taşımak için tutun (19" EIA Rack Mount Ear)';
        leftEar.innerHTML = earScrewsHtml;

        const rightEar = document.createElement('div');
        rightEar.className = 'device-ear-handle device-ear-right';
        rightEar.dataset.dragHandle = 'true';
        rightEar.title = 'Taşımak için tutun (19" EIA Rack Mount Ear)';
        rightEar.innerHTML = earScrewsHtml;

        devEl.prepend(leftEar);
        devEl.appendChild(rightEar);

        slotEl.appendChild(devEl);
        existingDevices.set(dev.instanceId, devEl);

        // Listeners for devices, bezels, and action buttons are delegated at #rack-stage
      });
    });

    existingDevices.forEach((element, instanceId) => {
      if (!desiredDeviceIds.has(instanceId)) element.remove();
    });

    // Publish one normalized port template per catalog and lightweight world
    // records per mounted instance. Pixi cables consume this registry first,
    // which removes their per-cable dependency on live port DOM geometry.
    if (RS.DeviceSceneRegistry) {
      const deviceSceneLayoutSignature = [
        STATE.viewMode || 'single',
        STATE.activeRackId || '',
        racksToRender.map(rack => [
          rack.id,
          rack.heightU || 42,
          (rack.devices || []).map(dev => [
            dev.instanceId,
            dev.catalogKey || dev.catalogId,
            dev.topU,
            dev.uHeight || 1,
            JSON.stringify(dev.portsConfig || {})
          ].join(':')).join(',')
        ].join('/')).join(';')
      ].join('||');
      const hasSceneGeometry = RS.DeviceSceneRegistry.getSnapshot().devices.length > 0;
      if (!hasSceneGeometry || deviceSceneLayoutSignature !== lastDeviceSceneLayoutSignature) {
        RS.DeviceSceneRegistry.captureFromDom('mounted-devices');
        lastDeviceSceneLayoutSignature = deviceSceneLayoutSignature;
      }
      RS.DeviceSceneRegistry.refreshDeviceOwners(existingDevices.values());
      RS.DeviceSceneRegistry.stripLiveFaceplates();
    }

    if (typeof RS.syncPixiDeviceSceneLOD === 'function') {
      RS.syncPixiDeviceSceneLOD();
    }

    bindPortInteractions();
    updateRackHeaderTelemetry();
  }

  function renderRouterFaceplate(cat, dev) {
    const occupiedPortKeys = RS.occupiedPortKeys || new Set();
    const groups = {};
    cat.ports.forEach(p => {
      if (!groups[p.group]) groups[p.group] = [];
      groups[p.group].push(p);
    });

    let portsHtml = '';
    Object.keys(groups).forEach(gId => {
      const groupPorts = groups[gId];
      portsHtml += `
        <div class="port-group" style="background:#161c26; border: 1px solid #334155; border-radius: 2px;">
          <div class="port-row">
            ${groupPorts.map(p => renderPortIcon(dev.instanceId, p)).join('')}
          </div>
        </div>
      `;
    });

    const hasCables = (STATE.cables || []).some(c => c.from?.instanceId === dev.instanceId || c.to?.instanceId === dev.instanceId);
    const occupiedCount = cat.ports ? cat.ports.filter(p => p.type !== 'power' && occupiedPortKeys.has(portKey(dev.instanceId, p.id))).length : 0;
    const connectablePortsCount = cat.ports ? cat.ports.filter(p => p.type !== 'power').length : 0;
    const hasFreePorts = connectablePortsCount > occupiedCount;
    return `
      <div class="device-faceplate faceplate-router" style="background:linear-gradient(90deg, #242934 0%, #2f3645 100%); border-top: 1px solid #475569;">
        <div class="device-controls">
          ${hasFreePorts ? `<button type="button" class="dev-btn autofill-device-btn" data-instance-id="${dev.instanceId}" title="Boş portları akıllıca patch panele bağla (Auto-Fill)">⚡</button>` : ''}
          ${hasCables ? `<button type="button" class="dev-btn color-device-cables-btn" data-instance-id="${dev.instanceId}" title="Cihazın tüm kablolarını renklendir">🎨</button>` : ''}
          ${hasCables ? `<button type="button" class="dev-btn clear-device-cables-btn" data-instance-id="${dev.instanceId}" title="Cihazın tüm kablolarını temizle / sök">✂️</button>` : ''}
          <button class="dev-btn del-device-btn" title="Cihazı Kaldır">✕</button>
        </div>
        <div class="bezel-badge" style="border-right: 1px solid #3b4455; padding-right: 6px;">
          <div class="bezel-primary-row">
            <span class="bezel-logo" style="color:#f8fafc; font-family:var(--font-mono); font-weight:800; letter-spacing:0.8px;">CISCO</span>
            <span class="device-kind-badge" style="background:#ea580c; color:#fff; font-size:0.42rem;">ROUTER</span>
          </div>
          <div class="bezel-secondary-row">
            <span class="bezel-model" style="font-family:var(--font-mono); color:#cbd5e1; font-size:0.52rem;">${escapeHtml(cat.modelTag)}</span>
          </div>
        </div>
        <div class="device-status-leds">
          <div class="status-led" title="PWR1: Active" style="background:#10b981;"></div>
          <div class="status-led" title="PWR2: Standby" style="background:#0284c7;"></div>
          <div class="status-led" title="WAN: Up" style="background:#10b981;"></div>
        </div>
        <!-- Characteristic Cisco Console & AUX Ports -->
        <div style="display:flex; align-items:center; gap:3px; margin:0 4px; padding:1px 3px; background:#161c26; border:1px solid #334155; border-radius:2px;">
          <span style="font-size:0.42rem; font-family:var(--font-mono); color:#00bceb; font-weight:800;">CONSOLE</span>
          <div style="width:10px; height:8px; background:#00bceb; border-radius:1px; display:flex; align-items:center; justify-content:center;" title="RJ45 Cisco Console Port">
            <div style="width:6px; height:5px; background:#0f172a; border-radius:0.5px;"></div>
          </div>
        </div>
        <div class="ports-area">
          ${portsHtml}
          <!-- NIM Modules visual simulation with captive screws -->
          <div style="display:flex; gap:3px; margin-left:auto; opacity:0.95;">
            <div style="font-size:0.46rem; font-family:var(--font-mono); color:#94a3b8; background:#1a202c; border:1px solid #475569; padding:2px 5px; border-radius:2px; display:flex; align-items:center; gap:2px;">
              <span class="ear-screw" style="width:4px; height:4px;"></span> NIM-1 <span class="ear-screw" style="width:4px; height:4px;"></span>
            </div>
            <div style="font-size:0.46rem; font-family:var(--font-mono); color:#94a3b8; background:#1a202c; border:1px solid #475569; padding:2px 5px; border-radius:2px; display:flex; align-items:center; gap:2px;">
              <span class="ear-screw" style="width:4px; height:4px;"></span> NIM-2 <span class="ear-screw" style="width:4px; height:4px;"></span>
            </div>
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

  const getContrastColor = (hex) => RS.getContrastColor ? RS.getContrastColor(hex) : '#ffffff';

  function renderSwitchOrPatchFaceplate(cat, dev) {
    const occupiedPortKeys = RS.occupiedPortKeys || new Set();
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

      const hasFaceplateStencil = isSwitch && Boolean(cat.faceplate?.stencil);
      let bayHeader = '';
      if (!hasFaceplateStencil) {
        if (isPatchPanel && groupPorts.length > 0) {
          const firstPortName = (groupPorts[0]?.name || '1').replace(/^Port\s*/i, '');
          const lastPortName = (groupPorts[groupPorts.length - 1]?.name || String(groupPorts.length)).replace(/^Port\s*/i, '');
          bayHeader = `<div class="patch-id-strip"><span class="patch-id-range">[ ${escapeHtml(firstPortName)} - ${escapeHtml(lastPortName)} ]</span></div>`;
        } else if (isUplinkGroup) {
          const uplinkTag = groupPorts.some(p => p.type === 'qsfp28') ? '100G QSFP28' : '10G SFP+';
          bayHeader = `<div class="cisco-uplink-strip"><span class="uplink-badge">${uplinkTag}</span></div>`;
        } else if (isSwitch && isTwoRows && groupPorts.length >= 6) {
          const firstNum = (groupPorts[0]?.name || '').split('/').pop() || '1';
          const lastNum = (groupPorts[groupPorts.length - 1]?.name || '').split('/').pop() || String(groupPorts.length);
          bayHeader = `<div class="switch-block-strip"><span class="port-block-range">${escapeHtml(firstNum)} - ${escapeHtml(lastNum)}</span></div>`;
        }
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
        cat.modelTag?.includes('1000') || cat.modelTag?.includes('C1000') ? 'cat1k' :
        cat.category === 'compact' || cat.series === 'compact' ? 'compact' :
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
    const occupiedCount = cat.ports ? cat.ports.filter(p => p.type !== 'power' && occupiedPortKeys.has(portKey(dev.instanceId, p.id))).length : 0;
    const connectablePortsCount = cat.ports ? cat.ports.filter(p => p.type !== 'power').length : 0;
    const hasFreePorts = isSwitch && connectablePortsCount > occupiedCount;
    const isPixiMode = STATE.cableRenderMode === 'pixi' || (typeof document !== 'undefined' && document.documentElement?.getAttribute('data-device-renderer') === 'pixi');
    const faceplateStencil = !isPixiMode && isSwitch && cat.faceplate?.stencil ? cat.faceplate : null;
    const portsRect = faceplateStencil?.portsRect || { left: 32, top: 12, width: 58, height: 76 };
    const faceplateStyle = faceplateStencil
      ? ` style="--fp-ports-left:${Number(portsRect.left) || 0}%;--fp-ports-top:${Number(portsRect.top) || 0}%;--fp-ports-width:${Number(portsRect.width) || 100}%;--fp-ports-height:${Number(portsRect.height) || 100}%;"`
      : '';
    return `
      <div class="device-faceplate ${typeClass}${faceplateStencil ? ' stencil-faceplate' : ''}"${faceplateStyle}>
        ${faceplateStencil ? `<img class="rack-faceplate-stencil" src="assets/stencils/${encodeURIComponent(faceplateStencil.stencil)}" alt="" draggable="false" aria-hidden="true">` : ''}
        <div class="device-controls">
          ${hasFreePorts ? `<button type="button" class="dev-btn autofill-device-btn" data-instance-id="${dev.instanceId}" title="Boş portları akıllıca patch panele bağla (Auto-Fill)">⚡</button>` : ''}
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

  // Port DOM icon & role badge rendering extracted to js/2d/faceplate-port-renderer.js
  const renderPortIcon = (...args) => RS.renderPortIcon ? RS.renderPortIcon(...args) : '';


  function ensureDeviceFaceplateDelegation() {
    const stage = dom.rackStage || document.getElementById('rack-stage');
    if (!stage || stage.__DEVICE_FACEPLATE_DELEGATED__) return;
    stage.__DEVICE_FACEPLATE_DELEGATED__ = true;

    // Faceplate double click
    stage.addEventListener('dblclick', (e) => {
      const devEl = e.target.closest('.mounted-device');
      if (devEl && !e.target.closest('.port, .del-device-btn, .color-device-cables-btn, .clear-device-cables-btn, .autofill-device-btn, .finger-toggle-btn')) {
        const instId = devEl.dataset.instanceId || devEl.id;
        const dev = RS.getDeviceById ? RS.getDeviceById(instId) : null;
        const cat = dev ? (HARDWARE_CATALOG[dev.catalogKey] || (RS.catalog && RS.catalog[dev.catalogKey]) || (RS.resolveCatalogItem && RS.resolveCatalogItem(dev.catalogKey)) || {}) : {};
        if (['organizer', 'blank'].includes(cat.category)) return;
        window.DeviceMetadataEditor?.open2D(instId);
      }
    });

    // Bezel click
    stage.addEventListener('click', (e) => {
      if (RS.isSpacePressed) return;
      const bezel = e.target.closest('.bezel-badge, .cisco-integrated-bezel, .patch-integrated-bezel');
      if (bezel) {
        e.stopPropagation();
        const devEl = bezel.closest('.mounted-device');
        const instId = devEl?.dataset?.instanceId || devEl?.id;
        if (instId) {
          if (RS.focusOnDevice) RS.focusOnDevice(instId);
          window.DeviceMetadataEditor?.open2D(instId);
        }
        return;
      }

      const autoFillBtn = e.target.closest('.autofill-device-btn');
      if (autoFillBtn) {
        e.stopPropagation();
        const devEl = autoFillBtn.closest('.mounted-device');
        const instId = devEl?.dataset?.instanceId || devEl?.id;
        if (RS.openSwitchAutoFillPopover && instId) {
          RS.openSwitchAutoFillPopover(autoFillBtn, instId);
        }
        return;
      }

      const colorBtn = e.target.closest('.color-device-cables-btn');
      if (colorBtn) {
        e.stopPropagation();
        const devEl = colorBtn.closest('.mounted-device');
        const instId = devEl?.dataset?.instanceId || devEl?.id;
        if (RS.openSwitchBulkColorPopover && instId) {
          RS.openSwitchBulkColorPopover(colorBtn, instId);
        }
        return;
      }

      const clearCablesBtn = e.target.closest('.clear-device-cables-btn');
      if (clearCablesBtn) {
        e.stopPropagation();
        const devEl = clearCablesBtn.closest('.mounted-device');
        const instId = devEl?.dataset?.instanceId || devEl?.id;
        if (instId) {
          clearDeviceCables(instId, clearCablesBtn);
        }
        return;
      }

      const delBtn = e.target.closest('.del-device-btn');
      if (delBtn) {
        e.stopPropagation();
        const devEl = delBtn.closest('.mounted-device');
        const instId = devEl?.dataset?.instanceId || devEl?.id;
        if (instId) {
          const dev = RS.getDeviceById ? RS.getDeviceById(instId) : null;
          const cat = dev ? (HARDWARE_CATALOG[dev.catalogKey] || (RS.catalog && RS.catalog[dev.catalogKey]) || {}) : {};
          const devCables = (STATE.cables || []).filter(c => c.from.instanceId === instId || c.to.instanceId === instId);
          const devName = dev?.hostname || dev?.name || dev?.panelLabel || cat.name || 'Cihaz';
          showInlineDeleteConfirm(delBtn, devName, { category: cat.category, cableCount: devCables.length }, () => {
            removeDevice(instId);
          });
        }
        return;
      }

      const toggleCoverBtn = e.target.closest('.finger-toggle-btn');
      if (toggleCoverBtn) {
        e.stopPropagation();
        const devEl = toggleCoverBtn.closest('.mounted-device');
        const instId = devEl?.dataset?.instanceId || devEl?.id;
        const dev = RS.getDeviceById ? RS.getDeviceById(instId) : null;
        if (dev) {
          dev.coverOpen = !dev.coverOpen;
          renderMountedDevices();
          if (typeof RS.renderAllCables === 'function') {
            RS.renderAllCables();
          }
          document.dispatchEvent(new CustomEvent('rackstudio:change', { bubbles: true }));
        }
        return;
      }
    });
  }

  RS.renderMountedDevices = renderMountedDevices;
  RS.renderRouterFaceplate = renderRouterFaceplate;
  RS.renderOrganizerFaceplate = renderOrganizerFaceplate;
  RS.renderBlankFaceplate = renderBlankFaceplate;
  RS.getShortModelName = getShortModelName;
  RS.getContrastColor = getContrastColor;
  RS.renderSwitchOrPatchFaceplate = renderSwitchOrPatchFaceplate;
  if (!RS.renderPortIcon) RS.renderPortIcon = renderPortIcon;
})();
