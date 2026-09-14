// ============================================================================
// Camera Model & State Manager
// Directly controls PixiJS Container transforms with dirty tracking
// ============================================================================

import { Container } from 'pixi.js';
import { CameraState, CameraOptions, ViewportRect, WorldCoordinate, ScreenCoordinate, ScreenBounds } from './types';
import {
  screenToWorld,
  worldToScreen,
  clampZoom,
  calculatePointerZoom,
  getVisibleWorldBounds,
  calculateFitBounds,
} from './affine';

export class Camera {
  private _state: CameraState = { x: 0, y: 0, zoom: 1.0 };
  private _options: Required<CameraOptions>;
  private _targetContainer: Container | null = null;
  private _viewportWidth = 1920;
  private _viewportHeight = 1080;
  private _isDirty = true;
  private _onTransformChange?: (state: CameraState) => void;

  // Kinetic momentum / inertia velocity
  private _vx = 0;
  private _vy = 0;

  constructor(
    targetContainerOrOptions?: Container | CameraOptions,
    screenBounds?: ScreenBounds
  ) {
    let opts: CameraOptions | undefined;

    if (targetContainerOrOptions && 'position' in targetContainerOrOptions) {
      this._targetContainer = targetContainerOrOptions as Container;
      if (screenBounds) {
        this._viewportWidth = screenBounds.width;
        this._viewportHeight = screenBounds.height;
      }
    } else if (targetContainerOrOptions) {
      opts = targetContainerOrOptions as CameraOptions;
    }

    this._options = {
      minZoom: opts?.minZoom ?? 0.1,
      maxZoom: opts?.maxZoom ?? 4.0,
      friction: opts?.friction ?? 0.92,
      zoomSensitivity: opts?.zoomSensitivity ?? 0.0015,
      enableInertia: opts?.enableInertia ?? true,
    };
  }

  public attachContainer(container: Container): void {
    this._targetContainer = container;
    this.applyTransform();
  }

  public setViewportSize(width: number, height: number): void {
    this._viewportWidth = Math.max(1, width);
    this._viewportHeight = Math.max(1, height);
    this._isDirty = true;
  }

  public updateScreenBounds(width: number, height: number): void {
    this.setViewportSize(width, height);
  }

  public get state(): Readonly<CameraState> {
    return this._state;
  }

  public get x(): number {
    return this._state.x;
  }

  public get y(): number {
    return this._state.y;
  }

  public get panX(): number {
    return this._state.x;
  }

  public get panY(): number {
    return this._state.y;
  }

  public get zoom(): number {
    return this._state.zoom;
  }

  public get scale(): number {
    return this._state.zoom;
  }

  public set scale(val: number) {
    if (Number.isNaN(val)) return;
    const clamped = clampZoom(val, this._options.minZoom, this._options.maxZoom);
    if (!Number.isFinite(clamped) || clamped <= 0) return;
    if (this._state.zoom !== clamped) {
      this._state.zoom = clamped;
      this._isDirty = true;
      this.applyTransform();
    }
  }

  public set panX(val: number) {
    if (!Number.isFinite(val)) return;
    if (this._state.x !== val) {
      this._state.x = val;
      this._isDirty = true;
      this.applyTransform();
    }
  }

  public set panY(val: number) {
    if (!Number.isFinite(val)) return;
    if (this._state.y !== val) {
      this._state.y = val;
      this._isDirty = true;
      this.applyTransform();
    }
  }

  public get minScale(): number {
    return this._options.minZoom;
  }

  public get maxScale(): number {
    return this._options.maxZoom;
  }

  public get isDirty(): boolean {
    return this._isDirty;
  }

  public setOnChange(callback: (state: CameraState) => void): void {
    this._onTransformChange = callback;
  }

  public screenToWorld(sx: number, sy: number): WorldCoordinate {
    return screenToWorld(sx, sy, this._state);
  }

  public worldToScreen(wx: number, wy: number): ScreenCoordinate {
    return worldToScreen(wx, wy, this._state);
  }

