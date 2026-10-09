(function(){
  'use strict';const R=window.RackStudio,storage=R.ProjectStorageIDB;
  async function read(projectId){return(await storage.read(await R.ProjectRepository.database,'meta',['outbox-v1',projectId]))||[];}
  async function mutate(projectId,change){let result;await storage.transaction(await R.ProjectRepository.database,['meta'],'readwrite',tx=>{const store=tx.objectStore('meta'),key=['outbox-v1',projectId],request=store.get(key);request.onsuccess=()=>{try{const items=request.result||[];result=change(items);if(items.length>50)throw new Error('Bekleyen taslak sınırı doldu. Dış yedek alın.');store.put(structuredClone(items),key);}catch(error){result=error;tx.abort();}};}).catch(error=>{throw result instanceof Error?result:error;});return result;}
  async function enqueue(base,draft){
    if(base.projectId!==draft.projectId)throw new Error('Taslak farklı projeye ait.');
    const item={id:crypto.randomUUID(),projectId:base.projectId,base:structuredClone(base),draft:structuredClone(draft),status:'pending',createdAt:new Date().toISOString()};
    await mutate(base.projectId,items=>items.push(item));return item;
  }
  async function finish(projectId,itemId){await mutate(projectId,items=>{const index=items.findIndex(item=>item.id===itemId);if(index>=0)items.splice(index,1);});}
  async function conflict(projectId,itemId,message){await mutate(projectId,items=>{const item=items.find(item=>item.id===itemId);if(item){item.status='conflict';item.message=message;}});}
  async function prepare(projectId,itemId,command){return mutate(projectId,items=>{const item=items.find(item=>item.id===itemId);if(!item)throw new Error('Bekleyen taslak bulunamadı.');if(item.command&&R.ProjectCommands.stable(item.command)!==R.ProjectCommands.stable(command))throw new Error('Hazırlanmış komut değiştirilmez.');item.command=structuredClone(command);return item;});}
  R.WorkspaceOutbox=Object.freeze({read,enqueue,finish,conflict,prepare});
})();
