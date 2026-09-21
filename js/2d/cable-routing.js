/**
 * Cisco Enterprise Rack & Cabling Studio - Cable Routing Module
 * Handles duct channel geometry, D-ring loops, horizontal organizers (brush & finger-duct),
 * structured cable pathways, and physical cable length metrology.
 */
(function () {
  'use strict';

  const RS = window.RackStudio = window.RackStudio || {};

  const STATE = RS.STATE;
  const dom = RS.dom;
  const HARDWARE_CATALOG = RS.HARDWARE_CATALOG;

  const getActiveRack = () => (RS.getActiveRack ? RS.getActiveRack() : RS.STATE?.racks?.[0]);
  const renderAllCables = () => RS.renderAllCables && RS.renderAllCables();
  const setCableHover = (...args) => RS.setCableHover && RS.setCableHover(...args);

  // ── Physical scale: SVG user-units → real metres ──────────────────────
  // 1 rack unit (U) = 44.45 mm in real life; SVG height assigns 32 px/U.
  // Standard 19-inch rack usable width = 482.6 mm; single-rack SVG width = 618 px.
  const MM_PER_U       = 44.45;                         // mm  (EIA-310)
  const RACK_WIDTH_MM  = 482.6;                         // mm  (19" standard)
  const SVG_PX_PER_U   = 32;                            // px  (design constant)
  const MM_PER_SVG_Y   = MM_PER_U / SVG_PX_PER_U;      // ≈ 1.389 mm / svg-px
  const MM_PER_SVG_X   = RACK_WIDTH_MM / 618;           // ≈ 0.781 mm / svg-px
  const SLACK_FACTOR   = 1.05;                          // 5% slack for dress & bend radius
  const CONNECTOR_MM   = 150;                           // 150 mm each end (connector + strain relief)

  /**
   * Compute physical cable length (metres) from SVG-space geometry.
   * Accepts a mode string and a geometry object with the waypoints that
   * were already computed during path-building, so no extra DOM access needed.
   *
   * Rounding: up to nearest 0.5 m to match standard patch-cable sizing.
   */
  function computeCableLength(mode, geo) {
    let totalMm = CONNECTOR_MM * 2; // both ends

    if (mode === 'direct') {
      // Cubic Bézier catenary: chord + parabolic arc correction for sag
      const { x1, y1, x2, y2, sag } = geo;
      const chordMmX = Math.abs(x2 - x1) * MM_PER_SVG_X;
      const chordMmY = Math.abs(y2 - y1) * MM_PER_SVG_Y;
      const chordMm  = Math.sqrt(chordMmX * chordMmX + chordMmY * chordMmY);
      const sagMm    = (sag || 0) * MM_PER_SVG_Y;
      // L ≈ chord + 8*sag²/(3*chord)
      totalMm += chordMm > 0
        ? chordMm + (8 * sagMm * sagMm) / (3 * Math.max(chordMm, 1))
        : sagMm * 2;

    } else if (mode === 'structured') {
      // Same-rack structured path (port → tray → channel → tray → port)
      const { x1, y1, x2, y2, channelX, trayYA, trayYB, hasOrganizer } = geo;
      if (hasOrganizer) {
        totalMm += Math.abs(y1  - trayYA)   * MM_PER_SVG_Y;  // port A → tray A (vertical)
        totalMm += Math.abs(x1  - channelX) * MM_PER_SVG_X;  // tray A → channel (horizontal)
        totalMm += Math.abs(trayYA - trayYB) * MM_PER_SVG_Y; // channel rail A↔B (vertical)
        totalMm += Math.abs(channelX - x2)  * MM_PER_SVG_X;  // channel → tray B (horizontal)
        totalMm += Math.abs(trayYB - y2)    * MM_PER_SVG_Y;  // tray B → port B (vertical)
      } else {
        // No organizer: port → channel → port (L-shape via rail)
        totalMm += Math.abs(x1 - channelX) * MM_PER_SVG_X;
        totalMm += Math.abs(y1 - y2)       * MM_PER_SVG_Y;
        totalMm += Math.abs(channelX - x2) * MM_PER_SVG_X;
      }

    } else if (mode === 'interrack-direct') {
      // Aerial Bézier arc above cabinets
      const { x1, y1, x2, y2, overheadY } = geo;
      const chordMmX = Math.abs(x2 - x1) * MM_PER_SVG_X;
      const chordMmY = Math.abs(y2 - y1) * MM_PER_SVG_Y;
      const chord    = Math.sqrt(chordMmX * chordMmX + chordMmY * chordMmY);
      const liftMm   = Math.abs(Math.min(y1, y2) - overheadY) * MM_PER_SVG_Y;
      totalMm += chord + liftMm * 1.5;

    } else if (mode === 'interrack-structured') {
      // 7-segment overhead tray: portA→trayA→railA→overhead→railB→trayB→portB
      const { x1, y1, x2, y2, channelXA, channelXB, trayYA, trayYB, overheadTrayY } = geo;
      totalMm += Math.abs(y1         - trayYA)       * MM_PER_SVG_Y; // portA → trayA
      totalMm += Math.abs(x1         - channelXA)    * MM_PER_SVG_X; // trayA → railA
      totalMm += Math.abs(trayYA     - overheadTrayY) * MM_PER_SVG_Y; // railA → overhead
      totalMm += Math.abs(channelXA  - channelXB)    * MM_PER_SVG_X; // overhead span
      totalMm += Math.abs(overheadTrayY - trayYB)    * MM_PER_SVG_Y; // overhead → railB
      totalMm += Math.abs(channelXB  - x2)           * MM_PER_SVG_X; // railB → trayB
      totalMm += Math.abs(trayYB     - y2)           * MM_PER_SVG_Y; // trayB → portB
    }

    const rawM = (totalMm / 1000) * SLACK_FACTOR;
    return Math.max(0.5, Math.round(rawM * 2) / 2); // round up to nearest 0.5 m
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
    // Clear lengthMeters so renderAllCables recomputes it for the new duct side
    delete cable.lengthMeters;

    // Explicitly maintain active cable selection & highlight so route change is immediately visible
    STATE.highlightedCableId = cableId;
    renderAllCables();         // redraws SVG path AND updates cable.lengthMeters via computeCableLength
    setCableHover(cableId, true);

    // Update duct triggers in-place without destroying schedule table DOM to prevent card flicker
    const ductLabel = next === 'left' ? '⬅️ Sol' : (next === 'right' ? '➡️ Sağ' : '⚖️ Oto');
    const ductTooltip = `Dikey Kanal Güzergahı: ${next === 'left' ? 'Sol Dikey Tava' : (next === 'right' ? 'Sağ Dikey Tava' : 'Otomatik Dengeli')} (Değiştirmek için tıkla)`;
    document.querySelectorAll(`.duct-select-trigger[data-cable-id="${cableId}"]`).forEach(btn => {
      btn.textContent = ductLabel;
      btn.title = ductTooltip;
    });

    // Update the metraj (length) badge in-place in schedule rows — no full table re-render needed
    const newLen = cable.lengthMeters || 0;
    document.querySelectorAll(`[data-cable-id="${cableId}"] .metraj-badge, tr[data-cable-id="${cableId}"] .metraj-badge`).forEach(badge => {
      badge.textContent = `${newLen}m`;
      badge.title = `Gerçek Saha Metrajı (${next === 'auto' ? 'Otomatik Kanal' : (next === 'left' ? 'Sol Kanal' : 'Sağ Kanal')}, Servis Payı Dahil)`;
    });

    // If the quick HUD is open for this cable, update its length display too
    const quickHudEl = document.getElementById('cable-quick-hud');
    if (quickHudEl) {
      const hudLen = quickHudEl.querySelector('.hud-length-val');
      if (hudLen) hudLen.textContent = `${newLen}m`;
    }

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

    // Phase 1: Batch all DOM getBoundingClientRect() reads BEFORE writing any SVG nodes
    const dringElements = Array.from(document.querySelectorAll('.dring-faceplate .dring-loop'));
    const dringRects = dringElements.map(el => el.getBoundingClientRect());

    const brushElements = Array.from(document.querySelectorAll('.brush-faceplate .brush-slot'));
    const brushRects = brushElements.map(el => el.getBoundingClientRect());

    const fingerPlates = Array.from(document.querySelectorAll('.finger-duct-faceplate'));
    const fingerData = fingerPlates.map(fpEl => {
      const tines = Array.from(fpEl.querySelectorAll('.finger-tine'));
      const tineRects = tines.map(tEl => tEl.getBoundingClientRect());
      const coverEl = fpEl.querySelector('.finger-duct-cover');
      const coverRect = coverEl ? coverEl.getBoundingClientRect() : null;
      const labelEl = fpEl.querySelector('.finger-duct-label');
      const labelText = labelEl ? (labelEl.textContent || '') : '';
      return { tineRects, coverRect, labelText };
    });

    // Phase 2: Batch DOM writes using a DocumentFragment
    const frag = document.createDocumentFragment();

    // 1. D-Ring Overlays
    dringRects.forEach(rect => {
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

      frag.appendChild(g);
    });

    // 2. Brush Pass-Through Overlays (.brush-faceplate .brush-slot)
    brushRects.forEach(rect => {
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

      frag.appendChild(g);
    });

    // 3. Finger Duct Overlays (.finger-duct-faceplate)
    fingerData.forEach(item => {
      // Individual slotted finger tines
      item.tineRects.forEach(r => {
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
        frag.appendChild(tineRect);
      });

      // Snap-on duct cover overlay
      if (item.coverRect && item.coverRect.width > 0 && item.coverRect.height > 0) {
        const cr = item.coverRect;
        const cp1 = toSvg(cr.left, cr.top);
        const cp2 = toSvg(cr.right, cr.bottom);
        const cw = cp2.x - cp1.x;
        const ch = cp2.y - cp1.y;
        if (cw > 0 && ch > 0) {
          const coverG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          coverG.setAttribute('class', 'finger-duct-svg-cover');

          const bodyRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          bodyRect.setAttribute('x', cp1.x.toFixed(2));
          bodyRect.setAttribute('y', cp1.y.toFixed(2));
          bodyRect.setAttribute('width', cw.toFixed(2));
          bodyRect.setAttribute('height', ch.toFixed(2));
          bodyRect.setAttribute('rx', '2');
          bodyRect.setAttribute('class', 'finger-duct-svg-cover-body');
          coverG.appendChild(bodyRect);

          const highlight = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          highlight.setAttribute('x1', (cp1.x + 2).toFixed(2));
          highlight.setAttribute('y1', (cp1.y + 0.8).toFixed(2));
          highlight.setAttribute('x2', (cp2.x - 2).toFixed(2));
          highlight.setAttribute('y2', (cp1.y + 0.8).toFixed(2));
          highlight.setAttribute('stroke', 'rgba(255, 255, 255, 0.22)');
          highlight.setAttribute('stroke-width', '0.75');
          coverG.appendChild(highlight);

          if (item.labelText) {
            const textNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            textNode.setAttribute('x', ((cp1.x + cp2.x) / 2).toFixed(2));
            textNode.setAttribute('y', (cp1.y + ch / 2 + 3).toFixed(2));
            textNode.setAttribute('text-anchor', 'middle');
            textNode.setAttribute('class', 'finger-duct-svg-cover-text');
            textNode.textContent = item.labelText;
            coverG.appendChild(textNode);
          }

          frag.appendChild(coverG);
        }
      }
    });

    overlayGroup.innerHTML = '';
    overlayGroup.appendChild(frag);
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

  RS.computeCableLength = computeCableLength;
  RS.getEndpointOrganizerChannelYs = getEndpointOrganizerChannelYs;
  RS.resolveCableDuctSide = resolveCableDuctSide;
  RS.toggleCableDuctSide = toggleCableDuctSide;
  RS.getActiveOrganizers = getActiveOrganizers;
  RS.findDeviceOrganizer = findDeviceOrganizer;
  RS.getDRingBracketCoords = getDRingBracketCoords;
  RS.renderOrganizerOverlays = renderOrganizerOverlays;
  RS.renderDRingOverlays = renderDRingOverlays;
  RS.buildStructuredCablePath = buildStructuredCablePath;
})();
