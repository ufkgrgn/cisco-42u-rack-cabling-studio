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
    const endpoints = `${from.deviceName} / ${from.portName} → ${to.deviceName} / ${to.portName}`;
    return cable.name ? `${cable.name}: ${endpoints}` : endpoints;
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

  function renderDRingOverlays(activeRack, clientToSvg) {
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

    const drings = document.querySelectorAll('.dring-faceplate .dring-loop');
    if (!drings.length) return;

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

      // Hollow retention hoop path using evenodd fill rule:
      // Solid steel frame (#141b26) sits over the cables, while central aperture is transparent
      // allowing the cables passing inside to be visible through the hoop opening.
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

      // Outer steel rim
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

      // Top metallic highlight chamfer
      const highlight = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      highlight.setAttribute('d', `M ${(x + rx).toFixed(2)} ${(y + 0.8).toFixed(2)} h ${(w - 2 * rx).toFixed(2)}`);
      highlight.setAttribute('stroke', 'rgba(255, 255, 255, 0.25)');
      highlight.setAttribute('stroke-width', (0.8 * (w / 38)).toFixed(2));
      highlight.setAttribute('stroke-linecap', 'round');
      g.appendChild(highlight);

      // Inner aperture rim
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
  }

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

  function renderAllCables() {
    // Re-acquire DOM refs in case DOM was rebuilt
    const cablesGroup = dom.cablesGroup || document.getElementById('cables-group');
    const connectorsGroup = dom.connectorsGroup || document.getElementById('connectors-group');
    if (!cablesGroup) return;
    cablesGroup.innerHTML = '';
    if (connectorsGroup) connectorsGroup.innerHTML = '';

    const svgEl = dom.cablesSvg || document.getElementById('cables-svg');
    const svgRect = svgEl ? svgEl.getBoundingClientRect() : null;
    if (!svgRect || svgRect.width <= 0) return;

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

      if (isInterRack) {
        // Inter-rack cable: overhead Bézier arc above both racks
        const overheadY = Math.min(y1, y2) - 80 - (leftChannelUsage++ % 6) * 8;
        pathD = `M ${x1} ${y1} C ${x1} ${overheadY}, ${x2} ${overheadY}, ${x2} ${y2}`;
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

          const useRightChannel = avgX > (rackLeftEdge + rackRightEdge) / 2;
          const channelBase = useRightChannel ? rackRightEdge : rackLeftEdge;
          const bundleIdx = useRightChannel ? rightChannelUsage++ : leftChannelUsage++;

          const railOffset = ((bundleIdx % 7) - 3) * 2.8;
          const channelX = channelBase + railOffset;

          const trayOffsetA = ((bundleIdx % 5) - 2) * 1.5;
          const trayOffsetB = ((bundleIdx % 5) - 2) * 1.5;
          const actualTrayYA = trayYA + trayOffsetA;
          const actualTrayYB = trayYB + trayOffsetB;

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

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', pathD);
      path.setAttribute('stroke', cable.color);
      path.setAttribute('stroke-width', '2.6');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      path.setAttribute('class', `cable-path ${cable.id === STATE.highlightedCableId ? 'highlighted' : ''}`);
      path.setAttribute('id', `svg-cable-${cable.id}`);
      path.setAttribute('filter', 'url(#cable-shadow)');

      const cableLabel = getCableLabel(activeRack, cable);
      path.setAttribute('aria-label', cableLabel);
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = cableLabel;
      path.appendChild(title);

      const showCableTooltip = (e) => {
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

      path.addEventListener('mouseenter', showCableTooltip);

      path.addEventListener('mousemove', (e) => {
        if (dom.tooltip.style.display !== 'none') {
          dom.tooltip.style.left = `${e.clientX + 10}px`;
          dom.tooltip.style.top = `${e.clientY - 10}px`;
        }
      });

      path.addEventListener('mouseleave', () => {
        if (STATE.highlightedCableId !== cable.id) dom.tooltip.style.display = 'none';
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

        const pinA = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        pinA.setAttribute('cx', x1);
        pinA.setAttribute('cy', y1);
        pinA.setAttribute('r', '1.2');
        pinA.setAttribute('fill', cable.color);
        pinA.setAttribute('class', 'cable-boot-pin');

        const bootB = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        bootB.setAttribute('cx', x2);
        bootB.setAttribute('cy', y2);
        bootB.setAttribute('r', '3.4');
        bootB.setAttribute('fill', '#090d16');
        bootB.setAttribute('stroke', cable.color);
        bootB.setAttribute('stroke-width', '1.6');
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

        const pinB = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        pinB.setAttribute('cx', x2);
        pinB.setAttribute('cy', y2);
        pinB.setAttribute('r', '1.2');
        pinB.setAttribute('fill', cable.color);
        pinB.setAttribute('class', 'cable-boot-pin');

        dom.connectorsGroup.appendChild(bootA);
        dom.connectorsGroup.appendChild(pinA);
        dom.connectorsGroup.appendChild(bootB);
        dom.connectorsGroup.appendChild(pinB);
      }
    });

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

    hud.innerHTML = `
      <span class="hud-title"><span style="color:${cable.color};">●</span> ${escapeHtml(cable.name || cable.id)}</span>
      <button type="button" class="hud-btn-disconnect" title="Kabloyu Sök (Delete Tuşu)">✂️ Sök</button>
      <button type="button" class="hud-btn-color" title="Kablo Rengini Değiştir">🎨</button>
      <button type="button" class="hud-btn-close" title="Kapat">✕</button>
    `;

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
      showCableQuickHud(cableId, left, top);
    });

    hud.querySelector('.hud-btn-close').addEventListener('click', (e) => {
      e.stopPropagation();
      hideCableQuickHud();
      if (STATE.highlightedCableId === cableId) {
        highlightCable(cableId);
      }
    });

    document.body.appendChild(hud);
    quickHudEl = hud;
  }

  function showCableContextMenu(cableId, clientX, clientY) {
    hideCableQuickHud();
    hideCableContextMenu();

    const cable = STATE.cables.find(c => c.id === cableId);
    if (!cable) return;

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
    });

    document.body.appendChild(menu);
    contextMenuEl = menu;
  }

  // Global keydown and click listeners for keyboard shortcuts & auto-dismiss
  if (typeof window !== 'undefined' && !window.__CABLE_INTERACTIONS_BOUND__) {
    window.__CABLE_INTERACTIONS_BOUND__ = true;

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#cable-quick-hud') && !e.target.closest('#cable-context-menu')) {
        hideCableQuickHud();
        hideCableContextMenu();
      }
    });

    window.addEventListener('keydown', (e) => {
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
    STATE.highlightedCableId = (STATE.highlightedCableId === cableId) ? null : cableId;
    if (!STATE.highlightedCableId) {
      hideCableQuickHud();
      hideCableContextMenu();
    }

    document.querySelectorAll('.cable-path').forEach(p => {
      p.classList.remove('highlighted');
    });
    if (STATE.highlightedCableId) {
      const p = document.getElementById(`svg-cable-${STATE.highlightedCableId}`);
      if (p) p.classList.add('highlighted');
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

  RS.cancelPendingConnection = cancelPendingConnection;
  RS.getNextCableId = getNextCableId;
  RS.getCableEndpointInfo = getCableEndpointInfo;
  RS.getCableLabel = getCableLabel;
  RS.renameCable2D = renameCable2D;
  RS.getEndpointOrganizerChannelYs = getEndpointOrganizerChannelYs;
  RS.getActiveOrganizers = getActiveOrganizers;
  RS.findDeviceOrganizer = findDeviceOrganizer;
  RS.getDRingBracketCoords = getDRingBracketCoords;
  RS.renderDRingOverlays = renderDRingOverlays;
  RS.buildStructuredCablePath = buildStructuredCablePath;
  RS.renderAllCables = renderAllCables;
  RS.hideCableQuickHud = hideCableQuickHud;
  RS.hideCableContextMenu = hideCableContextMenu;
  RS.disconnectCable = disconnectCable;
  RS.showCableQuickHud = showCableQuickHud;
  RS.showCableContextMenu = showCableContextMenu;
  RS.highlightCable = highlightCable;
  RS.addDirectCable = addDirectCable;
  RS.highlightDropSlots = highlightDropSlots;
})();
