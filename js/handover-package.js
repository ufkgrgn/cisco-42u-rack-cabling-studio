(function () {
    'use strict';
    const R = window.RackStudio, MAX_BYTES = 24 * 1024 * 1024;
    const encode = text => new TextEncoder().encode(text);
    const decode = bytes => new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    function base64(bytes) { let s = ''; for (let i = 0; i < bytes.length; i += 8192)
        s += String.fromCharCode(...bytes.subarray(i, i + 8192)); return btoa(s); }
    const unbase64 = text => Uint8Array.from(atob(text), c => c.charCodeAt(0));
    async function build(model, options = {}) {
        const selected = new Set(options.evidenceIds || []);
        if ([...selected].some(id => !model.attachments.some(a => a.ref.id === id)))
            throw new Error('Seçilen kanıt eksik veya doğrulanmamış.');
        const attachments = model.attachments.filter(a => selected.has(a.ref.id));
        // Omitted evidence retains its reference. Its absence is explicitly reported as an open item.
        const report = await R.ReportModel.build(model.document, attachments.map(a => ({ projectId: model.document.projectId, id: a.ref.blobId, blob: a.blob })), model.source);
        const labels = R.LabelModel.build(report, options.labels);
        const files = { 'project.json': encode(JSON.stringify(report.document, null, 2)), 'report.html': encode(R.ReportOutput.html(report, options)), 'report.pdf': await R.ReportPDF.bytes(report, options), 'cables.csv': encode(R.ReportOutput.cablesCSV(report)), 'bom.csv': encode(R.ReportOutput.bomCSV(report, options.bom)), 'labels.html': encode(R.LabelOutput.html(report, options.labels)), 'labels.json': encode(JSON.stringify(labels, null, 2)), 'views.json': encode(JSON.stringify(report.source.views || [])) };
        report.document.topology.racks.forEach((rack, i) => { files['racks/rack-' + (i + 1) + '.svg'] = encode(R.ReportOutput.rackSVG(report, rack)); });
        const evidence = [];
        for (const [i, a] of attachments.entries()) {
            const path = 'evidence/item-' + (i + 1) + '.bin';
            files[path] = new Uint8Array(await a.blob.arrayBuffer());
            evidence.push({ id: a.ref.id, blobId: a.ref.blobId, path, filename: a.ref.filename, mime: a.ref.mime });
        }
        files['THIRD-PARTY.txt'] = encode(window.RackStudioDeliveryNotices || '');
        const links = '<nav><a href="report.html">Rapor</a> · <a href="report.pdf">PDF</a> · <a href="labels.html">Etiketler</a> · <a href="cables.csv">Bağlantı listesi</a> · <a href="bom.csv">Malzeme listesi</a></nav>';
        files['viewer.html'] = encode(R.ReportOutput.html(report, options).replace('<body>', '<body><h1>Salt okunur teslim görüntüleyici</h1>' + links));
        const entries = [];
        let total = 0;
        for (const [path, bytes] of Object.entries(files)) {
            total += bytes.length;
            if (total > MAX_BYTES)
                throw new Error('Teslim içeriği 24 MiB sınırını aşıyor; kanıt seçimini azaltın.');
            entries.push({ path, bytes: bytes.length, sha256: await R.ReportModel.hash(bytes) });
        }
        const manifest = { format: 'rack-studio-handover', version: 1, id: crypto.randomUUID(), projectId: report.document.projectId, revision: report.document.revision, createdAt: report.createdAt, source: report.source, technicalComplete: report.technicalComplete, acceptance: 'not-recorded', issues: report.issues, evidence, omittedEvidenceIds: report.document.evidenceRefs.filter(a => !selected.has(a.id)).map(a => a.id), files: entries };
        files['manifest.json'] = encode(JSON.stringify(manifest, null, 2));
        if (total + files['manifest.json'].length > MAX_BYTES)
            throw new Error('Manifest dahil açılmış teslim içeriği 24 MiB sınırını aşıyor.');
        const bytes = window.fflate.zipSync(files, { level: 6 });
        if (bytes.length > MAX_BYTES)
            throw new Error('Teslim ZIP boyutu sınırı aşıyor.');
        return { bytes, manifest, report, sha256: await R.ReportModel.hash(bytes) };
    }
    async function validate(bytes) {
        if (!(bytes instanceof Uint8Array) || bytes.length > MAX_BYTES)
            throw new Error('Teslim paketi boyutu geçersiz.');
        let total = 0, count = 0;
        const names = new Set();
        const files = window.fflate.unzipSync(bytes, { filter: entry => {
                if (++count > 5000 || names.has(entry.name) || !/^[a-zA-Z0-9/_\-.]+$/.test(entry.name) || entry.name.includes('..') || entry.name.startsWith('/') || entry.originalSize > MAX_BYTES || (total += entry.originalSize) > MAX_BYTES)
                    throw new Error('ZIP yolu veya açılmış boyutu geçersiz.');
                names.add(entry.name);
                return true;
            } });
        const manifest = JSON.parse(decode(files['manifest.json'] || new Uint8Array()));
        if (manifest.format !== 'rack-studio-handover' || manifest.version !== 1 || typeof manifest.id !== 'string' || !/^[a-zA-Z0-9_-]{1,160}$/.test(manifest.id) || manifest.acceptance !== 'not-recorded' || !Array.isArray(manifest.files) || !Array.isArray(manifest.evidence) || manifest.files.length !== Object.keys(files).length - 1 || ['project.json', 'report.html', 'report.pdf', 'viewer.html', 'cables.csv', 'bom.csv', 'labels.html', 'labels.json', 'views.json'].some(path => !files[path]))
            throw new Error('Teslim manifesti geçersiz.');
        const paths = new Set();
        for (const row of manifest.files) {
            if (paths.has(row.path) || row.path === 'manifest.json' || !files[row.path] || files[row.path].length !== row.bytes || await R.ReportModel.hash(files[row.path]) !== row.sha256)
                throw new Error('Teslim dosyası bütünlüğü doğrulanamadı.');
            paths.add(row.path);
        }
        const document = R.ProjectRepository.validate(JSON.parse(decode(files['project.json']))), evidence = [];
        if (manifest.projectId !== document.projectId || manifest.revision !== document.revision)
            throw new Error('Teslim proje kimliği/revizyonu uyuşmuyor.');
        const seen = new Set();
        for (const row of manifest.evidence) {
            const ref = document.evidenceRefs.find(a => a.id === row.id);
            if (!ref || seen.has(row.id) || !paths.has(row.path) || ref.blobId !== row.blobId || ref.mime !== row.mime || files[row.path].length !== ref.bytes || await R.ReportModel.hash(files[row.path]) !== ref.sha256)
                throw new Error('Teslim kanıt referansı uyuşmuyor.');
            seen.add(row.id);
            evidence.push({ id: ref.blobId, blob: new Blob([files[row.path]], { type: ref.mime }) });
        }
        const report = await R.ReportModel.build(document, evidence.map(a => ({ ...a, projectId: document.projectId })), manifest.source);
        if (report.technicalComplete !== manifest.technicalComplete)
            throw new Error('Manifest teknik durumu kanıtlarla uyuşmuyor.');
        return { manifest, document, evidence, files };
    }
    async function importBytes(bytes) {
        if (!R.WorkflowViews.canEdit())
            throw new Error('Teslim içe aktarmak için Tasarım/Saha görünümüne geçin.');
        const expected = R.ProjectManagement.prepare(), packet = await validate(bytes);
        if (await R.ProjectRepository.get(packet.document.projectId))
            throw new Error('Bu proje kimliği zaten var. Teslimi salt okunur görüntüleyin veya farklı çalışma alanına aktarın.');
        if (!R.WorkflowViews.canEdit())
            throw new Error('Teslim içe aktarmak için Tasarım/Saha görünümüne geçin.');
        return R.importProjectDocument(packet.document, expected, { evidence: packet.evidence });
    }
    R.HandoverPackage = Object.freeze({ build, validate, importBytes, base64, unbase64, MAX_BYTES });
})();
