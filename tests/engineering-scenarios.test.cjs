const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/product/project-rich-v1.json'),'utf8'));
const results = path.resolve(__dirname,'../docs/product-plan/results/p17-p21');
let browser;
test.before(async () => { browser = await chromium.launch({channel:'msedge',headless:true}); fs.mkdirSync(results,{recursive:true}); });
test.after(async () => { await browser.close(); });
async function setup() {
  const page = await browser.newPage({viewport:{width:1440,height:950}}), errors = [];
  page.on('pageerror',e => errors.push(e.message));
  await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
  await page.waitForSelector('.studio-editor[data-ready="true"]');
  await page.evaluate(async template => {
    const R = window.RackStudio, d = structuredClone(template);
    d.projectId = 'eng-' + crypto.randomUUID(); d.revision = 0; d.catalogContext = {}; d.extensions = {};
    for (const key of ['observations','fieldEvents','evidenceRefs','handoverRecords','integrationMappings']) d[key] = [];
    d.topology.customCatalog = {}; d.topology.racks = [{id:'rack-a',name:'A',heightU:42,devices:[{instanceId:'sw-a',catalogKey:'eng-cisco-c9200l-24p-4g',topU:30,uHeight:1,hostname:'Switch A',portsConfig:{}},{instanceId:'sw-b',catalogKey:'eng-aruba-jl677a',topU:28,uHeight:1,hostname:'Switch B',portsConfig:{}}]},{id:'rack-b',name:'B',heightU:42,devices:[]}];
    d.topology.cables = [{id:'link-1',from:{rackId:'rack-a',instanceId:'sw-a',portId:'p1'},to:{rackId:'rack-a',instanceId:'sw-b',portId:'p1'},medium:'Cat6',color:'#00aaff',estimatedLengthMeters:3}];
    d.topology.activeRackId = 'rack-a'; R.loadCustomTopology(d); R.flushProjectChanges(); await R.saveProjectNow();
    window.source = {kind:'user',title:'Test planı',reference:'PLAN-17',checkedAt:'2026-10-07'};
  },fixture);
  return {page,errors};
}

test('pinned manufacturer definitions survive global updates, project switches, JSON and delivery export',async () => {
  const {page,errors} = await setup();
  try {
    const out = await page.evaluate(async () => {
      const R = RackStudio, d = R.CatalogSources.pin(R.ProjectDocument.capture(R.STATE)); R.loadCustomTopology(d);
      const old = R.CatalogSources.map(d)['eng-cisco-c9200l-24p-4g'], changed = structuredClone(old); changed.ports = changed.ports.slice(0,2); changed.modelVersion = 'next';
      R.CatalogSources.register(old.id,changed);
      const count = R.resolveCatalogItem(old.id).ports.length, validated = R.ProjectRepository.validate(JSON.parse(JSON.stringify(d)));
      const other = structuredClone(d); other.projectId = 'other'; other.catalogContext = {}; other.topology.cables = []; R.loadCustomTopology(other); const globalCount = R.resolveCatalogItem(old.id).ports.length;
      R.loadCustomTopology(validated); const backCount = R.resolveCatalogItem(old.id).ports.length;
      const report = await R.ReportModel.build(d); R.ProjectRepository.validate(report.document);
      const preview = R.CatalogSources.preview(d,old.id,changed);
      const standalone = structuredClone(d); standalone.projectId = 'standalone'; standalone.topology.racks[0].devices[0].catalogKey = 'standalone-model'; standalone.catalogContext.models['standalone-model'] = {definition:structuredClone(old)};
      R.loadCustomTopology(standalone); const present = !!R.resolveCatalogItem('standalone-model');
      const missing = structuredClone(d); missing.topology.racks[0].devices[0].catalogKey = 'standalone-model'; let rejected = false; try { R.ProjectRepository.validate(missing); } catch(e) { rejected = true; }
      R.loadCustomTopology(d); const removed = !R.resolveCatalogItem('standalone-model');
      return {count,globalCount,backCount,present,removed,rejected,reportPorts:report.catalog[old.id].ports.length,hasCustom:Object.hasOwn(report.document.topology.customCatalog,old.id),previewPorts:preview.catalogContext.models[old.id].definition.ports.length,source:old.provenance.source,second:R.CatalogSources.map(d)['eng-aruba-jl677a'].manufacturer,originalPorts:d.catalogContext.models[old.id].definition.ports.length};
    });
    assert.equal(out.count,28); assert.equal(out.globalCount,2); assert.equal(out.backCount,28); assert.equal(out.present,true); assert.equal(out.removed,true); assert.equal(out.rejected,true); assert.equal(out.reportPorts,28); assert.equal(out.hasCustom,false); assert.equal(out.previewPorts,2); assert.equal(out.originalPorts,28); assert.equal(out.second,'HPE Aruba'); assert.equal(out.source.kind,'manufacturer'); assert.deepEqual(errors,[]);
  } finally {await page.close();}
});

