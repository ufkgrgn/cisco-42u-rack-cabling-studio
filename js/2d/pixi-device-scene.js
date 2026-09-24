/**
 * Cisco Enterprise Rack & Cabling Studio - PixiJS 2D Device Scene & Port LOD Engine
 * Handles GPU rendering of rack chassis, port texture atlases, occupancy fingerprints,
 * and high-performance port hit testing.
 */
(function () {
  'use strict';

  const RS = window.RackStudio = window.RackStudio || {};
  const PixiContext = RS.PixiContext = RS.PixiContext || {};

  const STATE = RS.STATE;
  const getActiveRack = () => (RS.getActiveRack ? RS.getActiveRack() : RS.STATE?.racks?.[0]);

  const DEVICE_PORT_HIT_CELL_SIZE = 32;
  const EMPTY_CABLE_LIST = Object.freeze([]);
  const hitTestPoint = { x: 0, y: 0 };

  const deviceRackScenes = new Map();
  const deviceRackByInstance = new Map();
  const deviceContainers = new Map();
  const devicePortSprites = new Map();
  const devicePortOccupancy = new Map();
  const devicePortVariantCounts = new Map();
  const devicePortHitGrid = new Map();

  let hoveredDevicePortKey = null;
  let hoveredDeviceId = null;
  let activeDeviceSceneLod = 'macro';
  let lastDeviceSceneSignature = null;
  let lastDeviceGeometrySignature = null;
  let lastDevicePresentationKey = null;

  let cachedDeviceOccupancy = new Set();
  let cachedOccupancyCableCount = -1;
  let cachedOccupancyEndpointCount = -1;
  let cachedOccupancyHashA = 0;
  let cachedOccupancyHashB = 0;
  let deviceOccupancyChanged = false;

  function destroyDeviceRackScenes() {
    PixiContext.deviceSceneContainer?.removeChildren?.().forEach(rackContainer => {
      rackContainer.destroy?.({ children: true });
    });
    deviceRackScenes.clear();
    deviceRackByInstance.clear();
    deviceContainers.clear();
    devicePortSprites.clear();
    devicePortOccupancy.clear();
    devicePortVariantCounts.clear();
    devicePortHitGrid.clear();
    hoveredDevicePortKey = null;
    if (PixiContext.performanceTelemetry) {
      PixiContext.performanceTelemetry.visibleDeviceRacks = 0;
      PixiContext.performanceTelemetry.culledDeviceRacks = 0;
    }
  }

  function destroyDeviceRackScene(rackId) {
    const key = String(rackId || '__unknown__');
    const scene = deviceRackScenes.get(key);
    if (!scene) return;
    if (scene.container?.parent) scene.container.parent.removeChild(scene.container);
    scene.container?.destroy?.({ children: true });
    deviceRackScenes.delete(key);
    for (const [devId, rk] of deviceRackByInstance) {
      if (rk === key) { deviceContainers.delete(devId); deviceRackByInstance.delete(devId); }
    }
    lastDeviceGeometrySignature = lastDeviceSceneSignature = null;
  }

  function prunePixiDevice(instanceId) {
    if (!instanceId) return;
    const id = String(instanceId);
    const dev = deviceContainers.get(id);
    if (dev?.container) {
      if (dev.container.parent) dev.container.parent.removeChild(dev.container);
      dev.container.destroy?.({ children: true });
    }
    deviceContainers.delete(id);
    deviceRackByInstance.delete(id);
    for (const [k] of devicePortSprites) {
      if (k.startsWith(`${id}::`)) { devicePortSprites.delete(k); devicePortOccupancy.delete(k); }
    }
    for (const [cKey, ports] of devicePortHitGrid) {
      const rest = ports.filter(p => String(p.instanceId) !== id);
      if (rest.length) devicePortHitGrid.set(cKey, rest); else devicePortHitGrid.delete(cKey);
    }
    lastDeviceGeometrySignature = lastDeviceSceneSignature = null;
  }

  function getOrCreateDeviceRackScene(rackId) {
    const key = String(rackId || '__unknown__');
    let scene = deviceRackScenes.get(key);
    if (scene) return scene;
    const container = new window.PIXI.Container();
    container.label = `rack-device-scene-${key}`;
    container.eventMode = 'passive';
    scene = { key, container, bounds: null };
    deviceRackScenes.set(key, scene);
    return scene;
  }

  function includeDeviceInRackBounds(scene, device) {
    const bounds = scene.bounds || (scene.bounds = {
      minX: device.x,
      minY: device.y,
      maxX: device.x + device.width,
      maxY: device.y + device.height
    });
    bounds.minX = Math.min(bounds.minX, device.x);
    bounds.minY = Math.min(bounds.minY, device.y);
    bounds.maxX = Math.max(bounds.maxX, device.x + device.width);
    bounds.maxY = Math.max(bounds.maxY, device.y + device.height);
  }

  function addDevicePortToHitGrid(port) {
    const cellX = Math.floor(port.x / DEVICE_PORT_HIT_CELL_SIZE);
    const cellY = Math.floor(port.y / DEVICE_PORT_HIT_CELL_SIZE);
    const key = `${cellX}:${cellY}`;
    let entries = devicePortHitGrid.get(key);
    if (!entries) devicePortHitGrid.set(key, entries = []);
    entries.push(port);
  }

  function hitDevicePortAt(clientX, clientY) {
    if (!PixiContext.deviceSceneContainer?.visible) return null;
    const rect = PixiContext.getPixiCanvasRect?.();
    if (!rect?.width || !rect?.height) return null;
    const point = PixiContext.clientToRenderer ? PixiContext.clientToRenderer(clientX, clientY, rect, hitTestPoint) : hitTestPoint;
    const scale = Math.max(0.05, Number(RS.ZOOM_STATE?.scale) || 1);
    const tolerance = Math.max(2, (scale < 0.35 ? 8 : 2.5) / scale);
    const cellRadius = Math.ceil(tolerance / DEVICE_PORT_HIT_CELL_SIZE);
    const centerX = Math.floor(point.x / DEVICE_PORT_HIT_CELL_SIZE);
    const centerY = Math.floor(point.y / DEVICE_PORT_HIT_CELL_SIZE);
    let best = null;
    let bestDistance = Infinity;
    for (let x = centerX - cellRadius; x <= centerX + cellRadius; x++) {
      for (let y = centerY - cellRadius; y <= centerY + cellRadius; y++) {
        const candidates = devicePortHitGrid.get(`${x}:${y}`) || EMPTY_CABLE_LIST;
        for (let index = 0; index < candidates.length; index++) {
          const port = candidates[index];
          const devEntry = deviceContainers.get(String(port.instanceId));
          const portX = devEntry ? (devEntry.container.x + (port.localX ?? (port.x - devEntry.originX))) : port.x;
          const portY = devEntry ? (devEntry.container.y + (port.localY ?? (port.y - devEntry.originY))) : port.y;
          const dx = point.x - portX;
          const dy = point.y - portY;
          const distance = dx * dx + dy * dy;
          const radius = Math.max(tolerance, Math.max(port.width, port.height) * 0.65);
          if (distance > radius * radius || distance >= bestDistance) continue;
          best = port;
          bestDistance = distance;
        }
      }
    }
    return best;
  }

  function getDevicePortClientRect(port) {
    const canvasRect = PixiContext.getPixiCanvasRect?.();
    if (!canvasRect) return null;
    const scale = Number(RS.ZOOM_STATE?.scale) || 1;
    const panX = Number(RS.ZOOM_STATE?.panX) || 0;
    const panY = Number(RS.ZOOM_STATE?.panY) || 0;
    const devEntry = deviceContainers.get(String(port.instanceId));
    const portX = devEntry ? (devEntry.container.x + (port.localX ?? (port.x - devEntry.originX))) : port.x;
    const portY = devEntry ? (devEntry.container.y + (port.localY ?? (port.y - devEntry.originY))) : port.y;
    const left = canvasRect.left + panX + portX * scale;
    const top = canvasRect.top + panY + portY * scale;
    const width = Math.max(1, port.width * scale);
    const height = Math.max(1, port.height * scale);
    return { left, top, right: left + width, bottom: top + height, width, height };
  }

  function dispatchDevicePortInteraction(action, port) {
    if (!port || typeof RS.dispatchPixiPortInteraction !== 'function') return false;
    const key = `${port.instanceId}::${port.portId}`;
    const sprite = devicePortSprites.get(key);
    const rect = getDevicePortClientRect(port);
    const handled = RS.dispatchPixiPortInteraction(action, port, rect, sprite);
    if (handled) PixiContext.renderPixi?.(`device-port-${action}`);
    return handled;
  }

  function parseHexColor(color) {
    if (typeof color === 'number') return color;
    if (typeof color === 'string') {
      const hex = color.replace(/^#/, '');
      const parsed = parseInt(hex, 16);
      if (!Number.isNaN(parsed)) return parsed;
    }
    return 0xffffff;
  }

  function getDevicePortRoleColor(instanceIdOrDev, portId) {
    const instanceId = (instanceIdOrDev && typeof instanceIdOrDev === 'object') ? instanceIdOrDev.instanceId : instanceIdOrDev;
    const rack = (STATE.racks && STATE.racks.find(r => r.devices && r.devices.some(d => d.instanceId === instanceId))) || getActiveRack();
    const dev = (instanceIdOrDev && typeof instanceIdOrDev === 'object') ? instanceIdOrDev : rack?.devices?.find(d => d.instanceId === instanceId);
    if (!dev?.portsConfig) return null;
    const pIdStr = String(portId || '');
    const pNumStr = pIdStr.replace(/\D+/g, '');
    const cfg = dev.portsConfig[pIdStr] ||
      (pNumStr && dev.portsConfig[pNumStr]) ||
      (pNumStr && dev.portsConfig['p' + pNumStr]) ||
      (pNumStr && dev.portsConfig['pt' + pNumStr]) ||
      (pNumStr && dev.portsConfig['lc' + pNumStr]) ||
      (pNumStr && dev.portsConfig['sc' + pNumStr]) ||
      null;
    if (!cfg) return null;
    if (cfg.color) return parseHexColor(cfg.color);
    if (cfg.role) {
      const meta = RS.PORT_ROLE_META?.[cfg.role];
      if (meta?.color) return parseHexColor(meta.color);
    }
    return null;
  }

  function applyPortTint(sprite, key, port, isOccupied) {
    const pending = STATE.pendingConnection;
    const isSelected = pending && `${pending.instanceId}::${pending.portId}` === key;
    if (isSelected || key === hoveredDevicePortKey) {
      sprite.tint = 0x67e8f9;
      return;
    }
    const roleColor = port ? getDevicePortRoleColor(port.instanceId, port.portId) : null;
    if (roleColor !== null) {
      sprite.tint = roleColor;
      return;
    }
    sprite.tint = isOccupied ? 0x22c55e : 0xffffff;
  }

  function restoreDevicePortTint(key) {
    const sprite = devicePortSprites.get(key);
    if (!sprite) return;
    const parts = key.split('::');
    const occupied = devicePortOccupancy.get(key) === true;
    applyPortTint(sprite, key, { instanceId: parts[0], portId: parts[1] }, occupied);
    PixiContext.renderPixi?.('device-port-hover');
  }

  function deviceCoverOpen(instanceId) {
    const racks = STATE?.racks || [];
    for (let i = 0; i < racks.length; i++) {
      const dev = racks[i]?.devices?.find(item => item.instanceId === instanceId);
      if (dev) return !!dev.coverOpen;
    }
    return false;
  }

  function paintDeviceChrome(entry) {
    const graphics = entry?.chrome;
    if (!graphics) return;
    graphics.clear();
    const id = String(entry.device.instanceId);
    const el = document.getElementById(id);
    const multi = !!el?.classList.contains('studio-multi-selected');
    const selected = multi || !!el?.classList.contains('studio-selected');
    const hovered = hoveredDeviceId === id && !selected;
    if (!selected && !hovered) return;
    const color = multi ? 0xa855f7 : 0x38bdf8;
    const alpha = hovered ? 0.75 : 1;
    const w = entry.width;
    const h = entry.height;
    const arm = Math.max(5, Math.min(12, w * 0.045, h * 0.42));
    const t = Math.max(1.5, Math.min(2.4, h * 0.08));
    const bars = [
      [0, 0, arm, t], [0, 0, t, arm],
      [w - arm, 0, arm, t], [w - t, 0, t, arm],
      [0, h - t, arm, t], [0, h - arm, t, arm],
      [w - arm, h - t, arm, t], [w - t, h - arm, t, arm]
    ];
    bars.forEach(([x, y, bw, bh]) => graphics.rect(x, y, bw, bh).fill({ color, alpha }));
  }

  function syncPixiDeviceSelection() {
    deviceContainers.forEach(entry => paintDeviceChrome(entry));
    PixiContext.renderPixi?.('device-selection');
  }

  function setPixiDeviceHover(instanceId) {
    const next = instanceId ? String(instanceId) : null;
    if (next === hoveredDeviceId) return false;
    const previous = hoveredDeviceId;
    hoveredDeviceId = next;
    if (previous && deviceContainers.get(previous)) paintDeviceChrome(deviceContainers.get(previous));
    if (next && deviceContainers.get(next)) paintDeviceChrome(deviceContainers.get(next));
    PixiContext.renderPixi?.('device-hover');
    return true;
  }

  function hitDeviceBodyAt(clientX, clientY) {
    if (!PixiContext.deviceSceneContainer?.visible) return null;
    const rect = PixiContext.getPixiCanvasRect?.();
    if (!rect?.width || !rect?.height || !PixiContext.clientToRenderer) return null;
    const point = PixiContext.clientToRenderer(clientX, clientY, rect, hitTestPoint);
    let best = null;
    deviceContainers.forEach((dev, id) => {
      const x = dev.container.x;
      const y = dev.container.y;
      if (point.x < x || point.y < y || point.x > x + dev.width || point.y > y + dev.height) return;
      best = { instanceId: id, category: dev.device.category, catalogKey: dev.device.catalogKey };
    });
    return best;
  }

  function listDeviceFrames() {
    const frames = [];
    deviceContainers.forEach((dev, id) => {
      frames.push({
        instanceId: id,
        category: dev.device.category,
        catalogKey: dev.device.catalogKey,
        x: dev.container.x,
        y: dev.container.y,
        width: dev.width,
        height: dev.height,
        coverOpen: deviceCoverOpen(id)
      });
    });
    return frames;
  }

  function toggleOrganizerCover(instanceId) {
    const racks = STATE?.racks || [];
    for (let i = 0; i < racks.length; i++) {
      const dev = racks[i]?.devices?.find(item => item.instanceId === instanceId);
      if (!dev) continue;
      dev.coverOpen = !dev.coverOpen;
      invalidatePixiDeviceScene();
      syncPixiDeviceSceneLOD();
      RS.renderAllCables?.();
      return true;
    }
    return false;
  }

  function faceplateSpec(device) {
    return {
      category: device.category || '',
      catalogKey: device.catalogKey || '',
      uHeight: Math.max(1, Math.round((device.height || 32) / 32)),
      series: device.series || ''
    };
  }

  function buildDeviceChassis(devices) {
    const texturesApi = RS.FaceplateTextures;
    if (!texturesApi || !window.PIXI) return;
    destroyDeviceRackScenes();
    let spriteCount = 0;
    devices.forEach(device => {
      const scene = getOrCreateDeviceRackScene(device.rackId);
      deviceRackByInstance.set(String(device.instanceId), scene.key);
      includeDeviceInRackBounds(scene, device);

      const devContainer = new window.PIXI.Container();
      devContainer.label = `device-${device.instanceId}`;
      devContainer.position.set(device.x, device.y);
      devContainer.eventMode = 'passive';

      const portsContainer = new window.PIXI.Container();
      portsContainer.label = `device-ports-${device.instanceId}`;
      portsContainer.eventMode = 'passive';

      const spec = faceplateSpec(device);
      const slice = texturesApi.chassisSlice(spec);
      let chassisSprite = null;
      let overlays = null;
      if (slice.mode === 'graphics') {
        overlays = new window.PIXI.Graphics();
        overlays.eventMode = 'none';
        texturesApi.paintChassisGraphics(overlays, spec, device.width, device.height, deviceCoverOpen(device.instanceId));
        devContainer.addChild(overlays);
        if (spec.category === 'blank' && window.PIXI.Text) {
          const label = new window.PIXI.Text({
            text: 'BLANK COVER PANEL',
            style: { fontFamily: 'ui-monospace, monospace', fontSize: 9, fill: 0x475569, letterSpacing: 1 }
          });
          if (label.anchor?.set) label.anchor.set(0.5);
          label.position.set(device.width / 2, device.height / 2);
          label.eventMode = 'none';
          devContainer.addChild(label);
        }
        spriteCount++;
      } else {
        const texture = texturesApi.getChassisTexture(spec);
        if (texture) {
          chassisSprite = new window.PIXI.NineSliceSprite({
            texture,
            leftWidth: slice.leftWidth,
            rightWidth: slice.rightWidth,
            topHeight: slice.topHeight,
            bottomHeight: slice.bottomHeight,
            width: device.width,
            height: device.height
          });
          chassisSprite.eventMode = 'none';
          chassisSprite.visible = true;
          devContainer.addChild(chassisSprite);
          spriteCount++;
        }
      }

      const chrome = new window.PIXI.Graphics();
      chrome.eventMode = 'none';
      devContainer.addChild(portsContainer, chrome);
      scene.container.addChild(devContainer);
      const entry = {
        container: devContainer,
        chassis: chassisSprite,
        overlays,
        chrome,
        ports: portsContainer,
        device,
        originX: device.x,
        originY: device.y,
        width: device.width,
        height: device.height
      };
      deviceContainers.set(String(device.instanceId), entry);
      paintDeviceChrome(entry);
    });
    deviceRackScenes.forEach(scene => PixiContext.deviceSceneContainer?.addChild(scene.container));
    if (PixiContext.performanceTelemetry) PixiContext.performanceTelemetry.deviceChassisSpriteCount = spriteCount;
  }

  function buildDeviceGeometrySignature(snapshot, lod) {
    return `${lod}|${snapshot.generation}|${snapshot.devices.length}|${snapshot.ports.length}`;
  }

  function hashOccupancyValue(value, hash, prime) {
    const text = String(value);
    for (let index = 0; index < text.length; index++) {
      hash = Math.imul(hash ^ text.charCodeAt(index), prime) >>> 0;
    }
    return Math.imul(hash ^ 0xff, prime) >>> 0;
  }

  function collectDeviceOccupancy() {
    const cables = STATE.cables || EMPTY_CABLE_LIST;
    let endpointCount = 0;
    let hashA = 2166136261;
    let hashB = 0x9e3779b9;
    const primeA = 16777619;
    const primeB = 2246822519;
    if (PixiContext.performanceTelemetry) PixiContext.performanceTelemetry.deviceOccupancyFingerprintChecks++;

    for (let index = 0; index < cables.length; index++) {
      const cable = cables[index];
      if (!cable) continue;
      if (cable.from) {
        hashA = hashOccupancyValue(cable.from.instanceId, hashA, primeA);
        hashA = hashOccupancyValue(cable.from.portId, hashA, primeA);
        hashB = hashOccupancyValue(cable.from.portId, hashB, primeB);
        hashB = hashOccupancyValue(cable.from.instanceId, hashB, primeB);
        endpointCount++;
      }
      if (cable.to) {
        hashA = hashOccupancyValue(cable.to.instanceId, hashA, primeA);
        hashA = hashOccupancyValue(cable.to.portId, hashA, primeA);
        hashB = hashOccupancyValue(cable.to.portId, hashB, primeB);
        hashB = hashOccupancyValue(cable.to.instanceId, hashB, primeB);
        endpointCount++;
      }
    }

    deviceOccupancyChanged = cables.length !== cachedOccupancyCableCount ||
      endpointCount !== cachedOccupancyEndpointCount ||
      hashA !== cachedOccupancyHashA || hashB !== cachedOccupancyHashB;
    if (!deviceOccupancyChanged) return cachedDeviceOccupancy;

    const occupied = new Set();
    for (let index = 0; index < cables.length; index++) {
      const cable = cables[index];
      if (!cable) continue;
      if (cable.from) occupied.add(`${cable.from.instanceId}::${cable.from.portId}`);
      if (cable.to) occupied.add(`${cable.to.instanceId}::${cable.to.portId}`);
    }
    cachedDeviceOccupancy = occupied;
    cachedOccupancyCableCount = cables.length;
    cachedOccupancyEndpointCount = endpointCount;
    cachedOccupancyHashA = hashA;
    cachedOccupancyHashB = hashB;
    if (PixiContext.performanceTelemetry) PixiContext.performanceTelemetry.deviceOccupancySetRebuilds++;
    return cachedDeviceOccupancy;
  }

  function portTextures() {
    return RS.FaceplateTextures?.getPortTexture ? true : null;
  }

  function portTextureFor(port, isOccupied) {
    return RS.FaceplateTextures?.getPortTexture?.({ portType: port.type, occupied: !!isOccupied }) || null;
  }

  function portVariantKey(port, isOccupied) {
    return RS.FaceplateTextures?.portTextureKey?.(port, !!isOccupied) || 'copper';
  }

  function adjustDevicePortVariantCount(key, delta) {
    const next = Math.max(0, (devicePortVariantCounts.get(key) || 0) + delta);
    if (next) devicePortVariantCounts.set(key, next);
    else devicePortVariantCounts.delete(key);
  }

  function buildDevicePortSprites(ports, occupied) {
    if (!portTextures()) return;
    devicePortSprites.clear();
    devicePortOccupancy.clear();
    devicePortVariantCounts.clear();
    devicePortHitGrid.clear();
    const density = activeDeviceSceneLod === 'macro' ? 0.48 : 0.82;
    ports.forEach(port => {
      const key = `${port.instanceId}::${port.portId}`;
      const devEntry = deviceContainers.get(String(port.instanceId));
      if (!devEntry) return;
      const isOccupied = occupied.has(key);
      const texture = portTextureFor(port, isOccupied);
      if (!texture) return;
      const textureKey = portVariantKey(port, isOccupied);
      const sprite = new window.PIXI.Sprite(texture);
      sprite.anchor.set(0.5);
      const localX = (port.localX !== undefined) ? port.localX : (port.x - devEntry.originX);
      const localY = (port.localY !== undefined) ? port.localY : (port.y - devEntry.originY);
      sprite.position.set(localX, localY);
      sprite.width = Math.max(3, port.width * density);
      sprite.height = Math.max(3, port.height * density);
      sprite.eventMode = 'none';
      applyPortTint(sprite, key, port, isOccupied);
      devEntry.ports.addChild(sprite);
      devicePortSprites.set(key, sprite);
      devicePortOccupancy.set(key, isOccupied);
      addDevicePortToHitGrid({ ...port, localX, localY });
      adjustDevicePortVariantCount(textureKey, 1);
    });
  }

  function updateDevicePortOccupancy(ports, occupied) {
    if (!portTextures()) return 0;
    let changed = 0;
    ports.forEach(port => {
      const key = `${port.instanceId}::${port.portId}`;
      const isOccupied = occupied.has(key);
      if (devicePortOccupancy.get(key) === isOccupied) return;
      const sprite = devicePortSprites.get(key);
      if (!sprite) return;
      const previousTextureKey = portVariantKey(port, devicePortOccupancy.get(key));
      const nextTextureKey = portVariantKey(port, isOccupied);
      const texture = portTextureFor(port, isOccupied);
      if (texture) sprite.texture = texture;
      devicePortOccupancy.set(key, isOccupied);
      applyPortTint(sprite, key, port, isOccupied);
      adjustDevicePortVariantCount(previousTextureKey, -1);
      adjustDevicePortVariantCount(nextTextureKey, 1);
      changed++;
    });
    return changed;
  }

  function applyDeviceViewportCulling(minX, minY, maxX, maxY) {
    let visibleCount = 0;
    let culledCount = 0;
    deviceRackScenes.forEach(scene => {
      const bounds = scene.bounds;
      if (!bounds) {
        scene.container.visible = true;
        visibleCount++;
        return;
      }
      const visible = !(bounds.maxX < minX || bounds.minX > maxX || bounds.maxY < minY || bounds.minY > maxY);
      scene.container.visible = visible;
      if (visible) visibleCount++;
      else culledCount++;
    });
    if (PixiContext.performanceTelemetry) {
      PixiContext.performanceTelemetry.visibleDeviceRacks = visibleCount;
      PixiContext.performanceTelemetry.culledDeviceRacks = culledCount;
    }
  }

  function revealDeviceSprites() {
    deviceContainers.forEach(dev => {
      if (dev.chassis) dev.chassis.visible = true;
      if (dev.overlays) dev.overlays.visible = true;
      if (dev.ports) dev.ports.visible = true;
    });
  }

  function syncPixiDeviceSceneLOD(explicitLod) {
    const pixiApp = PixiContext.pixiApp;
    const deviceSceneContainer = PixiContext.deviceSceneContainer;
    if (!deviceSceneContainer || !pixiApp) return false;
    const lod = explicitLod || (RS.ZOOM_STATE?.scale < 0.35 ? 'macro' : 'detail');
    const presentationKey = `pixi:${lod}`;
    deviceSceneContainer.visible = true;
    document.documentElement.setAttribute('data-device-renderer', 'pixi');

    let snapshot = RS.DeviceSceneRegistry?.getSnapshot();
    if ((!snapshot || !snapshot.devices.length) && RS.DeviceSceneRegistry?.captureFromDom('pixi-device-scene')) {
      snapshot = RS.DeviceSceneRegistry.getSnapshot();
    }
    RS.DeviceSceneRegistry?.stripLiveFaceplates?.();
    if (!snapshot || !snapshot.devices.length) {
      destroyDeviceRackScenes();
      lastDeviceGeometrySignature = '';
      lastDevicePresentationKey = presentationKey;
      lastDeviceSceneSignature = `empty:${lod}`;
      return false;
    }
    activeDeviceSceneLod = lod;
    revealDeviceSprites();
    const geometrySignature = buildDeviceGeometrySignature(snapshot, lod);
    const occupied = collectDeviceOccupancy();
    const geometryChanged = geometrySignature !== lastDeviceGeometrySignature;
    const occupancyChanged = deviceOccupancyChanged;
    if (!geometryChanged && !occupancyChanged) {
      lastDevicePresentationKey = presentationKey;
      if (PixiContext.performanceTelemetry) PixiContext.performanceTelemetry.deviceSceneSkippedRebuilds++;
      return false;
    }

    if (geometryChanged) {
      buildDeviceChassis(snapshot.devices);
      if (PixiContext.performanceTelemetry) PixiContext.performanceTelemetry.deviceChassisRebuilds++;
      buildDevicePortSprites(snapshot.ports, occupied);
      if (PixiContext.performanceTelemetry) PixiContext.performanceTelemetry.devicePortRebuilds++;
    } else if (occupancyChanged) {
      const changedPorts = updateDevicePortOccupancy(snapshot.ports, occupied);
      if (PixiContext.performanceTelemetry) {
        PixiContext.performanceTelemetry.devicePortStateChanges += changedPorts;
        if (changedPorts) PixiContext.performanceTelemetry.deviceOccupancyOnlyUpdates++;
      }
    }
    revealDeviceSprites();
    syncPixiDeviceSelection();
    lastDeviceGeometrySignature = geometrySignature;
    lastDevicePresentationKey = presentationKey;
    lastDeviceSceneSignature = `${geometrySignature}|${cachedOccupancyCableCount}:${cachedOccupancyEndpointCount}:${cachedOccupancyHashA}:${cachedOccupancyHashB}`;
    if (geometryChanged && STATE.pixiViewportRendererV2 !== false) {
      const viewportBounds = PixiContext.getPixiWorldViewportBounds ? PixiContext.getPixiWorldViewportBounds(RS.ZOOM_STATE) : null;
      if (viewportBounds) applyDeviceViewportCulling(viewportBounds.minX, viewportBounds.minY, viewportBounds.maxX, viewportBounds.maxY);
    }
    if (PixiContext.performanceTelemetry) PixiContext.performanceTelemetry.deviceSceneRebuilds++;
    return true;
  }

  function invalidatePixiDeviceScene() {
    lastDeviceSceneSignature = null;
    lastDeviceGeometrySignature = null;
    lastDevicePresentationKey = null;
    cachedDeviceOccupancy = new Set();
    cachedOccupancyCableCount = -1;
    cachedOccupancyEndpointCount = -1;
    deviceOccupancyChanged = false;
  }

  function getDeviceContainer(instanceId) {
    return deviceContainers.get(String(instanceId))?.container || null;
  }

  function getDevicePosition(instanceId) {
    const dev = deviceContainers.get(String(instanceId));
    if (!dev) return null;
    return { x: dev.container.x, y: dev.container.y, originX: dev.originX, originY: dev.originY };
  }

  function setDevicePosition(instanceId, x, y) {
    const dev = deviceContainers.get(String(instanceId));
    if (!dev) return false;
    dev.container.position.set(x, y);
    return true;
  }

  function moveDeviceByOffset(instanceId, dx, dy) {
    const dev = deviceContainers.get(String(instanceId));
    if (!dev) return false;
    dev.container.position.set(dev.originX + dx, dev.originY + dy);
    return true;
  }

  function resetDevicePosition(instanceId) {
    const dev = deviceContainers.get(String(instanceId));
    if (!dev) return false;
    dev.container.position.set(dev.originX, dev.originY);
    return true;
  }

  function resetAllDevicePositions() {
    deviceContainers.forEach(dev => {
      dev.container.position.set(dev.originX, dev.originY);
    });
  }

  // Export to RackStudio namespace
  RS.syncPixiDeviceSceneLOD = syncPixiDeviceSceneLOD;
  RS.destroyDeviceRackScenes = destroyDeviceRackScenes;
  RS.getOrCreateDeviceRackScene = getOrCreateDeviceRackScene;
  RS.applyDeviceViewportCulling = applyDeviceViewportCulling;
  RS.hitDevicePortAt = hitDevicePortAt;
  RS.getDevicePortClientRect = getDevicePortClientRect;
  RS.dispatchDevicePortInteraction = dispatchDevicePortInteraction;
  RS.getDevicePortRoleColor = getDevicePortRoleColor;
  RS.restoreDevicePortTint = restoreDevicePortTint;
  RS.invalidatePixiDeviceScene = invalidatePixiDeviceScene;
  function getPixiPortPresentation(instanceId, portId) {
    const key = `${instanceId}::${portId}`;
    const sprite = devicePortSprites.get(key);
    if (!sprite) return null;
    return { tint: sprite.tint, occupied: devicePortOccupancy.get(key) === true };
  }

  RS.setHoveredDevicePortKey = (key) => { hoveredDevicePortKey = key; };
  RS.getHoveredDevicePortKey = () => hoveredDevicePortKey;
  RS.syncPixiDeviceSelection = syncPixiDeviceSelection;
  RS.setPixiDeviceHover = setPixiDeviceHover;
  RS.hitDeviceBodyAt = hitDeviceBodyAt;
  RS.toggleOrganizerCover = toggleOrganizerCover;
  RS.getPixiPortPresentation = getPixiPortPresentation;
  RS.collectDeviceOccupancy = collectDeviceOccupancy;
  RS.getPixiDeviceContainer = getDeviceContainer;
  RS.getPixiDevicePosition = getDevicePosition;
  RS.setPixiDevicePosition = setDevicePosition;
  RS.movePixiDeviceByOffset = moveDeviceByOffset;
  RS.resetPixiDevicePositions = resetAllDevicePositions;

  RS.PixiDeviceScene = {
    syncPixiDeviceSceneLOD,
    destroyDeviceRackScenes,
    destroyDeviceRackScene,
    prunePixiDevice,
    getOrCreateDeviceRackScene,
    applyDeviceViewportCulling,
    hitDevicePortAt,
    hitDeviceBodyAt,
    listDeviceFrames,
    syncPixiDeviceSelection,
    setPixiDeviceHover,
    toggleOrganizerCover,
    getPixiPortPresentation,
    getDevicePortClientRect,
    dispatchDevicePortInteraction,
    getDevicePortRoleColor,
    restoreDevicePortTint,
    invalidatePixiDeviceScene,
    collectDeviceOccupancy,
    getDeviceContainer,
    getDevicePosition,
    setDevicePosition,
    moveDeviceByOffset,
    resetDevicePosition,
    resetAllDevicePositions
  };

  PixiContext.deviceRackScenes = deviceRackScenes;
  PixiContext.deviceContainers = deviceContainers;
  PixiContext.devicePortSprites = devicePortSprites;
  PixiContext.devicePortOccupancy = devicePortOccupancy;
  PixiContext.hitDevicePortAt = hitDevicePortAt;
  PixiContext.hitDeviceBodyAt = hitDeviceBodyAt;
  PixiContext.listDeviceFrames = listDeviceFrames;
  PixiContext.dispatchDevicePortInteraction = dispatchDevicePortInteraction;
  PixiContext.syncPixiDeviceSceneLOD = syncPixiDeviceSceneLOD;
  PixiContext.destroyDeviceRackScenes = destroyDeviceRackScenes;
  PixiContext.destroyDeviceRackScene = destroyDeviceRackScene;
  PixiContext.prunePixiDevice = prunePixiDevice;
  PixiContext.applyDeviceViewportCulling = applyDeviceViewportCulling;
  PixiContext.getDevicePortVariantCounts = () => devicePortVariantCounts;
  PixiContext.getDeviceContainer = getDeviceContainer;
  PixiContext.getDevicePosition = getDevicePosition;
  PixiContext.setDevicePosition = setDevicePosition;
  PixiContext.moveDeviceByOffset = moveDeviceByOffset;
  PixiContext.resetDevicePositions = resetAllDevicePositions;
})();
