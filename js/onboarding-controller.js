(function(){
  'use strict';
  const RS=window.RackStudio,storage=RS.ProjectStorageIDB;
  const node=(tag,text)=>{const el=document.createElement(tag);if(text)el.textContent=text;return el;};
  const button=(text,action)=>{const el=node('button',text);el.type='button';el.addEventListener('click',action);return el;};
  async function read(){return await storage.read(await RS.ProjectRepository.database,'meta','onboarding-v1');}
  async function write(session){await storage.transaction(await RS.ProjectRepository.database,['meta'],'readwrite',(tx)=>tx.objectStore('meta').put(session,'onboarding-v1'));}
  async function open(){
    if(document.getElementById('onboarding-dialog')?.open)return;
    const opener=document.activeElement,dialog=node('dialog');dialog.id='onboarding-dialog';dialog.className='instrument-dialog p09-dialog';dialog.setAttribute('aria-label','İlk kullanım');
    const header=node('header');header.append(node('h2','İlk kullanım'),button('Atla / Kapat',()=>dialog.close()));
    const content=node('section'),status=node('p');status.setAttribute('role','status');dialog.append(header,content,status);
    let session=await read(),busy=false;
    async function run(action){if(busy)return;busy=true;dialog.setAttribute('aria-busy','true');try{await action();status.textContent='';render();}catch(error){status.textContent=error.message;}finally{busy=false;dialog.removeAttribute('aria-busy');}}
    function sample(){if(RS.STATE.projectDocument.projectId!==session?.sampleId || !RS.STATE.projectDocument.extensions.onboardingExample)throw new Error('Örnek proje açık değil. Rehberi yeniden açıp örneğe devam edin.');}
    async function next(action){sample();await action?.();session.step++;await write(session);}
    async function start(){
      const expected=RS.ProjectManagement.prepare(),returnId=expected.projectId,doc=RS.OnboardingExample();
      const result=await RS.importProjectDocument(doc,expected);
      if(window.is3DMode)window.__STUDIO3D__.loadTopologyFromProject(RS.ProjectDocument.capture(RS.STATE));
      session={returnId,sampleId:result.projectId,step:1,completed:false};await write(session);
      await RS.setStudioMode(false);RS.WorkflowViews.set('design');
    }
    function render(){
      content.replaceChildren();
      if(!session || session.completed || RS.STATE.projectDocument.projectId!==session.sampleId){
        content.append(node('p','Cihaz yerleştirme, port bağlama, plan/gözlem ayrımı ve teslim hazırlığını ayrı bir örnek projede deneyin. Açık projeniz önce yerel depoya kaydedilir. Atlamak projenizi değiştirmez.'),button('Ayrı örnek projeyi başlat',()=>run(start)));
        if(session&&!session.completed)content.append(button('Örneğe devam et',()=>run(async()=>{await RS.openStoredProject(session.sampleId);})),button('Kendi projeme dön',()=>run(back)));
        return;
      }
      const steps=[null,['Cihaz yerleştir','Kütüphaneden cihazı boş U alanına bırakabilir veya mobil katalogdan yerleştirebilirsiniz. Örnekte ikinci switchi 12U konumuna ekleyin.'],['Portları bağla','Bir cihazın portunu, ardından diğerinin portunu seçin. Mobilde Seçim → Port seçerek bağla kullanılır. Burada iki GE1 portunu örnek kabloyla bağlayın.'],['Sahadaki durumu incele','Saha görünümündeki seçim bilgileri planı ve gözlem sayısını ayırır. Bu örnekteki gözlem sentetiktir; planın üzerine yazılmaz. Gözlem düzenleme ve saha kanıtı sonraki paketlerde eklenecek.'],['Teslimi hazırla','Sunum açısını revizyona sabitleyin. Bu bir teslim taslağıdır; gerçek saha onayı veya teslim paketi değildir. Malzeme, etiket ve teslim çıktıları sonraki paketlerde gelecek.'],['Örnek tamamlandı','Örnek proje ayrı kayıtta kalır. Kendi projenize dönebilir; rehberi araçlardan yeniden açabilirsiniz.']];
      const [title,text]=steps[Math.min(session.step,5)];content.append(node('p',`Adım ${Math.min(session.step,4)} / 4 · Ayrı örnek proje`),node('h3',title),node('p',text));
      if(session.step===1)content.append(button('Örnek cihazı yerleştir',()=>run(()=>next(async()=>{await RS.setStudioMode(false);RS.WorkflowViews.set('design');const rack=RS.STATE.racks[0];if(rack.devices.length<2){const dev=RS.mountDeviceAt('intro-switch',12);if(!dev)throw new Error('12U dolu; boşaltıp yeniden deneyin.');document.dispatchEvent(new CustomEvent('rackstudio:change',{detail:{immediate:true}}));document.dispatchEvent(new CustomEvent('rackstudio:refresh'));await RS.saveProjectNow();}}))));
      if(session.step===2)content.append(button('Örnek portları bağla',()=>run(()=>next(async()=>{const rack=RS.STATE.racks[0];if(!RS.STATE.cables.length){const from={rackId:rack.id,instanceId:rack.devices[0].instanceId,portId:'p1'},to={rackId:rack.id,instanceId:rack.devices[1]?.instanceId,portId:'p1'};const result=RS.ProjectCommands.execute({...RS.ProjectManagement.prepare(),type:'ConnectCable',payload:{cable:{id:crypto.randomUUID(),name:'Örnek bağlantı',color:'#2563eb',from,to,lengthMeters:2}}});await result.committed;}}))));
      if(session.step===3)content.append(button('Saha görünümünü incele',()=>run(()=>next(()=>{RS.WorkflowViews.set('field');RS.WorkflowSelection.choose('device',RS.STATE.racks[0].devices[0].instanceId,'2d');}))));
      if(session.step===4)content.append(button('Örnek sunum taslağını kaydet',()=>run(()=>next(async()=>{RS.WorkflowViews.set('presentation');await RS.SavedViews.capture('Örnek teslim taslağı',true);} ))));
      content.append(button('Kendi projeme dön',()=>run(back)));
    }
    async function back(){await RS.openStoredProject(session.returnId);session.completed=session.step>=5;await write(session);dialog.close();}
    document.body.append(dialog);dialog.addEventListener('close',()=>{dialog.remove();if(opener?.isConnected)opener.focus();});render();dialog.showModal();
  }
  RS.Onboarding=Object.freeze({open});
  document.getElementById('btn-onboarding')?.addEventListener('click',()=>open().catch(error=>window.UIActions?.notify(error.message)));
})();
