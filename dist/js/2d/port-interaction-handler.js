/**
 * Cisco Enterprise Rack & Cabling Studio - Port Interaction Handler Module
 * Handles port hover tooltips, click & double-click interactions, port role cycling,
 * and completing interactive cable patching between endpoints.
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
  const resolveCatalogItem = (key) => HARDWARE_CATALOG[key] || RS.resolveCatalogItem?.(key) || RS.catalog?.[key] || STATE.customCatalog?.[key] || null;
  const portKey = (instanceId, portId) => (RS.portKey ? RS.portKey(instanceId, portId) : JSON.stringify([instanceId, portId]));
  const cancelPendingConnection = () => RS.cancelPendingConnection && RS.cancelPendingConnection();
  const renderMountedDevices = () => RS.renderMountedDevices && RS.renderMountedDevices();
  const renderAllCables = () => RS.renderAllCables && RS.renderAllCables();
  const renderScheduleTable = () => RS.renderScheduleTable && RS.renderScheduleTable();
  const highlightCable = (...args) => RS.highlightCable && RS.highlightCable(...args);
  const showCableQuickHud = (...args) => RS.showCableQuickHud && RS.showCableQuickHud(...args);
  const showConnectionErrorToast = (...args) => RS.showConnectionErrorToast && RS.showConnectionErrorToast(...args);
  const showUplinkVisualConfirmModal = (...args) => RS.showUplinkVisualConfirmModal && RS.showUplinkVisualConfirmModal(...args);
  const getNextCableId = () => (RS.getNextCableId ? RS.getNextCableId() : 'cable-' + Date.now());

  // Port role cycling logic is extracted to js/2d/port-role-cycling.js
  const PORT_ROLE_CYCLES = RS.PORT_ROLE_CYCLES || { copper: [null, 'access', 'trunk', 'uplink', 'routed', 'poe', 'management', 'console'], fiber: [null, 'fiber'] };
  const PORT_ROLE_META = RS.PORT_ROLE_META || {};
  const getPortAliases = (portId) => RS.getPortAliases ? RS.getPortAliases(portId) : [String(portId || '')];
  const cyclePortRole = (...args) => RS.cyclePortRole && RS.cyclePortRole(...args);
  const showPortRoleCycleToast = (...args) => RS.showPortRoleCycleToast && RS.showPortRoleCycleToast(...args);
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
        if (RS.isSpacePressed) return;
        const portEl = e.target.closest('.port');
        if (!portEl) return;
        if (STATE.multiSelectMode) {
          const dev = portEl.closest('.mounted-device');
          if (dev) {
            e.preventDefault();
            e.stopPropagation();
            RS.toggleMultiSelect?.(dev.id);
            return;
          }
        }
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

        const isOccupied = (RS.occupiedPortKeys || new Set()).has(portKey(instanceId, portId));
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

  // Pixi device LOD removes the DOM port nodes, but port selection must keep
  // using the same connection/configuration rules as the DOM path. The small
  // adapter below gives the existing handlers the DOM surface they need
  // without manufacturing a node per Pixi port.
  function dispatchPixiPortInteraction(action, port, rect, sprite) {
    if (action === 'leave') {
      handlePortLeave();
      return true;
    }
    if (!port || !port.instanceId || port.portId == null) return false;
    const target = {
      dataset: {
        instanceId: String(port.instanceId),
        portId: String(port.portId),
        portName: String(port.name || port.portId),
        portType: String(port.type || ''),
        portSpeed: String(port.speed || '')
      },
      getBoundingClientRect: () => rect || { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 },
      classList: {
        add(name) {
          if (name === 'selected' && sprite) sprite.tint = 0x67e8f9;
        },
        remove(name) {
          if (name === 'selected' && sprite) {
            const roleColor = RS.getPixiPortRoleColor ? RS.getPixiPortRoleColor(target.dataset.instanceId, target.dataset.portId) : null;
            sprite.tint = roleColor !== null ? roleColor : 0xffffff;
          }
        }
      }
    };

    if (action === 'hover') handlePortHover({ currentTarget: target, target });
    else if (action === 'click') {
      if (STATE.multiSelectMode) {
        if (target.dataset.instanceId && RS.toggleMultiSelect) {
          RS.toggleMultiSelect(target.dataset.instanceId);
          return true;
        }
      }
      handlePortClick({ currentTarget: target, target, stopPropagation() {} });
    }
    else if (action === 'dblclick') {
      const instanceId = target.dataset.instanceId;
      const portId = target.dataset.portId;
      const portType = target.dataset.portType;
      const isOccupied = (RS.occupiedPortKeys || new Set()).has(portKey(instanceId, portId));
      if (isOccupied) return true;
      if (STATE.pendingConnection) cancelPendingConnection();
      const devRack = STATE.racks.find(rack => rack.devices.some(device => device.instanceId === instanceId));
      const dev = devRack?.devices.find(device => device.instanceId === instanceId);
      if (devRack && dev) cyclePortRole(instanceId, portId, portType);
    }
    else if (action === 'contextmenu') {
      if (window.PortConfigEditor) window.PortConfigEditor.open(target.dataset.instanceId, target.dataset.portId, '2d');
    } else return false;
    return true;
  }

  RS.dispatchPixiPortInteraction = dispatchPixiPortInteraction;

  function handlePortHover(e) {
    const portEl = e.currentTarget;
    const instanceId = portEl.dataset.instanceId;
    const portId = portEl.dataset.portId;
    const portName = portEl.dataset.portName;
    const portSpeed = portEl.dataset.portSpeed;

    const activeRack = getActiveRack();
    const deviceRack = STATE.racks.find(rack => rack.devices.some(device => device.instanceId === instanceId)) || activeRack;
    if (!deviceRack) return;

    const dev = deviceRack.devices.find(d => d.instanceId === instanceId);
    if (!dev) return;
    const cat = resolveCatalogItem(dev.catalogKey);
    if (!cat) return;

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
      const otherCat = otherDev ? resolveCatalogItem(otherDev.catalogKey) : null;
      const otherPort = otherCat ? otherCat.ports.find(p => p.id === otherEndpoint.portId) : null;

      const isInterRack = otherEndpoint.rackId !== deviceRack.id;
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
        <div style="font-weight:700; color:#fff; margin-bottom:3px;">${escapeHtml(cat.name)} (${escapeHtml(deviceRack.name)} - U${dev.topU})</div>
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
          ? rules.validateConnection(src, { rackId: deviceRack.id, instanceId, portId }, STATE, HARDWARE_CATALOG, strict)
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
          highlightCable(connectedCable.id, true);
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
      RS.refreshPixiPortHighlights?.();
      const dev = devRack.devices.find(d => d.instanceId === instanceId);
      const cat = dev ? resolveCatalogItem(dev.catalogKey) : null;
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

      const sourceCat = sourceDev ? resolveCatalogItem(sourceDev.catalogKey) : null;
      const targetCat = targetDev ? resolveCatalogItem(targetDev.catalogKey) : null;
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

  const findRoutingOrganizers = (...args) => RS.findRoutingOrganizers ? RS.findRoutingOrganizers(...args) : [];
  const calculateCableLengthMeters = (...args) => RS.calculateCableLengthMeters ? RS.calculateCableLengthMeters(...args) : 1.5;

  RS.PORT_ROLE_CYCLES = PORT_ROLE_CYCLES;
  RS.PORT_ROLE_META = PORT_ROLE_META;
  RS.getPortAliases = getPortAliases;
  if (!RS.cyclePortRole) RS.cyclePortRole = cyclePortRole;
  if (!RS.showPortRoleCycleToast) RS.showPortRoleCycleToast = showPortRoleCycleToast;
  RS.bindPortInteractions = bindPortInteractions;
  RS.handlePortHover = handlePortHover;
  RS.handlePortLeave = handlePortLeave;
  RS.handlePortClick = handlePortClick;
  if (!RS.findRoutingOrganizers) RS.findRoutingOrganizers = findRoutingOrganizers;
  if (!RS.calculateCableLengthMeters) RS.calculateCableLengthMeters = calculateCableLengthMeters;
})();
