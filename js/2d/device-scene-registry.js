/**
 * Rack device scene geometry registry.
 *
 * This module is the boundary between DOM faceplates and the retained Pixi
 * scene. Port layouts are measured once per catalog faceplate, normalized,
 * then projected onto every mounted instance without per-port DOM reads.
 * Later Pixi-only faceplates can publish the same records without creating DOM.
 */
(function () {
  'use strict';

  const RS = window.RackStudio = window.RackStudio || {};
  const catalogTemplates = new Map();
  const deviceRecords = new Map();
  const portRecords = new Map();
  let generation = 0;
  let lastCaptureReason = 'init';

  const stats = {
    captures: 0,
    deviceRectReads: 0,
    templatePortRectReads: 0,
    projectedPorts: 0,
    templateHits: 0,
    templateMisses: 0
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
    const elements = document.querySelectorAll('.mounted-device[data-catalog-key]');

    elements.forEach(deviceEl => {
      const instanceId = deviceEl.dataset.instanceId || deviceEl.id;
      const catalogKey = deviceEl.dataset.catalogKey || '';
      if (!instanceId || !catalogKey) return;

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
    generation++;
    stats.captures++;
    lastCaptureReason = reason || 'render';
    return true;
  }

  function invalidate(options) {
    deviceRecords.clear();
    portRecords.clear();
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
    return Object.freeze({
      generation,
      reason: lastCaptureReason,
      devices: Array.from(deviceRecords.values()),
      ports: Array.from(portRecords.values())
    });
  }

  RS.DeviceSceneRegistry = Object.freeze({
    captureFromDom,
    invalidate,
    getPortPoint,
    getDeviceRecord,
    getSnapshot,
    getStats: () => ({ ...stats, generation, templates: catalogTemplates.size })
  });
})();
