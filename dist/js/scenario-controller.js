(function () {
  'use strict';
  const R = window.RackStudio, esc = v => R.ReportOutput.escape(v);
  let dialog, branches = [], named = [], busy = false, epoch = 0;
  const field = name => dialog.querySelector('[name="' + name + '"]'), doc = () => R.ProjectDocument.capture(R.STATE);
  function ensure() {
    if (dialog) return;
    dialog = document.createElement('dialog'); dialog.id = 'scenario-dialog'; dialog.className = 'engineering-dialog'; dialog.setAttribute('aria-label','Senaryo karşılaştırması');
    dialog.innerHTML = `<header><h2>What-if · iki alternatif</h2><button data-action="close">Kapat</button></header><p>Ana proje uygulayana kadar korunur. U / port / malzeme / metraj ve belgelenmiş pasif fiziksel yol farkları karşılaştırılır.</p><p role="status" aria-live="polite"></p><label>Taban revizyon<select name="baseline"></select></label><button data-action="create">İki alternatif oluştur</button><label>Kaydedilmiş senaryo<select name="saved"></select></label><button data-action="load">Seçili alternatife yükle</button><label>Çalışılan alternatif<select name="branch"><option value="0">A</option><option value="1">B</option></select></label><div class="scenario-controls"><label>İşlem<select name="operation"><option value="removeCable">Kablo kaldır</option><option value="moveDevice">Cihaz taşı</option><option value="replaceSwitch">Switch değiştir</option></select></label><label>Cihaz veya kablo<select name="entity"></select></label><label>Hedef kabin<select name="rack"></select></label><label>Üst U<input name="topU" type="number" min="1" max="60" value="1"></label><label>Yeni switch modeli<select name="model"></select></label><label>Açık port eşleme JSON<textarea name="mapping" rows="3" placeholder='{"p1":"p1"}'>{}</textarea></label></div><button data-action="add">Alternatife ekle ve karşılaştır</button><button data-action="reset">Alternatifi sıfırla</button><label>Senaryo adı<input name="name" maxlength="160" value="Alternatif"></label><button data-action="save">Adlandırılmış senaryo kaydet</button><div class="scenario-comparison"></div><label><input name="ack" type="checkbox">Yeni belirsizlikleri gördüm; canlı servis etkisi doğrulanmadı.</label><button data-action="apply">Seçili alternatifi ana projeye uygula</button>`;
    const setup = document.createElement('div'); setup.className = 'scenario-setup';
    for (const [name,action,title] of [['baseline','create','1 · Karşılaştırma tabanı'],['saved','load','Kaydedilmiş alternatif']]) {
      const section = document.createElement('section'), heading = document.createElement('h3'); heading.textContent = title;
      section.append(heading,field(name).closest('label'),dialog.querySelector('[data-action="' + action + '"]')); setup.append(section);
    }
    dialog.querySelector('[name="branch"]').closest('label').before(setup);
    const footer = document.createElement('div'); footer.className = 'scenario-footer';
    field('name').closest('label').before(footer); footer.append(field('name').closest('label'),dialog.querySelector('[data-action="save"]'));
    document.body.append(dialog); dialog.addEventListener('click',e => { const b = e.target.closest('[data-action]'); if (b) run(() => action(b.dataset.action)); });
    dialog.addEventListener('change',e => { if (e.target.name === 'operation') entities(); }); dialog.addEventListener('close',() => { epoch++; branches = []; });
  }
  const status = text => { dialog.querySelector('[role="status"]').textContent = text; };
  async function run(work) { if (busy) return; busy = true; dialog.setAttribute('aria-busy','true'); try { await work(); } catch(e) { status(e.message); } finally { busy = false; dialog.removeAttribute('aria-busy'); } }
  function entities() { const d = doc(), operation = field('operation').value, rows = operation === 'removeCable' ? d.topology.cables.map(c => [c.id,c.name || c.id]) : d.topology.racks.flatMap(r => r.devices).map(x => [x.instanceId,x.hostname || x.name || x.instanceId]); field('entity').innerHTML = rows.map(([id,name]) => `<option value="${esc(id)}">${esc(name)}</option>`).join('');
    for (const name of ['rack','topU']) field(name).closest('label').hidden = operation !== 'moveDevice';
    for (const name of ['model','mapping']) field(name).closest('label').hidden = operation !== 'replaceSwitch';
  }
  async function sources() {
    const token = epoch, current = doc(); named = await R.ProjectRevisions.list(current.projectId); if (token !== epoch || current.projectId !== doc().projectId) throw new Error('Proje değişti; senaryoyu yeniden açın.');
    field('baseline').innerHTML = '<option value="">Güncel proje</option>' + named.filter(x => !x.scenario).map(x => `<option value="${esc(x.id)}">${esc(x.name)} · r${x.document.revision}</option>`).join('');
    field('saved').innerHTML = named.filter(x => x.scenario).map(x => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('');
    field('rack').innerHTML = current.topology.racks.map(r => `<option value="${esc(r.id)}">${esc(r.name)}</option>`).join('');
    field('model').innerHTML = Object.entries(R.CatalogSources.map(current)).filter(([,m]) => m.category === 'switch').map(([key,m]) => `<option value="${esc(key)}">${esc(m.name)}</option>`).join(''); entities();
  }
  async function render() {
    const token = epoch, analyses = await Promise.all(branches.map(b => R.Scenarios.analyze(b))); if (token !== epoch) return;
    dialog.querySelector('.scenario-comparison').innerHTML = analyses.map((a,index) => `<section><h3>Alternatif ${index ? 'B' : 'A'}</h3><p>${branches[index].operations.length} işlem · Taban r${branches[index].baseDocument.revision}</p><p>U: ${a.baseline.occupiedU} → ${a.candidate.occupiedU} · Port: ${a.baseline.ports} → ${a.candidate.ports}</p><p>Malzeme satırları: ${a.bomBefore.rows.length} → ${a.bomAfter.rows.length} · Bilinen tahmin: ${a.bomBefore.totals.estimated.meters} → ${a.bomAfter.totals.estimated.meters} m · Bilinmeyen: ${a.bomBefore.totals.estimated.unknown} → ${a.bomAfter.totals.estimated.unknown}</p><p>${a.diff.added} eklenen · ${a.diff.removed} kaldırılan · ${a.diff.changed} değişen kayıt</p><details><summary>İşlemler ve malzeme farkı</summary><pre>${esc(JSON.stringify({operations:branches[index].operations,before:a.bomBefore.rows,after:a.bomAfter.rows},null,2))}</pre></details><p>${a.impact.paths.length} fiziksel yol farkı. ${esc(a.impact.scope)}</p><details><summary>Fiziksel yol kanıtı</summary><pre>${esc(JSON.stringify(a.impact.paths,null,2))}</pre></details>${R.EngineeringUI.issueHTML(a.issues)}</section>`).join('');
  }
  async function action(name) {
    if (name === 'close') return dialog.close();
    const index = Number(field('branch').value);
    if (name === 'create') { const base = named.find(x => x.id === field('baseline').value), input = base?.document || doc(); branches = [R.Scenarios.create(input,{kind:base ? 'named':'current',id:base?.id || null}),R.Scenarios.create(input,{kind:base ? 'named':'current',id:base?.id || null})]; field('ack').checked = false; await render(); return status('Alternatifler hazır; ana proje değişmedi.'); }
    if (name === 'load') { const row = named.find(x => x.id === field('saved').value); if (!row?.scenario) throw new Error('Kaydedilmiş senaryo seçin.'); if (branches.length !== 2) throw new Error('Önce iki alternatif oluşturun.'); branches[index] = structuredClone(row.scenario); await render(); return status('Kaydedilmiş alternatif yüklendi. Eski taban uygulama sırasında reddedilir.'); }
    if (!branches[index]) throw new Error('Önce iki alternatif oluşturun.');
    if (name === 'add') {
      const op = {type:field('operation').value,id:field('entity').value};
      if (op.type === 'moveDevice') Object.assign(op,{rackId:field('rack').value,topU:Number(field('topU').value)});
      if (op.type === 'replaceSwitch') Object.assign(op,{modelKey:field('model').value,portMapping:JSON.parse(field('mapping').value)});
      const next = {...branches[index],operations:[...branches[index].operations,op]}; R.Scenarios.applyOperations(next.baseDocument,next.operations); branches[index] = next; field('ack').checked = false; await render(); return status('Alternatif güncellendi; ana proje korunuyor.');
    }
    if (name === 'reset') { branches[index].operations = []; await render(); return; }
    if (name === 'save') { await R.Scenarios.save(branches[index],field('name').value); await sources(); return status('Senaryo adlandırılmış revizyon olarak kaydedildi.'); }
    if (name === 'apply') { await R.Scenarios.apply(branches[index],field('ack').checked); await render(); return status('Seçili alternatif tek komutla uygulandı. Bu tabandan sonraki uygulamalar için yeni alternatif oluşturun.'); }
  }
  async function open() { ensure(); epoch++; branches = []; dialog.querySelector('.scenario-comparison').replaceChildren(); if (!dialog.open) dialog.showModal(); await run(sources); }
  document.getElementById('btn-scenario-center')?.addEventListener('click',open); R.ScenarioUI = Object.freeze({open});
})();
