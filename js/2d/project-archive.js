(function () {
  'use strict';
  const RS = window.RackStudio, storage = RS.ProjectStorageIDB;
  const LIMIT = 128 * 1024 * 1024;
  const id = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,160}$/.test(value);
  function base64(bytes) {
    let text = '';
    for (let offset = 0; offset < bytes.length; offset += 32768) text += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
    return btoa(text);
  }
  async function exportArchive(repository = RS.ProjectRepository) {
    await repository.queue;
    const db = await repository.database;
    // Read all stores in one transaction: a backup cannot mix heads from different commits.
    const archive = await storage.transaction(db, ['projects', 'log', 'revisions', 'evidence', 'recovery'], 'readonly', (tx, done, fail) => {
      const data = { format: 'rack-studio-archive', version: 1, exportedAt: new Date().toISOString(), projects: [], log: [], revisions: [], evidence: [], recovery: [] };
      let remaining = 5, bytes = 0;
      for (const name of ['projects', 'log', 'revisions', 'evidence', 'recovery']) {
        const request = tx.objectStore(name).openCursor();
        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor) {
            bytes += new TextEncoder().encode(JSON.stringify(cursor.value)).length + (cursor.value?.blob?.size || 0) * 4 / 3;
            if (bytes > LIMIT) { fail(new Error('Dış yedek 128 MB sınırını aşıyor.')); return; }
            if (name !== 'projects' || cursor.key !== 'current') data[name].push({ key: cursor.key, value: cursor.value });
            cursor.continue();
          } else if (--remaining === 0) done(data);
        };
      }
    });
    let attachmentBytes = 0;
    for (const row of archive.evidence) {
      attachmentBytes += row.value.blob.size;
      if (attachmentBytes > LIMIT / 2) throw new Error('Eklerin toplamı dış yedek sınırını aşıyor.');
      row.value = { ...row.value, mime: row.value.blob.type, bytes: row.value.blob.size, data: base64(new Uint8Array(await row.value.blob.arrayBuffer())) };
      delete row.value.blob;
    }
    const text = JSON.stringify(archive);
    if (new TextEncoder().encode(text).length > LIMIT) throw new Error('Dış yedek 128 MB sınırını aşıyor.');
    // The same validation used by import must accept every generated backup.
    await verifyPayload(validate(text, repository));
    return text;
  }
  function validate(text, repository) {
    if (typeof text !== 'string' || new TextEncoder().encode(text).length > LIMIT) throw new Error('Dış yedek 128 MB sınırını aşıyor.');
    const data = JSON.parse(text, (key, value) => {
      if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('Güvensiz yedek alanı.');
      return value;
    });
    if (!data || data.format !== 'rack-studio-archive' || data.version !== 1) throw new Error('Desteklenmeyen dış yedek sürümü.');
    for (const name of ['projects', 'log', 'revisions', 'evidence', 'recovery']) if (!Array.isArray(data[name])) throw new Error('Eksik yedek koleksiyonu: ' + name);
    if (data.projects.length > 100 || data.revisions.length > 100000 || data.log.length > 1000000 || data.evidence.length > 10000 || data.recovery.length > 1000) throw new Error('Yedek kayıt sınırı aşıldı.');
    const heads = new Map();
    for (const row of data.projects) {
      if (!id(row.key) || row.key === 'current' || heads.has(row.key)) throw new Error('Geçersiz/tekrarlı proje kimliği.');
      const document = repository.validate(row.value.document);
      if (document.projectId !== row.key || !Number.isSafeInteger(row.value.storageVersion) || row.value.storageVersion < 1 || row.value.storageVersion > 1000 || typeof row.value.archived !== 'boolean') throw new Error('Geçersiz proje başlığı.');
      heads.set(row.key, row.value);
    }
    for (const name of ['revisions', 'log', 'evidence']) {
      const seen = new Set();
      for (const row of data[name]) {
        const key = JSON.stringify(row.key);
        if (!Array.isArray(row.key) || row.key.length !== 2 || !heads.has(row.key[0]) || seen.has(key)) throw new Error('Geçersiz/tekrarlı yedek anahtarı.');
        seen.add(key);
        const head = heads.get(row.key[0]);
        if (name === 'revisions') {
          const doc = repository.validate(row.value.document);
          const named = typeof row.key[1] === 'string';
          if (named) {
            RS.ProjectRevisions.validate(row.value,row.key[0]);
            if (row.value.id !== row.key[1]) throw new Error('Revizyon kimliği uyuşmuyor.');
          }
          if (doc.projectId !== row.key[0] || !Number.isSafeInteger(row.value.storageVersion) || row.value.storageVersion < 1 || row.value.storageVersion > head.storageVersion || (!named && row.value.storageVersion !== row.key[1]) || doc.revision > head.document.revision) throw new Error('Geçersiz revizyon kaydı.');
        } else if (name === 'log') {
          const receipt = RS.ProjectCommands.receipts(head.document).find(r => r.commandId === row.key[1]);
          if (!receipt || row.value.projectId !== row.key[0] || row.value.fingerprint !== receipt.fingerprint || row.value.revision !== receipt.revision || !Number.isSafeInteger(row.value.storageVersion) || row.value.storageVersion < 1 || row.value.storageVersion > head.storageVersion) throw new Error('Komut günlüğü ve belge uyuşmuyor.');
        } else {
          if (!id(row.key[1]) || row.value.projectId !== row.key[0] || row.value.id !== row.key[1] || !Number.isSafeInteger(row.value.bytes) || row.value.bytes < 0 || row.value.bytes > RS.ProjectRepositoryConstants.MAX_EVIDENCE || !['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain', 'text/csv', 'application/json'].includes(row.value.mime) || typeof row.value.data !== 'string' || row.value.data.length > 28 * 1024 * 1024 || row.value.data.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(row.value.data)) throw new Error('Geçersiz ek verisi.');
          const binary = atob(row.value.data);
          if (binary.length !== row.value.bytes) throw new Error('Ek boyutu uyuşmuyor.');
          row.value.blob = new Blob([Uint8Array.from(binary, char => char.charCodeAt(0))], { type: row.value.mime });
          delete row.value.data;
        }
      }
    }
    for (const head of heads.values()) {
      const named = data.revisions.filter(row => row.key[0] === head.document.projectId && typeof row.key[1] === 'string');
      if (named.length > 100 || named.filter(row => row.value.baseline).length > 1) throw new Error('Adlandırılmış revizyon sınırı veya baseline geçersiz.');
      if (!data.revisions.some(row => row.key[0] === head.document.projectId && row.key[1] === head.storageVersion && JSON.stringify(row.value.document) === JSON.stringify(head.document))) throw new Error('Son revizyon yedekte eksik.');
      for (const receipt of RS.ProjectCommands.receipts(head.document)) if (!data.log.some(row => row.key[0] === head.document.projectId && row.key[1] === receipt.commandId)) throw new Error('Komut makbuzu yedekte eksik.');
      for (const ref of head.document.evidenceRefs) if (ref.blobId && !data.evidence.some(row => row.key[0] === head.document.projectId && row.key[1] === ref.blobId && row.value.blob.size === ref.bytes && row.value.blob.type === ref.mime)) throw new Error('Projenin yerel eki yedekte eksik veya farklı.');
    }
    for (const row of data.revisions.filter(row => typeof row.key[1] === 'string')) for (const ref of row.value.document.evidenceRefs) if (ref.blobId && !data.evidence.some(item => item.key[0] === row.key[0] && item.key[1] === ref.blobId && item.value.blob.size === ref.bytes && item.value.blob.type === ref.mime)) throw new Error('Revizyonun yerel eki yedekte eksik veya farklı.');
    const recoveryIds = new Set();
    for (const row of data.recovery) {
      if (typeof row.key !== 'string' || !/^[0-9a-f]{64}$/.test(row.key) || recoveryIds.has(row.key) || typeof row.value.raw !== 'string' || new TextEncoder().encode(row.value.raw).length > 64 * 1024 * 1024 || typeof row.value.source !== 'string') throw new Error('Geçersiz ham kurtarma kaydı.');
      recoveryIds.add(row.key);
    }
    return data;
  }
  async function verifyPayload(data) {
    for (const { value } of data.revisions) if (value.packetData !== undefined) {
      if (!RS.HandoverPackage) throw new Error('Bu yedek teslim paketi destekleyen sürümde açılmalı.');
      const bytes = RS.HandoverPackage.unbase64(value.packetData);
      if (await RS.ReportModel.hash(bytes) !== value.packetHash) throw new Error('Yedek teslim dosyası SHA-256 doğrulaması başarısız.');
      const packet = await RS.HandoverPackage.validate(bytes);
      if (packet.document.projectId !== value.document.projectId || packet.document.revision !== value.document.revision || JSON.stringify(packet.manifest) !== JSON.stringify(value.handoverManifest)) throw new Error('Yedek teslim manifesti uyuşmuyor.');
    }
    // Hashes are verified before entering the write transaction or delivering a backup.
    for (const row of data.evidence) {
      const digest = await crypto.subtle.digest('SHA-256', await row.value.blob.arrayBuffer());
      const actual = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
      const ref = data.projects.find(p => p.key === row.key[0]).value.document.evidenceRefs.find(ref => ref.blobId === row.key[1]);
      if (ref?.sha256 && ref.sha256.toLowerCase() !== actual) throw new Error('Ek SHA-256 doğrulaması başarısız.');
      for (const revision of data.revisions.filter(r => r.key[0] === row.key[0] && typeof r.key[1] === 'string')) {
        const ref = revision.value.document.evidenceRefs.find(ref => ref.blobId === row.key[1]);
        if (ref?.sha256 && ref.sha256.toLowerCase() !== actual) throw new Error('Revizyon eki SHA-256 doğrulaması başarısız.');
      }
      if (row.value.sha256 && row.value.sha256 !== actual) throw new Error('Ek SHA-256 doğrulaması başarısız.');
      row.value.sha256 = actual;
    }
    for (const row of data.recovery) {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(row.value.raw));
      const actual = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
      if (actual !== row.key) throw new Error('Ham kurtarma kaydı özeti uyuşmuyor.');
    }
  }
  async function importArchive(text, repository = RS.ProjectRepository) {
    const data = validate(text, repository);
    await verifyPayload(data);
    return repository.serialize(async () => {
      const db = await repository.database;
      await storage.transaction(db, ['projects', 'log', 'revisions', 'evidence', 'leases', 'recovery', 'meta'], 'readwrite', (tx, done, fail) => {
        const existing = tx.objectStore('projects').getAll();
        existing.onsuccess = () => {
          try {
            const ids = new Set(existing.result.filter(row => row?.document).map(row => row.document.projectId));
            if (data.projects.some(row => ids.has(row.key))) throw new Error('Yedekteki proje zaten var. Mevcut proje üzerine yazılmadı.');
            for (const name of ['projects', 'log', 'revisions', 'evidence', 'recovery']) for (const row of data[name]) tx.objectStore(name).put(row.value, row.key);
            tx.objectStore('meta').put(true, 'formatReady');
            done();
          } catch (error) { fail(error); }
        };
      });
      return { status: 'durable', projects: data.projects.length };
    });
  }
  RS.ProjectArchive = Object.freeze({ exportArchive, importArchive, LIMIT });
})();
