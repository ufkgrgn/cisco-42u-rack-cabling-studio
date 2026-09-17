import { STATE, dom } from './state.js';
import { HARDWARE_CATALOG } from './catalog.js';
import { renderAllCables, cancelPendingConnection, highlightCable, showCableQuickHud, disconnectCable } from './cabling.js';
import { renderScheduleTable } from './schedule.js';

export function renderRackRailsAndSlots(onSlotClick) {
  dom.railLeft.innerHTML = '';
  dom.railRight.innerHTML = '';
  dom.rackSpace.innerHTML = '';

  for (let u = 42; u >= 1; u--) {
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
    dom.railLeft.appendChild(leftU);

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
    dom.railRight.appendChild(rightU);

    const slot = document.createElement('div');
    slot.className = 'rack-slot';
    slot.dataset.u = u;
    slot.id = `rack-slot-u${u}`;

    slot.addEventListener('click', (e) => {
      if (e.target.closest('.mounted-device')) return;
      if (onSlotClick) onSlotClick(u, e);
    });

    dom.rackSpace.appendChild(slot);
  }
}

export function mountDeviceAt(catalogKey, topU) {
  const cat = HARDWARE_CATALOG[catalogKey];
  const endU = topU - cat.u + 1;
  const instanceId = 'dev-' + Math.random().toString(36).substring(2, 9);
  for (let u = endU; u <= topU; u++) {
    STATE.rackUnits[u] = instanceId;
  }
  STATE.devices.push({
    instanceId,
    catalogKey,
    topU,
    uHeight: cat.u
  });
}

export function removeDevice(instanceId) {
  STATE.cables = STATE.cables.filter(c => c.from.instanceId !== instanceId && c.to.instanceId !== instanceId);
  
  for (let u = 1; u <= 42; u++) {
    if (STATE.rackUnits[u] === instanceId) {
      STATE.rackUnits[u] = null;
    }
  }

  STATE.devices = STATE.devices.filter(d => d.instanceId !== instanceId);

  if (STATE.pendingConnection && STATE.pendingConnection.instanceId === instanceId) {
    cancelPendingConnection();
  }

  renderMountedDevices();
  renderScheduleTable();
  renderAllCables();
}

