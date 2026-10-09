(function () {
  'use strict';
  const RS = window.RackStudio, kinds = ['site','building','floor','room'];
  const labels = { site: 'Saha', building: 'Bina', floor: 'Kat', room: 'Oda' };
  const node = (tag, text, className) => { const el = document.createElement(tag); if (text) el.textContent = text; if (className) el.className = className; return el; };
  const button = (text, action) => { const el = node('button', text); el.type = 'button'; el.addEventListener('click', action); return el; };
  function field(label, value = '', type = 'text') {
    const wrap = node('label', label), input = node('input'); input.type = type; input.value = value; input.setAttribute('aria-label',label); wrap.append(input); return { wrap, input };
  }
  function select(label, values, value) {
    const wrap = node('label', label), input = node('select');
    input.setAttribute('aria-label',label);
    for (const [key, text] of values) { const option = node('option', text); option.value = key; input.append(option); }
    input.value = value; wrap.append(input); return { wrap, input };
  }
  async function open() {
    if (document.querySelector('.project-manager')) { document.querySelector('.project-manager').focus(); return; }
    const opener = document.activeElement;
    const dialog = node('dialog', '', 'project-manager');
    const heading = node('h2', 'Yerel proje kayıtları'); heading.id = 'project-manager-title';
    dialog.setAttribute('aria-labelledby', heading.id);
    const header = node('div', '', 'pm-header'); header.append(heading, button('Kapat', () => dialog.close())); dialog.append(header);
    const status = node('p', '', 'pm-status'); status.setAttribute('role','status'); dialog.append(status);
    const layout = node('div', '', 'pm-layout'), sidebar = node('section', '', 'pm-section'), detail = node('div'); layout.append(sidebar, detail); dialog.append(layout);
    const search = field('Proje ara'), list = node('div'); sidebar.append(search.wrap);
    const createName = field('Yeni proje adı'), createCustomer = field('Yeni proje müşterisi'); sidebar.append(createName.wrap, createCustomer.wrap);
    let busy = false, projects = [], doc, expected, locations, links, readDraft = () => null, formBaseline = '';
    const run = (action, switching = false) => async () => {
      if (switching && formBaseline && JSON.stringify(readDraft()) !== formBaseline) {
        status.dataset.error = 'true'; status.textContent = 'Kaydedilmemiş proje bilgileri var. Önce bilgileri kaydedin veya formu bırakıp güncel bilgileri yükleyin.'; return;
      }
      if (busy) return; busy = true; status.dataset.error = 'false'; status.textContent = 'İşlem sürüyor…';
      dialog.setAttribute('aria-busy', 'true');
      try { await action(); if (dialog.open) status.textContent = 'İşlem tamamlandı'; }
      catch (error) { status.dataset.error = 'true'; status.textContent = error.message; }
      finally { busy = false; dialog.removeAttribute('aria-busy'); }
    };
    header.append(button('Formu bırak, güncel bilgileri yükle',run(refresh)));
    sidebar.append(button('Yeni proje oluştur', run(async () => { await RS.ProjectManagement.create(createName.input.value, createCustomer.input.value); createName.input.value = ''; await refresh(); },true)), list);
    function renderProjects() {
      list.replaceChildren();
      const query = search.input.value.toLocaleLowerCase('tr');
      for (const project of projects.filter(item => [item.name,item.customer,item.status].join(' ').toLocaleLowerCase('tr').includes(query))) {
        const row = node('section', '', 'pm-card'); row.dataset.projectId = project.projectId;
        row.append(node('p', project.name), node('p', `${project.customer || 'Müşteri belirtilmedi'} · revizyon ${project.revision}${project.archived ? ' · arşiv' : ''}${project.projectId === RS.STATE.projectDocument.projectId ? ' · açık proje' : ''}`));
        const actions = node('div', '', 'pm-actions');
        actions.append(button('Aç', run(async () => { await RS.openStoredProject(project.projectId); dialog.close(); },true)));
        actions.append(button('Taslağı sakla, bu kaydı aç', run(async () => { await RS.openStoredProject(project.projectId, { preserveDraft: true }); dialog.close(); },true)));
        actions.append(button('Çoğalt', run(async () => { await RS.ProjectManagement.duplicate(project.projectId); await refresh(); },true)));
        const archive = button(project.archived ? 'Arşivden çıkar' : 'Arşivle', run(async () => { await RS.ProjectRepository.archive(project.projectId, !project.archived); await refresh(); }));
        if (!project.archived && project.projectId === RS.STATE.projectDocument.projectId) { archive.disabled = true; archive.title = 'Açık projeyi arşivlemek için önce başka projeyi açın.'; }
        actions.append(archive); row.append(actions); list.append(row);
        actions.append(button('Bakım: son 100 kaydı koru',run(async()=>{const result=await RS.ProjectLifecycle.maintain(project.projectId);status.textContent=`${result.revisions} eski kayıt, ${result.evidence} referanssız ek temizlendi.`;})));
        if(project.archived){const confirmation=field('Kalıcı silme için proje adı');actions.append(confirmation.wrap,button('Kalıcı sil',run(async()=>{await RS.ProjectLifecycle.remove(project.projectId,confirmation.input.value);await refresh();status.textContent='Yerel arşiv silindi. Sunucu ve dış yedekler ayrı kalır.';})));}
      }
      if (!list.children.length) list.append(node('p','Eşleşen proje yok.'));
    }
    search.input.addEventListener('input', renderProjects);
    function renderDetails() {
      detail.replaceChildren();
      const metadata = node('section', '', 'pm-section'); metadata.append(node('h3','Açık proje bilgileri'));
      const fields = node('div', '', 'pm-fields');
      const name = field('Proje adı', doc.metadata.name || ''), customer = field('Müşteri', doc.metadata.customer || ''), owner = field('Sorumlu', doc.metadata.owner || ''), target = field('Hedef tarih',doc.metadata.targetDate || '','date');
      const statuses = [['draft','Taslak'],['design','Tasarım'],['field','Sahada'],['review','İnceleme'],['approved','Onaylı'],['delivered','Teslim edildi']];
      if (doc.metadata.status && !statuses.some(([key]) => key === doc.metadata.status)) statuses.push([doc.metadata.status,doc.metadata.status]);
      const state = select('Proje durumu', statuses, doc.metadata.status || 'draft');
      readDraft = () => ({ metadata: { ...doc.metadata, name: name.input.value.trim(), customer: customer.input.value.trim(), owner: owner.input.value.trim(), status: state.input.value, targetDate: target.input.value }, locations, links });
      fields.append(name.wrap,customer.wrap,owner.wrap,state.wrap,target.wrap); metadata.append(fields);
      metadata.append(node('p', `Oluşturulma: ${doc.metadata.createdAt || 'Belirtilmedi'} · Son güncelleme: ${doc.metadata.updatedAt || 'Belirtilmedi'}`, 'pm-dates'));
      const hierarchy = node('section', '', 'pm-section'); hierarchy.append(node('h3','Saha / bina / kat / oda'));
      const rows = node('div'); hierarchy.append(rows);
      const bindings = node('div'), tree = node('div','','pm-tree');
      function renderBindings() {
        bindings.replaceChildren();
        for (const rack of doc.topology.racks) {
          const selected = links.find(link => link.rackId === rack.id), choices = [['','Konum atanmadı'], ...locations.filter(location => location.kind === 'room').map(location => [location.id,location.name || 'Adsız oda'])];
          if (selected.locationId && !choices.some(([id]) => id === selected.locationId)) choices.push([selected.locationId,'Geçersiz / eksik oda']);
          const choice = select(rack.name + ' — oda',choices,selected.locationId || '');
          choice.input.addEventListener('change', () => { selected.locationId = choice.input.value || null; renderTree(); }); bindings.append(choice.wrap);
        }
      }
      function renderTree() {
        tree.replaceChildren(node('h3','Kabin ağacı'));
        const appendRack = (target, rack) => target.append(button(rack.name, run(async () => {
          if (RS.STATE.projectDocument.projectId !== doc.projectId) throw new Error('Açık proje değişti; proje ekranını yeniden açın.');
          if (window.is3DMode) await RS.setStudioMode(false);
          if (window.is3DMode) throw new Error('3D değişiklikleri aktarılamadı.');
          RS.switchActiveRack(rack.id); dialog.close();
        },true)));
        function branch(parentId, target, seen = new Set()) {
          for (const location of locations.filter(row => (row.parentId || null) === parentId)) {
            if (seen.has(location.id)) continue;
            const item = node('li', `${labels[location.kind] || 'Konum'}: ${location.name || 'Adsız'}`), nested = node('ul');
            item.append(nested); target.append(item); branch(location.id,nested,new Set([...seen,location.id]));
            for (const rack of doc.topology.racks.filter(r => links.find(link => link.rackId === r.id).locationId === location.id)) appendRack(nested,rack);
          }
        }
        const root = node('ul'); tree.append(root); branch(null,root);
        const unassigned = node('section'); unassigned.append(node('p','Konum atanmamış kabinler'));
        for (const rack of doc.topology.racks.filter(r => !links.find(link => link.rackId === r.id).locationId)) appendRack(unassigned,rack);
        tree.append(unassigned);
      }
      function renderLocations() {
        rows.replaceChildren();
        for (const location of locations) {
          const row = node('div','','pm-location'); row.dataset.locationId = location.id;
          const kind = select('Tür', kinds.map(key => [key,labels[key]]),location.kind || 'site'), title = field('Konum adı',location.name || '');
          const choices = [['','Üst konum yok'],...locations.filter(parent => parent.id !== location.id && kinds.indexOf(parent.kind) < kinds.indexOf(location.kind)).map(parent => [parent.id,parent.name || labels[parent.kind]])];
          if (location.parentId && !choices.some(([id]) => id === location.parentId)) choices.push([location.parentId,'Geçersiz üst konum']);
          const parent = select('Üst konum',choices,location.parentId || '');
          kind.input.addEventListener('change', () => { location.kind = kind.input.value; renderLocations(); });
          title.input.addEventListener('input', () => { location.name = title.input.value; renderBindings(); renderTree(); });
          parent.input.addEventListener('change', () => { location.parentId = parent.input.value || null; renderTree(); });
          row.append(kind.wrap,title.wrap,parent.wrap,button('Sil', () => { if (busy) return; locations = locations.filter(item => item.id !== location.id); renderLocations(); })); rows.append(row);
        }
        renderBindings(); renderTree();
      }
      hierarchy.append(button('Konum ekle', () => {
        if (busy) return;
        const last = locations.at(-1), index = last ? Math.min(3,kinds.indexOf(last.kind) + 1) : 0;
        locations.push({ id: crypto.randomUUID(), kind: kinds[index], name: labels[kinds[index]], parentId: index && last ? last.id : null }); renderLocations();
      }));
      hierarchy.append(node('h3','Kabinlerin odaları'),bindings,tree);
      metadata.append(button('Proje bilgilerini kaydet', run(async () => {
        if (!name.input.value.trim()) throw new Error('Proje adı gerekli.');
        const result = RS.ProjectManagement.updateDetails(expected, { ...doc.metadata, name: name.input.value.trim(), customer: customer.input.value.trim(), owner: owner.input.value.trim(), status: state.input.value, targetDate: target.input.value }, locations, links);
        try { await result.committed; }
        catch (error) { expected = RS.ProjectManagement.prepare(); doc = RS.ProjectDocument.capture(RS.STATE); throw error; }
        await refresh();
      })));
      detail.append(metadata,hierarchy); renderLocations(); formBaseline = JSON.stringify(readDraft());
    }
    async function refresh() {
      expected = RS.ProjectManagement.prepare(); doc = RS.ProjectDocument.capture(RS.STATE);
      locations = structuredClone(doc.locations); links = doc.topology.racks.map(rack => ({ rackId: rack.id, locationId: rack.locationId || null }));
      projects = await RS.ProjectRepository.list();
      if (!projects.some(project => project.projectId === doc.projectId)) projects.unshift({ projectId: doc.projectId, name: doc.metadata.name || 'Adsız proje', customer: doc.metadata.customer || '', status: doc.metadata.status || 'draft', revision: doc.revision, archived: false });
      renderProjects(); renderDetails();
    }
    const backup = node('section','','pm-section'); backup.append(node('h3','Yedek ve kurtarma'));
    backup.append(button('Tam dış yedek indir', run(async () => { await RS.saveProjectNow(); const text = await RS.ProjectArchive.exportArchive(); const url = URL.createObjectURL(new Blob([text],{type:'application/json'})); const link = node('a'); link.href = url; link.download = 'rack-studio-tam-yedek.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url),10000); })));
    const file = node('input'); file.type = 'file'; file.accept = '.json'; file.setAttribute('aria-label','Tam dış yedek dosyası');
    file.addEventListener('change',run(async () => { const selected = file.files[0]; if (!selected) return; if (selected.size > RS.ProjectArchive.LIMIT) throw new Error('Dış yedek 128 MB sınırını aşıyor.'); await RS.ProjectArchive.importArchive(await selected.text()); file.value = ''; await refresh(); }));
    backup.append(file,button('Kurtarma orijinallerini göster',() => RS.ProjectRecoveryUI.library({ legacy: true }))); dialog.append(backup);
    document.body.append(dialog); dialog.addEventListener('close',() => { dialog.remove(); opener?.focus(); }); dialog.showModal();
    await run(refresh)();
  }
  RS.ProjectManager = Object.freeze({ open });
})();
