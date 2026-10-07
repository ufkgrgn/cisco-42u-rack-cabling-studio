const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/product/project-rich-v1.json'),'utf8'));fixture.evidenceRefs=[];fixture.fieldEvents=[];
async function setup(browser){const page=await browser.newPage({viewport:{width:1440,height:950}});page.setDefaultTimeout(8000);await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);await page.waitForSelector('.studio-editor[data-ready="true"]');await page.evaluate(async doc=>{const R=window.RackStudio;R.loadCustomTopology(doc);await R.saveProjectNow();},fixture);return page;}
const key=page=>page.evaluate(()=>{const R=window.RackStudio;return R.ProjectCommands.domainKey(R.ProjectDocument.capture(R.STATE));});
async function action(page,name){await page.getByRole('dialog',{name:'İlk kullanım',exact:true}).getByRole('button',{name,exact:true}).click();await page.waitForFunction(()=>!document.getElementById('onboarding-dialog')?.hasAttribute('aria-busy'));}

test('onboarding skip and separate sample preserve the user project through placement connection and return',async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});try{const page=await setup(browser),before=await key(page),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.evaluate(()=>window.RackStudio.Onboarding.open());const dialog=page.getByRole('dialog',{name:'İlk kullanım',exact:true});
 for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:950});await page.screenshot({path:path.resolve(__dirname,`../docs/product-plan/results/onboarding-${width}.png`)});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
 await dialog.getByRole('button',{name:'Atla / Kapat'}).click();assert.equal(await key(page),before);
 await page.evaluate(()=>window.RackStudio.Onboarding.open());await action(page,'Ayrı örnek projeyi başlat');assert.notEqual(await page.evaluate(()=>window.RackStudio.STATE.projectDocument.projectId),fixture.projectId);
 await action(page,'Örnek cihazı yerleştir');assert.equal(await page.evaluate(()=>window.RackStudio.STATE.racks[0].devices.length),2);
 await action(page,'Örnek portları bağla');assert.equal(await page.evaluate(()=>window.RackStudio.STATE.cables.length),1);
 await action(page,'Saha görünümünü incele');assert.equal(await page.evaluate(()=>window.RackStudio.WorkflowViews.get()),'field');
 await action(page,'Örnek sunum taslağını kaydet');assert.match(await dialog.textContent(),/Örnek tamamlandı/);assert.equal(await page.evaluate(async()=>{const R=window.RackStudio;return (await R.ProjectRevisions.list(R.STATE.projectDocument.projectId))[0].presentationViews.length;}),1);
 await action(page,'Kendi projeme dön');assert.equal(await key(page),before);
 await page.evaluate(()=>window.RackStudio.Onboarding.open());assert.match(await dialog.textContent(),/Ayrı örnek projeyi başlat/);await page.keyboard.press('Escape');assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});

test('bookmarks restore 2D and 3D cameras reject foreign missing and stale targets and carry revision output in backup',async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});try{const page=await setup(browser),before=await key(page);
 await page.evaluate(async()=>{const R=window.RackStudio;R.ZOOM_STATE.scale=.75;R.ZOOM_STATE.panX=83;R.ZOOM_STATE.panY=-42;R.updateStageTransform(false);window.view2d=await R.SavedViews.capture('2D açı');R.ZOOM_STATE.panX=0;await R.SavedViews.restore(window.view2d);});assert.equal(await page.evaluate(()=>window.RackStudio.ZOOM_STATE.panX),83);assert.equal(await key(page),before);
 await page.evaluate(async()=>{const R=window.RackStudio;await R.setStudioMode(true);const studio=window.__STUDIO3D__;studio.camera.position.set(4,5,6);studio.controls.target.set(1,2,3);window.view3d=await R.SavedViews.capture('3D sunum',true);studio.camera.position.set(9,9,9);await R.SavedViews.restore(window.view3d);});
 assert.deepEqual(await page.evaluate(()=>window.__STUDIO3D__.camera.position.toArray()),[4,5,6]);assert.equal(await key(page),before);
 const result=await page.evaluate(async()=>{const R=window.RackStudio,archive=JSON.parse(await R.ProjectArchive.exportArchive());const row=archive.revisions.find(v=>v.value.id===window.view3d.namedRevisionId);await R.WorkspaceState.removeView(window.view3d.projectId,window.view3d.id);return {output:row.value.presentationViews[0].name,recovered:(await R.SavedViews.list()).some(v=>v.id===window.view3d.id)};});assert.equal(result.output,'3D sunum');assert.equal(result.recovered,true);
 const rejected=await page.evaluate(async()=>{const R=window.RackStudio,results=[];for(const patch of [{projectId:'foreign'},{rackId:'missing'},{scale:NaN}]){try{await R.SavedViews.restore({...window.view2d,...patch});results.push(false);}catch{results.push(true);}}return results;});assert.deepEqual(rejected,[true,true,true]);
 await page.evaluate(async()=>{const R=window.RackStudio;await R.setStudioMode(false);const doc=R.ProjectDocument.capture(R.STATE);doc.metadata.name='Değişen çalışma';const result=R.ProjectCommands.execute({...R.ProjectCommands.begin(),type:'RestoreProjectDocument',payload:{document:doc}});await result.committed;});
 assert.match(await page.evaluate(async()=>{try{await window.RackStudio.SavedViews.restore(window.view3d);return '';}catch(e){return e.message;}}),/revizyonu açık çalışmadan farklı/);
 await page.evaluate(async()=>window.RackStudio.ProjectManagement.create('Diğer proje'));assert.equal(await page.evaluate(async()=>{try{await window.RackStudio.SavedViews.restore(window.view2d);return false;}catch{return true;}}),true);assert.equal(await page.evaluate(async()=>(await window.RackStudio.SavedViews.list()).length),0);
 }finally{await browser.close();}
});

test('project workspace defaults survive reload and command navigation selects canonical devices',async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});try{const page=await setup(browser);
 await page.evaluate(async()=>{const R=window.RackStudio;R.WorkflowViews.set('field');await R.WorkspaceState.saveDefault();await R.saveProjectNow();await R.ProjectRepository.release(R.STATE.projectDocument.projectId);});await page.reload();await page.waitForSelector('.studio-editor[data-ready="true"]');await page.waitForFunction(()=>window.RackStudio.WorkflowViews.get()==='field');
 await page.keyboard.press('Control+k');await page.getByLabel('Komut ara',{exact:true}).fill('edge-1');await page.getByRole('option',{name:/Cihaz: edge-1/}).click();assert.match(await page.locator('#workflow-selection-panel').textContent(),/SERIAL-1/);
 await page.evaluate(()=>window.RackStudio.SavedViews.open());const dialog=page.getByRole('dialog',{name:'Kayıtlı görünümler',exact:true});assert.match(await dialog.textContent(),/Bu projede kayıtlı görünüm yok/);
 for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:950});await page.screenshot({path:path.resolve(__dirname,`../docs/product-plan/results/saved-views-${width}.png`)});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
 await dialog.getByLabel('Görünüm adı',{exact:true}).fill('Yerel açı');await dialog.getByRole('button',{name:'Geçerli görünümü kaydet'}).click();await page.waitForFunction(()=>document.getElementById('saved-view-list').textContent.includes('Yerel açı'));await page.keyboard.press('Escape');
 await page.evaluate(async()=>window.RackStudio.ProjectManagement.create('Yeni'));await page.waitForFunction(()=>window.RackStudio.WorkflowViews.get()==='design');
 assert.equal(await page.evaluate(async()=>(await window.RackStudio.SavedViews.list()).length),0);
 }finally{await browser.close();}
});
