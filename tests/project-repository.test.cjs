const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const { IDBFactory, IDBObjectStore } = require('fake-indexeddb');

function model(seed = {}) {
  const memory = new Map(Object.entries(seed));
  const localStorage = new Proxy({
    getItem: key => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, String(value)),
    removeItem: key => memory.delete(key)
  }, { ownKeys: () => [...memory.keys()], getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }) });
  const window = { RackStudio: { STATE: { racks: [], cables: [], viewMode: 'single' } }, crypto: webcrypto };
  const context = vm.createContext({ window, crypto: webcrypto, indexedDB: new IDBFactory(), localStorage, TextEncoder, Blob, console, btoa, atob });
  for (const file of ['catalog', 'project-records', 'project-document', 'network-rules', 'topology-io', 'project-commands', 'project-storage-idb', 'project-repository', 'project-archive']) {
    vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../js/2d/' + file + '.js'), 'utf8'), context);
  }
  const api = window.RackStudio;
  const doc = api.ProjectDocument.normalize({ racks: [{ id: 'rack-1', name: 'Test', heightU: 18, devices: [] }], cables: [] });
  return { api, doc, memory };
}

test('quota and interrupted transactions leave head, revision, log and evidence unchanged', async () => {
  const { api, doc } = model();
  const repo = api.ProjectRepository, db = await repo.database;
  await repo.commit(doc);
  const before = await api.ProjectStorageIDB.read(db, 'projects', doc.projectId);
  const next = api.ProjectDocument.normalize(doc);
  next.revision++;
  next.metadata.name = 'uncommitted';
  next.extensions.rackStudioCommandReceipts = [{ commandId: 'command-1', revision: 1, fingerprint: 'payload-1' }];
  const blob = new Blob(['hello'], { type: 'text/plain' });
  next.evidenceRefs = [{ id: 'evidence-1', blobId: 'blob-1', bytes: 5, mime: 'text/plain' }];
  const original = IDBObjectStore.prototype.put;
  for (const mode of ['quota', 'abort']) {
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === 'projects') {
        if (mode === 'quota') throw new DOMException('Injected quota exhaustion', 'QuotaExceededError');
        const request = original.apply(this, args);
        request.onsuccess = () => this.transaction.abort();
        return request;
      }
      return original.apply(this, args);
    };
    try { await assert.rejects(repo.commit(next, { evidence: [{ id: 'blob-1', blob }] })); }
    finally { IDBObjectStore.prototype.put = original; }
    assert.deepEqual(await api.ProjectStorageIDB.read(db, 'projects', doc.projectId), before);
    assert.equal((await api.ProjectStorageIDB.entries(db, 'log')).length, 0);
    assert.equal((await api.ProjectStorageIDB.entries(db, 'revisions')).length, 1);
    assert.equal((await api.ProjectStorageIDB.entries(db, 'evidence')).length, 0);
  }
  const result = await repo.commit(next, { evidence: [{ id: 'blob-1', blob }] });
  assert.equal(result.status, 'durable');
  assert.equal((await api.ProjectStorageIDB.entries(db, 'log')).length, 1);
  assert.equal((await api.ProjectStorageIDB.entries(db, 'evidence')).length, 1);
  const duplicate = await repo.commit(next);
  assert.equal(duplicate.storageVersion, result.storageVersion);
});

test('writer lease and stale storage version reject overwrites even after lease expiry', async () => {
  const { api, doc } = model();
  const first = api.ProjectRepository, second = new api.ProjectRepositoryClass();
  await first.commit(doc);
  await second.get(doc.projectId);
  const next = api.ProjectDocument.normalize(doc); next.revision++; next.metadata.name = 'second';
  await assert.rejects(second.commit(next), /başka sekmede/);
  const db = await first.database;
  const expire = () => api.ProjectStorageIDB.transaction(db, ['leases'], 'readwrite', tx => tx.objectStore('leases').put({ owner: first.owner, expiresAt: 0 }, doc.projectId));
  await expire();
  const accepted = api.ProjectDocument.normalize(next); accepted.metadata.name = 'first';
  await first.commit(accepted);
  await expire();
  await assert.rejects(second.commit(next), /Dayanıklı kayıt değişti/);
  assert.equal((await first.get(doc.projectId)).document.metadata.name, 'first');
});

