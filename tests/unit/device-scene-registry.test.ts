import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const registrySource = readFileSync(resolve('js/2d/device-scene-registry.js'), 'utf8');

function rect(left: number, top: number, width: number, height: number) {
  return {
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    x: left,
    y: top,
    toJSON: () => ({})
  } as DOMRect;
}

describe('DeviceSceneRegistry', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="viewport-canvas"></div>';
    const viewport = document.getElementById('viewport-canvas') as HTMLElement;
    viewport.getBoundingClientRect = () => rect(10, 20, 800, 600);
    (window as any).RackStudio = {
      ZOOM_STATE: { scale: 2, panX: 30, panY: 40 }
    };
    window.eval(registrySource);
  });

  function addDevice(id: string, left: number) {
    const device = document.createElement('div');
    device.className = 'mounted-device';
    device.id = id;
    device.dataset.instanceId = id;
    device.dataset.catalogKey = 'switch-48';
    device.dataset.rackId = 'rack-1';
    device.getBoundingClientRect = () => rect(left, 120, 400, 32);

    const port = document.createElement('div');
    port.className = 'port';
    port.dataset.portId = 'p1';
    port.dataset.portName = 'Gi1/0/1';
    port.dataset.portType = 'rj45';
    port.dataset.portSpeed = '1G';
    port.getBoundingClientRect = () => rect(left + 100, 128, 10, 10);
    device.appendChild(port);
    document.body.appendChild(device);
    return port;
  }

  it('measures one catalog template and projects it across device instances', () => {
    addDevice('dev-a', 100);
    addDevice('dev-b', 600);

    const registry = (window as any).RackStudio.DeviceSceneRegistry;
    expect(registry.captureFromDom('test')).toBe(true);

    const a = registry.getPortPoint('dev-a', 'p1');
    const b = registry.getPortPoint('dev-b', 'p1');
    expect(a.x).toBeCloseTo(82.5);
    expect(a.y).toBeCloseTo(36.5);
    expect(b.x - a.x).toBeCloseTo(250);

    const stats = registry.getStats();
    expect(stats.templates).toBe(1);
    expect(stats.templatePortRectReads).toBe(1);
    expect(stats.projectedPorts).toBe(2);
  });

  it('invalidates instance geometry without discarding reusable templates', () => {
    addDevice('dev-a', 100);
    const registry = (window as any).RackStudio.DeviceSceneRegistry;
    registry.captureFromDom('initial');
    registry.invalidate();

    expect(registry.getPortPoint('dev-a', 'p1')).toBeNull();
    expect(registry.getStats().templates).toBe(1);
    registry.captureFromDom('recapture');
    expect(registry.getStats().templatePortRectReads).toBe(1);
  });
});
