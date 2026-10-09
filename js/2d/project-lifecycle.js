(function(){
  'use strict';const R=window.RackStudio,S=R.ProjectStorageIDB;
  async function maintain(projectId,options={}){
    const repo=R.ProjectRepository,keep=options.keepRevisions??100;
    if(!Number.isInteger(keep)||keep<1||keep>1000)throw new Error('Revizyon saklama sınırı 1–1000 olmalı.');
    return repo.serialize(async()=>{
      const db=await repo.database;
      const result=await S.transaction(db,S.STORES,'readwrite',(tx,done,fail)=>{
        const rows={};let remaining=S.STORES.length;
        for(const name of S.STORES){rows[name]=[];const request=tx.objectStore(name).openCursor();request.onsuccess=()=>{const cursor=request.result;if(cursor){rows[name].push({key:cursor.key,value:cursor.value});cursor.continue();}else if(--remaining===0)finish();};}
        function finish(){try{
          const head=rows.projects.find(row=>row.key===projectId)?.value;if(!head)throw new Error('Proje bulunamadı.');
          const lease=rows.leases.find(row=>row.key===projectId)?.value;
          if(lease&&lease.owner!==repo.owner&&lease.expiresAt>Date.now())throw new Error('Başka oturum projeyi kullanıyor.');
          const outbox=rows.meta.find(row=>Array.isArray(row.key)&&row.key[0]==='outbox-v1'&&row.key[1]===projectId)?.value||[];
          if(options.remove){
            if(!head.archived)throw new Error('Kalıcı silme için önce arşivleyin.');
            if(R.STATE.projectDocument?.projectId===projectId||rows.meta.some(row=>row.key==='activeProjectId'&&row.value===projectId))throw new Error('Açık proje silinemez; önce başka projeyi açın.');
            if(outbox.length)throw new Error('Bekleyen ekip taslaklarını önce dış yedekleyip çözümleyin.');
            if(options.confirmation!==head.document.metadata.name||!options.confirmation)throw new Error('Silmek için proje adını tam yazın.');
            for(const name of ['projects','log','revisions','evidence','leases','meta'])for(const row of rows[name])if(row.key===projectId||(Array.isArray(row.key)&&row.key[0]===projectId)||(name==='meta'&&Array.isArray(row.key)&&['outbox-v1','annotations-v1','accepted-workspace-v1','acknowledged-workspace-v1'].includes(row.key[0])&&row.key[1]===projectId))tx.objectStore(name).delete(row.key);
            done({removed:true,revisions:0,evidence:0});return;
          }
          const revisions=rows.revisions.filter(row=>row.key[0]===projectId),numeric=revisions.filter(row=>typeof row.key[1]==='number').sort((a,b)=>b.key[1]-a.key[1]);
          const removed=new Set(numeric.slice(keep).map(row=>JSON.stringify(row.key)));
          for(const row of numeric.slice(keep))tx.objectStore('revisions').delete(row.key);
          const references=new Set(),collect=doc=>{for(const ref of doc?.evidenceRefs||[])if(ref.blobId)references.add(ref.blobId);};
          collect(head.document);for(const row of revisions)if(!removed.has(JSON.stringify(row.key)))collect(row.value.document);
          for(const item of outbox){collect(item.base);collect(item.draft);collect(item.command?.payload?.document);}
          for(const row of rows.meta)if(Array.isArray(row.key)&&row.key[1]===projectId){if(row.key[0]==='accepted-workspace-v1')collect(row.value);if(row.key[0]==='acknowledged-workspace-v1'){collect(row.value.draft);collect(row.value.server);}}
          let evidence=0;for(const row of rows.evidence)if(row.key[0]===projectId&&!references.has(row.key[1])){tx.objectStore('evidence').delete(row.key);evidence++;}
          done({removed:false,revisions:removed.size,evidence});
        }catch(error){fail(error);}}
      });
      if(result.removed){repo.versions.delete(projectId);repo.durable.delete(projectId);for(const key of Object.keys(localStorage))if(key.startsWith(R.ProjectRepositoryConstants.DRAFT_PREFIX)){try{if(JSON.parse(localStorage.getItem(key)).projectId===projectId)localStorage.removeItem(key);}catch{}}}
      return result;
    });
  }
  R.ProjectLifecycle=Object.freeze({maintain,remove:(id,confirmation)=>maintain(id,{remove:true,confirmation})});
})();