test('full archive restores isolated projects, archived state, log, revisions and evidence', async () => {
  const { api, doc } = model();
  const repo = api.ProjectRepository;
  doc.metadata.name = 'One';
  const blob = new Blob(['hello'], { type: 'text/plain' });
  doc.evidenceRefs = [{ id: 'e1', blobId: 'b1', filename: 'note.txt', mime: 'text/plain', bytes: 5 }];
  doc.extensions.rackStudioCommandReceipts = [{ commandId: 'c1', fingerprint: 'one', revision: 0 }];
  await repo.commit(doc, { evidence: [{ id: 'b1', blob }] });
  const other = api.ProjectDocument.normalize({ racks: [{ id: 'rack-2', name: 'Other', heightU: 18, devices: [] }], cables: [] });
  other.metadata.name = 'Two';
  await repo.commit(other);
  await repo.archive(other.projectId);
  await repo.preserveCandidate({ source: 'broken-original', raw: '{broken', error: 'invalid' });
  const text = await api.ProjectArchive.exportArchive(repo);
  const corrupted = JSON.parse(text);
  corrupted.evidence[0].value.data = btoa('HELLO');
  const cleanTarget = model();
  await assert.rejects(cleanTarget.api.ProjectArchive.importArchive(JSON.stringify(corrupted)), /SHA-256/);
  assert.equal((await cleanTarget.api.ProjectRepository.list()).length, 0);
  const target = model();
  assert.equal((await target.api.ProjectArchive.importArchive(text)).projects, 2);
  const projects = await target.api.ProjectRepository.list();
  assert.equal(projects.length, 2);
  assert.equal(projects.find(p => p.projectId === other.projectId).archived, true);
  assert.equal((await target.api.ProjectRepository.get(doc.projectId)).document.metadata.name, 'One');
  const targetDb = await target.api.ProjectRepository.database;
  assert.equal(await (await target.api.ProjectStorageIDB.read(targetDb, 'evidence', [doc.projectId, 'b1'])).blob.text(), 'hello');
  assert.equal((await target.api.ProjectStorageIDB.entries(targetDb, 'recovery'))[0].value.raw, '{broken');
  await assert.rejects(target.api.ProjectArchive.importArchive(text), /zaten var/);
  const invalid = JSON.parse(text); invalid.projects[0].key = '../escape';
  await assert.rejects(target.api.ProjectArchive.importArchive(JSON.stringify(invalid)), /kimliği/);
  assert.equal((await target.api.ProjectRepository.list()).length, 2);
});

test('legacy candidates retain corrupt bytes and migrate repeatedly without duplicating projects', async () => {
  const legacy = JSON.stringify({ racks: [{ id: 'rack-1', name: 'Legacy', heightU: 18, devices: [] }], cables: [] });
  const { api, memory } = model({ 'rack-studio-project-v2': legacy, 'cisco-rack-studio-project': '{bad' });
  const repo = api.ProjectRepository;
  const candidates = await repo.recoveryCandidates();
  assert.equal(candidates.length, 2);
  const selected = candidates.find(c => c.document);
  assert.ok(selected.document.projectId.startsWith('legacy-'));
  await repo.commit(selected.document);
  for (const candidate of candidates) await repo.preserveCandidate(candidate);
  assert.equal(memory.get('rack-studio-project-v2'), undefined);
  assert.equal(memory.get('cisco-rack-studio-project'), '{bad');
  const second = await repo.recoveryCandidates();
  assert.equal(second.length, 1);
  assert.equal(second[0].durable, true);
  assert.equal((await repo.list()).length, 1);
});
