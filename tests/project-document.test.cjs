const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
function model() {
  const context = vm.createContext({ window: { RackStudio: {}, crypto: { randomUUID: () => 'project-test' } } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/2d/project-records.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/2d/project-document.js'), 'utf8'), context);
  return context.window.RackStudio.ProjectDocument;
}
test('legacy migration and repeated capture retain identity, metadata and unknown fields', () => {
  const api = model();
  const legacy = { version: '4.0-studio', racks: [{ id: 'r1', devices: [] }], cables: [], doorOpen: true, vendor: { token: 'preserved' } };
  const document = api.normalize(legacy);
  document.fieldEvents.push({ id: 'event-1', result: 'unknown' });
  const state = { ...legacy, projectDocument: document };
  const first = api.capture(state);
  const second = api.capture(state);
  assert.equal(first.projectId, second.projectId);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.equal(first.extensions.vendor.token, 'preserved');
  assert.equal(first.topology.doorOpen, true);
  assert.equal(first.fieldEvents[0].result, 'unknown');
  assert.equal(legacy.schemaVersion, undefined);
});
test('future schema and unsafe keys are rejected without modifying source', () => {
  const api = model();
  const future = { schemaVersion: 99, racks: [] };
  assert.throws(() => api.normalize(future), /sürümü/);
  assert.throws(() => api.normalize({ version: '99.0.0', racks: [] }), /sürümü/);
  assert.equal(future.schemaVersion, 99);
  assert.throws(() => api.normalize(JSON.parse('{"__proto__":{"polluted":true}}')), /Güvensiz/);
  assert.equal({}.polluted, undefined);
});
test('malformed canonical revisions and collections are rejected', () => {
  const api = model();
  const document = api.normalize({ racks: [], cables: [] });
  document.revision = -1;
  assert.throws(() => api.normalize(document), /revizyon/);
  document.revision = 0;
  document.fieldEvents = {};
  assert.throws(() => api.normalize(document), /koleksiyonu/);
});
const rich = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/product/project-rich-v1.json'), 'utf8'));
test('record contracts preserve a full document and reject invalid references, cycles and bounds', () => {
  const api = model();
  assert.equal(JSON.stringify(api.normalize(rich)), JSON.stringify(rich));
  const mutations = [
    doc => doc.locations.push({ ...doc.locations[0] }),
    doc => { doc.locations[0].parentId = 'room-1'; },
    doc => { doc.fieldEvents[0].evidenceIds = ['missing']; },
    doc => { doc.evidenceRefs[0].projectId = 'different-project'; },
    doc => { doc.evidenceRefs[0].bytes = 21 * 1024 * 1024; },
    doc => { doc.evidenceRefs[0].sha256 = 'invalid'; },
    doc => { doc.fieldEvents[0].result = 'invented'; },
    doc => { doc.fieldEvents[0].expectedRevision = 8; },
    doc => { doc.handoverRecords[0].revision = 8; },
    doc => doc.integrationMappings.push({ ...doc.integrationMappings[0], id: 'mapping-2' }),
    doc => { doc.observations[0].collectedAt = 'not-a-date'; },
    doc => { doc.topology.cables[0].lengthMeters = NaN; }
  ];
  for (const mutate of mutations) {
    const bad = structuredClone(rich);
    mutate(bad);
    assert.throws(() => api.normalize(bad));
  }
});
test('legacy observations migrate without overwriting planned fields or losing raw values', () => {
  const api = model();
  const legacy = { version: '3.0.0', racks: [{ id: 'rack-1', devices: [{ instanceId: 'device-1', hostname: 'planned', observed: { hostname: 'observed', source: 'inventory.csv', vendor: { raw: 42 } } }] }], cables: [] };
  const migrated = api.normalize(legacy);
  assert.equal(migrated.topology.racks[0].devices[0].hostname, 'planned');
  assert.equal(migrated.observations[0].raw.vendor.raw, 42);
  assert.equal(migrated.observations[0].entityRef.id, 'device-1');
  assert.equal(api.normalize(migrated).observations.length, 1);
});
test('single rack legacy migration keeps geometry, custom catalog and observed data', () => {
  const api = model();
  const legacy = { heightU: 18, devices: [{ instanceId: 'device-1', observed: { serialNumber: 'OBS-1' } }], cables: [], customCatalog: { 'custom-1': { sourceVersion: 'v1' } }, portGeometryOverrides: { 'custom-1': { source: 'local' } }, customerNote: 'Sakla' };
  const migrated = api.normalize(legacy);
  assert.equal(migrated.topology.racks[0].heightU, 18);
  assert.equal(migrated.observations[0].raw.serialNumber, 'OBS-1');
  assert.equal(migrated.topology.customCatalog['custom-1'].sourceVersion, 'v1');
  assert.equal(migrated.extensions.customerNote, 'Sakla');
});
test('JSON parsing rejects oversized bytes, deep data and malformed input', () => {
  const api = model();
  assert.throws(() => api.parse('invalid JSON'));
  assert.throws(() => api.parse(' '.repeat(api.MAX_BYTES + 1)), /32 MB/);
  let deep = {};
  for (let i = 0; i < 66; i++) deep = { child: deep };
  assert.throws(() => api.normalize(deep), /derinliği/);
});
test('failed snapshot storage retains the previous durable snapshot', () => {
  const stored = new Map();
  let failWrites = false;
  const context = vm.createContext({
    window: { RackStudio: { STATE: { ...rich.topology, projectDocument: rich } }, innerWidth: 1440, crypto: { randomUUID: () => 'project-test' } },
    document: { getElementById: () => null },
    localStorage: { getItem: key => stored.get(key) || null, setItem: (key, value) => { if (failWrites) throw new Error('quota'); stored.set(key, value); } }
  });
  for (const file of ['project-records.js', 'project-document.js', 'snapshot-manager.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/2d/', file), 'utf8'), context);
  const api = context.window.RackStudio;
  assert.ok(api.captureSnapshot('Durable'));
  const durable = stored.get('rack_studio_snapshots_v1');
  failWrites = true;
  assert.equal(api.captureSnapshot('Must fail'), null);
  assert.equal(stored.get('rack_studio_snapshots_v1'), durable);
});
