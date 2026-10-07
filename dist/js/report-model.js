(function () {
    'use strict';
    const R = window.RackStudio;
    function freeze(value, seen = new WeakSet()) { if (value && typeof value === 'object' && !seen.has(value)) {
        seen.add(value);
        Object.values(value).forEach(v => freeze(v, seen));
        Object.freeze(value);
    } return value; }
    const hash = async (bytes) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes))].map(v => v.toString(16).padStart(2, '0')).join('');
    const text = value => value === null || value === undefined || value === '' ? 'Belirtilmedi' : String(value);
    function endpoint(doc, end) { const rack = doc.topology.racks.find(r => r.id === end.rackId), device = rack?.devices.find(d => d.instanceId === end.instanceId), catalog = doc.catalogContext.models?.[device?.catalogKey]?.definition || doc.topology.customCatalog?.[device?.catalogKey], port = catalog?.ports?.find(p => p.id === end.portId); return { rackId: end.rackId, deviceId: end.instanceId, portId: end.portId, face: end.face || 'front', label: [rack?.name || end.rackId, device?.hostname || device?.name || end.instanceId, port?.name || end.portId, end.face || 'front'].join(' / ') }; }
    async function capture(revisionId) {
        const expected = R.ProjectManagement.prepare();
        await R.saveProjectNow();
        const guard = () => { const d = R.ProjectDocument.capture(R.STATE); if (d.projectId !== expected.projectId || R.ProjectCommands.domainKey(d) !== expected.expectedContent)
            throw new Error('Rapor hazırlanırken proje değişti; revizyonu yeniden seçin.'); };
        guard();
        const snapshot = await R.ProjectRepository.snapshotProject(expected.projectId), source = revisionId ? await R.ProjectRevisions.get(expected.projectId, revisionId) : null;
        guard();
        return build(source?.document || snapshot.document, snapshot.evidence, { id: source?.id || null, name: source?.name || 'Güncel dayanıklı kayıt', views: source?.presentationViews || [] });
    }
    async function build(input, evidence = [], source = { name: 'Seçilmiş belge', views: [] }) {
        const doc = R.CatalogSources ? R.CatalogSources.pin(R.ProjectRepository.validate(input)) : R.ProjectRepository.validate(input), catalog = {};
        for (const rack of doc.topology.racks)
            for (const device of rack.devices) {
                const key = device.catalogKey, item = R.CatalogSources?.map(doc)[key] || doc.topology.customCatalog?.[key] || R.resolveCatalogItem?.(key) || R.catalog?.[key];
                if (item)
                    catalog[key] = structuredClone(item);
            }
        if (!R.CatalogSources) doc.topology.customCatalog = { ...doc.topology.customCatalog, ...catalog };
        const attachments = [], issues = [], verified = new Set();
        for (const ref of doc.evidenceRefs) {
            const row = evidence.find(e => e.id === ref.blobId && e.projectId === doc.projectId);
            if (!row?.blob) {
                issues.push({ kind: 'evidence', id: ref.id, text: 'Yerel kanıt eksik: ' + (ref.filename || ref.id) });
                continue;
            }
            const digest = await hash(await row.blob.arrayBuffer());
            if (row.blob.size !== ref.bytes || row.blob.type !== ref.mime || digest !== ref.sha256?.toLowerCase()) {
                issues.push({ kind: 'evidence', id: ref.id, text: 'Kanıt bütünlüğü doğrulanamadı: ' + ref.id });
                continue;
            }
            verified.add(ref.id);
            attachments.push({ ref: structuredClone(ref), blob: row.blob });
        }
        const devices = doc.topology.racks.flatMap(r => r.devices.map(d => ({ id: d.instanceId, rackId: r.id, rack: r.name, name: d.hostname || d.name || d.instanceId, model: catalog[d.catalogKey]?.name || d.catalogKey, modelKey: d.catalogKey, topU: d.topU, uHeight: d.uHeight, face: d.face || 'front', serialNumber: d.serialNumber || '', assetTag: d.assetTag || '', ipAddress: d.ipAddress || '' }))), cables = doc.topology.cables.map(c => ({ id: c.id, name: c.name || c.id, from: endpoint(doc, c.from), to: endpoint(doc, c.to), medium: c.medium || '', role: c.role || '', note: c.note || '', estimated: c.estimatedLengthMeters ?? null, measured: c.measuredLengthMeters ?? null, purchase: c.purchaseLengthMeters ?? null, legacy: c.lengthMeters ?? null }));
        const statuses = {};
        for (const [kind, items] of [['device', devices], ['cable', cables]])
            for (const item of items) {
                const state = R.FieldEvents.status(doc, { kind, id: item.id }, ref => verified.has(ref.id));
                statuses[kind + ':' + item.id] = { label: state.label, complete: state.complete };
                if (!state.complete)
                    issues.push({ kind: 'field', entityRef: { kind, id: item.id }, id: item.id, text: item.name + ' · ' + state.label });
            }
        for (const o of doc.observations)
            if (o.mapping && o.mapping.status !== 'matched')
                issues.push({ kind: 'observation', id: o.id, text: 'Gözlem eşlemesi inceleme bekliyor: ' + o.id });
        return freeze({ version: 1, createdAt: new Date().toISOString(), source: structuredClone(source), document: doc, catalog, devices, cables, attachments, issues, statuses, technicalComplete: devices.length + cables.length > 0 && issues.length === 0 });
    }
    R.ReportModel = Object.freeze({ capture, build, freeze, hash, text, endpoint });
})();
