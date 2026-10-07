(function () {
  'use strict';
  const RS=window.RackStudio, storage=RS.ProjectStorageIDB;
  const modes=['design','field','presentation'];
  const projectId=()=>RS.STATE.projectDocument.projectId;
  function validateView(view,id=projectId()) {
    if(!view || view.version!==2 || view.projectId!==id || typeof view.id!=='string' || typeof view.name!=='string' || !view.name.trim() || view.name.length>60 || !['2d','3d'].includes(view.mode) || !modes.includes(view.workflow) || typeof view.rackId!=='string' || !Number.isSafeInteger(view.documentRevision) || view.documentRevision<0) throw new Error('Görünüm başka projeye ait veya geçersiz.');
    if(view.mode==='2d' && (![view.scale,view.panX,view.panY].every(Number.isFinite) || view.scale<0.15 || view.scale>4 || !['single','multi'].includes(view.viewMode))) throw new Error('2D kamera kaydı geçersiz.');
    if(view.mode==='3d' && ![view.position,view.target].every(v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite))) throw new Error('3D kamera kaydı geçersiz.');
    if(view.namedRevisionId!==undefined && (typeof view.namedRevisionId!=='string' || !/^named-[a-zA-Z0-9_-]+$/.test(view.namedRevisionId))) throw new Error('Görünüm revizyonu geçersiz.');
    return structuredClone(view);
  }
  async function read(id=projectId()) {
    const row=await storage.read(await RS.ProjectRepository.database,'meta',['workspace-v2',id]);
    if(!row)return {projectId:id,views:[],workflow:'design'};
    if(row.projectId!==id || !Array.isArray(row.views) || row.views.length>20 || !modes.includes(row.workflow)) throw new Error('Yerel çalışma görünümü kaydı geçersiz.');
    return {...row,views:row.views.map(view=>validateView(view,id))};
  }
  async function update(id,change) {
    return storage.transaction(await RS.ProjectRepository.database,['meta'],'readwrite',(tx,done,fail)=>{
      const store=tx.objectStore('meta'),request=store.get(['workspace-v2',id]);
      request.onsuccess=()=>{try{const row=request.result||{projectId:id,views:[],workflow:'design'};if(row.projectId!==id || !Array.isArray(row.views))throw new Error('Yerel görünüm kaydı geçersiz.');const next=change(row);store.put(next,['workspace-v2',id]);done(next);}catch(error){fail(error);}};
    });
  }
  async function saveView(view) {validateView(view,view.projectId);return update(view.projectId,row=>({...row,views:[view,...row.views.filter(v=>v.id!==view.id)].slice(0,20)}));}
  async function removeView(id,viewId){return update(id,row=>({...row,views:row.views.filter(v=>v.id!==viewId)}));}
  async function saveDefault(){const id=projectId(),workflow=RS.WorkflowViews.get();await update(id,row=>({...row,workflow}));return workflow;}
  let active=null,generation=0;
  async function activate(){
    if(!RS.STATE?.projectDocument || !RS.WorkflowViews || !RS.openStoredProject)return;
    const id=projectId();if(id===active)return;active=id;const token=++generation;
    try{const row=await read(id);if(token===generation&&id===projectId())RS.WorkflowViews.set(row.workflow);}
    catch(error){if(token===generation)window.UIActions?.notify(error.message);}
  }
  RS.WorkspaceState=Object.freeze({read,saveView,removeView,saveDefault,validateView,activate});
  ['rackstudio:change','rackstudio:refresh'].forEach(type=>document.addEventListener(type,activate));
  const ready=new MutationObserver(()=>{if(document.querySelector('.studio-editor[data-ready="true"]')){ready.disconnect();activate();}});
  ready.observe(document.body,{subtree:true,attributes:true,attributeFilter:['data-ready']});activate();
})();
