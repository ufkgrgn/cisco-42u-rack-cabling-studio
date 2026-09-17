// ============================================================================
// CameraController: Pointer Interaction, Inertia & EngineBridge Wireup
// Handles: pointerdown, pointermove, pointerup, pointercancel, wheel, Space+Left, Middle-Click
// ============================================================================

import { Camera } from './Camera';
import { EngineBridge } from '../bridge/EngineBridge';
import { KineticVelocity } from './types';

export class CameraController {
  private _camera: Camera;
  private _bridge: EngineBridge;
  private _element: HTMLElement | null = null;

  // Interaction state
  private _isMiddlePanning = false;
  private _isSpacePanning = false;
  private _isTouchPanning = false;
  private _isSpacePressed = false;
  private _isPointerDown = false;
  private _activePointerId: number | null = null;
  private _lastPointerX = 0;
  private _lastPointerY = 0;

  // Multi-touch tracking
  private _activePointers: Map<number, { x: number; y: number; pointerType: string }> = new Map();
  private _lastPinchDistance: number | null = null;
  private _lastPinchCenter: { x: number; y: number } | null = null;
  private _isPinching = false;

  // Tap / Double-tap detection
  private _lastTapTime = 0;
  private _lastTapPosition: { x: number; y: number } | null = null;
  private _pointerDownStart: { x: number; y: number; time: number } | null = null;

  // Cached DOM Rect (Zero-DOM reading during motion)
  private _cachedRect: DOMRectReadOnly | null = null;
  private _resizeObserver: ResizeObserver | null = null;

  // Kinetic momentum / inertia
  private _velocityHistory: { dx: number; dy: number; dt: number; timestamp: number }[] = [];
  private _kineticVelocity: KineticVelocity = { vx: 0, vy: 0 };
  private _animationFrameId: number | null = null;
  private _lastFrameTime = 0;

  // Bridge unregister callbacks
  private _unsubBridge: (() => void)[] = [];

  constructor(camera: Camera, bridge: EngineBridge) {
    this._camera = camera;
    this._bridge = bridge;
  }

