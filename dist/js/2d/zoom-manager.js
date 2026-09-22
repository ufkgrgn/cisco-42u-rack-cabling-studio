/**
 * Cisco Enterprise Rack & Cabling Studio - Pan & Zoom Canvas Module
 */
(function () {
  'use strict';

  const RS = window.RackStudio = window.RackStudio || {};

  let stageTransitionBound = false;
  let lastTransitionValue = null;
  let lastTransformValue = null;
  let lastZoomBadgeValue = null;
  let pixiResolutionRefreshTimer = null;
  const CAMERA_FRAME_INTERVAL_MS = 1000 / 60;
  const cameraPerformanceTelemetry = {
    panFrameCommits: 0,
    panFramePacingSkips: 0
  };

  function schedulePixiResolutionRefresh(scale, delay = 220) {
    if (pixiResolutionRefreshTimer) clearTimeout(pixiResolutionRefreshTimer);
    pixiResolutionRefreshTimer = setTimeout(() => {
      pixiResolutionRefreshTimer = null;
      if (RS.ZOOM_STATE?.isPanning || RS.ZOOM_STATE?.isFocusing || RS.dom?.rackStage?.classList.contains('zooming-active')) {
        schedulePixiResolutionRefresh(RS.ZOOM_STATE?.scale || scale, delay);
        return;
      }
      RS.setPixiInteractionMode?.(false);
      RS.updatePixiResolutionForZoom?.(scale);
    }, delay);
  }

  function ensureStageTransitionListener() {
    if (stageTransitionBound || !RS.dom?.rackStage) return;
    RS.dom.rackStage.addEventListener('transitionend', (e) => {
      // The cable SVG is a child of rackStage, so it follows the same CSS
      // transform. Rebuilding cable geometry here only duplicates browser work.
      if (e.propertyName === 'transform') RS.dom.rackStage.style.transition = 'none';
    });
    stageTransitionBound = true;
  }

  let lastDispatchedScale = null;
  function updateStageTransform(smooth = false) {
    if (!RS.dom?.rackStage) return;
    ensureStageTransitionListener();

    const transitionValue = smooth ? 'transform 0.25s cubic-bezier(0.2, 0.8, 0.25, 1)' : 'none';
    if (transitionValue !== lastTransitionValue) {
      RS.dom.rackStage.style.transition = transitionValue;
      lastTransitionValue = transitionValue;
    }
    const transformValue = `translate3d(${RS.ZOOM_STATE.panX}px, ${RS.ZOOM_STATE.panY}px, 0) scale(${RS.ZOOM_STATE.scale})`;
    if (transformValue !== lastTransformValue) {
      RS.dom.rackStage.style.transform = transformValue;
      lastTransformValue = transformValue;
    }
    RS.setPixiInteractionMode?.(true, true);
    RS.syncRackViewportVisibility?.(RS.ZOOM_STATE);
    RS.syncPixiViewportCamera?.(RS.ZOOM_STATE);
    const zoomBadgeValue = `${Math.round(RS.ZOOM_STATE.scale * 100)}%`;
    if (RS.dom.zoomBadge && zoomBadgeValue !== lastZoomBadgeValue) {
      RS.dom.zoomBadge.textContent = zoomBadgeValue;
      lastZoomBadgeValue = zoomBadgeValue;
    }
    // Resize the Pixi backing buffer once the gesture/animation settles so
    // high zoom stays sharp without reallocating GPU surfaces on every frame.
    schedulePixiResolutionRefresh(RS.ZOOM_STATE.scale);

    // Dynamic 2D Level of Detail (LOD) tiering
    const currentLod = RS.ZOOM_STATE.scale < 0.35 ? 'macro' : 'detail';
    if (RS.dom.rackStage.getAttribute('data-lod') !== currentLod) {
      RS.dom.rackStage.setAttribute('data-lod', currentLod);
    }
  }

  function fitRackToScreen(smooth = true) {
    const canvas = RS.dom?.viewportCanvas;
    if (!canvas) return;
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    if (cw <= 0 || ch <= 0) return;

    const activeRack = RS.getActiveRack ? RS.getActiveRack() : null;
    let rackW = 634; // 618px inner content + 16px border
    let rackH = (activeRack?.heightU || 42) * 32 + 84; // 1344px inner content + 84px header canopy/margin

    const isMulti = RS.STATE && RS.STATE.viewMode === 'multi' && RS.STATE.racks && RS.STATE.racks.length > 1;
    if (isMulti) {
      const numRacks = RS.STATE.racks.length;
      rackW = numRacks * 634 + (numRacks - 1) * 64 + 120;
      const maxU = Math.max(...RS.STATE.racks.map(r => r.heightU || 42));
      rackH = maxU * 32 + 84;
    }

    const paddingX = 48;
    const paddingY = 48;
    const scaleX = (cw - paddingX * 2) / rackW;
    const scaleY = (ch - paddingY * 2) / rackH;

    let targetScale = Math.min(scaleX, scaleY);
    targetScale = Math.max(RS.ZOOM_STATE.minScale, Math.min(RS.ZOOM_STATE.maxScale, targetScale));

    const targetPanX = (cw - rackW * targetScale) / 2;
    const targetPanY = (ch - rackH * targetScale) / 2 + (66 * targetScale);

    if (smooth) {
      animateCameraTo(targetScale, targetPanX, targetPanY, {
        duration: 250,
        easing: 'easeInOutCubic',
        isFit: true
      });
    } else {
      RS.ZOOM_STATE.scale = parseFloat(targetScale.toFixed(3));
      RS.ZOOM_STATE.panX = Math.round(targetPanX);
      RS.ZOOM_STATE.panY = Math.round(targetPanY);
      RS.ZOOM_STATE.isFit = true;
      updateStageTransform(false);
      scheduleViewportContentRefresh(0);
    }
  }

  let cachedCanvasRect = null;
  function getCanvasRect(canvas) {
    if (!cachedCanvasRect) cachedCanvasRect = canvas.getBoundingClientRect();
    return cachedCanvasRect;
  }
  window.addEventListener('resize', () => { cachedCanvasRect = null; });

  function setZoom(targetScale, pivotX, pivotY, smooth = false) {
    const canvas = RS.dom?.viewportCanvas;
    if (!canvas) return;
    if (typeof cancelCameraAnimation === 'function') cancelCameraAnimation();

    const prevScale = RS.ZOOM_STATE.scale;
    const nextScale = Math.max(RS.ZOOM_STATE.minScale, Math.min(RS.ZOOM_STATE.maxScale, targetScale));
    if (prevScale === nextScale) return;

    const rect = getCanvasRect(canvas);
    const cx = (pivotX !== undefined) ? (pivotX - rect.left) : (canvas.clientWidth / 2);
    const cy = (pivotY !== undefined) ? (pivotY - rect.top) : (canvas.clientHeight / 2);

    const worldX = (cx - RS.ZOOM_STATE.panX) / prevScale;
    const worldY = (cy - RS.ZOOM_STATE.panY) / prevScale;

    const nextPanX = Math.round(cx - worldX * nextScale);
    const nextPanY = Math.round(cy - worldY * nextScale);

    if (smooth) {
      animateCameraTo(nextScale, nextPanX, nextPanY, {
        duration: 220,
        easing: 'easeInOutCubic',
        isFit: false
      });
    } else {
      RS.ZOOM_STATE.panX = nextPanX;
      RS.ZOOM_STATE.panY = nextPanY;
      RS.ZOOM_STATE.scale = parseFloat(nextScale.toFixed(3));
      RS.ZOOM_STATE.isFit = false;
      updateStageTransform(false);
      scheduleViewportContentRefresh(120);
    }
  }

  let cableRenderTimeout = null;
  let viewportContentRefreshTimeout = null;
  function scheduleCableRender(delay = 16) {
    if (cableRenderTimeout) clearTimeout(cableRenderTimeout);
    cableRenderTimeout = setTimeout(() => {
      if (RS.renderAllCables) RS.renderAllCables();
      cableRenderTimeout = null;
    }, delay);
  }

  function scheduleViewportContentRefresh(delay = 100) {
    if (viewportContentRefreshTimeout) clearTimeout(viewportContentRefreshTimeout);
    viewportContentRefreshTimeout = setTimeout(() => {
      RS.refreshVisibleRackContent?.();
      viewportContentRefreshTimeout = null;
    }, delay);
  }

  function jumpToSection(section) {
    const canvas = RS.dom?.viewportCanvas;
    if (!canvas) return;
    const activeRack = RS.getActiveRack ? RS.getActiveRack() : null;
    const heightU = activeRack?.heightU || 42;
    const rackH = heightU * 32 + 16;
    const ch = canvas.clientHeight;

    const targetPanX = Math.round((canvas.clientWidth - 634) / 2);
    let targetPanY = 76;
    if (section === 'top') {
      targetPanY = 76;
    } else if (section === 'mid') {
      targetPanY = Math.round((ch - rackH) / 2);
    } else if (section === 'bot') {
      targetPanY = Math.round(ch - rackH - 24);
    }

    animateCameraTo(1.0, targetPanX, targetPanY, {
      duration: 240,
      easing: 'easeInOutCubic',
      isFit: false
    });
  }

  // --- CINEMATIC CAMERA FOCUS & EASING ENGINE ---
  let activeCameraAnimId = 0;

  const EASING_FNS = {
    easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
    easeOutQuart: (t) => 1 - Math.pow(1 - t, 4),
    easeInOutCubic: (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
  };

  function cancelCameraAnimation() {
    if (activeCameraAnimId) {
      cancelAnimationFrame(activeCameraAnimId);
      activeCameraAnimId = 0;
    }
    if (RS.ZOOM_STATE) RS.ZOOM_STATE.isFocusing = false;
    RS.dom?.rackStage?.classList.remove('focusing-active');
  }

  function animateCameraTo(targetScale, targetPanX, targetPanY, options = {}) {
    cancelCameraAnimation();

    const startScale = RS.ZOOM_STATE.scale;
    const startPanX = RS.ZOOM_STATE.panX;
    const startPanY = RS.ZOOM_STATE.panY;

    targetScale = Math.max(RS.ZOOM_STATE.minScale, Math.min(RS.ZOOM_STATE.maxScale, targetScale));
    targetScale = parseFloat(targetScale.toFixed(3));
    targetPanX = Math.round(targetPanX);
    targetPanY = Math.round(targetPanY);

    if (Math.abs(startScale - targetScale) < 0.005 &&
        Math.abs(startPanX - targetPanX) < 2 &&
        Math.abs(startPanY - targetPanY) < 2) {
      RS.ZOOM_STATE.scale = targetScale;
      RS.ZOOM_STATE.panX = targetPanX;
      RS.ZOOM_STATE.panY = targetPanY;
      updateStageTransform(false);
      options.onComplete?.();
      return;
    }

    const duration = options.duration || 240;
    const easingName = options.easing || 'easeInOutCubic';
    const easingFn = EASING_FNS[easingName] || EASING_FNS.easeInOutCubic;
    const startTime = performance.now();

    RS.ZOOM_STATE.isFocusing = true;
    RS.ZOOM_STATE.isFit = !!options.isFit;
    RS.dom?.rackStage?.classList.add('focusing-active');

    function step(now) {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = easingFn(progress);

      RS.ZOOM_STATE.scale = parseFloat((startScale + (targetScale - startScale) * eased).toFixed(3));
      RS.ZOOM_STATE.panX = Math.round(startPanX + (targetPanX - startPanX) * eased);
      RS.ZOOM_STATE.panY = Math.round(startPanY + (targetPanY - startPanY) * eased);

      updateStageTransform(false);

      if (progress < 1) {
        activeCameraAnimId = requestAnimationFrame(step);
      } else {
        activeCameraAnimId = 0;
        RS.ZOOM_STATE.isFocusing = false;
        RS.dom?.rackStage?.classList.remove('focusing-active');
        RS.syncPixiViewportCamera?.(RS.ZOOM_STATE);
        scheduleViewportContentRefresh(80);
        options.onComplete?.();
      }
    }

    activeCameraAnimId = requestAnimationFrame(step);
  }

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

    animateCameraTo(targetScale, targetPanX, targetPanY, {
      duration: options.duration || 400,
      easing: 'easeOutCubic',
      isFit: false,
      onComplete: options.onComplete
    });
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

    animateCameraTo(targetScale, targetPanX, targetPanY, {
      duration: options.duration || 420,
      easing: 'easeOutQuart',
      onComplete: options.onComplete
    });
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
    const cablePath = document.querySelector(`.cable-path[data-cable-id="${cableId}"]`);

    if (cablePath) {
      document.querySelectorAll('.cable-path.highlighted').forEach(p => p.classList.remove('highlighted'));
      cablePath.classList.add('highlighted');
    }

    if (!fromEl && !toEl && !cablePath) return;

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

    animateCameraTo(targetScale, targetPanX, targetPanY, {
      duration: options.duration || 450,
      easing: 'easeOutCubic',
      onComplete: options.onComplete
    });
  }

  function bindZoomAndPanEvents() {
    const canvas = RS.dom?.viewportCanvas;
    if (!canvas) return;

    let panFrameId = 0;
    let pendingPanPoint = null;
    let panCleanupTimer = 0;
    let lastPanCommitTime = -Infinity;

    function applyPendingPan() {
      if (!pendingPanPoint) return;
      const { clientX, clientY } = pendingPanPoint;
      pendingPanPoint = null;
      RS.ZOOM_STATE.panX = clientX - RS.ZOOM_STATE.startX;
      RS.ZOOM_STATE.panY = clientY - RS.ZOOM_STATE.startY;
      RS.ZOOM_STATE.isFit = false;
      updateStageTransform(false);
    }

    function schedulePan(clientX, clientY) {
      pendingPanPoint = { clientX, clientY };
      if (panFrameId) return;
      const commitPan = now => {
        if (now - lastPanCommitTime < CAMERA_FRAME_INTERVAL_MS - 1) {
          cameraPerformanceTelemetry.panFramePacingSkips++;
          panFrameId = requestAnimationFrame(commitPan);
          return;
        }
        panFrameId = 0;
        lastPanCommitTime = now;
        cameraPerformanceTelemetry.panFrameCommits++;
        applyPendingPan();
      };
      panFrameId = requestAnimationFrame(commitPan);
    }

    function beginPan(clientX, clientY) {
      if (typeof cancelCameraAnimation === 'function') cancelCameraAnimation();
      if (panCleanupTimer) {
        clearTimeout(panCleanupTimer);
        panCleanupTimer = 0;
      }
      RS.ZOOM_STATE.isPanning = true;
      RS.ZOOM_STATE.startX = clientX - RS.ZOOM_STATE.panX;
      RS.ZOOM_STATE.startY = clientY - RS.ZOOM_STATE.panY;
      canvas.classList.add('panning');
      RS.dom?.rackStage?.classList.add('panning-active');
    }

    function endPan() {
      if (!RS.ZOOM_STATE.isPanning) return;
      if (panFrameId) {
        cancelAnimationFrame(panFrameId);
        panFrameId = 0;
        applyPendingPan();
      }
      RS.ZOOM_STATE.isPanning = false;
      RS.syncPixiViewportCamera?.(RS.ZOOM_STATE);
      canvas.classList.remove('panning');
      // Keep the compositor layer warm briefly so release/inertial frames do not
      // pay a layer teardown + rebuild cost.
      panCleanupTimer = setTimeout(() => {
        RS.dom?.rackStage?.classList.remove('panning-active');
        panCleanupTimer = 0;
      }, 180);
      scheduleViewportContentRefresh(0);
    }

    let wheelZoomFrameId = 0;
    let pendingZoomMultiplier = 1;
    let wheelPivotX = 0;
    let wheelPivotY = 0;
    let wheelCleanupTimer = 0;

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (typeof cancelCameraAnimation === 'function') cancelCameraAnimation();
      if (wheelCleanupTimer) {
        clearTimeout(wheelCleanupTimer);
        wheelCleanupTimer = 0;
      }
      RS.dom?.rackStage?.classList.add('zooming-active');
      canvas.classList.add('zooming');

      const zoomFactor = e.deltaY < 0 ? 1.12 : (1 / 1.12);
      pendingZoomMultiplier *= zoomFactor;
      wheelPivotX = e.clientX;
      wheelPivotY = e.clientY;

      if (!wheelZoomFrameId) {
        wheelZoomFrameId = requestAnimationFrame(() => {
          wheelZoomFrameId = 0;
          const targetScale = RS.ZOOM_STATE.scale * pendingZoomMultiplier;
          pendingZoomMultiplier = 1;
          setZoom(targetScale, wheelPivotX, wheelPivotY, false);
        });
      }

      wheelCleanupTimer = setTimeout(() => {
        RS.dom?.rackStage?.classList.remove('zooming-active');
        canvas.classList.remove('zooming');
        RS.syncPixiViewportCamera?.(RS.ZOOM_STATE);
        cachedCanvasRect = null;
        wheelCleanupTimer = 0;
      }, 150);
    }, { passive: false });

    let panOriginClientX = 0;
    let panOriginClientY = 0;

    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 1 || (e.button === 0 && (e.altKey || e.spaceKey || e.target === canvas || e.target === RS.dom?.rackStage || e.target === RS.dom?.cablesSvg))) {
        panOriginClientX = e.clientX;
        panOriginClientY = e.clientY;
        beginPan(e.clientX, e.clientY);
        RS.ZOOM_STATE.hasMoved = false;
        e.preventDefault();
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (!RS.ZOOM_STATE.isPanning) return;
      const dist = Math.hypot(e.clientX - panOriginClientX, e.clientY - panOriginClientY);
      if (dist > 4) {
        RS.ZOOM_STATE.hasMoved = true;
      }
      schedulePan(e.clientX, e.clientY);
    });

    window.addEventListener('mouseup', () => {
      if (RS.ZOOM_STATE.isPanning) {
        endPan();
        if (RS.ZOOM_STATE.hasMoved) {
          setTimeout(() => {
            if (RS.ZOOM_STATE) RS.ZOOM_STATE.hasMoved = false;
          }, 250);
        }
      }
    });

    // Touch support (pinch to zoom and pan)
    let lastTouchDist = 0;
    let lastTouchCenter = { x: 0, y: 0 };
    canvas.addEventListener('touchstart', (e) => {
      if (typeof cancelCameraAnimation === 'function') cancelCameraAnimation();
      if (e.touches.length === 2) {
        RS.dom?.rackStage?.classList.add('zooming-active');
        lastTouchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        lastTouchCenter = {
          x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          y: (e.touches[0].clientY + e.touches[1].clientY) / 2
        };
      } else if (e.touches.length === 1 && (e.target === canvas || e.target === RS.dom?.rackStage || e.target === RS.dom?.cablesSvg)) {
        beginPan(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    canvas.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        if (lastTouchDist > 0) {
          const factor = dist / lastTouchDist;
          setZoom(RS.ZOOM_STATE.scale * factor, lastTouchCenter.x, lastTouchCenter.y, false);
        }
        lastTouchDist = dist;
      } else if (e.touches.length === 1 && RS.ZOOM_STATE.isPanning) {
        schedulePan(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    canvas.addEventListener('touchend', () => {
      RS.dom?.rackStage?.classList.remove('zooming-active');
      endPan();
      RS.syncPixiViewportCamera?.(RS.ZOOM_STATE);
      lastTouchDist = 0;
    });

    // Toolbar buttons
    if (RS.dom?.btnZoomIn) {
      RS.dom.btnZoomIn.addEventListener('click', () => setZoom(RS.ZOOM_STATE.scale * 1.25, undefined, undefined, true));
    }
    if (RS.dom?.btnZoomOut) {
      RS.dom.btnZoomOut.addEventListener('click', () => setZoom(RS.ZOOM_STATE.scale / 1.25, undefined, undefined, true));
    }
    if (RS.dom?.btnZoomFit) {
      RS.dom.btnZoomFit.addEventListener('click', () => fitRackToScreen(true));
    }
    if (RS.dom?.btnZoomActual) {
      RS.dom.btnZoomActual.addEventListener('click', () => setZoom(1.0, undefined, undefined, true));
    }
    if (RS.dom?.zoomBadge) {
      RS.dom.zoomBadge.addEventListener('click', () => {
        if (RS.ZOOM_STATE.scale > 0.85) {
          fitRackToScreen(true);
        } else {
          setZoom(1.0, undefined, undefined, true);
        }
      });
    }

    if (RS.dom?.navJumpTop) RS.dom.navJumpTop.addEventListener('click', () => jumpToSection('top'));
    if (RS.dom?.navJumpMid) RS.dom.navJumpMid.addEventListener('click', () => jumpToSection('mid'));
    if (RS.dom?.navJumpBot) RS.dom.navJumpBot.addEventListener('click', () => jumpToSection('bot'));

    // Double-click canvas to smoothly fit active rack / all racks
    canvas.addEventListener('dblclick', (e) => {
      if (e.target === canvas || e.target === RS.dom?.rackStage || e.target === RS.dom?.cablesSvg) {
        if (typeof focusOnRack === 'function') {
          focusOnRack(RS.STATE?.activeRackId);
        } else {
          fitRackToScreen(true);
        }
      }
    });

    // Keyboard shortcuts: F for Focus/Fit, 0/1 for 100% 1:1 view
    window.addEventListener('keydown', (e) => {
      const tag = e.target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target?.isContentEditable) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        if (typeof focusOnRack === 'function') {
          focusOnRack(RS.STATE?.activeRackId);
        } else {
          fitRackToScreen(true);
        }
      } else if (e.key === '0' || e.key === '1') {
        e.preventDefault();
        setZoom(1.0, undefined, undefined, true);
      }
    });

    // Zoom and pan are compositor-only. Cable geometry is refreshed by layout
    // mutations and resize handlers, not by view transforms.
  }

  RS.ensureStageTransitionListener = ensureStageTransitionListener;
  RS.updateStageTransform = updateStageTransform;
  RS.getCameraPerformanceTelemetry = () => ({ ...cameraPerformanceTelemetry });
  RS.fitRackToScreen = fitRackToScreen;
  RS.fit = fitRackToScreen;
  RS.setZoom = setZoom;
  RS.scheduleCableRender = scheduleCableRender;
  RS.jumpToSection = jumpToSection;
  RS.bindZoomAndPanEvents = bindZoomAndPanEvents;
  RS.animateCameraTo = animateCameraTo;
  RS.cancelCameraAnimation = cancelCameraAnimation;
  RS.focusOnRack = focusOnRack;
  RS.focusOnDevice = focusOnDevice;
  RS.focusOnCable = focusOnCable;
})();
