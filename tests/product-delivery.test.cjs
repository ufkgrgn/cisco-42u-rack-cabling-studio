const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/product/project-rich-v1.json'), 'utf8'));
const results = path.resolve(__dirname, '../docs/product-plan/results/p13-p16');
async function setup(browser) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
  await page.waitForSelector('.studio-editor[data-ready="true"]');
  await page.evaluate(async doc => {
    const R = window.RackStudio, blob = new Blob(['Şebeke test kanıtı'], { type: 'text/plain' });
    doc.evidenceRefs[0] = { ...doc.evidenceRefs[0], bytes: blob.size, mime: blob.type, filename: 'test.txt', sha256: await R.ReportModel.hash(await blob.arrayBuffer()) };
    R.loadCustomTopology(doc); await R.saveProjectNow();
    await R.ProjectRepository.commit(R.ProjectDocument.capture(R.STATE), { evidence: [{ id: 'blob-1', blob }] });
  }, fixture);
  return page;
}
test('frozen named revision survives later edits and outputs full Turkish identities safely', async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await setup(browser);
    const result = await page.evaluate(async () => {
      const R = window.RackStudio, row = await R.ProjectRevisions.create({ name: 'Onaylı kaynak' });
      window.model = await R.ReportModel.capture(row.id);
      const old = R.ReportOutput.cablesCSV(model), doc = R.ProjectDocument.capture(R.STATE);
      doc.metadata.name = 'Sonraki düzenleme'; doc.revision++;
      R.loadCustomTopology(doc); await R.saveProjectNow();
      return { frozen: Object.isFrozen(model.document.topology.cables[0]), same: old === R.ReportOutput.cablesCSV(model), name: model.document.metadata.name, source: model.source.name, html: R.ReportOutput.html(model, { company: '<img onerror=alert(1)>' }), csv: R.ReportOutput.csv(['x'], [['=1+1'], ['Türkçe, "ş"']]) };
    });
    assert.equal(result.frozen, true); assert.equal(result.same, true); assert.equal(result.source, 'Onaylı kaynak'); assert.equal(result.name, fixture.metadata.name);
    assert.ok(result.html.includes('&lt;img')); assert.ok(!result.html.includes('<img onerror')); assert.ok(result.csv.includes("'=1+1")); assert.ok(result.csv.includes('""ş""'));
  } finally { await browser.close(); }
});
test('BOM preserves zero and unknown lengths, deduplicates declared port transceivers and prices only user input', async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await setup(browser);
    const result = await page.evaluate(async () => {
      const R = window.RackStudio, doc = R.ProjectDocument.capture(R.STATE), device = doc.topology.racks[0].devices[0];
      device.accessories = [{ model: 'Tray', quantity: 2 }, { model: 'Unknown accessory' }];
      device.transceivers = [{ model: 'SFP', quantity: 1, portId: 'p1' }]; device.portsConfig.p1.transceiver = { model: 'SFP', quantity: 1 };
      const model = await R.ReportModel.build(doc), b = R.BOM.build(model, { wastePercent: 10, prices: { 'device:pilot-switch': 10 } });
      const unknown = structuredClone(doc); delete unknown.topology.cables[0].estimatedLengthMeters; delete unknown.topology.cables[0].measuredLengthMeters; delete unknown.topology.cables[0].purchaseLengthMeters;
      const u = R.BOM.build(await R.ReportModel.build(unknown));
      const estimate = structuredClone(unknown); estimate.topology.cables[0].estimatedLengthMeters = 2.9;
      const e = R.BOM.build(await R.ReportModel.build(estimate), { wastePercent: 10 });
      return { b, u, e };
    });
    assert.equal(result.b.rows.find(r => r.kind === 'device').quantity, 2);
    assert.equal(result.b.rows.find(r => r.kind === 'transceiver').quantity, 1);
    assert.equal(result.b.totals.measured.meters, 0); assert.equal(result.b.totals.measured.known, 1);
    assert.equal(result.b.lengths[0].source, 'measured'); assert.equal(result.b.totalPrice, 20); assert.ok(result.b.unpricedRows > 0);
    assert.equal(result.u.rows.find(r => r.kind === 'cable').stockLength, null); assert.equal(result.u.totals.estimated.unknown, 1);
    assert.equal(result.e.lengths[0].suggested, 5); assert.ok(result.b.unknown.some(r => r.name === 'Unknown accessory'));
  } finally { await browser.close(); }
});
test('paired labels retain both full endpoints and QR identities with exact preview dimensions', async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await setup(browser);
    const data = await page.evaluate(async () => { const R = window.RackStudio; window.model = await R.ReportModel.capture(); return { labels: R.LabelModel.build(model), html: R.LabelOutput.html(model), qr: R.FieldQR.resolve(R.FieldQR.decode(R.FieldQR.canvas(R.LabelModel.build(model).items[1].qr))) }; });
    const pair = data.labels.items.filter(r => r.kind === 'cable'); assert.equal(pair.length, 2); assert.equal(pair[0].local, pair[1].remote); assert.equal(pair[1].local, pair[0].remote); assert.equal(data.qr.id, 'cable-1');
    const print = await browser.newPage(); await print.setContent(data.html);
    const box = await print.locator('.label').first().boundingBox(); assert.ok(Math.abs(box.width - 90 * 96 / 25.4) < .1); assert.ok(Math.abs(box.height - 45 * 96 / 25.4) < .1);
    fs.mkdirSync(results, { recursive: true }); await print.pdf({ path: path.join(results, 'labels.pdf'), preferCSSPageSize: true });
  } finally { await browser.close(); }
});
test('delivery ZIP checks hashes, selects proof explicitly and imports unchanged identities and models', async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await setup(browser);
    const data = await page.evaluate(async () => {
      const R = window.RackStudio, model = await R.ReportModel.capture();
      const packet = await R.HandoverPackage.build(model, { evidenceIds: ['photo-1'] }); window.packetBytes = packet.bytes;
      const parsed = await R.HandoverPackage.validate(packet.bytes), omitted = await R.HandoverPackage.build(model);
      const files = window.fflate.unzipSync(packet.bytes); files['project.json'][0] ^= 1;
      let tampered; try { await R.HandoverPackage.validate(window.fflate.zipSync(files)); } catch (e) { tampered = e.message; }
      let exists; try { await R.HandoverPackage.importBytes(packet.bytes); } catch (e) { exists = e.message; }
      return { manifest: packet.manifest, parsed: parsed.document, proof: parsed.evidence.length, missing: omitted.manifest.omittedEvidenceIds, issues: omitted.manifest.issues, tampered, exists, viewer: new TextDecoder().decode(parsed.files['viewer.html']), base64: R.HandoverPackage.base64(packet.bytes) };
    });
    assert.equal(data.proof, 1); assert.equal(data.parsed.topology.cables[0].id, 'cable-1'); assert.equal(data.parsed.topology.customCatalog['pilot-switch'].name, 'Pilot Switch'); assert.deepEqual(data.missing, ['photo-1']); assert.ok(data.issues.some(i => i.kind === 'evidence')); assert.match(data.tampered, /bütünlüğü/); assert.match(data.exists, /zaten var/); assert.ok(data.viewer.includes('Salt okunur')); assert.ok(!data.viewer.includes('<script'));
    const fresh = await browser.newPage(); await fresh.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href); await fresh.waitForSelector('.studio-editor[data-ready="true"]');
    const restored = await fresh.evaluate(async data => { const R = window.RackStudio; await R.HandoverPackage.importBytes(R.HandoverPackage.unbase64(data)); const snapshot = await R.ProjectRepository.snapshotProject(R.STATE.projectDocument.projectId); return { doc: snapshot.document, proof: snapshot.evidence.length }; }, data.base64);
    assert.equal(restored.doc.projectId, fixture.projectId); assert.equal(restored.doc.topology.cables[0].id, 'cable-1'); assert.equal(restored.proof, 1);
    fs.mkdirSync(results, { recursive: true }); fs.writeFileSync(path.join(results, 'delivery.zip'), Buffer.from(data.base64, 'base64'));
  } finally { await browser.close(); }
});
test('handover history and frozen ZIP commit atomically; acceptance is separate and undo retains history', async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await setup(browser);
    const result = await page.evaluate(async () => {
      const R = window.RackStudio, model = await R.ReportModel.capture(), before = R.ProjectDocument.capture(R.STATE);
      const original = IDBObjectStore.prototype.add; IDBObjectStore.prototype.add = function (value, key) { if (value.packetData) throw new Error('injected failure'); return original.call(this, value, key); };
      let failure; try { await R.HandoverRepository.create(model, { evidenceIds: ['photo-1'] }); } catch (e) { failure = e.message; } finally { IDBObjectStore.prototype.add = original; }
      const unchanged = JSON.stringify(before) === JSON.stringify(R.ProjectDocument.capture(R.STATE)), namedCount = (await R.ProjectRevisions.list(before.projectId)).length;
      const data = await R.HandoverRepository.create(model, { evidenceIds: ['photo-1'] }), first = await R.HandoverRepository.bytes(data.record.id);
      await R.HandoverRepository.accept(data.record.id, 'Ufuk', 'İncelendi, teslim alındı.');
      const current = R.ProjectDocument.capture(R.STATE), restored = structuredClone(before); R.HandoverRepository.preserveHistory(restored, current);
      const copy=R.ProjectManagement.duplicateDocument(current).document, copiedPrepared=copy.handoverRecords.find(r=>r.status==='prepared'),copiedAccepted=copy.handoverRecords.find(r=>r.status==='accepted');
      const archive = JSON.parse(await R.ProjectArchive.exportArchive()), saved = archive.revisions.find(r => r.value.packetData);
      return { failure, unchanged, namedCount, records: current.handoverRecords, hash: await R.ReportModel.hash(first), second: await R.ReportModel.hash(await R.HandoverRepository.bytes(data.record.id)), kept: restored.handoverRecords.length, backupHash: saved.value.packetHash, backupHasBytes: !!saved.value.packetData, copiedParent: copiedAccepted.parentHandoverId===copiedPrepared.id, copiedSource: copiedPrepared.sourceProjectId===current.projectId };
    });
    assert.match(result.failure, /injected/); assert.equal(result.unchanged, true); assert.equal(result.namedCount, 0); assert.equal(result.hash, result.second); assert.equal(result.hash, result.backupHash); assert.equal(result.backupHasBytes, true); assert.equal(result.copiedParent,true); assert.equal(result.copiedSource,true); assert.equal(result.records.filter(r => r.status === 'prepared').length, 1); assert.equal(result.records.filter(r => r.status === 'accepted').length, 1); assert.equal(result.kept, result.records.length); assert.equal(result.records.at(-1).signatureType, 'local-attestation');
  } finally { await browser.close(); }
});
test('report PDF renders a long multi-rack Turkish project and delivery UI fits mobile widths', async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await setup(browser), errors = []; page.on('pageerror', e => errors.push(e.message));
    const bytes = await page.evaluate(async () => {
      const R = window.RackStudio, doc = R.ProjectDocument.capture(R.STATE), seed = structuredClone(doc.topology.racks[0].devices[0]);
      doc.fieldEvents = []; doc.evidenceRefs = []; doc.observations = []; doc.integrationMappings = []; doc.handoverRecords = [];
      doc.topology.racks = Array.from({ length: 6 }, (_, i) => ({ id: 'r' + i, name: 'Şebeke kabineti ' + i, heightU: 42, devices: Array.from({ length: 20 }, (_, j) => ({ ...seed, instanceId: 'd' + i + '-' + j, hostname: 'Ölçüm cihazı ' + i + '-' + j, name: 'Cihaz', topU: 42 - j * 2 })) }));
      doc.topology.activeRackId = 'r0'; doc.topology.cables = doc.topology.racks.flatMap((r, i) => Array.from({ length: 10 }, (_, j) => ({ ...structuredClone(doc.topology.cables[0]), id: 'c' + i + '-' + j, name: 'Türkçe bağlantı ölçümü ' + j, from: { rackId: r.id, instanceId: 'd' + i + '-' + j * 2, portId: 'p1' }, to: { rackId: r.id, instanceId: 'd' + i + '-' + (j * 2 + 1), portId: 'p2' } })));
      const model = await R.ReportModel.build(doc); return { pdf: R.HandoverPackage.base64(await R.ReportPDF.bytes(model, { company: 'DE Bilişim · Çalışma Raporu' })), labels: R.LabelOutput.html(model) };
    });
    fs.mkdirSync(results, { recursive: true }); fs.writeFileSync(path.join(results, 'report.pdf'), Buffer.from(bytes.pdf, 'base64'));
    const print = await browser.newPage(); await print.setContent(bytes.labels); await print.pdf({ path: path.join(results, 'labels-multipage.pdf'), preferCSSPageSize: true }); await print.close();
    await page.evaluate(() => window.RackStudio.DeliveryUI.open());
    const dialog = page.getByRole('dialog', { name: 'Teslim merkezi', exact: true });
    await dialog.getByRole('button', { name: 'Revizyonu dondur', exact: true }).click(); await page.waitForFunction(() => !document.querySelector('#delivery-dialog').hasAttribute('aria-busy'));
    assert.match(await dialog.locator('[role=status]').textContent(), /donduruldu/);
    for (const width of [320, 390, 768, 1440]) { await page.setViewportSize({ width, height: 900 }); assert.equal(await dialog.evaluate(e => e.scrollWidth <= e.clientWidth + 1), true, 'dialog width ' + width); }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
test('delivery UI downloads real files, works in 3D and four themes, and presentation blocks record changes', async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await setup(browser), errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.evaluate(() => window.RackStudio.DeliveryUI.open());
    const dialog = page.getByRole('dialog', { name: 'Teslim merkezi', exact: true });
    await dialog.getByRole('button', { name: 'Revizyonu dondur', exact: true }).click(); await page.waitForFunction(() => !document.querySelector('#delivery-dialog').hasAttribute('aria-busy'));
    for (const theme of ['light', 'dark', 'blueprint', 'high-contrast']) {
      await page.evaluate(value => document.documentElement.dataset.theme = value, theme); await page.setViewportSize({ width: 390, height: 900 });
      await dialog.screenshot({ path: path.join(results, 'delivery-' + theme + '-390.png') });
      const colors = await dialog.evaluate(e => ({ text: getComputedStyle(e).color, bg: getComputedStyle(e).backgroundColor })); assert.notEqual(colors.text, colors.bg);
    }
    await page.setViewportSize({ width: 1440, height: 950 });
    for (const [button, suffix] of [['PDF indir', '.pdf'], ['Malzeme CSV', '-malzemeler.csv'], ['Etiket HTML', '-etiketler.html']]) {
      const [download] = await Promise.all([page.waitForEvent('download'), dialog.getByRole('button', { name: button, exact: true }).click()]);
      assert.ok(download.suggestedFilename().endsWith(suffix)); assert.equal(await download.failure(), null); await page.waitForFunction(() => !document.querySelector('#delivery-dialog').hasAttribute('aria-busy'));
    }
    await dialog.getByRole('button', { name: 'Kapat', exact: true }).click();
    await page.evaluate(async () => { const R = window.RackStudio; await R.setStudioMode(true); R.WorkflowViews.set('presentation'); await R.DeliveryUI.open(); });
    await dialog.getByRole('button', { name: 'Revizyonu dondur', exact: true }).click(); await page.waitForFunction(() => !document.querySelector('#delivery-dialog').hasAttribute('aria-busy'));
    assert.match(await dialog.locator('[role=status]').textContent(), /donduruldu/);
    await dialog.getByRole('button', { name: 'Teslim ZIP oluştur ve kaydet', exact: true }).click(); await page.waitForFunction(() => !document.querySelector('#delivery-dialog').hasAttribute('aria-busy'));
    assert.match(await dialog.locator('[role=status]').textContent(), /Tasarım\/Saha/);
    assert.equal(await page.evaluate(() => window.RackStudio.STATE.projectDocument.handoverRecords.filter(r => r.status === 'prepared').length), 0);
    const validation = await page.evaluate(async () => {
      const R = window.RackStudio; R.WorkflowViews.set('design'); const model = await R.ReportModel.capture();
      let labels; try { const doc = structuredClone(model.document); doc.topology.cables[0].id = 'x'.repeat(160); doc.fieldEvents = []; const long = await R.ReportModel.build(doc); R.LabelOutput.html(long, { widthMm: 50, heightMm: 35, fontPt: 14 }); } catch (e) { labels = e.message; }
      const packet = await R.HandoverPackage.build(model), files = window.fflate.unzipSync(packet.bytes), manifest = JSON.parse(new TextDecoder().decode(files['manifest.json'])); manifest.technicalComplete = true; files['manifest.json'] = new TextEncoder().encode(JSON.stringify(manifest));
      let forged; try { await R.HandoverPackage.validate(window.fflate.zipSync(files)); } catch (e) { forged = e.message; }
      return { labels, forged };
    });
    assert.match(validation.labels, /sığmıyor/); assert.match(validation.forged, /teknik durumu/); assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
