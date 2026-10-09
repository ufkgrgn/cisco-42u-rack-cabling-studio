(function(){
  'use strict';const R=window.RackStudio,storage=R.ProjectStorageIDB;
  let token='',base='',socket=null,accepted=null,ydoc=null,connected=false,annotationQueue=Promise.resolve(),session=0,reconnect=null,annotationDirty=false,role=null,opening=false,acknowledged=null;
  const notify=message=>document.dispatchEvent(new CustomEvent('rackstudio:workspace',{detail:message}));
  async function request(path,method='GET',body){
    if(!token)throw new Error('Ekip erişim belirteci gerekli.');
    if(window.__TAURI_INTERNALS__)return window.__TAURI__.core.invoke('workspace_request',{path,method,body:body??null,token});
    const response=await fetch(base+'/api'+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
    const result=await response.json();if(!response.ok){const error=new Error(result.error||'Ekip isteği başarısız.');error.status=response.status;throw error;}return result;
  }
  async function connect(value){disconnect();token=value;try{await request('/projects');connected=true;notify({status:'connected'});}catch(error){token='';throw error;}}
  async function open(projectId){
    const baseline=R.ProjectCommands.begin(),response=await request('/projects/'+encodeURIComponent(projectId));
    const local=R.ProjectDocument.capture(R.STATE),cached=await storage.read(await R.ProjectRepository.database,'meta',['accepted-workspace-v1',projectId]),ack=await storage.read(await R.ProjectRepository.database,'meta',['acknowledged-workspace-v1',projectId]),prior=ack?.draft||cached;
    if(local.projectId===projectId&&prior&&R.ProjectCommands.domainKey(local)!==R.ProjectCommands.domainKey(prior))await R.WorkspaceOutbox.enqueue(prior,local);
    const attachments=[];
    for(const ref of response.document.evidenceRefs){if(!ref.blobId)continue;const data=await request('/projects/'+encodeURIComponent(projectId)+'/evidence/'+encodeURIComponent(ref.blobId));attachments.push({id:ref.blobId,blob:new Blob([Uint8Array.from(atob(data.data),c=>c.charCodeAt(0))],{type:data.mime})});}
    opening=true;try{await R.adoptSharedDocument(response.document,baseline,attachments);accepted=response.document;role=response.role;acknowledged=null;}finally{opening=false;}
    await storage.transaction(await R.ProjectRepository.database,['meta'],'readwrite',tx=>{tx.objectStore('meta').put(accepted,['accepted-workspace-v1',projectId]);tx.objectStore('meta').delete(['acknowledged-workspace-v1',projectId]);});
    session++;clearTimeout(reconnect);socket?.close();ydoc?.destroy();ydoc=new R.WorkspaceYjs.Doc();
    const saved=await storage.read(await R.ProjectRepository.database,'meta',['annotations-v1',projectId]);annotationDirty=!!saved?.dirty;if(saved)R.WorkspaceYjs.applyUpdate(ydoc,Uint8Array.from(saved.state||saved),'remote');
    ydoc.on('update',(_,origin)=>{
      if(origin!=='remote')annotationDirty=true;const update=[...R.WorkspaceYjs.encodeStateAsUpdate(ydoc)],dirty=annotationDirty,current=session;
      annotationQueue=annotationQueue.catch(()=>{}).then(async()=>{await storage.transaction(await R.ProjectRepository.database,['meta'],'readwrite',tx=>tx.objectStore('meta').put({state:update,dirty},['annotations-v1',projectId]));if(current===session&&origin!=='remote'&&socket?.readyState===1)socket.send(JSON.stringify({type:'annotations',update:base64(Uint8Array.from(update))}));notify({status:'annotations'});}).catch(error=>notify({status:'error',message:error.message}));
    });
    openSocket(projectId,session);notify({status:'opened',acceptedRevision:response.acceptedRevision});return response;
  }
  function openSocket(projectId,current){
    if(current!==session||!token)return;
    const url=window.__TAURI_INTERNALS__?'ws://127.0.0.1:8787/api/collaboration':location.origin.replace(/^http/,'ws')+'/api/collaboration';socket=new WebSocket(url);
    const channel=socket;let first=true;
    channel.onopen=()=>{if(current===session)channel.send(JSON.stringify({type:'join',projectId,token}));};
    channel.onmessage=event=>{if(current!==session)return;const message=JSON.parse(event.data);if(message.type==='accepted'){notify({status:'remote',acceptedRevision:message.acceptedRevision});}
      else if(message.type==='annotations'){const incoming=Uint8Array.from(atob(message.update),c=>c.charCodeAt(0)),wasDirty=annotationDirty;R.WorkspaceYjs.applyUpdate(ydoc,incoming,'remote');const update=R.WorkspaceYjs.encodeStateAsUpdate(ydoc);annotationDirty=base64(update)!==message.update;
        // Persist the merged state even when Yjs has no new update event (acknowledgement).
        const dirty=annotationDirty;annotationQueue=annotationQueue.catch(()=>{}).then(async()=>storage.transaction(await R.ProjectRepository.database,['meta'],'readwrite',tx=>tx.objectStore('meta').put({state:[...update],dirty},['annotations-v1',projectId]))).catch(error=>notify({status:'error',message:error.message}));
        if(first&&wasDirty&&annotationDirty&&channel.readyState===1)channel.send(JSON.stringify({type:'annotations',update:base64(update)}));first=false;notify({status:'annotations'});}
      else if(message.type==='presence')notify(message);};
    channel.onclose=event=>{if(current!==session)return;notify({status:'offline'});if(event.code<4400)reconnect=setTimeout(()=>openSocket(projectId,current),2000);};
  }
  function base64(bytes){let text='';for(let i=0;i<bytes.length;i+=32768)text+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(text);}
  async function publish(companyId){
    await R.saveProjectNow();const snapshot=await R.ProjectRepository.snapshotProject(R.STATE.projectDocument.projectId),evidence=[];
    for(const item of snapshot.evidence)evidence.push({id:item.id,mime:item.blob.type,sha256:item.sha256,data:base64(new Uint8Array(await item.blob.arrayBuffer()))});
    return request('/projects','POST',{companyId,document:snapshot.document,evidence});
  }
  async function enqueue(){if(!accepted||R.STATE.projectDocument.projectId!==accepted.projectId)throw new Error('Önce ortak proje açın.');await R.saveProjectNow();const item=await R.WorkspaceOutbox.enqueue(acknowledged?.draft||accepted,R.ProjectDocument.capture(R.STATE));notify({status:'pending'});return item;}
  async function rememberAcceptance(item,response){const ack={draft:item.draft,server:response.document};await storage.transaction(await R.ProjectRepository.database,['meta'],'readwrite',tx=>tx.objectStore('meta').put(ack,['acknowledged-workspace-v1',item.projectId]));if(accepted?.projectId===item.projectId)acknowledged=ack;await R.WorkspaceOutbox.finish(item.projectId,item.id);notify({status:'accepted',acceptedRevision:response.acceptedRevision});}
  async function preview(item,choices){const remote=(await request('/projects/'+encodeURIComponent(item.projectId))).document;return{remote,...R.WorkspaceRebase.rebase(item.base,item.draft,remote,choices)};}
  async function send(item,choices={}){
    if(item.command){const response=await request('/projects/'+encodeURIComponent(item.projectId)+'/commands','POST',item.command);await rememberAcceptance(item,response);return{ready:true,...response};}
    const result=await preview(item,choices);if(!result.ready){await R.WorkspaceOutbox.conflict(item.projectId,item.id,'Birleştirme incelemesi gerekli.');return result;}
    const command={commandId:item.id,projectId:item.projectId,expectedRevision:result.remote.revision,expectedContent:R.ProjectCommands.domainKey(result.remote),type:role==='technician'?'RestoreFieldDraft':'RestoreProjectDocument',payload:{document:result.document}};
    const snapshot=await R.ProjectRepository.snapshotProject(item.projectId);
    for(const evidence of snapshot.evidence){if(!result.document.evidenceRefs.some(ref=>ref.blobId===evidence.id))continue;await request('/projects/'+encodeURIComponent(item.projectId)+'/evidence','POST',{id:evidence.id,mime:evidence.blob.type,sha256:evidence.sha256,data:base64(new Uint8Array(await evidence.blob.arrayBuffer()))});}
    await R.WorkspaceOutbox.prepare(item.projectId,item.id,command);item.command=command;
    const response=await request('/projects/'+encodeURIComponent(item.projectId)+'/commands','POST',command);
    await rememberAcceptance(item,response);return{...result,...response};
  }
  function disconnect(){session++;clearTimeout(reconnect);socket?.close();ydoc?.destroy();ydoc=null;token='';accepted=null;acknowledged=null;connected=false;notify({status:'disconnected'});}
  function annotate(key,value){if(!ydoc)throw new Error('Ortak proje açılmalı.');if(!/^[a-zA-Z0-9_-]{1,160}$/.test(key)||typeof value!=='string'||value.length>4000)throw new Error('Açıklama sınırı aşıldı.');ydoc.getMap('annotations').set(key,value);}
  R.WorkspaceSession=Object.freeze({connect,open,publish,enqueue,preview,send,disconnect,request,annotate,get localCheckpoint(){return acknowledged?.draft||accepted;},get acceptedRevision(){return acknowledged?.server.revision??accepted?.revision;},get role(){return role;},get accepted(){return accepted;},get annotations(){return ydoc?Object.fromEntries(ydoc.getMap('annotations')):{};},get connected(){return connected;}});
  document.addEventListener('rackstudio:change',()=>{if(!opening&&accepted&&R.STATE.projectDocument?.projectId!==accepted.projectId)disconnect();});
})();
