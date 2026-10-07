/* Project-scoped camera bookmarks; output definitions travel with named revisions. */
(() => {
  'use strict';
  const RS=window.RackStudio, workspace=RS.WorkspaceState;
  const node=(tag,text)=>{const el=document.createElement(tag);if(text)el.textContent=text;return el;};
  const button=(text,action)=>{const el=node('button',text);el.type='button';el.addEventListener('click',action);return el;};
  async function list(){
    const id=RS.STATE.projectDocument.projectId,row=await workspace.read(id),revisions=await RS.ProjectRevisions.list(id),views=[...row.views];
    for(const revision of revisions)for(const view of revision.presentationViews||[])if(!views.some(v=>v.id===view.id))views.push({...view,namedRevisionId:revision.id});
    return views;
  }
  async function capture(name,bindRevision=false){
    const label=String(name||'').trim().slice(0,60);if(!label)throw new Error('Görünüm adı girin.');
    RS.ProjectManagement.prepare();const doc=RS.ProjectDocument.capture(RS.STATE);
    const view={version:2,id:crypto.randomUUID(),projectId:doc.projectId,documentRevision:doc.revision,name:label,mode:window.is3DMode?'3d':'2d',workflow:RS.WorkflowViews.get(),rackId:RS.STATE.activeRackId,createdAt:new Date().toISOString()};
    if(view.mode==='3d'){
      const studio=window.__STUDIO3D__;if(!studio?.camera||!studio.controls)throw new Error('3D görünümü hazır değil.');
      view.position=studio.camera.position.toArray();view.target=studio.controls.target.toArray();
    }else{const zoom=RS.ZOOM_STATE;view.scale=zoom.scale;view.panX=zoom.panX;view.panY=zoom.panY;view.viewMode=RS.STATE.viewMode||'single';}
    workspace.validateView(view);
    if(bindRevision){const revision=await RS.ProjectRevisions.create({name:'Sunum: '+label,description:'Kayıtlı kamera ve çalışma görünümü',tag:'draft',presentationViews:[view]});view.namedRevisionId=revision.id;}
    await workspace.saveView(view);return view;
  }
  async function restore(input){
    const view=workspace.validateView(input),id=view.projectId;
    if(!RS.STATE.racks.some(r=>r.id===view.rackId))throw new Error('Bu görünümün kabini artık projede yok.');
    if(view.namedRevisionId){const revision=await RS.ProjectRevisions.get(id,view.namedRevisionId);if(RS.ProjectCommands.domainKey(revision.document)!==RS.ProjectCommands.domainKey(RS.ProjectDocument.capture(RS.STATE)))throw new Error('Sunum revizyonu açık çalışmadan farklı. Revizyon ekranında ilgili kaydı açın.');}
    const expected=RS.ProjectCommands.domainKey(RS.ProjectDocument.capture(RS.STATE));
    await RS.setStudioMode(view.mode==='3d');
    if(id!==RS.STATE.projectDocument.projectId || expected!==RS.ProjectCommands.domainKey(RS.ProjectDocument.capture(RS.STATE)) || Boolean(window.is3DMode)!==(view.mode==='3d'))throw new Error('Görünüm açılırken proje değişti veya renderer hazır değil.');
    RS.switchActiveRack(view.rackId,{smoothFocus:false});RS.WorkflowViews.set(view.workflow);
    if(view.mode==='2d' && RS.STATE.viewMode!==view.viewMode)RS.setViewMode?.(view.viewMode);
    await new Promise(resolve=>setTimeout(resolve,300));
    if(id!==RS.STATE.projectDocument.projectId || expected!==RS.ProjectCommands.domainKey(RS.ProjectDocument.capture(RS.STATE)))throw new Error('Açık proje değişti.');
    if(view.mode==='2d'){RS.cancelCameraAnimation?.();Object.assign(RS.ZOOM_STATE,{scale:view.scale,panX:view.panX,panY:view.panY});RS.updateStageTransform(false);}
    else{const studio=window.__STUDIO3D__;studio.camera.position.fromArray(view.position);studio.controls.target.fromArray(view.target);studio.controls.update();}
    return true;
  }
  async function open(){
    if(document.getElementById('saved-views-dialog')?.open)return;
    const opener=document.activeElement,projectId=RS.STATE.projectDocument.projectId;
    const dialog=node('dialog');dialog.id='saved-views-dialog';dialog.className='instrument-dialog p09-dialog';dialog.setAttribute('aria-label','Kayıtlı görünümler');
    const header=node('header');header.append(node('h2','Kayıtlı görünümler'),button('Kapat',()=>dialog.close()));
    const name=node('input');name.maxLength=60;name.setAttribute('aria-label','Görünüm adı');name.placeholder='Örn. MDF ön görünüm';const label=node('label','Görünüm adı');label.append(name);
    const revision=node('input');revision.type='checkbox';revision.setAttribute('aria-label','Sunum revizyonuna sabitle');const revLabel=node('label','Sunum revizyonuna sabitle');revLabel.prepend(revision);
    const status=node('p');status.setAttribute('role','status');const rows=node('div');rows.id='saved-view-list';let busy=false;
    async function run(action){if(busy)return;busy=true;dialog.setAttribute('aria-busy','true');try{if(projectId!==RS.STATE.projectDocument.projectId)throw new Error('Açık proje değişti. Ekranı yeniden açın.');await action();}catch(error){status.textContent=error.message;}finally{busy=false;dialog.removeAttribute('aria-busy');}}
    async function render(){
      const views=await list();if(projectId!==RS.STATE.projectDocument.projectId)return;
      rows.replaceChildren();if(!views.length)rows.append(node('p','Bu projede kayıtlı görünüm yok. Bir açı seçip görünümü kaydedin.'));
      for(const view of views){const row=node('section');row.className='saved-view-row';const openButton=button('Aç',()=>run(async()=>{await restore(view);dialog.close();}));openButton.dataset.action='open';row.append(node('span',`${view.name} · ${view.mode.toUpperCase()} · ${view.namedRevisionId?'sunum revizyonu':'yerel görünüm'}`),openButton,button(view.namedRevisionId?'Revizyonlar':'Sil',()=>run(async()=>{if(view.namedRevisionId){dialog.close();document.getElementById('btn-snapshot-modal')?.click();}else{await workspace.removeView(projectId,view.id);await render();}})));rows.append(row);}
    }
    dialog.append(header,node('p',`${RS.STATE.projectDocument.metadata.name||'Adsız proje'} · Görünümler bu projeye aittir. Sunum kaydı tam dış yedekte revizyonla birlikte taşınır.`),label,revLabel,
      button('Geçerli görünümü kaydet',()=>run(async()=>{await capture(name.value,revision.checked);name.value='';await render();status.textContent='Görünüm kaydedildi.';})),
      button('Bu projede başlangıç çalışma görünümü yap',()=>run(async()=>{await workspace.saveDefault();status.textContent='Çalışma görünümü bu proje için hatırlandı. Kamera yalnızca kayıtlı görünüm açınca değişir.';})),rows,status);
    if(localStorage.getItem('rack-studio-saved-views-v1'))dialog.append(node('p','Eski görünümlerin proje kimliği yok; otomatik uygulanmaz. Eski yerel kayıt korunuyor.'));
    document.body.append(dialog);dialog.addEventListener('close',()=>{dialog.remove();if(opener?.isConnected)opener.focus();});dialog.showModal();name.focus();await run(render);
  }
  RS.SavedViews=Object.freeze({open,capture,restore,list});
  document.getElementById('btn-saved-views')?.addEventListener('click',()=>open().catch(error=>window.UIActions?.notify(error.message)));
})();
