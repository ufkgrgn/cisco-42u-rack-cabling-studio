import { describe, it, expect } from 'vitest';
import {
  screenToWorld,
  worldToScreen,
  clampZoom,
  calculatePointerZoom,
  calculateFitBounds,
} from '../../src/engine/camera/affine';
import { Camera } from '../../src/engine/camera/Camera';
import { CameraController } from '../../src/engine/camera/CameraController';
import { EngineBridge } from '../../src/engine/bridge/EngineBridge';

describe('Adversarial Camera & Affine Math Verification (M2_1)', () => {
  // --------------------------------------------------------------------------
  // 1. Scale Boundary Clamping Stress
  // --------------------------------------------------------------------------
  describe('1. Scale Boundary Clamping', () => {
    it('clampZoom: enforces strictly [0.1, 4.0] across extreme numbers', () => {
      expect(clampZoom(0.1)).toBe(0.1);
      expect(clampZoom(4.0)).toBe(4.0);
      expect(clampZoom(0)).toBe(0.1);
      expect(clampZoom(-1000)).toBe(0.1);
      expect(clampZoom(-Infinity)).toBe(0.1);
      expect(clampZoom(1e-15)).toBe(0.1);
      expect(clampZoom(0.09999999)).toBe(0.1);
      expect(clampZoom(4.0000001)).toBe(4.0);
      expect(clampZoom(1e12)).toBe(4.0);
      expect(clampZoom(Infinity)).toBe(4.0);
    });

    it('Camera.zoomAt: clamping under 1000 consecutive extreme zoom-in steps', () => {
      const camera = new Camera();
      for (let i = 0; i < 1000; i++) {
        camera.zoomAt(500, 500, 1.5);
      }
      expect(camera.zoom).toBe(4.0);
      expect(camera.scale).toBe(4.0);
    });

    it('Camera.zoomAt: clamping under 1000 consecutive extreme zoom-out steps', () => {
      const camera = new Camera();
      for (let i = 0; i < 1000; i++) {
        camera.zoomAt(500, 500, 0.5);
      }
      expect(camera.zoom).toBe(0.1);
      expect(camera.scale).toBe(0.1);
    });

    it('Camera.setZoom: clamping with extreme values', () => {
      const camera = new Camera();
      camera.setZoom(1e9);
      expect(camera.zoom).toBe(4.0);

      camera.setZoom(-1e9);
      expect(camera.zoom).toBe(0.1);

      camera.setZoom(0);
      expect(camera.zoom).toBe(0.1);

      camera.setZoom(Infinity);
      expect(camera.zoom).toBe(4.0);

      camera.setZoom(-Infinity);
      expect(camera.zoom).toBe(0.1);
    });

    it('Camera.scale setter property behavior', () => {
      const camera = new Camera();
      // Setting camera.scale = 10 clamps to 4.0
      camera.scale = 10.0;
      expect(camera.zoom).toBe(4.0);
      expect(camera.scale).toBe(4.0);

      // Setting camera.scale = 0 clamps to 0.1 (no division by zero)
      camera.scale = 0;
      expect(camera.zoom).toBe(0.1);
      expect(camera.scale).toBe(0.1);

      // Setting camera.scale = Infinity clamps safely to 4.0
      camera.scale = Infinity;
      expect(camera.zoom).toBe(4.0);
      expect(camera.scale).toBe(4.0);

      // Setting camera.scale = -Infinity clamps safely to 0.1
      camera.scale = -Infinity;
      expect(camera.zoom).toBe(0.1);
      expect(camera.scale).toBe(0.1);

      // Setting camera.scale = NaN keeps existing valid zoom
      camera.scale = 2.5;
      expect(camera.zoom).toBe(2.5);
      camera.scale = NaN;
      expect(camera.zoom).toBe(2.5);
      expect(camera.scale).toBe(2.5);
    });

    it('calculateFitBounds: zoom output is strictly clamped within [0.1, 4.0]', () => {
      // Tiny bounds in huge viewport -> massive zoom requested
      const tinyFit = calculateFitBounds(
        { minX: 0, minY: 0, maxX: 0.001, maxY: 0.001 },
        1920,
        1080
      );
      expect(tinyFit.zoom).toBe(4.0);

      // Huge bounds in tiny viewport -> microscopic zoom requested
      const hugeFit = calculateFitBounds(
        { minX: -1e8, minY: -1e8, maxX: 1e8, maxY: 1e8 },
        100,
        100
      );
      expect(hugeFit.zoom).toBe(0.1);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Pointer-Anchored Zoom Stationarity Invariant
  // --------------------------------------------------------------------------
  describe('2. Pointer-Anchored Zoom Stationarity Invariant', () => {
    const testCases = [
      { initX: 0, initY: 0, initZoom: 1.0, anchorX: 960, anchorY: 540, factor: 1.25 },
      { initX: -500, initY: 300, initZoom: 2.0, anchorX: 100, anchorY: 100, factor: 0.75 },
      { initX: 1200, initY: -800, initZoom: 0.5, anchorX: 1920, anchorY: 1080, factor: 2.5 },
      { initX: -123.456, initY: 789.012, initZoom: 1.4142, anchorX: 314.15, anchorY: 271.82, factor: 1.8 },
      { initX: 0, initY: 0, initZoom: 1.0, anchorX: 0, anchorY: 0, factor: 0.5 },
      { initX: 50, initY: 50, initZoom: 3.8, anchorX: 400, anchorY: 300, factor: 2.0 }, // triggers clamp to 4.0
      { initX: 50, initY: 50, initZoom: 0.15, anchorX: 400, anchorY: 300, factor: 0.2 }, // triggers clamp to 0.1
    ];

    testCases.forEach((tc, idx) => {
      it(`preserves stationarity across zoom (case ${idx + 1})`, () => {
        const camera = new Camera();
        camera.setPan(tc.initX, tc.initY);
        camera.setZoom(tc.initZoom);

        const worldBefore = camera.screenToWorld(tc.anchorX, tc.anchorY);
        camera.zoomAt(tc.anchorX, tc.anchorY, tc.factor);
        const worldAfter = camera.screenToWorld(tc.anchorX, tc.anchorY);

        const diffX = Math.abs(worldAfter.x - worldBefore.x);
        const diffY = Math.abs(worldAfter.y - worldBefore.y);

        expect(diffX).toBeLessThan(1e-6);
        expect(diffY).toBeLessThan(1e-6);
      });
    });

    it('stationarity holds across 500 multi-point random zoom sequence', () => {
      const camera = new Camera();
      camera.setPan(200, -150);
      camera.setZoom(1.0);

      let maxStationarityError = 0;

      for (let i = 0; i < 500; i++) {
        const anchorX = (i * 37.1) % 1920;
        const anchorY = (i * 53.7) % 1080;
        const factor = 0.8 + ((i * 13) % 40) / 100; // 0.8 to 1.2

        const w0 = camera.screenToWorld(anchorX, anchorY);
        camera.zoomAt(anchorX, anchorY, factor);
        const w1 = camera.screenToWorld(anchorX, anchorY);

        const err = Math.max(Math.abs(w1.x - w0.x), Math.abs(w1.y - w0.y));
        if (err > maxStationarityError) maxStationarityError = err;
      }

      console.log('Max stationarity error over 500 random zooms:', maxStationarityError);
      expect(maxStationarityError).toBeLessThan(1e-6);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Non-Finite Number Handling (NaN, Infinity, -Infinity)
  // --------------------------------------------------------------------------
  describe('3. Non-Finite Numbers Handling', () => {
    it('clampZoom with NaN', () => {
      const res = clampZoom(NaN);
      expect(Number.isFinite(res)).toBe(true);
      expect(res).toBeGreaterThanOrEqual(0.1);
      expect(res).toBeLessThanOrEqual(4.0);
    });

    it('calculatePointerZoom with NaN and Infinity', () => {
      const current = { x: 100, y: 100, zoom: 1.0 };

      const resNaNZoom = calculatePointerZoom(current, 500, 500, NaN);
      expect(Number.isNaN(resNaNZoom.x)).toBe(false);
      expect(Number.isNaN(resNaNZoom.y)).toBe(false);
      expect(Number.isNaN(resNaNZoom.zoom)).toBe(false);

      const resNaNAnchorX = calculatePointerZoom(current, NaN, 500, 1.5);
      expect(Number.isNaN(resNaNAnchorX.x)).toBe(false);
      expect(Number.isNaN(resNaNAnchorX.y)).toBe(false);

      const resInfAnchor = calculatePointerZoom(current, Infinity, 500, 1.5);
      expect(Number.isNaN(resInfAnchor.x)).toBe(false);
      expect(Number.isNaN(resInfAnchor.y)).toBe(false);
    });

    it('calculatePointerZoom with fresh camera on Infinity zoom factor', () => {
      const current = { x: 100, y: 100, zoom: 1.0 };
      const resInf = calculatePointerZoom(current, 500, 500, Infinity);
      expect(resInf.zoom).toBe(4.0);
      expect(Number.isFinite(resInf.x)).toBe(true);
      expect(Number.isFinite(resInf.y)).toBe(true);
    });

    it('calculatePointerZoom with -Infinity zoom factor', () => {
      const current = { x: 100, y: 100, zoom: 1.0 };
      const resNegInf = calculatePointerZoom(current, 500, 500, -Infinity);
      expect(resNegInf.zoom).toBe(0.1);
      expect(Number.isFinite(resNegInf.x)).toBe(true);
      expect(Number.isFinite(resNegInf.y)).toBe(true);
    });

    it('Camera.zoomAt with fresh camera on Infinity factor', () => {
      const camera = new Camera();
      camera.zoomAt(500, 500, Infinity);
      expect(camera.zoom).toBe(4.0);
      expect(Number.isFinite(camera.x)).toBe(true);
      expect(Number.isFinite(camera.y)).toBe(true);
    });

    it('Camera.zoomAt with fresh camera on -Infinity factor', () => {
      const camera = new Camera();
      camera.zoomAt(500, 500, -Infinity);
      expect(camera.zoom).toBe(0.1);
      expect(Number.isFinite(camera.x)).toBe(true);
      expect(Number.isFinite(camera.y)).toBe(true);
    });

    it('Camera.zoomAt with NaN factor: does not poison camera state to NaN', () => {
      const camera = new Camera();
      camera.zoomAt(500, 500, NaN);
      const isCorrupted = Number.isNaN(camera.state.x) || Number.isNaN(camera.state.y) || Number.isNaN(camera.state.zoom);
      expect(isCorrupted).toBe(false);
      expect(camera.zoom).toBe(1.0);
    });

    it('Camera.zoomAt with NaN anchor: does not poison translation to NaN', () => {
      const camera = new Camera();
      camera.zoomAt(NaN, 500, 1.5);
      const isCorrupted = Number.isNaN(camera.state.x) || Number.isNaN(camera.state.y);
      expect(isCorrupted).toBe(false);
      expect(camera.zoom).toBe(1.0);
    });

    it('Camera.setZoom with NaN: does not poison camera state to NaN', () => {
      const camera = new Camera();
      camera.setZoom(NaN);
      const isCorrupted = Number.isNaN(camera.state.zoom);
      expect(isCorrupted).toBe(false);
      expect(camera.zoom).toBe(1.0);
    });

    it('Camera.panBy with NaN: does not poison translation', () => {
      const camera = new Camera();
      camera.panBy(NaN, 0);
      const isCorrupted = Number.isNaN(camera.state.x);
      expect(isCorrupted).toBe(false);
      expect(camera.state.x).toBe(0);
    });

    it('Camera.zoomAt(NaN, NaN, NaN) leaves camera state intact', () => {
      const camera = new Camera();
      camera.setPan(320, -180);
      camera.scale = 2.2;
      const stateBefore = { ...camera.state };

      camera.zoomAt(NaN, NaN, NaN);

      expect(camera.state.x).toBe(stateBefore.x);
      expect(camera.state.y).toBe(stateBefore.y);
      expect(camera.state.zoom).toBe(stateBefore.zoom);
      expect(camera.state.x).toBe(320);
      expect(camera.state.y).toBe(-180);
      expect(camera.state.zoom).toBe(2.2);
    });

    it('Camera.panBy(Infinity, NaN) leaves camera state intact', () => {
      const camera = new Camera();
      camera.setPan(320, -180);
      camera.scale = 2.2;
      const stateBefore = { ...camera.state };

      camera.panBy(Infinity, NaN);

      expect(camera.state.x).toBe(stateBefore.x);
      expect(camera.state.y).toBe(stateBefore.y);
      expect(camera.state.zoom).toBe(stateBefore.zoom);
      expect(camera.state.x).toBe(320);
      expect(camera.state.y).toBe(-180);
      expect(camera.state.zoom).toBe(2.2);
    });

    it('Camera.panBy with various non-finite combinations leaves state intact', () => {
      const camera = new Camera();
      camera.setPan(100, 200);
      camera.scale = 1.5;

      camera.panBy(NaN, Infinity);
      expect(camera.state.x).toBe(100);
      expect(camera.state.y).toBe(200);
      expect(camera.state.zoom).toBe(1.5);

      camera.panBy(-Infinity, NaN);
      expect(camera.state.x).toBe(100);
      expect(camera.state.y).toBe(200);
      expect(camera.state.zoom).toBe(1.5);

      camera.panBy(Infinity, Infinity);
      expect(camera.state.x).toBe(100);
      expect(camera.state.y).toBe(200);
      expect(camera.state.zoom).toBe(1.5);

      camera.panBy(NaN, NaN);
      expect(camera.state.x).toBe(100);
      expect(camera.state.y).toBe(200);
      expect(camera.state.zoom).toBe(1.5);

      camera.panBy(Infinity, 10);
      expect(camera.state.x).toBe(100);
      expect(camera.state.y).toBe(200);

      camera.panBy(10, -Infinity);
      expect(camera.state.x).toBe(100);
      expect(camera.state.y).toBe(200);
    });

    it('Camera.panX and panY setters reject non-finite inputs and maintain state', () => {
      const camera = new Camera();
      camera.setPan(50, 75);

      camera.panX = NaN;
      camera.panY = Infinity;
      expect(camera.panX).toBe(50);
      expect(camera.panY).toBe(75);

      camera.panX = -Infinity;
      camera.panY = NaN;
      expect(camera.panX).toBe(50);
      expect(camera.panY).toBe(75);
    });

    it('Camera.setPan rejects non-finite inputs', () => {
      const camera = new Camera();
      camera.setPan(15, 25);

      camera.setPan(NaN, 100);
      expect(camera.panX).toBe(15);
      expect(camera.panY).toBe(25);

      camera.setPan(100, Infinity);
      expect(camera.panX).toBe(15);
      expect(camera.panY).toBe(25);
    });

    it('Camera.zoomAt with infinite anchor coordinates leaves state intact', () => {
      const camera = new Camera();
      camera.setPan(50, 60);
      camera.scale = 1.8;

      camera.zoomAt(Infinity, 500, 1.5);
      expect(camera.state.x).toBe(50);
      expect(camera.state.y).toBe(60);
      expect(camera.state.zoom).toBe(1.8);

      camera.zoomAt(500, -Infinity, 1.5);
      expect(camera.state.x).toBe(50);
      expect(camera.state.y).toBe(60);
      expect(camera.state.zoom).toBe(1.8);
    });

    it('CameraController when attached: handles bridge events with NaN/Infinity payloads', () => {
      const bridge = EngineBridge.getInstance();
      const camera = new Camera();
      const el = document.createElement('div');
      const controller = new CameraController(camera, bridge);
      controller.attach(el);

      // Test 1: camera:zoom with NaN
      bridge.emit('camera:zoom', { factor: NaN, screenAnchorX: 100, screenAnchorY: 100 });
      expect(Number.isNaN(camera.state.x)).toBe(false);
      expect(Number.isNaN(camera.state.zoom)).toBe(false);

      // Test 2: camera:zoom-to with NaN factor
      const camera2 = new Camera();
      const controller2 = new CameraController(camera2, bridge);
      controller2.attach(el);
      bridge.emit('camera:zoom-to', { factor: NaN, screenX: 100, screenY: 100 });
      expect(Number.isNaN(camera2.state.zoom)).toBe(false);

      // Test 3: camera:zoom-to with NaN screenX
      const camera3 = new Camera();
      const controller3 = new CameraController(camera3, bridge);
      controller3.attach(el);
      bridge.emit('camera:zoom-to', { factor: 2.0, screenX: NaN, screenY: 100 });
      expect(Number.isNaN(camera3.state.x)).toBe(false);

      // Test 4: camera:pan with NaN
      const camera4 = new Camera();
      const controller4 = new CameraController(camera4, bridge);
      controller4.attach(el);
      bridge.emit('camera:pan', { dx: NaN, dy: 10 });
      expect(Number.isNaN(camera4.state.x)).toBe(false);

      // Test 5: wheel event with NaN deltaY using mock event
      const camera5 = new Camera();
      const controller5 = new CameraController(camera5, bridge);
      controller5.attach(el);
      const mockWheelEvt = {
        preventDefault: () => {},
        deltaY: NaN,
        deltaX: 0,
        clientX: 200,
        clientY: 200,
        ctrlKey: true,
        shiftKey: false,
      } as unknown as WheelEvent;
      // invoke via addEventListener or simulated trigger
      (controller5 as any)._onWheel(mockWheelEvt);
      expect(Number.isNaN(camera5.state.zoom)).toBe(false);

      controller.detach();
      controller2.detach();
      controller3.detach();
      controller4.detach();
      controller5.detach();
    });
  });

  // --------------------------------------------------------------------------
  // 4. Inverse Roundtrip Identity (10,000 Points Lattice)
  // --------------------------------------------------------------------------
  describe('4. Inverse Roundtrip Identity', () => {
    it('worldToScreen(screenToWorld(p)) == p within epsilon (1e-6) across 10,000 points', () => {
      const cameraConfigs = [
        { x: 0, y: 0, zoom: 1.0 },
        { x: -5000, y: 8000, zoom: 0.1 },
        { x: 12345.67, y: -9876.54, zoom: 4.0 },
        { x: 314.159, y: 271.828, zoom: 1.41421356 },
        { x: -0.001, y: 0.002, zoom: 0.33333333 },
      ];

      let maxErrorScreenToWorldToScreen = 0;
      let maxErrorWorldToScreenToWorld = 0;

      for (const camera of cameraConfigs) {
        for (let i = 0; i < 2000; i++) {
          // Test range from -100,000 to +100,000 with fractional subpixels
          const sx = -100000 + ((i * 100.12345) % 200000);
          const sy = -100000 + ((i * 153.67891) % 200000);

          // 1. screen -> world -> screen
          const w = screenToWorld(sx, sy, camera);
          const sRound = worldToScreen(w.x, w.y, camera);
          const errS = Math.max(Math.abs(sRound.x - sx), Math.abs(sRound.y - sy));
          if (errS > maxErrorScreenToWorldToScreen) maxErrorScreenToWorldToScreen = errS;

          // 2. world -> screen -> world
          const wx = sx;
          const wy = sy;
          const s = worldToScreen(wx, wy, camera);
          const wRound = screenToWorld(s.x, s.y, camera);
          const errW = Math.max(Math.abs(wRound.x - wx), Math.abs(wRound.y - wy));
          if (errW > maxErrorWorldToScreenToWorld) maxErrorWorldToScreenToWorld = errW;
        }
      }

      console.log('Max Roundtrip Error Screen->World->Screen:', maxErrorScreenToWorldToScreen);
      console.log('Max Roundtrip Error World->Screen->World:', maxErrorWorldToScreenToWorld);

      expect(maxErrorScreenToWorldToScreen).toBeLessThan(1e-6);
      expect(maxErrorWorldToScreenToWorld).toBeLessThan(1e-6);
    });
  });
});
