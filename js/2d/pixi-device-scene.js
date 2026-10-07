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
    if (!PixiContext.deviceSceneContainer?.visible || RS.StudioView?.isOverview()) return null;
    const rect = PixiContext.getPixiCanvasRect?.();
    if (!rect?.width || !rect?.height) return null;
    const point = PixiContext.clientToRenderer ? PixiContext.clientToRenderer(clientX, clientY, rect, hitTestPoint) : hitTestPoint;
    const scale = Math.max(0.05, Number(RS.ZOOM_STATE?.scale) || 1);
    const isConnecting = !!STATE.pendingConnection;
    const baseTolerance = (scale < 0.35 ? 8 : 2.5) / scale;
    const tolerance = isConnecting ? Math.max(6 / scale, baseTolerance * 1.5) : Math.max(2, baseTolerance);
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
          const radius = Math.max(tolerance, Math.max(port.width, port.height) * (isConnecting ? 0.95 : 0.65));
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
    const rack = (STATE.racks && STATE.racks.find(r => r.devices && r.devices.some(d => d.instanceId === instanceId || d.id === instanceId))) || getActiveRack();
    const dev = (instanceIdOrDev && typeof instanceIdOrDev === 'object') ? instanceIdOrDev : rack?.devices?.find(d => d.instanceId === instanceId || d.id === instanceId);
    if (!dev?.portsConfig) return null;
    const pIdStr = String(portId || '');
    let cfg = dev.portsConfig[pIdStr];
    if (cfg === undefined) {
      const aliases = RS.getPortAliases ? RS.getPortAliases(portId) : [pIdStr];
      for (let i = 0; i < aliases.length; i++) {
        if (dev.portsConfig[aliases[i]] !== undefined) {
          cfg = dev.portsConfig[aliases[i]];
          break;
        }
      }
    }
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
    if (isSelected) {
      sprite.tint = 0x38bdf8;
      return;
    }
    if (key === hoveredDevicePortKey) {
      sprite.tint = pending ? 0x00f0ff : 0x67e8f9;
      return;
    }
    const roleColor = port ? getDevicePortRoleColor(port.instanceId, port.portId) : null;
    if (roleColor !== null) {
      sprite.tint = roleColor;
      return;
    }
    if (isOccupied) {
      sprite.tint = 0x22c55e;
      return;
    }
    sprite.tint = 0xffffff;
  }

  function updateDevicePortTints(targetInstanceId) {
    const target = targetInstanceId ? String(targetInstanceId) : null;
    devicePortSprites.forEach((sprite, key) => {
      const parts = key.split('::');
      if (target && parts[0] !== target) return;
      const occupied = devicePortOccupancy.get(key) === true;
      applyPortTint(sprite, key, { instanceId: parts[0], portId: parts[1] }, occupied);
    });
    PixiContext.renderPixi?.('port-tints-updated');
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
    const w = entry.width, h = entry.height;
    const isLight = ['light', 'high-contrast'].includes(document.documentElement.getAttribute('data-theme'));

    // In light theme, draw a crisp metallic chassis chamfer edge & shadow outline
    if (isLight) {
      graphics.rect(0, 0, w, 1).fill({ color: 0xffffff, alpha: 0.35 });
      graphics.rect(0, h - 1, w, 1).fill({ color: 0x0f172a, alpha: 0.65 });
      graphics.rect(0, 0, 1, h).fill({ color: 0x475569, alpha: 0.65 });
      graphics.rect(w - 1, 0, 1, h).fill({ color: 0x475569, alpha: 0.65 });
    }

    if (selected || hovered) {
      const color = multi ? 0xa855f7 : (isLight ? 0x0284c7 : 0x38bdf8);
      const alpha = hovered ? 0.75 : 1;
      if (selected) graphics.rect(1, 1, w - 2, h - 2).stroke({ width: 2, color, alpha: 0.9 });
      const arm = Math.max(5, Math.min(12, w * 0.045, h * 0.42));
      const t = Math.max(1.5, Math.min(2.4, h * 0.08));
      const bars = [
        [0, 0, arm, t], [0, 0, t, arm], [w - arm, 0, arm, t], [w - t, 0, t, arm],
        [0, h - t, arm, t], [0, h - arm, t, arm], [w - arm, h - t, arm, t], [w - t, h - arm, t, arm]
      ];
      bars.forEach(([x, y, bw, bh]) => graphics.rect(x, y, bw, bh).fill({ color, alpha }));
    }

    // Paint crisp safety-orange separators between patch panel port groups
    const isPatch = entry.device.category === 'patch' || /patch/i.test(entry.device.catalogKey || '');
    if (isPatch && !RS.StudioView?.isOverview()) {
      const cat = RS.resolveCatalogItem ? RS.resolveCatalogItem(entry.device.catalogKey) : null;
      if (cat?.ports && cat.ports.length > 1) {
        for (let i = 0; i < cat.ports.length - 1; i++) {
          const p1 = cat.ports[i];
          const p2 = cat.ports[i + 1];
          if (p1.group !== undefined && p2.group !== undefined && p1.group !== p2.group) {
            const s1 = devicePortSprites.get(`${id}::${p1.id}`);
            const s2 = devicePortSprites.get(`${id}::${p2.id}`);
            if (s1 && s2) {
              const sepX = (s1.x + s2.x) / 2;
              graphics.rect(sepX - 0.75, 6, 1.5, 20).fill({ color: 0xea580c, alpha: 0.95 });
            }
          }
        }
      }
    }

    // Option 4: Switch Port Block Separator Lines (12'li / 8'li bloklar & Uplink ayraçları)
    if (!isPatch && !RS.StudioView?.isOverview()) {
      const cat = RS.resolveCatalogItem ? RS.resolveCatalogItem(entry.device.catalogKey) : null;
      if (cat?.ports && cat.ports.length >= 24) {
        const primaryPorts = cat.ports.filter(p => p.type === 'rj45' || !String(p.id).startsWith('up'));
        const uplinkPorts = cat.ports.filter(p => p.type === 'sfp' || p.type === 'sfp+' || String(p.id).startsWith('up'));

        const boundaries = [];
        if (primaryPorts.length >= 48) {
          boundaries.push(['p12', 'p13'], ['p24', 'p25'], ['p36', 'p37']);
        } else if (primaryPorts.length >= 24) {
          boundaries.push(['p12', 'p13']);
        }
        if (primaryPorts.length > 0 && uplinkPorts.length > 0) {
          const lastPri = primaryPorts[primaryPorts.length - 1];
          const firstUp = uplinkPorts[0];
          boundaries.push([lastPri.id, firstUp.id]);
        }

        boundaries.forEach(([id1, id2]) => {
          const s1 = devicePortSprites.get(`${id}::${id1}`);
          const s2 = devicePortSprites.get(`${id}::${id2}`);
          if (s1 && s2) {
            const sepX = (s1.x + s2.x) / 2;
            const topY = Math.min(s1.y, s2.y) - (s1.height || 10) / 2 - 3;
            const botY = Math.max(s1.y, s2.y) + (s1.height || 10) / 2 + 3;
            const isUplinkSep = uplinkPorts.some(u => u.id === id2);
            if (isUplinkSep) {
              // Uplink separation bar: vivid cyan accent with metallic rim
              graphics.rect(sepX - 0.75, topY, 1.5, botY - topY).fill({ color: isLight ? 0x0284c7 : 0x38bdf8, alpha: 0.95 });
            } else {
              // Standard 12-port block silkscreen separator
              graphics.rect(sepX - 0.6, topY, 1.2, botY - topY).fill({ color: isLight ? 0x94a3b8 : 0x64748b, alpha: 0.85 });
              graphics.rect(sepX + 0.6, topY, 0.6, botY - topY).fill({ color: 0xffffff, alpha: isLight ? 0.35 : 0.18 });
            }
          }
        });
      }
    }

    // Option 3: Vivid Active Link LEDs and Role Badges on Ports
    if (!RS.StudioView?.isOverview()) {
      devicePortSprites.forEach((s, key) => {
        const [devId, portId] = key.split('::');
        if (devId !== id) return;
        const isOccupied = devicePortOccupancy.get(key) === true;
        const isOptic = s.texture?.label?.includes('optic') || s.texture?.label?.includes('fiber');

        if (isOccupied) {
          // Brilliant active link LED with glowing aura
          const ledX = s.x - s.width / 2 + 2.5;
          const ledY = s.y - s.height / 2 + 2.5;
          const ledColor = isOptic ? 0x00d2ff : 0x22c55e;
          const coreColor = isOptic ? 0xe0f2fe : 0xbbf7d0;

          // Glowing aura halo
          graphics.circle(ledX, ledY, 2.2).fill({ color: ledColor, alpha: 0.35 });
          // Vivid link LED core
          graphics.circle(ledX, ledY, 1.2).fill({ color: ledColor, alpha: 0.95 });
          graphics.circle(ledX, ledY, 0.6).fill({ color: coreColor, alpha: 1.0 });
        }

        // High-contrast role indicator badge if port has a configured role
        const roleColor = getDevicePortRoleColor(devId, portId);
        if (roleColor !== null) {
          // Subtle glowing accent ring around port with role color
          const px = s.x - s.width / 2;
          const py = s.y - s.height / 2;
          graphics.roundRect(px - 0.5, py - 0.5, s.width + 1, s.height + 1, 1.5)
            .stroke({ width: 1.2, color: roleColor, alpha: 0.85 });
        }
      });
    }

    const pending = STATE?.pendingConnection;
    if (pending && String(pending.instanceId) === id) {
      const s = devicePortSprites.get(`${id}::${pending.portId}`);
      if (s) {
        const px = s.x - s.width / 2, py = s.y - s.height / 2, pw = s.width, ph = s.height;
        graphics.roundRect(px - 1.5, py - 1.5, pw + 3, ph + 3, 2.5).fill({ color: 0x00e5ff, alpha: 0.22 }).stroke({ width: 1.5, color: 0x00e5ff, alpha: 0.95 });
        graphics.roundRect(px - 0.5, py - 0.5, pw + 1, ph + 1, 1.5).stroke({ width: 1, color: 0xffffff, alpha: 0.95 });
      }
    }

    if (hoveredDevicePortKey) {
      const [hDevId, hPortId] = hoveredDevicePortKey.split('::');
      if (hDevId === id && (!pending || String(pending.portId) !== hPortId)) {
        const s = devicePortSprites.get(hoveredDevicePortKey);
        if (s) {
          graphics.roundRect(s.x - s.width / 2 - 1, s.y - s.height / 2 - 1, s.width + 2, s.height + 2, 2)
            .fill({ color: 0x38bdf8, alpha: 0.15 }).stroke({ width: 1, color: 0x38bdf8, alpha: 0.9 });
        }
      }
    }
  }

  function syncPixiDeviceSelection(options) {
    const selectedId = document.querySelector('.mounted-device.studio-selected')?.id;
    if (selectedId) RS.showDeviceFloatingControls?.(selectedId);
    else RS.hideDeviceFloatingControls?.(true);
    deviceContainers.forEach(entry => paintDeviceChrome(entry));
    if (!options || options.render !== false) PixiContext.renderPixi?.('device-selection');
  }

  function setPixiDeviceHover(instanceId) {
    const next = instanceId ? String(instanceId) : null;
    if (next === hoveredDeviceId) return false;
    const previous = hoveredDeviceId;
    hoveredDeviceId = next;
    if (previous) {
      const prevEl = document.getElementById(previous);
      if (prevEl) prevEl.classList.remove('pixi-hovered');
      if (deviceContainers.get(previous)) paintDeviceChrome(deviceContainers.get(previous));
    }
    if (next) {
      const nextEl = document.getElementById(next);
      if (nextEl) nextEl.classList.add('pixi-hovered');
      if (deviceContainers.get(next)) paintDeviceChrome(deviceContainers.get(next));
    }
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

      const portLabels = new window.PIXI.Container();
      portLabels.label = `device-port-labels-${device.instanceId}`;
      portLabels.eventMode = 'none';

      const { chassis: chassisSprite, overlays } = RS.PixiDeviceChassis.create(device, deviceCoverOpen(device.instanceId));
      if (chassisSprite) devContainer.addChild(chassisSprite);
      if (overlays) devContainer.addChild(overlays);
      if (chassisSprite || overlays) spriteCount++;

      const macroContainer = RS.DeviceLayoutPresentation.createPixiLayer(device);

      const chrome = new window.PIXI.Graphics();
      chrome.eventMode = 'none';
      devContainer.addChild(portsContainer, portLabels, macroContainer, chrome);
      scene.container.addChild(devContainer);
      const entry = {
        container: devContainer,
        chassis: chassisSprite,
        overlays,
        chrome,
        ports: portsContainer,
        portLabels,
        macroLabel: macroContainer,
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

  function buildDeviceGeometrySignature(snapshot) {
    const theme = document.documentElement.getAttribute('data-theme') || 'dark';
    return `${theme}|${snapshot.generation}|${snapshot.devices.length}|${snapshot.ports.length}`;
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

  const portNumberTextureCache = new Map();

  function getPortNumberTexture(text, isLight) {
    const key = `${isLight ? 'light' : 'dark'}:${text}`;
    if (portNumberTextureCache.has(key)) return portNumberTextureCache.get(key);
    if (!window.PIXI?.Texture) return null;

    const dpr = 2;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const fontSize = 7.5;
    ctx.font = `bold ${fontSize * dpr}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif`;
    const metrics = ctx.measureText(text);
    const textW = Math.ceil(metrics.width);
    const textH = Math.ceil(fontSize * dpr * 1.2);
    const w = Math.max(12 * dpr, textW + 4 * dpr);
    const h = Math.max(9 * dpr, textH + 2 * dpr);
    canvas.width = w;
    canvas.height = h;

    ctx.font = `bold ${fontSize * dpr}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const cx = w / 2;
    const cy = h / 2;

    if (isLight) {
      // Light theme: dark charcoal text with white halo for maximum contrast on light chassis
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.lineWidth = 2.2 * dpr;
      ctx.lineJoin = 'round';
      ctx.strokeText(text, cx, cy);
      ctx.fillStyle = '#0f172a';
      ctx.fillText(text, cx, cy);
    } else {
      // Dark theme: brilliant white silkscreen text with deep black halo for maximum contrast on dark chassis
      ctx.strokeStyle = '#02040a';
      ctx.lineWidth = 2.2 * dpr;
      ctx.lineJoin = 'round';
      ctx.strokeText(text, cx, cy);
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(text, cx, cy);
    }

    const texture = window.PIXI.Texture.from(canvas);
    portNumberTextureCache.set(key, texture);
    return texture;
  }

  function getPortDisplayLabel(port) {
    const name = String(port.name || '').trim();
    const id = String(port.portId || port.id || '').trim();
    // 1. Try trailing number in name (e.g. "GigabitEthernet1/0/24" -> "24", "Port 12" -> "12", "SFP+ 2" -> "2")
    const nameMatch = name.match(/(\d+)$/);
    if (nameMatch) return nameMatch[1];
    // 2. Try trailing number in id (e.g. "p24" -> "24", "pt-12" -> "12", "port-1" -> "1")
    const idMatch = id.match(/(\d+)$/);
    if (idMatch) return idMatch[1];
    // 3. Fallbacks for special ports
    if (/mgmt|management/i.test(name || id)) return 'M';
    if (/console/i.test(name || id)) return 'C';
    return (name || id).slice(0, 3);
  }

  function updatePortLabelsVisibility() {
    const scale = Number(RS.ZOOM_STATE?.scale) || 1;
    const overview = RS.StudioView?.isOverview() || activeDeviceSceneLod === 'macro';
    const userEnabled = STATE.portNumbersVisible !== false;
    const showLabels = userEnabled && !overview && scale >= 0.65;
    let anyChanged = false;
    deviceContainers.forEach(dev => {
      if (dev.portLabels && dev.portLabels.visible !== showLabels) {
        dev.portLabels.visible = showLabels;
        anyChanged = true;
      }
    });
    return anyChanged;
  }

  function buildDevicePortSprites(ports, occupied) {
    if (!portTextures()) return;
    devicePortSprites.clear();
    devicePortOccupancy.clear();
    devicePortVariantCounts.clear();
    devicePortHitGrid.clear();
    // Clear previous port label sprites
    deviceContainers.forEach(dev => {
      if (dev.portLabels) dev.portLabels.removeChildren();
    });

    const isLight = ['light', 'high-contrast'].includes(document.documentElement.getAttribute('data-theme'));
    // Port silhouettes must not jump between LOD tiers during zoom.
    const density = 1;

    // Group ports by device to compute row geometry (minY, maxY, midY)
    const portsByDevice = new Map();
    ports.forEach(port => {
      const devId = String(port.instanceId);
      if (!portsByDevice.has(devId)) portsByDevice.set(devId, []);
      portsByDevice.get(devId).push(port);
    });

    portsByDevice.forEach((devPorts, devId) => {
      const devEntry = deviceContainers.get(devId);
      if (!devEntry) return;

      let minY = Infinity, maxY = -Infinity;
      const portLocals = devPorts.map(port => {
        const lx = (port.localX !== undefined) ? port.localX : (port.x - devEntry.originX);
        const ly = (port.localY !== undefined) ? port.localY : (port.y - devEntry.originY);
        if (ly < minY) minY = ly;
        if (ly > maxY) maxY = ly;
        return { port, localX: lx, localY: ly };
      });

      const isMultiRow = (maxY - minY) > 5;
      const midY = (minY + maxY) / 2;

      portLocals.forEach(({ port, localX, localY }) => {
        const key = `${port.instanceId}::${port.portId}`;
        const isOccupied = occupied.has(key);
        const texture = portTextureFor(port, isOccupied);
        if (!texture) return;
        const textureKey = portVariantKey(port, isOccupied);

        // --- Hardware Port Silhouette Sprite ---
        const sprite = new window.PIXI.Sprite(texture);
        sprite.anchor.set(0.5);
        sprite.position.set(localX, localY);
        // Maintain authentic physical square aspect ratio for hardware ports (never stretch into oblong rectangles)
        const isOptic = port.type === 'sfp' || port.type === 'sfp+' || port.type === 'qsfp28';
        const baseHeight = Math.max(8, Math.min(13, (port.height && port.height > 6) ? port.height : 10.5));
        const spriteH = baseHeight * density;
        const spriteW = spriteH * (isOptic ? 1.08 : 1.0);
        sprite.width = Math.round(spriteW);
        sprite.height = Math.round(spriteH);
        sprite.eventMode = 'none';
        applyPortTint(sprite, key, port, isOccupied);
        devEntry.ports.addChild(sprite);
        devicePortSprites.set(key, sprite);
        devicePortOccupancy.set(key, isOccupied);
        addDevicePortToHitGrid({ ...port, localX, localY });
        adjustDevicePortVariantCount(textureKey, 1);

        // --- High-Contrast Port Number Sprite (Zoom-Activated) ---
        const labelText = getPortDisplayLabel(port);
        if (labelText && devEntry.portLabels) {
          const numTex = getPortNumberTexture(labelText, isLight);
          if (numTex) {
            const numSprite = new window.PIXI.Sprite(numTex);
            numSprite.anchor.set(0.5, 0.5);
            numSprite.width = Math.round(numTex.width / 2);
            numSprite.height = Math.round(numTex.height / 2);

            let labelY;
            if (isMultiRow) {
              if (localY < midY) {
                // Top row (odd ports): silkscreen above the port
                labelY = localY - (sprite.height / 2) - (numSprite.height / 2) - 1;
                if (labelY < numSprite.height / 2 + 1) labelY = numSprite.height / 2 + 1;
              } else {
                // Bottom row (even ports): silkscreen below the port
                labelY = localY + (sprite.height / 2) + (numSprite.height / 2) + 1;
                if (labelY > devEntry.height - numSprite.height / 2 - 1) labelY = devEntry.height - numSprite.height / 2 - 1;
              }
            } else {
              // Single row (e.g. patch panel): above if room, else below
              if (localY >= 18) {
                labelY = localY - (sprite.height / 2) - (numSprite.height / 2) - 1;
                if (labelY < numSprite.height / 2 + 1) labelY = numSprite.height / 2 + 1;
              } else {
                labelY = localY + (sprite.height / 2) + (numSprite.height / 2) + 1;
              }
            }

            numSprite.position.set(localX, Math.round(labelY));
            numSprite.eventMode = 'none';
            devEntry.portLabels.addChild(numSprite);
          }
        }
      });
    });

    updatePortLabelsVisibility();
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
    if (changed) {
      deviceContainers.forEach(entry => paintDeviceChrome(entry));
    }
    return changed;
  }

  function applyDeviceViewportCulling(minX, minY, maxX, maxY) {
    if (updatePortLabelsVisibility()) PixiContext.renderPixi?.('port-labels-culling');
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
    const overview = RS.StudioView?.isOverview() || activeDeviceSceneLod === 'macro';
    deviceContainers.forEach(dev => {
      if (dev.chassis) dev.chassis.visible = !overview;
      if (dev.overlays) dev.overlays.visible = !overview;
      if (dev.ports) dev.ports.visible = !overview;
      if (dev.macroLabel) dev.macroLabel.visible = overview;
    });
    updatePortLabelsVisibility();
  }

  function syncPixiDeviceSceneLOD(explicitLod) {
    const pixiApp = PixiContext.pixiApp;
    const deviceSceneContainer = PixiContext.deviceSceneContainer;
    if (!deviceSceneContainer || !pixiApp) return false;
    const lod = RS.StudioView?.isOverview() ? 'macro' : 'detail';
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
    const geometrySignature = buildDeviceGeometrySignature(snapshot);
    const presentationChanged = presentationKey !== lastDevicePresentationKey;
    const needsPorts = lod !== 'macro' && snapshot.ports.length > 0 && devicePortSprites.size === 0;
    const occupied = collectDeviceOccupancy();
    const geometryChanged = geometrySignature !== lastDeviceGeometrySignature;
    const occupancyChanged = deviceOccupancyChanged;
    if (!geometryChanged && !occupancyChanged && !presentationChanged && !needsPorts) {
      lastDevicePresentationKey = presentationKey;
      if (PixiContext.performanceTelemetry) PixiContext.performanceTelemetry.deviceSceneSkippedRebuilds++;
      return false;
    }

    if (geometryChanged) {
      buildDeviceChassis(snapshot.devices);
      if (PixiContext.performanceTelemetry) PixiContext.performanceTelemetry.deviceChassisRebuilds++;
      if (lod !== 'macro') {
        buildDevicePortSprites(snapshot.ports, occupied);
        if (PixiContext.performanceTelemetry) PixiContext.performanceTelemetry.devicePortRebuilds++;
      }
    } else if (needsPorts) {
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
    syncPixiDeviceSelection({ render: false });
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
    portNumberTextureCache.clear();
  }

  const getDeviceContainer = (id) => deviceContainers.get(String(id))?.container || null;
  const getDevicePosition = (id) => { const dev = deviceContainers.get(String(id)); return dev ? { x: dev.container.x, y: dev.container.y, originX: dev.originX, originY: dev.originY } : null; };
  const setDevicePosition = (id, x, y) => { const dev = deviceContainers.get(String(id)); if (!dev) return false; dev.container.position.set(x, y); return true; };
  const moveDeviceByOffset = (id, dx, dy) => { const dev = deviceContainers.get(String(id)); if (!dev) return false; dev.container.position.set(dev.originX + dx, dev.originY + dy); return true; };
  const resetDevicePosition = (id) => { const dev = deviceContainers.get(String(id)); if (!dev) return false; dev.container.position.set(dev.originX, dev.originY); return true; };
  const resetAllDevicePositions = () => { deviceContainers.forEach(dev => dev.container.position.set(dev.originX, dev.originY)); };
  const refreshPixiPortHighlights = () => {
    deviceContainers.forEach(entry => paintDeviceChrome(entry));
    updateDevicePortTints();
    PixiContext.renderPixi?.('port-highlights');
  };

  // Export to RackStudio namespace
  RS.syncPixiDeviceSceneLOD = syncPixiDeviceSceneLOD;
  RS.destroyDeviceRackScenes = destroyDeviceRackScenes;
  RS.getOrCreateDeviceRackScene = getOrCreateDeviceRackScene;
  RS.applyDeviceViewportCulling = applyDeviceViewportCulling;
  RS.hitDevicePortAt = hitDevicePortAt;
  RS.getDevicePortClientRect = getDevicePortClientRect;
  RS.dispatchDevicePortInteraction = dispatchDevicePortInteraction;
  RS.getDevicePortRoleColor = getDevicePortRoleColor;
  RS.updateDevicePortTints = updateDevicePortTints;
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
  RS.hitDeviceChassisAt = hitDeviceBodyAt;
  RS.updatePixiDeviceSelection = syncPixiDeviceSelection;
  RS.refreshPixiPortHighlights = refreshPixiPortHighlights;
  RS.syncPixiDeviceScenes = syncPixiDeviceSceneLOD;
  RS.syncPortLabelsVisibility = updatePortLabelsVisibility;

  RS.PixiDeviceScene = {
    syncPixiDeviceSceneLOD, syncPixiDeviceScenes: syncPixiDeviceSceneLOD,
    destroyDeviceRackScenes, destroyDeviceRackScene, prunePixiDevice,
    getOrCreateDeviceRackScene, applyDeviceViewportCulling,
    hitDevicePortAt, hitDeviceBodyAt, listDeviceFrames,
    syncPixiDeviceSelection, setPixiDeviceHover, toggleOrganizerCover,
    getPixiPortPresentation, getDevicePortClientRect, dispatchDevicePortInteraction,
    getDevicePortRoleColor, updateDevicePortTints, restoreDevicePortTint,
    invalidatePixiDeviceScene, collectDeviceOccupancy,
    getDeviceContainer, getDevicePosition, setDevicePosition, moveDeviceByOffset,
    resetDevicePosition, resetAllDevicePositions,
    syncPortLabelsVisibility: updatePortLabelsVisibility
  };
  PixiContext.deviceRackScenes = deviceRackScenes;
  PixiContext.deviceContainers = deviceContainers;
  PixiContext.devicePortSprites = devicePortSprites;
  PixiContext.devicePortOccupancy = devicePortOccupancy;
  PixiContext.hitDevicePortAt = hitDevicePortAt;
  PixiContext.syncPixiDeviceScenes = syncPixiDeviceSceneLOD;
  PixiContext.syncPixiDeviceSceneLOD = syncPixiDeviceSceneLOD;
  PixiContext.destroyDeviceRackScenes = destroyDeviceRackScenes;
  PixiContext.invalidatePixiDeviceScene = invalidatePixiDeviceScene;
  PixiContext.hitDeviceBodyAt = hitDeviceBodyAt;
  PixiContext.listDeviceFrames = listDeviceFrames;
  PixiContext.dispatchDevicePortInteraction = dispatchDevicePortInteraction;
  PixiContext.destroyDeviceRackScene = destroyDeviceRackScene;
  PixiContext.prunePixiDevice = prunePixiDevice;
  PixiContext.applyDeviceViewportCulling = applyDeviceViewportCulling;
  PixiContext.getDevicePortVariantCounts = () => devicePortVariantCounts;
  PixiContext.getDeviceContainer = getDeviceContainer;
  PixiContext.getDevicePosition = getDevicePosition;
  PixiContext.setDevicePosition = setDevicePosition;
  PixiContext.moveDeviceByOffset = moveDeviceByOffset;
  PixiContext.resetDevicePositions = resetAllDevicePositions;
  PixiContext.syncPortLabelsVisibility = updatePortLabelsVisibility;
})();
