const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
  let fp = path.join(__dirname, '..', req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  if (!fs.existsSync(fp)) { res.writeHead(404); return res.end(); }
  res.writeHead(200);
  fs.createReadStream(fp).pipe(res);
});

server.listen(4328, async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:4328');
  const details = await page.evaluate(() => {
    const api = window.RackStudio;
    const catalogKey = Object.keys(api.catalog).find(k => api.catalog[k].u === 1 && api.catalog[k].ports.length >= 2);
    const ports = api.catalog[catalogKey].ports;
    const racks = ['a','b'].map(id => ({id,name:'Rack -- <test> '+id,heightU:60,devices:[{instanceId:'dev-'+id,catalogKey,topU:60,uHeight:1}]}));
    const cables = ['a','b'].map(id => ({id:'cable-'+id,from:{rackId:id,instanceId:'dev-'+id,portId:ports[0].id},to:{rackId:id,instanceId:'dev-'+id,portId:ports[1].id},color:'#2563eb',lengthMeters:1}));
    api.loadCustomTopology({racks,cables,activeRackId:'b'});
    api.fit();

    // Trace what renderAllCables sees:
    const activeRack = api.getActiveRack();
    const isMulti = api.STATE.viewMode === 'multi' && api.STATE.racks && api.STATE.racks.length > 1;

    const trace = [];
    api.STATE.cables.forEach(cable => {
      let skipReason = null;
      if (!isMulti && cable.from?.rackId && cable.to?.rackId) {
        if (cable.from.rackId !== activeRack?.id && cable.to.rackId !== activeRack?.id) {
          skipReason = 'rack mismatch: from ' + cable.from.rackId + ' active ' + activeRack?.id;
        }
      }
      const instA = cable.from.instanceId || cable.from.deviceId;
      const instB = cable.to.instanceId || cable.to.deviceId;
      const portIdA = cable.from.portId || ('p' + cable.from.portIdx);
      const portIdB = cable.to.portId || ('p' + cable.to.portIdx);

      const elA = document.getElementById(`port-${instA}-${portIdA}`);
      const elB = document.getElementById(`port-${instB}-${portIdB}`);
      if (!skipReason && (!elA || !elB)) skipReason = 'port elements missing';

      trace.push({
        id: cable.id,
        skipReason,
        elA: !!elA,
        elB: !!elB
      });
    });

    return { activeRackId: activeRack?.id, trace };
  });
  console.log('TRACE DETAILS:', JSON.stringify(details, null, 2));
  await browser.close();
  server.close();
});
