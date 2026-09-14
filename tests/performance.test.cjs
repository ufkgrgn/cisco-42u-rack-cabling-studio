// Headless smoke benchmark; not a hardware-qualified 60 FPS certification.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/ufuk_/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
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
    const results = await page.evaluate(async () => {
      const api = window.RackStudio;
      const baseline=[]; let baselinePrevious;
      for(let i=0;i<60;i++) {
        const time=await new Promise(requestAnimationFrame);
        if(baselinePrevious!==undefined) baseline.push(time-baselinePrevious);
        baselinePrevious=time;
      }
      baseline.sort((a,b)=>a-b);
      const [catalogKey, model] = Object.entries(api.catalog).find(([,c]) => c.u === 1 && c.ports.length >= 24);
      const racks = Array.from({length:100}, (_,r) => ({id:`bench-r${r}`,name:`Benchmark ${r+1}`,heightU:42,
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
      return {rackCount:racks.length,deviceCount:3000,cableCount:cables.length,activeRackCableCount:200,
        baselineFrameIntervalP50Ms:baseline[Math.floor(baseline.length*.5)],
        baselineFrameIntervalP95Ms:baseline[Math.floor(baseline.length*.95)],
        validationMs,importMs,panFrames:intervals.length,frameIntervalP50Ms:sorted[Math.floor(sorted.length*.5)],
        frameIntervalP95Ms:sorted[Math.floor(sorted.length*.95)],maxFrameIntervalMs:sorted.at(-1),
        intervalsAbove20Ms:intervals.filter(n=>n>20).length,
        heapBytes:performance.memory?.usedJSHeapSize ?? null,
        userAgent:navigator.userAgent,renderedDevices:document.querySelectorAll('.mounted-device').length,
        renderedCables:document.querySelectorAll('.cable-path').length};
    });
    assert.equal(results.renderedDevices,30);
    assert.equal(results.renderedCables,200);
    assert.deepEqual(errors,[]);
    const report={timestamp:new Date().toISOString(),method:'Headless Edge, file URL, synthetic mouse pan, 1600x1000 viewport. Smoke measurement only; compositor/GPU behavior and real hardware 60 FPS are not certified.',...results,errors};
    fs.writeFileSync(path.join(__dirname,'performance-results.json'),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify(report,null,2));
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
