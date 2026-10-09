/* Append-only field history; completion is derived from current test scope. */
(function () {
    'use strict';
    const R = window.RackStudio, stable = R.ProjectCommands.domainKey;
    const encode = v => v && typeof v === 'object' ? Array.isArray(v) ? '[' + v.map(encode).join(',') + ']' : '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + encode(v[k])).join(',') + '}' : JSON.stringify(v);
    const labels = { installed: 'Uygulama', labeled: 'Etiketleme', test: 'Test' }, results = {
        pass: 'Başarılı', fail: 'Başarısız', partial: 'Kısmi', unknown: 'Değerlendirilemedi', 'not-tested': 'Test edilmedi'
    };
    function scope(doc, ref) {
        const device = id => {
            const rack = doc.topology.racks.find(r => r.devices.some(d => d.instanceId === id)), d = rack?.devices.find(d => d.instanceId === id);
            if (!d)
                throw new Error('Saha nesnesi bulunamadı.');
            const model = doc.topology.customCatalog?.[d.catalogKey] || R.resolveCatalogItem?.(d.catalogKey) || R.catalog?.[d.catalogKey];
            return {
                instanceId: id, rackId: rack.id, topU: d.topU, face: d.face || 'front', catalogKey: d.catalogKey, modelPorts: model?.ports || [], portsConfig: d.portsConfig || {}
            };
        };
        if (ref?.kind === 'device')
            return { device: device(ref.id) };
        if (ref?.kind === 'cable') {
            const c = doc.topology.cables.find(c => c.id === ref.id);
            if (!c)
                throw new Error('Saha hattı bulunamadı.');
            return { from: { ...c.from, face: c.from.face || 'front' }, to: { ...c.to, face: c.to.face || 'front' }, devices: [device(c.from.instanceId), device(c.to.instanceId)], medium: c.medium || '' };
        }
        throw new Error('Saha kaydı cihaz veya hat için olmalı.');
    }
    const history = (doc, ref) => doc.fieldEvents.filter(e => e.entityRef?.kind === ref.kind && e.entityRef.id === ref.id);
    function status(doc, ref, isVerified = R.FieldEvidence.isVerified) {
        const rows = history(doc, ref), latest = {};
        let currentScope;
        try {
            currentScope = scope(doc, ref);
        }
        catch {
            return { label: 'Nesne kaldırıldı', complete: false, latest, rows };
        }
        rows.forEach((e, index) => {
            if (e.fieldEventVersion === 1)
                latest[e.kind] = { event: e, index };
        });
        const valid = e => e && encode(e.event.scope) === encode(currentScope);
        const installed = valid(latest.installed) && latest.installed.event.result === 'pass';
        const labeled = installed && valid(latest.labeled) && latest.labeled.event.result === 'pass' && latest.labeled.index > latest.installed.index;
        const test = latest.test, needsRetest = !!test && (!valid(test) || !labeled || test.index < latest.labeled.index);
        const passed = !!(labeled && test && !needsRetest && test.event.result === 'pass' && test.event.evidenceIds.length);
        const complete = passed && test.event.evidenceIds.every(id => {
            const ref = doc.evidenceRefs.find(e => e.id === id);
            return ref && isVerified(ref, doc.projectId);
        });
        return {
            rows, latest, installed, labeled, complete, needsRetest, label: complete ? 'Tamamlandı' : needsRetest ? 'Yeniden test gerekli' : passed ? 'Kanıt doğrulaması gerekli' : test ? results[test.event.result] : !installed ? 'Uygulama bekliyor' : !labeled ? 'Etiketleme bekliyor' : 'Test bekliyor'
        };
    }
    function validateInput(input, doc) {
        if (!Object.hasOwn(labels, input.kind) || !Object.hasOwn(results, input.result))
            throw new Error('Saha adımı veya sonucu geçersiz.');
        if (!input.technician?.trim() || input.technician.length > 200)
            throw new Error('Teknisyen adı gerekli (en fazla 200 karakter).');
        if (!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(input.recordedAt || '') || !Number.isFinite(Date.parse(input.recordedAt)) || Date.parse(input.recordedAt) > Date.now() + 60000)
            throw new Error('İşlem tarihi geçersiz veya gelecekte.');
        if ((input.note || '').length > 4000)
            throw new Error('Not en fazla 4000 karakter olmalı.');
        const state = status(doc, input.entityRef), previous = state.latest[input.kind]?.event;
        if (input.parentEventId) {
            if (!previous || previous.id !== input.parentEventId || !input.reason?.trim() || input.reason.length > 2000)
                throw new Error('Düzeltme en son aynı adımı ve gerekçesini belirtmeli.');
        }
        else if (previous && previous.result !== input.result)
            throw new Error('Sonucu değiştirmek için gerekçeli düzeltme seçin.');
        if (input.kind === 'labeled' && !state.installed)
            throw new Error('Önce geçerli uygulama kaydı gerekli.');
        if (input.kind === 'test' && (!state.installed || !state.labeled))
            throw new Error('Test için geçerli uygulama ve etiketleme kaydı gerekli.');
        scope(doc, input.entityRef);
    }
    let recording = false;
    async function record(input, files = [], expected) {
        if (recording)
            throw new Error('Saha kaydı sürüyor.');
        if (!R.WorkflowViews.canEdit())
            throw new Error('Saha kaydı için Tasarım/Saha görünümüne geçin.');
        expected ||= R.ProjectManagement.prepare();
        input = structuredClone(input);
        files = [...files];
        recording = true;
        try {
            const guard = () => {
                if (!R.WorkflowViews.canEdit())
                    throw new Error('Görünüm değişti.');
                const d = R.ProjectDocument.capture(R.STATE);
                if (d.projectId !== expected.projectId || d.revision !== expected.expectedRevision || stable(d) !== expected.expectedContent)
                    throw new Error('Proje değişti; saha kaydını güncel proje üzerinden tekrarlayın.');
                return d;
            };
            let doc = R.ProjectDocument.capture(R.STATE);
            const evidence = await R.FieldEvidence.prepare(files, expected.projectId, input.entityRef);
            doc = R.ProjectDocument.capture(R.STATE);
            const ledger = R.ProjectCommands.receipts(doc), fingerprint = encode({ input, files: evidence.refs.map(f => ({ name: f.filename, type: f.mime, size: f.bytes, sha256: f.sha256 })) }), old = ledger.find(r => r.commandId === expected.commandId);
            if (old && doc.projectId === expected.projectId) {
                if (old.fingerprint !== fingerprint)
                    throw new Error('Saha komutu farklı içerikle kullanıldı.');
                await R.saveProjectNow();
                return { duplicate: true, status: 'durable' };
            }
            doc = guard();
            validateInput(input, doc);
            if (ledger.length >= 10000)
                throw new Error('Komut kayıt sınırı doldu.');
            if (input.kind === 'test' && input.result === 'pass' && !evidence.refs.length)
                throw new Error('Başarılı test için fotoğraf veya test dosyası gerekli.');
            await R.saveProjectNow();
            doc = guard();
            const event = {
                id: crypto.randomUUID(), fieldEventVersion: 1, projectId: doc.projectId, entityRef: input.entityRef, kind: input.kind, result: input.result, technician: input.technician.trim(), recordedAt: input.recordedAt, receivedAt: new Date().toISOString(), note: input.note || '', expectedRevision: doc.revision, scope: scope(doc, input.entityRef), evidenceIds: evidence.refs.map(r => r.id), ...(input.parentEventId ? { parentEventId: input.parentEventId, reason: input.reason.trim() } : {})
            };
            doc.fieldEvents.push(event);
            doc.evidenceRefs.push(...evidence.refs);
            doc.revision++;
            doc.extensions[R.ProjectCommands.LEDGER] = [...ledger, { commandId: expected.commandId, fingerprint, revision: doc.revision }];
            R.ProjectRepository.validate(doc);
            await R.FieldEvidence.commit(doc, evidence.attachments, guard);
            try {
                guard();
            }
            catch {
                throw new Error('Saha kaydı yerel depoda saklandı; çalışma eşzamanlı değişti. Son kaydı proje listesinden yeniden açın.');
            }
            R.loadCustomTopology(doc, { render: false });
            R.refresh();
            if (window.is3DMode)
                window.__STUDIO3D__.loadTopologyFromProject(doc);
            document.dispatchEvent(new CustomEvent('rackstudio:change', { detail: { immediate: true } }));
            await R.saveProjectNow();
            return { event, status: 'durable' };
        }
        finally {
            recording = false;
        }
    }
    function preserveHistory(target, current) {
        const saved = current.fieldEvents, ids = new Set(saved.map(e => e.id));
        target.fieldEvents = [...saved, ...target.fieldEvents.filter(e => !ids.has(e.id))];
        const used = new Set(saved.flatMap(e => e.evidenceIds)), refs = current.evidenceRefs.filter(e => used.has(e.id)), refIds = new Set(refs.map(e => e.id));
        target.evidenceRefs = [...refs, ...target.evidenceRefs.filter(e => !refIds.has(e.id))];
        return target;
    }
    R.FieldEvents = Object.freeze({
        scope, status, history, record, preserveHistory, validateInput, labels, results
    });
})();
