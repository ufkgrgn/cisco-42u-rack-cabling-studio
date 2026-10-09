const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const { IDBFactory, IDBKeyRange } = require('fake-indexeddb');

// IPC contract double; real SQLite crash/reconciliation is covered by cargo test.
function bridge() {
  if (process.env.RACK_STUDIO_NATIVE_TEST_EXE) {
    const { spawnSync } = require('node:child_process');
    const root = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'rack-studio-ipc-'));
    process.once('exit', () => fs.rmSync(root, { recursive: true, force: true }));
    return {
      fail: false,
      async invoke(command, args) {
        if (this.fail && command === 'repository_commit') throw new Error('Injected native write failure');
        const result = spawnSync(process.env.RACK_STUDIO_NATIVE_TEST_EXE, [root], { input:JSON.stringify({ command, args }), encoding:'utf8', maxBuffer:160*1024*1024 });
        if (result.status !== 0) throw new Error(result.stderr || result.error?.message || 'Native fixture failed');
        const response = JSON.parse(result.stdout);
        if (response.error) throw new Error(response.error);
        return response.value;
      }
    };
  }
  let version = 0;
  const rows = Object.fromEntries(['projects','log','revisions','evidence','leases','meta','recovery'].map(name => [name, []]));
  return {
    fail: false,
    async invoke(command, args) {
      if (command === 'repository_snapshot') return structuredClone({ version, rows: Object.fromEntries(args.stores.map(name => [name, rows[name]])) });
      if (command === 'repository_commit') {
        if (this.fail) throw new Error('Injected native write failure');
        if (version !== args.expected) throw new Error('Repository conflict');
        for (const [name, values] of Object.entries(args.rows)) rows[name] = structuredClone(values);
        version++; return;
      }
      throw new Error('Unexpected IPC command');
    }
  };
}
function model(native) {
  const memory = new Map();
  const localStorage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) };
  const window = { RackStudio: { STATE: { racks: [], cables: [], viewMode: 'single' } } };
  if (native) { window.__TAURI_INTERNALS__ = {}; window.__TAURI__ = { core: { invoke: native.invoke.bind(native) } }; }
  const context = vm.createContext({ window, crypto: webcrypto, indexedDB: new IDBFactory(), IDBKeyRange, localStorage, TextEncoder, Blob, console, btoa, atob });
  for (const file of ['catalog','project-records','project-document','network-rules','topology-io','project-commands','project-storage-idb','project-storage-native','project-repository','project-archive']) {
    vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../js/2d/' + file + '.js'), 'utf8'), context);
  }
  return window.RackStudio;
}
function document(api) {
  const doc = api.ProjectDocument.normalize({ racks: [{ id: 'rack-1', name: 'Fixture', heightU: 18, devices: [] }], cables: [] });
  doc.metadata.name = 'Offline fixture';
  doc.evidenceRefs = [{ id:'e1', blobId:'b1', filename:'note.txt', mime:'text/plain', bytes:5 }];
  doc.extensions.rackStudioCommandReceipts = [{ commandId:'c1', fingerprint:'one', revision:0 }];
  return doc;
}
test('browser archive transfers to desktop and back with identical head, log, revisions and evidence', async () => {
  const browser = model(), native = bridge(), desktop = model(native);
  assert.equal(desktop.ProjectStorageIDB.backend, 'sqlite');
  assert.equal(browser.ProjectStorageIDB.backend, undefined);
  const doc = document(browser);
  await browser.ProjectRepository.commit(doc, { evidence: [{ id:'b1', blob:new Blob(['hello'], { type:'text/plain' }) }] });
  const archived = await browser.ProjectArchive.exportArchive();
  await desktop.ProjectArchive.importArchive(archived);
  const snapshot = await desktop.ProjectRepository.snapshotProject(doc.projectId);
  assert.equal(await snapshot.evidence[0].blob.text(), 'hello');
  const desktopArchive = await desktop.ProjectArchive.exportArchive();
  const left = JSON.parse(archived), right = JSON.parse(desktopArchive);
  delete left.exportedAt; delete right.exportedAt;
  assert.deepEqual(right, left);
  const reopened = model(native);
  assert.equal((await reopened.ProjectRepository.get(doc.projectId)).document.metadata.name, 'Offline fixture');
  const target = model();
  await target.ProjectArchive.importArchive(desktopArchive);
  assert.equal((await target.ProjectRepository.snapshotProject(doc.projectId)).evidence[0].blob.size, 5);
  const invalid = JSON.parse(desktopArchive); invalid.evidence[0].value.data = btoa('HELLO');
  const empty = model(bridge());
  await assert.rejects(empty.ProjectArchive.importArchive(JSON.stringify(invalid)), /SHA-256/);
  assert.equal((await empty.ProjectRepository.list()).length, 0);
});
test('native failure preserves durable head and drafts; subsequent transaction reloads SQLite authority', async () => {
  const native = bridge(), api = model(native), repo = api.ProjectRepository;
  const doc = document(api);
  await repo.commit(doc, { evidence: [{ id:'b1', blob:new Blob(['hello'], { type:'text/plain' }) }] });
  const next = api.ProjectDocument.normalize(doc); next.revision++; next.metadata.name = 'Draft';
  repo.rememberDraft(next);
  native.fail = true;
  await assert.rejects(repo.commit(next), /native write failure/);
  assert.equal((await repo.get(doc.projectId)).document.metadata.name, 'Offline fixture');
  assert.equal((await api.ProjectStorageIDB.entries(await repo.database, 'revisions')).length, 1);
  native.fail = false;
  assert.equal((await repo.commit(next)).status, 'durable');
  assert.equal((await model(native).ProjectRepository.get(doc.projectId)).document.metadata.name, 'Draft');
});
test('desktop writers retain lease and stale-version conflict semantics', async () => {
  const native = bridge(), api = model(native), repo = api.ProjectRepository;
  const doc = document(api);
  await repo.commit(doc, { evidence: [{ id:'b1', blob:new Blob(['hello'], { type:'text/plain' }) }] });
  const other = model(native).ProjectRepository;
  await other.get(doc.projectId);
  const next = api.ProjectDocument.normalize(doc); next.revision++; next.metadata.name = 'Other';
  await assert.rejects(other.commit(next), /başka sekmede/);
  await repo.release(doc.projectId);
  await repo.commit(next);
  await repo.release(doc.projectId);
  await assert.rejects(other.commit(next), /Dayanıklı kayıt değişti/);
});
test('missing desktop bridge rejects initialization instead of browser fallback', async () => {
  const native = { invoke: async () => { throw new Error('bridge unavailable'); } };
  const api = model(native);
  await assert.rejects(api.ProjectRepository.database, /bridge unavailable/);
});
