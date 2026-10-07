(function () {
    'use strict';
    const R = window.RackStudio;
    let busy = false;
    async function append(make) {
        if (!R.WorkflowViews.canEdit())
            throw new Error('Teslim veya kabul kaydetmek için Tasarım/Saha görünümüne geçin.');
        if (busy)
            throw new Error('Teslim kaydı zaten hazırlanıyor.');
        busy = true;
        try {
            const expected = R.ProjectManagement.prepare();
            await R.saveProjectNow();
            const guard = () => { if (!R.WorkflowViews.canEdit())
                throw new Error('Teslim kaydı için Tasarım/Saha görünümüne geçin.'); const d = R.ProjectDocument.capture(R.STATE); if (d.projectId !== expected.projectId || R.ProjectCommands.domainKey(d) !== expected.expectedContent)
                throw new Error('Teslim hazırlanırken proje değişti; tekrar deneyin.'); return d; };
            const data = await make(guard()), doc = guard(), ledger = R.ProjectCommands.receipts(doc);
            if (ledger.length >= 10000)
                throw new Error('Komut kayıt sınırı doldu.');
            doc.handoverRecords.push(data.record);
            doc.revision++;
            doc.extensions[R.ProjectCommands.LEDGER] = [...ledger, { commandId: expected.commandId, fingerprint: JSON.stringify(data.record), revision: doc.revision }];
            await R.ProjectRepository.commit(doc, { namedRevision: data.named, beforeCommit: guard });
            guard();
            R.loadCustomTopology(doc, { render: false });
            R.refresh();
            if (window.is3DMode)
                window.__STUDIO3D__.loadTopologyFromProject(doc);
            document.dispatchEvent(new CustomEvent('rackstudio:change', { detail: { immediate: true } }));
            return data;
        }
        finally {
            busy = false;
        }
    }
    async function create(model, options) {
        return append(async (doc) => {
            if (model.document.projectId !== doc.projectId || model.document.revision > doc.revision)
                throw new Error('Dondurulmuş belge açık projeye ait olmalı.');
            const packet = await R.HandoverPackage.build(model, options), id = 'named-' + crypto.randomUUID();
            return { packet, record: { id: packet.manifest.id, projectId: doc.projectId, revision: model.document.revision, status: 'prepared', createdAt: packet.manifest.createdAt, namedRevisionId: id, sha256: packet.sha256, technicalComplete: packet.manifest.technicalComplete }, named: { id, name: 'Teslim · R' + model.document.revision, description: 'Dondurulmuş teslim paketi; kabul ayrı kayıttır.', tag: 'delivered', baseline: false, source: { kind: 'project' }, createdAt: packet.manifest.createdAt, document: packet.report.document, presentationViews: model.source.views || [], packetData: R.HandoverPackage.base64(packet.bytes), packetHash: packet.sha256, handoverManifest: packet.manifest } };
        });
    }
    async function accept(id, actor, note) {
        if (!actor?.trim() || actor.length > 200 || !note?.trim() || note.length > 2000)
            throw new Error('Kabul eden ve kabul açıklaması gerekli.');
        return append(async (doc) => {
            const parent = doc.handoverRecords.find(r => r.id === id && r.status === 'prepared');
            if (!parent || parent.sourceProjectId || doc.handoverRecords.some(r => r.parentHandoverId === id && r.status === 'accepted'))
                throw new Error('Teslim bulunamadı, kaynak projeye ait veya kabul zaten kaydedildi.');
            return { record: { id: crypto.randomUUID(), projectId: doc.projectId, revision: parent.revision, parentHandoverId: id, status: 'accepted', actor: actor.trim(), note: note.trim(), createdAt: new Date().toISOString(), signatureType: 'local-attestation' } };
        });
    }
    async function bytes(id) {
        const doc = R.ProjectDocument.capture(R.STATE), record = doc.handoverRecords.find(r => r.id === id);
        if (!record?.namedRevisionId || record.sourceProjectId)
            throw new Error('Bu teslimin dosyası kaynak projeye aittir.');
        const row = await R.ProjectRevisions.get(doc.projectId, record.namedRevisionId), bytes = R.HandoverPackage.unbase64(row.packetData || '');
        if (await R.ReportModel.hash(bytes) !== record.sha256)
            throw new Error('Yerel teslim dosyası bütünlüğü doğrulanamadı.');
        await R.HandoverPackage.validate(bytes);
        return bytes;
    }
    function preserveHistory(target, current) { const ids = new Set(current.handoverRecords.map(r => r.id)); target.handoverRecords = [...current.handoverRecords, ...target.handoverRecords.filter(r => !ids.has(r.id))]; return target; }
    R.HandoverRepository = Object.freeze({ create, accept, bytes, preserveHistory });
})();
