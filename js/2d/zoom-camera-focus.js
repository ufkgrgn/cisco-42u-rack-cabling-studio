/**
 * Cisco Enterprise Rack & Cabling Studio - Camera Focus Module
 * Handles smooth animated camera focusing on specific racks, mounted devices,
 * or cable pathways within the 2D rack canvas.
 */
(function () {
  'use strict';

  const RS = window.RackStudio = window.RackStudio || {};

  function focusOnRack(rackId, options = {}) {
    const canvas = RS.dom?.viewportCanvas;
    if (!canvas) return;
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    if (cw <= 0 || ch <= 0) return;

    const targetRackId = rackId || RS.STATE?.activeRackId || RS.getActiveRack()?.id;
    const targetRack = (RS.STATE?.racks || []).find(r => r.id === targetRackId) || RS.getActiveRack();
    if (!targetRack) return;

    const rackEl = document.getElementById(`rack-container-${targetRack.id}`) || document.getElementById('rack-container');
    let worldX = 0;
    let worldY = 0;
    const rackW = 634;
    const rackH = (targetRack.heightU || 42) * 32 + 84;

    if (rackEl && RS.dom?.rackStage) {
      const stageRect = RS.dom.rackStage.getBoundingClientRect();
      const rackRect = rackEl.getBoundingClientRect();
      const currentScale = RS.ZOOM_STATE.scale || 1.0;
      worldX = (rackRect.left - stageRect.left) / currentScale;
      worldY = (rackRect.top - stageRect.top) / currentScale;
    } else if (RS.STATE?.viewMode === 'multi' && RS.STATE?.racks) {
      const idx = RS.STATE.racks.findIndex(r => r.id === targetRack.id);
      if (idx >= 0) {
        worldX = idx * (634 + 64);
      }
    }

    const paddingX = options.paddingX || 60;
    const paddingY = options.paddingY || 60;
    const scaleX = (cw - paddingX * 2) / rackW;
    const scaleY = (ch - paddingY * 2) / rackH;

    let targetScale = Math.min(scaleX, scaleY);
    targetScale = Math.max(RS.ZOOM_STATE.minScale, Math.min(options.maxScale || 1.15, targetScale));

    const targetPanX = (cw / 2) - (worldX + rackW / 2) * targetScale;
    const targetPanY = (ch / 2) - (worldY + rackH / 2) * targetScale + (20 * targetScale);

    if (RS.animateCameraTo) {
      RS.animateCameraTo(targetScale, targetPanX, targetPanY, {
        duration: options.duration || 400,
        easing: 'easeOutCubic',
        isFit: false,
        onComplete: options.onComplete
      });
    }
  }

  function focusOnDevice(instanceId, options = {}) {
    const canvas = RS.dom?.viewportCanvas;
    if (!canvas || !instanceId) return;
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    if (cw <= 0 || ch <= 0) return;

    let devEl = document.querySelector(`[data-instance-id="${instanceId}"]`);
    if (!devEl) {
      const allRacks = RS.STATE?.racks || [];
      const foundRack = allRacks.find(r => (r.devices || []).some(d => d.instanceId === instanceId));
      if (foundRack && foundRack.id !== RS.STATE?.activeRackId && RS.switchActiveRack) {
        RS.switchActiveRack(foundRack.id);
        devEl = document.querySelector(`[data-instance-id="${instanceId}"]`);
      }
    }
    if (!devEl || !RS.dom?.rackStage) return;

    const stageRect = RS.dom.rackStage.getBoundingClientRect();
    const devRect = devEl.getBoundingClientRect();
    const currentScale = RS.ZOOM_STATE.scale || 1.0;

    const devWorldX = (devRect.left - stageRect.left) / currentScale;
    const devWorldY = (devRect.top - stageRect.top) / currentScale;
    const devWorldW = devRect.width / currentScale;
    const devWorldH = devRect.height / currentScale;

    const targetScale = Math.min(1.3, Math.max(0.95, Math.min((cw - 120) / devWorldW, (ch * 0.45) / Math.max(devWorldH, 60))));

    const targetPanX = (cw / 2) - (devWorldX + devWorldW / 2) * targetScale;
    const targetPanY = (ch / 2) - (devWorldY + devWorldH / 2) * targetScale;

    devEl.classList.add('device-focused');
    setTimeout(() => devEl?.classList.remove('device-focused'), 1600);

    if (RS.animateCameraTo) {
      RS.animateCameraTo(targetScale, targetPanX, targetPanY, {
        duration: options.duration || 420,
        easing: 'easeOutQuart',
        onComplete: options.onComplete
      });
    }
  }

  function focusOnCable(cableId, options = {}) {
    const canvas = RS.dom?.viewportCanvas;
    if (!canvas || !cableId) return;
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    if (cw <= 0 || ch <= 0) return;

    const cable = (RS.STATE?.cables || []).find(c => c.id === cableId);
    if (!cable) return;

    const fromEl = document.querySelector(`.port[data-instance-id="${cable.from?.instanceId}"][data-port-id="${cable.from?.portId}"]`);
    const toEl = document.querySelector(`.port[data-instance-id="${cable.to?.instanceId}"][data-port-id="${cable.to?.portId}"]`);
    const fromPoint = RS.DeviceSceneRegistry?.getPortPoint(cable.from?.instanceId, cable.from?.portId);
    const toPoint = RS.DeviceSceneRegistry?.getPortPoint(cable.to?.instanceId, cable.to?.portId);
    const cablePath = document.querySelector(`.cable-path[data-cable-id="${cableId}"]`);

    if (cablePath) {
      document.querySelectorAll('.cable-path.highlighted').forEach(p => p.classList.remove('highlighted'));
      cablePath.classList.add('highlighted');
    }

    if (!fromEl && !toEl && !fromPoint && !toPoint && !cablePath) return;

    const stageRect = RS.dom.rackStage.getBoundingClientRect();
    const currentScale = RS.ZOOM_STATE.scale || 1.0;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    [fromEl, toEl, cablePath].filter(Boolean).forEach(el => {
      const r = el.getBoundingClientRect();
      const wx1 = (r.left - stageRect.left) / currentScale;
      const wy1 = (r.top - stageRect.top) / currentScale;
      const wx2 = (r.right - stageRect.left) / currentScale;
      const wy2 = (r.bottom - stageRect.top) / currentScale;
      minX = Math.min(minX, wx1);
      minY = Math.min(minY, wy1);
      maxX = Math.max(maxX, wx2);
      maxY = Math.max(maxY, wy2);
    });
    [fromEl ? null : fromPoint, toEl ? null : toPoint].filter(Boolean).forEach(point => {
      minX = Math.min(minX, point.x - point.width / 2);
      minY = Math.min(minY, point.y - point.height / 2);
      maxX = Math.max(maxX, point.x + point.width / 2);
      maxY = Math.max(maxY, point.y + point.height / 2);
    });

    minX -= 40;
    maxX += 40;
    minY -= 30;
    maxY += 30;

    const spanW = Math.max(120, maxX - minX);
    const spanH = Math.max(80, maxY - minY);

    const scaleX = (cw - 120) / spanW;
    const scaleY = (ch - 120) / spanH;
    let targetScale = Math.min(scaleX, scaleY);
    targetScale = Math.max(RS.ZOOM_STATE.minScale, Math.min(1.2, targetScale));

    const centerX = minX + spanW / 2;
    const centerY = minY + spanH / 2;

    const targetPanX = (cw / 2) - centerX * targetScale;
    const targetPanY = (ch / 2) - centerY * targetScale;

    if (RS.animateCameraTo) {
      RS.animateCameraTo(targetScale, targetPanX, targetPanY, {
        duration: options.duration || 450,
        easing: 'easeOutCubic',
        onComplete: options.onComplete
      });
    }
  }

  RS.focusOnRack = focusOnRack;
  RS.focusOnDevice = focusOnDevice;
  RS.focusOnCable = focusOnCable;
})();
