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
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
    await page.waitForFunction(() => window.RackStudio);
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
      canvas.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0,clientX:rect.left+10,clientY:rect.top+10}));
      const intervals=[]; let previous;
      for(let frame=0;frame<180;frame++) {
        const time=await new Promise(requestAnimationFrame);
        if(previous!==undefined) intervals.push(time-previous); previous=time;
        window.dispatchEvent(new MouseEvent('mousemove',{bubbles:true,clientX:rect.left+10+frame%120,clientY:rect.top+10+frame%60}));
      }
      window.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
      const sorted=[...intervals].sort((a,b)=>a-b);
      const retainedBefore=api.getPixiCableInteractionState().renderStats;
      const retainedRenderCalls=100;
      const retainedStart=performance.now();
      for(let i=0;i<retainedRenderCalls;i++) api.renderAllCables();
      const retainedBatchMs=performance.now()-retainedStart;
      const pixiState=api.getPixiCableInteractionState();
      const retainedAfter=pixiState.renderStats;
      const firstCable = cables[0];
      const firstPort = document.getElementById(`port-${firstCable.from.instanceId}-${firstCable.from.portId}`);
      const firstPortRect = firstPort?.getBoundingClientRect();
      const pickingSamples = [];
      let pickingMisses = 0;
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
      return {rackCount:racks.length,deviceCount:racks.length * 30,cableCount:cables.length,activeRackCableCount:200,
        renderAllRacks,
        baselineFrameIntervalP50Ms:baseline[Math.floor(baseline.length*.5)],
        baselineFrameIntervalP95Ms:baseline[Math.floor(baseline.length*.95)],
        validationMs,importMs,panFrames:intervals.length,frameIntervalP50Ms:sorted[Math.floor(sorted.length*.5)],
        frameIntervalP95Ms:sorted[Math.floor(sorted.length*.95)],maxFrameIntervalMs:sorted.at(-1),
        intervalsAbove20Ms:intervals.filter(n=>n>20).length,
        pixiDisplayCount:pixiState.displayCount,
        retainedRenderCalls,
        retainedBatchMs,
        retainedAverageMs:retainedBatchMs/retainedRenderCalls,
        retainedFastPathHits:retainedAfter.fastPathHits-retainedBefore.fastPathHits,
        retainedDomRectReadDelta:retainedAfter.domRectReads-retainedBefore.domRectReads,
        retainedDisplayAllocationDelta:retainedAfter.createdDisplays-retainedBefore.createdDisplays,
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
        heapBytes:performance.memory?.usedJSHeapSize ?? null,
        userAgent:navigator.userAgent,renderedDevices:document.querySelectorAll('.mounted-device').length,
        renderedCables:document.querySelectorAll('.cable-path').length};
    }, { rackLimit: targetRackCount, renderAllRacks });
    assert.equal(results.renderedDevices,renderAllRacks ? targetRackCount * 30 : 30);
    assert.equal(results.renderedCables,renderAllRacks ? targetRackCount * 200 : 200);
    assert.equal(results.pixiDisplayCount,renderAllRacks ? targetRackCount * 200 : 200);
    assert.equal(results.retainedFastPathHits,results.retainedRenderCalls);
    assert.equal(results.retainedDomRectReadDelta,0);
    assert.equal(results.retainedDisplayAllocationDelta,0);
    assert.equal(results.viewportRendererV2,true);
    assert.ok(results.rendererWidth <= 1600 && results.rendererHeight <= 1000);
    assert.ok(results.batchDisplayCount < (renderAllRacks ? 64 : 32));
    assert.ok(results.frameIntervalP95Ms <= 40, `pan p95 regression: ${results.frameIntervalP95Ms}ms`);
    assert.ok(results.retainedAverageMs <= 5, `retained render regression: ${results.retainedAverageMs}ms`);
    assert.equal(results.pickingSamples,500);
    assert.equal(results.pickingMisses,0);
    assert.ok(results.retainedMutationMs <= 40, `retained cable mutation regression: ${results.retainedMutationMs}ms`);
    assert.ok(results.retainedMutationDomRectReads <= 3, `retained cable mutation read ${results.retainedMutationDomRectReads} DOM rects`);
    assert.equal(results.retainedMutationEndpointHits,0);
    assert.equal(results.retainedMutationEndpointMisses,2);
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
    assert.ok(results.retainedRemovalMs <= 30, `retained cable removal regression: ${results.retainedRemovalMs}ms`);
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
    const report={timestamp:new Date().toISOString(),method:'Headless Edge, file URL, synthetic mouse pan, 1600x1000 viewport. Smoke measurement only; compositor/GPU behavior and real hardware 60 FPS are not certified.',...results,errors};
    const reportFile = process.env.BENCH_REPORT_FILE || 'performance-results.json';
    fs.writeFileSync(path.join(__dirname, reportFile),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify(report,null,2));
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