test('source based compatibility distinguishes missing data, cage/module/host, fiber ranges and combo usage',async () => {
  const {page} = await setup();
  try {
    const out = await page.evaluate(() => {
      const R = RackStudio, d = R.CatalogSources.pin(R.ProjectDocument.capture(R.STATE)), cable = d.topology.cables[0];
      const allowed = R.EngineeringCompatibility.assess(d,cable);
      const missing = structuredClone(d); delete missing.catalogContext.models['eng-aruba-jl677a'].definition.engineering.source;
      const unknown = R.EngineeringCompatibility.assess(missing,cable);
      const fiber = structuredClone(d); for(const x of fiber.topology.racks[0].devices) { x.catalogKey = 'eng-aruba-jl677a'; x.portsConfig.up1 = {transceiver:'SFP-10G-SR'}; }
      fiber.topology.cables[0] = {...cable,from:{...cable.from,portId:'up1'},to:{...cable.to,portId:'up1'},medium:'OM3',estimatedLengthMeters:301};
      const unsupportedVendor = R.EngineeringCompatibility.assess(fiber,fiber.topology.cables[0]);
      fiber.catalogContext.models['eng-aruba-jl677a'].definition.engineering.supportedTransceiverManufacturers = ['Cisco']; // Synthetic host profile, not manufacturer proof.
      const over = R.EngineeringCompatibility.assess(fiber,fiber.topology.cables[0]); fiber.topology.cables[0].estimatedLengthMeters = 300;
      const hostUnknown = R.EngineeringCompatibility.assess(fiber,fiber.topology.cables[0]);
      fiber.catalogContext.models['eng-aruba-jl677a'].definition.engineering.supportedTransceivers = ['SFP-10G-SR'];
      const exact = R.EngineeringCompatibility.assess(fiber,fiber.topology.cables[0]);
      fiber.topology.cables[0].medium = 'OS2'; const medium = R.EngineeringCompatibility.assess(fiber,fiber.topology.cables[0]);
      const combo = structuredClone(d); const model = combo.catalogContext.models['eng-cisco-c9200l-24p-4g'].definition; model.ports[0].engineering.comboGroup = 'one'; model.ports[1].engineering.comboGroup = 'one';
      combo.topology.cables.push({...cable,id:'link-2',from:{...cable.from,portId:'p2'},to:{...cable.to,portId:'p2'}});
      const grouped = R.EngineeringCompatibility.assess(combo,combo.topology.cables[0]);
      const slot = structuredClone(d), m = slot.catalogContext.models['eng-cisco-c9200l-24p-4g'].definition;
      m.ports[0].engineering.moduleSlot = 'slot-1'; m.engineering.moduleSlots = [{id:'slot-1',allowedModels:['good'],source}]; slot.topology.racks[0].devices[0].modules = [{slotId:'slot-1',model:'bad'}];
      return {allowed,unknown,over,unsupportedVendor,hostUnknown,exact,medium,grouped,slot:R.EngineeringCompatibility.assess(slot,slot.topology.cables[0])};
    });
    assert.equal(out.allowed.status,'allowed'); assert.equal(out.unknown.status,'unknown'); assert.equal(out.over.status,'blocked'); assert.equal(out.unsupportedVendor.status,'blocked'); assert.equal(out.hostUnknown.status,'unknown'); assert.equal(out.exact.status,'allowed'); assert.equal(out.medium.status,'blocked'); assert.equal(out.grouped.status,'blocked'); assert.equal(out.slot.status,'blocked');
  } finally {await page.close();}
});

