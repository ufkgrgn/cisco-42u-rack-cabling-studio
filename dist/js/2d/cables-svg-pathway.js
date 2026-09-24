/**
 * Cisco Enterprise Rack & Cabling Studio - SVG Cable Pathway Generator
 * Computes structured datacenter conduit paths, overhead ladder trays, vertical channels,
 * aerial direct arcs, and endpoint labeling for SVG cable rendering.
 */
(function () {
  'use strict';

  const RS = window.RackStudio = window.RackStudio || {};
  const STATE = RS.STATE;
  const HARDWARE_CATALOG = RS.HARDWARE_CATALOG;

  const computeCableLength = (...args) => (RS.computeCableLength ? RS.computeCableLength(...args) : 1.5);
  const findDeviceOrganizer = (...args) => (RS.findDeviceOrganizer ? RS.findDeviceOrganizer(...args) : null);
  const resolveCableDuctSide = (...args) => (RS.resolveCableDuctSide ? RS.resolveCableDuctSide(...args) : false);

  const MM_PER_U = 44.45; // mm (EIA-310)
  const SVG_PX_PER_U = 32; // px (design constant)
  const MM_PER_SVG_Y = MM_PER_U / SVG_PX_PER_U; // ≈ 1.389 mm / svg-px
  const SLACK_FACTOR = 1.05; // 5% slack for dress & bend radius

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

  function getCableEndpointInfo(activeRack, endpoint) {
    const instanceId = endpoint.instanceId || endpoint.deviceId;
    let device = null;
    let catalog = null;
    for (const rack of (STATE.racks || [activeRack])) {
      const found = rack.devices.find(d => d.instanceId === instanceId);
      if (found) { device = found; catalog = HARDWARE_CATALOG[found.catalogKey]; break; }
    }
    if (!device && activeRack) {
      device = activeRack.devices.find(d => d.instanceId === instanceId);
      catalog = device ? HARDWARE_CATALOG[device.catalogKey] : null;
    }
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

  function getRackChannelUsage(ctx, rackId) {
    if (!ctx.channelUsageByRack) ctx.channelUsageByRack = new Map();
    const key = String(rackId || '__default__');
    let usage = ctx.channelUsageByRack.get(key);
    if (!usage) {
      usage = { left: 0, right: 0 };
      ctx.channelUsageByRack.set(key, usage);
    }
    return usage;
  }

  function generateSvgCablePathway(cable, ctx) {
    const { activeRack, isMulti, clientToSvg, getPortRect, getRackRailBounds, getCachedOrgY } = ctx;

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
    if (!portFromEl && !portToEl) return null;

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
      if (!rectLocal || (rectLocal.width === 0 && rectLocal.height === 0)) return null;

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
      if (!portFromEl || !portToEl) return null;
      const rectA = getPortRect(portFromEl);
      const rectB = getPortRect(portToEl);
      if (!rectA || !rectB) return null;
      if (rectA.width === 0 && rectA.height === 0 && rectB.width === 0 && rectB.height === 0) return null;

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
      const overheadY = Math.min(y1, y2) - 80 - (ctx.leftChannelUsage++ % 6) * 8;
      pathD = `M ${x1} ${y1} C ${x1} ${overheadY}, ${x2} ${overheadY}, ${x2} ${y2}`;
      if (cable.lengthMeters == null) {
        cable.lengthMeters = computeCableLength('interrack-direct', { x1, y1, x2, y2, overheadY });
      }
    } else if (isInterRack && STATE.cableRoutingMode === 'structured') {
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

      const usageA = getRackChannelUsage(ctx, rackA?.id);
      const bundleIdxA = useRightA ? usageA.right++ : usageA.left++;
      const railLaneA = (bundleIdxA % 9) - 4;
      const railOffsetA = railLaneA * 3.2;
      const channelXA = (useRightA ? rackARight : rackALeft) + railOffsetA;

      const usageB = getRackChannelUsage(ctx, rackB?.id);
      const bundleIdxB = useRightB ? usageB.right++ : usageB.left++;
      const railLaneB = (bundleIdxB % 9) - 4;
      const railOffsetB = railLaneB * 3.2;
      const channelXB = (useRightB ? rackBRight : rackBLeft) + railOffsetB;

      const traySlotA = (bundleIdxA % 7) - 3;
      const actualTrayYA = trayYA + traySlotA * 2.8;

      const traySlotB = (bundleIdxB % 7) - 3;
      const actualTrayYB = trayYB + traySlotB * 2.8;

      const overheadLane = (bundleIdxA % 8);
      const overheadTrayY = Math.min(topYA, topYB) - 18 - (overheadLane * 4);

      const dirY1 = actualTrayYA >= y1 ? 1 : -1;
      const dirX1 = channelXA >= x1 ? 1 : -1;
      const r1 = Math.min(8, Math.abs(channelXA - x1) / 2, Math.abs(actualTrayYA - y1) / 2 || 4);

      const distRailYA = Math.abs(actualTrayYA - overheadTrayY);
      const rRailA = Math.min(10, Math.abs(channelXA - x1) / 2, distRailYA / 2 || 6);

      const dirX_top = channelXB >= channelXA ? 1 : -1;
      const distTopX = Math.abs(channelXB - channelXA);
      const rTopA = Math.min(10, distTopX / 2 || 6, distRailYA / 2 || 6);

      const distRailYB = Math.abs(actualTrayYB - overheadTrayY);
      const rTopB = Math.min(10, distTopX / 2 || 6, distRailYB / 2 || 6);

      const dirX2 = x2 >= channelXB ? 1 : -1;
      const rRailB = Math.min(10, Math.abs(x2 - channelXB) / 2, distRailYB / 2 || 6);

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
      const devA = RS.getDeviceById ? RS.getDeviceById(instA) : (STATE.deviceById?.get(instA) || STATE.racks.flatMap(r => r.devices).find(d => d.instanceId === instA));
      const devB = RS.getDeviceById ? RS.getDeviceById(instB) : (STATE.deviceById?.get(instB) || STATE.racks.flatMap(r => r.devices).find(d => d.instanceId === instB));
      const rackA = RS.getRackById ? RS.getRackById(cable.from.rackId) : (STATE.rackById?.get(cable.from.rackId) || activeRack);

      if (instA === instB) {
        const loopSide = x1 > 300 ? 12 : -12;
        pathD = `M ${x1} ${y1} C ${x1 + loopSide} ${y1}, ${x2 + loopSide} ${y2}, ${x2} ${y2}`;
        if (cable.lengthMeters == null) {
          cable.lengthMeters = Math.max(0.5, Math.round(Math.abs(y2 - y1) * MM_PER_SVG_Y / 1000 * SLACK_FACTOR * 2) / 2);
        }
      } else {
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

        const boundsA = getRackRailBounds(rackA?.id);
        const rackLeftEdge = boundsA.left;
        const rackRightEdge = boundsA.right;

        const rackCenterLine = (rackLeftEdge + rackRightEdge) / 2;
        const rackUsage = getRackChannelUsage(ctx, rackA?.id);
        const useRightChannel = resolveCableDuctSide(cable, x1, x2, rackCenterLine, rackUsage.left, rackUsage.right);
        const channelBase = useRightChannel ? rackRightEdge : rackLeftEdge;
        const bundleIdx = useRightChannel ? rackUsage.right++ : rackUsage.left++;

        const railLane = (bundleIdx % 9) - 4;
        const railTier = Math.floor(bundleIdx / 9) % 2;
        const railOffset = railLane * 3.2 + (railTier * 1.0);
        const channelX = channelBase + railOffset;

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
                `Q ${channelX} ${actualTrayYA} ${channelX} ${actualTrayYA - dirY_rail * rRail1} ` +
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

    const stubPoint = isStub ? { x: isFromMounted ? x2 : x1, y: isFromMounted ? y2 : y1 } : null;

    return {
      pathD,
      isStub,
      isFromMounted,
      stubBadgeText,
      stubPoint,
      isRightExit,
      x1,
      y1,
      x2,
      y2
    };
  }

  // Exports
  RS.SvgCablePathway = {
    shortenDeviceName,
    getCableEndpointInfo,
    getCableLabel,
    generateSvgCablePathway
  };
})();
