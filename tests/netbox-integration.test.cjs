const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {webcrypto}=require('node:crypto');
function model(){
  const window={RackStudio:{STATE:{racks:[],cables:[]}}};
  const context=vm.createContext({window,crypto:webcrypto,TextEncoder,console,setTimeout,clearTimeout});
  for(const file of ['js/2d/catalog.js','js/2d/project-records.js','js/2d/project-document.js','js/2d/project-commands.js','js/field-observations.js','js/integrations/netbox-adapter.js'])vm.runInContext(fs.readFileSync(path.resolve(__dirname,'..',file),'utf8'),context);
  // URL belongs to the browser/Node host, not a fixture implementation.
  context.URL=URL;context.structuredClone=structuredClone;
  const R=window.RackStudio;R.catalog={fixture:{name:'Fixture',modelTag:'MODEL-1',u:1,ports:[{id:'p1'}]}};
  const doc=R.ProjectDocument.normalize({racks:[{id:'rack-1',heightU:18,devices:[{instanceId:'device-1',catalogKey:'fixture',topU:10,uHeight:1,hostname:'switch-1'}]}],cables:[]});
  return{R,doc};
}
function fixture(){return{format:'rack-studio-netbox',version:1,instance:'https://netbox.example.test',complete:true,sites:[{id:1}],racks:[{id:1,site:{id:1}}],devices:[{id:1,name:'switch-1',site:{id:1},device_type:{id:1,model:'MODEL-1'},serial:'serial-1'}],interfaces:[{id:1,device:{id:1},name:'p1',enabled:true}],cables:[]};}
test('all pages must finish and stay in the configured collection and origin',async()=>{
  const {R}=model(),calls=[];
  const data=await R.NetBoxAdapter.collect('https://netbox.example.test',async url=>{calls.push(url);return{count:0,results:[],next:null};});
  assert.equal(data.complete,true);assert.equal(calls.length,5);
  await assert.rejects(R.NetBoxAdapter.collect('https://netbox.example.test',async()=>({count:1,results:[],next:null})),/eksik/);
  await assert.rejects(R.NetBoxAdapter.collect('https://netbox.example.test',async()=>({count:0,results:[],next:'https://evil.test/api/dcim/sites/'})),/Güvensiz/);
  await assert.rejects(R.NetBoxAdapter.collect('https://netbox.example.test',async()=>{throw new Error('HTTP 503');}),/503/);
});
test('transient read-only failures retry with a bound and auth failures do not retry',async()=>{const{R}=model();let calls=0,waits=[];const data=await R.NetBoxAdapter.collect('https://netbox.example.test',async()=>{if(calls++===0)throw new Error('NetBox HTTP 429');return{count:0,results:[],next:null};},null,{wait:async ms=>waits.push(ms)});assert.equal(data.complete,true);assert.equal(calls,6);assert.deepEqual(waits,[250]);calls=0;await assert.rejects(R.NetBoxAdapter.collect('https://netbox.example.test',async()=>{calls++;throw new Error('NetBox HTTP 401');},null,{wait:async()=>{}}));assert.equal(calls,1);});
test('source identity and selected observations remain repeatable and do not change the plan',async()=>{
  const {R,doc}=model(),before=JSON.stringify(doc.topology),preview=R.NetBoxAdapter.preview(fixture(),doc);
  assert.equal(preview.rows[0].status,'matched');assert.equal(preview.rows[1].status,'matched');
  const payload=await R.NetBoxAdapter.prepare(preview,[0,1],doc),reordered=await R.NetBoxAdapter.prepare(preview,[1,0],doc);
  assert.equal(payload.observations[0].id,reordered.observations[1].id);
  R.FieldObservations.appendToDocument(doc,payload.observations);R.FieldObservations.appendToDocument(doc,payload.observations);
  assert.equal(doc.observations.length,2);assert.equal(doc.topology.racks[0].devices[0].serialNumber,undefined);
  // Only the compatibility observed projection is added, physical plan values are unchanged.
  const topology=JSON.parse(JSON.stringify(doc.topology));delete topology.racks[0].devices[0].observed;
  assert.equal(JSON.stringify(topology),before);assert.match(payload.mappings[0].externalId,/site:1:device:1:model:1/);
});
test('unknown models, ambiguous names, stale preview and invalid ports require review',async()=>{
  const {R,doc}=model(),input=fixture();input.devices[0].device_type.model='unknown';
  const preview=R.NetBoxAdapter.preview(input,doc);assert.equal(preview.rows[0].status,'review');
  await assert.rejects(R.NetBoxAdapter.prepare(preview,[0],doc),/yerel hedef/);
  preview.rows[0].instanceId='device-1';preview.rows[0].catalogKey='fixture';
  assert.equal((await R.NetBoxAdapter.prepare(preview,[0],doc)).observations.length,1);
  doc.revision++;await assert.rejects(R.NetBoxAdapter.prepare(preview,[0],doc),/güncel değil/);
  input.complete=false;assert.throws(()=>R.NetBoxAdapter.validate(input),/Tamamlanmış/);
});
