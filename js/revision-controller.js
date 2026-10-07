(function () {
  'use strict';
  const RS = window.RackStudio;
  const names = { project:'Proje',rack:'Kabin',device:'Cihaz',port:'Port',cable:'Kablo',locations:'Konum',observations:'Gözlem',fieldEvents:'Saha olayı',evidenceRefs:'Ek',handoverRecords:'Teslim',integrationMappings:'Entegrasyon',settings:'Ayar',catalog:'Katalog',extensions:'Uzantı' };
  const states = { added:'Eklendi',removed:'Silindi',changed:'Değişti' };
  const tags = { draft:'Taslak',approved:'Onaylı',delivered:'Teslim' };
  const node = (tag,text,cls) => { const el = document.createElement(tag); if (text) el.textContent = text; if (cls) el.className = cls; return el; };
  const button = (text,action) => { const el = node('button',text); el.type='button'; el.addEventListener('click',action); return el; };
  function field(label, type = 'input') {
    const wrap = node('label',label), input = node(type); input.setAttribute('aria-label',label); wrap.append(input); return { wrap,input };
  }
  const value = data => data === undefined ? '—' : typeof data === 'string' ? data || '(boş)' : JSON.stringify(data);
  async function open() {
    if (document.querySelector('.revision-manager')) return;
    const opener = document.activeElement, dialog = node('dialog','','revision-manager');
    const title = node('h2','Proje revizyonları'); title.id='revision-manager-title'; dialog.setAttribute('aria-labelledby',title.id);
    const header = node('header'); header.append(title,button('Kapat',() => dialog.close())); dialog.append(header);
    const status = node('p'); status.setAttribute('role','status'); dialog.append(status);
    const form = node('section','','rv-form'), label = field('Revizyon adı'), description = field('Açıklama','textarea'), tag = field('Revizyon etiketi','select'), baseline = field('Karşılaştırma temeli');
    label.input.maxLength=160; description.input.maxLength=2000; baseline.input.type='checkbox';
    for (const [id,text] of [['draft','Taslak'],['approved','Onaylı'],['delivered','Teslim']]) { const option=node('option',text); option.value=id; tag.input.append(option); }
    form.append(label.wrap,description.wrap,tag.wrap,baseline.wrap); dialog.append(form);
    const controls=node('div','','rv-controls'), list=node('section','','rv-list'), diff=node('section','','rv-diff'); dialog.append(controls,list,diff);
    let busy=false, projectId, revisions=[], chosen=null, comparisonExpected;
    const run = action => async () => {
      if (busy) return; busy=true; dialog.setAttribute('aria-busy','true'); status.textContent='İşlem sürüyor…'; status.dataset.error='false';
      try { await action(); }
      catch (error) { status.textContent=error.message; status.dataset.error='true'; }
      finally { busy=false; dialog.removeAttribute('aria-busy'); }
    };
    const ensureProject = () => { if (RS.STATE.projectDocument.projectId !== projectId) throw new Error('Açık proje değişti; revizyon ekranını yeniden açın.'); };
    form.append(button('Revizyon kaydet',run(async () => {
      ensureProject(); const saved=await RS.ProjectRevisions.create({ name:label.input.value, description:description.input.value, tag:tag.input.value, baseline:baseline.input.checked });
      label.input.value=''; description.input.value=''; baseline.input.checked=false; await refresh(saved.id); status.textContent='Revizyon dayanıklı kayda alındı.';
    })));
    controls.append(button('Güncel belgeyle karşılaştır',run(async () => { ensureProject(); right.input.value=''; await showDiff(); })));
    controls.append(button('Seçili revizyonu geri yükle',run(async () => {
      ensureProject(); if (!chosen || !comparisonExpected) throw new Error('Önce revizyon seçip farkları inceleyin.');
      await RS.ProjectRevisions.restore(chosen,comparisonExpected); await showDiff(); status.textContent='Revizyon geri yüklendi. Editörde Geri ile geri alabilirsiniz.';
    })));
    const left = field('Temel revizyon','select'), right = field('Hedef revizyon','select'); controls.append(left.wrap,right.wrap);
    left.input.addEventListener('change',run(async () => { chosen=left.input.value; await showDiff(); }));
    right.input.addEventListener('change',run(showDiff));
    async function showDiff() {
      ensureProject(); diff.replaceChildren(); comparisonExpected=RS.ProjectManagement.prepare();
      if (!chosen) { diff.append(node('p','Henüz adlandırılmış revizyon yok.')); return; }
      const before=await RS.ProjectRevisions.get(projectId,chosen), after=right.input.value ? (await RS.ProjectRevisions.get(projectId,right.input.value)).document : RS.ProjectDocument.capture(RS.STATE);
      const result=RS.ProjectDiff.compare(before.document,after);
      diff.append(node('h3',`${before.name} → ${right.input.value ? revisions.find(r=>r.id===right.input.value)?.name : 'Açık çalışma'}`));
      diff.append(node('p',`${result.added} eklendi · ${result.changed} değişti · ${result.removed} silindi`));
      if (!result.changes.length) diff.append(node('p','Anlamlı içerik farkı yok.'));
      for (const change of result.changes) {
        const row=node('details','','rv-change'); row.dataset.kind=change.kind; row.dataset.entityId=change.id;
        const summary=node('summary',`${states[change.status]} · ${names[change.kind]} · ${change.label || change.after?.name || change.after?.hostname || change.before?.name || change.id}`); row.append(summary);
        const table=node('table'), head=node('tr'); for (const text of ['Alan','Önce','Sonra']) head.append(node('th',text)); table.append(head);
        for (const delta of change.fields) { const tr=node('tr'); tr.append(node('th',delta.path),node('td',value(delta.before)),node('td',value(delta.after))); table.append(tr); }
        row.append(table);
        const exists = !right.input.value && change.status !== 'removed' && change.rackId;
        if (exists) row.append(button('Editörde göster',run(async () => {
          ensureProject(); if (window.is3DMode) await RS.setStudioMode(false);
          if (window.is3DMode) throw new Error('3D değişiklikleri aktarılamadı.');
          const rack=RS.STATE.racks.find(r=>r.id===change.rackId);
          if (!rack || (change.deviceId && !rack.devices.some(d=>d.instanceId===change.deviceId))) throw new Error('Nesne artık mevcut değil; karşılaştırmayı yenileyin.');
          RS.switchActiveRack(rack.id); dialog.close();
          requestAnimationFrame(() => { if (change.deviceId) RS.focusOnDevice?.(change.deviceId); else RS.focusOnRack?.(rack.id); });
        })));
        else row.append(node('p',change.status==='removed' ? 'Silinen nesnenin bilgileri bu fark kaydında gösterilir.' : 'Nesnenin alanlarını bu kayıtta inceleyebilirsiniz.'));
        diff.append(row);
      }
      status.textContent='Karşılaştırma güncellendi.';
    }
    async function refresh(id) {
      ensureProject(); revisions=await RS.ProjectRevisions.list(projectId); chosen=id || chosen || revisions.find(r=>r.baseline)?.id || revisions[0]?.id;
      list.replaceChildren(node('h3','Kaydedilmiş revizyonlar')); left.input.replaceChildren(); right.input.replaceChildren();
      const current=node('option','Açık çalışma'); current.value=''; right.input.append(current);
      for (const revision of revisions) {
        const row=node('article','','rv-card'); row.append(node('strong',revision.name),node('p',`${tags[revision.tag]} · r${revision.document.revision} · ${new Date(revision.createdAt).toLocaleString('tr-TR')}${revision.baseline ? ' · karşılaştırma temeli' : ''}`),node('p',revision.description));
        if (revision.source?.kind==='legacySnapshot') row.append(node('p','Kaynak: eski yerel snapshot'));
        row.append(button('Karşılaştır',run(async () => { chosen=revision.id; left.input.value=chosen; await showDiff(); }))); list.append(row);
        for (const input of [left.input,right.input]) { const option=node('option',revision.name); option.value=revision.id; input.append(option); }
      }
      left.input.value=chosen || ''; await showDiff();
    }
    const legacy=node('details','','rv-legacy'); legacy.append(node('summary','Eski snapshotları içe al')); dialog.append(legacy);
    document.body.append(dialog); dialog.addEventListener('close',() => { dialog.remove(); opener?.focus(); }); dialog.showModal();
    await run(async () => {
      RS.ProjectManagement.prepare(); projectId=RS.STATE.projectDocument.projectId; await refresh();
      try {
        RS.ProjectRevisions.legacySnapshots().forEach((old,index) => {
          const row=node('div'); row.append(node('span',old.label || 'Adsız snapshot'),button('Bu snapshotı içe al',run(async () => { ensureProject(); const saved=await RS.ProjectRevisions.importLegacy(index); await refresh(saved.id); status.textContent='Eski kaynak korunarak revizyon içe alındı.'; }))); legacy.append(row);
        });
      } catch (error) { legacy.append(node('p',error.message)); }
    })();
  }
  RS.RevisionController = Object.freeze({ open });
})();
