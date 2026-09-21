/**
 * Cisco Enterprise Rack & Cabling Studio - Cables SVG Renderer Module
 * Handles drawing SVG patch cables, curved Béziers, structured conduit pathways,
 * connector boots/pins, cable tooltips, highlights, and DOM node pooling.
 */
(function () {
  'use strict';

  const RS = window.RackStudio = window.RackStudio || {};

  const STATE = RS.STATE;
  const dom = RS.dom;
  const HARDWARE_CATALOG = RS.HARDWARE_CATALOG;

  const getActiveRack = () => (RS.getActiveRack ? RS.getActiveRack() : RS.STATE?.racks?.[0]);
  const escapeHtml = (val) => RS.escapeHtml ? RS.escapeHtml(val) : String(val ?? '');
  const showTemporaryTooltip = (...args) => RS.showTemporaryTooltip && RS.showTemporaryTooltip(...args);
  const renderMountedDevices = () => RS.renderMountedDevices && RS.renderMountedDevices();
  const renderScheduleTable = () => RS.renderScheduleTable && RS.renderScheduleTable();

  const computeCableLength = (...args) => (RS.computeCableLength ? RS.computeCableLength(...args) : 1.5);
  const findDeviceOrganizer = (...args) => (RS.findDeviceOrganizer ? RS.findDeviceOrganizer(...args) : null);
  const resolveCableDuctSide = (...args) => (RS.resolveCableDuctSide ? RS.resolveCableDuctSide(...args) : false);
  const renderDRingOverlays = (...args) => (RS.renderDRingOverlays && RS.renderDRingOverlays(...args));
  const hideCableQuickHud = (...args) => (RS.hideCableQuickHud && RS.hideCableQuickHud(...args));
  const hideCableContextMenu = (...args) => (RS.hideCableContextMenu && RS.hideCableContextMenu(...args));
  const showCableQuickHud = (...args) => (RS.showCableQuickHud && RS.showCableQuickHud(...args));
  const showCableContextMenu = (...args) => (RS.showCableContextMenu && RS.showCableContextMenu(...args));

  function cancelPendingConnection() {
    if (STATE.pendingConnection && STATE.pendingConnection.element) {
      STATE.pendingConnection.element.classList.remove('selected');
    }
    STATE.pendingConnection = null;
    if (dom.connectionStatusHint) {
      dom.connectionStatusHint.innerHTML = 'Bağlamak için <b>Kaynak Porta</b> tıklayın';
    }
  }

  function getNextCableId() {
    STATE.cableCounter++;
    return 'CBL-' + String(STATE.cableCounter).padStart(3, '0');
  }

  function getCableEndpointInfo(activeRack, endpoint) {
    const instanceId = endpoint.instanceId || endpoint.deviceId;
    // Search all racks for the device (supports multi-rack)
    let device = null;
    let catalog = null;
    for (const rack of (STATE.racks || [activeRack])) {
      const found = rack.devices.find(d => d.instanceId === instanceId);
      if (found) { device = found; catalog = HARDWARE_CATALOG[found.catalogKey]; break; }
    }
    if (!device) { device = activeRack.devices.find(d => d.instanceId === instanceId); catalog = device ? HARDWARE_CATALOG[device.catalogKey] : null; }
    const port = catalog && Array.isArray(catalog.ports)
      ? catalog.ports.find(p => p.id === endpoint.portId) || catalog.ports[(Number(endpoint.portIdx) || 1) - 1]
      : null;
    const deviceName = (device && (device.name || device.hostname)) || (catalog && (catalog.modelTag || catalog.name)) || 'Cihaz';
    const portName = (port && (port.name || port.id)) || endpoint.portId || `Port ${endpoint.portIdx || '?'}`;
    return { deviceName, portName };
  }

  function shortenDeviceName(name) {
    if (!name) return '';
    return String(name)
      .replace(/^Cisco\s+(Catalyst\s+)?/i, '')
      .replace(/\s+\d+\s+Port\s+Gigabit\s+PoE\+?$/i, '')
      .replace(/^(\d+\s+Port\s+Cat\d+e?\s+RJ45\s+Patch\s+Panel)/i, 'Cat6 PP-24')
      .replace(/^ODF\s+\d+\s+Port\s+(LC|SC)\s+(OS2|OM4)\s+Fiber\s+Patch\s+Panel/i, 'ODF-24 $1')
      .replace(/\s+Patch\s+Panel$/i, ' PP')
      .trim();
  }

  function getCableLabel(activeRack, cable) {
    const from = getCableEndpointInfo(activeRack, cable.from);
    const to = getCableEndpointInfo(activeRack, cable.to);
    const fromDev = shortenDeviceName(from.deviceName) || from.deviceName;
    const toDev = shortenDeviceName(to.deviceName) || to.deviceName;
    const isFiber = cable.role === 'fiber' || cable.color === '#facc15' || cable.name?.includes('[FIBER]');
    const fiberTag = isFiber ? '[FIBER] ' : '';
    const endpoints = `${fromDev} / ${from.portName} ➔ ${toDev} / ${to.portName}`;
    if (cable.name) {
      if (cable.name.includes('➔') || cable.name.includes('->')) {
        return `${fiberTag}${cable.name}`;
      }
      return `${fiberTag}${cable.name}: ${endpoints}`;
    }
    return `${fiberTag}${endpoints}`;
  }

  function renameCable2D(cableId) {
    const cable = STATE.cables.find(item => item.id === cableId);
    if (!cable) return;
    const nextName = prompt('Kablo Adı / Etiketi:', cable.name || cable.id);
    if (nextName === null) return;
    const normalizedName = nextName.trim();
    if (!normalizedName) {
      showTemporaryTooltip(window.innerWidth / 2, 80, 'Kablo adı boş bırakılamaz.');
      return;
    }
    cable.name = normalizedName;
    renderScheduleTable();
    RS.renderAllCables?.();
    window.dispatchEvent(new CustomEvent('rackstudio:refresh'));
  }

  let hoveredPlaceholder = null;
  let activeHoveredCableId = null;

  function restoreHoveredCable() {
    if (!hoveredPlaceholder) return;
    const { placeholder, casing, path, bootPlaceholder, boots } = hoveredPlaceholder;
    if (placeholder && placeholder.parentNode) {
      if (casing && casing.parentNode) placeholder.parentNode.insertBefore(casing, placeholder);
      if (path && path.parentNode) placeholder.parentNode.insertBefore(path, placeholder);
      placeholder.remove();
    }
    if (bootPlaceholder && bootPlaceholder.parentNode && boots) {
      boots.forEach(b => {
        if (b && b.parentNode) bootPlaceholder.parentNode.insertBefore(b, bootPlaceholder);
      });
      bootPlaceholder.remove();
    }
    hoveredPlaceholder = null;
    activeHoveredCableId = null;
  }

  function setCableHover(cableId, isHovered, source) {
    if (source !== 'pixi' && STATE.cableRenderMode === 'pixi' && RS.setPixiCableHover) {
      RS.setPixiCableHover(cableId, isHovered);
    }

    const svgEl = dom.cablesSvg || document.getElementById('cables-svg');
    const cablesGroup = dom.cablesGroup || document.getElementById('cables-group');
    const connectorsGroup = dom.connectorsGroup || document.getElementById('connectors-group');

    if (!isHovered) {
      const p = document.getElementById(`svg-cable-${cableId}`);
      const c = document.getElementById(`svg-cable-casing-${cableId}`);
      if (p) p.classList.remove('hovered');
      if (c) c.classList.remove('hovered');
      document.querySelectorAll(`.cable-boot[data-cable-id="${cableId}"], .cable-boot-pin[data-cable-id="${cableId}"]`).forEach(b => {
        b.classList.remove('hovered');
      });
      document.querySelectorAll(`#schedule-tbody tr[data-cable-id="${cableId}"]`).forEach(row => {
        row.classList.remove('hovered-row');
      });
      document.querySelectorAll(`#schedule-tbody .tree-cable-row[data-cable-id="${cableId}"]`).forEach(row => {
        row.classList.remove('hovered');
      });
      document.querySelectorAll('.port.port-cable-hover').forEach(el => {
        el.classList.remove('port-cable-hover');
      });
      if (activeHoveredCableId === cableId) {
        restoreHoveredCable();
        activeHoveredCableId = null;
      }
      if (svgEl && !activeHoveredCableId) {
        svgEl.classList.remove('has-cable-hovered');
      }
      return;
    }

    if (activeHoveredCableId === cableId) return;

    // Restore any previously hovered cable before promoting the new one
    if (activeHoveredCableId) {
      const prevP = document.getElementById(`svg-cable-${activeHoveredCableId}`);
      const prevC = document.getElementById(`svg-cable-casing-${activeHoveredCableId}`);
      if (prevP) prevP.classList.remove('hovered');
      if (prevC) prevC.classList.remove('hovered');
      document.querySelectorAll(`.cable-boot[data-cable-id="${activeHoveredCableId}"], .cable-boot-pin[data-cable-id="${activeHoveredCableId}"]`).forEach(b => {
        b.classList.remove('hovered');
      });
      document.querySelectorAll(`#schedule-tbody tr[data-cable-id="${activeHoveredCableId}"]`).forEach(row => {
        row.classList.remove('hovered-row');
      });
      document.querySelectorAll(`#schedule-tbody .tree-cable-row[data-cable-id="${activeHoveredCableId}"]`).forEach(row => {
        row.classList.remove('hovered');
      });
      document.querySelectorAll('.port.port-cable-hover').forEach(el => {
        el.classList.remove('port-cable-hover');
      });
      restoreHoveredCable();
    }

    activeHoveredCableId = cableId;

    if (svgEl) {
      svgEl.classList.add('has-cable-hovered');
    }

    const p = document.getElementById(`svg-cable-${cableId}`);
    const c = document.getElementById(`svg-cable-casing-${cableId}`);
    if (p) p.classList.add('hovered');
    if (c) c.classList.add('hovered');

    const boots = Array.from(document.querySelectorAll(`.cable-boot[data-cable-id="${cableId}"], .cable-boot-pin[data-cable-id="${cableId}"]`));
    boots.forEach(b => b.classList.add('hovered'));

    const cableObj = (STATE.cables || []).find(item => item.id === cableId);
    if (cableObj) {
      if (cableObj.from?.instanceId && cableObj.from?.portId) {
        const el = document.getElementById(`port-${cableObj.from.instanceId}-${cableObj.from.portId}`);
        if (el) el.classList.add('port-cable-hover');
      }
      if (cableObj.to?.instanceId && cableObj.to?.portId) {
        const el = document.getElementById(`port-${cableObj.to.instanceId}-${cableObj.to.portId}`);
        if (el) el.classList.add('port-cable-hover');
      }
    }

    document.querySelectorAll(`#schedule-tbody tr[data-cable-id="${cableId}"]`).forEach(row => {
      row.classList.add('hovered-row');
    });
    document.querySelectorAll(`#schedule-tbody .tree-cable-row[data-cable-id="${cableId}"]`).forEach(row => {
      row.classList.add('hovered');
    });
    if (RS.ensureCableVisibleInSchedule) {
      const tableRow = RS.ensureCableVisibleInSchedule(cableId);
      if (tableRow) {
        if (tableRow.tagName === 'TR') {
          tableRow.classList.add('hovered-row');
        } else {
          tableRow.classList.add('hovered');
        }
        tableRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }

    // Temporarily bring the hovered cable & casing to the very top of cablesGroup (SVG z-order)
    if (cablesGroup && c && p && c.parentNode === cablesGroup) {
      const placeholder = document.createComment(`hover-placeholder-${cableId}`);
      cablesGroup.insertBefore(placeholder, c);

      let bootPlaceholder = null;
      if (connectorsGroup && boots.length > 0) {
        bootPlaceholder = document.createComment(`hover-boot-placeholder-${cableId}`);
        connectorsGroup.insertBefore(bootPlaceholder, boots[0]);
        boots.forEach(b => connectorsGroup.appendChild(b));
      }

      cablesGroup.appendChild(c);
      cablesGroup.appendChild(p);

      hoveredPlaceholder = { placeholder, casing: c, path: p, bootPlaceholder, boots, cableId };
    }
  }

  let activeHoveredDeviceId = null;

  function setDeviceCablesHover(instanceId, isHovered) {
    const svgEl = dom.cablesSvg || document.getElementById('cables-svg');
    if (!isHovered) {
      if (!instanceId || activeHoveredDeviceId === instanceId) {
        activeHoveredDeviceId = null;
        if (svgEl) svgEl.classList.remove('has-cable-hovered');
        if (STATE.cableRenderMode === 'pixi' && RS.setPixiCableGroupHover) {
          RS.setPixiCableGroupHover([]);
        }
        document.querySelectorAll('.port.port-cable-hover').forEach(el => {
          el.classList.remove('port-cable-hover');
        });
        document.querySelectorAll('.cable-path.hovered, .cable-casing.hovered, .cable-boot.hovered, .cable-boot-pin.hovered').forEach(el => {
          el.classList.remove('hovered');
        });
        document.querySelectorAll('.tree-cable-row.hovered, .schedule-tree-switch-card.active-switch').forEach(el => {
          el.classList.remove('hovered', 'active-switch');
        });
      }
      return;
    }

    activeHoveredDeviceId = instanceId;
    if (svgEl) svgEl.classList.add('has-cable-hovered');

    const switchCard = document.querySelector(`.schedule-tree-switch-card[data-instance-id="${instanceId}"]`);
    if (switchCard) switchCard.classList.add('active-switch');

    const deviceCables = (STATE.cables || []).filter(c =>
      (c.from && c.from.instanceId === instanceId) || (c.to && c.to.instanceId === instanceId)
    );

    if (STATE.cableRenderMode === 'pixi' && RS.setPixiCableGroupHover) {
      RS.setPixiCableGroupHover(deviceCables.map(c => c.id));
    }

    deviceCables.forEach(c => {
      const p = document.getElementById(`svg-cable-${c.id}`);
      const casing = document.getElementById(`svg-cable-casing-${c.id}`);
      if (p) p.classList.add('hovered');
      if (casing) casing.classList.add('hovered');
      document.querySelectorAll(`.cable-boot[data-cable-id="${c.id}"], .cable-boot-pin[data-cable-id="${c.id}"]`).forEach(b => {
        b.classList.add('hovered');
      });
      const treeRow = document.querySelector(`.tree-cable-row[data-cable-id="${c.id}"]`);
      if (treeRow) treeRow.classList.add('hovered');

      // Highlight the connected ports on both ends
      if (c.from?.instanceId && c.from?.portId) {
        const el = document.getElementById(`port-${c.from.instanceId}-${c.from.portId}`);
        if (el) el.classList.add('port-cable-hover');
      }
      if (c.to?.instanceId && c.to?.portId) {
        const el = document.getElementById(`port-${c.to.instanceId}-${c.to.portId}`);
        if (el) el.classList.add('port-cable-hover');
      }
    });
  }

  function ensureCableDelegation(svgEl) {
    if (!svgEl || svgEl.__DELEGATION_BOUND__) return;
    svgEl.__DELEGATION_BOUND__ = true;

    svgEl.addEventListener('click', (e) => {
      const boot = e.target.closest('.cable-boot');
      if (boot && boot.dataset.cableId) {
        e.stopPropagation();
        highlightCable(boot.dataset.cableId);
        showCableQuickHud(boot.dataset.cableId, e.clientX, e.clientY);
        return;
      }
      const path = e.target.closest('.cable-path');
      if (path && path.dataset.cableId) {
        e.stopPropagation();
        highlightCable(path.dataset.cableId);
        showCableQuickHud(path.dataset.cableId, e.clientX, e.clientY);
        return;
      }
    });

    svgEl.addEventListener('contextmenu', (e) => {
      const el = e.target.closest('[data-cable-id]');
      if (el && el.dataset.cableId) {
        e.preventDefault();
        e.stopPropagation();
        highlightCable(el.dataset.cableId);
        showCableContextMenu(el.dataset.cableId, e.clientX, e.clientY);
      }
    });

    svgEl.addEventListener('dblclick', (e) => {
      const path = e.target.closest('.cable-path');
      if (path && path.dataset.cableId) {
        e.preventDefault();
        e.stopPropagation();
        renameCable2D(path.dataset.cableId);
      }
    });

    svgEl.addEventListener('mouseover', (e) => {
      if (STATE.pendingConnection) return;
      if (document.getElementById('cable-quick-hud') || document.getElementById('cable-context-menu')) return;
      const el = e.target.closest('[data-cable-id]');
      if (el && el.dataset.cableId) {
        setCableHover(el.dataset.cableId, true);
        showCableTooltip(e, el.dataset.cableId);
      }
    });

    svgEl.addEventListener('mouseout', (e) => {
      const el = e.target.closest('[data-cable-id]');
      if (el && el.dataset.cableId) {
        const rel = e.relatedTarget ? e.relatedTarget.closest('[data-cable-id]') : null;
        if (!rel || rel.dataset.cableId !== el.dataset.cableId) {
          setCableHover(el.dataset.cableId, false);
          if (dom.tooltip) dom.tooltip.style.display = 'none';
        }
      }
    });

    svgEl.addEventListener('mousemove', (e) => {
      if (STATE.pendingConnection) return;
      if (document.getElementById('cable-quick-hud') || document.getElementById('cable-context-menu')) {
        if (dom.tooltip) dom.tooltip.style.display = 'none';
        return;
      }
      if (dom.tooltip && dom.tooltip.style.display !== 'none') {
        dom.tooltip.style.left = `${e.clientX + 10}px`;
        dom.tooltip.style.top = `${e.clientY - 10}px`;
      }
    });
  }

  function showCableTooltip(e, cableId) {
    if (STATE.pendingConnection || !dom.tooltip) return;
    if (document.getElementById('cable-quick-hud') || document.getElementById('cable-context-menu')) {
      dom.tooltip.style.display = 'none';
      return;
    }
    const cable = (STATE.cables || []).find(c => c.id === cableId);
    if (!cable) return;
    const activeRack = getActiveRack();
    const cableLabel = getCableLabel(activeRack, cable);
    dom.tooltip.style.display = 'block';
    dom.tooltip.style.left = `${e.clientX + 10}px`;
    dom.tooltip.style.top = `${e.clientY - 10}px`;
    dom.tooltip.innerHTML = `
      <b>${escapeHtml(cable.id)}</b> (${Number(cable.lengthMeters || 0).toFixed(1)}m)<br>
      <span style="color:${cable.color};">&#9632;</span> <strong>${escapeHtml(cableLabel)}</strong><br>
      <span style="color:#f59e0b;font-size:11px;">Yeniden adlandırmak için çift tıklayın</span>
    `;
  }

  function getOrCreateSvgElement(tagName, id) {
    const existing = document.getElementById(id);
    if (existing && existing.namespaceURI === 'http://www.w3.org/2000/svg') return existing;
    const element = document.createElementNS('http://www.w3.org/2000/svg', tagName);
    element.id = id;
    return element;
  }

  function renderAllCables() {
    restoreHoveredCable();

    // Re-acquire DOM refs in case DOM was rebuilt
    const cablesGroup = dom.cablesGroup || document.getElementById('cables-group');
    const connectorsGroup = dom.connectorsGroup || document.getElementById('connectors-group');
    if (!cablesGroup) return;

    const svgEl = dom.cablesSvg || document.getElementById('cables-svg');
    const svgRect = svgEl ? svgEl.getBoundingClientRect() : null;
    if (!svgRect || svgRect.width <= 0) return;

    if (svgEl) {
      ensureCableDelegation(svgEl);
      svgEl.classList.toggle('has-cable-selected', !!STATE.highlightedCableId);
      if (!svgEl.__HOVER_LEAVE_BOUND__) {
        svgEl.__HOVER_LEAVE_BOUND__ = true;
        svgEl.addEventListener('mouseleave', () => {
          if (activeHoveredCableId) {
            setCableHover(activeHoveredCableId, false);
          }
        });
      }
    }

    const isMulti = STATE.viewMode === 'multi' && STATE.racks && STATE.racks.length > 1;
    const activeRack = getActiveRack();

    // In multi mode, SVG covers all racks side-by-side (total width).
    // In single mode, SVG covers just the active rack (618px).
    let svgW = 618;
    let svgH = (activeRack?.heightU || 42) * 32;
    if (isMulti) {
      const numRacks = STATE.racks.length;
      const maxU = Math.max(...STATE.racks.map(r => r.heightU || 42));
      svgW = numRacks * 634 + (numRacks - 1) * 64 + 120;
      svgH = maxU * 32 + 156;
    }

    if (svgEl) {
      svgEl.setAttribute('viewBox', `0 0 ${svgW} ${svgH}`);
      svgEl.setAttribute('preserveAspectRatio', 'none');
    }

    const scaleX = svgRect.width / svgW;
    const scaleY = svgRect.height / svgH;

    const ctmInv = (svgEl && svgEl.getScreenCTM) ? svgEl.getScreenCTM()?.inverse() : null;
    const svgPoint = (svgEl && svgEl.createSVGPoint) ? svgEl.createSVGPoint() : null;

    function clientToSvg(clientX, clientY) {
      if (ctmInv && svgPoint) {
        svgPoint.x = clientX;
        svgPoint.y = clientY;
        const pt = svgPoint.matrixTransform(ctmInv);
        return { x: pt.x, y: pt.y };
      }
      return {
        x: (clientX - svgRect.left) / scaleX,
        y: (clientY - svgRect.top) / scaleY
      };
    }

    const portRects = new Map();
    function getPortRect(el) {
      if (!el) return null;
      const key = el.id || el;
      let r = portRects.get(key);
      if (!r) {
        r = el.getBoundingClientRect();
        portRects.set(key, r);
      }
      return r;
    }

    const rackRailCache = new Map();
    function getRackRailBounds(rackId) {
      if (!rackId) return { left: 23, right: 595, top: 0 };
      if (rackRailCache.has(rackId)) return rackRailCache.get(rackId);
      let left = 23;
      let right = 595;
      let top = 0;
      const rackCont = document.querySelector(`.rack-container[data-rack-id="${rackId}"]`) ||
                       document.getElementById(`rack-container-${rackId}`) ||
                       document.getElementById('rack-container');
      if (rackCont) {
        const rc = rackCont.getBoundingClientRect();
        top = clientToSvg(0, rc.top).y;
        const railL = rackCont.querySelector('.rack-rail.left');
        const railR = rackCont.querySelector('.rack-rail.right');
        if (railL && railR) {
          const lRect = railL.getBoundingClientRect();
          const rRect = railR.getBoundingClientRect();
          left = clientToSvg(lRect.left + lRect.width / 2, 0).x;
          right = clientToSvg(rRect.left + rRect.width / 2, 0).x;
        } else {
          left = clientToSvg(rc.left + 30, 0).x;
          right = clientToSvg(rc.right - 30, 0).x;
        }
      }
      const bounds = { left, right, top };
      rackRailCache.set(rackId, bounds);
      return bounds;
    }

    const orgYCache = new Map();
    function getCachedOrgY(org, fallbackY, otherY) {
      if (!org || !org.instanceId) return fallbackY + (otherY >= fallbackY ? 14 : -14);
      if (orgYCache.has(org.instanceId)) return orgYCache.get(org.instanceId);
      const orgEl = document.getElementById(org.instanceId);
      if (orgEl) {
        const r = orgEl.getBoundingClientRect();
        const y = clientToSvg(0, r.top + r.height / 2).y;
        orgYCache.set(org.instanceId, y);
        return y;
      }
      return fallbackY + (otherY >= fallbackY ? 14 : -14);
    }

    let leftChannelUsage = 0;
    let rightChannelUsage = 0;

    const MM_PER_U       = 44.45;                         // mm  (EIA-310)
    const SVG_PX_PER_U   = 32;                            // px  (design constant)
    const MM_PER_SVG_Y   = MM_PER_U / SVG_PX_PER_U;      // ≈ 1.389 mm / svg-px
    const SLACK_FACTOR   = 1.05;                          // 5% slack for dress & bend radius

    const cablesFrag = document.createDocumentFragment();
    const connectorsFrag = document.createDocumentFragment();

    STATE.cables.forEach((cable) => {
      if (!isMulti && cable.from?.rackId && cable.to?.rackId) {
        if (cable.from.rackId !== activeRack?.id && cable.to.rackId !== activeRack?.id) {
          return;
        }
      }

      const instA = cable.from.instanceId || cable.from.deviceId;
      const instB = cable.to.instanceId || cable.to.deviceId;
      const portIdA = cable.from.portId || ('p' + cable.from.portIdx);
      const portIdB = cable.to.portId || ('p' + cable.to.portIdx);

      let portFromEl = document.getElementById(`port-${instA}-${portIdA}`);
      let portToEl = document.getElementById(`port-${instB}-${portIdB}`);

      if (!portFromEl) {
        portFromEl = document.querySelector(`.port[data-instance-id="${instA}"][data-port-id="${portIdA}"]`) ||
                     document.querySelector(`.port[data-instance-id="${instA}"]`);
      }
      if (!portToEl) {
        portToEl = document.querySelector(`.port[data-instance-id="${instB}"][data-port-id="${portIdB}"]`) ||
                    document.querySelector(`.port[data-instance-id="${instB}"]`);
      }

      const isInterRack = cable.from?.rackId !== cable.to?.rackId;
      if (!portFromEl && !portToEl) return;

      let isStub = false;
      let isFromMounted = true;
      let stubBadgeText = '';
      let isRightExit = true;
      let x1 = 0, y1 = 0, x2 = 0, y2 = 0;

      if (isInterRack && (!portFromEl || !portToEl)) {
        isStub = true;
        isFromMounted = !!portFromEl;
        const localPortEl = isFromMounted ? portFromEl : portToEl;
        const remoteEndpoint = isFromMounted ? cable.to : cable.from;
        const rectLocal = getPortRect(localPortEl);
        if (!rectLocal || (rectLocal.width === 0 && rectLocal.height === 0)) return;

        const pLocal = clientToSvg(rectLocal.left + rectLocal.width / 2, rectLocal.top + rectLocal.height / 2);
        const boundsLocal = getRackRailBounds(activeRack?.id);
        const activeIdx = (STATE.racks || []).findIndex(r => r && r.id === activeRack?.id);
        const remoteIdx = (STATE.racks || []).findIndex(r => r && r.id === remoteEndpoint.rackId);
        isRightExit = remoteIdx >= activeIdx;

        const remoteRack = (RS.getRackById ? RS.getRackById(remoteEndpoint.rackId) : null) || (STATE.racks || []).find(r => r && r.id === remoteEndpoint.rackId);
        const remoteDev = (RS.getDeviceById ? RS.getDeviceById(remoteEndpoint.instanceId) : null) || remoteRack?.devices?.find(d => d && d.instanceId === remoteEndpoint.instanceId);
        const remoteU = remoteDev?.topU ? `U${remoteDev.topU}` : '';
        const remoteName = remoteRack ? (remoteRack.name.length > 12 ? remoteRack.name.substring(0, 10) + '..' : remoteRack.name) : (remoteEndpoint.rackId || 'Kabin');
        stubBadgeText = `➔ ${remoteName} ${remoteU}`.trim();

        const stubX = isRightExit ? boundsLocal.right + 24 : boundsLocal.left - 24;
        const stubY = pLocal.y;

        x1 = isFromMounted ? pLocal.x : stubX;
        y1 = isFromMounted ? pLocal.y : stubY;
        x2 = isFromMounted ? stubX : pLocal.x;
        y2 = isFromMounted ? stubY : pLocal.y;
      } else {
        if (!portFromEl || !portToEl) return;
        const rectA = getPortRect(portFromEl);
        const rectB = getPortRect(portToEl);
        if (!rectA || !rectB) return;
        if (rectA.width === 0 && rectA.height === 0 && rectB.width === 0 && rectB.height === 0) return;

        // Exact unscaled SVG user coordinate calculation via SVG CTM transform
        const p1 = clientToSvg(rectA.left + rectA.width / 2, rectA.top + rectA.height / 2);
        const p2 = clientToSvg(rectB.left + rectB.width / 2, rectB.top + rectB.height / 2);
        x1 = p1.x;
        y1 = p1.y;
        x2 = p2.x;
        y2 = p2.y;
      }

      const dy = Math.abs(y2 - y1);
      const dx = Math.abs(x2 - x1);

      let pathD = '';

      if (isStub) {
        const ctrlX1 = isRightExit ? Math.max(x1, x2) - 10 : Math.min(x1, x2) + 10;
        pathD = `M ${x1} ${y1} C ${ctrlX1} ${y1}, ${x2} ${y2}, ${x2} ${y2}`;
        if (cable.lengthMeters == null) cable.lengthMeters = 3.0;
      } else if (isInterRack && STATE.cableRoutingMode === 'direct') {
        // Inter-rack cable in DIRECT mode: aerial Bézier arc above cabinets
        const overheadY = Math.min(y1, y2) - 80 - (leftChannelUsage++ % 6) * 8;
        pathD = `M ${x1} ${y1} C ${x1} ${overheadY}, ${x2} ${overheadY}, ${x2} ${y2}`;
        if (cable.lengthMeters == null) {
          cable.lengthMeters = computeCableLength('interrack-direct', { x1, y1, x2, y2, overheadY });
        }
      } else if (isInterRack && STATE.cableRoutingMode === 'structured') {
        // Inter-rack cable in STRUCTURED mode:
        // Follows datacenter pathway: Organizer A -> Vertical Channel A (UP) -> Overhead Cable Tray (across) -> Vertical Channel B (DOWN) -> Organizer B -> Port B
        const devA = RS.getDeviceById ? RS.getDeviceById(instA) : (STATE.deviceById?.get(instA) || STATE.racks.flatMap(r => r.devices).find(d => d.instanceId === instA));
        const devB = RS.getDeviceById ? RS.getDeviceById(instB) : (STATE.deviceById?.get(instB) || STATE.racks.flatMap(r => r.devices).find(d => d.instanceId === instB));
        const rackA = RS.getRackById ? RS.getRackById(cable.from.rackId) : (STATE.rackById?.get(cable.from.rackId) || STATE.racks.find(r => r.id === cable.from.rackId));
        const rackB = RS.getRackById ? RS.getRackById(cable.to.rackId) : (STATE.rackById?.get(cable.to.rackId) || STATE.racks.find(r => r.id === cable.to.rackId));

        const orgA = findDeviceOrganizer(rackA, devA);
        const orgB = findDeviceOrganizer(rackB, devB);

        let trayYA = getCachedOrgY(orgA, y1, y2);
        let trayYB = getCachedOrgY(orgB, y2, y1);

        const boundsA = getRackRailBounds(rackA?.id);
        const rackALeft = boundsA.left;
        const rackARight = boundsA.right;
        const topYA = boundsA.top || (y1 - 40);

        const boundsB = getRackRailBounds(rackB?.id);
        const rackBLeft = boundsB.left;
        const rackBRight = boundsB.right;
        const topYB = boundsB.top || topYA;

        const rackACenter = (rackALeft + rackARight) / 2;
        const rackBCenter = (rackBLeft + rackBRight) / 2;

        const goingRight = rackBCenter >= rackACenter;
        const useRightA = cable.ductSide === 'right' ? true : (cable.ductSide === 'left' ? false : (goingRight ? (x1 >= rackACenter - 40) : (x1 >= rackACenter + 40)));
        const useRightB = cable.ductSide === 'right' ? true : (cable.ductSide === 'left' ? false : (goingRight ? (x2 >= rackBCenter + 40) : (x2 >= rackBCenter - 40)));

        const bundleIdxA = useRightA ? rightChannelUsage++ : leftChannelUsage++;
        const railLaneA = (bundleIdxA % 9) - 4;
        const railOffsetA = railLaneA * 3.2;
        const channelXA = (useRightA ? rackARight : rackALeft) + railOffsetA;

        const bundleIdxB = useRightB ? rightChannelUsage++ : leftChannelUsage++;
        const railLaneB = (bundleIdxB % 9) - 4;
        const railOffsetB = railLaneB * 3.2;
        const channelXB = (useRightB ? rackBRight : rackBLeft) + railOffsetB;

        const traySlotA = (bundleIdxA % 7) - 3;
        const actualTrayYA = trayYA + traySlotA * 2.8;

        const traySlotB = (bundleIdxB % 7) - 3;
        const actualTrayYB = trayYB + traySlotB * 2.8;

        // Overhead ladder / tray level: above highest rack top
        const overheadLane = (bundleIdxA % 8);
        const overheadTrayY = Math.min(topYA, topYB) - 18 - (overheadLane * 4);

        // 1. Port 1 (x1, y1) -> Horizontal Tray A
        const dirY1 = actualTrayYA >= y1 ? 1 : -1;
        const dirX1 = channelXA >= x1 ? 1 : -1;
        const r1 = Math.min(8, Math.abs(channelXA - x1) / 2, Math.abs(actualTrayYA - y1) / 2 || 4);

        // 2. Horizontal Tray A -> Vertical Channel A (going UP towards overhead tray)
        const distRailYA = Math.abs(actualTrayYA - overheadTrayY);
        const rRailA = Math.min(10, Math.abs(channelXA - x1) / 2, distRailYA / 2 || 6);

        // 3. Vertical Channel A UP -> Overhead Tray (heading towards Rack B)
        const dirX_top = channelXB >= channelXA ? 1 : -1;
        const distTopX = Math.abs(channelXB - channelXA);
        const rTopA = Math.min(10, distTopX / 2 || 6, distRailYA / 2 || 6);

        // 4. Overhead Tray -> Vertical Channel B (turning DOWN towards Tray B)
        const distRailYB = Math.abs(actualTrayYB - overheadTrayY);
        const rTopB = Math.min(10, distTopX / 2 || 6, distRailYB / 2 || 6);

        // 5. Vertical Channel B DOWN -> Horizontal Tray B
        const dirX2 = x2 >= channelXB ? 1 : -1;
        const rRailB = Math.min(10, Math.abs(x2 - channelXB) / 2, distRailYB / 2 || 6);

        // 6. Horizontal Tray B -> Port B (x2, y2)
        const dirY2 = y2 >= actualTrayYB ? 1 : -1;
        const r2 = Math.min(8, Math.abs(x2 - channelXB) / 2, Math.abs(y2 - actualTrayYB) / 2 || 4);

        pathD = `M ${x1} ${y1} ` +
                `L ${x1} ${actualTrayYA - dirY1 * r1} ` +
                `Q ${x1} ${actualTrayYA} ${x1 + dirX1 * r1} ${actualTrayYA} ` +
                `L ${channelXA - dirX1 * rRailA} ${actualTrayYA} ` +
                `Q ${channelXA} ${actualTrayYA} ${channelXA} ${actualTrayYA - rRailA} ` +
                `L ${channelXA} ${overheadTrayY + rTopA} ` +
                `Q ${channelXA} ${overheadTrayY} ${channelXA + dirX_top * rTopA} ${overheadTrayY} ` +
                `L ${channelXB - dirX_top * rTopB} ${overheadTrayY} ` +
                `Q ${channelXB} ${overheadTrayY} ${channelXB} ${overheadTrayY + rTopB} ` +
                `L ${channelXB} ${actualTrayYB - rRailB} ` +
                `Q ${channelXB} ${actualTrayYB} ${channelXB + dirX2 * rRailB} ${actualTrayYB} ` +
                `L ${x2 - dirX2 * r2} ${actualTrayYB} ` +
                `Q ${x2} ${actualTrayYB} ${x2} ${actualTrayYB + dirY2 * r2} ` +
                `L ${x2} ${y2}`;
        if (cable.lengthMeters == null) {
          cable.lengthMeters = computeCableLength('interrack-structured', {
            x1, y1, x2, y2,
            channelXA, channelXB,
            trayYA: actualTrayYA, trayYB: actualTrayYB,
            overheadTrayY
          });
        }
      } else if (STATE.cableRoutingMode === 'structured') {
        // Find devices: check all racks, not just active rack
        const devA = RS.getDeviceById ? RS.getDeviceById(instA) : (STATE.deviceById?.get(instA) || STATE.racks.flatMap(r => r.devices).find(d => d.instanceId === instA));
        const devB = RS.getDeviceById ? RS.getDeviceById(instB) : (STATE.deviceById?.get(instB) || STATE.racks.flatMap(r => r.devices).find(d => d.instanceId === instB));
        const rackA = RS.getRackById ? RS.getRackById(cable.from.rackId) : (STATE.rackById?.get(cable.from.rackId) || activeRack);

        if (instA === instB) {
          // Same device loopback
          const loopSide = x1 > 300 ? 12 : -12;
          pathD = `M ${x1} ${y1} C ${x1 + loopSide} ${y1}, ${x2 + loopSide} ${y2}, ${x2} ${y2}`;
          // Loopback: tiny arc — port-to-port on same device, minimal physical length
          if (cable.lengthMeters == null) {
            cable.lengthMeters = Math.max(0.5, Math.round(Math.abs(y2 - y1) * MM_PER_SVG_Y / 1000 * SLACK_FACTOR * 2) / 2);
          }
        } else {
          // Structured datacenter cabling within same rack
          const orgA = findDeviceOrganizer(rackA, devA);
          const orgB = findDeviceOrganizer(rackA, devB);

          let trayYA = getCachedOrgY(orgA, y1, y2);
          let trayYB = getCachedOrgY(orgB, y2, y1);

          if (orgA && orgB && orgA.instanceId === orgB.instanceId) {
            const orgCenterY = trayYA;
            const isATop = Number(devA?.topU || 0) >= Number(devB?.topU || 0);
            trayYA = orgCenterY + (isATop ? -6 : 6);
            trayYB = orgCenterY + (isATop ? 6 : -6);
          }

          const avgX = (x1 + x2) / 2;

          // Dynamic channel X: read actual rack rail centers from cached bounds
          // This keeps cables neatly centered in the 44px side rails in both single and multi-rack modes
          const boundsA = getRackRailBounds(rackA?.id);
          const rackLeftEdge = boundsA.left;
          const rackRightEdge = boundsA.right;

          const rackCenterLine = (rackLeftEdge + rackRightEdge) / 2;
          const useRightChannel = resolveCableDuctSide(cable, x1, x2, rackCenterLine, leftChannelUsage, rightChannelUsage);
          const channelBase = useRightChannel ? rackRightEdge : rackLeftEdge;
          const bundleIdx = useRightChannel ? rightChannelUsage++ : leftChannelUsage++;

          // Vertical rail channel: 9 distributed lanes with 3.2px spacing inside 44px side rails
          const railLane = (bundleIdx % 9) - 4;
          const railTier = Math.floor(bundleIdx / 9) % 2;
          const railOffset = railLane * 3.2 + (railTier * 1.0);
          const channelX = channelBase + railOffset;

          // Horizontal organizer / D-ring channel: 7 distributed lanes with 2.8px spacing
          const traySlot = (bundleIdx % 7) - 3;
          const trayTier = Math.floor(bundleIdx / 7) % 2;
          const trayOffset = traySlot * 2.8 + (trayTier * 0.9);
          const actualTrayYA = trayYA + trayOffset;
          const actualTrayYB = trayYB + trayOffset;

          const dirY1 = actualTrayYA >= y1 ? 1 : -1;
          const dirX1 = channelX >= x1 ? 1 : -1;
          const r1 = Math.min(8, Math.abs(channelX - x1) / 2, Math.abs(actualTrayYA - y1) / 2);

          const dirY_rail = actualTrayYB >= actualTrayYA ? 1 : -1;
          const distRailY = Math.abs(actualTrayYB - actualTrayYA);
          const rRail1 = Math.min(10, Math.abs(channelX - x1) / 2, distRailY / 2 || 6);

          const dirX2 = x2 >= channelX ? 1 : -1;
          const rRail2 = Math.min(10, Math.abs(x2 - channelX) / 2, distRailY / 2 || 6);

          const dirY2 = y2 >= actualTrayYB ? 1 : -1;
          const r2 = Math.min(8, Math.abs(x2 - channelX) / 2, Math.abs(y2 - actualTrayYB) / 2);

          pathD = `M ${x1} ${y1} ` +
                  `L ${x1} ${actualTrayYA - dirY1 * r1} ` +
                  `Q ${x1} ${actualTrayYA} ${x1 + dirX1 * r1} ${actualTrayYA} ` +
                  `L ${channelX - dirX1 * rRail1} ${actualTrayYA} ` +
                  `Q ${channelX} ${actualTrayYA} ${channelX} ${actualTrayYA + dirY_rail * rRail1} ` +
                  `L ${channelX} ${actualTrayYB - dirY_rail * rRail2} ` +
                  `Q ${channelX} ${actualTrayYB} ${channelX + dirX2 * rRail2} ${actualTrayYB} ` +
                  `L ${x2 - dirX2 * r2} ${actualTrayYB} ` +
                  `Q ${x2} ${actualTrayYB} ${x2} ${actualTrayYB + dirY2 * r2} ` +
                  `L ${x2} ${y2}`;
          if (cable.lengthMeters == null) {
            cable.lengthMeters = computeCableLength('structured', {
              x1, y1, x2, y2,
              channelX,
              trayYA: actualTrayYA, trayYB: actualTrayYB,
              hasOrganizer: !!(orgA || orgB)
            });
          }
        }
      } else {
        const ymid = (y1 + y2) / 2;
        const tightSag = Math.min(22, Math.max(8, dy * 0.12));
        const cp1x = x1 + (x2 - x1) * 0.25;
        const cp1y = ymid + (y2 >= y1 ? tightSag : -tightSag);
        const cp2x = x1 + (x2 - x1) * 0.75;
        const cp2y = ymid + (y2 >= y1 ? tightSag : -tightSag);
        pathD = `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;
        if (cable.lengthMeters == null) {
          cable.lengthMeters = computeCableLength('direct', { x1, y1, x2, y2, sag: tightSag });
        }
      }

      // Casing / Outline path (for clear separation between overlapping & adjacent cables)
      const isFiberCable = cable.role === 'fiber' || cable.color === '#facc15' || cable.name?.includes('[FIBER]');
      const casing = getOrCreateSvgElement('path', `svg-cable-casing-${cable.id}`);
      casing.setAttribute('d', pathD);
      casing.setAttribute('class', `cable-casing ${cable.id === STATE.highlightedCableId ? 'highlighted' : ''} ${isFiberCable ? 'cable-casing-fiber' : ''}`.trim());
      casing.setAttribute('data-cable-id', cable.id);
      casing.style.setProperty('--cable-color', cable.color);
      cablesFrag.appendChild(casing);

      const path = getOrCreateSvgElement('path', `svg-cable-${cable.id}`);
      path.setAttribute('d', pathD);
      path.setAttribute('stroke', cable.color);
      path.setAttribute('stroke-width', isFiberCable ? '2.8' : '2.6');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      path.style.color = cable.color;
      path.style.setProperty('--cable-color', cable.color);
      path.setAttribute('class', `cable-path ${cable.id === STATE.highlightedCableId ? 'highlighted' : ''} ${isFiberCable ? 'cable-fiber' : ''}`.trim());
      path.setAttribute('data-cable-id', cable.id);
      path.removeAttribute('filter');

      const cableLabel = getCableLabel(activeRack, cable);
      path.setAttribute('aria-label', cableLabel);

      cablesFrag.appendChild(path);

      if (connectorsGroup) {
        if (isStub) {
          const localX = isFromMounted ? x1 : x2;
          const localY = isFromMounted ? y1 : y2;
          const destX = isFromMounted ? x2 : x1;
          const destY = isFromMounted ? y2 : y1;

          const boot = getOrCreateSvgElement('circle', `svg-cable-boot-a-${cable.id}`);
          boot.setAttribute('cx', localX);
          boot.setAttribute('cy', localY);
          boot.setAttribute('r', '3.4');
          boot.setAttribute('fill', '#090d16');
          boot.setAttribute('stroke', cable.color);
          boot.setAttribute('stroke-width', '1.6');
          boot.style.color = cable.color;
          boot.style.setProperty('--cable-color', cable.color);
          boot.setAttribute('class', 'cable-boot');
          boot.setAttribute('data-cable-id', cable.id);

          const pin = getOrCreateSvgElement('circle', `svg-cable-pin-a-${cable.id}`);
          pin.setAttribute('cx', localX);
          pin.setAttribute('cy', localY);
          pin.setAttribute('r', '1.2');
          pin.setAttribute('fill', cable.color);
          pin.setAttribute('class', 'cable-boot-pin');
          pin.setAttribute('data-cable-id', cable.id);

          const badge = getOrCreateSvgElement('g', `svg-cable-badge-${cable.id}`);
          badge.setAttribute('class', 'cable-stub-badge');
          badge.setAttribute('data-cable-id', cable.id);
          const badgeW = Math.max(76, stubBadgeText.length * 6.5 + 16);
          const badgeH = 18;
          const bx = isRightExit ? destX + 4 : destX - badgeW - 4;
          const by = destY - badgeH / 2;
          badge.innerHTML = `<rect x="${bx}" y="${by}" width="${badgeW}" height="${badgeH}" rx="4" fill="#0f172a" stroke="${cable.color}" stroke-width="1.2" /><text x="${bx + badgeW / 2}" y="${by + 12}" fill="#e2e8f0" font-size="9" font-weight="600" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif">${escapeHtml(stubBadgeText)}</text>`;

          connectorsFrag.appendChild(boot);
          connectorsFrag.appendChild(pin);
          connectorsFrag.appendChild(badge);
        } else {
        const bootA = getOrCreateSvgElement('circle', `svg-cable-boot-a-${cable.id}`);
        bootA.setAttribute('cx', x1);
        bootA.setAttribute('cy', y1);
        bootA.setAttribute('r', '3.4');
        bootA.setAttribute('fill', '#090d16');
        bootA.setAttribute('stroke', cable.color);
        bootA.setAttribute('stroke-width', '1.6');
        bootA.style.color = cable.color;
        bootA.style.setProperty('--cable-color', cable.color);
        bootA.setAttribute('class', 'cable-boot');
        bootA.setAttribute('data-cable-id', cable.id);

        const pinA = getOrCreateSvgElement('circle', `svg-cable-pin-a-${cable.id}`);
        pinA.setAttribute('cx', x1);
        pinA.setAttribute('cy', y1);
        pinA.setAttribute('r', '1.2');
        pinA.setAttribute('fill', cable.color);
        pinA.setAttribute('class', 'cable-boot-pin');
        pinA.setAttribute('data-cable-id', cable.id);

        const bootB = getOrCreateSvgElement('circle', `svg-cable-boot-b-${cable.id}`);
        bootB.setAttribute('cx', x2);
        bootB.setAttribute('cy', y2);
        bootB.setAttribute('r', '3.4');
        bootB.setAttribute('fill', '#090d16');
        bootB.setAttribute('stroke', cable.color);
        bootB.setAttribute('stroke-width', '1.6');
        bootB.style.color = cable.color;
        bootB.style.setProperty('--cable-color', cable.color);
        bootB.setAttribute('class', 'cable-boot');
        bootB.setAttribute('data-cable-id', cable.id);

        const pinB = getOrCreateSvgElement('circle', `svg-cable-pin-b-${cable.id}`);
        pinB.setAttribute('cx', x2);
        pinB.setAttribute('cy', y2);
        pinB.setAttribute('r', '1.2');
        pinB.setAttribute('fill', cable.color);
        pinB.setAttribute('class', 'cable-boot-pin');
        pinB.setAttribute('data-cable-id', cable.id);

        connectorsFrag.appendChild(bootA);
        connectorsFrag.appendChild(pinA);
        connectorsFrag.appendChild(bootB);
        connectorsFrag.appendChild(pinB);
        }
      }
    });

    cablesGroup.replaceChildren(cablesFrag);
    if (connectorsGroup) {
      connectorsGroup.replaceChildren(connectorsFrag);
    }

    if (STATE.highlightedCableId) {
      const hlPath = document.getElementById(`svg-cable-${STATE.highlightedCableId}`);
      const hlCasing = document.getElementById(`svg-cable-casing-${STATE.highlightedCableId}`);
      const cablesGroup = dom.cablesGroup || document.getElementById('cables-group');
      if (cablesGroup && hlCasing && hlPath) {
        cablesGroup.appendChild(hlCasing);
        cablesGroup.appendChild(hlPath);
      }
      const connectorsGroup = dom.connectorsGroup || document.getElementById('connectors-group');
      if (connectorsGroup) {
        document.querySelectorAll(`.cable-boot[data-cable-id="${STATE.highlightedCableId}"], .cable-boot-pin[data-cable-id="${STATE.highlightedCableId}"]`).forEach(b => {
          connectorsGroup.appendChild(b);
        });
      }
    }

    renderDRingOverlays(activeRack, clientToSvg);
  }

  function disconnectCable(cableId) {
    if (!cableId) return;
    const cable = STATE.cables.find(c => c.id === cableId);
    if (!cable) return;

    STATE.cables = STATE.cables.filter(c => c.id !== cableId);
    if (STATE.highlightedCableId === cableId) {
      STATE.highlightedCableId = null;
    }
    hideCableQuickHud();
    hideCableContextMenu();
    RS.setPixiCableHover?.(null, false);
    RS.invalidatePixiCableGeometry?.([cableId]);

    renderMountedDevices();
    renderScheduleTable();
    // Use the dual-engine dispatcher. Calling this module's local
    // renderAllCables() only refreshed the hidden SVG while Pixi stayed stale.
    RS.renderAllCables?.();

    if (dom.connectionStatusHint) {
      dom.connectionStatusHint.innerHTML = `<span style="color:#f87171; font-weight:700;">✂️ ${escapeHtml(cable.name || cable.id)} söküldü.</span>`;
      setTimeout(() => {
        if (dom.connectionStatusHint && !STATE.pendingConnection) {
          dom.connectionStatusHint.innerHTML = 'Bağlamak için <b>Kaynak Porta</b> tıklayın';
        }
      }, 2500);
    }

    if (window.__STUDIO3D__ && window.is3DMode && typeof window.__STUDIO3D__.removeCable === 'function') {
      window.__STUDIO3D__.removeCable(cableId);
    }
    window.dispatchEvent(new CustomEvent('rackstudio:refresh'));
  }

  function highlightCable(cableId, force = null) {
    if (force === true) {
      STATE.highlightedCableId = cableId || null;
    } else if (force === false) {
      STATE.highlightedCableId = null;
    } else {
      STATE.highlightedCableId = (cableId && STATE.highlightedCableId !== cableId) ? cableId : null;
    }
    if (!STATE.highlightedCableId) {
      hideCableQuickHud();
      hideCableContextMenu();
    }

    const svgEl = dom.cablesSvg || document.getElementById('cables-svg');
    if (svgEl) {
      svgEl.classList.toggle('has-cable-selected', !!STATE.highlightedCableId);
      if (!STATE.highlightedCableId) {
        svgEl.classList.remove('has-cable-hovered');
      }
    }

    document.querySelectorAll('.cable-path, .cable-casing').forEach(p => {
      p.classList.remove('highlighted');
    });

    if (!STATE.highlightedCableId) {
      document.querySelectorAll('.cable-path, .cable-casing, .cable-boot, .cable-boot-pin').forEach(el => {
        el.classList.remove('hovered');
      });
      restoreHoveredCable();
    }

    if (STATE.highlightedCableId) {
      const p = document.getElementById(`svg-cable-${STATE.highlightedCableId}`);
      const c = document.getElementById(`svg-cable-casing-${STATE.highlightedCableId}`);
      if (p) p.classList.add('highlighted');
      if (c) c.classList.add('highlighted');

      const cablesGroup = dom.cablesGroup || document.getElementById('cables-group');
      if (cablesGroup && c && p && c.parentNode === cablesGroup) {
        cablesGroup.appendChild(c);
        cablesGroup.appendChild(p);
      }

      const connectorsGroup = dom.connectorsGroup || document.getElementById('connectors-group');
      if (connectorsGroup) {
        document.querySelectorAll(`.cable-boot[data-cable-id="${STATE.highlightedCableId}"], .cable-boot-pin[data-cable-id="${STATE.highlightedCableId}"]`).forEach(b => {
          connectorsGroup.appendChild(b);
        });
      }
    }

    document.querySelectorAll('#schedule-tbody tr').forEach(row => {
      row.classList.toggle('active', row.dataset.cableId === STATE.highlightedCableId);
    });
  }

  function addDirectCable(rackA, instA, portA, rackB, instB, portB, color, lengthMeters) {
    const cableId = getNextCableId();
    STATE.cables.push({
      id: cableId,
      name: cableId,
      from: { rackId: rackA, instanceId: instA, portId: portA },
      to: { rackId: rackB, instanceId: instB, portId: portB },
      color: color || '#2563eb',
      lengthMeters: lengthMeters || 1.5
    });
  }

  RS.cancelPendingConnection = cancelPendingConnection;
  RS.getNextCableId = getNextCableId;
  RS.getCableEndpointInfo = getCableEndpointInfo;
  RS.getCableLabel = getCableLabel;
  RS.renameCable2D = renameCable2D;
  RS.restoreHoveredCable = restoreHoveredCable;
  RS.setCableHover = setCableHover;
  RS.setDeviceCablesHover = setDeviceCablesHover;
  RS.ensureCableDelegation = ensureCableDelegation;
  RS.showCableTooltip = showCableTooltip;
  RS.getOrCreateSvgElement = getOrCreateSvgElement;
  function appendSingleCable(cable) {
    if (!cable) return;
    if (STATE.cableRenderMode === 'pixi') {
      if (RS.appendSingleCablePixi) return RS.appendSingleCablePixi(cable);
      if (RS.renderAllCablesPixi) return RS.renderAllCablesPixi();
    }
    if (RS.renderAllCables) {
      return RS.renderAllCables();
    }
    renderAllCables();
  }

  RS.appendSingleCable = appendSingleCable;
  RS.renderAllCables = renderAllCables;
  RS.renderAllCablesSVG = renderAllCables;
  RS.disconnectCable = disconnectCable;
  RS.highlightCable = highlightCable;
  RS.addDirectCable = addDirectCable;
})();
