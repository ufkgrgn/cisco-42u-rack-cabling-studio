import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Camera } from '../../src/engine/camera/Camera';
import { CameraController } from '../../src/engine/camera/CameraController';
import { EngineBridge } from '../../src/engine/bridge/EngineBridge';

describe('Multi-Touch & Mobile Gesture Camera Controller Suite', () => {
  let bridge: EngineBridge;
  let camera: Camera;
  let controller: CameraController;
  let element: HTMLElement;

  beforeEach(() => {
    bridge = EngineBridge.getInstance();
    camera = new Camera();
    controller = new CameraController(camera, bridge);
    element = document.createElement('div');
    element.getBoundingClientRect = () => ({
      width: 1000,
      height: 800,
      top: 0,
      left: 0,
      right: 1000,
      bottom: 800,
      x: 0,
      y: 0,
      toJSON: () => {},
    });
    element.setPointerCapture = vi.fn();
    element.releasePointerCapture = vi.fn();
    controller.attach(element);
  });

  afterEach(() => {
    controller.detach();
  });

  it('handles single finger touch pan', () => {
    const downEvt = new Event('pointerdown') as any;
    downEvt.pointerId = 1;
    downEvt.pointerType = 'touch';
    downEvt.clientX = 200;
    downEvt.clientY = 200;
    element.dispatchEvent(downEvt);

    const moveEvt = new Event('pointermove') as any;
    moveEvt.pointerId = 1;
    moveEvt.pointerType = 'touch';
    moveEvt.clientX = 250;
    moveEvt.clientY = 270;
    element.dispatchEvent(moveEvt);

    expect(camera.panX).toBe(50);
    expect(camera.panY).toBe(70);
  });

  it('handles two-finger pinch-to-zoom', () => {
    const initialZoom = camera.zoom;

    const p1Down = new Event('pointerdown') as any;
    p1Down.pointerId = 1;
    p1Down.pointerType = 'touch';
    p1Down.clientX = 100;
    p1Down.clientY = 100;
    element.dispatchEvent(p1Down);

    const p2Down = new Event('pointerdown') as any;
    p2Down.pointerId = 2;
    p2Down.pointerType = 'touch';
    p2Down.clientX = 200;
    p2Down.clientY = 100;
    element.dispatchEvent(p2Down);

    const p1Move = new Event('pointermove') as any;
    p1Move.pointerId = 1;
    p1Move.pointerType = 'touch';
    p1Move.clientX = 50;
    p1Move.clientY = 100;
    element.dispatchEvent(p1Move);

    const p2Move = new Event('pointermove') as any;
    p2Move.pointerId = 2;
    p2Move.pointerType = 'touch';
    p2Move.clientX = 250;
    p2Move.clientY = 100;
    element.dispatchEvent(p2Move);

    expect(camera.zoom).toBeGreaterThan(initialZoom);
  });

  it('handles two-finger simultaneous pan while pinching', () => {
    const p1Down = new Event('pointerdown') as any;
    p1Down.pointerId = 1;
    p1Down.pointerType = 'touch';
    p1Down.clientX = 100;
    p1Down.clientY = 100;
    element.dispatchEvent(p1Down);

    const p2Down = new Event('pointerdown') as any;
    p2Down.pointerId = 2;
    p2Down.pointerType = 'touch';
    p2Down.clientX = 200;
    p2Down.clientY = 100;
    element.dispatchEvent(p2Down);

    const p1Move = new Event('pointermove') as any;
    p1Move.pointerId = 1;
    p1Move.pointerType = 'touch';
    p1Move.clientX = 140;
    p1Move.clientY = 100;
    element.dispatchEvent(p1Move);

    const p2Move = new Event('pointermove') as any;
    p2Move.pointerId = 2;
    p2Move.pointerType = 'touch';
    p2Move.clientX = 240;
    p2Move.clientY = 100;
    element.dispatchEvent(p2Move);

    expect(camera.panX).toBeGreaterThan(0);
  });

  it('smoothly transitions from two fingers to one finger', () => {
    const p1Down = new Event('pointerdown') as any;
    p1Down.pointerId = 1;
    p1Down.pointerType = 'touch';
    p1Down.clientX = 100;
    p1Down.clientY = 100;
    element.dispatchEvent(p1Down);

    const p2Down = new Event('pointerdown') as any;
    p2Down.pointerId = 2;
    p2Down.pointerType = 'touch';
    p2Down.clientX = 200;
    p2Down.clientY = 100;
    element.dispatchEvent(p2Down);

    const p2Up = new Event('pointerup') as any;
    p2Up.pointerId = 2;
    p2Up.pointerType = 'touch';
    p2Up.clientX = 200;
    p2Up.clientY = 100;
    element.dispatchEvent(p2Up);

    const panXBefore = camera.panX;
    const p1Move = new Event('pointermove') as any;
    p1Move.pointerId = 1;
    p1Move.pointerType = 'touch';
    p1Move.clientX = 130;
    p1Move.clientY = 100;
    element.dispatchEvent(p1Move);

    expect(camera.panX).toBe(panXBefore + 30);
  });

  it('triggers double tap zoom in when zoomed out', () => {
    camera.setZoom(0.5);

    const t1Down = new Event('pointerdown') as any;
    t1Down.pointerId = 1;
    t1Down.pointerType = 'touch';
    t1Down.clientX = 500;
    t1Down.clientY = 400;
    element.dispatchEvent(t1Down);

    const t1Up = new Event('pointerup') as any;
    t1Up.pointerId = 1;
    t1Up.pointerType = 'touch';
    t1Up.clientX = 500;
    t1Up.clientY = 400;
    element.dispatchEvent(t1Up);

    const t2Down = new Event('pointerdown') as any;
    t2Down.pointerId = 1;
    t2Down.pointerType = 'touch';
    t2Down.clientX = 502;
    t2Down.clientY = 401;
    element.dispatchEvent(t2Down);

    const t2Up = new Event('pointerup') as any;
    t2Up.pointerId = 1;
    t2Up.pointerType = 'touch';
    t2Up.clientX = 502;
    t2Up.clientY = 401;
    element.dispatchEvent(t2Up);

    expect(camera.zoom).toBeGreaterThan(0.5);
  });
});
