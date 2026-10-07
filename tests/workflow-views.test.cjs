const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/product/project-rich-v1.json'),'utf8'));
async function setup(browser){const page=await browser.newPage({viewport:{width:1440,height:950}});page.setDefaultTimeout(6000);await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);await page.waitForSelector('.studio-editor[data-ready="true"]');await page.evaluate(doc=>window.RackStudio.loadCustomTopology(doc),fixture);return page;}
async function mode(page,value){await page.locator('#btn-tools-menu-toggle').click();await page.getByLabel('Çalışma görünümü',{exact:true}).selectOption(value);if(await page.locator('#hud-tools-panel').isVisible())await page.locator('#btn-close-tools').click();await page.waitForTimeout(320);}

test('workflow modes preserve the project, separate renderer mode and block presentation editing keys',async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{const page=await setup(browser);const before=await page.evaluate(()=>window.RackStudio.ProjectCommands.domainKey(window.RackStudio.ProjectDocument.capture(window.RackStudio.STATE)));
 for(const value of ['field','presentation','design']){await mode(page,value);assert.equal(await page.evaluate(()=>window.RackStudio.WorkflowViews.get()),value);assert.equal(await page.evaluate(()=>window.is3DMode),false);assert.equal(await page.evaluate(()=>window.RackStudio.ProjectCommands.domainKey(window.RackStudio.ProjectDocument.capture(window.RackStudio.STATE))),before);}
 await page.locator('#btn-view-3d').click();await page.waitForFunction(()=>window.is3DMode);
 await page.evaluate(()=>window.__STUDIO3D__.selectDevice('device-1'));
 await page.screenshot({path:path.resolve(__dirname,'../docs/product-plan/results/workflow-selection-3d-1440.png')});
 await mode(page,'field');assert.equal(await page.evaluate(()=>window.is3DMode),true);
 assert.match(await page.locator('#workflow-selection-panel').textContent(),/edge-1/);
 await mode(page,'presentation');await page.keyboard.press('Delete');await page.keyboard.press('Control+z');
 assert.equal(await page.evaluate(()=>window.RackStudio.STATE.racks[0].devices.length),2);
 assert.equal(await page.evaluate(()=>window.__STUDIO3D__.moveDevice('device-1',-1)),false);
 assert.equal(await page.evaluate(()=>window.RackStudio.ProjectCommands.domainKey(window.RackStudio.ProjectDocument.capture(window.RackStudio.STATE))),before);
 await page.locator('#btn-view-2d').click();await page.waitForFunction(()=>!window.is3DMode);assert.equal(await page.evaluate(()=>window.RackStudio.WorkflowViews.get()),'presentation');
 await mode(page,'design');
 }finally{await browser.close();}
});