test('sourced copper transceiver changes effective connector while unverified support remains unknown',async () => {
  const {page} = await setup();
  try {
    const out = await page.evaluate(() => {
      const R = RackStudio, d = R.CatalogSources.pin(R.ProjectDocument.capture(R.STATE)), m = d.catalogContext.models['eng-cisco-c9200l-24p-4g'].definition;
      d.catalogContext.transceivers = {'copper':{model:'copper',cage:'sfp',connector:'rj45',speedsMbps:[1000],media:['Cat6'],source}};
      d.topology.racks[0].devices[0].portsConfig.up1 = {transceiver:'copper'}; d.topology.cables[0].from.portId = 'up1';
      const unknown = R.EngineeringCompatibility.assess(d,d.topology.cables[0]); m.engineering.supportedTransceivers = ['copper'];
      const c = d.topology.cables[0], rules = R.NetworkRules.validateConnection(c.from,c.to,{...d.topology,catalogContext:d.catalogContext},R.CatalogSources.map(d),true);
      return {unknown,rules,known:R.EngineeringCompatibility.assess(d,c)};
    });
    assert.equal(out.unknown.status,'unknown'); assert.equal(out.known.status,'allowed'); assert.equal(out.rules.allowed,true); assert.equal(out.rules.status,'allowed');
  } finally {await page.close();}
});

test('PoE keeps unknown and zero, enforces per port and total limits and deduplicates consumer demand',async () => {
  const {page} = await setup();
  try {
    const out = await page.evaluate(() => {
      const R = RackStudio, d = R.CatalogSources.pin(R.ProjectDocument.capture(R.STATE)), a = d.topology.racks[0].devices[0];
      const unknown = R.PowerBudget.build(d).poe[0]; a.portsConfig.p1 = {poeDemand:{watts:0,source}}; const zero = R.PowerBudget.build(d).poe[0];
      a.portsConfig.p1.poeDemand.watts = 31; const perPort = R.PowerBudget.build(d).poe[0];
      a.portsConfig.p1.poeDemand.watts = 25; d.catalogContext.models[a.catalogKey].definition.engineering.poe.budgetWatts = 20; const total = R.PowerBudget.build(d).poe[0];
      d.catalogContext.models[a.catalogKey].definition.engineering.poe.budgetWatts = 370; a.portsConfig.p2 = {poeDemand:{watts:25,source}};
      const c = d.topology.cables[0]; d.topology.cables.push({...c,id:'link-2',from:{...c.from,portId:'p2'},to:{...c.to,portId:'p2'}});
      const dedup = R.PowerBudget.build(d).poe[0]; delete a.portsConfig.p1.poeDemand.source; const unsourced = R.PowerBudget.build(d).poe[0];
      return {unknown,zero,perPort,total,dedup,unsourced};
    });
    assert.equal(out.unknown.status,'unknown'); assert.equal(out.unknown.knownWatts,0); assert.equal(out.unknown.unknown,1); assert.equal(out.zero.status,'allowed'); assert.equal(out.zero.ports[0].watts,0); assert.equal(out.perPort.status,'blocked'); assert.equal(out.total.status,'blocked'); assert.equal(out.dedup.knownWatts,25); assert.equal(out.dedup.status,'unknown'); assert.equal(out.unsourced.status,'unknown');
  } finally {await page.close();}
});

