import test from 'node:test';import assert from 'node:assert/strict';import {PGlite} from '@electric-sql/pglite';
import {generateKeyPair,SignJWT} from 'jose';import {readFile} from 'node:fs/promises';
import {migrate} from '../database.mjs';import {Projects} from '../projects.mjs';import {oidc} from '../auth.mjs';import * as domain from '../domain.mjs';
import {httpServer} from '../http.mjs';import {Collaboration} from '../collaboration.mjs';import WebSocket from 'ws';import * as Y from 'yjs';
import {lifecycle} from '../lifecycle.mjs';
async function setup(){
  const pg=new PGlite(),db={query:(...args)=>pg.query(...args),transaction:work=>pg.transaction(tx=>work({query:(sql,args)=>args?.length?tx.query(sql,args):tx.exec(sql).then(values=>values.at(-1)||{rows:[]})}))};
  await migrate(db);await db.query("INSERT INTO companies VALUES('company-a','A'),('company-b','B')");await db.query("INSERT INTO company_members VALUES('company-a','owner-a','owner'),('company-b','owner-b','owner'),('company-a','designer','member'),('company-a','tech','member'),('company-a','viewer','member')");
  const fixture=JSON.parse(await readFile(new URL('../../tests/fixtures/product/project-rich-v1.json',import.meta.url),'utf8'));
  const doc=domain.validate({...fixture,projectId:'project-a',revision:0,observations:[],fieldEvents:[],evidenceRefs:[],handoverRecords:[],integrationMappings:[],extensions:{},topology:{...fixture.topology,racks:[{id:'rack-1',name:'A',heightU:18,devices:[]}],cables:[],activeRackId:'rack-1'}});
  const projects=new Projects(db);await projects.create({subject:'owner-a'},'company-a',doc);await projects.create({subject:'owner-b'},'company-b',{...doc,projectId:'project-b'});
  for(const role of ['designer','technician','viewer'])await projects.members({subject:'owner-a'},doc.projectId,role==='technician'?'tech':role,role);
  return{pg,db,projects,doc};
}
test('verified OIDC identity enforces issuer, audience, expiration and signature',async()=>{
  const{privateKey,publicKey}=await generateKeyPair('RS256');const auth=oidc({issuer:'https://identity.test',audience:'rack-studio',keys:publicKey});
  const token=await new SignJWT({}).setSubject('owner-a').setProtectedHeader({alg:'RS256'}).setIssuer('https://identity.test').setAudience('rack-studio').setIssuedAt().setExpirationTime('2m').sign(privateKey);
  assert.equal((await auth(token)).subject,'owner-a');await assert.rejects(auth(token+'invalid'),error=>error.status===401);
  const wrong=await new SignJWT({}).setSubject('owner-a').setProtectedHeader({alg:'RS256'}).setIssuer('https://identity.test').setAudience('wrong').setIssuedAt().setExpirationTime('2m').sign(privateKey);await assert.rejects(auth(wrong));
});
test('server retention, archive and permanent deletion preserve authorized lifecycle',async()=>{const{pg,db,projects,doc}=await setup();try{
  await assert.rejects(lifecycle(db,{subject:'viewer'},doc.projectId,{archived:true}),error=>error.status===403);
  await assert.rejects(lifecycle(db,{subject:'owner-a'},doc.projectId,{remove:true,confirmation:doc.metadata.name}),error=>error.status===409);
  const share=await projects.share({subject:'owner-a'},doc.projectId);await lifecycle(db,{subject:'owner-a'},doc.projectId,{archived:true});await assert.rejects(projects.shared(share.token));
  await lifecycle(db,{subject:'owner-a'},doc.projectId,{archived:false});const maintained=await lifecycle(db,{subject:'owner-a'},doc.projectId,{keepRevisions:1});assert.equal(maintained.revisions,0);
  await lifecycle(db,{subject:'owner-a'},doc.projectId,{archived:true});await lifecycle(db,{subject:'owner-a'},doc.projectId,{remove:true,confirmation:doc.metadata.name});await assert.rejects(projects.get({subject:'owner-a'},doc.projectId));assert.equal((await projects.get({subject:'owner-b'},'project-b')).document.projectId,'project-b');
  await db.query('UPDATE workspace_schema SET fingerprint=$1',['wrong']);await assert.rejects(migrate(db),/migration/);assert.equal((await projects.get({subject:'owner-b'},'project-b')).document.projectId,'project-b');
}finally{await pg.close();}});
test('technician can append validated field records but cannot smuggle a design change',async()=>{const{pg,projects,doc}=await setup();try{
  const initial=structuredClone(doc);initial.topology.customCatalog={field:{id:'field',name:'Field device',u:1,ports:[{id:'p1',type:'rj45'}]}};initial.topology.racks[0].devices=[{instanceId:'field-device',catalogKey:'field',topU:10,uHeight:1}];
  const initialized=await projects.command({subject:'designer'},doc.projectId,{commandId:'setup-field',projectId:doc.projectId,expectedRevision:doc.revision,expectedContent:domain.domainKey(doc),type:'RestoreProjectDocument',payload:{document:initial}}),base=initialized.document;
  const draft=structuredClone(base);draft.fieldEvents.push({id:'field-step',fieldEventVersion:1,projectId:doc.projectId,entityRef:{kind:'device',id:'field-device'},kind:'installed',result:'pass',technician:'Operator',recordedAt:new Date().toISOString(),receivedAt:new Date().toISOString(),expectedRevision:base.revision,scope:domain.fieldScope(base,{kind:'device',id:'field-device'}),evidenceIds:[]});
  const command={commandId:'field-only',projectId:doc.projectId,expectedRevision:base.revision,expectedContent:domain.domainKey(base),type:'RestoreFieldDraft',payload:{document:draft}};
  const bad=structuredClone(command);bad.commandId='bad-field';bad.payload.document.metadata.customer='smuggled';await assert.rejects(projects.command({subject:'tech'},doc.projectId,bad),error=>error.status===409);
  const accepted=await projects.command({subject:'tech'},doc.projectId,command);assert.equal(accepted.document.fieldEvents[0].actorSubject,'tech');assert.equal(accepted.document.metadata.customer,base.metadata.customer);
}finally{await pg.close();}});
test('company isolation and roles cover project, revision, evidence, export and membership requests',async()=>{
  const{pg,projects,doc}=await setup();try{
    for(const operation of [()=>projects.get({subject:'owner-b'},doc.projectId),()=>projects.revisions({subject:'owner-b'},doc.projectId),()=>projects.evidence({subject:'owner-b'},doc.projectId,'e1'),()=>projects.get({subject:'owner-b'},doc.projectId,'export')])await assert.rejects(operation(),error=>error.status===404);
    await assert.rejects(projects.get({subject:'viewer'},doc.projectId,'export'),error=>error.status===403);
    await assert.rejects(projects.members({subject:'designer'},doc.projectId,'viewer',null),error=>error.status===403);
    await projects.members({subject:'owner-a'},doc.projectId,'viewer',null);await assert.rejects(projects.get({subject:'viewer'},doc.projectId));
  }finally{await pg.close();}
});
test('serial authoritative commands are idempotent and reject stale competing changes',async()=>{
  const{pg,projects,doc}=await setup();try{
    const command={commandId:'one',projectId:doc.projectId,expectedRevision:0,expectedContent:domain.domainKey(doc),type:'UpdateProjectDetails',payload:{metadata:{...doc.metadata,name:'Accepted'},locations:doc.locations,rackLocations:[{rackId:'rack-1',locationId:null}]}};
    const result=await projects.command({subject:'designer'},doc.projectId,command);assert.equal(result.acceptedRevision,1);
    assert.equal((await projects.command({subject:'designer'},doc.projectId,command)).duplicate,true);
    await assert.rejects(projects.command({subject:'designer'},doc.projectId,{...command,commandId:'two'}),error=>error.status===409);
    await assert.rejects(projects.command({subject:'tech'},doc.projectId,{...command,commandId:'three'}),error=>error.status===403);
    assert.equal((await projects.revisions({subject:'owner-a'},doc.projectId)).length,2);
    const share=await projects.share({subject:'owner-a'},doc.projectId);assert.equal((await projects.shared(share.token)).name,'Accepted');
    await projects.revokeShare({subject:'owner-a'},doc.projectId,share.shareId);await assert.rejects(projects.shared(share.token));
  }finally{await pg.close();}
});
test('two authenticated annotation clients converge; viewer writes and revoked rooms are rejected',async()=>{
  const{pg,db,projects,doc}=await setup();const{privateKey,publicKey}=await generateKeyPair('RS256');const authenticate=oidc({issuer:'https://identity.test',audience:'rack-studio',keys:publicKey});
  const token=subject=>new SignJWT({}).setSubject(subject).setProtectedHeader({alg:'RS256'}).setIssuer('https://identity.test').setAudience('rack-studio').setIssuedAt().setExpirationTime('2m').sign(privateKey);
  const server=httpServer({projects,authenticate}),collaboration=new Collaboration(server,db,authenticate);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const sockets=[];
  async function join(subject){const socket=new WebSocket(`ws://127.0.0.1:${server.address().port}/api/collaboration`),messages=[];sockets.push(socket);socket.on('message',bytes=>messages.push(JSON.parse(bytes)));await new Promise(resolve=>socket.once('open',resolve));socket.send(JSON.stringify({type:'join',projectId:doc.projectId,token:await token(subject)}));return{socket,messages};}
  async function wait(predicate){const start=Date.now();while(!predicate()){if(Date.now()-start>3000)throw new Error('Collaboration event timed out');await new Promise(resolve=>setTimeout(resolve,10));}}
  try{
    const left=await join('designer'),right=await join('tech');await wait(()=>left.messages.some(m=>m.type==='annotations')&&right.messages.some(m=>m.type==='annotations'));
    const documents=[new Y.Doc(),new Y.Doc()];documents[0].getMap('annotations').set('left','A');documents[1].getMap('annotations').set('right','B');
    for(const[index,client]of [left,right].entries())client.socket.send(JSON.stringify({type:'annotations',update:Buffer.from(Y.encodeStateAsUpdate(documents[index])).toString('base64')}));
    await wait(()=>[left,right].every(client=>client.messages.some(message=>{if(message.type!=='annotations')return false;const doc=new Y.Doc();Y.applyUpdate(doc,Buffer.from(message.update,'base64'));return doc.getMap('annotations').size===2;})));
    const viewer=await join('viewer');await wait(()=>viewer.messages.some(m=>m.type==='annotations'));viewer.socket.send(JSON.stringify({type:'annotations',update:Buffer.from(Y.encodeStateAsUpdate(documents[0])).toString('base64')}));await wait(()=>viewer.socket.readyState===3);
    const alien=await join('owner-b');await wait(()=>alien.socket.readyState===3);assert.equal(alien.messages.length,0);
    await projects.members({subject:'owner-a'},doc.projectId,'tech',null);await collaboration.broadcast(doc.projectId,{type:'accepted',acceptedRevision:100});await wait(()=>right.socket.readyState===3);assert.equal(right.messages.some(m=>m.acceptedRevision===100),false);
    const malicious=new Y.Doc();malicious.getMap('topology').set('overwrite','bad');left.socket.send(JSON.stringify({type:'annotations',update:Buffer.from(Y.encodeStateAsUpdate(malicious)).toString('base64')}));await wait(()=>left.socket.readyState===3);
    const saved=await db.query('SELECT state FROM annotations WHERE project_id=$1',[doc.projectId]),restored=new Y.Doc();Y.applyUpdate(restored,new Uint8Array(saved.rows[0].state));assert.equal(restored.getMap('annotations').size,2);assert.equal(restored.share.has('topology'),false);
  }finally{for(const socket of sockets)socket.terminate();await collaboration.close();await new Promise(resolve=>server.close(resolve));await pg.close();}
});
