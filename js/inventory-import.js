/* Offline source import: immutable history, unresolved records retained for review. */
(() => {
  'use strict';
  const RS=window.RackStudio,MAX_BYTES=5*1024*1024,MAX_ROWS=5000;
  let dialog,candidates=[],expected=null,token=0,opener,busy=false;
  function parseCsv(text) {
    const rows = [];
    let row = [], field = '', quoted = false;
    for (let index = 0; index < text.length; index++) {
      const char = text[index];
      if (quoted) {
        if (char === '"' && text[index + 1] === '"') { field += '"'; index++; }
        else if (char === '"') quoted = false;
        else field += char;
      } else if (char === '"') quoted = true;
      else if (char === ',' || char === '\n' || char === '\r') {
        if (char === ',') { row.push(field); field = ''; }
        else {
          if (char === '\r' && text[index + 1] === '\n') index++;
          row.push(field); field = '';
          if (row.some(value => value.trim())) rows.push(row);
          row = [];
          if (rows.length > MAX_ROWS + 1) throw new Error('Dosyada çok fazla satır var.');
        }
      } else field += char;
    }
    if (quoted) throw new Error('CSV alıntı işareti kapanmamış.');
    row.push(field);
    if (row.some(value => value.trim())) rows.push(row);
    const headers = rows.shift()?.map(value => value.replace(/^\uFEFF/, '').trim()) || [];
    if (new Set(headers).size !== headers.length || !headers.some(key => ['instanceId', 'serialNumber', 'hostname','cableId'].includes(key))) throw new Error('CSV başlıkları geçersiz. Cihaz kimliği, seri numarası veya ad gerekir.');
    return rows.map(values => Object.fromEntries(headers.map((key, index) => [key, values[index] || ''])));
  }

  function ensure(){
    if(dialog)return;dialog=document.createElement('dialog');dialog.id='inventory-import-dialog';dialog.className='inventory-import-dialog';dialog.setAttribute('aria-label','Envanter karşılaştır');
    dialog.innerHTML='<div class="inventory-import-head"><h2>Envanter karşılaştır</h2><button type="button" data-inventory-action="close">Kapat</button></div><p>CSV/JSON gözlemleri geçmişe eklenir; plan değişmez. Eşleşmeyen kayıtlar inceleme için saklanabilir. Aynı dosya tekrar kayıt oluşturmaz.</p><p>Kimlik: instanceId / serialNumber / hostname veya cableId. Port: portId. Tarih: collectedAt (saat dilimi içeren ISO). Bilinmeyen alanlar ham veride korunur.</p><input id="inventory-import-file" type="file" accept=".csv,.json" aria-label="Envanter dosyası"><div id="inventory-import-status" role="status"></div><div class="inventory-import-list"></div><div class="inventory-import-actions"><button type="button" data-inventory-action="apply" disabled>Seçili gözlemleri kaydet</button></div>';
    document.body.append(dialog);dialog.addEventListener('close',()=>{token++;opener?.focus();});
    dialog.addEventListener('click',e=>{e.stopPropagation();const action=e.target.closest('[data-inventory-action]')?.dataset.inventoryAction;if(action==='close'&&!busy)dialog.close();if(action==='apply')apply();});
    dialog.querySelector('#inventory-import-file').addEventListener('change',loadFile);
  }
  function render(){
    const list=dialog.querySelector('.inventory-import-list');list.replaceChildren();
    candidates.forEach((row,index)=>{const label=document.createElement('label');label.className='inventory-import-row';const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=true;checkbox.dataset.index=String(index);const text=document.createElement('span');text.textContent=`${row.raw.instanceId||row.raw.serialNumber||row.raw.hostname||row.raw.cableId||'Satır '+(index+1)} · ${row.mapping.status==='matched'?'Eşleşti':row.mapping.reason} · ${row.collectedAt||'Toplanma zamanı belirtilmedi'}`;label.append(checkbox,text);list.append(label);});
    const count=candidates.filter(r=>r.mapping.status==='matched').length;
    dialog.querySelector('#inventory-import-status').textContent=`${candidates.length} satır; ${count} eşleşme, ${candidates.length-count} incelenecek satır. Plan değişmeyecek.`;
    dialog.querySelector('[data-inventory-action="apply"]').disabled=!candidates.length;
  }
  async function loadFile(e){
    const file=e.target.files?.[0];if(!file)return;const mine=++token;candidates=[];expected=null;
    const status=dialog.querySelector('#inventory-import-status'),apply=dialog.querySelector('[data-inventory-action="apply"]');apply.disabled=true;dialog.querySelector('.inventory-import-list').replaceChildren();status.textContent='Dosya okunuyor…';
    try{if(file.size>MAX_BYTES)throw new Error('Dosya 5 MB sınırını aşıyor.');const envelope=RS.ProjectManagement.prepare(),doc=RS.ProjectDocument.capture(RS.STATE),text=await file.text();const parsed=file.name.toLowerCase().endsWith('.json')?JSON.parse(text):parseCsv(text),rows=Array.isArray(parsed)?parsed:parsed?.records;
      const sha256=await RS.FieldObservations.hash(text),records=await RS.FieldObservations.prepare(rows,{system:'file',filename:file.name,sha256},doc);
      if(mine!==token||!dialog.open)return;expected=envelope;candidates=records;render();
    }catch(error){if(mine===token)status.textContent=error.message;}
  }
  async function apply(){
    if(busy||!expected)return;const rows=[...dialog.querySelectorAll('.inventory-import-row input:checked')].map(c=>candidates[Number(c.dataset.index)]);if(!rows.length)return;
    busy=true;dialog.setAttribute('aria-busy','true');const status=dialog.querySelector('#inventory-import-status');status.textContent='Gözlemler kaydediliyor…';
    try{const result=await RS.FieldObservations.importRecords(rows,expected);window.UIActions?.notify(result.duplicate?'Bu gözlemler zaten geçmişte.':'Gözlemler kaydedildi; plan değişmedi.');dialog.close();}
    catch(error){status.textContent=error.message;}
    finally{busy=false;dialog.removeAttribute('aria-busy');}
  }
  function open(){ensure();if(dialog.open)return;opener=document.activeElement;candidates=[];expected=null;token++;dialog.querySelector('#inventory-import-file').value='';dialog.querySelector('.inventory-import-list').replaceChildren();dialog.querySelector('#inventory-import-status').textContent='';dialog.querySelector('[data-inventory-action="apply"]').disabled=true;dialog.showModal();}
  document.getElementById('btn-inventory-import')?.addEventListener('click',open);RS.InventoryImport=Object.freeze({open});
})();