test('power groups retain A/B wiring uncertainty and separate planned, typical and nameplate loads',async () => {
  const {page} = await setup();
  try {
    const out = await page.evaluate(() => {
      const R = RackStudio, d = R.CatalogSources.pin(R.ProjectDocument.capture(R.STATE)), [a,b] = d.topology.racks[0].devices;
      a.powerPlan = {consumption:{watts:100,kind:'planned',source},feeds:[{group:'A',pduDeviceId:'pdu'},{group:'A',pduDeviceId:'pdu'},{group:'B',pduDeviceId:'pdu'}]};
      b.powerPlan = {consumption:{watts:200,kind:'typical',source},feeds:[{group:'A',pduDeviceId:'pdu'}]};
      d.topology.customCatalog.pdu = {name:'Test PDU',u:1,category:'pdu',ports:[],engineering:{power:{capacityWatts:150,source}}};
      d.topology.racks[1].devices.push({instanceId:'pdu',catalogKey:'pdu',topU:10,uHeight:1});
      return R.PowerBudget.build(d);
    });
    assert.equal(out.totals.find(t => t.kind === 'planned').knownWatts,100); assert.equal(out.totals.find(t => t.kind === 'typical').knownWatts,200); assert.equal(out.totals.find(t => t.kind === 'unknown').unknown,1); assert.equal(out.feeds.length,3); assert.equal(out.groups.find(g => g.group === 'B').knownWatts,100); assert.equal(out.groups.find(g => g.kind === 'typical').status,'blocked'); assert.equal(out.groups.find(g => g.group === 'A' && g.kind === 'planned').status,'unknown');
  } finally {await page.close();}
});

test('stable issue identities, stale fixes and whole layout/source change checks prevent silent mutation',async () => {
  const {page,errors} = await setup();
  try {
    const out = await page.evaluate(async () => {
      const R = RackStudio, legacy = structuredClone(R.CatalogSources.available['eng-cisco-c9200l-24p-4g']);
      legacy.id = 'legacy-switch'; delete legacy.provenance; delete legacy.engineering.source; R.CatalogSources.register(legacy.id,legacy);
      const old = R.ProjectDocument.capture(R.STATE); old.topology.racks[0].devices[0].catalogKey = legacy.id; R.loadCustomTopology(old); R.flushProjectChanges(); await R.saveProjectNow();
      const d = R.ProjectDocument.capture(R.STATE), one = R.EngineeringIssues.collect(d), two = R.EngineeringIssues.collect(d), fix = one.find(i => i.code === 'catalog-unpinned');
      const before = JSON.stringify(R.ProjectDocument.capture(R.STATE)); R.EngineeringUI.previewFix(fix);
      const unchanged = before === JSON.stringify(R.ProjectDocument.capture(R.STATE)); document.getElementById('engineering-dialog').close();
      const overlap = R.CatalogSources.pin(d); overlap.topology.racks[0].devices[1].topU = 30; let invalid = ''; try {R.EngineeringChanges.preview(overlap);} catch(e) {invalid = e.message;}
      const blocked = R.CatalogSources.pin(d); blocked.catalogContext.models['eng-aruba-jl677a'].definition.ports[0].engineering.connector = 'lc'; const plan = R.EngineeringChanges.preview(blocked);
      let violation = ''; try {await R.EngineeringChanges.apply(plan,true);} catch(e) {violation = e.message;}
      const model = structuredClone(legacy); model.modelVersion = 'next'; R.CatalogSources.register(model.id,model);
      let stale = ''; try {R.EngineeringUI.previewFix(fix);} catch(e) {stale = e.message;}
      return {same:one.map(i => i.issueId).join() === two.map(i => i.issueId).join(),unchanged,invalid,violation,stale,unchangedAfter:before === JSON.stringify(R.ProjectDocument.capture(R.STATE))};
    });
    assert.equal(out.same,true); assert.equal(out.unchanged,true); assert.ok(out.invalid); assert.ok(out.violation); assert.match(out.stale,/eskidi/); assert.equal(out.unchangedAfter,true); assert.deepEqual(errors,[]);
  } finally {await page.close();}
});

