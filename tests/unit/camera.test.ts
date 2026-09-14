import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Container } from 'pixi.js';
import {
  screenToWorld,
  worldToScreen,
  clampZoom,
  calculatePointerZoom,
  getVisibleWorldBounds,
  calculateFitBounds,
} from '../../src/engine/camera/affine';
import { Camera } from '../../src/engine/camera/Camera';
import { EngineBridge } from '../../src/engine/bridge/EngineBridge';

describe('Milestone M2: Camera & Affine Math Suite (F1.2)', () => {
  describe('Affine Transformations (Forward & Inverse)', () => {
    it('provides identity mapping when zoom=1.0 and pan=(0,0)', () => {
      const camera = { x: 0, y: 0, zoom: 1.0 };
      expect(worldToScreen(150, 320, camera)).toEqual({ x: 150, y: 320 });
      expect(screenToWorld(150, 320, camera)).toEqual({ x: 150, y: 320 });
    });

    it('satisfies round-trip transformation identity: screenToWorld(worldToScreen(P)) === P', () => {
      const camera = { x: -450, y: 220, zoom: 1.75 };
      const originalWorld = { x: 1280.5, y: 720.25 };
      const screen = worldToScreen(originalWorld.x, originalWorld.y, camera);
      const invertedWorld = screenToWorld(screen.x, screen.y, camera);

      expect(invertedWorld.x).toBeCloseTo(originalWorld.x, 5);
      expect(invertedWorld.y).toBeCloseTo(originalWorld.y, 5);
    });

    it('correctly scales and offsets world points to screen', () => {
      const camera = { x: 100, y: 50, zoom: 2.0 };
      expect(worldToScreen(10, 20, camera)).toEqual({ x: 120, y: 90 });
      expect(screenToWorld(120, 90, camera)).toEqual({ x: 10, y: 20 });
    });

    it('handles negative coordinates and extreme zoom scales properly', () => {
      const camera = { x: 500, y: -300, zoom: 0.1 };
      const originalWorld = { x: -2000, y: 4000 };
      const screen = worldToScreen(originalWorld.x, originalWorld.y, camera);
      const inverted = screenToWorld(screen.x, screen.y, camera);

      expect(inverted.x).toBeCloseTo(originalWorld.x, 3);
      expect(inverted.y).toBeCloseTo(originalWorld.y, 3);
    });
  });

  describe('Pointer-Anchored Zoom Invariant', () => {
    it('keeps the world point beneath cursor stationary on screen across zoom in', () => {
      const initial = { x: 100, y: 150, zoom: 1.0 };
      const cursorScreen = { x: 400, y: 300 };

      // World point directly under cursor before zoom
      const worldBefore = screenToWorld(cursorScreen.x, cursorScreen.y, initial);

      // Zoom in by factor 1.5
      const zoomedIn = calculatePointerZoom(initial, cursorScreen.x, cursorScreen.y, 1.5);
      const worldAfterIn = screenToWorld(cursorScreen.x, cursorScreen.y, zoomedIn);

      expect(worldAfterIn.x).toBeCloseTo(worldBefore.x, 5);
      expect(worldAfterIn.y).toBeCloseTo(worldBefore.y, 5);
    });

    it('keeps the world point beneath cursor stationary on screen across zoom out', () => {
      const initial = { x: 250, y: -80, zoom: 2.0 };
      const cursorScreen = { x: 600, y: 450 };

      const worldBefore = screenToWorld(cursorScreen.x, cursorScreen.y, initial);
      const zoomedOut = calculatePointerZoom(initial, cursorScreen.x, cursorScreen.y, 0.5);
      const worldAfterOut = screenToWorld(cursorScreen.x, cursorScreen.y, zoomedOut);

      expect(worldAfterOut.x).toBeCloseTo(worldBefore.x, 5);
      expect(worldAfterOut.y).toBeCloseTo(worldBefore.y, 5);
    });
  });

  describe('Scale Clamping [0.1x .. 4.0x]', () => {
    it('clamps zoom scale strictly between 0.1 and 4.0', () => {
      expect(clampZoom(0.01)).toBe(0.1);
      expect(clampZoom(0.099)).toBe(0.1);
      expect(clampZoom(2.5)).toBe(2.5);
      expect(clampZoom(4.0)).toBe(4.0);
      expect(clampZoom(9.9)).toBe(4.0);
    });

    it('does not alter translation when zoom target exceeds boundary', () => {
      const current = { x: 50, y: 50, zoom: 4.0 };
      const result = calculatePointerZoom(current, 200, 200, 5.0);
      expect(result.zoom).toBe(4.0);
      expect(result.x).toBe(50);
      expect(result.y).toBe(50);
    });

    it('does not alter translation when zoom target is below lower boundary', () => {
      const current = { x: 50, y: 50, zoom: 0.1 };
      const result = calculatePointerZoom(current, 200, 200, 0.05);
      expect(result.zoom).toBe(0.1);
      expect(result.x).toBe(50);
      expect(result.y).toBe(50);
    });
  });

  describe('Visible World Bounds & Frustum Culling Geometry', () => {
    it('calculates the exact world rectangle visible within the viewport', () => {
      const camera = { x: 100, y: 50, zoom: 2.0 };
      const viewportRect = getVisibleWorldBounds(camera, 800, 600);

      // screen 0,0 -> (0-100)/2 = -50, (0-50)/2 = -25
      expect(viewportRect.left).toBe(-50);
      expect(viewportRect.top).toBe(-25);
      // screen 800,600 -> (800-100)/2 = 350, (600-50)/2 = 275
      expect(viewportRect.right).toBe(350);
      expect(viewportRect.bottom).toBe(275);
      expect(viewportRect.width).toBe(400);
      expect(viewportRect.height).toBe(300);
    });
  });

  describe('Calculate Fit Bounds', () => {
    it('centers and scales bounds into viewport with padding', () => {
      const bounds = { minX: 0, minY: 0, maxX: 1000, maxY: 1000 };
      const fit = calculateFitBounds(bounds, 800, 800, 50, 0.1, 4.0);

      // Available dimension: 800 - 100 = 700. bounds: 1000 => scale 0.7
      expect(fit.zoom).toBeCloseTo(0.7, 3);
      // Centered at 400
      expect(fit.x).toBeCloseTo(400 - 500 * 0.7, 3);
      expect(fit.y).toBeCloseTo(400 - 500 * 0.7, 3);
    });
  });

  describe('Camera Class & Container Transform Updates', () => {
    let container: Container;
    let camera: Camera;

    beforeEach(() => {
      container = new Container();
      camera = new Camera(container, { width: 1000, height: 800 });
    });

    it('applies pan and zoom transforms directly to the target container', () => {
      camera.panBy(120, -60);
      expect(container.position.x).toBe(120);
      expect(container.position.y).toBe(-60);

      camera.zoomAt(500, 400, 2.0);
      expect(container.scale.x).toBe(2.0);
      expect(container.scale.y).toBe(2.0);
    });

    it('supports fitToBounds', () => {
      camera.fitToBounds(0, 0, 754, 1408, 50);
      expect(camera.zoom).toBeGreaterThanOrEqual(0.1);
      expect(camera.zoom).toBeLessThanOrEqual(4.0);
      expect(container.scale.x).toBe(camera.zoom);
    });

    it('clamps zoom scale on setZoom', () => {
      camera.setZoom(10.0);
      expect(camera.zoom).toBe(4.0);

      camera.setZoom(0.01);
      expect(camera.zoom).toBe(0.1);
    });
  });

  describe('EngineBridge Integration', () => {
    it('emits viewport:change when camera transforms', () => {
      const bridge = EngineBridge.getInstance();
      const camera = new Camera();
      const listener = vi.fn();
      bridge.on('viewport:change', listener);

      camera.setOnChange((state) => {
        bridge.emit('viewport:change', { zoom: state.zoom, panX: state.x, panY: state.y });
      });

      camera.panBy(50, -25);
      expect(listener).toHaveBeenCalledWith({ zoom: 1.0, panX: 50, panY: -25 });
    });
  });
});
