(function(){
  'use strict';
  const RS=window.RackStudio,O=RS.FieldObservations;
  const node=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
  const button=(text,action)=>{const el=node('button',text);el.type='button';el.addEventListener('click',action);return el;};
  const display=value=>typeof value==='object'?JSON.stringify(value):String(value??'—');
  const fieldLabels={'device.hostname':'Cihaz adı','device.ipAddress':'IP adresi','device.serialNumber':'Seri numarası','device.macAddress':'MAC adresi','device.assetTag':'Varlık etiketi','device.catalogKey':'Model','port.interfaceName':'Arayüz adı','port.description':'Port açıklaması','port.vlan':'VLAN','port.status':'Port durumu','cable.name':'Bağlantı adı','cable.note':'Bağlantı notu','cable.role':'Bağlantı rolü','cable.medium':'Kablo türü','cable.measuredLengthMeters':'Ölçülen metraj','cable.estimatedLengthMeters':'Planlanan metraj','cable.from':'Kaynak uç','cable.to':'Hedef uç'};
  const sourceLabel=row=>typeof row.source==='string'?row.source:row.source?.filename||row.source?.label||row.source?.system||'Kaynak belirtilmedi';
  const dateLabel=value=>value?new Date(value).toLocaleString('tr-TR',{dateStyle:'short',timeStyle:'short'}):'Belirtilmedi';
  function open(entityRef,observationId){
    if(document.getElementById('field-observations-dialog')?.open)return;
    const projectId=RS.STATE.projectDocument.projectId,opener=document.activeElement;
    const dialog=node('dialog');dialog.id='field-observations-dialog';dialog.className='field-observations-dialog';dialog.setAttribute('aria-label','Gözlem geçmişi');
    const header=node('header');header.append(node('h2','Gözlem geçmişi'),button('Kapat',()=>dialog.close()));
    const status=node('p');status.setAttribute('role','status');
    const search=node('input');search.type='search';search.setAttribute('aria-label','Gözlem ara');search.placeholder='Kaynak, cihaz, port veya tarih';
    const list=node('section'),detail=node('section'),layout=node('div');layout.className='observation-layout';list.setAttribute('aria-label','Gözlem listesi');detail.setAttribute('aria-label','Plan ve gözlem farkı');layout.append(list,detail);
    let selected=observationId||null,page=0,busy=false;
    const check=()=>{if(projectId!==RS.STATE.projectDocument.projectId)throw new Error('Açık proje değişti. Gözlem ekranını yeniden açın.');};
    async function run(action){if(busy)return;busy=true;dialog.setAttribute('aria-busy','true');try{check();await action();status.textContent='İşlem kaydedildi.';render();}catch(error){status.textContent=error.message;}finally{busy=false;dialog.removeAttribute('aria-busy');}}
    function render(){
      check();const doc=RS.ProjectDocument.capture(RS.STATE),all=O.history(doc,entityRef),term=search.value.toLocaleLowerCase('tr');
      const rows=all.filter(r=>JSON.stringify([r.source,r.entityRef,r.subject,r.collectedAt,r.raw]).toLocaleLowerCase('tr').includes(term));page=Math.min(page,Math.max(0,Math.ceil(rows.length/50)-1));
      list.replaceChildren(node('h3',`${rows.length} gözlem`));
      if(!rows.length)list.append(node('p','Gözlem yok. Envanter dosyası alın veya eski observed alanını geçmişe taşıyın. Plan değişmez.'));
      for(const row of rows.slice(page*50,(page+1)*50)){
        const target=row.entityRef?.kind==='cable'?doc.topology.cables.find(c=>c.id===row.entityRef.id):doc.topology.racks.flatMap(r=>r.devices).find(d=>d.instanceId===row.entityRef?.id);
        const text=`${sourceLabel(row)} · ${target?.hostname||target?.name||row.entityRef?.id||'Eşleme bekliyor'}${row.subject?.portId?' / '+row.subject.portId:''} · ${row.collectedAt?dateLabel(row.collectedAt):'Toplanma zamanı belirtilmedi'}${O.stale(row,doc)?' · Eski gözlem':''}`;
        const item=button(undefined,()=>{selected=row.id;render();});item.className='observation-row';item.title=text;item.append(node('strong',target?.hostname||target?.name||row.entityRef?.id||'Eşleme bekliyor'),node('small',`${sourceLabel(row)} · ${dateLabel(row.collectedAt)}${row.subject?.portId?' · '+row.subject.portId:''}${O.stale(row,doc)?' · Eski gözlem':''}`));item.dataset.observationId=row.id;item.setAttribute('aria-pressed',String(selected===row.id));list.append(item);
      }
      if(rows.length>50){list.append(node('p',`${page+1} / ${Math.ceil(rows.length/50)}`));const prev=button('Önceki',()=>{page--;render();}),next=button('Sonraki',()=>{page++;render();});prev.disabled=page===0;next.disabled=(page+1)*50>=rows.length;list.append(prev,next);}
      renderDetail(doc,doc.observations.find(r=>r.id===selected));
    }
    function renderDetail(doc,row){
      detail.replaceChildren(node('h3','Plan / gözlem farkı'));if(!row){detail.append(node('p','Bir gözlem seçin.'));return;}
      const old=O.stale(row,doc);detail.append(node('p',`Kaynak: ${sourceLabel(row)} · Toplanma: ${dateLabel(row.collectedAt)} · Alınma: ${dateLabel(row.receivedAt)}`));
      if(old)detail.append(node('p','Eski tarihli gözlem. Daha yeni veri olabilir; geçmiş kaydıdır.',''));
      if(row.parentObservationId)detail.append(node('p','Önceki eşlemenin düzeltmesi; özgün kayıt korunur.'));
      if(row.mapping&&row.mapping.status!=='matched'){
        detail.append(node('p','İnceleme gerekli: '+row.mapping.reason));const choice=node('select');choice.setAttribute('aria-label','Gözlemi eşle');choice.append(node('option','Bir hedef seçin'));choice.firstChild.value='';
        const targets=row.subject.kind==='cable'?doc.topology.cables:doc.topology.racks.flatMap(r=>r.devices);
        for(const target of targets){const option=node('option',target.hostname||target.name||target.id||target.instanceId);option.value=target.id||target.instanceId;choice.append(option);}
        detail.append(choice,button('Eşlemeyi yeni kayıt olarak kaydet',()=>run(async()=>{if(!choice.value)throw new Error('Eşleme hedefi seçin.');await O.resolve(row.id,choice.value);}))); 
      }
      const diff=O.differences(row,doc),checks=[],expected=RS.ProjectCommands.begin();
      if(!diff.length)detail.append(node('p',row.entityRef?'Uygulanabilir plan farkı yok veya hedef artık mevcut değil.':'Eşleme tamamlanmadan plan farkı uygulanamaz.'));
      for(const item of diff){const label=node('label');label.className='observation-difference';const input=node('input');input.type='checkbox';input.disabled=!item.canApply||!RS.WorkflowViews.canEdit();input.setAttribute('aria-label',fieldLabels[item.field]||item.field);checks.push({input,field:item.field});label.append(input,node('span',`${fieldLabels[item.field]||item.field}: ${display(item.planned)} → ${display(item.observed)}${!item.canApply?' · yalnızca saha durumu':''}`));detail.append(label);}
      const allow=node('input');allow.type='checkbox';allow.setAttribute('aria-label','Eski gözlemi uygulamayı onaylıyorum');if(old){const label=node('label','Eski gözlemi uygulamayı onaylıyorum');label.prepend(allow);detail.append(label);}
      if(diff.some(d=>d.canApply)&&RS.WorkflowViews.canEdit())detail.append(button('Seçilen farkları plana uygula',()=>run(()=>O.apply(row.id,checks.filter(c=>c.input.checked).map(c=>c.field),allow.checked,expected))));
      const raw=node('details'),summary=node('summary','Kaynak ayrıntıları ve ham veri'),pre=node('pre',JSON.stringify({source:row.source,collectedAt:row.collectedAt,receivedAt:row.receivedAt,raw:row.raw,normalized:row.normalized},null,2));raw.append(summary,pre);detail.append(raw);
    }
    const actions=node('div');actions.append(button('Eski gözlemleri geçmişe taşı',()=>run(()=>O.migrate())),button('Envanter dosyası al',()=>{dialog.close();RS.InventoryImport.open();}));
    if(entityRef)actions.append(button('Tüm gözlemleri göster',()=>{dialog.close();open();}));
    dialog.append(header,node('p','Plan ve saha kaydı ayrıdır. Yeni gözlem önceki kaydı silmez; yalnızca işaretlenen farklar plana aktarılır.'),actions,search,status,layout);
    search.addEventListener('input',()=>{page=0;render();});document.body.append(dialog);dialog.addEventListener('close',()=>{dialog.remove();if(opener?.isConnected)opener.focus();});render();dialog.showModal();
  }
  RS.FieldObservationUI=Object.freeze({open});document.getElementById('btn-field-observations')?.addEventListener('click',()=>open());
})();
