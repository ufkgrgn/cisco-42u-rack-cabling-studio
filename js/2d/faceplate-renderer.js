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
        const renderKey = JSON.stringify([
          dev,
          cableState,
          STATE.deviceLabelMode || 'name'
        ]);
        let devEl = existingDevices.get(dev.instanceId);
        if (devEl && devEl.dataset.renderKey === renderKey) {
          devEl.dataset.instanceId = dev.instanceId;
          devEl.dataset.catalogKey = catKey;
          devEl.dataset.category = cat.category || '';
          devEl.dataset.rackId = rack.id;
          if (devEl.parentElement !== slotEl) slotEl.appendChild(devEl);
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

        // Listeners for devices, bezels, and action buttons are delegated at #rack-stage
      });
    });

    existingDevices.forEach((element, instanceId) => {
      if (!desiredDeviceIds.has(instanceId)) element.remove();
    });

    // Publish one normalized port template per catalog and lightweight world
    // records per mounted instance. Pixi cables consume this registry first,
    // which removes their per-cable dependency on live port DOM geometry.
    if (STATE.cableRenderMode === 'pixi' && RS.DeviceSceneRegistry) {
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
            dev.uHeight || 1
          ].join(':')).join(',')
        ].join('/')).join(';')
      ].join('||');
      const hasSceneGeometry = RS.DeviceSceneRegistry.getSnapshot().devices.length > 0;
      if (!hasSceneGeometry || deviceSceneLayoutSignature !== lastDeviceSceneLayoutSignature) {
        RS.DeviceSceneRegistry.captureFromDom('mounted-devices');
        lastDeviceSceneLayoutSignature = deviceSceneLayoutSignature;
      }
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
        <div class="port-group" style="background:rgba(15,23,42,0.85); border-color:#0284c7;">
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
      <div class="device-faceplate" style="background:linear-gradient(90deg, #131b2c 0%, #1e293b 100%);">
        <div class="device-controls">
          ${hasFreePorts ? `<button type="button" class="dev-btn autofill-device-btn" data-instance-id="${dev.instanceId}" title="Boş portları akıllıca patch panele bağla (Auto-Fill)">⚡</button>` : ''}
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
    const occupiedCount = cat.ports ? cat.ports.filter(p => p.type !== 'power' && occupiedPortKeys.has(portKey(dev.instanceId, p.id))).length : 0;
    const connectablePortsCount = cat.ports ? cat.ports.filter(p => p.type !== 'power').length : 0;
    const hasFreePorts = isSwitch && connectablePortsCount > occupiedCount;
    const faceplateStencil = isSwitch && cat.faceplate?.stencil ? cat.faceplate : null;
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

  function renderPortIcon(instanceId, port) {
    const occupiedPortKeys = RS.occupiedPortKeys || new Set();
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
  RS.renderPortIcon = renderPortIcon;
})();
