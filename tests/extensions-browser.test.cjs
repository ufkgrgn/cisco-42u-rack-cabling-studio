const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),url=pathToFileURL(path.join(root,'index.html')).href,directory=path.join(root,'docs/product-plan/results/p22-p31');fs.mkdirSync(directory,{recursive:true});
test('integration, workspace and diagnostic dialogs fit responsive/theme surfaces and keep secrets out of diagnostics',async()=>{
  const browser=await chromium.launch({headless:true,channel:'msedge'});try{const page=await browser.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto(url);await page.waitForSelector('.studio-editor[data-ready="true"]');
    await page.evaluate(()=>{const R=window.RackStudio;R.STATE.projectDocument.metadata.name='PRIVATE-CUSTOMER';R.STATE.projectDocument.metadata.customer='PRIVATE-CUSTOMER';});
    const diagnostic=await page.evaluate(()=>window.RackStudio.ProductDiagnostics.capture());assert.doesNotMatch(JSON.stringify(diagnostic),/PRIVATE-CUSTOMER|token|hostname|projectId/);assert.equal(diagnostic.applicationVersion,'4.0.0');
    for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:950});for(const[type,id]of [['netbox','netbox-dialog'],['workspace','workspace-dialog'],['diagnostics','diagnostics-dialog']]){
      await page.evaluate(type=>{const R=window.RackStudio;return type==='netbox'?R.NetBoxController.open():type==='workspace'?R.WorkspaceUI.open():R.ProductDiagnostics.open();},type);
      const dialog=page.locator('#'+id);await dialog.waitFor({state:'visible'});await page.waitForTimeout(70);
      const bounds=await dialog.boundingBox();assert.ok(bounds.x>=-1&&bounds.x+bounds.width<=width+1,`${type} horizontal bounds ${width}`);
      assert.ok(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+2),`${type} overflow ${width}`);
      await page.screenshot({path:path.join(directory,`${type}-${width}.png`)});await dialog.getByRole('button',{name:'Kapat',exact:true}).click();await dialog.waitFor({state:'detached'});
    }}
    await page.setViewportSize({width:390,height:850});for(const theme of ['dark','light','blueprint','high-contrast']){await page.evaluate(theme=>document.documentElement.setAttribute('data-theme',theme),theme);await page.evaluate(()=>window.RackStudio.WorkspaceUI.open());await page.screenshot({path:path.join(directory,`workspace-${theme}-390.png`)});await page.locator('#workspace-dialog').getByRole('button',{name:'Kapat',exact:true}).click();await page.locator('#workspace-dialog').waitFor({state:'detached'});}
    assert.deepEqual(errors,[]);
  }finally{await browser.close();}
});
test('NetBox explicit preview imports repeatable observations while preserving physical layout',async()=>{const browser=await chromium.launch({headless:true,channel:'msedge'});try{const page=await browser.newPage();await page.goto(url);await page.waitForSelector('.studio-editor[data-ready="true"]');
  await page.evaluate(()=>window.RackStudio.NetBoxController.open());const dialog=page.locator('#netbox-dialog');const input={format:'rack-studio-netbox',version:1,instance:'https://netbox.test',complete:true,sites:[],racks:[],devices:[{id:1,name:'Observed',device_type:{id:1,model:'UNKNOWN'}}],interfaces:[],cables:[]};
  await dialog.getByLabel('NetBox gözlem paketi aç').setInputFiles({name:'netbox.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(input))});await page.waitForFunction(()=>document.querySelector('#netbox-dialog .pm-card'));
  await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'Seçilileri gözlem olarak kaydet',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#netbox-dialog').hasAttribute('aria-busy'));assert.match(await dialog.getByRole('status').textContent(),/Hedef|hedef|eşle|Eşle/);
}finally{await browser.close();}});
