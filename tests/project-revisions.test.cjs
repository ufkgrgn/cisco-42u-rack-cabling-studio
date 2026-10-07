const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/product/project-rich-v1.json'),'utf8'));
async function setup(browser) {
  const page=await browser.newPage({viewport:{width:1440,height:950}});
  await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
  await page.waitForSelector('.studio-editor[data-ready="true"]');
  await page.evaluate(async input => {
    const R=window.RackStudio, blob=new Blob(['photo'],{type:'text/plain'});
    input.evidenceRefs[0]={...input.evidenceRefs[0],bytes:blob.size,mime:blob.type,filename:'photo.txt'};
    const digest=await crypto.subtle.digest('SHA-256',await blob.arrayBuffer());
    input.evidenceRefs[0].sha256=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
    R.loadCustomTopology(input); await R.saveProjectNow();
    await R.ProjectRepository.commit(R.ProjectDocument.capture(R.STATE),{evidence:[{id:'blob-1',blob}]});
  },fixture);
  return page;
}
async function open(page) {
  await page.evaluate(()=>window.RackStudio.openSnapshotModal());
  await page.waitForFunction(()=>document.querySelector('.revision-manager') && !document.querySelector('.revision-manager').hasAttribute('aria-busy'));
  return page.getByRole('dialog',{name:'Proje revizyonları',exact:true});
}
async function idle(page) { await page.waitForFunction(()=>!document.querySelector('.revision-manager').hasAttribute('aria-busy')); }

test('semantic diff uses entity identity, port fields and meaningful values without camera/default/order noise',async()=>{
  const browser=await chromium.launch({headless:true,channel:'msedge'});
  try {
    const page=await setup(browser);
    const result=await page.evaluate(()=>{
      const R=window.RackStudio, base=R.ProjectDocument.capture(R.STATE), other=structuredClone(base);
      other.revision++; other.topology.viewMode='multi'; other.topology.activeRackId='rack-1'; other.topology.doorOpen=true;
      other.metadata.updatedAt=new Date().toISOString(); other.topology.racks[0].devices.reverse(); other.locations.reverse();
      other.topology.racks[0].devices.find(d=>d.instanceId==='device-2').hostname='EDGE-2';
      const equivalent=R.ProjectDiff.compare(base,other);
      const changed=structuredClone(base);
      changed.topology.racks[0].devices[0].topU--;
      changed.topology.racks[0].devices[0].portsConfig.p1.vlan='101';
      changed.topology.cables[0].measuredLengthMeters=1.25;
      changed.locations[0].name='Yeni saha'; changed.metadata.customer='Yeni müşteri';
      const delta=R.ProjectDiff.compare(base,changed);
      const removed=structuredClone(base); removed.topology.cables=[];
      const add=structuredClone(base); add.topology.racks[0].devices.push({...structuredClone(base.topology.racks[0].devices[1]),instanceId:'device-3',topU:8});
      return {equivalent,delta,removed:R.ProjectDiff.compare(base,removed),add:R.ProjectDiff.compare(base,add)};
    });
    assert.equal(result.equivalent.changes.length,0);
    assert.deepEqual(result.delta.changes.map(c=>c.kind).sort(),['cable','device','locations','port','project']);
    assert.equal(result.delta.changes.find(c=>c.kind==='port').fields[0].path,'vlan');
    assert.equal(result.delta.changes.find(c=>c.kind==='cable').fields[0].before,0);
    assert.equal(result.removed.removed,1); assert.equal(result.add.added,1);
  } finally { await browser.close(); }
});