  public attach(element: HTMLElement): void {
    this._element = element;

    // Cache rect initially and monitor size changes without querying per frame
    this._updateCachedRect();
    if (typeof ResizeObserver !== 'undefined') {
      this._resizeObserver = new ResizeObserver((entries) => {
        if (entries[0]) {
          this._cachedRect = entries[0].contentRect;
          this._camera.setViewportSize(entries[0].contentRect.width, entries[0].contentRect.height);
        }
      });
      this._resizeObserver.observe(element);
    }

    // Attach native DOM listeners
    element.addEventListener('pointerdown', this._onPointerDown, { passive: false });
    element.addEventListener('pointermove', this._onPointerMove, { passive: false });
    element.addEventListener('pointerup', this._onPointerUp, { passive: false });
    element.addEventListener('pointercancel', this._onPointerCancel, { passive: false });
    element.addEventListener('wheel', this._onWheel, { passive: false });

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this._onKeyDown);
      window.addEventListener('keyup', this._onKeyUp);
      window.addEventListener('blur', this._onWindowBlur);
    }

    // Register EngineBridge event listeners
    this._registerBridgeListeners();

    // Wire camera transform change back to bridge
    this._camera.setOnChange((state) => {
      this._bridge.emit('viewport:change', {
        zoom: state.zoom,
        panX: state.x,
        panY: state.y,
      });
    });
  }

  public detach(): void {
    if (this._element) {
      this._element.removeEventListener('pointerdown', this._onPointerDown);
      this._element.removeEventListener('pointermove', this._onPointerMove);
      this._element.removeEventListener('pointerup', this._onPointerUp);
      this._element.removeEventListener('pointercancel', this._onPointerCancel);
      this._element.removeEventListener('wheel', this._onWheel);
      this._resizeObserver?.disconnect();
      this._resizeObserver = null;
      this._element = null;
    }

    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this._onKeyDown);
      window.removeEventListener('keyup', this._onKeyUp);
      window.removeEventListener('blur', this._onWindowBlur);
    }

    this._stopInertia();
    this._activePointers.clear();
    this._unsubBridge.forEach((unsub) => unsub());
    this._unsubBridge = [];
  }

  private _updateCachedRect(): void {
    if (this._element) {
      if (typeof this._element.getBoundingClientRect === 'function') {
        this._cachedRect = this._element.getBoundingClientRect();
        this._camera.setViewportSize(this._cachedRect.width, this._cachedRect.height);
      }
    }
  }

  private _registerBridgeListeners(): void {
    // 1. Relative pan command
    const unsubPan = this._bridge.on('camera:pan', (data) => {
      if (!Number.isFinite(data.dx) || !Number.isFinite(data.dy)) return;
      this._camera.panBy(data.dx, data.dy);
    });

    // 2. Relative zoom command
    const unsubZoom = this._bridge.on('camera:zoom', (data) => {
      if (
        !Number.isFinite(data.screenAnchorX) ||
        !Number.isFinite(data.screenAnchorY) ||
        Number.isNaN(data.factor)
      ) {
        return;
      }
      this._camera.zoomAt(data.screenAnchorX, data.screenAnchorY, data.factor);
    });

    // 3. Zoom-to absolute command
    const unsubZoomTo = this._bridge.on('camera:zoom-to', (data) => {
      if (Number.isNaN(data.factor)) return;
      if (data.screenX !== undefined && !Number.isFinite(data.screenX)) return;
      if (data.screenY !== undefined && !Number.isFinite(data.screenY)) return;
      this._camera.setZoom(data.factor, data.screenX, data.screenY);
    });

    // 4. Pan-to world coordinate command
    const unsubPanTo = this._bridge.on('camera:pan-to', (data) => {
      if (!Number.isFinite(data.worldX) || !Number.isFinite(data.worldY)) return;
      const screen = this._camera.worldToScreen(data.worldX, data.worldY);
      const cx = (this._cachedRect?.width ?? 1920) / 2;
      const cy = (this._cachedRect?.height ?? 1080) / 2;
      this._camera.panBy(cx - screen.x, cy - screen.y);
    });

    this._unsubBridge.push(unsubPan, unsubZoom, unsubZoomTo, unsubPanTo);
  }

  // --- Pointer Event Handlers ---

  private _onPointerDown = (e: PointerEvent): void => {
    this._stopInertia();

    this._activePointers.set(e.pointerId, {
      x: e.clientX,
      y: e.clientY,
      pointerType: e.pointerType,
    });

    const isTouchOrPen = e.pointerType === 'touch' || e.pointerType === 'pen';
    const isMiddle = e.button === 1;
    const isLeftWithSpace = e.button === 0 && this._isSpacePressed;

    if (isMiddle || isLeftWithSpace) {
      e.preventDefault();
      this._isPointerDown = true;
      this._activePointerId = e.pointerId;
      this._lastPointerX = e.clientX;
      this._lastPointerY = e.clientY;
      this._velocityHistory = [];

      if (isMiddle) this._isMiddlePanning = true;
      if (isLeftWithSpace) this._isSpacePanning = true;

      this._setCursor('grabbing');
      try {
        this._element?.setPointerCapture(e.pointerId);
      } catch {}
    } else if (isTouchOrPen) {
      // Touch interaction
      if (this._activePointers.size === 1) {
        // First touch: prepare for pan and tap tracking
        this._pointerDownStart = {
          x: e.clientX,
          y: e.clientY,
          time: typeof performance !== 'undefined' ? performance.now() : Date.now(),
        };
        this._isPointerDown = true;
        this._isTouchPanning = true;
        this._activePointerId = e.pointerId;
        this._lastPointerX = e.clientX;
        this._lastPointerY = e.clientY;
        this._velocityHistory = [];

        try {
          this._element?.setPointerCapture(e.pointerId);
        } catch {}
      } else if (this._activePointers.size === 2) {
        // Second touch: initialize pinch-to-zoom & two-finger pan
        this._isTouchPanning = false;
        this._isPinching = true;
        const pts = Array.from(this._activePointers.values());
        const p1 = pts[0];
        const p2 = pts[1];
        if (p1 && p2) {
          this._lastPinchDistance = Math.hypot(p2.x - p1.x, p2.y - p1.y);
          this._lastPinchCenter = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
        }
        this._velocityHistory = [];

        try {
          this._element?.setPointerCapture(e.pointerId);
        } catch {}
      }
    }
  };

  private _onPointerMove = (e: PointerEvent): void => {
    if (this._activePointers.has(e.pointerId)) {
      this._activePointers.set(e.pointerId, {
        x: e.clientX,
        y: e.clientY,
        pointerType: e.pointerType,
      });
    }

    // Pinch-to-zoom & 2-finger pan handling
    if (this._activePointers.size >= 2) {
      e.preventDefault();
      const pts = Array.from(this._activePointers.values());
      const p1 = pts[0];
      const p2 = pts[1];
      if (!p1 || !p2) return;

      const currentDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const currentCenter = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

      if (this._lastPinchDistance && this._lastPinchDistance > 0 && currentDist > 0) {
        const factor = Math.min(1.4, Math.max(0.7, currentDist / this._lastPinchDistance));
        const rect = this._cachedRect;
        const anchorX = rect ? currentCenter.x - rect.left : currentCenter.x;
        const anchorY = rect ? currentCenter.y - rect.top : currentCenter.y;

        if (Number.isFinite(anchorX) && Number.isFinite(anchorY) && Number.isFinite(factor)) {
          this._camera.zoomAt(anchorX, anchorY, factor);
        }

        if (this._lastPinchCenter) {
          const panDx = currentCenter.x - this._lastPinchCenter.x;
          const panDy = currentCenter.y - this._lastPinchCenter.y;
          if (Number.isFinite(panDx) && Number.isFinite(panDy)) {
            this._camera.panBy(panDx, panDy);
          }
        }
      }

      this._lastPinchDistance = currentDist;
      this._lastPinchCenter = currentCenter;
      return;
    }

    // Single-pointer panning (Middle, Space+Left, or Single Touch)
    if (!this._isMiddlePanning && !this._isSpacePanning && !this._isTouchPanning) return;
    if (this._activePointerId !== null && e.pointerId !== this._activePointerId) return;

    if (!Number.isFinite(e.clientX) || !Number.isFinite(e.clientY)) return;

    e.preventDefault();
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const dx = e.clientX - this._lastPointerX;
    const dy = e.clientY - this._lastPointerY;

    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;

    if (this._velocityHistory.length > 0) {
      const last = this._velocityHistory[this._velocityHistory.length - 1];
      const dt = Math.max(1, now - (last?.timestamp ?? now));
      this._velocityHistory.push({ dx, dy, dt, timestamp: now });
      if (this._velocityHistory.length > 5) this._velocityHistory.shift();
    } else {
      this._velocityHistory.push({ dx, dy, dt: 16, timestamp: now });
    }

    this._lastPointerX = e.clientX;
    this._lastPointerY = e.clientY;

    this._camera.panBy(dx, dy);
  };

  private _onPointerUp = (e: PointerEvent): void => {
    const wasTouch = e.pointerType === 'touch' || e.pointerType === 'pen';
    const wasPinching = this._isPinching;
    const wasPanning = this._isMiddlePanning || this._isSpacePanning || this._isTouchPanning;

    this._activePointers.delete(e.pointerId);

    try {
      if (this._element?.hasPointerCapture(e.pointerId)) {
        this._element.releasePointerCapture(e.pointerId);
      }
    } catch {}

    if (this._activePointers.size === 1) {
      // Transition from pinch back to 1-finger pan smoothly
      this._isPinching = false;
      this._lastPinchDistance = null;
      this._lastPinchCenter = null;
      const remaining = Array.from(this._activePointers.entries())[0];
      if (remaining) {
        const [remId, remData] = remaining;
        this._activePointerId = remId;
        this._lastPointerX = remData.x;
        this._lastPointerY = remData.y;
        this._velocityHistory = [];
        if (remData.pointerType === 'touch' || remData.pointerType === 'pen') {
          this._isTouchPanning = true;
        }
      }
      return;
    }

    if (this._activePointers.size === 0) {
      this._isMiddlePanning = false;
      this._isSpacePanning = false;
      this._isTouchPanning = false;
      this._isPinching = false;
      this._isPointerDown = false;
      this._activePointerId = null;
      this._lastPinchDistance = null;
      this._lastPinchCenter = null;

      this._updateCursorState();

      // Tap / Double-tap detection for touches
      if (wasTouch && this._pointerDownStart && !wasPinching) {
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const duration = now - this._pointerDownStart.time;
        const dist = Math.hypot(
          e.clientX - this._pointerDownStart.x,
          e.clientY - this._pointerDownStart.y
        );

        if (dist < 15 && duration < 300) {
          const timeSinceLastTap = now - this._lastTapTime;
          if (timeSinceLastTap < 350 && this._lastTapPosition) {
            const distFromLastTap = Math.hypot(
              e.clientX - this._lastTapPosition.x,
              e.clientY - this._lastTapPosition.y
            );
            if (distFromLastTap < 30) {
              this._handleDoubleTap(e.clientX, e.clientY);
              this._lastTapTime = 0;
              this._lastTapPosition = null;
              this._pointerDownStart = null;
              return;
            }
          }
          this._lastTapTime = now;
          this._lastTapPosition = { x: e.clientX, y: e.clientY };
        }
      }
      this._pointerDownStart = null;

      if (wasPanning && !wasPinching) {
        this._startInertia();
      }
    }
  };

  private _onPointerCancel = (e: PointerEvent): void => {
    this._onPointerUp(e);
  };

  private _handleDoubleTap(clientX: number, clientY: number): void {
    const currentZoom = this._camera.zoom;
    if (currentZoom > 0.85) {
      this._bridge.emit('camera:fit-all', undefined);
    } else {
      const rect = this._cachedRect;
      const anchorX = rect ? clientX - rect.left : clientX;
      const anchorY = rect ? clientY - rect.top : clientY;
      this._camera.zoomAt(anchorX, anchorY, 1.4);
    }
  };

  // --- Wheel Handling (Zoom & Pan) ---

  private _onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this._stopInertia();

    const deltaX = Number.isFinite(e.deltaX) ? e.deltaX : 0;
    const deltaY = Number.isFinite(e.deltaY) ? e.deltaY : 0;
    if (deltaX === 0 && deltaY === 0 && !e.ctrlKey) return;

    const rect = this._cachedRect;
    const clientX = Number.isFinite(e.clientX) ? e.clientX : 0;
    const clientY = Number.isFinite(e.clientY) ? e.clientY : 0;
    const screenAnchorX = rect ? clientX - rect.left : clientX;
    const screenAnchorY = rect ? clientY - rect.top : clientY;

    if (!Number.isFinite(screenAnchorX) || !Number.isFinite(screenAnchorY)) return;

    // Mode A: Pinch-zoom or Ctrl+Wheel or Standard Wheel Zoom
    if (e.ctrlKey || (!e.shiftKey && Math.abs(deltaY) > 0 && Math.abs(deltaX) === 0)) {
      // Exponential zoom factor (clamped delta prevents runaway scaling)
      const clampedDelta = Math.min(100, Math.max(-100, deltaY));
      const factor = Math.exp(-clampedDelta * 0.0015);
      if (Number.isFinite(factor)) {
        this._camera.zoomAt(screenAnchorX, screenAnchorY, factor);
      }
      return;
    }

    // Mode B: Shift+Wheel = Horizontal Pan
    if (e.shiftKey) {
      this._camera.panBy(-deltaY, 0);
      return;
    }

    // Mode C: Trackpad Two-Finger Pan (both deltaX and deltaY present)
    this._camera.panBy(-deltaX, -deltaY);
  };

  // --- Keyboard Modifiers (Spacebar) ---

  private _onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === 'Space' && !this._isSpacePressed) {
      // Suppress if typing in an input element
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || (e.target as HTMLElement)?.isContentEditable) {
        return;
      }
      e.preventDefault();
      this._isSpacePressed = true;
      if (!this._isPointerDown) {
        this._setCursor('grab');
      }
    }
  };

  private _onKeyUp = (e: KeyboardEvent): void => {
    if (e.code === 'Space') {
      this._isSpacePressed = false;
      if (!this._isPointerDown) {
        this._updateCursorState();
      }
    }
  };

  private _onWindowBlur = (): void => {
    this._isSpacePressed = false;
    this._isMiddlePanning = false;
    this._isSpacePanning = false;
    this._isTouchPanning = false;
    this._isPointerDown = false;
    this._isPinching = false;
    this._activePointers.clear();
    this._lastPinchDistance = null;
    this._lastPinchCenter = null;
    this._stopInertia();
    this._updateCursorState();
  };

  // --- Kinetic Momentum Physics ---

  private _startInertia(): void {
    if (this._velocityHistory.length < 2) return;

    let totalDx = 0;
    let totalDy = 0;
    let totalDt = 0;

    for (const sample of this._velocityHistory) {
      totalDx += sample.dx;
      totalDy += sample.dy;
      totalDt += sample.dt;
    }

    if (totalDt === 0) return;

    // Velocity in px/ms
    let vx = totalDx / totalDt;
    let vy = totalDy / totalDt;

    // Cap maximum launch velocity to avoid runaway translation
    const speed = Math.hypot(vx, vy);
    const maxSpeed = 3.5; // px/ms
    if (speed > maxSpeed) {
      vx = (vx / speed) * maxSpeed;
      vy = (vy / speed) * maxSpeed;
    }

    if (speed < 0.05) return; // Ignore tiny releases

    this._kineticVelocity = { vx, vy };
    this._lastFrameTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (typeof requestAnimationFrame !== 'undefined') {
      this._animationFrameId = requestAnimationFrame(this._kineticStep);
    }
  }

  private _kineticStep = (now: number): void => {
    const dt = Math.min(32, Math.max(4, now - this._lastFrameTime));
    this._lastFrameTime = now;

    const friction = Math.pow(0.92, dt / 16.6);
    this._kineticVelocity.vx *= friction;
    this._kineticVelocity.vy *= friction;

    const currentSpeed = Math.hypot(this._kineticVelocity.vx, this._kineticVelocity.vy);
    if (currentSpeed < 0.01) {
      this._stopInertia();
      return;
    }

    this._camera.panBy(this._kineticVelocity.vx * dt, this._kineticVelocity.vy * dt);
    if (typeof requestAnimationFrame !== 'undefined') {
      this._animationFrameId = requestAnimationFrame(this._kineticStep);
    }
  };

  private _stopInertia(): void {
    if (this._animationFrameId !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this._animationFrameId);
      this._animationFrameId = null;
    }
    this._kineticVelocity = { vx: 0, vy: 0 };
    this._velocityHistory = [];
  }

  private _updateCursorState(): void {
    if (this._isSpacePressed) {
      this._setCursor('grab');
    } else {
      this._setCursor('default');
    }
  }

  private _setCursor(cursor: string): void {
    if (this._element) {
      this._element.style.cursor = cursor;
    }
  }
}
