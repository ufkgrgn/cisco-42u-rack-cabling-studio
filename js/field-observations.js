/* Immutable source records and explicit, field-selected changes to the plan. */
(function(){
  'use strict';
  const RS=window.RackStudio;
  const deviceFields=['hostname','ipAddress','serialNumber','macAddress','assetTag','catalogKey'];
  const portFields=['interfaceName','description','vlan','status'];
  const cableFields=['name','note','role','medium','measuredLengthMeters','estimatedLengthMeters','from','to'];
  const stable=v=>v&&typeof v==='object'?Array.isArray(v)?'['+v.map(stable).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}':JSON.stringify(v);
  const hash=async text=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(v=>v.toString(16).padStart(2,'0')).join('');
  const devices=doc=>doc.topology.racks.flatMap(r=>r.devices);
  const catalog=(doc,key)=>doc.topology.customCatalog?.[key]||RS.resolveCatalogItem?.(key)||RS.catalog?.[key];
  function normalize(raw){
    const result={};
    for(const key of [...deviceFields,...portFields,...cableFields]){
      if(!Object.hasOwn(raw,key))continue;
      const value=raw[key];
      if(['from','to'].includes(key)){if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Bağlantı ucu nesne olmalı.');result[key]=structuredClone(value);}
      else if(key.endsWith('LengthMeters')){if(value===''||value===null)continue;const number=Number(value);if(!Number.isFinite(number)||number<0)throw new Error('Metraj geçersiz.');result[key]=number;}
      else{if(value!==null&&!['string','number','boolean'].includes(typeof value))throw new Error('Gözlem alanı metin olmalı: '+key);const text=String(value??'').trim();if(text.length>2000)throw new Error('Gözlem alanı çok uzun: '+key);if(text!==''||['description','vlan'].includes(key)||value===null)result[key]=text;}
    }
    return result;
  }
  function match(raw,doc){
    if(raw.cableId){const cable=doc.topology.cables.find(c=>c.id===raw.cableId);return cable?{status:'matched',entityRef:{kind:'cable',id:cable.id},candidateIds:[cable.id]}:{status:'unmatched',candidateIds:[],reason:'Bağlantı kimliği bulunamadı.'};}
    for(const key of ['instanceId','serialNumber','hostname']){
      if(!raw[key])continue;
      const term=String(raw[key]).trim().toLocaleLowerCase('tr');
      const hits=devices(doc).filter(d=>String(d[key]||(key==='hostname'?d.name:'')||'').trim().toLocaleLowerCase('tr')===term);
      if(hits.length===1)return {status:'matched',entityRef:{kind:'device',id:hits[0].instanceId},candidateIds:[hits[0].instanceId]};
      if(hits.length>1)return {status:'ambiguous',candidateIds:hits.map(d=>d.instanceId),reason:key+' birden çok cihazla eşleşiyor.'};
      if(key==='instanceId')return {status:'unmatched',candidateIds:[],reason:'Cihaz kimliği bulunamadı; başka kimliğe otomatik düşülmedi.'};
    }
    return {status:'unmatched',candidateIds:[],reason:'Cihaz bulunamadı.'};
  }
  async function prepare(rows,source,doc=RS.ProjectDocument.capture(RS.STATE)){
    if(!Array.isArray(rows)||rows.length>5000)throw new Error('En fazla 5000 gözlem satırı alınabilir.');
    const receivedAt=new Date().toISOString(),records=[];
    for(let index=0;index<rows.length;index++){
      const raw=rows[index];if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Geçersiz gözlem satırı.');
      const normalized=normalize(raw),mapping=match(raw,doc),portId=String(raw.portId||'').trim();
      if(portId&&mapping.status==='matched'&&mapping.entityRef.kind==='device'){
        const d=devices(doc).find(d=>d.instanceId===mapping.entityRef.id);
        if(!catalog(doc,d.catalogKey)?.ports?.some(p=>p.id===portId)){mapping.status='unmatched';mapping.reason='Port bu modelde bulunamadı; inceleme gerekli.';delete mapping.entityRef;}
      }
      const contentHash=await hash(stable({source,index,raw}));
      const row={observationVersion:1,id:'obs-'+contentHash,projectId:doc.projectId,contentHash,source:structuredClone(source),raw:structuredClone(raw),normalized,receivedAt,mapping:{status:mapping.status,candidateIds:mapping.candidateIds,reason:mapping.reason||''},subject:{kind:raw.cableId?'cable':portId?'port':'device',...(portId?{portId}:{})}};
      if(mapping.entityRef)row.entityRef=mapping.entityRef;
      if(raw.collectedAt){if(typeof raw.collectedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(raw.collectedAt)||!Number.isFinite(Date.parse(raw.collectedAt)))throw new Error('Toplanma zamanı saat dilimi içeren ISO tarih olmalı.');row.collectedAt=raw.collectedAt;}
      records.push(row);
    }
    return records;
  }
  function values(row){return row.normalized||normalize(row.raw||{});}
  const time=row=>Date.parse(row.collectedAt||row.receivedAt||row.recordedAt||'')||0;
  const clocks=new WeakMap(),clockKey=row=>[row.entityRef?.kind,row.entityRef?.id,row.subject?.kind||row.entityRef?.kind,row.subject?.portId||''].join(':');
  function history(doc=RS.ProjectDocument.capture(RS.STATE),entityRef){return doc.observations.filter(row=>!entityRef||(row.entityRef?.kind===entityRef.kind&&row.entityRef.id===entityRef.id)).sort((a,b)=>time(b)-time(a)||a.id.localeCompare(b.id));}
  function stale(row,doc){
    const date=Date.parse(row.collectedAt||'');if(!Number.isFinite(date))return false;
    let index=clocks.get(doc);if(!index||index.count!==doc.observations.length){index={count:doc.observations.length,latest:new Map()};for(const item of doc.observations){const key=clockKey(item);index.latest.set(key,Math.max(index.latest.get(key)||0,time(item)));}clocks.set(doc,index);}
    return date<Date.now()-30*86400000 || (!!row.entityRef&&(index.latest.get(clockKey(row))||0)>date);
  }
  function differences(row,doc=RS.ProjectDocument.capture(RS.STATE)){
    if(!row.entityRef || (row.mapping&&row.mapping.status!=='matched'))return [];
    const value=values(row),d=devices(doc).find(d=>d.instanceId===row.entityRef.id),c=doc.topology.cables.find(c=>c.id===row.entityRef.id),out=[];
    const add=(field,planned,observed,canApply=true)=>{if(stable(planned??'')!==stable(observed))out.push({field,planned:planned??'',observed,canApply});};
    if(row.entityRef.kind==='device'&&d){for(const key of deviceFields)if(Object.hasOwn(value,key))add('device.'+key,d[key]||(key==='hostname'?d.name:'')||'',value[key]);
      if(row.subject?.kind==='port'){const cfg=d.portsConfig?.[row.subject.portId]||{};for(const key of portFields)if(Object.hasOwn(value,key))add('port.'+key,cfg[key==='interfaceName'?'ciscoName':key],value[key],key!=='status');}
    }else if(row.entityRef.kind==='cable'&&c)for(const key of cableFields)if(Object.hasOwn(value,key))add('cable.'+key,c[key],value[key]);
    return out;
  }
  function projectObserved(doc,deviceId){
    const device=devices(doc).find(d=>d.instanceId===deviceId);if(!device)return;
    const observed={interfaces:{}};
    for(const row of history(doc,{kind:'device',id:deviceId}).reverse()){
      const value=values(row);for(const key of deviceFields)if(Object.hasOwn(value,key))observed[key]=value[key];
      if(row.raw?.interfaces)Object.assign(observed.interfaces,structuredClone(row.raw.interfaces));
      if(row.subject?.kind==='port')observed.interfaces[row.subject.portId]={...(observed.interfaces[row.subject.portId]||{}),...Object.fromEntries(portFields.filter(k=>Object.hasOwn(value,k)).map(k=>[k,value[k]]))};
      observed.source=typeof row.source==='string'?row.source:row.source?.filename||row.source?.label||row.source?.system||'';observed.collectedAt=row.collectedAt||'';
    }
    device.observed=observed;
  }
  function appendToDocument(doc,rows){
    if(!Array.isArray(rows)||rows.length>5000)throw new Error('Gözlem paket sınırı aşıldı.');
    const touched=new Set();
    for(const row of rows){
      if(row.projectId!==doc.projectId)throw new Error('Gözlem başka projeye ait.');
      const old=doc.observations.find(o=>o.id===row.id);if(old){if(old.contentHash!==row.contentHash||stable(old.raw)!==stable(row.raw))throw new Error('Gözlem kimliği farklı içerikle kullanıldı.');continue;}
      if(row.mapping?.status==='matched'){
        const entity=row.entityRef,device=devices(doc).find(d=>d.instanceId===entity?.id);
        if(entity?.kind==='device'){if(!device)throw new Error('Gözlem cihazı artık yok.');if(row.subject.kind==='port'&&!catalog(doc,device.catalogKey)?.ports?.some(p=>p.id===row.subject.portId))throw new Error('Gözlem portu artık yok.');touched.add(device.instanceId);}
        else if(entity?.kind!=='cable'||!doc.topology.cables.some(c=>c.id===entity.id))throw new Error('Gözlem bağlantısı artık yok.');
      }
      doc.observations.push(structuredClone(row));
    }
    for(const id of touched)projectObserved(doc,id);
  }
  function applyToDocument(doc,id,fields,allowStale){
    const row=doc.observations.find(o=>o.id===id);if(!row)throw new Error('Gözlem bulunamadı.');
    if(stale(row,doc)&&allowStale!==true)throw new Error('Eski tarihli gözlemi uygulamak için açık onay gerekli.');
    const diff=differences(row,doc);if(!Array.isArray(fields)||!fields.length||new Set(fields).size!==fields.length||fields.some(f=>!diff.some(d=>d.field===f&&d.canApply)))throw new Error('Seçilen fark geçersiz veya uygulanamaz.');
    const d=devices(doc).find(d=>d.instanceId===row.entityRef.id),c=doc.topology.cables.find(c=>c.id===row.entityRef.id);
    for(const field of fields){const value=diff.find(d=>d.field===field).observed,[kind,key]=field.split('.');
      if(kind==='device'){if(key==='catalogKey'&&(!catalog(doc,value)||catalog(doc,value).u!==d.uHeight))throw new Error('Model değişikliği yeniden yerleştirme gerektiriyor veya model bilinmiyor.');d[key]=value;if(key==='hostname')d.name=value;}
      else if(kind==='port'){d.portsConfig||={};d.portsConfig[row.subject.portId]||={};d.portsConfig[row.subject.portId][key==='interfaceName'?'ciscoName':key]=value;}
      else c[key]=structuredClone(value);
    }
    if(fields.some(f=>['cable.from','cable.to','device.catalogKey'].includes(f)))for(const cable of doc.topology.cables.filter(v=>v===c||[v.from,v.to].some(e=>e.instanceId===d?.instanceId))){const result=RS.NetworkRules.validateConnection(cable.from,cable.to,{...doc.topology,cables:doc.topology.cables.filter(v=>v.id!==cable.id)},{...RS.catalog,...doc.topology.customCatalog},true);if(!result.allowed)throw new Error(result.reason||'Bağlantı geçersiz.');}
  }
  async function commit(type,payload,expected){
    if(!RS.WorkflowViews.canEdit())throw new Error('Gözlem kaydetmek veya planı değiştirmek için Tasarım/Saha görünümüne geçin.');
    const result=RS.ProjectCommands.execute({...expected||RS.ProjectManagement.prepare(),type,payload});
    if(window.is3DMode)window.__STUDIO3D__.loadTopologyFromProject(RS.ProjectDocument.capture(RS.STATE));
    await result.committed;return result;
  }
  async function importRecords(rows,expected){expected||=RS.ProjectManagement.prepare();const doc=RS.ProjectDocument.capture(RS.STATE);if(expected&&(expected.projectId!==doc.projectId||expected.expectedContent!==RS.ProjectCommands.domainKey(doc)))throw new Error('Önizleme sırasında proje değişti; dosyayı yeniden seçin.');for(const row of rows){const old=doc.observations.find(o=>o.id===row.id);if(old&&(old.contentHash!==row.contentHash||stable(old.raw)!==stable(row.raw)))throw new Error('Gözlem kimliği farklı içerikle kullanıldı.');}const fresh=rows.filter(row=>!doc.observations.some(old=>old.id===row.id||(row.contentHash&&old.contentHash===row.contentHash)));if(!fresh.length)return {duplicate:true,count:0};const legacy=await legacyRows(doc);return commit('ImportObservations',{observations:[...legacy,...fresh.filter(row=>!legacy.some(o=>o.id===row.id))]},expected);}
  async function legacyRows(doc){
    const rows=[];
    for(const device of devices(doc)){const raw=device.observed;if(!raw||doc.observations.some(o=>o.entityRef?.id===device.instanceId&&o.observationVersion===1))continue;
      const source={system:'legacy',label:'Eski observed alanı'},contentHash=await hash(stable({deviceId:device.instanceId,raw}));
      rows.push({observationVersion:1,id:'legacy-'+contentHash,contentHash,projectId:doc.projectId,source,raw:structuredClone(raw),normalized:normalize(raw),receivedAt:new Date().toISOString(),...(raw.collectedAt&&Number.isFinite(Date.parse(raw.collectedAt))&&/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(raw.collectedAt)?{collectedAt:raw.collectedAt}:{}),entityRef:{kind:'device',id:device.instanceId},subject:{kind:'device'},mapping:{status:'matched',candidateIds:[device.instanceId],reason:'Eski alan geçmişe taşındı.'}});
      for(const [portId,port]of Object.entries(raw.interfaces||{})){
        const portHash=await hash(stable({contentHash,portId,port})),known=catalog(doc,device.catalogKey)?.ports?.some(p=>p.id===portId),base=rows[rows.length-1];
        rows.push({...structuredClone(base),id:'legacy-port-'+portHash,contentHash:portHash,raw:{portId,...structuredClone(port)},normalized:normalize(port),subject:{kind:'port',portId},entityRef:known?{kind:'device',id:device.instanceId}:undefined,mapping:{status:known?'matched':'unmatched',candidateIds:[device.instanceId],reason:known?'Eski port alanı geçmişe taşındı.':'Eski port kimliği katalogda yok.'}});
      }
    }return rows;
  }
  async function migrate(){const expected=RS.ProjectManagement.prepare();return importRecords(await legacyRows(RS.ProjectDocument.capture(RS.STATE)),expected);}
  async function resolve(id,entityId){
    const expected=RS.ProjectManagement.prepare(),doc=RS.ProjectDocument.capture(RS.STATE),old=doc.observations.find(o=>o.id===id);if(!old||old.mapping?.status==='matched')throw new Error('İnceleme kaydı bulunamadı.');
    const contentHash=await hash(stable({parent:id,entityId}));const row={...structuredClone(old),id:'mapped-'+contentHash,contentHash,parentObservationId:id,receivedAt:new Date().toISOString(),entityRef:{kind:old.subject.kind==='cable'?'cable':'device',id:entityId},mapping:{status:'matched',candidateIds:[entityId],reason:'Kullanıcı eşlemesi; önceki kayıt korunur.'}};
    return importRecords([row],expected);
  }
  RS.FieldObservations=Object.freeze({prepare,hash,history,values,differences,stale,migrate,resolve,importRecords,appendToDocument,applyToDocument,apply:(id,fields,allowStale,expected)=>commit('ApplyObservationDifferences',{observationId:id,fields,allowStale},expected)});
})();
