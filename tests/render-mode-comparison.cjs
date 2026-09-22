// Matched SVG/Pixi comparison. Headless results are diagnostic, not a GPU FPS certification.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const FRAME_COUNT = Number.parseInt(process.env.BENCH_FRAME_COUNT || '120', 10);
const RACK_COUNT = Number.parseInt(process.env.BENCH_RACKS || '10', 10);

async function runSample(browser, { mode, renderAllRacks, lod }) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    await page.waitForFunction(() => window.RackStudio);
    const result = await page.evaluate(async ({ mode, renderAllRacks, lod, rackCount, frameCount }) => {
      const percentile = (values, fraction) => {
        if (!values.length) return null;
        const sorted = [...values].sort((a, b) => a - b);
        return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))];
      };
      const api = window.RackStudio;
      const [catalogKey, model] = Object.entries(api.catalog).find(([, item]) => item.u === 1 && item.ports.length >= 24);
      const racks = Array.from({ length: rackCount }, (_, rackIndex) => ({
        id: `cmp-r${rackIndex}`,
        name: `Comparison ${rackIndex + 1}`,
        heightU: 42,
        devices: Array.from({ length: 30 }, (_, deviceIndex) => ({
          instanceId: `cmp-d${rackIndex}-${deviceIndex}`,
          catalogKey,
          topU: 42 - deviceIndex,
          uHeight: 1
        }))
      }));
      const cables = [];
      for (const rack of racks) {
        const endpoints = rack.devices.flatMap(device => model.ports.map(port => ({
          rackId: rack.id,
          instanceId: device.instanceId,
          portId: port.id
        })));
        for (let index = 0; index < 200; index++) {
          cables.push({
            id: `cmp-c${cables.length}`,
            from: endpoints[index],
            to: endpoints[index + 360],
            color: '#2563eb',
            lengthMeters: 2
          });
        }
      }
      api.loadCustomTopology({ racks, cables, activeRackId: racks[0].id });
      await new Promise(resolve => setTimeout(resolve, 1200));
      if (renderAllRacks) {
        api.setViewMode('multi', true);
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      }
      api.setCableRenderMode(mode);
      api.ZOOM_STATE.scale = lod === 'macro' ? 0.3 : 1;
      api.ZOOM_STATE.panX = 0;
      api.ZOOM_STATE.panY = 0;
      api.updateStageTransform?.(false);
      api.syncPixiDeviceSceneLOD?.(lod);
      api.syncPixiViewportCamera?.(api.ZOOM_STATE, true, 'mode-comparison');
      await new Promise(resolve => setTimeout(resolve, renderAllRacks ? 800 : 350));
      api.renderAllCables();

      // Warm up once before collecting comparable pan-frame samples.
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      api.resetCameraPerformanceTelemetry?.();
      const canvas = document.getElementById('viewport-canvas');
      const rect = canvas.getBoundingClientRect();
      canvas.dispatchEvent(new MouseEvent('mousedown', {
        bubbles: true, button: 0, clientX: rect.left + 10, clientY: rect.top + 10
      }));
      const intervals = [];
      const eventDurations = [];
      let previous;
      for (let frame = 0; frame < frameCount; frame++) {
        const time = await new Promise(requestAnimationFrame);
        if (previous !== undefined) intervals.push(time - previous);
        previous = time;
        const eventStart = performance.now();
        window.dispatchEvent(new MouseEvent('mousemove', {
          bubbles: true,
          clientX: rect.left + 10 + (frame % 120),
          clientY: rect.top + 10 + (frame % 60)
        }));
        eventDurations.push(performance.now() - eventStart);
      }
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

      const renderCalls = 30;
      const renderDurations = [];
      for (let index = 0; index < renderCalls; index++) {
        const start = performance.now();
        api.renderAllCables();
        renderDurations.push(performance.now() - start);
      }
      const pixi = api.getPixiCableInteractionState?.() || null;
      const camera = api.getCameraPerformanceTelemetry?.() || {};
      const pixiCanvas = document.getElementById('cables-pixi-canvas');
      return {
        mode,
        lod,
        renderAllRacks,
        rackCount: racks.length,
        devicesInTopology: racks.length * 30,
        cablesInTopology: cables.length,
        frameCount: intervals.length,
        frameIntervalMs: {
          p50: percentile(intervals, 0.5),
          p95: percentile(intervals, 0.95),
          p99: percentile(intervals, 0.99),
          max: intervals.length ? Math.max(...intervals) : null,
          over20ms: intervals.filter(value => value > 20).length,
          over33ms: intervals.filter(value => value > 33).length
        },
        mousemoveHandlerMs: {
          p50: percentile(eventDurations, 0.5),
          p95: percentile(eventDurations, 0.95),
          max: eventDurations.length ? Math.max(...eventDurations) : null
        },
        renderAllCablesMs: {
          calls: renderCalls,
          p50: percentile(renderDurations, 0.5),
          p95: percentile(renderDurations, 0.95),
          total: renderDurations.reduce((sum, value) => sum + value, 0)
        },
        camera: {
          commits: camera.transformCommits ?? null,
          commitAverageMs: camera.averageCommitDurationMs ?? null,
          commitP95Ms: camera.p95CommitDurationMs ?? null,
          pixiSyncAverageMs: camera.averagePixiSyncDurationMs ?? null,
          rackSyncAverageMs: camera.averageRackSyncDurationMs ?? null
        },
        dom: {
          totalElements: document.querySelectorAll('*').length,
          mountedDevices: document.querySelectorAll('.mounted-device').length,
          ports: document.querySelectorAll('.port').length,
          svgCablePaths: document.querySelectorAll('#cables-svg .cable-path').length,
          svgDisplay: getComputedStyle(document.getElementById('cables-svg')).display,
          pixiDisplay: getComputedStyle(document.getElementById('cables-pixi-canvas')).display,
          cableRenderMode: api.STATE.cableRenderMode,
          deviceRenderer: document.documentElement.getAttribute('data-device-renderer'),
          canvasCount: document.querySelectorAll('canvas').length
        },
        pixi: pixi ? {
          displayCount: pixi.displayCount ?? null,
          batchDisplayCount: pixi.renderStats?.batchDisplayCount ?? null,
          rendererWidth: pixi.rendererSize?.width ?? null,
          rendererHeight: pixi.rendererSize?.height ?? null,
          resolution: pixi.resolution ?? null,
          renderAverageMs: pixi.performance?.averageRenderDurationMs ?? null,
          deviceSceneRebuilds: pixi.performance?.deviceSceneRebuilds ?? null
        } : null,
        heapBytes: performance.memory?.usedJSHeapSize ?? null,
        userAgent: navigator.userAgent,
        gpuUtilizationAvailable: false,
        pixiCanvasFound: !!pixiCanvas
      };
    }, { mode, renderAllRacks, lod, rackCount: RACK_COUNT, frameCount: FRAME_COUNT });
    return { ...result, pageErrors: errors };
  } finally {
    await page.close();
  }
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const scenarios = [];
    for (const layout of [false, true]) {
      for (const lod of ['detail', 'macro']) {
        for (const mode of ['svg', 'pixi']) {
          scenarios.push(await runSample(browser, { mode, renderAllRacks: layout, lod }));
        }
      }
    }
    const report = {
      timestamp: new Date().toISOString(),
      methodology: 'Same local app, synthetic topology, headless Microsoft Edge, file URL, fixed 1600x1000 viewport, 120 mouse-pan frames, 30 repeated full cable-render requests, SVG/Pixi paired for active-rack and multi-rack layouts at detail/macro LOD. Diagnostic only: browser compositor/GPU utilization and real hardware 60 FPS are not certified.',
      machine: {
        platform: process.platform,
        arch: process.arch,
        cpuCount: require('node:os').cpus().length,
        totalMemoryBytes: require('node:os').totalmem()
      },
      scenarios,
      limitations: [
        'Headless frame intervals are not equivalent to physical display presentation cadence.',
        'GPU utilization percentage is not available from this browser harness.',
        'Synthetic topology may not represent the user\'s largest real project.',
        'Run each scenario repeatedly and on target older/tablet hardware before setting migration acceptance gates.'
      ]
    };
    const output = JSON.stringify(report, null, 2);
    if (process.env.BENCH_REPORT_FILE) {
      require('node:fs').writeFileSync(path.join(__dirname, process.env.BENCH_REPORT_FILE), `${output}\n`);
    }
    console.log(output);
    if (scenarios.some(sample => sample.pageErrors.length)) process.exitCode = 1;
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
