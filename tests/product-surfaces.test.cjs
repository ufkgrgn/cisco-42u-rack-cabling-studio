const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/product/project-rich-v1.json'),'utf8'));
const results = path.resolve(__dirname,'../docs/product-plan/results/ui-audit');
let browser;
test.before(async () => {browser = await chromium.launch({channel:'msedge',headless:true});fs.mkdirSync(results,{recursive:true});});
test.after(async () => {await browser.close();});
async function setup() {
  const page = await browser.newPage({viewport:{width:1440,height:950}});
  await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
  await page.waitForSelector('.studio-editor[data-ready="true"]');
  await page.evaluate(async input => {
    const d = structuredClone(input);d.projectId = crypto.randomUUID();d.revision=0;
    d.evidenceRefs=[];d.fieldEvents=[];d.handoverRecords=[];
    RackStudio.loadCustomTopology(d);RackStudio.flushProjectChanges();await RackStudio.saveProjectNow();
  },fixture);
  return page;
}
test('product dialogs fit all four themes and desktop/tablet/mobile widths, keep focus and close with Escape',async () => {
  const page = await setup(), errors=[];page.on('pageerror',e=>errors.push(e.message));
  const surfaces=[['field','FieldWorkflowUI','field-workflow-dialog'],['qr','FieldQRUI','field-qr-dialog'],['observations','FieldObservationUI','field-observations-dialog'],['delivery','DeliveryUI','delivery-dialog'],['engineering','EngineeringUI','engineering-dialog'],['scenario','ScenarioUI','scenario-dialog'],['projects','ProjectManager','.project-manager'],['revisions','RevisionController','.revision-manager'],['views','SavedViews','saved-views-dialog'],['onboarding','Onboarding','onboarding-dialog'],['checks','ProjectChecks','project-checks-dialog']];
  try {
    for (const theme of ['dark','light','blueprint','high-contrast']) for (const width of [1440,768,390,320]) {
      await page.setViewportSize({width,height:950});
      await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
      for (const [name,api,id] of surfaces) {
        await page.evaluate(async api=>{if(!RackStudio[api]?.open)throw new Error('Missing UI '+api);await RackStudio[api].open();},api);
        const dialog = page.locator(id.startsWith('.')?id:'#'+id);
        await dialog.waitFor({state:'visible'});
        const metrics=await dialog.evaluate(el=>({width:el.getBoundingClientRect().width,scroll:el.scrollWidth,client:el.clientWidth,focus:el.contains(document.activeElement)}));
        assert.ok(metrics.width<=width,`${name}/${theme}/${width}: dialog width`);
        assert.ok(metrics.scroll<=metrics.client+2,`${name}/${theme}/${width}: horizontal overflow ${JSON.stringify(metrics)}`);
        assert.ok(metrics.focus,`${name}: focus remains in modal`);
        if((theme==='dark'||theme==='light')&&(width===1440||width===390))await page.screenshot({path:path.join(results,`${name}-${theme}-${width}.png`)});
        await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
      }
    }
    assert.deepEqual(errors,[]);
  } finally {await page.close();}
});
test('field search, selection actions, QR roundtrip and frozen report preview keep canonical project unchanged',async () => {
  const page = await setup();
  try {
    const before=await page.evaluate(()=>RackStudio.ProjectCommands.domainKey(RackStudio.ProjectDocument.capture(RackStudio.STATE)));
    await page.evaluate(()=>RackStudio.FieldWorkflowUI.open());
    await page.getByLabel('Saha işi ara',{exact:true}).fill('EDGE-2');
    assert.equal(await page.locator('.field-job').count(),1);
    await page.locator('.field-job').click();assert.ok(await page.getByLabel('Teknisyen',{exact:true}).isVisible());
    await page.keyboard.press('Escape');
    await page.evaluate(()=>{RackStudio.WorkflowSelection.choose('cable','cable-1','2d');RackStudio.WorkflowSelection.open();});
    assert.equal(await page.locator('.workflow-selection-dialog .selection-actions button').count(),7);
    await page.keyboard.press('Escape');
    await page.evaluate(()=>RackStudio.FieldQRUI.open({kind:'cable',id:'cable-1'}));
    assert.equal(await page.getByLabel('QR kimliği',{exact:true}).isVisible(),false);
    await page.locator('#field-qr-dialog summary').click();
    const raw=await page.getByLabel('QR kimliği',{exact:true}).inputValue();
    assert.equal(await page.evaluate(raw=>RackStudio.FieldQR.resolve(raw).entityRef?.id || RackStudio.FieldQR.resolve(raw).id,raw),'cable-1');
    await page.keyboard.press('Escape');
    await page.evaluate(()=>RackStudio.DeliveryUI.open());
    assert.equal(await page.locator('#delivery-dialog iframe').isVisible(),false);
    assert.equal(await page.locator('#delivery-dialog [data-action=pdf]').isDisabled(),true);
    await page.locator('#delivery-dialog [data-action=freeze]').click();
    await page.locator('#delivery-dialog iframe').waitFor({state:'visible'});
    assert.equal(await page.locator('#delivery-dialog .product-empty').isVisible(),false);
    assert.equal(await page.locator('#delivery-dialog [data-action=pdf]').isDisabled(),false);
    await page.keyboard.press('Escape');
    await page.evaluate(()=>RackStudio.DeliveryUI.open());assert.equal(await page.locator('#delivery-dialog iframe').isVisible(),false);
    await page.keyboard.press('Escape');
    const after=await page.evaluate(()=>RackStudio.ProjectCommands.domainKey(RackStudio.ProjectDocument.capture(RackStudio.STATE)));
    assert.equal(after,before);
  } finally {await page.close();}
});
test('unused non-cage ports reject transceivers and installed port selections are included in BOM',async () => {
  const page=await setup();
  try {
    const result=await page.evaluate(async()=>{
      const d=RackStudio.ProjectDocument.capture(RackStudio.STATE), r=d.topology.racks[0], device=r.devices[0];
      device.catalogKey='eng-cisco-c9200l-24p-4g';d.topology.cables=[];
      device.portsConfig={p1:{transceiver:{model:'SFP-10G-SR',quantity:1}}};
      const endpoint=RackStudio.EngineeringCompatibility.endpoint(d,{rackId:r.id,instanceId:device.instanceId,portId:'p1'});
      const issues=RackStudio.EngineeringIssues.collect(d);
      const report=await RackStudio.ReportModel.build(d),bom=RackStudio.BOM.build(report);
      return {errors:endpoint.errors,blocked:issues.some(i=>i.code==='port-module-p1'&&i.status==='blocked'),quantity:bom.rows.find(r=>r.kind==='transceiver')?.quantity};
    });
    assert.ok(result.errors.length);assert.equal(result.blocked,true);assert.equal(result.quantity,1);
  } finally {await page.close();}
});