test('common selection uses canonical device metadata and ports in 2D/3D and edits through the existing form',async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{const page=await setup(browser),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.evaluate(()=>document.querySelector('.mounted-device[data-instance-id="device-1"]').click());
 const panel=page.locator('#workflow-selection-panel');await panel.waitFor({state:'visible'});assert.match(await panel.textContent(),/edge-1/);assert.match(await panel.textContent(),/VLAN 99/);assert.match(await panel.textContent(),/SERIAL-1/);
 await page.locator('#btn-view-3d').click();await page.waitForFunction(()=>window.is3DMode);
 await page.evaluate(()=>window.__STUDIO3D__.selectDevice('device-2'));assert.match(await panel.textContent(),/EDGE-2/);assert.doesNotMatch(await panel.textContent(),/SERIAL-1/);
 await page.evaluate(()=>window.__STUDIO3D__.selectDevice('device-1'));
 await panel.getByRole('button',{name:'Cihaz bilgilerini düzenle',exact:true}).click();
 assert.equal(await page.locator('#modal-device-edit').getAttribute('data-source'),'3d');assert.equal(await page.locator('#modal-device-edit').getAttribute('data-device-id'),'device-1');
 await page.locator('#dev-edit-hostname').fill('workflow-edit');await page.locator('#btn-save-device-edit').click();
 await page.waitForFunction(()=>window.RackStudio.STATE.racks[0].devices[0].hostname==='workflow-edit');assert.match(await panel.textContent(),/workflow-edit/);
 await page.evaluate(()=>window.__STUDIO3D__.selectCable('cable-1'));assert.match(await panel.textContent(),/Ölçülen metraj/);assert.match(await panel.textContent(),/Kaynak/);
 await page.setViewportSize({width:390,height:950});await page.waitForTimeout(320);await page.evaluate(()=>window.__STUDIO3D__.selectDevice('device-1'));
 await page.locator('#btn-tools-menu-toggle').click();await page.locator('#btn-workflow-selection').click();const compact=page.getByRole('dialog',{name:'Seçim bilgileri',exact:true});assert.match(await compact.textContent(),/workflow-edit/);
 await page.screenshot({path:path.resolve(__dirname,'../docs/product-plan/results/workflow-selection-3d-390.png')});await page.keyboard.press('Escape');assert.equal(await compact.isVisible(),false);
 await page.evaluate(()=>window.__STUDIO3D__.selectCable('cable-1'));if(!(await page.locator('#hud-tools-panel').isVisible()))await page.locator('#btn-tools-menu-toggle').click();await page.locator('#btn-workflow-selection').click();assert.match(await compact.textContent(),/Pilot bağlantı/);await page.keyboard.press('Escape');
 await page.setViewportSize({width:1440,height:950});await page.waitForTimeout(320);if(await page.locator('#hud-tools-panel').isVisible())await page.locator('#btn-close-tools').click();
 await page.locator('#btn-view-2d').click();await page.waitForFunction(()=>!window.is3DMode);
 await page.evaluate(()=>window.RackStudio.highlightCable('cable-1',true));assert.match(await panel.textContent(),/Pilot bağlantı/);
 await page.evaluate(()=>window.RackStudio.loadCustomTopology({racks:[{id:'new-rack',name:'Yeni',heightU:18,devices:[]}],cables:[]}));
 assert.equal(await panel.isVisible(),false);assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});

test('workflow views and selection fit 320/390/768/1440 widths with keyboard and mobile port access',async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{const page=await setup(browser);
 for(const width of [320,390,768,1440]){
  await page.setViewportSize({width,height:950});
  for(const mode of ['design','field','presentation']){
   await page.evaluate(mode=>window.RackStudio.WorkflowViews.set(mode),mode);await page.waitForTimeout(320);
   const result=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth}));assert.ok(result.scroll<=result.width+1,JSON.stringify({width,mode,result}));
   await page.screenshot({path:path.resolve(__dirname,`../docs/product-plan/results/workflow-${mode}-${width}.png`)});
  }
 }
 await page.setViewportSize({width:390,height:950});await page.evaluate(()=>{const R=window.RackStudio;R.WorkflowViews.set('field');R.highlightCable('cable-1',true);});
 await page.locator('#btn-mobile-selection').click();let dialog=page.locator('#mobile-workflow-dialog');assert.match(await dialog.textContent(),/Ölçülen metraj/);assert.match(await dialog.textContent(),/Port seçerek bağla/);
 await page.screenshot({path:path.resolve(__dirname,'../docs/product-plan/results/workflow-selection-390.png')});
 await page.keyboard.press('Escape');assert.equal(await dialog.isVisible(),false);assert.equal(await page.locator('#btn-mobile-selection').evaluate(el=>el===document.activeElement),true);
 await page.locator('#btn-mobile-selection').click();await dialog.getByRole('button',{name:'Port seçerek bağla',exact:true}).click();assert.match(await dialog.textContent(),/Bağlantının ilk portunu seçin/);await page.keyboard.press('Escape');
 await page.locator('#btn-tools-menu-toggle').click();await page.locator('#workflow-mode').focus();await page.keyboard.press('s');await page.keyboard.press('Escape');assert.equal(await page.locator('#hud-tools-panel').isVisible(),false);
 }finally{await browser.close();}
});