  public panBy(dx: number, dy: number): void {
    if (!Number.isFinite(dx) || !Number.isFinite(dy) || (dx === 0 && dy === 0)) return;
    this._state.x += dx;
    this._state.y += dy;
    this._isDirty = true;
    this.applyTransform();
  }

  public zoomAt(screenAnchorX: number, screenAnchorY: number, factor: number): void {
    if (
      !Number.isFinite(screenAnchorX) ||
      !Number.isFinite(screenAnchorY) ||
      Number.isNaN(factor)
    ) {
      return;
    }
    const nextZoom = this._state.zoom * factor;
    const newState = calculatePointerZoom(
      this._state,
      screenAnchorX,
      screenAnchorY,
      nextZoom,
      this._options.minZoom,
      this._options.maxZoom
    );

    if (
      !Number.isFinite(newState.x) ||
      !Number.isFinite(newState.y) ||
      !Number.isFinite(newState.zoom)
    ) {
      return;
    }

    if (
      newState.x !== this._state.x ||
      newState.y !== this._state.y ||
      newState.zoom !== this._state.zoom
    ) {
      this._state = newState;
      this._isDirty = true;
      this.applyTransform();
    }
  }

  public setZoom(
    zoom: number,
    screenAnchorX = this._viewportWidth / 2,
    screenAnchorY = this._viewportHeight / 2
  ): void {
    if (
      Number.isNaN(zoom) ||
      !Number.isFinite(screenAnchorX) ||
      !Number.isFinite(screenAnchorY)
    ) {
      return;
    }
    const newState = calculatePointerZoom(
      this._state,
      screenAnchorX,
      screenAnchorY,
      zoom,
      this._options.minZoom,
      this._options.maxZoom
    );

    if (
      !Number.isFinite(newState.x) ||
      !Number.isFinite(newState.y) ||
      !Number.isFinite(newState.zoom)
    ) {
      return;
    }

    this._state = newState;
    this._isDirty = true;
    this.applyTransform();
  }

  public setPan(x: number, y: number): void {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    this._state.x = x;
    this._state.y = y;
    this._isDirty = true;
    this.applyTransform();
  }

  public setVelocity(vx: number, vy: number): void {
    this._vx = vx;
    this._vy = vy;
  }

  public update(dt: number): boolean {
    if (Math.abs(this._vx) > 0.01 || Math.abs(this._vy) > 0.01) {
      this._state.x += this._vx * dt;
      this._state.y += this._vy * dt;
      const f = Math.pow(this._options.friction, dt);
      this._vx *= f;
      this._vy *= f;
      this._isDirty = true;
      this.applyTransform();
      return true;
    }
    this._vx = 0;
    this._vy = 0;
    return false;
  }

  public fitBounds(
    bounds: { minX: number; minY: number; maxX: number; maxY: number },
    padding = 60
  ): void {
    const newState = calculateFitBounds(
      bounds,
      this._viewportWidth,
      this._viewportHeight,
      padding,
      this._options.minZoom,
      this._options.maxZoom
    );
    this._state = newState;
    this._isDirty = true;
    this.applyTransform();
  }

  public fitToBounds(
    worldLeft: number,
    worldTop: number,
    worldWidth: number,
    worldHeight: number,
    padding = 48
  ): void {
    this.fitBounds(
      {
        minX: worldLeft,
        minY: worldTop,
        maxX: worldLeft + worldWidth,
        maxY: worldTop + worldHeight,
      },
      padding
    );
  }

  public getVisibleWorldBounds(): ViewportRect {
    return getVisibleWorldBounds(this._state, this._viewportWidth, this._viewportHeight);
  }

  public applyTransform(): void {
    if (
      !Number.isFinite(this._state.x) ||
      !Number.isFinite(this._state.y) ||
      !Number.isFinite(this._state.zoom)
    ) {
      return;
    }
    if (this._targetContainer) {
      this._targetContainer.position.set(this._state.x, this._state.y);
      this._targetContainer.scale.set(this._state.zoom);
    }
    this._isDirty = false;
    this._onTransformChange?.(this._state);
  }
}
