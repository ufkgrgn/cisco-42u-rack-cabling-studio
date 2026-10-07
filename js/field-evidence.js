/* Blobs and event/ref metadata share one IndexedDB transaction. */
(function () {
    'use strict';
    const R = window.RackStudio, allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain', 'text/csv', 'application/json'];
    const verified = new Set(), key = (ref, projectId) => [projectId, ref.blobId, ref.sha256, ref.bytes, ref.mime].join(':');
    async function prepare(files, projectId, entityRef) {
        if (files.length > 8 || files.reduce((n, f) => n + f.size, 0) > 40 * 1024 * 1024)
            throw new Error('En fazla 8 ek ve toplam 40 MB kullanılabilir.');
        const refs = [], attachments = [];
        for (const file of files) {
            if (!(file instanceof Blob) || !allowed.includes(file.type) || !file.size || file.size > 20 * 1024 * 1024)
                throw new Error('Ek türü veya boyutu geçersiz; her ek 1 bayt–20 MB olmalı.');
            const bytes = new Uint8Array(await file.arrayBuffer()), hex = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(v => v.toString(16).padStart(2, '0')).join('');
            const matches = (signature) => signature.every((v, i) => bytes[i] === v);
            if ((file.type === 'image/png' && !matches([137, 80, 78, 71, 13, 10, 26, 10])) || (file.type === 'image/jpeg' && !matches([255, 216, 255])) || (file.type === 'application/pdf' && !matches([37, 80, 68, 70, 45])) || (file.type === 'image/webp' && (!matches([82, 73, 70, 70]) || new TextDecoder().decode(bytes.slice(8, 12)) !== 'WEBP')))
                throw new Error('Ek içeriği seçilen dosya türüyle uyuşmuyor.');
            const id = crypto.randomUUID(), blobId = crypto.randomUUID();
            refs.push({
                id, blobId, projectId, entityRef, filename: (file.name || 'Ek').slice(0, 200), bytes: file.size, mime: file.type, sha256: hex, createdAt: new Date().toISOString()
            });
            attachments.push({ id: blobId, blob: file });
        }
        return { refs, attachments };
    }
    async function commit(doc, evidence, guard) {
        const result = await R.ProjectRepository.commit(doc, { evidence, beforeCommit: guard });
        for (const ref of doc.evidenceRefs)
            if (evidence.some(e => e.id === ref.blobId))
                verified.add(key(ref, doc.projectId));
        return result;
    }
    async function get(ref) {
        const R = window.RackStudio, projectId = R.STATE.projectDocument.projectId;
        verified.delete(key(ref, projectId));
        if (ref.projectId && ref.projectId !== projectId)
            throw new Error('Ek başka projeye ait.');
        const row = await R.ProjectStorageIDB.read(await R.ProjectRepository.database, 'evidence', [projectId, ref.blobId]);
        if (!row?.blob)
            throw new Error('Ek yerel depoda yok; sonuç kanıtı kullanılamıyor.');
        const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', await row.blob.arrayBuffer()))].map(v => v.toString(16).padStart(2, '0')).join('');
        if (digest !== ref.sha256 || row.blob.size !== ref.bytes || row.blob.type !== ref.mime)
            throw new Error('Ek bütünlüğü doğrulanamadı.');
        verified.add(key(ref, projectId));
        return row.blob;
    }
    R.FieldEvidence = Object.freeze({ prepare, commit, get, isVerified: (ref, projectId) => verified.has(key(ref, projectId)) });
})();
