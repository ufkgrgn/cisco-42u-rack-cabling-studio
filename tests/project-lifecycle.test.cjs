const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const{webcrypto}=require('node:crypto'),{IDBFactory}=require('fake-indexeddb');
function model(){const window={RackStudio:{STATE:{racks:[],cables:[]}}};const context=vm.createContext({window,crypto:webcrypto,indexedDB:new IDBFactory(),TextEncoder,Blob,console,localStorage:{},btoa,atob,structuredClone});for(const file of ['catalog','project-records','project-document','network-rules','topology-io','project-commands','project-storage-idb','project-repository','project-archive','project-lifecycle'])vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../js/2d/'+file+'.js'),'utf8'),context);return window.RackStudio;}
test('retention protects named revisions and pending attachments; archived deletion is guarded',async()=>{const R=model(),repo=R.ProjectRepository,db=await repo.database;
  const doc=R.ProjectDocument.normalize({racks:[{id:'rack-1',name:'Rack',heightU:18,devices:[]}],cables:[]});doc.metadata.name='Delete me';await repo.commit(doc);
  const blob=new Blob(['keep'],{type:'text/plain'}),row=await R.ProjectStorageIDB.read(db,'projects',doc.projectId);
  await R.ProjectStorageIDB.transaction(db,['revisions','evidence','meta'],'readwrite',tx=>{
    tx.objectStore('revisions').put({...row,document:{...doc,evidenceRefs:[{blobId:'named'}]}},[doc.projectId,'named-held']);
    for(const id of ['named','pending','orphan'])tx.objectStore('evidence').put({id,projectId:doc.projectId,blob},[doc.projectId,id]);
    tx.objectStore('meta').put([{base:doc,draft:{...doc,evidenceRefs:[{blobId:'pending'}]}}],['outbox-v1',doc.projectId]);
    tx.objectStore('revisions').put(row,[doc.projectId,2]);
  });
  const result=await R.ProjectLifecycle.maintain(doc.projectId,{keepRevisions:1});assert.equal(result.revisions,1);assert.equal(result.evidence,1);
  assert.equal((await R.ProjectStorageIDB.entries(db,'evidence')).length,2);assert.ok(await R.ProjectStorageIDB.read(db,'revisions',[doc.projectId,'named-held']));
  await assert.rejects(R.ProjectLifecycle.remove(doc.projectId,'Delete me'),/arşiv/);await repo.archive(doc.projectId);await assert.rejects(R.ProjectLifecycle.remove(doc.projectId,'Delete me'),/Açık/);
  await repo.select('other');await assert.rejects(R.ProjectLifecycle.remove(doc.projectId,'Delete me'),/Bekleyen/);
  await R.ProjectStorageIDB.transaction(db,['meta'],'readwrite',tx=>tx.objectStore('meta').delete(['outbox-v1',doc.projectId]));
  await assert.rejects(R.ProjectLifecycle.remove(doc.projectId,'wrong'),/tam yaz/);await R.ProjectLifecycle.remove(doc.projectId,'Delete me');assert.equal(await repo.get(doc.projectId),null);assert.equal((await R.ProjectStorageIDB.entries(db,'evidence')).length,0);
});
test('full backup reopens in a fresh repository before cleanup',async()=>{const R=model(),doc=R.ProjectDocument.normalize({racks:[{id:'r',name:'Backup',heightU:18,devices:[]}],cables:[]});await R.ProjectRepository.commit(doc);const text=await R.ProjectArchive.exportArchive();const fresh=model();await fresh.ProjectArchive.importArchive(text);assert.equal(JSON.stringify((await fresh.ProjectRepository.get(doc.projectId)).document),JSON.stringify(doc));});
