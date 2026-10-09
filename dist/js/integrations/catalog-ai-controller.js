(function(){
  'use strict';
  const R=window.RackStudio;
  function attach(parent){
    if(!window.__TAURI_INTERNALS__)return{update(){}};
    const host=document.createElement('section'),label=document.createElement('label'),enabled=document.createElement('input'),settings=document.createElement('button'),status=document.createElement('p'),results=document.createElement('div');
    host.className='catalog-ai-pilot';enabled.type='checkbox';enabled.disabled=!window.__TAURI_INTERNALS__;label.append(enabled,document.createTextNode('AI sıralama pilotu'));settings.type='button';settings.textContent='AI anahtarı';settings.disabled=enabled.disabled;status.setAttribute('role','status');
    host.append(label,settings,status,results);parent.append(host);let timer,signature='';
    settings.onclick=()=>{
      const dialog=document.createElement('dialog');dialog.className='project-manager integration-dialog';dialog.setAttribute('aria-label','AI pilot ayarları');
      const heading=document.createElement('h2');heading.textContent='AI sıralama pilotu';const explanation=document.createElement('p');explanation.textContent='Sorgu ve en fazla 20 üretici katalog adayı TypeSafe’e gönderilir. Müşteri projesi gönderilmez. Pilotun başarı ve maliyet ölçümü henüz tamamlanmadı.';
      const input=document.createElement('input');input.type='password';input.autocomplete='off';input.setAttribute('aria-label','TypeSafe API anahtarı');
      const save=document.createElement('button'),close=document.createElement('button'),remove=document.createElement('button'),message=document.createElement('p');save.textContent='Anahtarı kaydet';close.textContent='Kapat';remove.textContent='Anahtarı kaldır';
      save.onclick=async()=>{try{await R.NativeSecretProvider.set('jev',input.value);message.textContent='Anahtar Windows kimlik deposuna kaydedildi.';}catch(error){message.textContent=error.message;}finally{input.value='';}};
      remove.onclick=async()=>{try{await R.NativeSecretProvider.remove('jev');enabled.checked=false;R.CatalogReranker.cancel();results.replaceChildren();message.textContent='Anahtar kaldırıldı.';}catch(error){message.textContent=error.message;}};
      close.onclick=()=>dialog.close();dialog.append(heading,explanation,input,save,remove,message,close);document.body.append(dialog);dialog.addEventListener('close',()=>{input.value='';dialog.remove();settings.focus();});dialog.showModal();
    };
    enabled.onchange=()=>{R.CatalogReranker.cancel();results.replaceChildren();status.textContent=enabled.checked?'Deney açık; arama yapın.':'Normal katalog araması.';};
    function update(query,candidates,resolve){
      clearTimeout(timer);R.CatalogReranker.cancel();results.replaceChildren();signature=JSON.stringify([query,candidates]);const current=signature;
      if(!enabled.checked||!query.trim()){status.textContent='';return;}
      status.textContent='AI pilotu değerlendiriyor; normal sonuçlar hazır.';
      timer=setTimeout(async()=>{
        const transport=input=>window.__TAURI__.core.invoke('catalog_rerank',input);
        const response=await R.CatalogReranker.rank(query,candidates,transport,{isCurrent:()=>enabled.checked&&current===signature});
        if(current!==signature||!enabled.checked||response.status==='stale')return;
        status.textContent=response.status==='ranked'?'AI pilot önerileri':response.status==='no-match'?'AI pilotu uygun aday bulamadı.':'AI erişimi yok; normal arama devam ediyor.';
        for(const id of response.ids.slice(0,5)){const button=document.createElement('button');button.type='button';button.textContent=candidates.find(row=>row.id===id)?.name||id;button.onclick=()=>resolve(id)?.click();results.append(button);}
      },250);
    }
    return{update};
  }
  R.CatalogAI=Object.freeze({attach});
})();