export function renderMountedDevices() {
  document.querySelectorAll('.mounted-device').forEach(el => el.remove());

  STATE.devices.forEach(dev => {
    const cat = HARDWARE_CATALOG[dev.catalogKey];
    const slotEl = document.getElementById(`rack-slot-u${dev.topU}`);
    if (!slotEl) return;

    const devEl = document.createElement('div');
    devEl.className = 'mounted-device';
    devEl.id = dev.instanceId;
    devEl.style.height = `${dev.uHeight * 32}px`;
    devEl.style.top = '0px';

    if (cat.category === 'organizer') {
      devEl.innerHTML = renderOrganizerFaceplate(cat, dev);
    } else if (cat.category === 'blank') {
      devEl.innerHTML = renderBlankFaceplate(cat, dev);
    } else {
      devEl.innerHTML = renderSwitchOrPatchFaceplate(cat, dev);
    }

    slotEl.appendChild(devEl);

    const delBtn = devEl.querySelector('.del-device-btn');
    if (delBtn) {
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`${cat.name} cihazını ve tüm bağlı kablolarını kaldırmak istiyor musunuz?`)) {
          removeDevice(dev.instanceId);
        }
      });
    }
  });

  bindPortInteractions();
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
        <div class="dring-mount-base"></div>
        <div class="dring-loop">
          <div class="dring-aperture"></div>
          <div class="dring-front-face"></div>
        </div>
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
        ${cat.modelTag || 'ORGANIZER'}
      </div>
      <div class="organizer-brush" style="${is2U ? 'height:24px;' : ''}"></div>
    </div>
  `;
}

function renderBlankFaceplate(cat, dev) {
  return `
    <div style="width:100%; height:100%; background:#141720; border-top:1px solid #2d3340; display:flex; align-items:center; justify-content:center; position:relative;">
      <div class="device-controls">
        <button class="dev-btn del-device-btn" title="Paneli Kaldır">✕</button>
      </div>
      <span style="font-size:0.6rem; color:#475569; font-family:monospace; letter-spacing:2px;">BLANK COVER PANEL 1U</span>
    </div>
  `;
}

function renderSwitchOrPatchFaceplate(cat, dev) {
  const groups = {};
  cat.ports.forEach(p => {
    if (!groups[p.group]) groups[p.group] = [];
    groups[p.group].push(p);
  });

  let portsHtml = '';
  Object.keys(groups).forEach(gId => {
    const groupPorts = groups[gId];
    const isTwoRows = groupPorts.some(p => p.row === 1);

    if (isTwoRows) {
      const row0 = groupPorts.filter(p => p.row === 0);
      const row1 = groupPorts.filter(p => p.row === 1);

      portsHtml += `
        <div class="port-group">
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
        <div class="port-group">
          <div class="port-row">
            ${groupPorts.map(p => renderPortIcon(dev.instanceId, p)).join('')}
          </div>
        </div>
      `;
    }
  });

  return `
    <div class="device-faceplate">
      <div class="device-controls">
        <button class="dev-btn del-device-btn" title="Cihazı Kaldır">✕</button>
      </div>
      <div class="bezel-badge">
        <span class="bezel-logo">${cat.logo}</span>
        <span class="bezel-model">${cat.modelTag}</span>
      </div>
      <div class="device-status-leds">
        <div class="status-led" title="Power: OK"></div>
        <div class="status-led" style="background:#38bdf8; box-shadow:0 0 4px #38bdf8;" title="Status: Active"></div>
      </div>
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
    inner = '<div class="port-lc-inner"></div><div class="port-lc-inner"></div>';
  }

  const isConnected = STATE.cables.some(c => 
    (c.from.instanceId === instanceId && c.from.portId === port.id) ||
    (c.to.instanceId === instanceId && c.to.portId === port.id)
  );

  const dev = (STATE.devices || []).find(d => d.instanceId === instanceId);
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
         data-port-name="${port.name}"
         data-port-type="${port.type}"
         data-port-speed="${port.speed}"
         id="port-${instanceId}-${port.id}">
      ${inner}
    </div>
  `;
}

export function bindPortInteractions() {
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

  const dev = STATE.devices.find(d => d.instanceId === instanceId);
  if (!dev) return;
  const cat = HARDWARE_CATALOG[dev.catalogKey];

  const connectedCable = STATE.cables.find(c => 
    (c.from.instanceId === instanceId && c.from.portId === portId) ||
    (c.to.instanceId === instanceId && c.to.portId === portId)
  );

  let connectionInfo = '<span style="color:#94a3b8;">Boş / Bağlantı Yok</span>';
  if (connectedCable) {
    const otherEndpoint = (connectedCable.from.instanceId === instanceId && connectedCable.from.portId === portId)
      ? connectedCable.to
      : connectedCable.from;
    const otherDev = STATE.devices.find(d => d.instanceId === otherEndpoint.instanceId);
    const otherCat = HARDWARE_CATALOG[otherDev.catalogKey];
    const otherPort = otherCat.ports.find(p => p.id === otherEndpoint.portId);

    connectionInfo = `<span style="color:#22c55e;">Bağlı -> ${otherCat.name} [${otherPort.name}]</span>`;
  }

  dom.inspectorInfo.innerHTML = `
    <div style="font-weight:700; color:#fff; margin-bottom:3px;">${cat.name} (U${dev.topU})</div>
    <div><b>Port:</b> ${portName} (${portSpeed})</div>
    <div><b>Tip:</b> ${portEl.dataset.portType.toUpperCase()}</div>
    <div><b>Durum:</b> ${connectionInfo}</div>
  `;

  const rect = portEl.getBoundingClientRect();
  dom.tooltip.style.display = 'block';
  dom.tooltip.style.left = `${rect.right + 10}px`;
  dom.tooltip.style.top = `${rect.top - 5}px`;
  dom.tooltip.innerHTML = `<b>${cat.modelTag}</b> &bull; ${portName}<br><span style="color:#94a3b8; font-size:0.68rem;">${portSpeed}</span>`;
}

function handlePortLeave() {
  dom.tooltip.style.display = 'none';
}

function handlePortClick(e) {
  e.stopPropagation();
  const portEl = e.currentTarget;
  const instanceId = portEl.dataset.instanceId;
  const portId = portEl.dataset.portId;

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
      instanceId,
      portId,
      element: portEl
    };

    portEl.classList.add('selected');
    const dev = STATE.devices.find(d => d.instanceId === instanceId);
    const cat = HARDWARE_CATALOG[dev.catalogKey];
    const port = cat.ports.find(p => p.id === portId);

    dom.connectionStatusHint.innerHTML = `Kaynak: <span style="color:#38bdf8;">${cat.modelTag} (${port.name})</span> &rarr; <b>Hedef Porta Tıklayın</b>`;
  } else {
    const source = STATE.pendingConnection;

    if (source.instanceId === instanceId && source.portId === portId) {
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

    const newCable = {
      id: 'CBL-' + String(STATE.cables.length + 1).padStart(3, '0'),
      from: { instanceId: source.instanceId, portId: source.portId },
      to: { instanceId, portId },
      color: STATE.selectedCableColor,
      lengthMeters: calculateCableLengthMeters(source.instanceId, instanceId)
    };

    STATE.cables.push(newCable);
    cancelPendingConnection();

    renderMountedDevices();
    renderScheduleTable();
    renderAllCables();
  }
}

export function calculateCableLengthMeters(instA, instB) {
  const devA = STATE.devices.find(d => d.instanceId === instA);
  const devB = STATE.devices.find(d => d.instanceId === instB);
  if (!devA || !devB) return 1.5;
  const uDiff = Math.abs(devA.topU - devB.topU);
  const length = 0.5 + (uDiff * 0.045) + (uDiff > 5 ? 0.8 : 0.2);
  return parseFloat(length.toFixed(2));
}
