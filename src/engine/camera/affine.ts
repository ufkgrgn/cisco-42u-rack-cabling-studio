// ============================================================================
// Pure Affine 2D Mathematical Coordinate Transformation
// Guarantees Zero-DOM layout queries and zero-jump pointer-anchored zooming
// ============================================================================

import { WorldCoordinate, ScreenCoordinate, CameraState, ViewportRect } from './types';

/**
 * Forward Projection: World Space (X, Y) -> Screen Space (x, y)
 * Formula: P_screen = S * P_world + T
 */
export function worldToScreen(
  worldX: number,
  worldY: number,
  camera: { x: number; y: number; zoom: number }
): ScreenCoordinate {
  const zoom = Number.isFinite(camera.zoom) && camera.zoom > 0 ? camera.zoom : 1.0;
  const camX = Number.isFinite(camera.x) ? camera.x : 0;
  const camY = Number.isFinite(camera.y) ? camera.y : 0;
  const wx = Number.isFinite(worldX) ? worldX : 0;
  const wy = Number.isFinite(worldY) ? worldY : 0;
  return {
    x: wx * zoom + camX,
    y: wy * zoom + camY,
  };
}

/**
 * Inverse Projection: Screen Space (x, y) -> World Space (X, Y)
 * Formula: P_world = (P_screen - T) / S
 */
export function screenToWorld(
  screenX: number,
  screenY: number,
  camera: { x: number; y: number; zoom: number }
): WorldCoordinate {
  const zoom = Number.isFinite(camera.zoom) && camera.zoom > 0 ? camera.zoom : 1.0;
  const camX = Number.isFinite(camera.x) ? camera.x : 0;
  const camY = Number.isFinite(camera.y) ? camera.y : 0;
  const sx = Number.isFinite(screenX) ? screenX : 0;
  const sy = Number.isFinite(screenY) ? screenY : 0;
  return {
    x: (sx - camX) / zoom,
    y: (sy - camY) / zoom,
  };
}

/**
 * Clamps zoom scale factor to specified bounds (default [0.1, 4.0])
 */
export function clampZoom(zoom: number, minZoom = 0.1, maxZoom = 4.0): number {
  if (Number.isNaN(zoom)) return 1.0;
  if (!Number.isFinite(minZoom) || !Number.isFinite(maxZoom)) return 1.0;
  if (zoom <= minZoom) return minZoom;
  if (zoom >= maxZoom) return maxZoom;
  return zoom;
}

/**
 * Calculates pointer-anchored zoom transformation.
 * Invariant: The world coordinate beneath (screenAnchorX, screenAnchorY)
 * remains stationary on screen after zoom is applied.
 *
 * Formula:
 *   S_new = clamp(targetZoom, minZoom, maxZoom)
 *   T_new = P_anchor - S_new * ((P_anchor - T_old) / S_old)
 */
export function calculatePointerZoom(
  current: CameraState,
  screenAnchorX: number,
  screenAnchorY: number,
  targetZoom: number,
  minZoom = 0.1,
  maxZoom = 4.0
): CameraState {
  if (
    !Number.isFinite(screenAnchorX) ||
    !Number.isFinite(screenAnchorY) ||
    Number.isNaN(targetZoom) ||
    !Number.isFinite(current.x) ||
    !Number.isFinite(current.y) ||
    !Number.isFinite(current.zoom) ||
    current.zoom <= 0
  ) {
    return current;
  }

  const nextZoom = clampZoom(targetZoom, minZoom, maxZoom);

  if (Math.abs(nextZoom - current.zoom) < 1e-6) {
    return current;
  }

  // Pre-zoom world anchor coordinate
  const worldAnchorX = (screenAnchorX - current.x) / current.zoom;
  const worldAnchorY = (screenAnchorY - current.y) / current.zoom;

  // New translation maintaining anchor stationarity
  const nextX = screenAnchorX - worldAnchorX * nextZoom;
  const nextY = screenAnchorY - worldAnchorY * nextZoom;

  if (!Number.isFinite(nextX) || !Number.isFinite(nextY) || !Number.isFinite(nextZoom)) {
    return current;
  }

  return {
    x: nextX,
    y: nextY,
    zoom: nextZoom,
  };
}

/**
 * Calculates visible world bounding box for spatial frustum culling.
 */
export function getVisibleWorldBounds(
  camera: CameraState,
  viewportWidth: number,
  viewportHeight: number
): ViewportRect {
  const topLeft = screenToWorld(0, 0, camera);
  const bottomRight = screenToWorld(viewportWidth, viewportHeight, camera);

  const left = Math.min(topLeft.x, bottomRight.x);
  const top = Math.min(topLeft.y, bottomRight.y);
  const right = Math.max(topLeft.x, bottomRight.x);
  const bottom = Math.max(topLeft.y, bottomRight.y);

  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
  };
}

/**
 * Calculates camera state to fit a given world bounding box into the viewport with padding.
 */
export function calculateFitBounds(
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  viewportWidth: number,
  viewportHeight: number,
  padding = 60,
  minZoom = 0.1,
  maxZoom = 4.0
): CameraState {
  const boundsWidth = Math.max(1, bounds.maxX - bounds.minX);
  const boundsHeight = Math.max(1, bounds.maxY - bounds.minY);

  const availWidth = Math.max(10, viewportWidth - padding * 2);
  const availHeight = Math.max(10, viewportHeight - padding * 2);

  const scaleX = availWidth / boundsWidth;
  const scaleY = availHeight / boundsHeight;
  const targetZoom = clampZoom(Math.min(scaleX, scaleY), minZoom, maxZoom);

  const boundsCenterX = (bounds.minX + bounds.maxX) / 2;
  const boundsCenterY = (bounds.minY + bounds.maxY) / 2;

  const targetX = viewportWidth / 2 - boundsCenterX * targetZoom;
  const targetY = viewportHeight / 2 - boundsCenterY * targetZoom;

  return {
    x: targetX,
    y: targetY,
    zoom: targetZoom,
  };
}
