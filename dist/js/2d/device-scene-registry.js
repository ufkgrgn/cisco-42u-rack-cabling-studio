/**
 * Rack device scene geometry registry.
 *
 * This module is the boundary between DOM faceplates and the retained Pixi
 * scene. Port layouts are measured once per catalog faceplate, normalized,
 * then projected onto every mounted instance without per-port DOM reads.
 * Immutable snapshots are cached per generation so cable updates do not
 * repeatedly allocate device/port arrays or rescan already-detached faceplates.
 */
(function () {
  'use strict';

  const RS = window.RackStudio = window.RackStudio || {};
  const catalogTemplates = new Map();
  const deviceRecords = new Map();
  const portRecords = new Map();
  const deviceElements = new Map();
  const detachedFaceplates = new Map();
  const detachedPortAreas = new Map();
  let generation = 0;
  let lastCaptureReason = 'init';
  let snapshotCache = null;
  let suspendedGeneration = -1;

  const stats = {
    captures: 0,
    deviceRectReads: 0,
    templatePortRectReads: 0,
    projectedPorts: 0,
    templateHits: 0,
    templateMisses: 0,
    snapshotBuilds: 0,
    snapshotCacheHits: 0,
    faceplateSuspendScans: 0,
    faceplateSuspendSkips: 0,
    portAreaSuspendScans: 0,
    detachedPortAreas: 0
  };

  function endpointKey(instanceId, portId) {
    return `${String(instanceId || '')}::${String(portId || '')}`;
  }

  function getViewportTransform() {
    const host = document.getElementById('viewport-canvas') ||
      document.getElementById('rack-container') ||
      document.getElementById('rack-stage');
    if (!host) return null;
    const rect = host.getBoundingClientRect();
    const camera = RS.ZOOM_STATE || {};
    const scale = Number(camera.scale) || 1;
    return {
      left: rect.left,
      top: rect.top,
      panX: Number(camera.panX) || 0,
      panY: Number(camera.panY) || 0,
      scale
    };
  }

  function clientToWorld(clientX, clientY, transform) {
    return {
      x: (clientX - transform.left - transform.panX) / transform.scale,
      y: (clientY - transform.top - transform.panY) / transform.scale
    };
  }

  function buildTemplate(deviceEl, deviceRect, catalogKey) {
    const ports = new Map();
    const portEls = deviceEl.querySelectorAll('.port[data-port-id]');
    const safeWidth = Math.max(1, deviceRect.width);
    const safeHeight = Math.max(1, deviceRect.height);

    portEls.forEach(portEl => {
      const rect = portEl.getBoundingClientRect();
      stats.templatePortRectReads++;
      ports.set(String(portEl.dataset.portId), Object.freeze({
        nx: (rect.left + rect.width / 2 - deviceRect.left) / safeWidth,
        ny: (rect.top + rect.height / 2 - deviceRect.top) / safeHeight,
        nw: rect.width / safeWidth,
        nh: rect.height / safeHeight,
        name: portEl.dataset.portName || '',
        type: portEl.dataset.portType || '',
        speed: portEl.dataset.portSpeed || ''
      }));
    });

    const template = Object.freeze({ catalogKey, ports });
    catalogTemplates.set(catalogKey, template);
    stats.templateMisses++;
    return template;
  }

  function captureFromDom(reason) {
    const transform = getViewportTransform();
    if (!transform) return false;

    const nextDevices = new Map();
    const nextPorts = new Map();
    const nextElements = new Map();
    const elements = document.querySelectorAll('.mounted-device[data-catalog-key]');

    elements.forEach(deviceEl => {
      const instanceId = deviceEl.dataset.instanceId || deviceEl.id;
      const catalogKey = deviceEl.dataset.catalogKey || '';
      if (!instanceId || !catalogKey) return;
      nextElements.set(instanceId, deviceEl);

      const rect = deviceEl.getBoundingClientRect();
      stats.deviceRectReads++;
      if (rect.width <= 0 || rect.height <= 0) return;

      let template = catalogTemplates.get(catalogKey);
      if (!template) template = buildTemplate(deviceEl, rect, catalogKey);
      else stats.templateHits++;

      const topLeft = clientToWorld(rect.left, rect.top, transform);
      const bottomRight = clientToWorld(rect.right, rect.bottom, transform);
      const width = bottomRight.x - topLeft.x;
      const height = bottomRight.y - topLeft.y;
      const deviceRecord = Object.freeze({
        instanceId,
        rackId: deviceEl.dataset.rackId || '',
        catalogKey,
        category: deviceEl.dataset.category || '',
        preserveDomPorts: false,
        x: topLeft.x,
        y: topLeft.y,
        width,
        height
      });
      nextDevices.set(instanceId, deviceRecord);

      template.ports.forEach((port, portId) => {
        const worldPort = Object.freeze({
          instanceId,
          portId,
          catalogKey,
          category: deviceEl.dataset.category || '',
          name: port.name,
          type: port.type,
          speed: port.speed,
          preserveDom: false,
          x: topLeft.x + width * port.nx,
          y: topLeft.y + height * port.ny,
          width: width * port.nw,
          height: height * port.nh
        });
        nextPorts.set(endpointKey(instanceId, portId), worldPort);
        stats.projectedPorts++;
      });
    });

    deviceRecords.clear();
    nextDevices.forEach((value, key) => deviceRecords.set(key, value));
    portRecords.clear();
    nextPorts.forEach((value, key) => portRecords.set(key, value));
    deviceElements.clear();
    nextElements.forEach((value, key) => deviceElements.set(key, value));
    detachedPortAreas.forEach((entry, instanceId) => {
      if (!entry.owner.isConnected || deviceElements.get(instanceId) !== entry.owner) detachedPortAreas.delete(instanceId);
    });
    detachedFaceplates.forEach((entry, instanceId) => {
      if (!entry.owner.isConnected || deviceElements.get(instanceId) !== entry.owner) detachedFaceplates.delete(instanceId);
    });
    generation++;
    snapshotCache = null;
    stats.captures++;
    lastCaptureReason = reason || 'render';
    return true;
  }

  function pruneDevice(instanceId) {
    if (!instanceId) return;
    const id = String(instanceId);
    deviceRecords.delete(id);
    deviceElements.delete(id);
    detachedFaceplates.delete(id);
    detachedPortAreas.delete(id);
    for (const [key, port] of portRecords) {
      if (port.instanceId === id) {
        portRecords.delete(key);
      }
    }
    generation++;
    snapshotCache = null;
  }

  function invalidate(options) {
    deviceRecords.clear();
    portRecords.clear();
    deviceElements.clear();
    detachedFaceplates.clear();
    detachedPortAreas.clear();
    snapshotCache = null;
    suspendedGeneration = -1;
    if (options?.templates) catalogTemplates.clear();
    generation++;
  }

  function getPortPoint(instanceId, portId) {
    return portRecords.get(endpointKey(instanceId, portId)) || null;
  }

  function getDeviceRecord(instanceId) {
    return deviceRecords.get(String(instanceId || '')) || null;
  }

  function getSnapshot() {
    if (snapshotCache) {
      stats.snapshotCacheHits++;
      return snapshotCache;
    }
    snapshotCache = Object.freeze({
      generation,
      reason: lastCaptureReason,
      devices: Object.freeze(Array.from(deviceRecords.values())),
      ports: Object.freeze(Array.from(portRecords.values()))
    });
    stats.snapshotBuilds++;
    return snapshotCache;
  }

  function suspendDomFaceplates() {
    if (suspendedGeneration === generation) {
      stats.faceplateSuspendSkips++;
      return detachedFaceplates.size;
    }
    stats.faceplateSuspendScans++;

    detachedFaceplates.forEach((entry, instanceId) => {
      if (!entry.owner.isConnected || deviceElements.get(instanceId) !== entry.owner) {
        if (entry.owner.isConnected && !entry.owner.querySelector('.device-faceplate')) {
          entry.owner.appendChild(entry.element);
        }
        detachedFaceplates.delete(instanceId);
      }
    });

    deviceRecords.forEach((record, instanceId) => {
      const deviceEl = deviceElements.get(instanceId);
      if (!deviceEl) return;
      const category = record.category || '';
      if (category === 'organizer' || category === 'blank') return;
      if (detachedFaceplates.has(instanceId)) return;
      const faceplate = Array.from(deviceEl.children).find(child => child.classList?.contains('device-faceplate'));
      if (!faceplate) return;
      detachedFaceplates.set(instanceId, { owner: deviceEl, element: faceplate });
      faceplate.remove();
    });
    suspendedGeneration = generation;
    return detachedFaceplates.size;
  }

  function restoreDomFaceplates() {
    let restored = 0;
    detachedFaceplates.forEach((entry, instanceId) => {
      if (entry.owner.isConnected && !entry.owner.querySelector('.device-faceplate')) {
        entry.owner.appendChild(entry.element);
        restored++;
      }
      detachedFaceplates.delete(instanceId);
    });
    suspendedGeneration = -1;
    return restored;
  }

  function suspendDomPortAreas(instanceIds) {
    stats.portAreaSuspendScans++;
    const targets = instanceIds ? Array.from(instanceIds, id => [id, deviceRecords.get(id)]).filter(([, record]) => record) : Array.from(deviceRecords.entries());
    targets.forEach(([instanceId, record]) => {
      if (!['switch', 'fiber-switch', 'compact', 'router'].includes(record.category)) return;
      const owner = deviceElements.get(instanceId);
      if (!owner || detachedPortAreas.has(instanceId)) return;
      const portArea = owner.querySelector(':scope > .device-faceplate > .ports-area');
      if (!portArea) return;
      const placeholder = document.createElement('div');
      placeholder.className = `${portArea.className} pixi-port-area-placeholder`;
      placeholder.setAttribute('aria-hidden', 'true');
      placeholder.style.visibility = 'hidden';
      portArea.replaceWith(placeholder);
      detachedPortAreas.set(instanceId, { owner, element: portArea, placeholder });
    });
    stats.detachedPortAreas = detachedPortAreas.size;
    return detachedPortAreas.size;
  }

  function refreshDeviceOwners(elements) {
    const changed = [];
    for (const owner of elements || []) {
      if (!owner?.isConnected) continue;
      const instanceId = owner.dataset.instanceId || owner.id;
      if (!instanceId || !deviceRecords.has(instanceId)) continue;
      if (deviceElements.get(instanceId) === owner) continue;
      deviceElements.set(instanceId, owner);
      changed.push(instanceId);
    }
    detachedPortAreas.forEach((entry, instanceId) => {
      if (!entry.owner.isConnected || deviceElements.get(instanceId) !== entry.owner) detachedPortAreas.delete(instanceId);
    });
    stats.detachedPortAreas = detachedPortAreas.size;
    return changed;
  }

  function restoreDomPortAreas() {
    let restored = 0;
    detachedPortAreas.forEach((entry, instanceId) => {
      if (entry.owner.isConnected && entry.placeholder.isConnected && entry.placeholder.parentNode) {
        entry.placeholder.replaceWith(entry.element);
        restored++;
      }
      detachedPortAreas.delete(instanceId);
    });
    stats.detachedPortAreas = detachedPortAreas.size;
    return restored;
  }

  RS.DeviceSceneRegistry = Object.freeze({
    captureFromDom,
    pruneDevice,
    invalidate,
    getPortPoint,
    getDeviceRecord,
    getSnapshot,
    suspendDomFaceplates,
    restoreDomFaceplates,
    suspendDomPortAreas,
    restoreDomPortAreas,
    refreshDeviceOwners,
    getStats: () => ({ ...stats, generation, templates: catalogTemplates.size, detachedFaceplates: detachedFaceplates.size, detachedPortAreas: detachedPortAreas.size })
  });
})();
