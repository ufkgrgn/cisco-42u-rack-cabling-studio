(function () {
    'use strict';
    const R = window.RackStudio, esc = value => R.ReportOutput.escape(value);
    let dialog, model, busy = false, epoch = 0;
    function ensure() {
        if (dialog)
            return;
        dialog = document.createElement('dialog');
        dialog.id = 'delivery-dialog';
        dialog.className = 'delivery-dialog';
        dialog.setAttribute('aria-label', 'Teslim merkezi');
        dialog.innerHTML = '<header><h2>Teslim merkezi</h2><button data-action="close">Kapat</button></header><p>Çıktılar seçilen revizyona sabitlenir. Teknik tamamlanma ve teslim kabulü ayrı tutulur.</p><div class="delivery-source"><label>Kaynak revizyon<select name="revision"></select></label><button data-action="freeze">Revizyonu dondur</button></div><p role="status" aria-live="polite"></p><div class="delivery-work"><section><label>Firma<input name="company" maxlength="160"></label><details><summary>Malzeme ve fiyat ayarları</summary><label>Fire (%)<input name="waste" type="number" value="0" min="0" max="100"></label><label>Standart boylar (m; virgülle)<input name="sizes" value="0.5,1,2,3,5,10,15,20,30,50"></label><label>Para birimi<input name="currency" value="TRY" maxlength="3"></label><div class="delivery-prices"></div></details><details><summary>Etiket ölçüleri</summary><label>Genişlik (mm)<input name="width" type="number" value="90" min="50" max="190"></label><label>Yükseklik (mm)<input name="height" type="number" value="45" min="35" max="277"></label><label>Punto<input name="font" type="number" value="8" min="6" max="14"></label><label>A4 kenar boşluğu (mm)<input name="margin" type="number" value="10" min="0" max="20"></label></details><div class="delivery-actions"><button data-action="preview">Rapor önizle</button><button data-action="labels-preview">Etiket önizle</button><button data-action="pdf">PDF indir</button><button data-action="html">Rapor HTML</button><button data-action="csv">Bağlantı CSV</button><button data-action="bom">Malzeme CSV</button><button data-action="svg">Kabin SVG</button><button data-action="labels">Etiket HTML</button><button data-action="print">Önizlemeyi yazdır</button></div><details><summary>Pakete eklenecek kanıtlar</summary><p>Ekler yalnızca seçildiğinde ZIP içine alınır. Seçilmemiş kanıtlar eksik olarak belirtilir.</p><div class="delivery-evidence"></div></details><button data-action="zip">Teslim ZIP oluştur ve kaydet</button><p>ZIP: en çok 24 MiB açılmış içerik. Yerel paket geçmişi: proje başına 48 MiB kodlanmış veri. ZIP dosyasını dışarıda da saklayın.</p><label>Teslim ZIP içe aktar<input name="import" type="file" accept=".zip,application/zip"></label></section><iframe title="Dondurulmuş çıktı önizlemesi" sandbox="allow-same-origin allow-modals"></iframe></div><section><h3>Teslim geçmişi</h3><div class="delivery-history"></div><label>Kabul eden<input name="actor" maxlength="200"></label><label>Kabul açıklaması<textarea name="accept-note" maxlength="2000"></textarea></label><p>Kabul kaydı yerel kullanıcı beyanıdır; elektronik imza değildir.</p></section>';
        const frame = dialog.querySelector('iframe'), preview = document.createElement('section');
        preview.className = 'delivery-preview';
        const title = document.createElement('h3'); title.textContent = 'Çıktı önizlemesi';
        const empty = document.createElement('div'); empty.className = 'product-empty';
        const heading = document.createElement('h3'); heading.textContent = 'Revizyon seçin ve dondurun';
        const hint = document.createElement('p'); hint.textContent = 'Rapor ve etiket önizlemeleri seçilen kayıttan hazırlanır. İndirme seçenekleri dondurulduktan sonra kullanılabilir.';
        empty.append(heading, hint); frame.before(preview); preview.append(title, empty, frame); frame.hidden = true;
        document.body.append(dialog);
        dialog.addEventListener('click', event => { const button = event.target.closest('[data-action]'); if (button)
            run(() => act(button.dataset.action, button.dataset.id)); });
        dialog.addEventListener('close', () => { epoch++; model = null; resetPreview(); });
        dialog.addEventListener('change', event => { if (event.target.name === 'import' && event.target.files[0])
            run(async () => { const file = event.target.files[0]; if (file.size > R.HandoverPackage.MAX_BYTES)
                throw new Error('ZIP boyutu sınırı aşıyor.'); await R.HandoverPackage.importBytes(new Uint8Array(await file.arrayBuffer())); model = null; await sources(); status('Teslim projesi ve seçilen kanıtlar içe aktarıldı.'); }); });
    }
    const field = name => dialog.querySelector('[name="' + name + '"]');
    const status = message => { dialog.querySelector('[role="status"]').textContent = message; };
    function resetPreview() { const frame = dialog.querySelector('iframe'); frame.srcdoc = ''; frame.hidden = true; dialog.querySelector('.product-empty').hidden = false; }
    function showPreview(html) { const frame = dialog.querySelector('iframe'); frame.srcdoc = html; frame.hidden = false; dialog.querySelector('.product-empty').hidden = true; }
    async function run(work) {
        if (busy)
            return;
        busy = true;
        dialog.setAttribute('aria-busy', 'true');
        dialog.querySelectorAll('button,input,select,textarea').forEach(e => { e.disabled = e.dataset.action !== 'close'; });
        try {
            await work();
        }
        catch (error) {
            status(error.message);
        }
        finally {
            busy = false;
            dialog.removeAttribute('aria-busy');
            dialog.querySelectorAll('button,input,select,textarea').forEach(e => { e.disabled = false; });
            dialog.querySelectorAll('.delivery-actions button,[data-action="zip"]').forEach(e => { e.disabled = !model; });
        }
    }
    function options() {
        const prices = {};
        dialog.querySelectorAll('[data-price]').forEach(input => { if (input.value !== '')
            prices[input.dataset.price] = Number(input.value); });
        return { company: field('company').value, bom: R.BOM.settings({ wastePercent: Number(field('waste').value), standardLengths: field('sizes').value.split(',').filter(s => s.trim()).map(Number), currency: field('currency').value.toUpperCase(), prices }), labels: R.LabelModel.settings({ widthMm: Number(field('width').value), heightMm: Number(field('height').value), fontPt: Number(field('font').value), marginMm: Number(field('margin').value) }), evidenceIds: [...dialog.querySelectorAll('[data-evidence]:checked')].map(e => e.dataset.evidence) };
    }
    function prices() {
        const old = new Map([...dialog.querySelectorAll('[data-price]')].map(e => [e.dataset.price, e.value]));
        const bom = R.BOM.build(model, { wastePercent: Number(field('waste').value), standardLengths: field('sizes').value.split(',').filter(s => s.trim()).map(Number) });
        dialog.querySelector('.delivery-prices').innerHTML = bom.rows.map(row => '<label>' + esc(row.name) + ' · ' + row.quantity + '<input type="number" min="0" step="0.01" data-price="' + esc(row.key) + '" value="' + esc(old.get(row.key) || '') + '" aria-label="' + esc(row.name + ' birim fiyat') + '"></label>').join('');
    }
    async function sources() {
        const doc = R.ProjectDocument.capture(R.STATE), rows = await R.ProjectRevisions.list(doc.projectId);
        field('revision').innerHTML = '<option value="">Güncel dayanıklı kayıt</option>' + rows.map(r => '<option value="' + esc(r.id) + '">' + esc(r.name + ' · R' + r.document.revision) + '</option>').join('');
        field('company').value = doc.metadata.customer || '';
        history();
    }
    function history() {
        const rows = R.ProjectDocument.capture(R.STATE).handoverRecords;
        dialog.querySelector('.delivery-history').innerHTML = rows.length ? rows.map(r => '<article><strong>' + esc(r.status) + ' · R' + r.revision + '</strong> · ' + esc(r.createdAt || '') + '<p>' + esc(r.actor || '') + ' ' + esc(r.note || '') + '</p>' + (r.status === 'prepared' && !r.sourceProjectId ? '<button data-action="history" data-id="' + esc(r.id) + '">Kaydedilmiş ZIP indir</button>' + (rows.some(a => a.parentHandoverId === r.id && a.status === 'accepted') ? '<span>Kabul kaydı var</span>' : '<button data-action="accept" data-id="' + esc(r.id) + '">Kabul beyanını kaydet</button>') : '') + '</article>').join('') : '<p>Henüz teslim kaydı yok.</p>';
    }
    async function act(action, id) {
        if (action === 'close') {
            dialog.close();
            return;
        }
        if (action === 'freeze') {
            const token = epoch, captured = await R.ReportModel.capture(field('revision').value);
            if (!dialog.open || token !== epoch)
                return;
            model = captured;
            prices();
            dialog.querySelector('.delivery-evidence').innerHTML = model.attachments.map(a => '<label><input type="checkbox" data-evidence="' + esc(a.ref.id) + '">' + esc(a.ref.filename || a.ref.id) + '</label>').join('') || '<p>Doğrulanmış ek yok.</p>';
            showPreview(R.ReportOutput.html(model, options()));
            status('R' + model.document.revision + ' donduruldu · ' + model.issues.length + ' açık iş. Sonraki düzenlemeler bu çıktıyı değiştirmez.');
            return;
        }
        if (action === 'history') {
            R.ReportOutput.download(await R.HandoverRepository.bytes(id), 'teslim.zip', 'application/zip');
            return;
        }
        if (action === 'accept') {
            await R.HandoverRepository.accept(id, field('actor').value, field('accept-note').value);
            history();
            status('Kabul beyanı ayrı kayıt olarak saklandı.');
            return;
        }
        if (!model)
            throw new Error('Önce revizyonu dondurun.');
        prices();
        const o = options(), output = R.ReportOutput, prefix = 'proje-R' + model.document.revision;
        if (action === 'preview' || action === 'labels-preview')
            showPreview(action === 'preview' ? output.html(model, o) : R.LabelOutput.html(model, o.labels));
        else if (action === 'print')
            dialog.querySelector('iframe').contentWindow.print();
        else if (action === 'pdf')
            output.download(await R.ReportPDF.bytes(model, o), prefix + '.pdf', 'application/pdf');
        else if (action === 'html')
            output.download(output.html(model, o), prefix + '.html', 'text/html;charset=utf-8');
        else if (action === 'csv')
            output.download(output.cablesCSV(model), prefix + '-kablolar.csv', 'text/csv;charset=utf-8');
        else if (action === 'bom')
            output.download(output.bomCSV(model, o.bom), prefix + '-malzemeler.csv', 'text/csv;charset=utf-8');
        else if (action === 'labels')
            output.download(R.LabelOutput.html(model, o.labels), prefix + '-etiketler.html', 'text/html;charset=utf-8');
        else if (action === 'svg')
            for (const [i, rack] of model.document.topology.racks.entries())
                output.download(output.rackSVG(model, rack), prefix + '-kabin-' + (i + 1) + '.svg', 'image/svg+xml');
        else if (action === 'zip') {
            const data = await R.HandoverRepository.create(model, o);
            output.download(data.packet.bytes, prefix + '-teslim.zip', 'application/zip');
            history();
            status('Teslim ZIP oluşturuldu ve geçmişe kaydedildi. Kabul henüz kaydedilmedi.');
        }
    }
    async function open() { ensure(); if (dialog.open || busy)
        return; epoch++; dialog.showModal(); await run(sources); }
    document.getElementById('btn-delivery-center')?.addEventListener('click', open);
    R.DeliveryUI = Object.freeze({ open });
})();
