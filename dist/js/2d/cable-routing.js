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
    const ductLabel = next === 'left' ? 'Sol' : (next === 'right' ? 'Sağ' : 'Otomatik');
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
    let devTop = Number(dev.topU);
    if (RS.isDraggingDevice && dev.instanceId) {
      const devPos = RS.getPixiDevicePosition?.(dev.instanceId);
      if (devPos && typeof devPos.y === 'number' && typeof devPos.originY === 'number') {
        devTop -= Math.round((devPos.y - devPos.originY) / 32);
      } else {
        const el = document.getElementById(dev.instanceId);
        if (el && el.style.transform) {
          const match = el.style.transform.match(/translateY\((-?\d+(?:\.\d+)?)px\)/);
          if (match) {
            devTop -= Math.round(parseFloat(match[1]) / 32);
          }
        }
      }
    }
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
    if (!el || !contRect) return [];
    const brackets = el.querySelectorAll('.dring-bracket');
    if (brackets && brackets.length) {
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
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return [];
    const count = 5;
    const slot = rect.width / count;
    const coords = [];
    for (let idx = 0; idx < count; idx++) {
      const cx = rect.left + slot * (idx + 0.5);
      const cy = rect.top + rect.height / 2;
      coords.push({
        index: idx,
        x: (cx - (contRect.left + 8 * curScale)) / curScale,
        y: (cy - (contRect.top + 8 * curScale)) / curScale,
        width: (slot * 0.62) / curScale,
        height: (rect.height * 0.7) / curScale
      });
    }
    return coords;
  }

  function renderOrganizerOverlays() {
    const overlayGroup = dom.dringOverlayGroup || document.getElementById('dring-overlay-group');
    if (overlayGroup) overlayGroup.replaceChildren();
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

  const resolveCatalogItem = (key) => HARDWARE_CATALOG[key] || RS.resolveCatalogItem?.(key) || RS.catalog?.[key] || STATE.customCatalog?.[key] || null;

  function findRoutingOrganizers(rack, devA, devB) {
    if (!rack || !rack.devices || !devA || !devB) return [];
    const minU = Math.min(devA.topU, devB.topU);
    const maxU = Math.max(devA.topU, devB.topU);

    return rack.devices.filter(d => {
      const cat = resolveCatalogItem(d.catalogKey);
      if (!cat || cat.category !== "organizer") return false;
      const u = Number(d.topU);
      return (u >= minU && u <= maxU) || Math.abs(u - devA.topU) <= 1 || Math.abs(u - devB.topU) <= 1;
    }).sort((a, b) => {
      return devA.topU > devB.topU ? (b.topU - a.topU) : (a.topU - b.topU);
    });
  }

  function calculateCableLengthMeters(instA, instB, isInterRack) {
    if (isInterRack) {
      if (STATE.cableRoutingMode === "direct") {
        return 3.0;
      }
      const baseTieRun = 14.0;
      return parseFloat((baseTieRun * 1.10).toFixed(2));
    }
    const activeRack = getActiveRack();
    if (!activeRack) return 1.5;
    const devA = activeRack.devices.find(d => d.instanceId === instA);
    const devB = activeRack.devices.find(d => d.instanceId === instB);
    if (!devA || !devB) return 1.5;

    const uDiff = Math.abs(devA.topU - devB.topU);
    const catA = resolveCatalogItem(devA.catalogKey);
    const catB = resolveCatalogItem(devB.catalogKey);
    const isFiber = (catA && catA.category === "fiber") || (catB && catB.category === "fiber") ||
                    (devA.portsConfig && Object.values(devA.portsConfig).some(c => c.role === "fiber")) ||
                    (devB.portsConfig && Object.values(devB.portsConfig).some(c => c.role === "fiber"));

    const isDirect = STATE.cableRoutingMode === "direct";
    if (isDirect) {
      const directVertical = uDiff * 0.0445;
      const directHorizontal = 0.12;
      const directBend = isFiber ? 0.12 : 0.08;
      const rawDirect = directVertical + directHorizontal + directBend;
      const withMargin = rawDirect * 1.05;
      return Math.max(0.25, parseFloat(withMargin.toFixed(2)));
    }

    const routingOrganizers = findRoutingOrganizers(activeRack, devA, devB);
    const hasOrganizer = routingOrganizers.length > 0;

    const horizontalToDuct = 0.50;
    const verticalDuct = uDiff * 0.0445;
    let organizerAllowance = 0.0;
    if (hasOrganizer) {
      const hasBrush = routingOrganizers.some(d => {
        const c = resolveCatalogItem(d.catalogKey);
        return d.catalogKey === "organizer-1u" || (c?.modelTag && c.modelTag.includes("BRUSH")) || (c?.name && c.name.toLowerCase().includes("fırça"));
      });
      const hasFinger = routingOrganizers.some(d => {
        const c = resolveCatalogItem(d.catalogKey);
        return d.catalogKey === "organizer-2u" || (c?.modelTag && c.modelTag.includes("FINGER")) || (c?.name && c.name.toLowerCase().includes("parmak"));
      });
      if (hasBrush) organizerAllowance = 0.35;
      else if (hasFinger) organizerAllowance = 0.25;
      else organizerAllowance = 0.20;
    }
    const bendRadiusAllowance = isFiber ? 0.20 : 0.15;

    const rawLength = horizontalToDuct + verticalDuct + organizerAllowance + bendRadiusAllowance;
    const withServiceLoop = rawLength * 1.10;

    return Math.max(0.5, parseFloat(withServiceLoop.toFixed(2)));
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
  RS.findRoutingOrganizers = findRoutingOrganizers;
  RS.calculateCableLengthMeters = calculateCableLengthMeters;
})();
