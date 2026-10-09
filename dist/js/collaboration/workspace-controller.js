(function(){
  'use strict';const R=window.RackStudio,S=R.WorkspaceSession;
  const node=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
  const button=(text,action)=>{const el=node('button',text);el.type='button';el.onclick=action;return el;};
  function open(){
    if(document.getElementById('workspace-dialog'))return;
    const dialog=node('dialog');dialog.id='workspace-dialog';dialog.className='project-manager integration-dialog';dialog.setAttribute('aria-label','Ekip çalışma alanı');const opener=document.activeElement;
    const header=node('div');header.className='pm-header';header.append(node('h2','Yerel ekip çalışma alanı'),button('Kapat',()=>dialog.close()));
    const status=node('p');status.setAttribute('role','status');const token=node('input');token.type='password';token.autocomplete='off';token.placeholder='OpenID Connect erişim belirteci';token.setAttribute('aria-label','OpenID Connect erişim belirteci');
    const company=node('input');company.placeholder='Firma kimliği';company.setAttribute('aria-label','Firma kimliği');const projects=node('section'),pending=node('section'),notes=node('section');
    let busy=false;
    async function run(work){if(busy)return;busy=true;dialog.setAttribute('aria-busy','true');try{await work();}catch(error){status.textContent=error.message;}finally{busy=false;dialog.removeAttribute('aria-busy');}}
    async function list(){const rows=await S.request('/projects');projects.replaceChildren(node('h3','Yetkili projeler'));for(const project of rows)projects.append(button(`${project.id} · kabul edilmiş revizyon ${project.accepted_revision}`,()=>run(async()=>{await S.open(project.id);await drafts();renderNotes();status.textContent='Kabul edilmiş kayıt açıldı. Yerel geri alma geçmişi sıfırlandı.';})));}
    async function drafts(){
      pending.replaceChildren(node('h3','Bekleyen yerel taslaklar'));if(!S.accepted){pending.append(node('p','Önce bir ortak proje açın.'));return;}
      const items=await R.WorkspaceOutbox.read(S.accepted.projectId);if(!items.length)pending.append(node('p','Bekleyen taslak yok.'));
      for(const item of items){
        const card=node('section');card.className='pm-card';card.append(node('p',`${new Date(item.createdAt).toLocaleString('tr-TR')} · ${item.status==='conflict'?'İnceleme gerekli':'Sunucu kabulü bekliyor'}`));
        const detail=node('div');let choices={};
        card.append(button('Farkları incele',()=>run(async()=>{
          choices={};const result=await S.preview(item);detail.replaceChildren();
          if(!result.conflicts.length)detail.append(node('p','Farklı alanlardaki değişiklikler birleştirildi. Sunucu fiziksel kuralları tekrar doğrulayacak.'));
          for(const conflict of result.conflicts){const label=node('label',conflict.message||`${conflict.path}${conflict.deleted?' · Sunucuda silinmiş; yeniden oluşturulmaz':''}`),select=node('select');select.setAttribute('aria-label',conflict.path+' çözümü');const blank=node('option','Çözüm seçin');blank.value='';select.append(blank);for(const choice of conflict.choices.filter(value=>value!=='edit-draft')){const option=node('option',choice==='remote'?'Sunucu değerini koru':'Yerel değişikliği kullan');option.value=choice;select.append(option);}select.onchange=()=>{choices[conflict.path]=select.value;};label.append(select);detail.append(label);}
          detail.append(button('İncelenen taslağı gönder',()=>run(async()=>{const result=await S.send(item,choices);status.textContent=result.ready?'Sunucu kabul etti. Açık yerel taslak korunuyor; güncel kaydı açıkça açabilirsiniz.':'Çatışmalar çözülmedi; taslak saklandı.';await drafts();})));
        })),button('Tekrar gönder',()=>run(async()=>{const result=await S.send(item);status.textContent=result.ready?'Sunucu kabul etti.':'Çatışma incelemesi gerekli.';await drafts();})),button('Taslağı dosyaya yedekle',()=>{const blob=new Blob([JSON.stringify({format:'rack-studio-pending-draft',version:1,...item},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=node('a');link.href=url;link.download='rack-studio-pending-draft.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}),detail);
        pending.append(card);
      }
    }
    function renderNotes(){notes.replaceChildren(node('h3','Ortak açıklamalar'));for(const[key,value]of Object.entries(S.annotations))notes.append(node('p',`${key}: ${value}`));}
    const noteKey=node('input');noteKey.placeholder='Açıklama kimliği';noteKey.setAttribute('aria-label','Açıklama kimliği');const note=node('textarea');note.setAttribute('aria-label','Ortak açıklama');
    const administration=node('section');administration.append(node('h3','Proje yetkileri ve paylaşım'));
    const subject=node('input');subject.setAttribute('aria-label','Üye OpenID subject kimliği');subject.placeholder='Üye OpenID subject kimliği';const role=node('select');role.setAttribute('aria-label','Üye proje rolü');for(const[value,title]of [['designer','Tasarımcı'],['technician','Saha teknisyeni'],['viewer','İzleyici'],['owner','Proje yöneticisi'],['revoke','Yetkiyi kaldır']]){const option=node('option',title);option.value=value;role.append(option);}
    const path=()=>{if(!S.accepted)throw new Error('Önce ortak proje açın.');return'/projects/'+encodeURIComponent(S.accepted.projectId);},members=node('div'),shares=node('div');
    async function administrationList(){members.replaceChildren();for(const row of await S.request(path()+'/members'))members.append(node('p',`${row.subject} · ${row.role}`));shares.replaceChildren();for(const row of await S.request(path()+'/shares')){const line=node('p',`${row.id.slice(0,12)} · ${row.revoked?'İptal edildi':new Date(row.expires_at).toLocaleString('tr-TR')}`);if(!row.revoked)line.append(button('Paylaşımı iptal et',()=>run(async()=>{await S.request(path()+'/shares/'+row.id,'DELETE');await administrationList();})));shares.append(line);}}
    const deletion=node('input');deletion.setAttribute('aria-label','Sunucudan kalıcı silme için proje adı');deletion.placeholder='Silinecek projenin tam adı';
    administration.append(subject,role,button('Üye rolünü kaydet',()=>run(async()=>{await S.request(path()+'/members','PUT',{subject:subject.value,role:role.value==='revoke'?null:role.value});await administrationList();status.textContent='Proje yetkisi kaydedildi.';})),button('Yetkileri ve paylaşımları göster',()=>run(administrationList)),members,
      button('Bir günlük salt okunur paylaşım oluştur',()=>run(async()=>{const share=await S.request(path()+'/shares','POST',{days:1});await administrationList();const output=node('textarea');output.readOnly=true;output.setAttribute('aria-label','Paylaşım adresi');output.value='http://127.0.0.1:8787/api/shares/'+share.token;shares.append(node('p','Bu adresi alan kişi proje topolojisini okuyabilir. Yerel sunucu bu bilgisayarla sınırlıdır.'),output);status.textContent='Paylaşım oluşturuldu; adres yalnızca bu ekranda gösterilir.';})),shares,
      button('Sunucuda arşivle',()=>run(async()=>{await S.request(path()+'/lifecycle','POST',{archived:true});status.textContent='Sunucu projesi arşivlendi; paylaşımlar iptal edildi.';})),button('Sunucuda arşivden çıkar',()=>run(async()=>{await S.request(path()+'/lifecycle','POST',{archived:false});status.textContent='Sunucu projesi tekrar düzenlenebilir.';})),
      button('Sunucu bakımını çalıştır',()=>run(async()=>{const result=await S.request(path()+'/lifecycle','POST',{keepRevisions:100});status.textContent=`${result.revisions} eski revizyon, ${result.evidence} referanssız ek temizlendi.`;})),deletion,
      button('Arşivlenmiş sunucu projesini kalıcı sil',()=>run(async()=>{await S.request(path()+'/lifecycle','POST',{remove:true,confirmation:deletion.value});await list();S.disconnect();status.textContent='Sunucu arşivi silindi. Yerel kayıt ve dış yedekler ayrı kalır.';})));
    dialog.append(header,node('p','Yerel geliştirme sunucusu kullanılır. Erişim belirteci yalnızca bu oturumda tutulur. Tuvaldeki değişiklikler yerel taslaktır; sunucu kabulü ayrı kayıttır.'),token,
      button('Bağlan',()=>run(async()=>{try{await S.connect(token.value);await list();status.textContent='Kimlik doğrulandı.';}finally{token.value='';}})),
      button('Bağlantıyı kapat',()=>{S.disconnect();status.textContent='Bağlantı kapandı; yerel taslaklar korunuyor.';}),company,
      button('Açık projeyi firmaya ekle',()=>run(async()=>{await S.publish(company.value);await list();status.textContent='Proje sunucuda oluşturuldu.';})),projects,
      button('Yerel taslağı bekleyenlere ekle',()=>run(async()=>{await S.enqueue();await drafts();status.textContent='Taslak dayanıklı bekleme kuyruğunda; henüz sunucu kabulü yok.';})),
      button('Bekleyenleri yenile',()=>run(drafts)),pending,notes,noteKey,note,
      button('Açıklamayı taslağa ekle',()=>run(async()=>{S.annotate(noteKey.value,note.value);renderNotes();status.textContent='Açıklama yerelde saklanıyor; sunucu yetki doğrulamasından sonra ortaklaşır.';})),administration);
    const update=event=>{if(event.detail.status==='annotations')renderNotes();};document.addEventListener('rackstudio:workspace',update);dialog.addEventListener('close',()=>{token.value='';document.removeEventListener('rackstudio:workspace',update);dialog.remove();opener?.focus();},{once:true});document.body.append(dialog);dialog.showModal();
  }
  const control=document.getElementById('btn-workspace');control?.addEventListener('click',open);
  function badge(){if(!control)return;if(!S.accepted){control.textContent='Ekip çalışma alanı';return;}const current=R.ProjectDocument.capture(R.STATE);control.textContent=current.projectId===S.accepted.projectId&&R.ProjectCommands.domainKey(current)!==R.ProjectCommands.domainKey(S.localCheckpoint)?'Ekip · yerel taslak':`Ekip · kabul rev ${S.acceptedRevision}`;}
  document.addEventListener('rackstudio:workspace',badge);document.addEventListener('rackstudio:change',badge);
  R.WorkspaceUI=Object.freeze({...R.WorkspaceUI,open});
})();
