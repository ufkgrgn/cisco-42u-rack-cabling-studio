const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const{webcrypto}=require('node:crypto');const{IDBFactory}=require('fake-indexeddb');
function model(){
  const window={RackStudio:{STATE:{racks:[],cables:[]}}},context=vm.createContext({window,crypto:webcrypto,TextEncoder,structuredClone,console,indexedDB:new IDBFactory(),localStorage:{},Blob});
  for(const file of ['js/2d/catalog.js','js/2d/project-records.js','js/2d/project-document.js','js/2d/network-rules.js','js/2d/topology-io.js','js/2d/project-commands.js','js/2d/project-storage-idb.js','js/2d/project-repository.js','js/collaboration/rebase.js','js/collaboration/outbox.js'])vm.runInContext(fs.readFileSync(path.resolve(__dirname,'..',file),'utf8'),context);
  const R=window.RackStudio;R.catalog={fixture:{id:'fixture',name:'Fixture',u:1,ports:[{id:'p1',type:'rj45'},{id:'p2',type:'rj45'}]}};
  const doc=R.ProjectDocument.normalize({racks:[{id:'rack-1',name:'Rack',heightU:18,devices:[{instanceId:'device-1',catalogKey:'fixture',topU:10,uHeight:1,name:'Device'}]}],cables:[]});return{R,doc};
}
test('independent fields merge while conflicting values require explicit choices',()=>{
  const{R,doc}=model(),draft=structuredClone(doc),remote=structuredClone(doc);draft.metadata.name='Local';remote.metadata.customer='Remote';remote.revision=1;
  let result=R.WorkspaceRebase.rebase(doc,draft,remote);assert.equal(result.ready,true);assert.equal(result.document.metadata.name,'Local');assert.equal(result.document.metadata.customer,'Remote');
  remote.metadata.name='Other';result=R.WorkspaceRebase.rebase(doc,draft,remote);assert.equal(result.ready,false);assert.equal(result.conflicts[0].path,'project.metadata.name');
  assert.equal(R.WorkspaceRebase.rebase(doc,draft,remote,{'project.metadata.name':'local'}).document.metadata.name,'Local');
});
test('remote deletion cannot resurrect an edited device and competing U placements remain conflicts',()=>{
  const{R,doc}=model(),draft=structuredClone(doc),remote=structuredClone(doc);draft.topology.racks[0].devices[0].name='Edited';remote.topology.racks[0].devices=[];remote.revision=1;
  let result=R.WorkspaceRebase.rebase(doc,draft,remote);assert.equal(result.ready,false);assert.equal(result.conflicts[0].deleted,true);assert.deepEqual([...result.conflicts[0].choices],['remote']);
  const conflict=result.conflicts[0].path;assert.equal(R.WorkspaceRebase.rebase(doc,draft,remote,{[conflict]:'local'}).ready,false);
  assert.equal(R.WorkspaceRebase.rebase(doc,draft,remote,{[conflict]:'remote'}).document.topology.racks[0].devices.length,0);
  const local=structuredClone(doc),other=structuredClone(doc);local.topology.racks[0].devices.push({...doc.topology.racks[0].devices[0],instanceId:'local-added',topU:8});other.topology.racks[0].devices.push({...doc.topology.racks[0].devices[0],instanceId:'remote-added',topU:8});
  result=R.WorkspaceRebase.rebase(doc,local,other);assert.equal(result.ready,false);assert.equal(result.conflicts[0].path,'physical-layout');
});
test('outbox freezes pending drafts and prepared command identity across reload and retry',async()=>{
  const{R,doc}=model(),draft=structuredClone(doc);draft.metadata.name='Pending';const item=await R.WorkspaceOutbox.enqueue(doc,draft);draft.metadata.name='New edit';
  const restored=(await R.WorkspaceOutbox.read(doc.projectId))[0];assert.equal(restored.draft.metadata.name,'Pending');assert.equal(restored.status,'pending');
  await R.WorkspaceOutbox.prepare(doc.projectId,item.id,{commandId:item.id,expectedRevision:0});
  await assert.rejects(R.WorkspaceOutbox.prepare(doc.projectId,item.id,{commandId:item.id,expectedRevision:1}),/değiştirilmez/);
  await R.WorkspaceOutbox.conflict(doc.projectId,item.id,'permission revoked');assert.equal((await R.WorkspaceOutbox.read(doc.projectId))[0].status,'conflict');
  await R.WorkspaceOutbox.finish(doc.projectId,item.id);assert.equal((await R.WorkspaceOutbox.read(doc.projectId)).length,0);
});
test('concurrent outbox appends preserve all drafts',async()=>{const{R,doc}=model();await Promise.all(Array.from({length:8},()=>R.WorkspaceOutbox.enqueue(doc,doc)));assert.equal((await R.WorkspaceOutbox.read(doc.projectId)).length,8);});