test('two alternatives preserve main, compare BOM/path uncertainty and reject stale or incomplete mappings',async () => {
  const {page,errors} = await setup();
  try {
    const out = await page.evaluate(async () => {
      const R = RackStudio, base = R.ProjectDocument.capture(R.STATE), before = R.ProjectCommands.domainKey(base), a = R.Scenarios.create(base), b = R.Scenarios.create(base);
      a.operations = [{type:'removeCable',id:'link-1'}]; b.operations = [{type:'moveDevice',id:'sw-a',rackId:'rack-b',topU:20}];
      const analysisA = await R.Scenarios.analyze(a), analysisB = await R.Scenarios.analyze(b), preserved = before === R.ProjectCommands.domainKey(R.ProjectDocument.capture(R.STATE));
      let mapping = ''; try {R.Scenarios.applyOperations(base,[{type:'replaceSwitch',id:'sw-a',modelKey:'eng-aruba-jl677a',portMapping:{}}]);} catch(e) {mapping = e.message;}
      const swapped = R.Scenarios.applyOperations(base,[{type:'replaceSwitch',id:'sw-a',modelKey:'eng-aruba-jl677a',portMapping:{p1:'p1'}}]);
      const row = await R.Scenarios.save(a,'Alternatif A'); window.scenarioId = row.id;
      const result = await R.Scenarios.apply(a,true), after = JSON.stringify(R.ProjectDocument.capture(R.STATE));
      let stale = ''; try {await R.Scenarios.apply(b,true);} catch(e) {stale = e.message;}
      return {preserved,analysisA,analysisB,mapping,swapped:swapped.topology.racks[0].devices[0].catalogKey,result:result.revision,afterStale:after === JSON.stringify(R.ProjectDocument.capture(R.STATE)),stale,named:row.scenario.id};
    });
    assert.equal(out.preserved,true); assert.equal(out.analysisA.bomAfter.rows.filter(r => r.kind === 'cable').length,0); assert.ok(out.analysisA.impact.paths.length); assert.equal(out.analysisB.bomAfter.totals.estimated.unknown,1); assert.ok(out.mapping); assert.equal(out.swapped,'eng-aruba-jl677a'); assert.equal(out.afterStale,true); assert.match(out.stale,/eskidi/); assert.ok(out.named);
    await page.locator('.studio-editor [data-command="undo"]').click(); assert.equal(await page.evaluate(() => RackStudio.STATE.cables.length),1);
    await page.reload(); await page.waitForSelector('.studio-editor[data-ready="true"]');
    assert.equal(await page.evaluate(async () => (await RackStudio.ProjectRevisions.list(RackStudio.STATE.projectDocument.projectId)).filter(r => r.scenario).length),1); assert.deepEqual(errors,[]);
  } finally {await page.close();}
});

test('passive paths require explicit pairing, and engineering/scenario controls fit four viewports and themes',async () => {
  const {page,errors} = await setup();
  try {
    const out = await page.evaluate(() => {
      const R = RackStudio, d = R.CatalogSources.pin(R.ProjectDocument.capture(R.STATE)), c = d.topology.cables[0];
      d.topology.racks[0].devices.push({instanceId:'panel',catalogKey:'eng-generic-panel-24',topU:26,uHeight:1,passThroughPairs:[]});
      c.to = {rackId:'rack-a',instanceId:'panel',portId:'p1'}; d.topology.cables.push({id:'link-2',from:{rackId:'rack-a',instanceId:'panel',portId:'p2'},to:{rackId:'rack-a',instanceId:'sw-b',portId:'p1'},medium:'Cat6'});
      const unknown = R.PhysicalPaths.trace(d,'link-1'); d.topology.racks[0].devices[2].passThroughPairs = [{from:'p1',to:'p2'}]; const known = R.PhysicalPaths.trace(d,'link-1');
      return {unknown,known};
    });
    assert.equal(out.unknown.status,'unknown'); assert.equal(out.known.status,'known'); assert.deepEqual(out.known.cableIds,['link-1','link-2']);
    for(const width of [1440,768,390,320]) {
      await page.setViewportSize({width,height:950}); await page.evaluate(() => RackStudio.EngineeringUI.open());
      const box = await page.locator('#engineering-dialog').boundingBox(); assert.ok(box.x >= 0 && box.x + box.width <= width + 1);
      assert.equal(await page.locator('#engineering-dialog').evaluate(e => e.scrollWidth <= e.clientWidth + 1),true);
      await page.screenshot({path:path.join(results,'engineering-' + width + '.png')}); await page.locator('#engineering-dialog [data-action="close"]').click();
      await page.evaluate(() => RackStudio.ScenarioUI.open()); await page.locator('#scenario-dialog [data-action="create"]').click(); await page.waitForSelector('.scenario-comparison section');
      assert.equal(await page.locator('#scenario-dialog').evaluate(e => e.scrollWidth <= e.clientWidth + 1),true); await page.screenshot({path:path.join(results,'scenario-' + width + '.png')}); await page.locator('#scenario-dialog [data-action="close"]').click();
    }
    for(const theme of ['dark','light','blueprint','high-contrast']) { await page.evaluate(theme => {document.documentElement.dataset.theme = theme; RackStudio.EngineeringUI.open();},theme); await page.screenshot({path:path.join(results,'engineering-' + theme + '-320.png')}); await page.locator('#engineering-dialog [data-action="close"]').click(); }
    const protectedResult = await page.evaluate(async () => {const R = RackStudio; R.WorkflowViews.set('presentation'); let error = ''; try {await R.Scenarios.apply(R.Scenarios.create(R.ProjectDocument.capture(R.STATE)),true);} catch(e) {error = e.message;} return error;}); assert.match(protectedResult,/Sunum/); assert.deepEqual(errors,[]);
  } finally {await page.close();}
});

