(function () {
  'use strict';
  const R = window.RackStudio, esc = v => R.ReportOutput.escape(v);
  let dialog, plan = null, busy = false;
  const changedFields = new Set();
  const doc = () => R.ProjectDocument.capture(R.STATE);
  function ensure() {
    if (dialog) return;
    dialog = document.createElement('dialog'); dialog.id = 'engineering-dialog'; dialog.className = 'engineering-dialog'; dialog.setAttribute('aria-label','Mühendislik merkezi');
    dialog.innerHTML = `<header><h2>Mühendislik merkezi</h2><button data-action="close">Kapat</button></header><p>Kaynaklı teknik bilgiler, fiziksel yerleşim doğrulaması ve yerel kalibrasyon ayrı tutulur.</p><p role="status" aria-live="polite"></p><nav><button data-action="refresh">Yeniden denetle</button><button data-action="pin">Kullanılan modelleri sabitle · önizle</button></nav><details open><summary>Katalog kaynağı ve sürümü</summary><div class="engineering-models"></div><label>Projede kullanılan model<select name="model"></select></label><label>Model tanımı JSON<textarea name="model-json" rows="8" spellcheck="false"></textarea></label><p>Yeni sürümü incelemek için tanımı düzenleyin veya JSON dosyası seçin. Global katalog güncellemesi projeye otomatik uygulanmaz.</p><input name="model-file" type="file" accept=".json,application/json"><button data-action="model-preview">Model güncellemesini önizle</button></details><details><summary>Port / modül / güç planı</summary><label>Cihaz<select name="device"></select></label><label>Port ayarları JSON<textarea name="ports-json" rows="8" spellcheck="false"></textarea></label><p>Transceiver: <code>{"transceiver":"SFP-10G-SR"}</code>. PoE talebi: <code>{"poeDemand":{"watts":15,"source":{"kind":"user","title":"Tasarım talebi","reference":"Plan-1","checkedAt":"2026-10-07"}}}</code>. Port kimliğini anahtar olarak kullanın.</p><label>Takılı modüller JSON<textarea name="modules-json" rows="3" spellcheck="false"></textarea></label><label>Güç planı JSON<textarea name="power-json" rows="5" spellcheck="false"></textarea></label><p>Tüketim: <code>consumption: {watts,kind,source}</code>; kind: planned, typical veya nameplate. Besleme: <code>feeds: [{group:"A",pduDeviceId,cableId}]</code>. PSU kapasitesi tüketim olarak sayılmaz.</p><button data-action="device-preview">Port ve güç değişikliğini önizle</button></details><section><h3>Güç ve PoE</h3><div class="engineering-power"></div></section><section><h3>Denetim</h3><div class="engineering-issues"></div></section><section class="engineering-preview" hidden><h3>Değişiklik önizlemesi</h3><p class="engineering-diff"></p><div class="engineering-preview-issues"></div><label><input name="ack" type="checkbox">Yeni belirsizlikleri gördüm; uyumluluk doğrulanmış sayılmaz.</label><button data-action="apply">Önizlenen değişikliği uygula</button><button data-action="cancel">Önizlemeyi iptal et</button></section>`;
    document.body.append(dialog);
    const modelEditor = document.createElement('details'); modelEditor.innerHTML = '<summary>Model sürümünü güncelle veya içe aktar</summary>';
    const modelStart = field('model').closest('label'), modelParent = modelStart.parentElement;
    modelParent.insertBefore(modelEditor,modelStart);
    let modelNode = modelStart;
    while (modelNode) { const next = modelNode.nextSibling; modelEditor.append(modelNode); modelNode = next; }
    const start = field('ports-json').closest('label'), container = start.parentElement, advanced = document.createElement('details'); advanced.innerHTML = '<summary>Gelişmiş: tam port, modül ve besleme verisi</summary>';
    let node = start; while (node && node.dataset?.action !== 'device-preview') { const next = node.nextSibling; advanced.append(node); node = next; }
    container.insertBefore(advanced,node);
    advanced.insertAdjacentHTML('beforeend','<label>Takılı PSU listesi (slotId, model, capacityWatts, source)<textarea name="psus-json" rows="3" spellcheck="false"></textarea></label>');
    advanced.insertAdjacentHTML('beforebegin','<div class="engineering-plan-fields"><label>Port<select name="port"></select></label><label>Takılı transceiver<select name="transceiver"></select></label><label>Planlanan PoE talebi (W; boş = bilinmiyor)<input name="poe-watts" type="number" min="0" step="0.1"></label><label>Cihaz tüketimi (W; boş = bilinmiyor)<input name="power-watts" type="number" min="0" step="0.1"></label><label>Tüketim türü<select name="power-kind"><option value="planned">Planlanan</option><option value="typical">Tipik</option><option value="nameplate">Etiket değeri</option></select></label><label>Talep veri kaynağı<input name="source-title" maxlength="200"></label><label>Plan / ölçüm referansı<input name="source-reference" maxlength="300"></label><label>Kaynak tarihi<input name="source-date" type="date"></label></div>');
    dialog.addEventListener('click', e => { const b = e.target.closest('[data-action]'); if (b) run(() => action(b.dataset.action)); });
    dialog.addEventListener('change', e => {
      if (e.target.name === 'model') fillModel(); if (e.target.name === 'device') fillDevice();
      if (e.target.name === 'port') fillPort();
      if (['transceiver','poe-watts','power-watts','power-kind','source-title','source-reference','source-date'].includes(e.target.name)) changedFields.add(e.target.name);
      if (e.target.name === 'model-file' && e.target.files[0]) run(async () => { const file = e.target.files[0]; if (file.size > 1024 * 1024) throw new Error('Model dosyası 1 MiB sınırını aşıyor.'); field('model-json').value = await file.text(); plan = null; dialog.querySelector('.engineering-preview').hidden = true; });
    });
    dialog.addEventListener('close', () => { plan = null; });
  }
  const field = name => dialog.querySelector('[name="' + name + '"]'), status = text => { dialog.querySelector('[role="status"]').textContent = text; };
  async function run(work) { if (busy) return; busy = true; dialog.setAttribute('aria-busy','true'); try { await work(); } catch(e) { status(e.message); } finally { busy = false; dialog.removeAttribute('aria-busy'); } }
  function issueHTML(issues) { return issues.map(i => `<p class="engineering-issue ${esc(i.status)}" data-issue-id="${esc(i.issueId)}"><strong>${i.status === 'blocked' ? 'İhlal' : 'Bilinmiyor'}</strong> · ${esc(i.affectedEntity.id)} · ${esc(i.text)}<small>${esc((Array.isArray(i.source) ? i.source : [i.source]).filter(Boolean).map(s => s.title + ' · ' + s.checkedAt).join('; ') || 'Kaynak yok')}</small></p>`).join('') || '<p>Kaynaklı denetimde sorun bulunmadı.</p>'; }
  function fillModel() { field('model-json').value = JSON.stringify(R.CatalogSources.map(doc())[field('model').value],null,2); }
  function fillPort() {
    const current = doc(), d = current.topology.racks.flatMap(r => r.devices).find(d => d.instanceId === field('device').value), config = d?.portsConfig?.[field('port').value] || {};
    field('transceiver').value = typeof config.transceiver === 'string' ? config.transceiver : config.transceiver?.model || ''; field('poe-watts').value = config.poeDemand?.watts ?? '';
    const port = R.CatalogSources.map(current)[d?.catalogKey]?.ports?.find(p => p.id === field('port').value);
    field('transceiver').disabled = !!port?.engineering && !port.engineering.cage && !config.transceiver;
    changedFields.delete('transceiver'); changedFields.delete('poe-watts');
  }
  function fillDevice() {
    const current = doc(), d = current.topology.racks.flatMap(r => r.devices).find(d => d.instanceId === field('device').value), model = R.CatalogSources.map(current)[d?.catalogKey];
    field('ports-json').value = JSON.stringify(d?.portsConfig || {},null,2); field('modules-json').value = JSON.stringify(d?.modules || [],null,2); field('power-json').value = JSON.stringify(d?.powerPlan || {},null,2);
    field('psus-json').value = JSON.stringify(d?.psus || [],null,2);
    field('port').innerHTML = (model?.ports || []).map(p => `<option value="${esc(p.id)}">${esc(p.name || p.id)} · ${esc(p.type)}</option>`).join('');
    field('transceiver').innerHTML = '<option value="">Seçilmedi / bilinmiyor</option>' + Object.keys({...R.CatalogSourcePack.transceivers,...current.catalogContext.transceivers}).map(id => `<option value="${esc(id)}">${esc(id)}</option>`).join('');
    field('power-watts').value = d?.powerPlan?.consumption?.watts ?? ''; field('power-kind').value = d?.powerPlan?.consumption?.kind || 'planned';
    const source = d?.powerPlan?.consumption?.source; field('source-title').value = source?.title || ''; field('source-reference').value = source?.reference || ''; field('source-date').value = source?.checkedAt || new Date().toISOString().slice(0,10); changedFields.clear(); fillPort();
  }
  function refresh() {
    const d = doc(), cat = R.CatalogSources.map(d), keys = [...new Set(d.topology.racks.flatMap(r => r.devices.map(x => x.catalogKey)))];
    field('model').innerHTML = keys.map(k => `<option value="${esc(k)}">${esc(cat[k]?.name || k)}</option>`).join('');
    field('device').innerHTML = d.topology.racks.flatMap(r => r.devices).map(x => `<option value="${esc(x.instanceId)}">${esc(x.hostname || x.name || x.instanceId)}</option>`).join('');
    dialog.querySelector('.engineering-models').innerHTML = keys.map(k => { const m = cat[k], p = m.provenance || {}, s = p.source; return `<article><strong>${esc(m.name)}</strong><p>${esc(m.manufacturer || 'Üretici bilinmiyor')} · SKU ${esc(m.sku || 'bilinmiyor')} · ${esc(m.modelVersion || 'sürüm bilinmiyor')} · ${d.catalogContext.models?.[k]?.definition ? 'Projeye sabit' : 'Sabitlenmedi'}</p><p>Teknik: ${esc(p.technicalVerification || 'bilinmiyor')} · Fiziksel: ${esc(p.physicalVerification || 'bilinmiyor')}</p><p>${s?.kind === 'manufacturer' && R.CatalogSources.validSource(s) ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>` : esc(s?.title || 'Kaynak yok')} · ${esc(s?.checkedAt || 'tarih yok')}</p></article>`; }).join('') || '<p>Projeye cihaz ekleyin. Pilot katalog: Cisco C9200L-24P-4G, Aruba JL677A ve Generic panel.</p>';
    const power = R.PowerBudget.build(d);
    keys.forEach((key,index) => {
      const geometry = d.topology.portGeometryOverrides?.[key] || R.getPhysicalPortGeometry?.(key);
      if (geometry?.verification === 'calibrated-local') { const note = document.createElement('p'); note.textContent = 'Yerel port kalibrasyonu var; üretici fiziksel doğrulama seviyesi değişmedi.'; dialog.querySelectorAll('.engineering-models article')[index].append(note); }
    });
    dialog.querySelector('.engineering-power').innerHTML = power.poe.map(p => `<p>${esc(p.deviceId)} · PoE ${p.knownWatts} W bilinen / ${p.capacityWatts ?? 'bilinmiyor'} W · ${p.unknown} belirsiz · ${esc(p.status)}</p>`).join('') + power.groups.map(p => `<p>${esc(p.group)} / ${esc(p.pduDeviceId)} / ${esc(p.kind)}: ${p.knownWatts} W; ${p.unknown} belirsiz · ${esc(p.status)}</p>`).join('') + power.totals.map(t => `<p>${esc(t.kind)}: ${t.knownWatts} W bilinen · ${t.unknown} bilinmeyen tüketim</p>`).join('');
    dialog.querySelector('.engineering-issues').innerHTML = issueHTML(R.EngineeringIssues.collect(d)); fillModel(); fillDevice();
    const extra = power.supplies.map(p => `<p>PSU ${esc(p.deviceId)} / ${esc(p.slotId)} · ${esc(p.model)} · ${p.capacityWatts ?? 'bilinmiyor'} W kapasite · ${esc(p.status)} · ${esc(p.source?.title || 'Kaynak yok')}</p>`).join('') + power.groups.map(p => `<p>PDU ${esc(p.pduDeviceId)} · ${esc(p.group)} · Kapasite ${p.capacityWatts ?? 'bilinmiyor'} W · ${esc(p.source?.title || 'Kaynak yok')}</p>`).join('') + '<small>' + power.notes.map(esc).join('<br>') + '</small>';
    dialog.querySelector('.engineering-power').insertAdjacentHTML('beforeend',extra);
  }
  function showPlan(next) {
    plan = R.EngineeringChanges.preview(next); dialog.querySelector('.engineering-preview').hidden = false; field('ack').checked = false;
    dialog.querySelector('.engineering-diff').textContent = `${plan.diff.added} eklenen · ${plan.diff.removed} kaldırılan · ${plan.diff.changed} değişen kayıt. U, port doluluğu ve tüm bağlantılar uygulama öncesinde tekrar denetlenir.`;
    dialog.querySelector('.engineering-preview-issues').innerHTML = issueHTML(plan.issues); status('Önizleme hazır. Ana proje henüz değişmedi.');
    const details = document.createElement('details'); details.innerHTML = '<summary>Alan farkları: önce / sonra</summary><pre>' + esc(JSON.stringify(plan.diff.changes,null,2)) + '</pre>'; dialog.querySelector('.engineering-preview-issues').append(details);
  }
  async function action(name) {
    if (name === 'close') return dialog.close();
    if (name === 'refresh') { plan = null; dialog.querySelector('.engineering-preview').hidden = true; refresh(); return status('Denetim güncel proje üzerinden yenilendi.'); }
    if (name === 'cancel') { plan = null; dialog.querySelector('.engineering-preview').hidden = true; return; }
    if (name === 'pin') return showPlan(R.CatalogSources.pin(doc()));
    if (name === 'model-preview') return showPlan(R.CatalogSources.preview(doc(),field('model').value,JSON.parse(field('model-json').value)));
    if (name === 'device-preview') {
      const next = R.CatalogSources.pin(doc()), device = next.topology.racks.flatMap(r => r.devices).find(d => d.instanceId === field('device').value);
      if (!device) throw new Error('Cihaz bulunamadı.');
      device.portsConfig = JSON.parse(field('ports-json').value); device.modules = JSON.parse(field('modules-json').value); device.powerPlan = JSON.parse(field('power-json').value);
      device.psus = JSON.parse(field('psus-json').value);
      const source = {kind:'user',title:field('source-title').value.trim(),reference:field('source-reference').value.trim(),checkedAt:field('source-date').value};
      const sourceChanged = [...changedFields].some(x => x.startsWith('source-'));
      if (changedFields.has('transceiver') || changedFields.has('poe-watts') || sourceChanged) {
        const id = field('port').value; if (!id) throw new Error('Port seçin.'); device.portsConfig[id] ||= {};
        if (changedFields.has('transceiver')) { if (field('transceiver').value) device.portsConfig[id].transceiver = { model: field('transceiver').value, quantity: 1 }; else delete device.portsConfig[id].transceiver; }
        if (changedFields.has('poe-watts') || sourceChanged && field('poe-watts').value !== '') {
          if (field('poe-watts').value === '') delete device.portsConfig[id].poeDemand;
          else { if (!R.CatalogSources.validSource(source)) throw new Error('PoE talebinin kaynağını, referansını ve tarihini girin.'); device.portsConfig[id].poeDemand = {watts:Number(field('poe-watts').value),source}; }
        }
      }
      if (changedFields.has('power-watts') || changedFields.has('power-kind') || sourceChanged && field('power-watts').value !== '') {
        if (field('power-watts').value === '') delete device.powerPlan.consumption;
        else { if (!R.CatalogSources.validSource(source)) throw new Error('Tüketim değerinin kaynağını, referansını ve tarihini girin.'); device.powerPlan.consumption = {watts:Number(field('power-watts').value),kind:field('power-kind').value,source}; }
      }
      return showPlan(next);
    }
    if (name === 'apply') { if (!plan) throw new Error('Önce önizleme oluşturun.'); await R.EngineeringChanges.apply(plan,field('ack').checked); plan = null; dialog.querySelector('.engineering-preview').hidden = true; refresh(); status('Değişiklik tek proje komutuyla kaydedildi.'); }
  }
  function open() { ensure(); plan = null; dialog.querySelector('.engineering-preview').hidden = true; refresh(); if (!dialog.open) dialog.showModal(); }
  function previewFix(issue) {
    const current = doc(); if (issue.basis !== R.EngineeringIssues.basis(current)) throw new Error('Denetim eskidi; yeniden denetleyin.');
    const fix = issue.fixCandidates[0]; if (!fix) return;
    open(); showPlan(fix.type === 'pinCatalog' ? R.CatalogSources.pin(current) : R.Scenarios.applyOperations(current,[fix]));
  }
  document.getElementById('btn-engineering-center')?.addEventListener('click',open);
  R.EngineeringUI = Object.freeze({open,previewFix,issueHTML});
})();
