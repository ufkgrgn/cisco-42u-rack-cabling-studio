/**
 * Cisco Enterprise Rack & Cabling Studio - Cabling Module
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
  const renderMountedDevices = () => RS.renderMountedDevices && RS.renderMountedDevices();
  const renderScheduleTable = () => RS.renderScheduleTable && RS.renderScheduleTable();

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

  function getCableLabel(activeRack, cable) {
    const from = getCableEndpointInfo(activeRack, cable.from);
    const to = getCableEndpointInfo(activeRack, cable.to);
    const isFiber = cable.role === 'fiber' || cable.color === '#facc15' || cable.name?.includes('[FIBER]');
    const fiberTag = isFiber ? '[FIBER OS2] ' : '';
    const endpoints = `${from.deviceName} / ${from.portName} ➔ ${to.deviceName} / ${to.portName}`;
    return cable.name ? `${fiberTag}${cable.name}: ${endpoints}` : `${fiberTag}${endpoints}`;
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
    renderAllCables();
    window.dispatchEvent(new CustomEvent('rackstudio:refresh'));
  }

  function getEndpointOrganizerChannelYs(activeRack, cable, contRect, curScale) {
    const organizers = activeRack.devices.filter(dev => HARDWARE_CATALOG[dev.catalogKey]?.category === 'organizer');
    const findDevice = endpoint => activeRack.devices.find(dev =>
      dev.instanceId === (endpoint.instanceId || endpoint.deviceId)
    );
    const findOrganizerDirectlyBelow = device => {
      if (!device) return null;
      const uImmediatelyBelow = Number(device.topU) - Number(device.uHeight || 1);
      return organizers.find(org => Number(org.topU) === uImmediatelyBelow) || null;
    };
    const centerY = organizer => {
      const el = organizer && document.getElementById(organizer.instanceId);
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return (rect.top + rect.height / 2 - (contRect.top + 8 * curScale)) / curScale;
    };

    const fromY = centerY(findOrganizerDirectlyBelow(findDevice(cable.from)));
    const toY = centerY(findOrganizerDirectlyBelow(findDevice(cable.to)));
    return Number.isFinite(fromY) && Number.isFinite(toY) ? [fromY, toY] : [];
  }

  /**
   * Intelligently resolves whether a cable should route via the Left or Right vertical duct.
   * Considers:
   * 1. Manual user override (cable.ductSide === 'left' | 'right')
   * 2. Port index split: Ports 1-12 -> Left, Ports 13-24 & Uplinks -> Right
   * 3. Geometric port X coordinates relative to rack centerline
   * 4. Dynamic channel balancing between left & right ducts
   */
  function resolveCableDuctSide(cable, x1, x2, rackCenterLine, leftUsage, rightUsage) {
    // 1. Explicit User Override
    if (cable.ductSide === 'left') return false;
    if (cable.ductSide === 'right') return true;

    // 2. Extract port index or uplink nature
    const getPortWeight = (endpoint) => {
      const pId = String(endpoint?.portId || '').toLowerCase();
      if (pId.startsWith('up') || pId.includes('te') || pId.includes('fo') || pId.includes('100ge')) {
        return 1.0; // Strongly right-biased (uplinks are on the right side)
      }
      const numMatch = pId.match(/\d+/);
      const num = numMatch ? parseInt(numMatch[0], 10) : null;
      if (num !== null) {
        if (num <= 12) return -1.0; // Left block (1-12)
        if (num > 12) return 1.0;  // Right block (13-24+)
      }
      return 0.0;
    };

    const wFrom = getPortWeight(cable.from);
    const wTo = getPortWeight(cable.to);
    const combinedWeight = wFrom + wTo;

    // If both ports are clearly in the right block or uplinks -> Right channel
    if (combinedWeight > 0.5) return true;
    // If both ports are clearly in the left block -> Left channel
    if (combinedWeight < -0.5) return false;

    // 3. Fallback to physical geometry (average port X vs rack centerline)
    const avgX = (x1 + x2) / 2;
    const isGeometricRight = avgX > rackCenterLine;

    // 4. Dynamic Load Balancing: if the preferred channel is heavily saturated (+4 more cables), spill to other side
    if (isGeometricRight && (rightUsage - leftUsage >= 4)) {
      return false;
    }
    if (!isGeometricRight && (leftUsage - rightUsage >= 4)) {
      return true;
    }

    return isGeometricRight;
  }

  function toggleCableDuctSide(cableId) {
    const cable = STATE.cables.find(c => c.id === cableId);
    if (!cable) return;
    const current = cable.ductSide || 'auto';
    const next = current === 'auto' ? 'left' : (current === 'left' ? 'right' : 'auto');
    cable.ductSide = next;

    // Explicitly maintain active cable selection & highlight so route change is immediately visible
    STATE.highlightedCableId = cableId;
    renderAllCables();
    setCableHover(cableId, true);

    // Update duct triggers in-place without destroying schedule table DOM to prevent card flicker
    const ductLabel = next === 'left' ? '⬅️ Sol' : (next === 'right' ? '➡️ Sağ' : '⚖️ Oto');
    const ductTooltip = `Dikey Kanal Güzergahı: ${next === 'left' ? 'Sol Dikey Tava' : (next === 'right' ? 'Sağ Dikey Tava' : 'Otomatik Dengeli')} (Değiştirmek için tıkla)`;
    document.querySelectorAll(`.duct-select-trigger[data-cable-id="${cableId}"]`).forEach(btn => {
      btn.textContent = ductLabel;
      btn.title = ductTooltip;
    });

    document.querySelectorAll('#schedule-tbody tr').forEach(row => {
      row.classList.toggle('active', row.dataset.cableId === cableId);
    });
    document.querySelectorAll('.tree-cable-row').forEach(row => {
      row.classList.toggle('active', row.dataset.cableId === cableId);
    });

    document.dispatchEvent(new CustomEvent('rackstudio:change', { bubbles: true }));
    document.dispatchEvent(new CustomEvent('rackstudio:refresh', { bubbles: true }));
    window.dispatchEvent(new CustomEvent('rackstudio:refresh'));
    return next;
  }

  function getActiveOrganizers(activeRack) {
    if (!activeRack || !activeRack.devices) return [];
    return activeRack.devices.filter(dev => {
      const cat = HARDWARE_CATALOG[dev.catalogKey];
      return cat && (
        dev.catalogKey.includes('organizer') ||
        (cat.modelTag && (cat.modelTag.includes('D-RING') || cat.modelTag.includes('ORGANIZER') || cat.modelTag.includes('DUCT') || cat.modelTag.includes('BRUSH'))) ||
        (cat.name && (cat.name.toLowerCase().includes('organizer') || cat.name.toLowerCase().includes('d-ring')))
      );
    });
  }

  function findDeviceOrganizer(activeRack, dev) {
    const orgs = getActiveOrganizers(activeRack);
    if (!orgs.length || !dev) return null;
    const devTop = Number(dev.topU);
    const devBot = devTop - Number(dev.uHeight || 1) + 1;

    // 1. Directly adjacent below
    const directlyBelow = orgs.find(org => Number(org.topU) === devBot - 1);
    if (directlyBelow) return directlyBelow;

    // 2. Directly adjacent above
    const directlyAbove = orgs.find(org => Number(org.topU) === devTop + 1);
    if (directlyAbove) return directlyAbove;

    // 3. Nearest organizer within 3U
    let nearest = null;
    let minDiff = Infinity;
    orgs.forEach(org => {
      const orgTop = Number(org.topU);
      const diff = Math.min(Math.abs(orgTop - devTop), Math.abs(orgTop - devBot));
      if (diff < minDiff && diff <= 3) {
        minDiff = diff;
        nearest = org;
      }
    });
    return nearest;
  }

  function getDRingBracketCoords(organizer, contRect, curScale) {
    const el = document.getElementById(organizer.instanceId);
    if (!el) return [];
    const brackets = el.querySelectorAll('.dring-bracket');
    if (!brackets || !brackets.length) return [];
    const coords = [];
    brackets.forEach((bEl, idx) => {
      const rect = bEl.getBoundingClientRect();
      coords.push({
        index: idx,
        x: (rect.left + rect.width / 2 - (contRect.left + 8 * curScale)) / curScale,
        y: (rect.top + rect.height / 2 - (contRect.top + 8 * curScale)) / curScale,
        width: rect.width / curScale,
        height: rect.height / curScale
      });
    });
    return coords;
  }

  function renderOrganizerOverlays(activeRack, clientToSvg) {
    const overlayGroup = dom.dringOverlayGroup || document.getElementById('dring-overlay-group');
    if (!overlayGroup) return;
    overlayGroup.innerHTML = '';

    const svgEl = dom.cablesSvg || document.getElementById('cables-svg');
    if (!svgEl) return;

    let toSvg = clientToSvg;
    if (!toSvg) {
      const ctmInv = svgEl.getScreenCTM ? svgEl.getScreenCTM()?.inverse() : null;
      const svgPoint = svgEl.createSVGPoint ? svgEl.createSVGPoint() : null;
      if (ctmInv && svgPoint) {
        toSvg = (cx, cy) => {
          svgPoint.x = cx;
          svgPoint.y = cy;
          const pt = svgPoint.matrixTransform(ctmInv);
          return { x: pt.x, y: pt.y };
        };
      }
    }
    if (!toSvg) return;

    // 1. D-Ring Overlays
    const drings = document.querySelectorAll('.dring-faceplate .dring-loop');
    drings.forEach(loopEl => {
      const rect = loopEl.getBoundingClientRect();
      if (!rect || rect.width <= 0 || rect.height <= 0) return;

      const p1 = toSvg(rect.left, rect.top);
      const p2 = toSvg(rect.right, rect.bottom);
      const x = p1.x;
      const y = p1.y;
      const w = p2.x - p1.x;
      const h = p2.y - p1.y;

      if (w <= 0 || h <= 0) return;

      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', 'dring-svg-bracket');
      g.setAttribute('style', 'pointer-events:none;');

      const apW = w * (26 / 38);
      const apH = h * (12 / 22);
      const apX = x + (w - apW) / 2;
      const apY = y + (h - apH) / 2;
      const rx = 4 * (w / 38);
      const apRx = 2 * (w / 38);

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const d = `
        M ${x + rx} ${y}
        h ${w - 2 * rx}
        a ${rx} ${rx} 0 0 1 ${rx} ${rx}
        v ${h - 2 * rx}
        a ${rx} ${rx} 0 0 1 -${rx} ${rx}
        h -${w - 2 * rx}
        a ${rx} ${rx} 0 0 1 -${rx} -${rx}
        v -${h - 2 * rx}
        a ${rx} ${rx} 0 0 1 ${rx} -${rx}
        Z
        M ${apX + apRx} ${apY}
        h ${apW - 2 * apRx}
        a ${apRx} ${apRx} 0 0 1 ${apRx} ${apRx}
        v ${apH - 2 * apRx}
        a ${apRx} ${apRx} 0 0 1 -${apRx} ${apRx}
        h -${apW - 2 * apRx}
        a ${apRx} ${apRx} 0 0 1 -${apRx} -${apRx}
        v -${apH - 2 * apRx}
        a ${apRx} ${apRx} 0 0 1 ${apRx} -${apRx}
        Z
      `;
      path.setAttribute('d', d.trim().replace(/\s+/g, ' '));
      path.setAttribute('fill', '#141b26');
      path.setAttribute('fill-rule', 'evenodd');
      path.setAttribute('stroke', 'none');
      g.appendChild(path);

      const outerRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      outerRect.setAttribute('x', x.toFixed(2));
      outerRect.setAttribute('y', y.toFixed(2));
      outerRect.setAttribute('width', w.toFixed(2));
      outerRect.setAttribute('height', h.toFixed(2));
      outerRect.setAttribute('rx', rx.toFixed(2));
      outerRect.setAttribute('fill', 'none');
      outerRect.setAttribute('stroke', '#56687e');
      outerRect.setAttribute('stroke-width', (1.8 * (w / 38)).toFixed(2));
      g.appendChild(outerRect);

      const highlight = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      highlight.setAttribute('d', `M ${(x + rx).toFixed(2)} ${(y + 0.8).toFixed(2)} h ${(w - 2 * rx).toFixed(2)}`);
      highlight.setAttribute('stroke', 'rgba(255, 255, 255, 0.25)');
      highlight.setAttribute('stroke-width', (0.8 * (w / 38)).toFixed(2));
      highlight.setAttribute('stroke-linecap', 'round');
      g.appendChild(highlight);

      const apBorder = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      apBorder.setAttribute('x', apX.toFixed(2));
      apBorder.setAttribute('y', apY.toFixed(2));
      apBorder.setAttribute('width', apW.toFixed(2));
      apBorder.setAttribute('height', apH.toFixed(2));
      apBorder.setAttribute('rx', apRx.toFixed(2));
      apBorder.setAttribute('fill', 'none');
      apBorder.setAttribute('stroke', '#1a2332');
      apBorder.setAttribute('stroke-width', '1');
      g.appendChild(apBorder);

      overlayGroup.appendChild(g);
    });

    // 2. Brush Pass-Through Overlays (.brush-faceplate .brush-slot)
    const brushSlots = document.querySelectorAll('.brush-faceplate .brush-slot');
    brushSlots.forEach(slotEl => {
      const rect = slotEl.getBoundingClientRect();
      if (!rect || rect.width <= 0 || rect.height <= 0) return;

      const p1 = toSvg(rect.left, rect.top);
      const p2 = toSvg(rect.right, rect.bottom);
      const x = p1.x;
      const y = p1.y;
      const w = p2.x - p1.x;
      const h = p2.y - p1.y;
      if (w <= 0 || h <= 0) return;

      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', 'brush-svg-overlay');
      g.setAttribute('style', 'pointer-events:none;');

      // Top metal lip
      const topLip = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      topLip.setAttribute('x', x.toFixed(2));
      topLip.setAttribute('y', y.toFixed(2));
      topLip.setAttribute('width', w.toFixed(2));
      topLip.setAttribute('height', (h * 0.28).toFixed(2));
      topLip.setAttribute('class', 'brush-svg-lip');
      topLip.setAttribute('rx', '1');
      g.appendChild(topLip);

      // Bottom metal lip
      const botLip = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      botLip.setAttribute('x', x.toFixed(2));
      botLip.setAttribute('y', (y + h * 0.72).toFixed(2));
      botLip.setAttribute('width', w.toFixed(2));
      botLip.setAttribute('height', (h * 0.28).toFixed(2));
      botLip.setAttribute('class', 'brush-svg-lip');
      botLip.setAttribute('rx', '1');
      g.appendChild(botLip);

      // Dense vertical nylon bristle strokes covering cables passing through the slit
      const bristlePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      let bristleD = '';
      const step = 4;
      for (let bx = x + 4; bx < x + w - 4; bx += step) {
        // Upper bristles going down
        bristleD += `M ${bx.toFixed(2)} ${(y + h * 0.25).toFixed(2)} L ${bx.toFixed(2)} ${(y + h * 0.46).toFixed(2)} `;
        // Lower bristles going up
        bristleD += `M ${bx.toFixed(2)} ${(y + h * 0.75).toFixed(2)} L ${bx.toFixed(2)} ${(y + h * 0.54).toFixed(2)} `;
      }
      bristlePath.setAttribute('d', bristleD);
      bristlePath.setAttribute('class', 'brush-svg-bristle');
      g.appendChild(bristlePath);

      // Top highlight
      const hl = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      hl.setAttribute('x1', (x + 2).toFixed(2));
      hl.setAttribute('y1', (y + 0.6).toFixed(2));
      hl.setAttribute('x2', (x + w - 2).toFixed(2));
      hl.setAttribute('y2', (y + 0.6).toFixed(2));
      hl.setAttribute('stroke', 'rgba(255, 255, 255, 0.2)');
      hl.setAttribute('stroke-width', '0.75');
      g.appendChild(hl);

      overlayGroup.appendChild(g);
    });

    // 3. Finger Duct Overlays (.finger-duct-faceplate)
    const fingerPlates = document.querySelectorAll('.finger-duct-faceplate');
    fingerPlates.forEach(fpEl => {
      // Individual slotted finger tines
      const tines = fpEl.querySelectorAll('.finger-tine');
      tines.forEach(tEl => {
        const r = tEl.getBoundingClientRect();
        if (!r || r.width <= 0 || r.height <= 0) return;
        const p1 = toSvg(r.left, r.top);
        const p2 = toSvg(r.right, r.bottom);
        const tw = p2.x - p1.x;
        const th = p2.y - p1.y;
        if (tw <= 0 || th <= 0) return;

        const tineRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        tineRect.setAttribute('x', p1.x.toFixed(2));
        tineRect.setAttribute('y', p1.y.toFixed(2));
        tineRect.setAttribute('width', tw.toFixed(2));
        tineRect.setAttribute('height', th.toFixed(2));
        tineRect.setAttribute('rx', '1.5');
        tineRect.setAttribute('class', 'finger-duct-svg-tine');
        overlayGroup.appendChild(tineRect);
      });

      // Snap-on duct cover overlay
      const coverEl = fpEl.querySelector('.finger-duct-cover');
      if (coverEl) {
        const cr = coverEl.getBoundingClientRect();
        if (cr && cr.width > 0 && cr.height > 0) {
          const cp1 = toSvg(cr.left, cr.top);
          const cp2 = toSvg(cr.right, cr.bottom);
          const cw = cp2.x - cp1.x;
          const ch = cp2.y - cp1.y;
          if (cw > 0 && ch > 0) {
            const isOpen = coverEl.classList.contains('open');
            const cg = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            cg.setAttribute('style', 'pointer-events:none;');

            const coverRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            coverRect.setAttribute('x', cp1.x.toFixed(2));
            coverRect.setAttribute('y', cp1.y.toFixed(2));
            coverRect.setAttribute('width', cw.toFixed(2));
            coverRect.setAttribute('height', ch.toFixed(2));
            coverRect.setAttribute('rx', '3');
            coverRect.setAttribute('class', `finger-duct-svg-cover ${isOpen ? 'open' : ''}`);
            cg.appendChild(coverRect);

            if (!isOpen) {
              // Highlight rim
              const ctl = document.createElementNS('http://www.w3.org/2000/svg', 'line');
              ctl.setAttribute('x1', (cp1.x + 4).toFixed(2));
              ctl.setAttribute('y1', (cp1.y + 1).toFixed(2));
              ctl.setAttribute('x2', (cp2.x - 4).toFixed(2));
              ctl.setAttribute('y2', (cp1.y + 1).toFixed(2));
              ctl.setAttribute('stroke', 'rgba(255, 255, 255, 0.15)');
              ctl.setAttribute('stroke-width', '0.75');
              cg.appendChild(ctl);

              // Grip center ribs
              const midX = cp1.x + cw / 2;
              const midY = cp1.y + ch / 2;
              for (let ox = -6; ox <= 6; ox += 3) {
                const grip = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                grip.setAttribute('x1', (midX + ox).toFixed(2));
                grip.setAttribute('y1', (midY - 4).toFixed(2));
                grip.setAttribute('x2', (midX + ox).toFixed(2));
                grip.setAttribute('y2', (midY + 4).toFixed(2));
                grip.setAttribute('stroke', '#334155');
                grip.setAttribute('stroke-width', '1.2');
                cg.appendChild(grip);
              }
            } else {
              // Cover is open: draw subtle text indicator in SVG
              const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
              text.setAttribute('x', (cp1.x + 12).toFixed(2));
              text.setAttribute('y', (cp1.y + ch / 2 + 3).toFixed(2));
              text.setAttribute('fill', '#3b82f6');
              text.setAttribute('font-size', '8');
              text.setAttribute('font-family', 'monospace');
              text.setAttribute('letter-spacing', '0.5');
              text.textContent = '2U KANAL AÇIK [KABLOLAR GÖRÜNÜR]';
              cg.appendChild(text);
            }

            overlayGroup.appendChild(cg);
          }
        }
      }
    });
  }

  const renderDRingOverlays = renderOrganizerOverlays;

  function buildStructuredCablePath(x1, y1, x2, y2, channelX, organizerYs) {
    const ordered = organizerYs;
    const firstOrganizerY = ordered[0];
    const lastOrganizerY = ordered[ordered.length - 1];
    const entryY = firstOrganizerY ?? y1;
    const exitY = lastOrganizerY ?? y2;
    const bend = channelX > 309 ? -10 : 10;

    if (!ordered.length) {
      return `M ${x1} ${y1} L ${channelX + bend} ${y1} Q ${channelX} ${y1} ${channelX} ${y1 + Math.sign(y2 - y1) * 10} L ${channelX} ${y2 - Math.sign(y2 - y1) * 10} Q ${channelX} ${y2} ${channelX + bend} ${y2} L ${x2} ${y2}`;
    }

    // First descend/rise vertically from the port into the organizer, traverse its
    // horizontal channel, use the rack side, then traverse the destination organizer.
    const points = [`M ${x1} ${y1}`, `L ${x1} ${entryY}`, `L ${channelX} ${entryY}`];
    if (entryY !== exitY) points.push(`L ${channelX} ${exitY}`);
    else if (exitY !== y2) points.push(`L ${channelX} ${y2}`);
    points.push(`L ${x2} ${exitY === entryY && exitY !== y2 ? y2 : exitY}`, `L ${x2} ${y2}`);
    return points.join(' ');
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

  function setCableHover(cableId, isHovered) {
    const svgEl = dom.cablesSvg || document.getElementById('cables-svg');
    const cablesGroup = dom.cablesGroup || document.getElementById('cables-group');
    const connectorsGroup = dom.connectorsGroup || document.getElementById('connectors-group');

    if (!isHovered) {
      if (activeHoveredCableId === cableId) {
        const p = document.getElementById(`svg-cable-${cableId}`);
        const c = document.getElementById(`svg-cable-casing-${cableId}`);
        if (p) p.classList.remove('hovered');
        if (c) c.classList.remove('hovered');
        document.querySelectorAll(`.cable-boot[data-cable-id="${cableId}"], .cable-boot-pin[data-cable-id="${cableId}"]`).forEach(b => {
          b.classList.remove('hovered');
        });
        const tableRow = document.querySelector(`#schedule-tbody tr[data-cable-id="${cableId}"]`);
        if (tableRow) tableRow.classList.remove('hovered-row');
        restoreHoveredCable();
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
      const prevRow = document.querySelector(`#schedule-tbody tr[data-cable-id="${activeHoveredCableId}"]`);
      if (prevRow) prevRow.classList.remove('hovered-row');
      restoreHoveredCable();
    }

    if (svgEl) {
      svgEl.classList.add('has-cable-hovered');
    }

    const p = document.getElementById(`svg-cable-${cableId}`);
    const c = document.getElementById(`svg-cable-casing-${cableId}`);
    if (p) p.classList.add('hovered');
    if (c) c.classList.add('hovered');

    const boots = Array.from(document.querySelectorAll(`.cable-boot[data-cable-id="${cableId}"], .cable-boot-pin[data-cable-id="${cableId}"]`));
    boots.forEach(b => b.classList.add('hovered'));

    let tableRow = document.querySelector(`#schedule-tbody tr[data-cable-id="${cableId}"]`);
    if (!tableRow && RS.ensureCableVisibleInSchedule) {
      tableRow = RS.ensureCableVisibleInSchedule(cableId);
    }
    if (tableRow) {
      tableRow.classList.add('hovered-row');
      tableRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Temporarily bring the hovered cable & casing to the very top of cablesGroup (SVG z-order)
    if (cablesGroup && c && p && c.parentNode === cablesGroup) {
      const placeholder = document.createComment(`hover-placeholder-${cableId}`);
      cablesGroup.insertBefore(placeholder, c);

      let bootPlaceholder = null;
      if (connectorsGroup && boots.length && boots[0].parentNode === connectorsGroup) {
        bootPlaceholder = document.createComment(`boot-placeholder-${cableId}`);
        connectorsGroup.insertBefore(bootPlaceholder, boots[0]);
        boots.forEach(b => connectorsGroup.appendChild(b));
      }

      cablesGroup.appendChild(c);
      cablesGroup.appendChild(p);

      hoveredPlaceholder = { placeholder, casing: c, path: p, bootPlaceholder, boots, cableId };
      activeHoveredCableId = cableId;
    }
  }

  let activeHoveredDeviceId = null;

  function setDeviceCablesHover(instanceId, isHovered) {
    const svgEl = dom.cablesSvg || document.getElementById('cables-svg');
    if (!isHovered) {
      if (activeHoveredDeviceId === instanceId) {
        activeHoveredDeviceId = null;
        if (svgEl) svgEl.classList.remove('has-cable-hovered');
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
    });
  }

  function renderAllCables() {
    restoreHoveredCable();

    // Re-acquire DOM refs in case DOM was rebuilt
    const cablesGroup = dom.cablesGroup || document.getElementById('cables-group');
    const connectorsGroup = dom.connectorsGroup || document.getElementById('connectors-group');
    if (!cablesGroup) return;
    cablesGroup.innerHTML = '';
    if (connectorsGroup) connectorsGroup.innerHTML = '';

    const svgEl = dom.cablesSvg || document.getElementById('cables-svg');
    const svgRect = svgEl ? svgEl.getBoundingClientRect() : null;
    if (!svgRect || svgRect.width <= 0) return;

    if (svgEl) {
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
    let leftChannelUsage = 0;
    let rightChannelUsage = 0;

    STATE.cables.forEach((cable) => {
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

      if (!portFromEl || !portToEl) return;

      const rectA = getPortRect(portFromEl);
      const rectB = getPortRect(portToEl);
      if (!rectA || !rectB) return;
      if (rectA.width === 0 && rectA.height === 0 && rectB.width === 0 && rectB.height === 0) return;

      // Exact unscaled SVG user coordinate calculation via SVG CTM transform
      const p1 = clientToSvg(rectA.left + rectA.width / 2, rectA.top + rectA.height / 2);
      const p2 = clientToSvg(rectB.left + rectB.width / 2, rectB.top + rectB.height / 2);
      const x1 = p1.x;
      const y1 = p1.y;
      const x2 = p2.x;
      const y2 = p2.y;

      const dy = Math.abs(y2 - y1);
      const dx = Math.abs(x2 - x1);

      let pathD = '';

      // Check for inter-rack cable (horizontal span across cabinets)
      const isInterRack = cable.from.rackId !== cable.to.rackId;

      if (isInterRack && STATE.cableRoutingMode === 'direct') {
        // Inter-rack cable in DIRECT mode: aerial Bézier arc above cabinets
        const overheadY = Math.min(y1, y2) - 80 - (leftChannelUsage++ % 6) * 8;
        pathD = `M ${x1} ${y1} C ${x1} ${overheadY}, ${x2} ${overheadY}, ${x2} ${y2}`;
      } else if (isInterRack && STATE.cableRoutingMode === 'structured') {
        // Inter-rack cable in STRUCTURED mode:
        // Follows datacenter pathway: Organizer A -> Vertical Channel A (UP) -> Overhead Cable Tray (across) -> Vertical Channel B (DOWN) -> Organizer B -> Port B
        const devA = STATE.racks.flatMap(r => r.devices).find(d => d.instanceId === instA);
        const devB = STATE.racks.flatMap(r => r.devices).find(d => d.instanceId === instB);
        const rackA = STATE.racks.find(r => r.id === cable.from.rackId);
        const rackB = STATE.racks.find(r => r.id === cable.to.rackId);

        const orgA = findDeviceOrganizer(rackA, devA);
        const orgB = findDeviceOrganizer(rackB, devB);

        const getOrgY = (org, fallbackY, otherY) => {
          if (org) {
            const orgEl = document.getElementById(org.instanceId);
            if (orgEl) {
              const r = orgEl.getBoundingClientRect();
              return clientToSvg(0, r.top + r.height / 2).y;
            }
          }
          return fallbackY + (otherY >= fallbackY ? 14 : -14);
        };

        let trayYA = getOrgY(orgA, y1, y2);
        let trayYB = getOrgY(orgB, y2, y1);

        const rackContA = document.querySelector(`.rack-container[data-rack-id="${rackA?.id}"]`) ||
                          document.getElementById(`rack-container-${rackA?.id}`) ||
                          document.getElementById('rack-container');
        const rackContB = document.querySelector(`.rack-container[data-rack-id="${rackB?.id}"]`) ||
                          document.getElementById(`rack-container-${rackB?.id}`) ||
                          document.getElementById('rack-container');

        let rackALeft = 23;
        let rackARight = 595;
        let topYA = y1 - 40;
        if (rackContA) {
          const railL = rackContA.querySelector('.rack-rail.left');
          const railR = rackContA.querySelector('.rack-rail.right');
          const rc = rackContA.getBoundingClientRect();
          if (railL && railR) {
            const lRect = railL.getBoundingClientRect();
            const rRect = railR.getBoundingClientRect();
            rackALeft = clientToSvg(lRect.left + lRect.width / 2, 0).x;
            rackARight = clientToSvg(rRect.left + rRect.width / 2, 0).x;
          } else {
            rackALeft = clientToSvg(rc.left + 30, 0).x;
            rackARight = clientToSvg(rc.right - 30, 0).x;
          }
          topYA = clientToSvg(0, rc.top).y;
        }

        let rackBLeft = rackARight + 100;
        let rackBRight = rackBLeft + 572;
        let topYB = topYA;
        if (rackContB) {
          const railL = rackContB.querySelector('.rack-rail.left');
          const railR = rackContB.querySelector('.rack-rail.right');
          const rc = rackContB.getBoundingClientRect();
          if (railL && railR) {
            const lRect = railL.getBoundingClientRect();
            const rRect = railR.getBoundingClientRect();
            rackBLeft = clientToSvg(lRect.left + lRect.width / 2, 0).x;
            rackBRight = clientToSvg(rRect.left + rRect.width / 2, 0).x;
          } else {
            rackBLeft = clientToSvg(rc.left + 30, 0).x;
            rackBRight = clientToSvg(rc.right - 30, 0).x;
          }
          topYB = clientToSvg(0, rc.top).y;
        }

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
      } else if (STATE.cableRoutingMode === 'structured') {
        // Find devices: check all racks, not just active rack
        const devA = STATE.racks.flatMap(r => r.devices).find(d => d.instanceId === instA);
        const devB = STATE.racks.flatMap(r => r.devices).find(d => d.instanceId === instB);
        const rackA = STATE.racks.find(r => r.id === cable.from.rackId) || activeRack;

        if (instA === instB) {
          // Same device loopback
          const loopSide = x1 > 300 ? 12 : -12;
          pathD = `M ${x1} ${y1} C ${x1 + loopSide} ${y1}, ${x2 + loopSide} ${y2}, ${x2} ${y2}`;
        } else {
          // Structured datacenter cabling within same rack

          const orgA = findDeviceOrganizer(rackA, devA);
          const orgB = findDeviceOrganizer(rackA, devB);

          const getOrgY = (org, fallbackY, otherY) => {
            if (org) {
              const orgEl = document.getElementById(org.instanceId);
              if (orgEl) {
                const r = orgEl.getBoundingClientRect();
                return clientToSvg(0, r.top + r.height / 2).y;
              }
            }
            return fallbackY + (otherY >= fallbackY ? 14 : -14);
          };

          let trayYA = getOrgY(orgA, y1, y2);
          let trayYB = getOrgY(orgB, y2, y1);

          if (orgA && orgB && orgA.instanceId === orgB.instanceId) {
            const orgCenterY = trayYA;
            const isATop = Number(devA?.topU || 0) >= Number(devB?.topU || 0);
            trayYA = orgCenterY + (isATop ? -6 : 6);
            trayYB = orgCenterY + (isATop ? 6 : -6);
          }

          const avgX = (x1 + x2) / 2;

          // Dynamic channel X: read actual rack rail centers from DOM
          // This keeps cables neatly centered in the 44px side rails in both single and multi-rack modes
          let rackLeftEdge = 23;
          let rackRightEdge = 595;
          const rackContEl = document.querySelector(`.rack-container[data-rack-id="${rackA?.id}"]`) ||
                             document.getElementById('rack-container');
          if (rackContEl) {
            const railL = rackContEl.querySelector('.rack-rail.left');
            const railR = rackContEl.querySelector('.rack-rail.right');
            if (railL && railR) {
              const lRect = railL.getBoundingClientRect();
              const rRect = railR.getBoundingClientRect();
              rackLeftEdge = clientToSvg(lRect.left + lRect.width / 2, 0).x;
              rackRightEdge = clientToSvg(rRect.left + rRect.width / 2, 0).x;
            } else {
              const rc = rackContEl.getBoundingClientRect();
              rackLeftEdge = clientToSvg(rc.left + 30, 0).x;
              rackRightEdge = clientToSvg(rc.right - 30, 0).x;
            }
          }

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
        }
      } else {
        const ymid = (y1 + y2) / 2;
        const tightSag = Math.min(22, Math.max(8, dy * 0.12));
        const cp1x = x1 + (x2 - x1) * 0.25;
        const cp1y = ymid + (y2 >= y1 ? tightSag : -tightSag);
        const cp2x = x1 + (x2 - x1) * 0.75;
        const cp2y = ymid + (y2 >= y1 ? tightSag : -tightSag);
        pathD = `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;
      }

      // Casing / Outline path (for clear separation between overlapping & adjacent cables)
      const isFiberCable = cable.role === 'fiber' || cable.color === '#facc15' || cable.name?.includes('[FIBER]');
      const casing = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      casing.setAttribute('d', pathD);
      casing.setAttribute('class', `cable-casing ${cable.id === STATE.highlightedCableId ? 'highlighted' : ''} ${isFiberCable ? 'cable-casing-fiber' : ''}`.trim());
      casing.setAttribute('id', `svg-cable-casing-${cable.id}`);
      casing.setAttribute('data-cable-id', cable.id);
      casing.style.setProperty('--cable-color', cable.color);
      dom.cablesGroup.appendChild(casing);

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', pathD);
      path.setAttribute('stroke', cable.color);
      path.setAttribute('stroke-width', isFiberCable ? '2.8' : '2.6');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      path.style.color = cable.color;
      path.style.setProperty('--cable-color', cable.color);
      path.setAttribute('class', `cable-path ${cable.id === STATE.highlightedCableId ? 'highlighted' : ''} ${isFiberCable ? 'cable-fiber' : ''}`.trim());
      path.setAttribute('id', `svg-cable-${cable.id}`);
      path.setAttribute('data-cable-id', cable.id);
      path.setAttribute('filter', 'url(#cable-shadow)');

      const cableLabel = getCableLabel(activeRack, cable);
      path.setAttribute('aria-label', cableLabel);

      const showCableTooltip = (e) => {
        if (STATE.pendingConnection || !dom.tooltip) return;
        dom.tooltip.style.display = 'block';
        dom.tooltip.style.left = `${e.clientX + 10}px`;
        dom.tooltip.style.top = `${e.clientY - 10}px`;
        dom.tooltip.innerHTML = `
          <b>${escapeHtml(cable.id)}</b> (${Number(cable.lengthMeters || 0).toFixed(1)}m)<br>
          <span style="color:${cable.color};">&#9632;</span> <strong>${escapeHtml(cableLabel)}</strong><br>
          <span style="color:#f59e0b;font-size:11px;">Yeniden adlandırmak için çift tıklayın</span>
        `;
      };

      path.addEventListener('click', (e) => {
        e.stopPropagation();
        highlightCable(cable.id);
        showCableQuickHud(cable.id, e.clientX, e.clientY);
      });

      path.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        highlightCable(cable.id);
        showCableContextMenu(cable.id, e.clientX, e.clientY);
      });

      path.addEventListener('dblclick', (e) => {
        e.preventDefault();
        e.stopPropagation();
        renameCable2D(cable.id);
      });

      path.addEventListener('mouseenter', (e) => {
        if (STATE.pendingConnection) return;
        setCableHover(cable.id, true);
        showCableTooltip(e);
      });

      path.addEventListener('mousemove', (e) => {
        if (STATE.pendingConnection) return;
        if (dom.tooltip && dom.tooltip.style.display !== 'none') {
          dom.tooltip.style.left = `${e.clientX + 10}px`;
          dom.tooltip.style.top = `${e.clientY - 10}px`;
        }
      });

      path.addEventListener('mouseleave', () => {
        setCableHover(cable.id, false);
        if (dom.tooltip) dom.tooltip.style.display = 'none';
      });

      dom.cablesGroup.appendChild(path);

      if (dom.connectorsGroup) {
        const bootA = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
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
        bootA.addEventListener('click', (e) => {
          e.stopPropagation();
          highlightCable(cable.id);
          showCableQuickHud(cable.id, e.clientX, e.clientY);
        });
        bootA.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          highlightCable(cable.id);
          showCableContextMenu(cable.id, e.clientX, e.clientY);
        });
        bootA.addEventListener('mouseenter', (e) => {
          if (STATE.pendingConnection) return;
          setCableHover(cable.id, true);
          showCableTooltip(e);
        });
        bootA.addEventListener('mouseleave', () => {
          setCableHover(cable.id, false);
          if (dom.tooltip) dom.tooltip.style.display = 'none';
        });

        const pinA = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        pinA.setAttribute('cx', x1);
        pinA.setAttribute('cy', y1);
        pinA.setAttribute('r', '1.2');
        pinA.setAttribute('fill', cable.color);
        pinA.setAttribute('class', 'cable-boot-pin');
        pinA.setAttribute('data-cable-id', cable.id);

        const bootB = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
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
        bootB.addEventListener('click', (e) => {
          e.stopPropagation();
          highlightCable(cable.id);
          showCableQuickHud(cable.id, e.clientX, e.clientY);
        });
        bootB.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          highlightCable(cable.id);
          showCableContextMenu(cable.id, e.clientX, e.clientY);
        });
        bootB.addEventListener('mouseenter', (e) => {
          if (STATE.pendingConnection) return;
          setCableHover(cable.id, true);
          showCableTooltip(e);
        });
        bootB.addEventListener('mouseleave', () => {
          setCableHover(cable.id, false);
          if (dom.tooltip) dom.tooltip.style.display = 'none';
        });

        const pinB = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        pinB.setAttribute('cx', x2);
        pinB.setAttribute('cy', y2);
        pinB.setAttribute('r', '1.2');
        pinB.setAttribute('fill', cable.color);
        pinB.setAttribute('class', 'cable-boot-pin');
        pinB.setAttribute('data-cable-id', cable.id);

        dom.connectorsGroup.appendChild(bootA);
        dom.connectorsGroup.appendChild(pinA);
        dom.connectorsGroup.appendChild(bootB);
        dom.connectorsGroup.appendChild(pinB);
      }
    });

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

  let quickHudEl = null;
  let contextMenuEl = null;

  function hideCableQuickHud() {
    if (quickHudEl) {
      quickHudEl.remove();
      quickHudEl = null;
    }
  }

  function hideCableContextMenu() {
    if (contextMenuEl) {
      contextMenuEl.remove();
      contextMenuEl = null;
    }
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

    renderMountedDevices();
    renderScheduleTable();
    renderAllCables();

    if (dom.connectionStatusHint) {
      dom.connectionStatusHint.innerHTML = `<span style="color:#f87171; font-weight:700;">✂️ ${escapeHtml(cable.name || cable.id)} söküldü.</span>`;
      setTimeout(() => {
        if (dom.connectionStatusHint && !STATE.pendingConnection) {
          dom.connectionStatusHint.innerHTML = 'Bağlamak için <b>Kaynak Porta</b> tıklayın';
        }
      }, 2500);
    }

    if (window.__STUDIO3D__ && typeof window.__STUDIO3D__.removeCable === 'function') {
      window.__STUDIO3D__.removeCable(cableId);
    }
    window.dispatchEvent(new CustomEvent('rackstudio:refresh'));
  }

  function showCableQuickHud(cableId, clientX, clientY) {
    hideCableQuickHud();
    hideCableContextMenu();

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

    hud.innerHTML = `
      <span class="hud-title"><span style="color:${cable.color};">●</span> ${escapeHtml(cable.name || cable.id)}</span>
      <button type="button" class="hud-btn-duct" title="${escapeHtml(ductTitle)}">${escapeHtml(ductIcon)}</button>
      <button type="button" class="hud-btn-disconnect" title="Kabloyu Sök (Delete Tuşu)">✂️ Sök</button>
      <button type="button" class="hud-btn-color" title="Kablo Rengini Değiştir">🎨</button>
      <button type="button" class="hud-btn-close" title="Kapat">✕</button>
    `;

    hud.querySelector('.hud-btn-duct').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleCableDuctSide(cableId);
      showCableQuickHud(cableId, left, top);
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
    hideCableQuickHud();
    hideCableContextMenu();

    const cable = STATE.cables.find(c => c.id === cableId);
    if (!cable) return;

    const currentDuct = cable.ductSide || 'auto';

    const menu = document.createElement('div');
    menu.className = 'cable-context-menu';
    menu.id = 'cable-context-menu';
    const left = Math.max(10, Math.min(window.innerWidth - 180, clientX));
    const top = Math.max(10, Math.min(window.innerHeight - 150, clientY));
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;

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

    menu.querySelector('#ctx-change-color').addEventListener('click', (e) => {
      e.stopPropagation();
      const colors = ['#0070d2', '#00d2ff', '#10b981', '#f59e0b', '#ef4444', '#a855f7', '#ec4899', '#ffffff'];
      const currentIdx = colors.indexOf(cable.color);
      cable.color = colors[(currentIdx + 1) % colors.length];
      renderAllCables();
      renderScheduleTable();
      hideCableContextMenu();
    });

    menu.querySelector('#ctx-cancel').addEventListener('click', (e) => {
      e.stopPropagation();
      hideCableContextMenu();
      highlightCable(null);
    });

    document.body.appendChild(menu);
    contextMenuEl = menu;
  }

  // Global keydown and click listeners for keyboard shortcuts & auto-dismiss
  if (typeof window !== 'undefined' && !window.__CABLE_INTERACTIONS_BOUND__) {
    window.__CABLE_INTERACTIONS_BOUND__ = true;

    document.addEventListener('click', (e) => {
      if (e.target.closest('#cable-quick-hud') || e.target.closest('#cable-context-menu')) {
        return;
      }
      if (e.target.closest('.cable-path') || e.target.closest('.cable-boot')) {
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

  function highlightCable(cableId) {
    STATE.highlightedCableId = (cableId && STATE.highlightedCableId !== cableId) ? cableId : null;
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

  function highlightDropSlots(targetU, catalogKey, isOver) {
    document.querySelectorAll('.rack-slot.drag-valid, .rack-slot.drag-invalid').forEach(el => {
      el.classList.remove('drag-valid', 'drag-invalid');
    });
    if (!isOver || !targetU) return;
    const cat = catalogKey ? HARDWARE_CATALOG[catalogKey] : (STATE.selectedLibraryItem ? HARDWARE_CATALOG[STATE.selectedLibraryItem] : null);
    const reqU = cat ? cat.u : 1;
    const endU = targetU - reqU + 1;
    const activeRack = getActiveRack();
    const isOut = endU < 1;
    let isBlocked = isOut;
    if (activeRack && !isOut) {
      for (let u = endU; u <= targetU; u++) {
        if (activeRack.units && activeRack.units[u] !== null) {
          isBlocked = true;
          break;
        }
      }
    }
    const cls = isBlocked ? 'drag-invalid' : 'drag-valid';
    for (let u = Math.max(1, endU); u <= targetU; u++) {
      const el = document.getElementById(`rack-slot-u${u}`);
      if (el) el.classList.add(cls);
    }
  }

  function bulkColorizeSwitchCables(instanceId, newColor) {
    if (!instanceId || !newColor) return 0;
    const targetCables = (STATE.cables || []).filter(c =>
      (c.from && c.from.instanceId === instanceId) || (c.to && c.to.instanceId === instanceId)
    );
    if (!targetCables.length) return 0;

    targetCables.forEach(c => {
      c.color = newColor;
    });

    renderAllCables();
    renderScheduleTable();

    if (dom.connectionStatusHint) {
      dom.connectionStatusHint.innerHTML = `<span style="color:${escapeHtml(newColor)}; font-weight:700;">🎨 ${targetCables.length} kablo rengi güncellendi (${escapeHtml(newColor)}).</span>`;
      setTimeout(() => {
        if (dom.connectionStatusHint && !STATE.pendingConnection) {
          dom.connectionStatusHint.innerHTML = 'Bağlamak için <b>Kaynak Porta</b> tıklayın';
        }
      }, 3000);
    }

    if (window.__STUDIO3D__ && typeof window.__STUDIO3D__.syncCables === 'function') {
      window.__STUDIO3D__.syncCables(STATE.cables);
    }

    document.dispatchEvent(new CustomEvent('rackstudio:change', { bubbles: true }));
    document.dispatchEvent(new CustomEvent('rackstudio:refresh', { bubbles: true }));
    window.dispatchEvent(new CustomEvent('rackstudio:refresh'));
    return targetCables.length;
  }

  function openSwitchBulkColorPopover(triggerBtn, instanceId) {
    document.querySelectorAll('.switch-bulk-color-popover, .role-picker-popover').forEach(p => p.remove());

    const allDevices = STATE.racks ? STATE.racks.flatMap(r => r.devices || []) : [];
    const dev = allDevices.find(d => d.instanceId === instanceId);
    const cat = dev ? HARDWARE_CATALOG[dev.catalogKey] : null;
    const devName = dev?.panelLabel ? `Panel ${dev.panelLabel}` : (dev?.hostname || cat?.modelTag || cat?.name || 'Cihaz');

    const swCables = (STATE.cables || []).filter(c =>
      (c.from && c.from.instanceId === instanceId) || (c.to && c.to.instanceId === instanceId)
    );

    const popover = document.createElement('div');
    popover.className = 'switch-bulk-color-popover';

    const colors = [
      { hex: '#0070d2', label: 'Cisco Mavi', role: 'Cat6 Data' },
      { hex: '#00d2ff', label: 'Neon Cyan', role: 'Uplink' },
      { hex: '#10b981', label: 'Zümrüt Yeşil', role: 'MGMT / Güvenlik' },
      { hex: '#f59e0b', label: 'Kehribar Turuncu', role: 'PoE / AP' },
      { hex: '#ef4444', label: 'Sinyal Kırmızı', role: 'Kritik / DMZ' },
      { hex: '#7c3aed', label: 'Elektrik Mor', role: '802.1Q Trunk' },
      { hex: '#ec4899', label: 'Canlı Pembe', role: 'Wi-Fi Trunk' },
      { hex: '#facc15', label: 'Fiber Sarı', role: 'Single-Mode LC' },
      { hex: '#06b6d4', label: 'Aqua Camgöbeği', role: 'OM4 Multi-Mode' },
      { hex: '#64748b', label: 'Çelik Gri', role: 'Standart Hat' },
      { hex: '#f8fafc', label: 'Temiz Beyaz', role: 'Yedek Hat' },
      { hex: '#1e293b', label: 'Koyu Grafit', role: 'Konsol / L2' },
    ];

    const swatchesHtml = colors.map(c => `
      <button type="button" class="bulk-color-swatch" data-color="${c.hex}" title="${escapeHtml(c.label)} (${escapeHtml(c.role)})" style="--swatch-color: ${c.hex};">
        <span class="swatch-circle" style="background: ${c.hex};"></span>
        <span class="swatch-name">${escapeHtml(c.label)}</span>
      </button>
    `).join('');

    popover.innerHTML = `
      <div class="bulk-color-header">
        <div class="bulk-color-title-group">
          <span class="bulk-color-icon">🎨</span>
          <div class="bulk-color-text">
            <div class="bulk-color-title">${escapeHtml(devName)}</div>
            <div class="bulk-color-subtitle">Tüm Kabloları Renklendir (${swCables.length} Bağlantı)</div>
          </div>
        </div>
        <button type="button" class="bulk-color-close" title="Kapat">✕</button>
      </div>
      <div class="bulk-color-grid">
        ${swatchesHtml}
      </div>
      <div class="bulk-color-custom-row">
        <label for="switch-custom-color-input" class="bulk-color-custom-label">Özel Renk:</label>
        <div class="bulk-color-custom-input-wrap">
          <input type="color" id="switch-custom-color-input" class="bulk-color-native-picker" value="#00d2ff">
          <span class="bulk-color-hex-display">#00D2FF</span>
          <button type="button" class="bulk-color-apply-btn">Uygula</button>
        </div>
      </div>
    `;

    document.body.appendChild(popover);

    // Positioning
    const rect = triggerBtn.getBoundingClientRect();
    let top = rect.bottom + 6;
    let left = rect.left;

    if (left + 270 > window.innerWidth) {
      left = window.innerWidth - 280;
    }
    if (top + 280 > window.innerHeight && rect.top > 290) {
      top = rect.top - 280;
    }
    top = Math.max(10, Math.min(top, window.innerHeight - 290));
    left = Math.max(10, Math.min(left, window.innerWidth - 280));

    popover.style.top = `${top}px`;
    popover.style.left = `${left}px`;

    // Events
    popover.querySelector('.bulk-color-close').addEventListener('click', (e) => {
      e.stopPropagation();
      popover.remove();
    });

    popover.querySelectorAll('.bulk-color-swatch').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const color = btn.dataset.color;
        bulkColorizeSwitchCables(instanceId, color);
        popover.remove();
      });
    });

    const customInput = popover.querySelector('.bulk-color-native-picker');
    const hexDisplay = popover.querySelector('.bulk-color-hex-display');
    const applyBtn = popover.querySelector('.bulk-color-apply-btn');

    if (customInput && hexDisplay) {
      customInput.addEventListener('input', () => {
        hexDisplay.textContent = customInput.value.toUpperCase();
      });
    }

    if (applyBtn && customInput) {
      applyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        bulkColorizeSwitchCables(instanceId, customInput.value);
        popover.remove();
      });
    }

    const outsideClick = (e) => {
      if (!popover.contains(e.target) && e.target !== triggerBtn) {
        popover.remove();
        document.removeEventListener('click', outsideClick);
      }
    };
    setTimeout(() => document.addEventListener('click', outsideClick), 0);
  }

  RS.cancelPendingConnection = cancelPendingConnection;
  RS.getNextCableId = getNextCableId;
  RS.getCableEndpointInfo = getCableEndpointInfo;
  RS.getCableLabel = getCableLabel;
  RS.renameCable2D = renameCable2D;
  RS.getEndpointOrganizerChannelYs = getEndpointOrganizerChannelYs;
  RS.getActiveOrganizers = getActiveOrganizers;
  RS.findDeviceOrganizer = findDeviceOrganizer;
  RS.getDRingBracketCoords = getDRingBracketCoords;
  RS.renderDRingOverlays = renderOrganizerOverlays;
  RS.renderOrganizerOverlays = renderOrganizerOverlays;
  RS.buildStructuredCablePath = buildStructuredCablePath;
  RS.renderAllCables = renderAllCables;
  RS.hideCableQuickHud = hideCableQuickHud;
  RS.hideCableContextMenu = hideCableContextMenu;
  RS.disconnectCable = disconnectCable;
  RS.showCableQuickHud = showCableQuickHud;
  RS.showCableContextMenu = showCableContextMenu;
  RS.highlightCable = highlightCable;
  RS.setCableHover = setCableHover;
  RS.setDeviceCablesHover = setDeviceCablesHover;
  RS.toggleCableDuctSide = toggleCableDuctSide;
  RS.resolveCableDuctSide = resolveCableDuctSide;
  RS.addDirectCable = addDirectCable;
  RS.highlightDropSlots = highlightDropSlots;
  RS.bulkColorizeSwitchCables = bulkColorizeSwitchCables;
  RS.openSwitchBulkColorPopover = openSwitchBulkColorPopover;
})();
