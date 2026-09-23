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

  const DEVICE_CHASSIS_STYLES = Object.freeze({
    router: Object.freeze({ key: 'router', fill: 0x0f172a, accent: 0x0284c7 }),
    switch: Object.freeze({ key: 'switch', fill: 0x131a2a, accent: 0x38bdf8 }),
    patch: Object.freeze({ key: 'patch', fill: 0x17191d, accent: 0xf97316 }),
    fiber: Object.freeze({ key: 'fiber', fill: 0x111827, accent: 0xa855f7 }),
    power: Object.freeze({ key: 'power', fill: 0x17251d, accent: 0x22c55e }),
    default: Object.freeze({ key: 'default', fill: 0x111827, accent: 0x64748b })
  });

  const DEVICE_PORT_HIT_CELL_SIZE = 32;
  const EMPTY_CABLE_LIST = Object.freeze([]);
  const hitTestPoint = { x: 0, y: 0 };

  let deviceChassisAtlas = null;
  let deviceChassisTextures = null;
  const deviceRackScenes = new Map();
  const deviceRackByInstance = new Map();
  const deviceContainers = new Map();
  let devicePortAtlas = null;
  let devicePortTextures = null;
  const devicePortSprites = new Map();
  const devicePortOccupancy = new Map();
  const devicePortVariantCounts = new Map();
  const devicePortHitGrid = new Map();

  let hoveredDevicePortKey = null;
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

  function deviceSceneStyle(category) {
    if (category === 'router') return DEVICE_CHASSIS_STYLES.router;
    if (category === 'patch') return DEVICE_CHASSIS_STYLES.patch;
    if (category === 'fiber') return DEVICE_CHASSIS_STYLES.fiber;
    if (category === 'pdu' || category === 'power') return DEVICE_CHASSIS_STYLES.power;
    if (category === 'switch' || category === 'fiber-switch' || category === 'compact') return DEVICE_CHASSIS_STYLES.switch;
    return DEVICE_CHASSIS_STYLES.default;
  }

  function ensureDeviceChassisTextures() {
    const pixiApp = PixiContext.pixiApp;
    if (deviceChassisTextures || !pixiApp?.renderer || !window.PIXI?.Texture) return deviceChassisTextures;
    const styles = Object.values(DEVICE_CHASSIS_STYLES);
    const cell = 32;
    const atlasGraphics = new window.PIXI.Graphics();
    styles.forEach((style, index) => {
      atlasGraphics.roundRect(index * cell + 0.5, 0.5, cell - 1, cell - 1, 4)
        .fill(style.fill)
        .stroke({ width: 1, color: 0x334155, alpha: 1 });
    });
    deviceChassisAtlas = pixiApp.renderer.generateTexture({ target: atlasGraphics, resolution: 2, antialias: true });
    atlasGraphics.destroy();
    const Texture = window.PIXI.Texture;
    const Rectangle = window.PIXI.Rectangle;
    deviceChassisTextures = Object.fromEntries(styles.map((style, index) => [
      style.key,
      new Texture({
        source: deviceChassisAtlas.source,
        frame: new Rectangle(index * cell, 0, cell, cell),
        label: `rack-device-chassis-${style.key}`
      })
    ]));
    if (PixiContext.performanceTelemetry) PixiContext.performanceTelemetry.deviceChassisAtlasBuilds++;
    return deviceChassisTextures;
  }

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

  function restoreDevicePortTint(key) {
    const sprite = devicePortSprites.get(key);
    if (!sprite) return;
    const pending = STATE.pendingConnection;
    const isSelected = pending && `${pending.instanceId}::${pending.portId}` === key;
    if (isSelected || key === hoveredDevicePortKey) {
      sprite.tint = 0x67e8f9;
    } else {
      const parts = key.split('::');
      const roleColor = getDevicePortRoleColor(parts[0], parts[1]);
      sprite.tint = roleColor !== null ? roleColor : 0xffffff;
    }
    PixiContext.renderPixi?.('device-port-hover');
  }

  function buildDeviceChassis(devices, lod = 'macro') {
    const textures = ensureDeviceChassisTextures();
    if (!textures) return;
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
      portsContainer.position.set(0, 0);
      portsContainer.eventMode = 'passive';

      let chassisSprite = null;
      let overlays = null;

      if (device.category !== 'organizer' && device.category !== 'blank') {
        const style = deviceSceneStyle(device.category);
        chassisSprite = new window.PIXI.NineSliceSprite({
          texture: textures[style.key],
          leftWidth: 4,
          rightWidth: 4,
          topHeight: 4,
          bottomHeight: 4,
          width: device.width,
          height: device.height
        });
        chassisSprite.position.set(0, 0);
        chassisSprite.eventMode = 'none';
        chassisSprite.visible = lod === 'macro';

        overlays = new window.PIXI.Graphics();
        overlays.rect(0, 0, Math.min(4, device.width * 0.012), device.height).fill(style.accent);
        overlays.rect(8, 3, Math.min(60, device.width * 0.14), Math.max(2, device.height - 6))
          .fill({ color: 0x0b1726, alpha: 0.92 });
        overlays.visible = lod === 'macro';

        devContainer.addChild(chassisSprite, overlays);
        spriteCount++;
      }

      devContainer.addChild(portsContainer);
      scene.container.addChild(devContainer);

      deviceContainers.set(String(device.instanceId), {
        container: devContainer,
        chassis: chassisSprite,
        overlays,
        ports: portsContainer,
        device,
        originX: device.x,
        originY: device.y,
        width: device.width,
        height: device.height
      });
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

  function ensureDevicePortTextures() {
    const pixiApp = PixiContext.pixiApp;
    if (devicePortTextures || !pixiApp?.renderer || !window.PIXI?.Texture) return devicePortTextures;
    const cell = 20;
    const atlasGraphics = new window.PIXI.Graphics();
    const styles = [
      { key: 'copper', shape: 'copper', fill: 0x07111f, stroke: 0x64748b, detail: 0x334155 },
      { key: 'optic', shape: 'optic', fill: 0x0b1324, stroke: 0x60a5fa, detail: 0x1d4ed8 },
      { key: 'fiber-lc', shape: 'lc', fill: 0x100f26, stroke: 0xa78bfa, detail: 0x818cf8 },
      { key: 'fiber-sc', shape: 'sc', fill: 0x100f26, stroke: 0xc084fc, detail: 0xa855f7 },
      { key: 'power', shape: 'power', fill: 0x101b17, stroke: 0x4ade80, detail: 0x166534 },
      { key: 'occupied', shape: 'copper', fill: 0x08212a, stroke: 0x22d3ee, detail: 0x67e8f9 },
      { key: 'occupied-optic', shape: 'optic', fill: 0x08212a, stroke: 0x22d3ee, detail: 0x67e8f9 },
      { key: 'occupied-fiber-lc', shape: 'lc', fill: 0x08212a, stroke: 0x22d3ee, detail: 0x67e8f9 },
      { key: 'occupied-fiber-sc', shape: 'sc', fill: 0x08212a, stroke: 0x22d3ee, detail: 0x67e8f9 },
      { key: 'occupied-power', shape: 'power', fill: 0x08212a, stroke: 0x22d3ee, detail: 0x67e8f9 }
    ];
    styles.forEach((style, index) => {
      const x = index * cell;
      atlasGraphics.roundRect(x + 1, 2, cell - 2, cell - 4, 3)
        .fill(style.fill)
        .stroke({ width: 1, color: style.stroke, alpha: 1 });
      if (style.shape === 'copper') {
        atlasGraphics.rect(x + 4, 6, 2, 3).fill(style.detail);
        atlasGraphics.rect(x + 7, 6, 2, 3).fill(style.detail);
        atlasGraphics.rect(x + 10, 6, 2, 3).fill(style.detail);
        atlasGraphics.rect(x + 13, 6, 2, 3).fill(style.detail);
        atlasGraphics.rect(x + 5, 12, 10, 2).fill(style.detail);
      } else if (style.shape === 'optic') {
        atlasGraphics.roundRect(x + 4, 5, 12, 10, 2).fill(style.detail);
        atlasGraphics.rect(x + 6, 7, 8, 2).fill(style.stroke);
        atlasGraphics.rect(x + 8, 12, 4, 2).fill(style.fill);
      } else if (style.shape === 'lc') {
        atlasGraphics.roundRect(x + 3, 5, 14, 10, 2).fill(style.detail);
        atlasGraphics.rect(x + 9, 5, 1, 10).fill(style.stroke);
        atlasGraphics.rect(x + 5, 8, 3, 4).fill(style.fill);
        atlasGraphics.rect(x + 12, 8, 3, 4).fill(style.fill);
      } else if (style.shape === 'sc') {
        atlasGraphics.roundRect(x + 3, 5, 14, 10, 2).fill(style.detail);
        atlasGraphics.roundRect(x + 5, 7, 4, 6, 1).fill(style.fill);
        atlasGraphics.roundRect(x + 11, 7, 4, 6, 1).fill(style.fill);
      } else if (style.shape === 'power') {
        atlasGraphics.circle(x + 7, 10, 2.4).fill(style.detail);
        atlasGraphics.circle(x + 13, 10, 2.4).fill(style.detail);
        atlasGraphics.circle(x + 7, 10, 0.9).fill(style.fill);
        atlasGraphics.circle(x + 13, 10, 0.9).fill(style.fill);
      }
    });
    devicePortAtlas = pixiApp.renderer.generateTexture({ target: atlasGraphics, resolution: 2, antialias: true });
    atlasGraphics.destroy();
    if (PixiContext.performanceTelemetry) PixiContext.performanceTelemetry.devicePortAtlasBuilds++;
    const Texture = window.PIXI.Texture;
    const Rectangle = window.PIXI.Rectangle;
    devicePortTextures = Object.fromEntries(styles.map((style, index) => [
      style.key,
      new Texture({
        source: devicePortAtlas.source,
        frame: new Rectangle(index * cell, 0, cell, cell),
        label: `rack-device-port-${style.key}`
      })
    ]));
    return devicePortTextures;
  }

  function devicePortTextureKey(port, isOccupied) {
    const type = String(port.type || '').toLowerCase();
    let variant = 'copper';
    if (type === 'lc') variant = 'fiber-lc';
    else if (type === 'sc') variant = 'fiber-sc';
    else if (type === 'power') variant = 'power';
    else if (['sfp', 'sfp+', 'qsfp28'].includes(type)) variant = 'optic';
    if (!isOccupied) return variant;
    if (variant === 'copper') return 'occupied';
    if (variant === 'optic') return 'occupied-optic';
    return `occupied-${variant}`;
  }

  function adjustDevicePortVariantCount(key, delta) {
    const next = Math.max(0, (devicePortVariantCounts.get(key) || 0) + delta);
    if (next) devicePortVariantCounts.set(key, next);
    else devicePortVariantCounts.delete(key);
  }

  function buildDevicePortSprites(ports, occupied) {
    const textures = ensureDevicePortTextures();
    if (!textures) return;
    devicePortSprites.clear();
    devicePortOccupancy.clear();
    devicePortVariantCounts.clear();
    devicePortHitGrid.clear();
    ports.forEach(port => {
      if (port.category === 'organizer' || port.category === 'blank') return;
      if (activeDeviceSceneLod === 'detail' && (
        !['switch', 'fiber-switch', 'compact', 'router'].includes(port.category)
      )) return;
      const key = `${port.instanceId}::${port.portId}`;
      const devEntry = deviceContainers.get(String(port.instanceId));
      if (!devEntry) return;
      const isOccupied = occupied.has(key);
      const textureKey = devicePortTextureKey(port, isOccupied);
      const width = Math.max(3, port.width * 0.82);
      const height = Math.max(3, port.height * 0.82);
      const sprite = new window.PIXI.Sprite(textures[textureKey]);
      sprite.anchor.set(0.5);
      const localX = (port.localX !== undefined) ? port.localX : (port.x - devEntry.originX);
      const localY = (port.localY !== undefined) ? port.localY : (port.y - devEntry.originY);
      sprite.position.set(localX, localY);
      sprite.width = width;
      sprite.height = height;
      sprite.eventMode = 'none';
      const roleColor = getDevicePortRoleColor(port.instanceId, port.portId);
      const pending = STATE.pendingConnection;
      const isSelected = pending && `${pending.instanceId}::${pending.portId}` === key;
      if (isSelected || key === hoveredDevicePortKey) {
        sprite.tint = 0x67e8f9;
      } else if (roleColor !== null && !isOccupied) {
        sprite.tint = roleColor;
      }
      devEntry.ports.addChild(sprite);
      devicePortSprites.set(key, sprite);
      devicePortOccupancy.set(key, isOccupied);
      const hitRecord = { ...port, localX, localY };
      addDevicePortToHitGrid(hitRecord);
      adjustDevicePortVariantCount(textureKey, 1);
    });
  }

  function updateDevicePortOccupancy(ports, occupied) {
    const textures = ensureDevicePortTextures();
    if (!textures) return 0;
    let changed = 0;
    ports.forEach(port => {
      if (port.category === 'organizer' || port.category === 'blank') return;
      const key = `${port.instanceId}::${port.portId}`;
      const isOccupied = occupied.has(key);
      if (devicePortOccupancy.get(key) === isOccupied) return;
      const sprite = devicePortSprites.get(key);
      if (sprite) {
        const previousTextureKey = devicePortTextureKey(port, devicePortOccupancy.get(key));
        const nextTextureKey = devicePortTextureKey(port, isOccupied);
        sprite.texture = textures[nextTextureKey];
        devicePortOccupancy.set(key, isOccupied);
        const roleColor = getDevicePortRoleColor(port.instanceId, port.portId);
        const pending = STATE.pendingConnection;
        const isSelected = pending && `${pending.instanceId}::${pending.portId}` === key;
        if (isSelected || key === hoveredDevicePortKey) {
          sprite.tint = 0x67e8f9;
        } else if (roleColor !== null && !isOccupied) {
          sprite.tint = roleColor;
        } else {
          sprite.tint = 0xffffff;
        }
        adjustDevicePortVariantCount(previousTextureKey, -1);
        adjustDevicePortVariantCount(nextTextureKey, 1);
        changed++;
      }
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

  function syncPixiDeviceSceneLOD(explicitLod) {
    const pixiApp = PixiContext.pixiApp;
    const deviceSceneContainer = PixiContext.deviceSceneContainer;
    if (!deviceSceneContainer || !pixiApp) return false;
    const lod = explicitLod || (RS.ZOOM_STATE?.scale < 0.35 ? 'macro' : 'detail');
    const enabled = STATE.cableRenderMode === 'pixi';
    const presentationKey = `${STATE.cableRenderMode}:${lod}`;
    const presentationChanged = presentationKey !== lastDevicePresentationKey;
    deviceSceneContainer.visible = enabled;
    if (!enabled) {
      RS.DeviceSceneRegistry?.restoreDomFaceplates();
      RS.DeviceSceneRegistry?.restoreDomPortAreas();
      lastDevicePresentationKey = presentationKey;
      lastDeviceGeometrySignature = '';
      document.documentElement.setAttribute('data-device-renderer', STATE.cableRenderMode === 'pixi' ? 'pixi' : 'dom');
      lastDeviceSceneSignature = `hidden:${lod}`;
      return false;
    }

    if (presentationChanged) {
      RS.DeviceSceneRegistry?.restoreDomFaceplates();
      RS.DeviceSceneRegistry?.restoreDomPortAreas();
    }

    let snapshot = RS.DeviceSceneRegistry?.getSnapshot();
    if ((!snapshot || !snapshot.devices.length) && RS.DeviceSceneRegistry?.captureFromDom('pixi-device-scene')) {
      snapshot = RS.DeviceSceneRegistry.getSnapshot();
    }
    if (!snapshot || !snapshot.devices.length) {
      destroyDeviceRackScenes();
      lastDeviceGeometrySignature = '';
      lastDevicePresentationKey = presentationKey;
      lastDeviceSceneSignature = `empty:${lod}`;
      return false;
    }
    activeDeviceSceneLod = lod;
    deviceContainers.forEach(dev => {
      if (dev.chassis) dev.chassis.visible = lod === 'macro';
      if (dev.overlays) dev.overlays.visible = lod === 'macro';
      if (dev.ports) dev.ports.visible = true;
    });
    const geometrySignature = buildDeviceGeometrySignature(snapshot, lod);
    const occupied = collectDeviceOccupancy();
    const geometryChanged = geometrySignature !== lastDeviceGeometrySignature;
    const occupancyChanged = deviceOccupancyChanged;
    if (!geometryChanged && !occupancyChanged) {
      if (lod === 'macro') {
        RS.DeviceSceneRegistry?.restoreDomPortAreas();
        RS.DeviceSceneRegistry?.suspendDomFaceplates();
      } else {
        RS.DeviceSceneRegistry?.restoreDomFaceplates();
        RS.DeviceSceneRegistry?.suspendDomPortAreas();
      }
      document.documentElement.setAttribute('data-device-renderer', 'pixi');
      lastDevicePresentationKey = presentationKey;
      if (PixiContext.performanceTelemetry) PixiContext.performanceTelemetry.deviceSceneSkippedRebuilds++;
      return false;
    }

    if (geometryChanged) {
      buildDeviceChassis(snapshot.devices, lod);
      if (PixiContext.performanceTelemetry) PixiContext.performanceTelemetry.deviceChassisRebuilds++;
    }

    if (geometryChanged) {
      buildDevicePortSprites(snapshot.ports, occupied);
      if (PixiContext.performanceTelemetry) PixiContext.performanceTelemetry.devicePortRebuilds++;
    } else if (occupancyChanged) {
      const changedPorts = updateDevicePortOccupancy(snapshot.ports, occupied);
      if (PixiContext.performanceTelemetry) {
        PixiContext.performanceTelemetry.devicePortStateChanges += changedPorts;
        if (changedPorts) PixiContext.performanceTelemetry.deviceOccupancyOnlyUpdates++;
      }
    }
    deviceContainers.forEach(dev => {
      if (dev.chassis) dev.chassis.visible = lod === 'macro';
      if (dev.overlays) dev.overlays.visible = lod === 'macro';
      if (dev.ports) dev.ports.visible = true;
    });
    document.documentElement.setAttribute('data-device-renderer', 'pixi');
    if (lod === 'macro') {
      RS.DeviceSceneRegistry?.restoreDomPortAreas();
      RS.DeviceSceneRegistry?.suspendDomFaceplates();
    } else {
      RS.DeviceSceneRegistry?.restoreDomFaceplates();
      RS.DeviceSceneRegistry?.suspendDomPortAreas();
    }
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
  RS.setHoveredDevicePortKey = (key) => { hoveredDevicePortKey = key; };
  RS.getHoveredDevicePortKey = () => hoveredDevicePortKey;
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
