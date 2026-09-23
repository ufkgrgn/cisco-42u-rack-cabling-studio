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
    panFramePacingSkips: 0,
    transformCommits: 0,
    totalCommitDurationMs: 0,
    maxCommitDurationMs: 0,
    totalRackSyncDurationMs: 0,
    totalPixiSyncDurationMs: 0,
    commitDurations: []
  };

  function resetCameraPerformanceTelemetry() {
    cameraPerformanceTelemetry.panFrameCommits = 0;
    cameraPerformanceTelemetry.panFramePacingSkips = 0;
    cameraPerformanceTelemetry.transformCommits = 0;
    cameraPerformanceTelemetry.totalCommitDurationMs = 0;
    cameraPerformanceTelemetry.maxCommitDurationMs = 0;
    cameraPerformanceTelemetry.totalRackSyncDurationMs = 0;
    cameraPerformanceTelemetry.totalPixiSyncDurationMs = 0;
    cameraPerformanceTelemetry.commitDurations.length = 0;
  }

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
    const commitStarted = performance.now();
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
    const rackSyncStarted = performance.now();
    RS.syncRackViewportVisibility?.(RS.ZOOM_STATE);
    cameraPerformanceTelemetry.totalRackSyncDurationMs += performance.now() - rackSyncStarted;
    const pixiSyncStarted = performance.now();
    RS.syncPixiViewportCamera?.(RS.ZOOM_STATE);
    cameraPerformanceTelemetry.totalPixiSyncDurationMs += performance.now() - pixiSyncStarted;
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
      RS.syncPixiDeviceSceneLOD?.(currentLod);
    }
    const commitDuration = performance.now() - commitStarted;
    cameraPerformanceTelemetry.transformCommits++;
    cameraPerformanceTelemetry.totalCommitDurationMs += commitDuration;
    cameraPerformanceTelemetry.maxCommitDurationMs = Math.max(cameraPerformanceTelemetry.maxCommitDurationMs, commitDuration);
    cameraPerformanceTelemetry.commitDurations.push(commitDuration);
    if (cameraPerformanceTelemetry.commitDurations.length > 240) cameraPerformanceTelemetry.commitDurations.shift();
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

  // Camera focus functions (focusOnRack, focusOnDevice, focusOnCable) extracted to js/2d/zoom-camera-focus.js
  const focusOnRack = (...args) => RS.focusOnRack ? RS.focusOnRack(...args) : fitRackToScreen(true);
  const focusOnDevice = (...args) => RS.focusOnDevice && RS.focusOnDevice(...args);
  const focusOnCable = (...args) => RS.focusOnCable && RS.focusOnCable(...args);

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
      if (panCleanupTimer) {
        clearTimeout(panCleanupTimer);
        panCleanupTimer = 0;
      }
      RS.dom?.rackStage?.classList.remove('panning-active');
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
      if (RS.isDraggingDevice || RS.dom?.rackStage?.classList.contains('device-dragging-active') || e.target.closest('.mounted-device') || e.target.closest('[data-drag-handle="true"]')) {
        if (RS.ZOOM_STATE.isPanning) endPan();
        return;
      }
      const isBlocked = !!e.target.closest('button, .port, .dev-btn, input, select, textarea, [data-drag-handle="true"], .u-label, .rack-u-action-menu, #rack-u-action-menu, .studio-multiselect-pill, #studio-multiselect-pill, .modal, .mounted-device');
      if (e.button === 1 || (e.button === 0 && (e.altKey || e.spaceKey || !isBlocked))) {
        panOriginClientX = e.clientX;
        panOriginClientY = e.clientY;
        beginPan(e.clientX, e.clientY);
        RS.ZOOM_STATE.hasMoved = false;
        e.preventDefault();
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (RS.isDraggingDevice || RS.dom?.rackStage?.classList.contains('device-dragging-active')) {
        if (RS.ZOOM_STATE.isPanning) endPan();
        return;
      }
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

    // Touch support (simultaneous two-finger pan & pinch-to-zoom, and safe one-finger pan)
    let lastTouchDist = 0;
    let lastTouchCenter = { x: 0, y: 0 };
    canvas.addEventListener('touchstart', (e) => {
      if (RS.isDraggingDevice || RS.dom?.rackStage?.classList.contains('device-dragging-active') || e.target.closest('.mounted-device.studio-multi-selected') || e.target.closest('[data-drag-handle="true"]')) {
        if (RS.ZOOM_STATE.isPanning) endPan();
        return;
      }
      if (typeof cancelCameraAnimation === 'function') cancelCameraAnimation();
      if (e.touches.length === 2) {
        RS.dom?.rackStage?.classList.add('zooming-active');
        RS.dom?.rackStage?.classList.add('panning-active');
        lastTouchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        lastTouchCenter = {
          x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          y: (e.touches[0].clientY + e.touches[1].clientY) / 2
        };
        // 2-finger touch overrides single-finger pan/drag immediately
        if (RS.ZOOM_STATE.isPanning) endPan();
      } else if (e.touches.length === 1) {
        const isBlocked = !!e.target.closest('button, .port, .dev-btn, input, select, textarea, [data-drag-handle="true"], .u-label, .rack-u-action-menu, #rack-u-action-menu, .studio-multiselect-pill, #studio-multiselect-pill, .modal');
        if (!isBlocked) {
          panOriginClientX = e.touches[0].clientX;
          panOriginClientY = e.touches[0].clientY;
          beginPan(e.touches[0].clientX, e.touches[0].clientY);
          RS.ZOOM_STATE.hasMoved = false;
        }
      }
    }, { passive: true });

    canvas.addEventListener('touchmove', (e) => {
      if (RS.isDraggingDevice || RS.dom?.rackStage?.classList.contains('device-dragging-active')) {
        if (RS.ZOOM_STATE.isPanning) endPan();
        return;
      }
      if (e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const center = {
          x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          y: (e.touches[0].clientY + e.touches[1].clientY) / 2
        };

        const deltaX = center.x - lastTouchCenter.x;
        const deltaY = center.y - lastTouchCenter.y;

        if (lastTouchDist > 0) {
          const factor = dist / lastTouchDist;
          setZoom(RS.ZOOM_STATE.scale * factor, center.x, center.y, false);
        }

        if (Math.abs(deltaX) > 0.5 || Math.abs(deltaY) > 0.5) {
          RS.ZOOM_STATE.panX += deltaX;
          RS.ZOOM_STATE.panY += deltaY;
          RS.ZOOM_STATE.isFit = false;
          RS.ZOOM_STATE.hasMoved = true;
          updateStageTransform(false);
        }

        lastTouchDist = dist;
        lastTouchCenter = center;
      } else if (e.touches.length === 1 && RS.ZOOM_STATE.isPanning) {
        const dist = Math.hypot(e.touches[0].clientX - panOriginClientX, e.touches[0].clientY - panOriginClientY);
        if (dist > 4) RS.ZOOM_STATE.hasMoved = true;
        schedulePan(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    canvas.addEventListener('touchend', (e) => {
      if (e.touches.length < 2) {
        RS.dom?.rackStage?.classList.remove('zooming-active');
        RS.dom?.rackStage?.classList.remove('panning-active');
        lastTouchDist = 0;
      }
      if (e.touches.length === 0) {
        endPan();
        RS.syncPixiViewportCamera?.(RS.ZOOM_STATE);
        if (RS.ZOOM_STATE.hasMoved) {
          setTimeout(() => {
            if (RS.ZOOM_STATE) RS.ZOOM_STATE.hasMoved = false;
          }, 250);
        }
      }
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
  RS.resetCameraPerformanceTelemetry = resetCameraPerformanceTelemetry;
  RS.getCameraPerformanceTelemetry = () => {
    const durations = [...cameraPerformanceTelemetry.commitDurations].sort((a, b) => a - b);
    const commits = cameraPerformanceTelemetry.transformCommits;
    return {
      ...cameraPerformanceTelemetry,
      commitDurations: undefined,
      averageCommitDurationMs: commits ? cameraPerformanceTelemetry.totalCommitDurationMs / commits : 0,
      p95CommitDurationMs: durations.length ? durations[Math.min(durations.length - 1, Math.floor(durations.length * 0.95))] : 0,
      averageRackSyncDurationMs: commits ? cameraPerformanceTelemetry.totalRackSyncDurationMs / commits : 0,
      averagePixiSyncDurationMs: commits ? cameraPerformanceTelemetry.totalPixiSyncDurationMs / commits : 0
    };
  };
  RS.fitRackToScreen = fitRackToScreen;
  RS.fit = fitRackToScreen;
  RS.setZoom = setZoom;
  RS.scheduleCableRender = scheduleCableRender;
  RS.jumpToSection = jumpToSection;
  RS.bindZoomAndPanEvents = bindZoomAndPanEvents;
  RS.animateCameraTo = animateCameraTo;
  RS.cancelCameraAnimation = cancelCameraAnimation;
  if (!RS.focusOnRack) RS.focusOnRack = fitRackToScreen;
})();