test('structured engineering form previews sourced demands and 3D projection preserves one-command scenarios',async () => {
  const {page,errors} = await setup();
  try {
    await page.evaluate(() => RackStudio.EngineeringUI.open());
    await page.locator('#engineering-dialog > details').nth(1).locator(':scope > summary').click();
    await page.locator('#engineering-dialog [name="poe-watts"]').fill('15');
    await page.locator('#engineering-dialog [name="power-watts"]').fill('75');
    await page.locator('#engineering-dialog [name="source-title"]').fill('Tasarım talebi');
    await page.locator('#engineering-dialog [name="source-reference"]').fill('PLAN-17');
    await page.locator('#engineering-dialog [data-action="device-preview"]').click();
    await page.waitForSelector('.engineering-preview:not([hidden])');
    assert.equal(await page.evaluate(() => RackStudio.STATE.racks[0].devices[0].powerPlan?.consumption?.watts ?? null),null);
    await page.locator('#engineering-dialog [name="ack"]').check(); await page.locator('#engineering-dialog [data-action="apply"]').click();
    await page.waitForFunction(() => RackStudio.STATE.racks[0].devices[0].powerPlan?.consumption?.watts === 75);
    await page.locator('#engineering-dialog [data-action="close"]').click();
    await page.locator('#btn-view-3d').click(); await page.waitForFunction(() => window.is3DMode && window.__STUDIO3D__?.state?.devices.length === 2);
    const out = await page.evaluate(async () => {
      const R = RackStudio, scene = window.__STUDIO3D__, known = scene.state.devices.find(d => d.id === 'sw-a'), unknown = scene.state.devices.find(d => d.id === 'sw-b');
      const revision = R.ProjectDocument.capture(R.STATE).revision, branch = R.Scenarios.create(R.ProjectDocument.capture(R.STATE)); branch.operations = [{type:'removeCable',id:'link-1'}]; await R.Scenarios.apply(branch,true);
      return {knownWatts:known.powerWatts,unknownWatts:unknown.powerWatts,ports:known.portDefinitions.length,revisionDelta:R.ProjectDocument.capture(R.STATE).revision - revision,canonicalCables:R.STATE.cables.length,sceneCables:scene.state.cables.length,demand:R.STATE.racks[0].devices[0].portsConfig.p1.poeDemand};
    });
    assert.equal(out.knownWatts,75); assert.equal(out.unknownWatts,null); assert.equal(out.ports,28); assert.equal(out.revisionDelta,1); assert.equal(out.canonicalCables,0); assert.equal(out.sceneCables,0); assert.equal(out.demand.watts,15); assert.equal(out.demand.source.kind,'user'); assert.deepEqual(errors,[]);
  } finally {await page.close();}
});
