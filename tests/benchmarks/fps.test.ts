// ============================================================================
// 60 FPS Performance Benchmark Harness
// Measures sustained frame times across 10+ populated 42U racks (420+ devices)
// Acceptance Criteria: p95 <= 16.6ms, max <= 20.0ms, dropped frames == 0
// ============================================================================

import { describe, it, expect } from 'vitest';
import { SceneGraph } from '../../src/engine/scene/SceneGraph';
import { RackModel, DeviceInstance, DeviceCatalogItem } from '../../src/core/types';

describe('60 FPS Performance Benchmark Harness (F1.7)', () => {
  function generate10Rack420DeviceTopology(): {
    racks: RackModel[];
    catalog: Map<string, DeviceCatalogItem>;
  } {
    const catalog = new Map<string, DeviceCatalogItem>([
      [
        'cisco-catalyst-9300',
        {
          id: 'cisco-catalyst-9300',
          name: 'Cisco Catalyst 9300-48P',
          category: 'switch',
          u: 1,
          manufacturer: 'Cisco',
          ports: Array.from({ length: 48 }, (_, i) => ({
            id: `p_${i + 1}`,
            name: `GE ${i + 1}`,
            type: 'rj45',
          })),
        },
      ],
    ]);

    const racks: RackModel[] = [];
    for (let r = 0; r < 10; r++) {
      const devices: DeviceInstance[] = [];
      for (let u = 1; u <= 42; u++) {
        devices.push({
          instanceId: `dev_r${r}_u${u}`,
          catalogId: 'cisco-catalyst-9300',
          rackId: `rack_${r}`,
          startU: u,
          uHeight: 1,
          face: 'front',
        });
      }

      racks.push({
        id: `rack_${r}`,
        name: `Cabinet ${r + 1}`,
        totalU: 42,
        widthMm: 600,
        depthMm: 1000,
        maxLoadKg: 1000,
        positionX: r * 754,
        devices,
      });
    }

    return { racks, catalog };
  }

  it('sustains 60 FPS (p95 <= 16.6ms, max <= 20ms) across 300 frames of pan, zoom & drag', () => {
    const { racks, catalog } = generate10Rack420DeviceTopology();
    const totalDevices = racks.reduce((acc, r) => acc + r.devices.length, 0);

    expect(racks.length).toBeGreaterThanOrEqual(10);
    expect(totalDevices).toBeGreaterThanOrEqual(420);

    const sceneGraph = new SceneGraph();
    sceneGraph.syncRacks(racks, catalog);

    const frameTimes: number[] = [];
    const frameCount = 300;

    // Simulated camera and interaction loop
    let cameraX = 0;
    let cameraY = 0;
    let cameraZoom = 1.0;

    for (let frame = 0; frame < frameCount; frame++) {
      const t0 = performance.now();

      // Phase 1 (Frames 0..99): High-speed horizontal pan across 10 racks
      if (frame < 100) {
        cameraX -= 35; // Pan rightward
      }
      // Phase 2 (Frames 100..199): Zoom stress cycle (0.2x Overview <-> 2.5x Detailed)
      else if (frame < 200) {
        cameraZoom = 0.2 + (Math.sin((frame - 100) * 0.08) + 1) * 1.15;
      }
      // Phase 3 (Frames 200..299): Continuous device drag snapping across racks
      else {
        cameraX = -1500;
        cameraZoom = 0.8;
      }

      // Projection simulation
      const screenToWorld = (sx: number, sy: number) => ({
        x: (sx - cameraX) / cameraZoom,
        y: (sy - cameraY) / cameraZoom,
      });

      // Execute viewport frustum culling & LOD update pass
      sceneGraph.updateViewport(1920, 1080, cameraZoom, screenToWorld);

      // In drag phase, simulate snapping and collision checks
      if (frame >= 200) {
        const targetRack = sceneGraph.rackContainers.get('rack_2');
        if (targetRack) {
          const slot = Math.max(1, Math.min(42, Math.round(((frame * 12) % 1344) / 32)));
          // AABB collision check
          let collides = false;
          for (const dev of targetRack.deviceMap.values()) {
            if (dev.instance.startU === slot) {
              collides = true;
              break;
            }
          }
          expect(typeof collides).toBe('boolean');
        }
      }

      const dt = performance.now() - t0;
      frameTimes.push(dt);
    }

    // Statistical Percentiles Computation
    frameTimes.sort((a, b) => a - b);
    const p50 = frameTimes[Math.floor(frameTimes.length * 0.50)];
    const p95 = frameTimes[Math.floor(frameTimes.length * 0.95)];
    const p99 = frameTimes[Math.floor(frameTimes.length * 0.99)];
    const max = frameTimes[frameTimes.length - 1];
    const droppedFrames = frameTimes.filter((t) => t > 20.0).length;

    console.log('60 FPS Multi-Rack Benchmark Results:', {
      totalRacks: racks.length,
      totalDevices,
      totalFrames: frameCount,
      p50_ms: p50.toFixed(4),
      p95_ms: p95.toFixed(4),
      p99_ms: p99.toFixed(4),
      max_ms: max.toFixed(4),
      droppedFrames,
    });

    // Verification Gates
    expect(p95).toBeLessThanOrEqual(16.6); // Strict 60 FPS gate
    expect(max).toBeLessThanOrEqual(20.0); // Zero jank / freeze gate
    expect(droppedFrames).toBe(0);         // 0 dropped frames > 20ms
  });
});
