// Headless smoke benchmark; not a hardware-qualified 60 FPS certification.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({channel:'msedge', headless:true});
  try {
    const page = await browser.newPage({viewport:{width:1600,height:1000}});
    // Opt-in browser trace isolates the gesture from import and later mutation probes.
    // Durations are inclusive and may overlap across nested events/threads.
    let panTrace = null;
    if (process.env.BENCH_TRACE === '1') {
      const session = await page.context().newCDPSession(page);
      const events = [];
      session.on('Tracing.dataCollected', ({ value }) => events.push(...value));
      await page.exposeFunction('startPanTrace', () => session.send('Tracing.start', {
        categories: 'devtools.timeline,disabled-by-default-devtools.timeline,blink.user_timing',
        transferMode: 'ReportEvents'
      }));
      await page.exposeFunction('stopPanTrace', async () => {
        const complete = new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Pan trace completion timed out')), 15000);
          session.once('Tracing.tracingComplete', () => { clearTimeout(timeout); resolve(); });
        });
        await session.send('Tracing.end');
        await complete;
        const totals = new Map();
        for (const event of events) {
          if (event.ph !== 'X' || !Number.isFinite(event.dur)) continue;
          const row = totals.get(event.name) || { name: event.name, count: 0, totalMs: 0, maxMs: 0 };
          row.count++;
          row.totalMs += event.dur / 1000;
          row.maxMs = Math.max(row.maxMs, event.dur / 1000);
          totals.set(event.name, row);
        }
        panTrace = {
          scope: 'mousedown through mouseup; inclusive CPU event durations, not GPU execution times',
          events: [...totals.values()].sort((a, b) => b.totalMs - a.totalMs).slice(0, 25)
        };
        await session.detach();
      });
    }
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
    await page.waitForFunction(() => window.RackStudio);
    await page.evaluate(() => {
      try { localStorage.clear(); } catch (_) {}
      window.RackStudio.setCableRenderMode('svg');
    });
    const targetRackCount = parseInt(process.env.BENCH_RACKS || '10', 10);
    const renderAllRacks = process.env.BENCH_VISIBLE_ALL === '1';
    const results = await page.evaluate(async ({ rackLimit, renderAllRacks }) => {
      const api = window.RackStudio;
      const baseline=[]; let baselinePrevious;
      for(let i=0;i<60;i++) {
        const time=await new Promise(requestAnimationFrame);
        if(baselinePrevious!==undefined) baseline.push(time-baselinePrevious);
        baselinePrevious=time;
      }
      baseline.sort((a,b)=>a-b);
      const [catalogKey, model] = Object.entries(api.catalog).find(([,c]) => c.u === 1 && c.ports.length >= 24);
      const racks = Array.from({length:rackLimit}, (_,r) => ({id:`bench-r${r}`,name:`Benchmark ${r+1}`,heightU:42,
        devices:Array.from({length:30},(_,d)=>({instanceId:`bench-d${r}-${d}`,catalogKey,topU:42-d,uHeight:1}))}));
      const cables=[];
      for (const rack of racks) {
        const endpoints=rack.devices.flatMap(d=>model.ports.map(p=>({rackId:rack.id,instanceId:d.instanceId,portId:p.id})));
        for(let i=0;i<200;i++) cables.push({id:`bench-c${cables.length}`,from:endpoints[i],to:endpoints[i+360],color:'#2563eb',lengthMeters:2});
      }
      const project={racks,cables,activeRackId:racks[0].id};
      const validationStart=performance.now(); api.validateTopology(project);
      const validationMs=performance.now()-validationStart;
      const importStart=performance.now(); api.loadCustomTopology(project);
      const importMs=performance.now()-importStart;
      await new Promise(resolve=>setTimeout(resolve,1500));
      if (renderAllRacks) {
        api.setViewMode('multi', true);
        await new Promise(resolve=>requestAnimationFrame(() => requestAnimationFrame(resolve)));
      }
      // Benchmark the requested engine, not whichever persisted mode happened
      // to load. Let view-mode layout, geometry and GPU upload settle before
      // frame timing begins so initialization is reported separately.
      api.setCableRenderMode('pixi');
      await new Promise(resolve=>setTimeout(resolve, renderAllRacks ? 1200 : 300));
      api.renderAllCables();
      const canvas=document.getElementById('viewport-canvas');
      const rect=canvas.getBoundingClientRect();
      api.resetCameraPerformanceTelemetry?.();
      if (window.startPanTrace) await window.startPanTrace();
      canvas.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0,clientX:rect.left+10,clientY:rect.top+10}));
      const intervals=[]; let previous;
      for(let frame=0;frame<180;frame++) {
        const time=await new Promise(requestAnimationFrame);
        if(previous!==undefined) intervals.push(time-previous); previous=time;
        window.dispatchEvent(new MouseEvent('mousemove',{bubbles:true,clientX:rect.left+10+frame%120,clientY:rect.top+10+frame%60}));
      }
      window.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
      const cameraTelemetry=api.getCameraPerformanceTelemetry?.() || {};
      if (window.stopPanTrace) await window.stopPanTrace();
      const sorted=[...intervals].sort((a,b)=>a-b);
      const retainedBefore=api.getPixiCableInteractionState().renderStats;
      const retainedRenderCalls=100;
      const retainedStart=performance.now();
      for(let i=0;i<retainedRenderCalls;i++) api.renderAllCables();
      const retainedBatchMs=performance.now()-retainedStart;
      const pixiState=api.getPixiCableInteractionState();
      const retainedAfter=pixiState.renderStats;
      const firstCable = cables[0];
      const pt = api.DeviceSceneRegistry?.getPortPoint?.(firstCable.from.instanceId, firstCable.from.portId);
      const viewportRect = document.getElementById('viewport-canvas')?.getBoundingClientRect() || { left: 0, top: 0 };
      const firstPort = document.getElementById(`port-${firstCable.from.instanceId}-${firstCable.from.portId}`);
      const firstPortRect = firstPort ? firstPort.getBoundingClientRect() : (pt ? {
        left: viewportRect.left + (api.ZOOM_STATE?.panX || 0) + pt.x * (api.ZOOM_STATE?.scale || 1),
        top: viewportRect.top + (api.ZOOM_STATE?.panY || 0) + pt.y * (api.ZOOM_STATE?.scale || 1),
        width: 0,
        height: 0
      } : null);
      const pickingSamples = [];
      let pickingMisses = 0;
      const pickingBefore = api.getPixiPerformanceTelemetry();
      if (firstPortRect) {
        const pickX = firstPortRect.left + firstPortRect.width / 2;
        const pickY = firstPortRect.top + firstPortRect.height / 2;
        for (let i = 0; i < 500; i++) {
          const started = performance.now();
          const hit = api.hitTestPixiCable(pickX, pickY);
          pickingSamples.push(performance.now() - started);
          if (!hit) pickingMisses++;
        }
        pickingSamples.sort((a,b)=>a-b);
      }
      const pickingAfter = api.getPixiPerformanceTelemetry();
      const hoverCableIds = cables.slice(0, 2).map(cable => cable.id);
      api.setPixiCableHover(hoverCableIds[0], true);
      api.setPixiCableHover(hoverCableIds[1], true);
      api.setPixiCableHover(null, false);
      const hoverBefore = api.getPixiPerformanceTelemetry();
      const hoverStart = performance.now();
      for (let i = 0; i < 100; i++) api.setPixiCableHover(hoverCableIds[i % hoverCableIds.length], true);
      const hoverSweepMs = performance.now() - hoverStart;
      const hoverAfter = api.getPixiPerformanceTelemetry();
      api.setPixiCableHover(null, false);
      const mutationBefore=api.getPixiCableInteractionState();
      const mutationCable={
        id:'bench-retained-mutation',
        from:{...racks[0].devices.flatMap(d=>model.ports.map(p=>({rackId:racks[0].id,instanceId:d.instanceId,portId:p.id})))[250]},
        to:{...racks[0].devices.flatMap(d=>model.ports.map(p=>({rackId:racks[0].id,instanceId:d.instanceId,portId:p.id})))[650]},
        color:'#f59e0b',lengthMeters:2
      };
      api.STATE.cables.push(mutationCable);
      const mutationStart=performance.now();
      api.appendSingleCable(mutationCable);
      const retainedMutationMs=performance.now()-mutationStart;
      const mutationAfter=api.getPixiCableInteractionState();
      const bulkBefore=api.getPixiCableInteractionState();
      const allEndpoints=racks[0].devices.flatMap(d=>model.ports.map(p=>({rackId:racks[0].id,instanceId:d.instanceId,portId:p.id})));
      api.beginPixiCableTransaction();
      const bulkStart=performance.now();
      for(let i=0;i<12;i++) {
        const cable={
          id:`bench-bulk-mutation-${i}`,
          from:{...allEndpoints[251+i]},
          to:{...allEndpoints[651+i]},
          color:'#0ea5e9',lengthMeters:2
        };
        api.STATE.cables.push(cable);
        api.appendSingleCable(cable);
      }
      const bulkQueued=api.getPixiCableInteractionState();
      const bulkFlushedCount=api.endPixiCableTransaction();
      const retainedBulkMutationMs=performance.now()-bulkStart;
      const bulkAfter=api.getPixiCableInteractionState();
      const removalBefore=api.getPixiCableInteractionState();
      const removedCableId='bench-bulk-mutation-11';
      api.STATE.cables=api.STATE.cables.filter(cable=>cable.id!==removedCableId);
      api.invalidatePixiCableGeometry([removedCableId]);
      const removalStart=performance.now();
      api.renderAllCables();
      const retainedRemovalMs=performance.now()-removalStart;
      const removalAfter=api.getPixiCableInteractionState();
      const styleBefore=api.getPixiCableInteractionState();
      const styledCables=api.STATE.cables.filter(cable=>cable.id.startsWith('bench-bulk-mutation-')).slice(0,8);
      styledCables.forEach(cable=>{cable.color='#22c55e';});
      const styleStart=performance.now();
      api.renderAllCables();
      const retainedStyleMutationMs=performance.now()-styleStart;
      const styleAfter=api.getPixiCableInteractionState();
      const virtualization=api.getRackVirtualizationState?.() || null;
      let cullingProbe=null;
      let rackCullingProbe=null;
      let rackRevealProbe=null;
      if(renderAllRacks) {
        api.ZOOM_STATE.scale=1; api.ZOOM_STATE.panX=0; api.ZOOM_STATE.panY=0;
        api.syncRackViewportVisibility(api.ZOOM_STATE);
        const rackFocused=api.getRackVirtualizationState();
        api.syncPixiViewportCamera(api.ZOOM_STATE,true,'benchmark-culling');
        const focused=api.getPixiPerformanceTelemetry();
        api.ZOOM_STATE.panX=-1;
        api.syncRackViewportVisibility(api.ZOOM_STATE);
        const rackStable=api.getRackVirtualizationState();
        api.syncPixiViewportCamera(api.ZOOM_STATE,true,'benchmark-culling-stable');
        const stable=api.getPixiPerformanceTelemetry();
        cullingProbe={focused,stable};
        rackCullingProbe={focused:rackFocused,stable:rackStable};
        api.ZOOM_STATE.panX=-(4 * (634 + 64));
        api.syncRackViewportVisibility(api.ZOOM_STATE);
        const shifted=api.getRackVirtualizationState();
        const targetRack=document.querySelector('.rack-container[data-rack-id="bench-r4"]');
        rackRevealProbe={
          shifted,
          targetVisible:targetRack?.dataset.viewportVisible === 'true',
          targetContentVisibility:targetRack ? getComputedStyle(targetRack).contentVisibility : null
        };
        api.ZOOM_STATE.panX=0;
        api.syncRackViewportVisibility(api.ZOOM_STATE);
      }
      return {rackCount:racks.length,deviceCount:racks.length * 30,cableCount:cables.length,activeRackCableCount:200,
        renderAllRacks,
        baselineFrameIntervalP50Ms:baseline[Math.floor(baseline.length*.5)],
        baselineFrameIntervalP95Ms:baseline[Math.floor(baseline.length*.95)],
        validationMs,importMs,panFrames:intervals.length,frameIntervalP50Ms:sorted[Math.floor(sorted.length*.5)],
        frameIntervalP95Ms:sorted[Math.floor(sorted.length*.95)],maxFrameIntervalMs:sorted.at(-1),
        intervalsAbove20Ms:intervals.filter(n=>n>20).length,
        panFrameCommits:cameraTelemetry.panFrameCommits ?? 0,
        panFramePacingSkips:cameraTelemetry.panFramePacingSkips ?? 0,
        cameraTransformCommits:cameraTelemetry.transformCommits ?? 0,
        cameraCommitAverageMs:cameraTelemetry.averageCommitDurationMs ?? 0,
        cameraCommitP95Ms:cameraTelemetry.p95CommitDurationMs ?? 0,
        cameraCommitMaxMs:cameraTelemetry.maxCommitDurationMs ?? 0,
        rackSyncAverageMs:cameraTelemetry.averageRackSyncDurationMs ?? 0,
        pixiSyncAverageMs:cameraTelemetry.averagePixiSyncDurationMs ?? 0,
        pixiDisplayCount:pixiState.displayCount,
        retainedRenderCalls,
        retainedBatchMs,
        retainedAverageMs:retainedBatchMs/retainedRenderCalls,
        retainedFastPathHits:retainedAfter.fastPathHits-retainedBefore.fastPathHits,
        retainedDomRectReadDelta:retainedAfter.domRectReads-retainedBefore.domRectReads,
        retainedDisplayAllocationDelta:retainedAfter.createdDisplays-retainedBefore.createdDisplays,
        cullingVisibleBatches:cullingProbe?.focused.visibleRackBatches ?? null,
        cullingCulledBatches:cullingProbe?.focused.culledRackBatches ?? null,
        cullingStableWriteDelta:cullingProbe ? cullingProbe.stable.cullingVisibilityChanges-cullingProbe.focused.cullingVisibilityChanges : null,
        cullingStableSkipDelta:cullingProbe ? cullingProbe.stable.cullingUnchangedSkips-cullingProbe.focused.cullingUnchangedSkips : null,
        rackCullingVisible:rackCullingProbe?.focused.viewportVisibleRackCount ?? null,
        rackCullingCulled:rackCullingProbe?.focused.viewportCulledRackCount ?? null,
        rackPaintSuppressed:rackCullingProbe?.focused.paintSuppressedRackCount ?? null,
        rackCullingStableWriteDelta:rackCullingProbe ? rackCullingProbe.stable.viewportVisibilityChanges-rackCullingProbe.focused.viewportVisibilityChanges : null,
        rackCullingStableSkipDelta:rackCullingProbe ? rackCullingProbe.stable.viewportUnchangedSkips-rackCullingProbe.focused.viewportUnchangedSkips : null,
        rackCullingSignatureSkipDelta:rackCullingProbe ? rackCullingProbe.stable.viewportSignatureSkips-rackCullingProbe.focused.viewportSignatureSkips : null,
        rackRevealTargetVisible:rackRevealProbe?.targetVisible ?? null,
        rackRevealTargetContentVisibility:rackRevealProbe?.targetContentVisibility ?? null,
        rackRevealPaintSuppressed:rackRevealProbe?.shifted.paintSuppressedRackCount ?? null,
        batchDisplayCount:pixiState.renderStats.batchDisplayCount,
        batchRebuilds:pixiState.renderStats.batchRebuilds,
        viewportRendererV2:pixiState.viewportRendererV2,
        rendererWidth:pixiState.rendererSize.width,
        rendererHeight:pixiState.rendererSize.height,
        worldWidth:pixiState.worldSize.width,
        worldHeight:pixiState.worldSize.height,
        pickingSamples:pickingSamples.length,
        pickingP50Ms:pickingSamples[Math.floor(pickingSamples.length*.5)] ?? null,
        pickingP95Ms:pickingSamples[Math.floor(pickingSamples.length*.95)] ?? null,
        pickingP99Ms:pickingSamples[Math.floor(pickingSamples.length*.99)] ?? null,
        pickingMaxMs:pickingSamples.at(-1) ?? null,
        pickingMisses,
        pickingRectReadDelta:pickingAfter.pointerRectReads-pickingBefore.pointerRectReads,
        pickingRectCacheHitDelta:pickingAfter.pointerRectCacheHits-pickingBefore.pointerRectCacheHits,
        pickingHitTestDelta:pickingAfter.pointerHitTests-pickingBefore.pointerHitTests,
        hoverSweepMs,
        hoverAverageMs:hoverSweepMs/100,
        hoverFocusPassDelta:hoverAfter.incrementalFocusPasses-hoverBefore.incrementalFocusPasses,
        hoverFocusCableDelta:hoverAfter.incrementalFocusCablesProcessed-hoverBefore.incrementalFocusCablesProcessed,
        hoverFocusCacheHitDelta:hoverAfter.focusVariantCacheHits-hoverBefore.focusVariantCacheHits,
        hoverFocusCacheMissDelta:hoverAfter.focusVariantCacheMisses-hoverBefore.focusVariantCacheMisses,
        hoverFullDisplayScansAvoidedDelta:hoverAfter.focusFullDisplayScansAvoided-hoverBefore.focusFullDisplayScansAvoided,
        retainedMutationMs,
        retainedMutationDomRectReads:mutationAfter.renderStats.domRectReads-mutationBefore.renderStats.domRectReads,
        retainedMutationEndpointHits:mutationAfter.performance.endpointCacheHits-mutationBefore.performance.endpointCacheHits,
        retainedMutationEndpointMisses:mutationAfter.performance.endpointCacheMisses-mutationBefore.performance.endpointCacheMisses,
        retainedMutationOverlayRebuilds:mutationAfter.performance.organizerOverlayRebuilds-mutationBefore.performance.organizerOverlayRebuilds,
        retainedMutationIncrementalPasses:mutationAfter.performance.incrementalGeometryPasses-mutationBefore.performance.incrementalGeometryPasses,
        retainedMutationCablesProcessed:mutationAfter.performance.incrementalCablesProcessed-mutationBefore.performance.incrementalCablesProcessed,
        retainedMutationSpatialUpdates:mutationAfter.performance.spatialIncrementalUpdates-mutationBefore.performance.spatialIncrementalUpdates,
        retainedMutationSpatialRebuilds:mutationAfter.performance.spatialFullRebuilds-mutationBefore.performance.spatialFullRebuilds,
        retainedMutationBatchUpdates:mutationAfter.performance.incrementalBatchUpdates-mutationBefore.performance.incrementalBatchUpdates,
        retainedMutationBatchRebuilds:mutationAfter.performance.fullBatchRebuilds-mutationBefore.performance.fullBatchRebuilds,
        retainedBulkMutationMs,
        bulkFlushedCount,
        bulkQueuedRenders:bulkQueued.performance.totalRenders-bulkBefore.performance.totalRenders,
        bulkRenderSubmits:bulkAfter.performance.totalRenders-bulkBefore.performance.totalRenders,
        bulkIncrementalPasses:bulkAfter.performance.incrementalGeometryPasses-bulkBefore.performance.incrementalGeometryPasses,
        bulkCablesProcessed:bulkAfter.performance.incrementalCablesProcessed-bulkBefore.performance.incrementalCablesProcessed,
        bulkSpatialUpdates:bulkAfter.performance.spatialIncrementalUpdates-bulkBefore.performance.spatialIncrementalUpdates,
        bulkSpatialRebuilds:bulkAfter.performance.spatialFullRebuilds-bulkBefore.performance.spatialFullRebuilds,
        bulkBatchUpdates:bulkAfter.performance.incrementalBatchUpdates-bulkBefore.performance.incrementalBatchUpdates,
        bulkBatchRebuilds:bulkAfter.performance.fullBatchRebuilds-bulkBefore.performance.fullBatchRebuilds,
        bulkRendersAvoided:bulkAfter.performance.transactionRendersAvoided-bulkBefore.performance.transactionRendersAvoided,
        retainedRemovalMs,
        removalDomRectReads:removalAfter.renderStats.domRectReads-removalBefore.renderStats.domRectReads,
        removalFullGeometryPasses:removalAfter.performance.fullGeometryPasses-removalBefore.performance.fullGeometryPasses,
        removalIncrementalGeometryPasses:removalAfter.performance.incrementalGeometryPasses-removalBefore.performance.incrementalGeometryPasses,
        removalPasses:removalAfter.performance.incrementalRemovalPasses-removalBefore.performance.incrementalRemovalPasses,
        removalCablesProcessed:removalAfter.performance.incrementalCablesRemoved-removalBefore.performance.incrementalCablesRemoved,
        removalSpatialUpdates:removalAfter.performance.spatialIncrementalRemovals-removalBefore.performance.spatialIncrementalRemovals,
        removalFullBatchRebuilds:removalAfter.performance.fullBatchRebuilds-removalBefore.performance.fullBatchRebuilds,
        removalPartialRackBatchRebuilds:removalAfter.performance.partialRackBatchRebuilds-removalBefore.performance.partialRackBatchRebuilds,
        removalPartialBatchCablesProcessed:removalAfter.performance.partialRemovalBatchCablesProcessed-removalBefore.performance.partialRemovalBatchCablesProcessed,
        removalAvoidedFullBatchRebuilds:removalAfter.performance.avoidedFullRemovalBatchRebuilds-removalBefore.performance.avoidedFullRemovalBatchRebuilds,
        removalRenderSubmits:removalAfter.performance.totalRenders-removalBefore.performance.totalRenders,
        retainedStyleMutationMs,
        styleCableCount:styledCables.length,
        styleDomRectReads:styleAfter.renderStats.domRectReads-styleBefore.renderStats.domRectReads,
        styleFullGeometryPasses:styleAfter.performance.fullGeometryPasses-styleBefore.performance.fullGeometryPasses,
        styleFullBatchRebuilds:styleAfter.performance.fullBatchRebuilds-styleBefore.performance.fullBatchRebuilds,
        styleIncrementalPasses:styleAfter.performance.incrementalStylePasses-styleBefore.performance.incrementalStylePasses,
        styleCablesProcessed:styleAfter.performance.incrementalStyleCables-styleBefore.performance.incrementalStyleCables,
        stylePartialBatchRebuilds:styleAfter.performance.partialColorBatchRebuilds-styleBefore.performance.partialColorBatchRebuilds,
        styleAvoidedFullBatchRebuilds:styleAfter.performance.avoidedFullStyleBatchRebuilds-styleBefore.performance.avoidedFullStyleBatchRebuilds,
        styleRenderSubmits:styleAfter.performance.totalRenders-styleBefore.performance.totalRenders,
        nativeRackVirtualization:virtualization?.enabled ?? false,
        browserManagedRackCount:virtualization?.browserManagedRackCount ?? 0,
        paintSuppressedRackCount:virtualization?.paintSuppressedRackCount ?? 0,
        averagePixiRenderMs:styleAfter.performance.averageRenderDurationMs,
        maxPixiRenderMs:styleAfter.performance.maxRenderDurationMs,
        pixiRendersOverBudget:styleAfter.performance.rendersOverFrameBudget,
        longTaskCount:styleAfter.performance.longTaskCount,
        maxLongTaskDurationMs:styleAfter.performance.maxLongTaskDurationMs,
        heapBytes:performance.memory?.usedJSHeapSize ?? null,
        userAgent:navigator.userAgent,renderedDevices:document.querySelectorAll('.mounted-device').length,
        renderedCables:pixiState.displayCount};
    }, { rackLimit: targetRackCount, renderAllRacks });
    assert.equal(results.renderedDevices,renderAllRacks ? targetRackCount * 30 : 30);
    assert.equal(results.renderedCables,renderAllRacks ? targetRackCount * 200 : 200);
    assert.equal(results.pixiDisplayCount,renderAllRacks ? targetRackCount * 200 : 200);
    assert.equal(results.retainedFastPathHits,results.retainedRenderCalls);
    assert.equal(results.retainedDomRectReadDelta,0);
    assert.equal(results.retainedDisplayAllocationDelta,0);
    assert.equal(results.viewportRendererV2,true);
    if(results.renderAllRacks) {
      assert.ok(results.cullingCulledBatches>0);
      assert.ok(results.cullingVisibleBatches<results.rackCount);
      assert.equal(results.cullingStableWriteDelta,0);
      assert.ok(results.cullingStableSkipDelta>0);
      assert.equal(results.nativeRackVirtualization,true);
      assert.equal(results.browserManagedRackCount + results.paintSuppressedRackCount,results.rackCount);
      assert.ok(results.rackCullingCulled>0);
      assert.ok(results.rackCullingVisible<results.rackCount);
      assert.equal(results.rackPaintSuppressed,results.rackCullingCulled);
      assert.equal(results.rackCullingStableWriteDelta,0);
      assert.ok(results.rackCullingStableSkipDelta>0);
      assert.ok(results.rackCullingSignatureSkipDelta>0);
      assert.equal(results.rackRevealTargetVisible,true);
      assert.equal(results.rackRevealTargetContentVisibility,'auto');
      assert.ok(results.rackRevealPaintSuppressed>0);
    }
    assert.ok(results.rendererWidth <= 1600 && results.rendererHeight <= 1000);
    assert.ok(results.batchDisplayCount < (renderAllRacks ? 64 : 32));
    assert.ok(results.frameIntervalP95Ms <= 40, `pan p95 regression: ${results.frameIntervalP95Ms}ms`);
    assert.ok(results.panFrameCommits <= results.panFrames);
    assert.ok(results.cameraTransformCommits >= results.panFrameCommits);
    assert.ok(results.cameraTransformCommits <= results.panFrameCommits + 1);
    assert.ok(results.cameraCommitAverageMs <= 8, `camera commit average regression: ${results.cameraCommitAverageMs}ms`);
    assert.ok(results.cameraCommitP95Ms <= 16.7, `camera commit p95 regression: ${results.cameraCommitP95Ms}ms`);
    if(results.baselineFrameIntervalP50Ms < 12) {
      assert.ok(results.panFramePacingSkips>0);
      assert.ok(results.panFrameCommits<results.panFrames);
    }
    assert.ok(results.retainedAverageMs <= 5, `retained render regression: ${results.retainedAverageMs}ms`);
    assert.ok(results.averagePixiRenderMs <= (results.renderAllRacks ? 10 : 3), `average Pixi render regression: ${results.averagePixiRenderMs}ms`);
    assert.equal(results.pickingSamples,500);
    assert.equal(results.pickingMisses,0);
    assert.equal(results.pickingHitTestDelta,500);
    assert.equal(results.pickingRectReadDelta,0, `stable pointer picking forced ${results.pickingRectReadDelta} canvas layout reads`);
    assert.ok(results.pickingRectCacheHitDelta >= 500);
    assert.equal(results.hoverFocusPassDelta,100);
    assert.equal(results.hoverFocusCableDelta,100);
    assert.equal(results.hoverFocusCacheHitDelta,100);
    assert.equal(results.hoverFocusCacheMissDelta,0);
    assert.equal(results.hoverFullDisplayScansAvoidedDelta,results.pixiDisplayCount * 100);
    assert.ok(results.hoverAverageMs <= (results.renderAllRacks ? 10 : 2.5), `incremental hover average regression: ${results.hoverAverageMs}ms`);
    assert.ok(results.retainedMutationMs <= 40, `retained cable mutation regression: ${results.retainedMutationMs}ms`);
    assert.ok(results.retainedMutationDomRectReads <= 3, `retained cable mutation read ${results.retainedMutationDomRectReads} DOM rects`);
    assert.equal(results.retainedMutationEndpointHits,0);
    assert.ok(results.retainedMutationEndpointMisses === 0 || results.retainedMutationEndpointMisses === 2);
    assert.equal(results.retainedMutationOverlayRebuilds,0);
    assert.equal(results.retainedMutationIncrementalPasses,1);
    assert.equal(results.retainedMutationCablesProcessed,1);
    assert.equal(results.retainedMutationSpatialUpdates,1);
    assert.equal(results.retainedMutationSpatialRebuilds,0);
    assert.equal(results.retainedMutationBatchUpdates,1);
    assert.equal(results.retainedMutationBatchRebuilds,0);
    assert.ok(results.retainedBulkMutationMs <= 60, `retained bulk cable mutation regression: ${results.retainedBulkMutationMs}ms`);
    assert.equal(results.bulkFlushedCount,12);
    assert.equal(results.bulkQueuedRenders,0);
    assert.equal(results.bulkRenderSubmits,1);
    assert.equal(results.bulkIncrementalPasses,1);
    assert.equal(results.bulkCablesProcessed,12);
    assert.equal(results.bulkSpatialUpdates,12);
    assert.equal(results.bulkSpatialRebuilds,0);
    assert.equal(results.bulkBatchUpdates,12);
    assert.equal(results.bulkBatchRebuilds,0);
    assert.equal(results.bulkRendersAvoided,12);
    assert.ok(results.retainedRemovalMs <= 50, `retained cable removal regression: ${results.retainedRemovalMs}ms`);
    assert.equal(results.removalDomRectReads,0);
    assert.equal(results.removalFullGeometryPasses,0);
    assert.equal(results.removalIncrementalGeometryPasses,0);
    assert.equal(results.removalPasses,1);
    assert.equal(results.removalCablesProcessed,1);
    assert.equal(results.removalSpatialUpdates,1);
    assert.equal(results.removalFullBatchRebuilds,0);
    assert.equal(results.removalPartialRackBatchRebuilds,1);
    assert.ok(results.removalPartialBatchCablesProcessed <= results.activeRackCableCount + 20, `removal rebuilt ${results.removalPartialBatchCablesProcessed} displays outside the affected rack budget`);
    assert.equal(results.removalAvoidedFullBatchRebuilds,1);
    assert.equal(results.removalRenderSubmits,1);
    assert.ok(results.retainedStyleMutationMs <= 30, `retained cable style regression: ${results.retainedStyleMutationMs}ms`);
    assert.equal(results.styleCableCount,8);
    assert.equal(results.styleDomRectReads,0);
    assert.equal(results.styleFullGeometryPasses,0);
    assert.equal(results.styleFullBatchRebuilds,0);
    assert.equal(results.styleIncrementalPasses,1);
    assert.equal(results.styleCablesProcessed,8);
    assert.ok(results.stylePartialBatchRebuilds >= 2);
    assert.equal(results.styleAvoidedFullBatchRebuilds,1);
    assert.equal(results.styleRenderSubmits,1);
    assert.deepEqual(errors,[]);
    const report={timestamp:new Date().toISOString(),method:'Headless Edge, file URL, synthetic mouse pan, 1600x1000 viewport. Smoke measurement only; compositor/GPU behavior and real hardware 60 FPS are not certified.',...results,panTrace,errors};
    const reportFile = process.env.BENCH_REPORT_FILE || 'performance-results.json';
    fs.writeFileSync(path.join(__dirname, reportFile),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify(report,null,2));
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
