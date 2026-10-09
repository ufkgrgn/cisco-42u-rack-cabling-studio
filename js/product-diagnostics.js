(function(){
  'use strict';const R=window.RackStudio;
  async function capture(){
    const repo=R.ProjectRepository,projects=await repo.list(),db=await repo.database,meta=await R.ProjectStorageIDB.entries(db,'meta');
    return{format:'rack-studio-diagnostics',version:1,applicationVersion:'4.0.0',createdAt:new Date().toISOString(),platform:window.__TAURI_INTERNALS__?'desktop':'browser',storage:R.ProjectStorageIDB.backend||'indexeddb',schemaVersion:R.ProjectDocument.VERSION||1,counts:{projects:projects.length,archived:projects.filter(row=>row.archived).length,pendingDrafts:meta.filter(row=>Array.isArray(row.key)&&row.key[0]==='outbox-v1').reduce((sum,row)=>sum+(Array.isArray(row.value)?row.value.length:0),0)},privacy:'No project identity, names, topology, annotations, evidence, queries, credentials or raw errors included.'};
  }
  async function open(){
    if(document.getElementById('diagnostics-dialog'))return;const opener=document.activeElement,dialog=document.createElement('dialog');dialog.id='diagnostics-dialog';dialog.className='project-manager integration-dialog';dialog.setAttribute('aria-label','Yerel teşhis');const heading=document.createElement('h2');heading.textContent='Yerel teşhis';const preview=document.createElement('pre'),download=document.createElement('button'),close=document.createElement('button');download.textContent='Bu teşhisi indir';close.textContent='Kapat';close.onclick=()=>dialog.close();dialog.append(heading,preview,download,close);document.body.append(dialog);dialog.addEventListener('close',()=>{dialog.remove();opener?.focus();},{once:true});dialog.showModal();
    try{const text=JSON.stringify(await capture(),null,2);preview.textContent=text;download.onclick=()=>{const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='rack-studio-diagnostics.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};}catch{preview.textContent='Depo okunamadı. Ham hata veya proje bilgisi teşhise eklenmedi.';download.disabled=true;}
  }
  R.ProductDiagnostics=Object.freeze({capture,open});document.getElementById('btn-diagnostics')?.addEventListener('click',open);
})();
