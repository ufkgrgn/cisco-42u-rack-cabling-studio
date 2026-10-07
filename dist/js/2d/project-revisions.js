(function () {
  'use strict';
  const RS = window.RackStudio, storage = RS.ProjectStorageIDB;
  const tags = ['draft','approved','delivered'];
  function validate(row, projectId) {
    if (row.packetData !== undefined && (typeof row.packetData !== 'string' || row.packetData.length > 32 * 1024 * 1024 || row.packetData.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(row.packetData) || !/^[a-f0-9]{64}$/.test(row.packetHash || ''))) throw new Error('Revizyon teslim dosyası geçersiz.');
    if (!row || typeof row.id !== 'string' || row.id.length > 160 || !/^named-[a-zA-Z0-9_-]+$/.test(row.id) || typeof row.name !== 'string' || !row.name.trim() || row.name.length > 160 || typeof row.description !== 'string' || row.description.length > 2000 || !tags.includes(row.tag) || typeof row.baseline !== 'boolean' || typeof row.createdAt !== 'string' || !Number.isFinite(Date.parse(row.createdAt))) throw new Error('Adlandırılmış revizyon kaydı geçersiz.');
    if (!row.source || !['project','legacySnapshot'].includes(row.source.kind) || ['id','timestamp'].some(key => row.source[key] !== undefined && (typeof row.source[key] !== 'string' || row.source[key].length > 160))) throw new Error('Revizyon kaynağı geçersiz.');
    if (row.document.projectId !== projectId) throw new Error('Revizyon başka projeye ait.');
    if(row.presentationViews!==undefined){
      if(!Array.isArray(row.presentationViews)||row.presentationViews.length>20)throw new Error('Sunum görünümü listesi geçersiz.');
      for(const view of row.presentationViews){RS.WorkspaceState.validateView(view,projectId);if(view.documentRevision!==row.document.revision || !row.document.topology.racks.some(r=>r.id===view.rackId))throw new Error('Sunum görünümü revizyonla uyuşmuyor.');}
    }
    const document = RS.ProjectRepository.validate(row.document);
    if (row.scenario !== undefined) RS.Scenarios.validateBranch(row.scenario,document);
    return { ...row, document };
  }
  async function list(projectId) {
    const rows = await storage.transaction(await RS.ProjectRepository.database,['revisions'],'readonly',(tx,done) => {
      const rows=[], request=tx.objectStore('revisions').openCursor(IDBKeyRange.bound([projectId,'named-'],[projectId,'named-\uffff']));
      request.onsuccess=()=>{ const entry=request.result; if (entry) { rows.push(entry.value); entry.continue(); } else done(rows); };
    });
    return rows.map(row => validate(row,projectId)).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  }
  async function get(projectId, id) {
    const row = await storage.read(await RS.ProjectRepository.database,'revisions',[projectId,id]);
    if (!row) throw new Error('Revizyon bulunamadı.');
    return validate(row,projectId);
  }
  async function create(details, input) {
    const expected = RS.ProjectManagement.prepare(), live = RS.ProjectDocument.capture(RS.STATE);
    const doc = input ? RS.ProjectRepository.validate(input) : live;
    if (doc.projectId !== live.projectId || doc.revision > live.revision) throw new Error('Revizyon açık projeye ait olmalı.');
    const row = validate({ id: 'named-' + crypto.randomUUID(), name: details.name?.trim(), description: details.description || '', tag: details.tag || 'draft', baseline: details.baseline === true, source: details.source || { kind: 'project' }, createdAt: new Date().toISOString(), document: doc },doc.projectId);
    if(details.presentationViews!==undefined){row.presentationViews=structuredClone(details.presentationViews);validate(row,doc.projectId);}
    if(details.scenario!==undefined){row.scenario=structuredClone(details.scenario);validate(row,doc.projectId);}
    await RS.saveProjectNow();
    const current = RS.ProjectDocument.capture(RS.STATE);
    if (current.projectId !== expected.projectId || RS.ProjectCommands.domainKey(current) !== expected.expectedContent) throw new Error('Revizyon kaydedilirken proje değişti; tekrar deneyin.');
    return RS.ProjectRepository.serialize(async () => {
      const repo = RS.ProjectRepository, db = await repo.database;
      await storage.transaction(db,['projects','revisions','leases','evidence'],'readwrite',(tx,done,fail) => {
        const request = tx.objectStore('projects').get(doc.projectId);
        request.onsuccess = () => {
          const leaseRequest = tx.objectStore('leases').get(doc.projectId);
          leaseRequest.onsuccess = () => {
            try {
              const head = request.result, lease = leaseRequest.result;
              if (!head || head.archived || head.storageVersion !== repo.versions.get(doc.projectId) || (lease && lease.owner !== repo.owner && lease.expiresAt > Date.now())) throw new Error('Proje kaydı başka sekmede değişti; revizyon kaydedilmedi.');
              const live = RS.ProjectDocument.capture(RS.STATE);
              if (live.projectId !== expected.projectId || RS.ProjectCommands.domainKey(live) !== expected.expectedContent || RS.ProjectCommands.domainKey(head.document) !== expected.expectedContent) throw new Error('Revizyon kaydedilirken proje değişti; tekrar deneyin.');
              row.storageVersion = head.storageVersion;
              for (const ref of doc.evidenceRefs) if (ref.blobId) {
                const attachment = tx.objectStore('evidence').get([doc.projectId,ref.blobId]);
                attachment.onsuccess = () => { const item=attachment.result; if (!item || item.blob.size !== ref.bytes || item.blob.type !== ref.mime || (ref.sha256 && item.sha256 !== ref.sha256.toLowerCase())) fail(new Error('Revizyonun yerel eki eksik veya farklı.')); };
              }
              const store = tx.objectStore('revisions'), cursor = store.openCursor(IDBKeyRange.bound([doc.projectId,'named-'],[doc.projectId,'named-\uffff'])); let count = 0;
              cursor.onsuccess = () => {
                const entry = cursor.result;
                if (entry) {
                  if (entry.key[0] === doc.projectId && typeof entry.key[1] === 'string') {
                    count++;
                    if (row.baseline && entry.value.baseline) entry.update({ ...entry.value, baseline: false });
                  }
                  entry.continue();
                } else if (count >= 100) fail(new Error('100 adlandırılmış revizyon sınırı doldu.'));
                else { store.add(row,[doc.projectId,row.id]); done(row); }
              };
            } catch (error) { fail(error); }
          };
        };
      });
      return row;
    });
  }
  async function restore(id, expected) {
    const envelope = expected || RS.ProjectManagement.prepare();
    const row = await get(envelope.projectId,id);
    const db = await RS.ProjectRepository.database;
    for (const ref of row.document.evidenceRefs) if (ref.blobId && !(await storage.read(db,'evidence',[envelope.projectId,ref.blobId]))) throw new Error('Revizyonun yerel eki eksik; proje korunuyor.');
    const result = RS.ProjectCommands.execute({ ...envelope, type: 'RestoreProjectDocument', payload: { document: row.document } });
    if (window.is3DMode) window.__STUDIO3D__.loadTopologyFromProject(RS.ProjectDocument.capture(RS.STATE));
    await result.committed; return result;
  }
  function legacySnapshots() {
    const raw = localStorage.getItem('rack_studio_snapshots_v1');
    if (!raw) return [];
    if (new TextEncoder().encode(raw).length > RS.ProjectDocument.MAX_BYTES * 2) throw new Error('Eski snapshot verisi boyut sınırını aşıyor.');
    const rows = JSON.parse(raw);
    if (!Array.isArray(rows) || rows.length > 100) throw new Error('Eski snapshot listesi geçersiz.');
    return rows;
  }
  async function importLegacy(index) {
    const old = legacySnapshots()[index]; if (!old) throw new Error('Eski snapshot bulunamadı.');
    const current = RS.ProjectDocument.capture(RS.STATE);
    const doc = old.projectDocument || { ...current, topology: { ...current.topology, racks: old.racks, cables: old.cables, activeRackId: old.activeRackId, viewMode: old.viewMode } };
    return create({ name: old.label || 'Eski snapshot', description: 'Eski yerel snapshot kaynağından içe alındı.', source: { kind: 'legacySnapshot', id: old.id || '', timestamp: old.timestamp || '' } },doc);
  }
  RS.ProjectRevisions = Object.freeze({ list, get, create, restore, legacySnapshots, importLegacy, validate });
})();
