/**
 * Cisco Enterprise Rack & Cabling Studio - PixiJS Cable Geometry Module
 * Computes world-space endpoint coordinates, routing channels, and SVG path strings
 * for single-rack and inter-rack cables in WebGL mode.
 */
(function () {
  'use strict';

  const RS = window.RackStudio = window.RackStudio || {};
  const PixiContext = RS.PixiContext = RS.PixiContext || {};

  const STATE = RS.STATE;
  const HARDWARE_CATALOG = RS.HARDWARE_CATALOG;

  const endpointWorldCache = new Map();
  const rackRailWorldCache = new Map();
  const organizerWorldYCache = new Map();

  const getActiveRack = () => (RS.getActiveRack ? RS.getActiveRack() : RS.STATE?.racks?.[0]);
  const computeCableLength = (...args) => (RS.computeCableLength ? RS.computeCableLength(...args) : 1.5);
  const findDeviceOrganizer = (...args) => (RS.findDeviceOrganizer ? RS.findDeviceOrganizer(...args) : null);
  const resolveCableDuctSide = (...args) => (RS.resolveCableDuctSide ? RS.resolveCableDuctSide(...args) : false);

  function invalidateLayoutGeometryCache() {
    endpointWorldCache.clear();
    rackRailWorldCache.clear();
    organizerWorldYCache.clear();
  }

  function getRackChannelUsage(ctx, rackId) {
    if (!ctx) return { left: 0, right: 0 };
    if (!ctx.channelUsageByRack) ctx.channelUsageByRack = new Map();
    const key = String(rackId || '__default__');
    let usage = ctx.channelUsageByRack.get(key);
    if (!usage) {
      usage = { left: 0, right: 0 };
      ctx.channelUsageByRack.set(key, usage);
    }
    return usage;
  }

  function hexColorToNumber(hex) {
    if (!hex) return 0x2563eb;
    const clean = String(hex).replace('#', '').trim();
    if (clean.length === 3) {
      const r = clean[0] + clean[0];
      const g = clean[1] + clean[1];
      const b = clean[2] + clean[2];
      const parsed = parseInt(r + g + b, 16);
      return Number.isNaN(parsed) ? 0x2563eb : parsed;
    }
    const parsed = parseInt(clean, 16);
    return Number.isNaN(parsed) ? 0x2563eb : parsed;
  }

  function svgRailOffset(index, tiered = true) {
    const lane = (index % 9) - 4;
    const tier = tiered ? (Math.floor(index / 9) % 2) : 0;
    return lane * 3.2 + tier;
  }

  function svgTrayOffset(index, tiered = true) {
    const lane = (index % 7) - 3;
    const tier = tiered ? (Math.floor(index / 7) % 2) * 0.9 : 0;
    return lane * 2.8 + tier;
  }

  function endpointSignature(endpoint = {}) {
    return [endpoint.rackId || '', endpoint.instanceId || endpoint.deviceId || '', endpoint.portId || endpoint.portIdx || ''].join(':');
  }

  function cableGeometrySignature(cable) {
    return [
      endpointSignature(cable.from), endpointSignature(cable.to),
      cable.ductSide || 'auto', STATE.cableRoutingMode || 'structured'
    ].join('|');
  }

  function cableRackBatchKey(cable) {
    const fromRack = cable?.from?.rackId || 'unknown';
    const toRack = cable?.to?.rackId || 'unknown';
    return fromRack === toRack ? fromRack : `__cross__:${fromRack}:${toRack}`;
  }

  function clientToPixi(clientX, clientY, canvasRect, stageW, stageH) {
    if (!canvasRect || canvasRect.width <= 0 || canvasRect.height <= 0) return { x: 0, y: 0 };
    if (STATE.pixiViewportRendererV2 !== false) {
      const scale = RS.ZOOM_STATE?.scale || 1;
      return {
        x: (clientX - canvasRect.left - (RS.ZOOM_STATE?.panX || 0)) / scale,
        y: (clientY - canvasRect.top - (RS.ZOOM_STATE?.panY || 0)) / scale
      };
    }
    return {
      x: (clientX - canvasRect.left) * stageW / canvasRect.width,
      y: (clientY - canvasRect.top) * stageH / canvasRect.height
    };
  }

  function getPortPoint(el, instanceId, portId, canvasRect, stageW, stageH) {
    const telemetry = PixiContext.performanceTelemetry;
    const renderStats = PixiContext.renderStats;
    const registryPoint = RS.DeviceSceneRegistry?.getPortPoint(instanceId, portId);
    if (registryPoint) {
      if (telemetry) telemetry.deviceSceneEndpointHits++;
      return registryPoint;
    }
    if (!el) return null;
    const key = el.id || `${instanceId || el.dataset?.instanceId || ''}:${portId || el.dataset?.portId || ''}`;
    const cached = endpointWorldCache.get(key);
    if (cached) {
      if (telemetry) telemetry.endpointCacheHits++;
      return cached;
    }
    const rect = el.getBoundingClientRect();
    if (renderStats) renderStats.domRectReads++;
    if (telemetry) telemetry.endpointCacheMisses++;
    if (rect.width === 0 && rect.height === 0) return null;
    const point = clientToPixi(rect.left + rect.width / 2, rect.top + rect.height / 2, canvasRect, stageW, stageH);
    endpointWorldCache.set(key, point);
    return point;
  }

  function getRackRailBounds(rackId, canvasRect, stageW, stageH) {
    const telemetry = PixiContext.performanceTelemetry;
    const renderStats = PixiContext.renderStats;
    if (!rackId) return { left: 23, right: 595, top: 0 };
    if (rackRailWorldCache.has(rackId)) {
      if (telemetry) telemetry.rackCacheHits++;
      return rackRailWorldCache.get(rackId);
    }
    if (telemetry) telemetry.rackCacheMisses++;
    let left = 23;
    let right = 595;
    let top = 0;
    const rackCont = document.querySelector(`.rack-container[data-rack-id="${rackId}"]`) ||
                     document.getElementById(`rack-container-${rackId}`) ||
                     document.getElementById('rack-container');
    if (rackCont) {
      const rc = rackCont.getBoundingClientRect();
      if (renderStats) renderStats.domRectReads++;
      top = clientToPixi(0, rc.top, canvasRect, stageW, stageH).y;
      const railL = rackCont.querySelector('.rack-rail.left');
      const railR = rackCont.querySelector('.rack-rail.right');
      if (railL && railR) {
        const lRect = railL.getBoundingClientRect();
        const rRect = railR.getBoundingClientRect();
        if (renderStats) renderStats.domRectReads += 2;
        left = clientToPixi(lRect.left + lRect.width / 2, 0, canvasRect, stageW, stageH).x;
        right = clientToPixi(rRect.left + rRect.width / 2, 0, canvasRect, stageW, stageH).x;
      }
    }
    const bounds = { left, right, top };
    rackRailWorldCache.set(rackId, bounds);
    return bounds;
  }

  function getCachedOrgY(org, fallbackY, otherY, canvasRect, stageW, stageH) {
    const telemetry = PixiContext.performanceTelemetry;
    const renderStats = PixiContext.renderStats;
    if (!org || !org.instanceId) return fallbackY + (otherY >= fallbackY ? 14 : -14);
    if (organizerWorldYCache.has(org.instanceId)) {
      if (telemetry) telemetry.organizerCacheHits++;
      return organizerWorldYCache.get(org.instanceId);
    }
    if (telemetry) telemetry.organizerCacheMisses++;
    const orgEl = document.getElementById(org.instanceId);
    if (orgEl) {
      const r = orgEl.getBoundingClientRect();
      if (renderStats) renderStats.domRectReads++;
      const y = clientToPixi(0, r.top + r.height / 2, canvasRect, stageW, stageH).y;
      organizerWorldYCache.set(org.instanceId, y);
      return y;
    }
    return fallbackY + (otherY >= fallbackY ? 14 : -14);
  }

  function calculateCableRoute(cable, ctx) {
    const { activeRack, canvasRect, stageW, stageH } = ctx;
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

    const p1 = getPortPoint(portFromEl, instA, portIdA, canvasRect, stageW, stageH);
    const p2 = getPortPoint(portToEl, instB, portIdB, canvasRect, stageW, stageH);
    const isInterRack = cable.from?.rackId !== cable.to?.rackId;
    if (!p1 && !p2) return null;

    let isStub = false;
    let isFromMounted = true;
    let stubBadgeText = '';
    let isRightExit = true;
    let x1 = 0, y1 = 0, x2 = 0, y2 = 0;

    if (isInterRack && (!p1 || !p2)) {
      isStub = true;
      isFromMounted = !!p1;
      const remoteEndpoint = isFromMounted ? cable.to : cable.from;
      const pLocal = isFromMounted ? p1 : p2;
      if (!pLocal) return null;

      ctx.seenCableIds.add(cable.id);
      const hostRackId = isFromMounted ? (cable.from?.rackId || activeRack?.id) : (cable.to?.rackId || activeRack?.id);
      const boundsLocal = getRackRailBounds(hostRackId, canvasRect, stageW, stageH);
      const activeIdx = (STATE.racks || []).findIndex(r => r && r.id === hostRackId);
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
      if (!p1 || !p2) return null;
      ctx.seenCableIds.add(cable.id);
      x1 = p1.x;
      y1 = p1.y;
      x2 = p2.x;
      y2 = p2.y;
    }

    let pathD = '';

    if (isStub) {
      const ctrlX1 = isRightExit ? Math.max(x1, x2) - 10 : Math.min(x1, x2) + 10;
      pathD = `M ${x1} ${y1} C ${ctrlX1} ${y1}, ${x2} ${y2}, ${x2} ${y2}`;
    } else if (isInterRack && STATE.cableRoutingMode === 'direct') {
      const overheadY = Math.min(y1, y2) - 80 - (ctx.leftChannelUsage++ % 6) * 8;
      pathD = `M ${x1} ${y1} C ${x1} ${overheadY}, ${x2} ${overheadY}, ${x2} ${y2}`;
    } else if (isInterRack && STATE.cableRoutingMode === 'structured') {
      const rackA = (RS.getRackById ? RS.getRackById(cable.from?.rackId) : null) || (STATE.rackById?.get(cable.from?.rackId)) || STATE.racks?.find(r => r.id === cable.from?.rackId) || activeRack;
      const rackB = (RS.getRackById ? RS.getRackById(cable.to?.rackId) : null) || (STATE.rackById?.get(cable.to?.rackId)) || STATE.racks?.find(r => r.id === cable.to?.rackId) || activeRack;
      const devA = RS.getDeviceById ? RS.getDeviceById(instA) : (rackA?.devices?.find(d => d.instanceId === instA) || STATE.racks?.flatMap(r => r.devices).find(d => d.instanceId === instA));
      const devB = RS.getDeviceById ? RS.getDeviceById(instB) : (rackB?.devices?.find(d => d.instanceId === instB) || STATE.racks?.flatMap(r => r.devices).find(d => d.instanceId === instB));

      const orgA = findDeviceOrganizer(rackA, devA);
      const orgB = findDeviceOrganizer(rackB, devB);

      let trayYA = getCachedOrgY(orgA, y1, y2, canvasRect, stageW, stageH);
      let trayYB = getCachedOrgY(orgB, y2, y1, canvasRect, stageW, stageH);

      const boundsA = getRackRailBounds(rackA?.id, canvasRect, stageW, stageH);
      const boundsB = getRackRailBounds(rackB?.id, canvasRect, stageW, stageH);
      const topYA = boundsA.top || (y1 - 40);
      const topYB = boundsB.top || topYA;

      const rackACenter = (boundsA.left + boundsA.right) / 2;
      const rackBCenter = (boundsB.left + boundsB.right) / 2;
      const goingRight = rackBCenter >= rackACenter;

      const usageA = getRackChannelUsage(ctx, rackA?.id);
      const usageB = getRackChannelUsage(ctx, rackB?.id);

      const useRightA = cable.ductSide === 'right' ? true : (cable.ductSide === 'left' ? false : (goingRight ? (x1 >= rackACenter - 40) : (x1 >= rackACenter + 40)));
      const useRightB = cable.ductSide === 'right' ? true : (cable.ductSide === 'left' ? false : (goingRight ? (x2 >= rackBCenter + 40) : (x2 >= rackBCenter - 40)));

      const bundleIdxA = useRightA ? usageA.right++ : usageA.left++;
      const channelXA = (useRightA ? boundsA.right : boundsA.left) + svgRailOffset(bundleIdxA, false);

      const bundleIdxB = useRightB ? usageB.right++ : usageB.left++;
      const channelXB = (useRightB ? boundsB.right : boundsB.left) + svgRailOffset(bundleIdxB, false);

      const actualTrayYA = trayYA + svgTrayOffset(bundleIdxA, false);
      const actualTrayYB = trayYB + svgTrayOffset(bundleIdxB, false);
      const overheadTrayY = Math.min(topYA, topYB) - 18 - (bundleIdxA % 8) * 4;

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
          x1, y1, x2, y2, channelXA, channelXB,
          trayYA: actualTrayYA, trayYB: actualTrayYB, overheadTrayY
        });
      }
    } else if (STATE.cableRoutingMode === 'direct') {
      const dy = Math.abs(y2 - y1);
      const sag = Math.min(180, Math.max(28, dy * 0.45));
      const midY = (y1 + y2) / 2 + sag;
      const cp1x = x1 + (x2 - x1) * 0.25;
      const cp2x = x1 + (x2 - x1) * 0.75;
      pathD = `M ${x1} ${y1} C ${cp1x} ${midY}, ${cp2x} ${midY}, ${x2} ${y2}`;
      if (cable.lengthMeters == null) {
        cable.lengthMeters = computeCableLength('direct', { x1, y1, x2, y2 });
      }
    } else {
      const hostRackId = cable.from?.rackId || cable.to?.rackId || activeRack?.id;
      const rackA = (RS.getRackById ? RS.getRackById(hostRackId) : null) || (STATE.rackById?.get(hostRackId)) || STATE.racks?.find(r => r.id === hostRackId) || activeRack;
      const devA = RS.getDeviceById ? RS.getDeviceById(instA) : (rackA?.devices?.find(d => d.instanceId === instA) || activeRack?.devices?.find(d => d.instanceId === instA));
      const devB = RS.getDeviceById ? RS.getDeviceById(instB) : (rackA?.devices?.find(d => d.instanceId === instB) || activeRack?.devices?.find(d => d.instanceId === instB));
      const orgA = findDeviceOrganizer(rackA, devA);
      const orgB = findDeviceOrganizer(rackA, devB);

      const bounds = getRackRailBounds(rackA?.id, canvasRect, stageW, stageH);
      const rackCenterLine = (bounds.left + bounds.right) / 2;
      const usageA = getRackChannelUsage(ctx, rackA?.id);

      const isRight = resolveCableDuctSide(cable, x1, x2, rackCenterLine, usageA.left, usageA.right);

      const bundleIdx = isRight ? usageA.right++ : usageA.left++;
      const channelX = (isRight ? bounds.right : bounds.left) + svgRailOffset(bundleIdx, true);

      let trayYA = getCachedOrgY(orgA, y1, y2, canvasRect, stageW, stageH);
      let trayYB = getCachedOrgY(orgB, y2, y1, canvasRect, stageW, stageH);

      trayYA += svgTrayOffset(bundleIdx, true);
      trayYB += svgTrayOffset(bundleIdx, true);

      const dirY1 = trayYA >= y1 ? 1 : -1;
      const dirY2 = y2 >= trayYB ? 1 : -1;
      const dirX1 = isRight ? 1 : -1;
      const dirX2 = isRight ? -1 : 1;

      const r1 = Math.min(8, Math.abs(channelX - x1) / 2, Math.abs(trayYA - y1) / 2 || 4);
      const r2 = Math.min(8, Math.abs(channelX - x2) / 2, Math.abs(y2 - trayYB) / 2 || 4);

      const distRailY = Math.abs(trayYB - trayYA);
      const rRail1 = Math.min(10, Math.abs(channelX - x1) / 2, distRailY / 2 || 6);
      const rRail2 = Math.min(10, Math.abs(channelX - x2) / 2, distRailY / 2 || 6);
      const dirY_rail = trayYB >= trayYA ? 1 : -1;

      if (distRailY < 2) {
        pathD = `M ${x1} ${y1} ` +
                `L ${x1} ${trayYA - dirY1 * r1} ` +
                `Q ${x1} ${trayYA} ${x1 + dirX1 * r1} ${trayYA} ` +
                `L ${channelX} ${trayYA} ` +
                `L ${x2 - dirX2 * r2} ${trayYB} ` +
                `Q ${x2} ${trayYB} ${x2} ${trayYB + dirY2 * r2} ` +
                `L ${x2} ${y2}`;
      } else {
        pathD = `M ${x1} ${y1} ` +
                `L ${x1} ${trayYA - dirY1 * r1} ` +
                `Q ${x1} ${trayYA} ${x1 + dirX1 * r1} ${trayYA} ` +
                `L ${channelX - dirX1 * rRail1} ${trayYA} ` +
                `Q ${channelX} ${trayYA} ${channelX} ${trayYA + dirY_rail * rRail1} ` +
                `L ${channelX} ${trayYB - dirY_rail * rRail2} ` +
                `Q ${channelX} ${trayYB} ${channelX + dirX2 * rRail2} ${trayYB} ` +
                `L ${x2 - dirX2 * r2} ${trayYB} ` +
                `Q ${x2} ${trayYB} ${x2} ${trayYB + dirY2 * r2} ` +
                `L ${x2} ${y2}`;
        if (cable.lengthMeters == null) {
          cable.lengthMeters = computeCableLength('structured', {
            x1, y1, x2, y2, channelX,
            trayYA, trayYB,
            hasOrganizer: !!(orgA || orgB)
          });
        }
      }
    }

    const colorHex = cable.color || '#2563eb';
    const colorNum = hexColorToNumber(colorHex);
    const geometrySignature = cableGeometrySignature(cable);
    const rackKey = cableRackBatchKey(cable);

    return {
      pathD,
      colorNum,
      geometrySignature,
      rackKey,
      isStub,
      stubBadgeText,
      stubPoint: isStub ? { x: isFromMounted ? x2 : x1, y: isFromMounted ? y2 : y1 } : null,
      isRightExit,
      endpoints: isStub ? [{ x: isFromMounted ? x1 : x2, y: isFromMounted ? y1 : y2 }] : [{ x: x1, y: y1 }, { x: x2, y: y2 }]
    };
  }

  // Exports
  RS.PixiCableGeometry = {
    calculateCableRoute,
    invalidateLayoutGeometryCache,
    getPortPoint,
    getRackRailBounds,
    getCachedOrgY,
    clientToPixi,
    hexColorToNumber,
    endpointSignature,
    cableGeometrySignature,
    cableRackBatchKey,
    svgRailOffset,
    svgTrayOffset,
    endpointWorldCache,
    rackRailWorldCache,
    organizerWorldYCache
  };

  PixiContext.endpointWorldCache = endpointWorldCache;
  PixiContext.rackRailWorldCache = rackRailWorldCache;
  PixiContext.organizerWorldYCache = organizerWorldYCache;
  PixiContext.invalidateLayoutGeometryCache = invalidateLayoutGeometryCache;
})();
