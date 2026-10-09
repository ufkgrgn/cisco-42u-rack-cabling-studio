(function(){
  'use strict';
  const RS=window.RackStudio;
  const node=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
  function open(){
    if(document.getElementById('netbox-dialog'))return;
    const dialog=node('dialog');dialog.id='netbox-dialog';dialog.className='project-manager integration-dialog';dialog.setAttribute('aria-label','NetBox gözlemleri');
    const opener=document.activeElement,header=node('div');header.className='pm-header';header.append(node('h2','NetBox gözlemleri'));
    const close=node('button','Kapat');close.type='button';close.onclick=()=>dialog.close();header.append(close);
    const status=node('p');status.setAttribute('role','status');
    const info=node('p','Önce envanteri alın, yerel hedefleri seçin ve gözlem olarak kaydedin. Planı değiştirmek için gözlem farklarını ayrıca uygulayın.');
    const file=node('input');file.type='file';file.accept='.json';file.setAttribute('aria-label','NetBox gözlem paketi aç');
    const native=window.__TAURI__?.core?.invoke,settings=node('fieldset');settings.append(node('legend','Bağlı NetBox'));
    const address=node('input');address.type='url';address.placeholder='https://netbox.example.com';address.setAttribute('aria-label','NetBox adresi');
    const token=node('input');token.type='password';token.autocomplete='off';token.setAttribute('aria-label','NetBox salt okunur API anahtarı');
    const configure=node('button','Bağlantıyı kaydet'),fetch=node('button','Envanteri al'),forget=node('button','Anahtarı kaldır');configure.type=fetch.type=forget.type='button';configure.disabled=fetch.disabled=forget.disabled=!native;
    settings.append(address,token,configure,fetch,forget,node('p',native?'Anahtar Windows kimlik deposunda tutulur. Boş bırakınca mevcut anahtar kullanılır.':'Tarayıcıda anonim JSON paketi kullanın; bağlı NetBox masaüstünde açılır.'));
    const list=node('section'),importButton=node('button','Seçilileri gözlem olarak kaydet'),history=node('button','Gözlem farklarını aç');importButton.type=history.type='button';importButton.disabled=true;
    dialog.append(header,info,file,settings,status,list,importButton,history);document.body.append(dialog);dialog.showModal();
    let preview=null,busy=false,abort=new AbortController();
    const selected=new Set();
    async function run(work){if(busy)return;busy=true;dialog.setAttribute('aria-busy','true');try{await work();}catch(error){status.textContent=error.message;}finally{busy=false;dialog.removeAttribute('aria-busy');}}
    function render(data,page=0){
      if(page===0){preview=RS.NetBoxAdapter.preview(data,RS.ProjectDocument.capture(RS.STATE));selected.clear();importButton.disabled=true;}list.replaceChildren();
      const doc=RS.ProjectDocument.capture(RS.STATE),devices=doc.topology.racks.flatMap(r=>r.devices),catalog=RS.CatalogSources?.map(doc)||{...RS.catalog,...doc.topology.customCatalog};
      status.textContent=`${data.sites.length} saha, ${data.racks.length} kabin, ${data.devices.length} cihaz. Hedefi belirsiz kayıtları eşleyin.`;
      for(let index=page*50;index<Math.min(preview.rows.length,(page+1)*50);index++){const row=preview.rows[index];
        const card=node('section');card.className='pm-card';const checkbox=node('input');checkbox.type='checkbox';checkbox.setAttribute('aria-label',`${row.kind} ${row.external.name||row.external.id} seç`);checkbox.onchange=()=>{checkbox.checked?selected.add(index):selected.delete(index);importButton.disabled=!selected.size;};
        checkbox.checked=selected.has(index);const label=node('label',`${row.external.name||row.external.label||row.external.id} · ${row.model||row.kind}${row.status==='review'?' · Eşleme gerekli':''}`);label.prepend(checkbox);card.append(label);
        const target=node('select');target.setAttribute('aria-label','Yerel hedef');const blank=node('option','Hedef seçin');blank.value='';target.append(blank);
        for(const value of row.kind==='cable'?doc.topology.cables:devices){const option=node('option',value.hostname||value.name||value.id||value.instanceId);option.value=value.instanceId||value.id;target.append(option);}
        target.value=row.instanceId||row.cableId||'';card.append(target);
        const port=node('select');port.setAttribute('aria-label','Yerel port');
        const updatePorts=()=>{port.replaceChildren();const blank=node('option','Port seçin');blank.value='';port.append(blank);const device=devices.find(d=>d.instanceId===target.value);for(const value of catalog[device?.catalogKey]?.ports||[]){const option=node('option',device.portsConfig?.[value.id]?.ciscoName||value.id);option.value=value.id;port.append(option);}port.value=row.portId||'';};
        target.onchange=()=>{if(row.kind==='cable')row.cableId=target.value;else{row.instanceId=target.value;row.catalogKey=devices.find(d=>d.instanceId===target.value)?.catalogKey||'';}if(row.kind==='port'){row.portId='';updatePorts();}};
        if(row.kind==='port'){updatePorts();port.onchange=()=>{row.portId=port.value;};card.append(port);}
        list.append(card);
      }
      if(!preview.rows.length)list.append(node('p','Bu pakette gözlem adayı yok.'));
      if(preview.rows.length>50){list.append(node('p',`Sayfa ${page+1}/${Math.ceil(preview.rows.length/50)} · ${selected.size} seçili`));for(const[next,title]of [[page-1,'Önceki sayfa'],[page+1,'Sonraki sayfa']]){const control=node('button',title);control.type='button';control.disabled=next<0||next*50>=preview.rows.length;control.onclick=()=>render(data,next);list.append(control);}}
    }
    file.onchange=()=>run(async()=>{const chosen=file.files[0];if(!chosen)return;if(chosen.size>16*1024*1024)throw new Error('Dosya 16 MB sınırını aşıyor.');render(RS.NetBoxAdapter.validate(await chosen.text()));});
    configure.onclick=()=>run(async()=>{try{await native('netbox_configure',{baseUrl:RS.NetBoxAdapter.instance(address.value),secret:token.value});status.textContent='NetBox bağlantısı kaydedildi.';}finally{token.value='';}});
    forget.onclick=()=>run(async()=>{await native('netbox_forget',{baseUrl:RS.NetBoxAdapter.instance(address.value)});token.value='';status.textContent='NetBox anahtarı kaldırıldı.';});
    fetch.onclick=()=>run(async()=>{preview=null;selected.clear();importButton.disabled=true;const data=await RS.NetBoxAdapter.collect(address.value,url=>native('netbox_get',{url}),abort.signal);if(dialog.open)render(data);});
    importButton.onclick=()=>run(async()=>{
      if(RS.WorkflowViews?.get()==='presentation')throw new Error('Sunum görünümünde gözlem alınamaz.');
      const doc=RS.ProjectDocument.capture(RS.STATE),payload=await RS.NetBoxAdapter.prepare(preview,[...selected],doc);
      const unchanged=payload.observations.every(row=>doc.observations.some(old=>old.id===row.id))&&payload.mappings.every(row=>doc.integrationMappings.some(old=>RS.ProjectCommands.stable(old)===RS.ProjectCommands.stable(row)));
      if(unchanged){status.textContent='Bu gözlemler zaten kayıtlı.';return;}
      const result=RS.ProjectCommands.execute({...RS.ProjectCommands.begin(),type:'ImportObservations',payload});await result.committed;
      status.textContent='Gözlemler kaydedildi. Plan değişmedi.';preview.revision=RS.STATE.projectDocument.revision;preview.content=RS.ProjectCommands.domainKey(RS.ProjectDocument.capture(RS.STATE));
    });
    history.onclick=()=>{dialog.close();RS.FieldObservationUI?.open();};
    dialog.addEventListener('close',()=>{abort.abort();token.value='';dialog.remove();opener?.focus();},{once:true});
  }
  document.getElementById('btn-netbox-import')?.addEventListener('click',open);
  RS.NetBoxController=Object.freeze({open});
})();