test('named revisions persist labels and baseline, restore the full document in one undo, and survive full backups',async()=>{
  const browser=await chromium.launch({headless:true,channel:'msedge'});
  try {
    const page=await setup(browser), errors=[]; page.on('pageerror',e=>errors.push(e.message));
    let dialog=await open(page);
    await dialog.getByLabel('Revizyon adı',{exact:true}).fill('Saha öncesi');
    await dialog.getByLabel('Açıklama',{exact:true}).fill('Özel katalog ve saha kanıtı');
    await dialog.getByLabel('Revizyon etiketi').selectOption('approved');
    await dialog.getByLabel('Karşılaştırma temeli').check();
    await dialog.getByRole('button',{name:'Revizyon kaydet',exact:true}).click(); await idle(page);
    assert.match(await dialog.getByRole('status').textContent(),/dayanıklı/);
    await dialog.getByRole('button',{name:'Kapat',exact:true}).click();
    const result=await page.evaluate(async()=>{
      const R=window.RackStudio, base=R.ProjectDocument.capture(R.STATE), first=(await R.ProjectRevisions.list(base.projectId))[0];
      const next=structuredClone(base); next.topology.racks[0].devices[0].topU--; next.topology.racks[0].devices[0].portsConfig.p1.vlan='101';
      next.metadata.customer='Changed'; next.locations[0].name='Changed site'; next.topology.customCatalog['pilot-switch'].sourceVersion='fixture-2'; next.observations[0].raw.hostname='Changed';
      let command=R.ProjectCommands.execute({...R.ProjectCommands.begin(),type:'RestoreProjectDocument',payload:{document:next}}); await command.committed;
      const changed=R.ProjectDocument.capture(R.STATE);
      const second=await R.ProjectRevisions.create({name:'Teslim',tag:'delivered',baseline:true});
      const revisions=await R.ProjectRevisions.list(base.projectId);
      const count=R.ProjectCommands.receipts(changed).length;
      await R.ProjectRevisions.restore(first.id);
      const restored=R.ProjectDocument.capture(R.STATE);
      const receipts=R.ProjectCommands.receipts(restored).length;
      R.undoProject(); await R.saveProjectNow(); const undone=R.ProjectDocument.capture(R.STATE);
      R.redoProject(); await R.saveProjectNow(); const redone=R.ProjectDocument.capture(R.STATE);
      const archive=await R.ProjectArchive.exportArchive();
      const target=new R.ProjectRepositoryClass(); target.database=new Promise((resolve,reject)=>{const req=indexedDB.open('revision-backup-test',2); req.onupgradeneeded=()=>{for(const name of R.ProjectStorageIDB.STORES)req.result.createObjectStore(name);};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
      await R.ProjectArchive.importArchive(archive,target);
      const rows=await R.ProjectStorageIDB.entries(await target.database,'revisions');
      return {base,changed,restored,undone,redone,receipts,count,first,second,revisions,imported:rows.filter(r=>typeof r.key[1]==='string').map(r=>r.value),blob:await (await R.ProjectStorageIDB.read(await target.database,'evidence',[base.projectId,'blob-1'])).blob.text()};
    });
    assert.equal(result.first.tag,'approved'); assert.equal(result.second.tag,'delivered');
    assert.equal(result.revisions.filter(r=>r.baseline).length,1); assert.equal(result.revisions.find(r=>r.baseline).id,result.second.id);
    for(const key of ['metadata','locations','catalogContext','observations','fieldEvents','evidenceRefs','handoverRecords','integrationMappings','futureV1Hint']) assert.deepEqual(result.restored[key],result.base[key]);
    assert.deepEqual(result.restored.topology,result.base.topology);
    assert.equal(result.restored.revision,result.changed.revision+1); assert.equal(result.receipts,result.count+1);
    assert.equal(result.undone.metadata.customer,'Changed'); assert.equal(result.redone.metadata.customer,result.base.metadata.customer);
    assert.equal(result.imported.length,2); assert.equal(result.blob,'photo');
    await page.reload(); await page.waitForSelector('.studio-editor[data-ready="true"]'); dialog=await open(page);
    assert.equal(await dialog.locator('.rv-card').count(),2); assert.deepEqual(errors,[]);
  } finally { await browser.close(); }
});

test('legacy import preserves its source, stale restore and aborted named writes preserve drafts and baseline',async()=>{
  const browser=await chromium.launch({headless:true,channel:'msedge'});
  try {
    const page=await setup(browser);
    const result=await page.evaluate(async()=>{
      const R=window.RackStudio, base=R.ProjectDocument.capture(R.STATE);
      const source=JSON.stringify([{id:'legacy-1',label:'Eski proje',timestamp:'2026-10-06T10:00:00Z',projectDocument:base}]);
      localStorage.setItem('rack_studio_snapshots_v1',source);
      const old=await R.ProjectRevisions.importLegacy(0);
      const baseline=await R.ProjectRevisions.create({name:'Baseline',baseline:true});
      const before=await R.ProjectRevisions.list(base.projectId), original=IDBObjectStore.prototype.add;
      // Abort after request scheduling, including attempted baseline updates.
      IDBObjectStore.prototype.add=function(...args){const request=original.apply(this,args);if(this.name==='revisions'){request.onsuccess=()=>this.transaction.abort();}return request;};
      let failed; try{await R.ProjectRevisions.create({name:'Uncommitted',baseline:true});}catch(e){failed=e.message;}
      IDBObjectStore.prototype.add=original;
      const after=await R.ProjectRevisions.list(base.projectId), expected=R.ProjectCommands.begin();
      R.STATE.racks[0].devices[0].hostname='Newer'; R.flushProjectChanges();
      const draft=JSON.stringify(R.ProjectDocument.capture(R.STATE)); let stale;
      try{await R.ProjectRevisions.restore(old.id,expected);}catch(e){stale=e.message;}
      const foreign=structuredClone(base); foreign.projectId=crypto.randomUUID(); foreign.evidenceRefs[0].projectId=foreign.projectId;
      localStorage.setItem('rack_studio_snapshots_v1',JSON.stringify([{projectDocument:foreign}])); let foreignError;
      try{await R.ProjectRevisions.importLegacy(0);}catch(e){foreignError=e.message;}
      localStorage.setItem('rack_studio_snapshots_v1',source);
      return {old,baseline,before,after,failed,stale,foreignError,preserved:draft===JSON.stringify(R.ProjectDocument.capture(R.STATE)),sourcePreserved:localStorage.getItem('rack_studio_snapshots_v1')===source};
    });
    assert.equal(result.old.source.kind,'legacySnapshot'); assert.deepEqual(result.before,result.after); assert.ok(result.failed);
    assert.match(result.stale,/revizyonu değişti/); assert.match(result.foreignError,/açık projeye/); assert.equal(result.preserved,true); assert.equal(result.sourcePreserved,true);
  } finally { await browser.close(); }
});

test('revision UI compares field changes at phone widths, navigates to devices and restores from 3D',async()=>{
  const browser=await chromium.launch({headless:true,channel:'msedge'});
  try {
    const page=await setup(browser);
    await page.evaluate(async()=>{const R=window.RackStudio; await R.ProjectRevisions.create({name:'İlk revizyon',baseline:true}); R.STATE.racks[0].devices[0].hostname='Yeni cihaz'; R.STATE.racks[0].devices[0].portsConfig.p1.vlan='101'; R.flushProjectChanges(); await R.saveProjectNow();});
    let dialog=await open(page);
    await dialog.locator('.rv-change[data-kind="device"] summary').click();
    await dialog.locator('.rv-change[data-kind="port"] summary').click();
    for(const theme of ['light','dark','blueprint','high-contrast']) {
      await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
      const colors=await dialog.evaluate(el=>{const probe=document.createElement('span');probe.style.color='var(--text-main)';el.append(probe);const expected=getComputedStyle(probe).color;probe.remove();return {actual:getComputedStyle(el).color,expected};});
      assert.equal(colors.actual,colors.expected);
      await page.screenshot({path:path.resolve(__dirname,`../docs/product-plan/results/revisions-${theme}.png`)});
    }
    await page.evaluate(()=>document.documentElement.dataset.theme='light');
    for(const width of [320,390]) {
      await page.setViewportSize({width,height:900});
      const overflow=await dialog.evaluate(el=>({width:el.getBoundingClientRect().width,overflow:el.scrollWidth-el.clientWidth}));
      assert.ok(overflow.width<=width); assert.ok(overflow.overflow<=1);
      await page.screenshot({path:path.resolve(__dirname,`../docs/product-plan/results/revisions-${width}.png`)});
      await dialog.locator('.rv-diff').scrollIntoViewIfNeeded();
      await page.screenshot({path:path.resolve(__dirname,`../docs/product-plan/results/revisions-${width}-diff.png`)});
    }
    await dialog.locator('.rv-change[data-kind="device"]').getByRole('button',{name:'Editörde göster',exact:true}).click();
    assert.equal(await page.locator('.revision-manager').count(),0);
    await page.waitForSelector('.mounted-device.device-focused[data-instance-id="device-1"]');
    await page.setViewportSize({width:1440,height:950});
    await page.locator('#btn-view-3d').click(); await page.waitForFunction(()=>window.is3DMode);
    dialog=await open(page); await dialog.getByRole('button',{name:'Seçili revizyonu geri yükle',exact:true}).click(); await idle(page);
    assert.match(await dialog.getByRole('status').textContent(),/geri yüklendi/);
    const scene=await page.evaluate(()=>({live:window.RackStudio.STATE.racks[0].devices[0].hostname,scene:window.__STUDIO3D__.state.devices.find(d=>d.id==='device-1').hostname}));
    assert.equal(scene.live,'edge-1'); assert.equal(scene.scene,'edge-1');
    await page.keyboard.press('Escape'); assert.equal(await page.locator('.revision-manager').count(),0);
  } finally { await browser.close(); }
});
