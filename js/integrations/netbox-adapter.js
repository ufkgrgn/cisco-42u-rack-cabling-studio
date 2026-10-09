(function () {
  'use strict';
  const RS = window.RackStudio;
  const collections = ['sites','racks','devices','interfaces','cables'];
  const stable = value => RS.ProjectCommands.stable(value);
  function instance(value) {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('NetBox adresi kimlik bilgisi içermeyen HTTPS adresi olmalı.');
    return url.href.replace(/\/$/, '');
  }
  async function collect(base, get, signal, options={}) {
    base = instance(base);
    const data = { format:'rack-studio-netbox', version:1, instance:base, complete:false };
    for (const name of collections) {
      const endpoint = `${base}/api/dcim/${name}/`;
      let next = endpoint + '?limit=200', count = null;
      const seen = new Set(), rows = [], ids = new Set();
      while (next) {
        if (signal?.aborted) throw new Error('İçe alma iptal edildi.');
        const url = new URL(next, base);
        if (url.origin !== new URL(base).origin || url.pathname !== new URL(endpoint).pathname || url.username || url.password || url.hash || seen.has(url.href)) throw new Error('Güvensiz veya tekrarlayan NetBox sayfası.');
        if (seen.size >= 100 || rows.length > 5000) throw new Error('NetBox sayfa/kayıt sınırı aşıldı.');
        seen.add(url.href);
        let page;
        for(let attempt=0;attempt<3;attempt++){
          try{page=await get(url.href,signal);break;}
          catch(error){if(attempt===2||signal?.aborted||!/HTTP (429|502|503|504)\b|network failure|timeout/i.test(String(error)))throw error;
            await (options.wait||((ms)=>new Promise((resolve,reject)=>{const timer=setTimeout(resolve,ms);signal?.addEventListener('abort',()=>{clearTimeout(timer);reject(new Error('İçe alma iptal edildi.'));},{once:true});})))(250*2**attempt);
          }
        }
        if (!page || !Array.isArray(page.results) || !Number.isSafeInteger(page.count) || page.count < 0 || page.count > 5000 || (page.next !== null && typeof page.next !== 'string')) throw new Error('Geçersiz NetBox sayfası.');
        if (count !== null && count !== page.count) throw new Error('NetBox envanteri okuma sırasında değişti; yeniden alın.');
        count = page.count;
        for (const row of page.results) {
          if (!Number.isSafeInteger(row.id) || row.id < 1 || ids.has(row.id)) throw new Error('Geçersiz/tekrarlı NetBox kimliği.');
          ids.add(row.id); rows.push(row);
        }
        next = page.next;
      }
      if (rows.length !== count) throw new Error('NetBox envanteri eksik; gözlem olarak kaydedilmedi.');
      data[name] = rows;
    }
    data.complete = true;
    return data;
  }
  function validate(input) {
    if (typeof input === 'string') {
      if (new TextEncoder().encode(input).length > 16*1024*1024) throw new Error('NetBox dosyası 16 MB sınırını aşıyor.');
      input = JSON.parse(input, (key,value) => { if (['__proto__','constructor','prototype'].includes(key)) throw new Error('Güvensiz NetBox alanı.'); return value; });
    }
    if (input?.format !== 'rack-studio-netbox' || input.version !== 1 || input.complete !== true) throw new Error('Tamamlanmış NetBox paketi gerekli.');
    const base = instance(input.instance);
    for (const name of collections) {
      if (!Array.isArray(input[name]) || input[name].length > 5000 || new Set(input[name].map(row=>row?.id)).size !== input[name].length || input[name].some(row=>!row || !Number.isSafeInteger(row.id) || row.id < 1)) throw new Error('Geçersiz NetBox koleksiyonu: '+name);
    }
    return { ...structuredClone(input), instance:base };
  }
  function preview(input, doc) {
    const data = validate(input), devices = doc.topology.racks.flatMap(r=>r.devices);
    const catalog = RS.CatalogSources?.map(doc) || { ...RS.catalog, ...doc.topology.customCatalog };
    const mappings = doc.integrationMappings.filter(row=>row.sourceSystem==='netbox' && row.sourceInstance===data.instance);
    const rows = [];
    for (const external of data.devices) {
      const site = external.site?.id, model = external.device_type?.model || '';
      const externalId = `site:${site || 'unknown'}:device:${external.id}:model:${external.device_type?.id || 'unknown'}`;
      const remembered = mappings.find(row=>row.externalId===externalId);
      const modelKeys = Object.keys(catalog).filter(key=>[key,catalog[key]?.sku,catalog[key]?.model,catalog[key]?.modelTag,catalog[key]?.name].some(value=>String(value||'').toLowerCase()===model.toLowerCase()));
      const hits = remembered ? devices.filter(d=>d.instanceId===remembered.entityRef?.id) : devices.filter(d=>String(d.hostname||d.name||'').toLowerCase()===String(external.name||'').toLowerCase() && modelKeys.includes(d.catalogKey));
      const matched = hits.length===1 && modelKeys.includes(hits[0].catalogKey);
      rows.push({ kind:'device', externalId, external, model, candidateIds:hits.map(d=>d.instanceId), instanceId:matched?hits[0].instanceId:'', catalogKey:matched?hits[0].catalogKey:'', status:matched?'matched':'review' });
    }
    for (const external of data.interfaces) {
      const parent = rows.find(row=>row.kind==='device' && row.external.id===external.device?.id);
      if (!parent) { rows.push({ kind:'port', externalId:`interface:${external.id}`, external, status:'review', reason:'NetBox cihazı pakette yok.', instanceId:'', portId:'' }); continue; }
      const device = devices.find(d=>d.instanceId===parent.instanceId);
      const ports = catalog[device?.catalogKey]?.ports || [];
      const hits = ports.filter(port=>[port.id,device?.portsConfig?.[port.id]?.ciscoName].includes(external.name));
      rows.push({ kind:'port', externalId:parent.externalId+`:interface:${external.id}`, external, parentExternalId:parent.externalId, instanceId:parent.instanceId, portId:hits.length===1?hits[0].id:'', status:parent.status==='matched'&&hits.length===1?'matched':'review' });
    }
    // Cable endpoints and physical placement require explicit local mapping; never infer from U/name alone.
    for (const external of data.cables) rows.push({ kind:'cable', externalId:`cable:${external.id}`, external, status:'review', cableId:'' });
    return { data, rows, projectId:doc.projectId, revision:doc.revision, content:RS.ProjectCommands.domainKey(doc) };
  }
  async function prepare(preview, selected, doc) {
    if (preview.projectId!==doc.projectId || preview.revision!==doc.revision || preview.content!==RS.ProjectCommands.domainKey(doc)) throw new Error('NetBox önizlemesi güncel değil.');
    const mappings = [], raw = [], devices = doc.topology.racks.flatMap(r=>r.devices);
    for (const index of selected) {
      const row=preview.rows[index]; if (!row) throw new Error('Geçersiz NetBox seçimi.');
      const device=devices.find(d=>d.instanceId===row.instanceId), cable=doc.topology.cables.find(c=>c.id===row.cableId);
      if (row.kind==='cable' ? !cable : !device) throw new Error('Seçilen kayıt için yerel hedef gerekli.');
      const catalog=RS.CatalogSources?.map(doc) || {...RS.catalog,...doc.topology.customCatalog};
      if(row.kind==='port'&&!catalog[device.catalogKey]?.ports?.some(p=>p.id===row.portId))throw new Error('Port eşlemesi gerekli.');
      const external=row.external, values={ netbox:structuredClone(external), externalId:row.externalId, ...(external.last_updated?{collectedAt:external.last_updated}:{}) };
      if(row.kind==='device')Object.assign(values,{instanceId:device.instanceId,hostname:external.name||'',serialNumber:external.serial||'',assetTag:external.asset_tag||'',catalogKey:row.catalogKey||device.catalogKey});
      if(row.kind==='port')Object.assign(values,{instanceId:device.instanceId,portId:row.portId,interfaceName:external.name||'',description:external.description||'',...(external.enabled!==undefined?{status:external.enabled?'enabled':'disabled'}:{})});
      if(row.kind==='cable')Object.assign(values,{cableId:cable.id,note:external.description||''});
      raw.push(values);
      const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(stable([preview.data.instance,row.externalId])));
      mappings.push({id:'netbox-'+[...new Uint8Array(hash)].map(n=>n.toString(16).padStart(2,'0')).join(''),sourceSystem:'netbox',sourceInstance:preview.data.instance,externalId:row.externalId,entityRef:{kind:row.kind==='cable'?'cable':'device',id:cable?.id||device.instanceId},...(row.portId?{portId:row.portId}:{})});
    }
    const observations=[];
    for(const values of raw)observations.push(...await RS.FieldObservations.prepare([values],{system:'netbox',instance:preview.data.instance,externalId:values.externalId,label:'NetBox'},doc));
    return { observations,mappings };
  }
  RS.NetBoxAdapter=Object.freeze({collect,validate,preview,prepare,instance});
})();
