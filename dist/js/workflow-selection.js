(function () {
  'use strict';
  const RS=window.RackStudio;
  let selected=null, projectId=null, panel, content, mobile, opener;
  const node=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
  const button=(text,action)=>{const el=node('button',text);el.type='button';el.addEventListener('click',action);return el;};
  function choose(kind,id,source){
    if((source==='3d')!==!!window.is3DMode)return;
    if(!id && selected?.kind!==kind)return;
    const changed = id && (selected?.id !== id || selected?.kind !== kind);
    selected=id?{kind,id}:null;projectId=RS.STATE.projectDocument.projectId;refresh();
    if(changed && kind === "device") RS.WorkspaceUI?.openPanel("selection");
  }
  function current(){
    if(projectId!==RS.STATE.projectDocument.projectId){selected=null;projectId=RS.STATE.projectDocument.projectId;}
    if(!selected)return null;
    if(selected.kind==='cable'){const cable=RS.STATE.cables.find(c=>c.id===selected.id);return cable?{cable}:null;}
    const rack=RS.STATE.racks.find(r=>r.devices.some(d=>d.instanceId===selected.id));
    return rack?{rack,device:rack.devices.find(d=>d.instanceId===selected.id)}:null;
  }
  function render(target){
    target.classList.add('workflow-selection-content');
    target.replaceChildren();const found=current();
    const row=(label,value)=>{const dt=node('dt',label),dd=node('dd',value===undefined||value===null||value===''?'Belirtilmedi':String(value));target.querySelector('dl').append(dt,dd);};
    target.append(node('dl'));
    const ports=()=>{if(!window.is3DMode && RS.WorkflowViews.canEdit())target.append(button('Port seçerek bağla',()=>{if(mobile?.open)mobile.close();RS.openMobilePortPicker?.(document.activeElement,found?.device?.instanceId);}));};
    if(!found){target.replaceChildren(node('p','Bir cihaz veya kablo seçin.'));ports();return;}
    if(found.device){
      const {device,rack}=found, cat=RS.resolveCatalogItem?.(device.catalogKey)||RS.catalog?.[device.catalogKey]||{};
      row('Cihaz',device.hostname||device.name||cat.name);row('Model',cat.name||device.catalogKey);row('Kabin',rack.name);row('Konum',RS.STATE.projectDocument.locations.find(l=>l.id===rack.locationId)?.name);row('Yerleşim',`U${device.topU} · ${device.uHeight}U`);row('IP adresi',device.ipAddress);row('Varlık etiketi',device.assetTag);row('Seri numarası',device.serialNumber);
      const observed=RS.STATE.projectDocument.observations.filter(o=>o.entityRef?.kind==='device'&&o.entityRef.id===device.instanceId);
      row('Saha gözlemi',observed.length?`${observed.length} kayıt · planı değiştirmez`:'Henüz gözlem yok');
      const title=node('h2',device.hostname||device.name||cat.name||device.catalogKey);title.className='workspace-selected-title';target.prepend(title);
      const table=node('table'),head=node('tr');for(const title of ['Port','Durum','Plan'])head.append(node('th',title));table.append(head);
      for(const port of cat.ports||[]){const cfg=device.portsConfig?.[port.id]||{},connected=RS.STATE.cables.some(c=>[c.from,c.to].some(e=>e.instanceId===device.instanceId&&e.portId===port.id));const tr=node('tr');tr.append(node('td',port.name||port.id),node('td',connected?'Bağlı':'Boş'),node('td',[cfg.role,cfg.vlan&&'VLAN '+cfg.vlan,cfg.description].filter(Boolean).join(' · ')||'Varsayılan'));table.append(tr);}
      const portDetails=node('details'),portSummary=node('summary',`Portlar · ${(cat.ports||[]).length} port`);portDetails.append(portSummary,table);target.append(portDetails);
      if(RS.WorkflowViews.canEdit() && cat.ports?.length)target.append(button('Port ayarları',()=>window.PortConfigEditor?.open(device.instanceId,cat.ports[0].id,window.is3DMode?'3d':'2d')));
      if(RS.WorkflowViews.canEdit() && !window.is3DMode){
        const related=RS.STATE.cables.filter(c=>[c.from,c.to].some(e=>e.instanceId===device.instanceId));
        if((cat.ports||[]).filter(p=>p.type!=='power').length>related.length)target.append(button('Boş portları otomatik bağla',e=>RS.openSwitchAutoFillPopover?.(document.activeElement,device.instanceId)));
        if(related.length){target.append(button('Kabloları renklendir',()=>RS.openSwitchBulkColorPopover?.(document.activeElement,device.instanceId)),button('Cihazın kablolarını sök',()=>RS.clearDeviceCables?.(device.instanceId,document.activeElement)));}
        if(cat.subType==='finger-duct' || /finger/i.test(cat.name||''))target.append(button('Kanal kapağını aç / kapat',()=>RS.toggleOrganizerCover?.(device.instanceId)));
        target.append(button('Cihazı kaldır',()=>RS.showInlineDeleteConfirm?.(document.activeElement,device.hostname||cat.name,{category:cat.category,cableCount:related.length},()=>RS.removeDevice?.(device.instanceId))));
      }
      if(RS.WorkflowViews.canEdit())target.append(button('Cihaz bilgilerini düzenle',()=>{
        if(!current()?.device) return refresh();
        if(mobile?.open)mobile.close();
        document.getElementById('mobile-workflow-dialog')?.close();
        window.DeviceMetadataEditor?.[window.is3DMode?'open3D':'open2D'](device.instanceId);
      }));
      target.append(button('Cihaza odaklan',()=>{if(mobile?.open)mobile.close();document.getElementById('mobile-workflow-dialog')?.close();if(window.is3DMode)window.__STUDIO3D__?.focusDevice(device.instanceId);else RS.focusOnDevice?.(device.instanceId);}));
    }else{
      const c=found.cable;row('Kablo',c.name||c.id);row('Rol',c.role);row('Tür',c.medium);row('Planlanan metraj',c.estimatedLengthMeters);row('Ölçülen metraj',c.measuredLengthMeters);row('Not',c.note);
      for(const [name,end]of [['Kaynak',c.from],['Hedef',c.to]]){const rack=RS.STATE.racks.find(r=>r.id===end.rackId),d=rack?.devices.find(d=>d.instanceId===end.instanceId);row(name,`${rack?.name||end.rackId} / ${d?.hostname||d?.name||end.instanceId} / ${end.portId}`);}
      for(const [name,end]of [['Kaynağa git',c.from],['Hedefe git',c.to]])target.append(button(name,()=>{document.getElementById('mobile-workflow-dialog')?.close();if(window.is3DMode)window.__STUDIO3D__?.focusDevice(end.instanceId);else RS.focusOnDevice?.(end.instanceId);}));
      target.append(button('İki ucu göster',()=>{document.getElementById('mobile-workflow-dialog')?.close();if(window.is3DMode)window.__STUDIO3D__?.focusCable(c.id);else {if(c.from.rackId!==c.to.rackId)RS.setViewMode?.('multi',true);requestAnimationFrame(()=>RS.focusOnCable?.(c.id));}}));
    }
    ports();
    target.append(button('Saha QR kodu',()=>{if(mobile?.open)mobile.close();document.getElementById('mobile-workflow-dialog')?.close();RS.FieldQRUI?.open({kind:found.device?'device':'cable',id:found.device?.instanceId||found.cable.id});}));
    target.append(button('Saha kaydı',()=>{if(mobile?.open)mobile.close();document.getElementById('mobile-workflow-dialog')?.close();RS.FieldWorkflowUI?.open({kind:found.device?'device':'cable',id:found.device?.instanceId||found.cable.id});}));
    target.append(button('Gözlem geçmişi',()=>{if(mobile?.open)mobile.close();document.getElementById('mobile-workflow-dialog')?.close();RS.FieldObservationUI?.open({kind:found.device?'device':'cable',id:found.device?.instanceId||found.cable.id});}));
    const actions=node('div');actions.className='selection-actions';
    for(const action of [...target.children].filter(el=>el.tagName==='BUTTON'))actions.append(action);
    const title = target.querySelector(".workspace-selected-title");
    if(title) title.after(actions); else target.prepend(actions);
  }
  function refresh(){
    if(!panel)return;
    const host=document.getElementById('workspace-content-selection');
    if(host && panel.parentElement!==host)host.append(panel);
    panel.hidden=false;
    panel.classList.remove('is-3d','is-cable-integrated');
    render(content);
    if(mobile?.open)render(mobile.querySelector('.workflow-selection-content'));
  }
  function open(trigger){
    if(RS.WorkspaceUI){RS.WorkspaceUI.openPanel('selection',trigger);return;}
    if(!mobile){mobile=node('dialog');mobile.className='workflow-selection-dialog';mobile.setAttribute('aria-label','Seçim bilgileri');const header=node('header');header.append(node('h2','Seçim bilgileri'),button('Kapat',()=>mobile.close()));const body=node('div');body.className='workflow-selection-content';mobile.append(header,body);document.body.append(mobile);mobile.addEventListener('close',()=>opener?.focus());}
    opener=trigger||document.activeElement;render(mobile.querySelector('.workflow-selection-content'));mobile.showModal();
  }
  function init(){
    panel=node('section');panel.id='workflow-selection-panel';panel.className='workflow-selection-panel';panel.hidden=true;panel.setAttribute('aria-label','Seçim bilgileri');panel.append(node('h3','Seçim bilgileri'));content=node('div');content.className='workflow-selection-content';panel.append(content);
    const host=document.getElementById('workspace-content-selection');
    host?.append(panel);refresh();
    document.addEventListener('rackstudio:selection',e=>choose(e.detail.kind,e.detail.id,e.detail.source));
    document.getElementById('btn-workflow-selection')?.addEventListener('click',e=>open(e.currentTarget));
    for(const type of ['rackstudio:change','rackstudio:refresh','rackstudio:workflow','rackstudio:viewchange'])document.addEventListener(type,refresh);
  }
  RS.WorkflowSelection=Object.freeze({choose,refresh,open,current,render});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
