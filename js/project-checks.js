/* Read-only project checks with direct navigation to affected objects. */
(() => {
  'use strict';
  const RS = window.RackStudio;
  if (!RS) return;
  let dialog;

  function collect() {
    const state = RS.STATE;
    const catalog = RS.HARDWARE_CATALOG || RS.catalog || {};
    const issues = [];
    const hostnames = new Map();
    const serials = new Map();
    const devices = new Map();
    const add = (severity, text, target, code) => issues.push({ severity, text, target,code });
    for (const rack of state.racks || []) {
      for (const device of rack.devices || []) {
        devices.set(device.instanceId, { device, rack });
        for (const [value, registry, label] of [[device.hostname, hostnames, 'Cihaz adı'], [device.serialNumber, serials, 'Seri numarası']]) {
          const key = String(value || '').trim().toLocaleLowerCase('tr');
          if (!key) continue;
          if (registry.has(key)) add('warning', `${label} tekrar ediyor: ${value}`, { deviceId: device.instanceId },'duplicate-' + label);
          else registry.set(key, device.instanceId);
        }
        const observed = device.observed;
        if (observed && !RS.FieldObservations) {
          for (const [key, label] of [['hostname', 'Ad'], ['ipAddress', 'IP'], ['catalogKey', 'Model']]) {
            if (observed[key] && observed[key] !== device[key]) add('difference', `${label} farklı: ${device[key] || '—'} → ${observed[key]}`, { deviceId: device.instanceId },'legacy-observed-' + key);
          }
        }
        const geometry = catalog[device.catalogKey]?.portGeometry;
        if (geometry && geometry.verification !== 'verified') add('info', `${device.hostname || device.name || device.catalogKey}: port yerleşimi ${geometry.verification === 'calibrated-local' ? 'yerel kalibrasyon' : 'yaklaşık'}`, { deviceId: device.instanceId },'geometry');
      }
    }
    for (const cable of state.cables || []) {
      const from = devices.get(cable.from?.instanceId);
      const to = devices.get(cable.to?.instanceId);
      if (!from || !to) {
        add('error', `${cable.name || cable.id}: uç cihaz bulunamadı`, { cableId: cable.id },'missing-device');
        continue;
      }
      const sourcePort = catalog[from.device.catalogKey]?.ports?.find(port => port.id === cable.from.portId);
      const targetPort = catalog[to.device.catalogKey]?.ports?.find(port => port.id === cable.to.portId);
      if (!sourcePort || !targetPort) add('error', `${cable.name || cable.id}: port katalogda bulunamadı`, { cableId: cable.id },'missing-port');
      else {
        const result = RS.NetworkRules?.validateConnection?.(cable.from, cable.to, { ...state, strictCompliance: true }, catalog, true);
        if (result && !result.allowed) add('error', `${cable.name || cable.id}: ${result.reason}`, { cableId: cable.id },'network-rule');
      }
      if (!cable.medium) add('info', `${cable.name || cable.id}: kablo ortamı belirtilmedi`, { cableId: cable.id },'missing-medium');
      if (!cable.role) add('info', `${cable.name || cable.id}: kablo rolü belirtilmedi`, { cableId: cable.id },'missing-role');
    }
    if(RS.FieldObservations){
      const doc=RS.ProjectDocument.capture(state),seen=new Set(),O=RS.FieldObservations,resolved=new Set(doc.observations.filter(o=>o.mapping?.status==='matched').map(o=>o.parentObservationId));
      for(const row of O.history(doc)){
        const target={deviceId:row.entityRef?.kind==='device'?row.entityRef.id:undefined,cableId:row.entityRef?.kind==='cable'?row.entityRef.id:undefined,observationId:row.id};
        if(row.mapping&&row.mapping.status!=='matched'){if(!resolved.has(row.id))add('warning','Gözlem eşlemesi incelenmeli: '+row.mapping.reason,target,'observation-mapping');continue;}
        const diff=O.differences(row,doc);
        for(const key of Object.keys(O.values(row))){
          const prefix=row.entityRef?.kind==='cable'?'cable':['interfaceName','description','vlan','status'].includes(key)?'port':'device';
          const field=prefix+'.'+key,identity=[row.entityRef?.id,prefix==='port'?row.subject?.portId||'':'',field].join(':');if(seen.has(identity))continue;seen.add(identity);
          const item=diff.find(d=>d.field===field);if(item)add(item.canApply?'difference':'info',`${field} farklı: ${JSON.stringify(item.planned)} → ${JSON.stringify(item.observed)}`,target,'observation-diff-' + identity);
        }
        if(O.stale(row,doc))add('info','Eski tarihli gözlem: '+row.collectedAt,target,'observation-stale');
      }
    }
    const doc = RS.ProjectDocument.capture(state), basis = RS.ProjectCommands.domainKey(doc);
    const common = issues.map(issue => ({ ...issue, issueId:'legacy:' + JSON.stringify([issue.code,issue.target]), affectedEntity:{kind:issue.target.cableId ? 'cable':'device',id:issue.target.cableId || issue.target.deviceId || issue.target.observationId},source:null,fixCandidates:[],basis }));
    return [...common,...(RS.EngineeringIssues?.collect(doc) || [])];
  }

  function ensure() {
    if (dialog) return;
    dialog = document.createElement('dialog');
    dialog.id = 'project-checks-dialog';
    dialog.className = 'project-checks-dialog';
    dialog.setAttribute('aria-label', 'Proje denetimi');
    dialog.innerHTML = `<div class="project-checks-head"><h2>Proje denetimi</h2><button type="button" data-check-action="close">Kapat</button></div><div class="project-checks-controls"><label>Önem<select name="severity"><option value="">Tümü</option><option value="error">Hata</option><option value="unknown">Bilinmiyor</option><option value="warning">Uyarı</option><option value="difference">Gözlem farkı</option><option value="info">Bilgi</option></select></label><button data-check-action="recheck">Yeniden denetle</button></div><p id="project-checks-summary" role="status"></p><div class="project-checks-list"></div>`;
    document.body.append(dialog);
    dialog.addEventListener('click', event => {
      event.stopPropagation();
      if (event.target.closest('[data-check-action="close"]')) dialog.close();
      if (event.target.closest('[data-check-action="recheck"]')) render();
    });
    dialog.querySelector('[name="severity"]').addEventListener('change',render);
    document.addEventListener('rackstudio:change',() => { if (dialog.open) { dialog.querySelector('#project-checks-summary').textContent = 'Proje değişti; sonuçlar eski. Yeniden denetleyin.'; dialog.querySelectorAll('[data-fix]').forEach(b => { b.disabled = true; }); } });
    document.addEventListener('rackstudio:catalog-source-change',() => { if (dialog.open) { dialog.querySelector('#project-checks-summary').textContent = 'Katalog kaynağı değişti; yeniden denetleyin.'; dialog.querySelectorAll('[data-fix]').forEach(b => { b.disabled = true; }); } });
  }

  function render() {
    const issues = collect();
    const list = dialog.querySelector('.project-checks-list');
    list.replaceChildren();
    const counts = ['error', 'warning', 'difference', 'info'].map(type => issues.filter(issue => issue.severity === type).length);
    dialog.querySelector('#project-checks-summary').textContent = `${counts[0]} hata · ${counts[1]} uyarı · ${counts[2]} gözlem farkı · ${counts[3]} bilgi · ${issues.filter(i => i.severity === 'unknown').length} bilinmiyor`;
    if (!issues.length) list.textContent = 'Denetimde sorun bulunmadı.';
    const filter = dialog.querySelector('[name="severity"]').value, selected = issues.filter(i => !filter || i.severity === filter);
    if (selected.length > 300) dialog.querySelector('#project-checks-summary').textContent += ' · İlk 300 sonuç gösteriliyor';
    for (const issue of selected.slice(0, 300)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `project-check-item ${issue.severity}`;
      button.dataset.issueId = issue.issueId;
      const severity = document.createElement('strong'), text = document.createElement('span');
      severity.textContent = issue.severity === 'error' ? 'Hata' : issue.severity === 'unknown' ? 'Bilinmiyor' : issue.severity === 'warning' ? 'Uyarı' : issue.severity === 'difference' ? 'Gözlem farkı' : 'Bilgi';
      text.textContent = issue.text; button.append(severity,text);
      button.addEventListener('click', () => {
        dialog.close();
        if(issue.target.observationId){RS.FieldObservationUI?.open(undefined,issue.target.observationId);return;}
        if (issue.target.cableId) {
          RS.highlightCable?.(issue.target.cableId, true);
          if (window.is3DMode) window.__STUDIO3D__?.focusCable?.(issue.target.cableId);
          else RS.focusOnCable?.(issue.target.cableId);
        } else if (issue.target.deviceId) {
          if (window.is3DMode) window.__STUDIO3D__?.focusDevice?.(issue.target.deviceId);
          else RS.focusOnDevice?.(issue.target.deviceId);
        }
      });
      list.append(button);
      if (issue.fixCandidates?.length) {
        const fix = document.createElement('button'); fix.type = 'button'; fix.dataset.fix = issue.issueId; fix.textContent = issue.fixCandidates[0].label + ' · önizle';
        fix.addEventListener('click',() => { try { RS.EngineeringUI.previewFix(issue); dialog.close(); } catch(e) { dialog.querySelector('#project-checks-summary').textContent = e.message; } }); list.append(fix);
      }
    }
  }
  function open() { ensure(); render(); if (!dialog.open) dialog.showModal(); }

  document.getElementById('btn-project-checks')?.addEventListener('click', open);
  RS.ProjectChecks = { collect, open };
})();
