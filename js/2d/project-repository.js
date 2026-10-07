(function () {
  'use strict';
  const RS = window.RackStudio, storage = RS.ProjectStorageIDB;
  const DRAFT_PREFIX = 'rack-studio-draft:';
  const LEGACY_KEYS = ['rack-studio-project-v2', 'cisco-rack-studio-project', 'rackstudio_2d_autosave', 'cisco_rack_studio_3d_state'];
  const LEASE_MS = 15000;
  const MAX_EVIDENCE = 20 * 1024 * 1024;
  // Capture before bootstrap listeners rewrite compatibility caches.
  const initialLegacy = [];
  try {
    for (const key of Object.keys(localStorage)) if (LEGACY_KEYS.includes(key) || key.startsWith(DRAFT_PREFIX)) {
      const raw = localStorage.getItem(key);
      if (raw) initialLegacy.push({ source: key, raw });
    }
  } catch (_) {}
  class ConflictError extends Error { constructor(message) { super(message); this.name = 'ProjectConflictError'; } }
  async function hash(text) {
    const bytes = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
  }
  class Repository {
    constructor() {
      this.owner = crypto.randomUUID();
      this.database = storage.open();
      // Avoid an unhandled rejection while the editor has not initialized yet.
      this.database.catch(() => {});
      this.versions = new Map();
      this.queue = Promise.resolve();
      this.durable = new Map();
    }
    serialize(work) {
      const next = this.queue.catch(() => {}).then(work);
      this.queue = next;
      return next;
    }
    validate(input) {
      const document = RS.CatalogSources ? RS.CatalogSources.pin(RS.ProjectDocument.normalize(input),true) : RS.ProjectDocument.normalize(input);
      if (document.projectId === 'current') throw new Error('Bu proje kimliği eski kayıt formatı için ayrılmıştır.');
      RS.validateTopology(document);
      RS.ProjectCommands.receipts(document);
      return document;
    }
    async get(projectId, options = {}) {
      const row = await storage.read(await this.database, 'projects', projectId);
      if (!row || typeof row === 'string') return null;
      if (!this.versions.has(projectId) || options.adopt) {
        this.versions.set(projectId, row.storageVersion);
        this.durable.set(projectId, row.document);
      }
      return { ...row, document: this.validate(row.document) };
    }
    async list() {
      const rows = await storage.entries(await this.database, 'projects');
      return rows.filter(row => row.key !== 'current' && row.value?.document).map(({ value }) => ({ projectId: value.document.projectId, name: value.document.metadata.name || 'Adsız proje', customer: value.document.metadata.customer || '', status: value.document.metadata.status || 'draft', revision: value.document.revision, archived: value.archived === true, updatedAt: value.updatedAt }));
    }
    async listRecovery() { return storage.entries(await this.database, 'recovery'); }
    async snapshotProject(projectId) {
      const result = await storage.transaction(await this.database, ['projects', 'evidence'], 'readonly', (tx, done) => {
        let head, evidence = [], remaining = 2;
        const finish = () => { if (--remaining === 0) done({ head, evidence }); };
        const request = tx.objectStore('projects').get(projectId);
        request.onsuccess = () => { head = request.result; finish(); };
        const cursor = tx.objectStore('evidence').openCursor(IDBKeyRange.bound([projectId], [projectId, []]));
        cursor.onsuccess = () => {
          const entry = cursor.result;
          if (entry) { evidence.push(entry.value); entry.continue(); } else finish();
        };
      });
      if (!result.head) throw new Error('Proje bulunamadı.');
      return { document: this.validate(result.head.document), evidence: result.evidence };
    }
    async select(projectId) {
      return storage.transaction(await this.database, ['meta'], 'readwrite', tx => tx.objectStore('meta').put(projectId, 'activeProjectId'));
    }
    rememberDraft(input) {
      const doc = RS.ProjectDocument.normalize(input);
      const key = DRAFT_PREFIX + this.owner + ':' + doc.projectId;
      try { localStorage.setItem(key, JSON.stringify(doc)); return true; }
      catch (_) { return false; }
    }
    async release(projectId) {
      const db = await this.database;
      return storage.transaction(db, ['leases'], 'readwrite', tx => {
        const store = tx.objectStore('leases'), request = store.get(projectId);
        request.onsuccess = () => { if (request.result?.owner === this.owner) store.delete(projectId); };
      });
    }
    commit(input, options = {}) {
      // Freeze queued input before another edit changes the live objects.
      const doc = this.validate(input);
      const named = options.namedRevision ? RS.ProjectRevisions.validate(structuredClone(options.namedRevision), doc.projectId) : null;
      const attachments = (options.evidence || []).map(item => ({ id: item.id, blob: item.blob }));
      for (const item of attachments) {
        const ref = doc.evidenceRefs.find(ref => ref.blobId === item.id);
        if (!ref || !(item.blob instanceof Blob) || item.blob.size > MAX_EVIDENCE || ref.bytes !== item.blob.size || ref.mime !== item.blob.type) throw new Error('Ek verisi ve proje kaydı uyuşmuyor.');
      }
      return this.serialize(async () => {
        const db = await this.database, id = doc.projectId, expected = this.versions.get(id);
        for (const item of attachments) {
          const digest = await crypto.subtle.digest('SHA-256', await item.blob.arrayBuffer());
          item.sha256 = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
          const ref = doc.evidenceRefs.find(ref => ref.blobId === item.id);
          if (ref.sha256 && ref.sha256.toLowerCase() !== item.sha256) throw new Error('Ek SHA-256 değeri uyuşmuyor.');
        }
        options.beforeCommit?.();
        const result = await storage.transaction(db, ['projects', 'log', 'revisions', 'evidence', 'leases', 'meta'], 'readwrite', (tx, done, fail) => {
          const projects = tx.objectStore('projects');
          const request = projects.get(id);
          request.onsuccess = () => {
            const head = request.result;
            const leaseRequest = tx.objectStore('leases').get(id);
            leaseRequest.onsuccess = () => {
              try {
                options.beforeCommit?.();
                const lease = leaseRequest.result, now = Date.now();
                if (lease && lease.owner !== this.owner && lease.expiresAt > now) throw new ConflictError('Bu proje başka sekmede yazılıyor. Taslağınız korunuyor; son kaydı yeniden açın.');
                if (head && head.storageVersion !== expected) throw new ConflictError('Dayanıklı kayıt değişti. Taslağınız korunuyor; son kaydı yeniden açın.');
                if (head && JSON.stringify(head.document) === JSON.stringify(doc) && !attachments.length && !named && (options.archived === undefined || options.archived === head.archived)) { done(head); return; }
                if (head?.archived && !options.unarchive) throw new ConflictError('Arşivlenmiş proje önce yeniden açılmalı.');
                const changed = head && RS.ProjectCommands.domainKey(head.document) !== RS.ProjectCommands.domainKey(doc);
                if (head && (doc.revision < head.document.revision || (changed && doc.revision <= head.document.revision))) throw new ConflictError('Eski proje revizyonu üzerine yazılamaz.');
                const number = (head?.storageVersion || 0) + 1;
                if (number > 1000) throw new Error('Proje kayıt sınırı doldu; dış yedek alın ve yeni proje oluşturun.');
                const row = { document: doc, storageVersion: number, archived: options.archived ?? head?.archived ?? false, updatedAt: new Date(now).toISOString() };
                const oldReceipts = new Map(RS.ProjectCommands.receipts(head?.document || doc).map(r => [r.commandId, r]));
                for (const receipt of RS.ProjectCommands.receipts(doc)) {
                  const old = head && oldReceipts.get(receipt.commandId);
                  if (old && old.fingerprint !== receipt.fingerprint) throw new ConflictError('Komut kaydı içerik çatışması.');
                  if (!old) tx.objectStore('log').put({ ...receipt, projectId: id, storageVersion: number }, [id, receipt.commandId]);
                }
                for (const receipt of head ? RS.ProjectCommands.receipts(head.document) : []) if (!RS.ProjectCommands.receipts(doc).some(r => r.commandId === receipt.commandId)) throw new ConflictError('Komut makbuzları silinemez.');
                projects.put(row, id);
                tx.objectStore('revisions').put(row, [id, number]);
                if (named) {
                  named.storageVersion = number;
                  if (named.document.revision > doc.revision) throw new Error('Teslim revizyonu güncel kaydı aşıyor.');
                  const store = tx.objectStore('revisions');
                  let count = 0, bytes = named.packetData?.length || 0;
                  const cursor = store.openCursor(IDBKeyRange.bound([id, 'named-'], [id, 'named-\uffff']));
                  cursor.onsuccess = () => {
                    try {
                      const entry = cursor.result;
                      if (entry) { count++; bytes += entry.value.packetData?.length || 0; entry.continue(); }
                      else if (count >= 100 || bytes > 48 * 1024 * 1024) fail(new Error('Teslim geçmişi sınırı doldu; dış yedek alın ve yeni proje oluşturun.'));
                      else store.add(named, [id, named.id]);
                    } catch (error) { fail(error); }
                  };
                }
                for (const item of attachments) {
                  const evidence = tx.objectStore('evidence'), previous = evidence.get([id, item.id]);
                  previous.onsuccess = () => {
                    try {
                      if (previous.result && previous.result.sha256 !== item.sha256) throw new ConflictError('Aynı ek kimliği farklı içerikle kullanılamaz.');
                      evidence.put({ projectId: id, id: item.id, blob: item.blob, sha256: item.sha256 }, [id, item.id]);
                    } catch (error) { fail(error); }
                  };
                }
                tx.objectStore('leases').put({ owner: this.owner, expiresAt: now + LEASE_MS }, id);
                tx.objectStore('meta').put(id, 'activeProjectId');
                tx.objectStore('meta').put(true, 'formatReady');
                done(row);
              } catch (error) { fail(error); }
            };
          };
        });
        this.versions.set(id, result.storageVersion);
        this.durable.set(id, doc);
        // Success is reported only after transaction completion, never from request.onsuccess.
        const verified = await storage.read(db, 'projects', id);
        if (verified?.storageVersion !== result.storageVersion || JSON.stringify(verified.document) !== JSON.stringify(doc)) throw new Error('Dayanıklı kayıt doğrulanamadı.');
        try {
          const key = DRAFT_PREFIX + this.owner + ':' + id;
          if (localStorage.getItem(key) === JSON.stringify(doc)) localStorage.removeItem(key);
        } catch (_) {}
        return { status: 'durable', projectId: id, revision: doc.revision, storageVersion: result.storageVersion };
      });
    }
    async archive(projectId, archived = true) {
      const row = await this.get(projectId, { adopt: true });
      if (!row) throw new Error('Proje bulunamadı.');
      return this.commit(row.document, { archived, unarchive: !archived });
    }
    async recoveryCandidates() {
      const db = await this.database;
      const rawCurrent = await storage.read(db, 'projects', 'current');
      const ready = await storage.read(db, 'meta', 'formatReady');
      const rows = initialLegacy.filter(row => !ready || row.source.startsWith(DRAFT_PREFIX));
      if (!ready && typeof rawCurrent === 'string') rows.unshift({ source: 'IndexedDB/current', raw: rawCurrent });
      const activeId = await storage.read(db, 'meta', 'activeProjectId');
      const active = activeId ? await this.get(activeId, { adopt: true }) : null;
      const candidates = [];
      if (active) candidates.push({ source: 'Son dayanıklı kayıt', document: active.document, durable: true });
      for (const row of rows) {
        try {
          if (new TextEncoder().encode(row.raw).length > RS.ProjectDocument.MAX_BYTES * 2) throw new Error('Kurtarma kaydı boyut sınırını aşıyor.');
          const digest = await hash(row.raw);
          if (await storage.read(db, 'recovery', digest)) continue;
          const parsed = JSON.parse(row.raw);
          let input = parsed;
          if (row.source === 'cisco_rack_studio_3d_state') {
            if (parsed.version !== undefined && parsed.version !== '3.2.0') throw new Error('Desteklenmeyen 3D kayıt sürümü.');
            input = RS.ProjectAdapters.from3D(parsed, parsed.projectDocument || RS.ProjectDocument.normalize({ racks: parsed.racks?.map(r => ({ ...r, devices: [] })), cables: [], customCatalog: RS.STATE.customCatalog || {} }));
          }
          const doc = this.validate(input);
          if (!input.schemaVersion && !parsed.projectDocument) doc.projectId = 'legacy-' + digest;
          candidates.push({ ...row, digest, document: doc });
        } catch (error) { candidates.push({ ...row, error: error.message }); }
      }
      // Keep every raw source; equality only controls whether an automatic choice is safe.
      return candidates;
    }
    async preserveCandidate(candidate) {
      if (!candidate.raw) return;
      const db = await this.database, digest = candidate.digest || await hash(candidate.raw);
      await storage.transaction(db, ['recovery'], 'readwrite', tx => tx.objectStore('recovery').put({ source: candidate.source, raw: candidate.raw, savedAt: new Date().toISOString() }, digest));
      const verified = await storage.read(db, 'recovery', digest);
      if (verified?.raw !== candidate.raw) throw new Error('Kurtarma yedeği doğrulanamadı.');
      if (!candidate.error && candidate.source === 'rack-studio-project-v2') {
        const head = await storage.read(db, 'projects', candidate.document.projectId);
        if (head?.document && RS.ProjectCommands.domainKey(head.document) === RS.ProjectCommands.domainKey(candidate.document)) {
          try { if (localStorage.getItem(candidate.source) === candidate.raw) localStorage.removeItem(candidate.source); } catch (_) {}
        }
      }
    }
  }
  RS.ProjectRepository = new Repository();
  RS.ProjectRepositoryClass = Repository;
  RS.ProjectRepositoryConstants = Object.freeze({ LEASE_MS, MAX_EVIDENCE, DRAFT_PREFIX });
})();
