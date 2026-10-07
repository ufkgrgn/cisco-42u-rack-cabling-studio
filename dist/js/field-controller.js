(function () {
    'use strict';
    const R = window.RackStudio, F = R.FieldEvents, n = (tag, text) => {
        const e = document.createElement(tag);
        if (text !== undefined)
            e.textContent = text;
        return e;
    };
    const button = (text, fn) => {
        const e = n('button', text);
        e.type = 'button';
        e.addEventListener('click', fn);
        return e;
    };
    function open(ref, options = {}) {
        if (document.getElementById('field-workflow-dialog')?.open)
            return;
        const projectId = R.STATE.projectDocument.projectId, opener = document.activeElement, dialog = n('dialog');
        dialog.id = 'field-workflow-dialog';
        dialog.className = 'field-workflow-dialog';
        dialog.setAttribute('aria-label', 'Saha iş akışı');
        let selected = ref, busy = false, page = 0;
        const header = n('header');
        header.append(n('h2', 'Saha iş akışı'), button('Kapat', () => {
            if (!busy)
                dialog.close();
        }));
        const notice = n('p', 'Yerel kayıt · uygulama → etiketleme → test. Eksik test tamamlanma sayılmaz.'), message = n('p');
        message.setAttribute('role', 'status');
        const rack = n('select');
        rack.setAttribute('aria-label', 'Saha kabini');
        rack.append(new Option('Bütün kabinler', ''));
        for (const item of R.STATE.racks)
            rack.append(new Option(item.name, item.id));
        if(options.rackId)rack.value=options.rackId;
        const search = n('input');
        search.type = 'search';
        search.placeholder = 'Cihaz veya hat ara';
        search.setAttribute('aria-label', 'Saha işi ara');
        const layout = n('div');
        layout.className = 'field-layout';
        const list = n('section'), detail = n('section');
        list.setAttribute('aria-label', 'Saha işleri');
        detail.setAttribute('aria-label', 'Saha kaydı');
        layout.append(list, detail);
        const filters = n('div');
        filters.className = 'field-filters';
        filters.append(rack, search);
        dialog.append(header, notice, filters, message, layout);
        document.body.append(dialog);
        const check = () => {
            if (projectId !== R.STATE.projectDocument.projectId)
                throw new Error('Proje değişti; saha ekranını yeniden açın.');
        };
        async function run(fn) {
            if (busy)
                return;
            busy = true;
            dialog.setAttribute('aria-busy', 'true');
            const controls = [...dialog.querySelectorAll('button,input,select,textarea')].map(e => ({ e, disabled: e.disabled }));
            controls.forEach(({ e }) => e.disabled = true);
            try {
                check();
                await fn();
                message.textContent = 'İşlem ve yerel kayıt doğrulandı.';
                render();
            }
            catch (e) {
                message.textContent = e.message;
            }
            finally {
                busy = false;
                dialog.removeAttribute('aria-busy');
                controls.forEach(({ e, disabled }) => e.disabled = disabled);
                if (!R.WorkflowViews.canEdit())
                    detail.querySelector('form')?.remove();
            }
        }
        function render() {
            check();
            const doc = R.ProjectDocument.capture(R.STATE), term = search.value.toLocaleLowerCase('tr'), jobs = [];
            for (const r of doc.topology.racks)
                for (const d of r.devices)
                    if (!rack.value || rack.value === r.id)
                        jobs.push({ ref: { kind: 'device', id: d.instanceId }, name: `${r.name} · ${d.hostname || d.name || d.instanceId}` });
            for (const c of doc.topology.cables)
                if (!rack.value || [c.from.rackId, c.to.rackId].includes(rack.value))
                    jobs.push({ ref: { kind: 'cable', id: c.id }, name: `Hat · ${c.name || c.id} · ${c.from.portId} → ${c.to.portId}` });
            const filtered = jobs.filter(j => (j.name + ' ' + j.ref.id).toLocaleLowerCase('tr').includes(term));
            page = Math.min(page, Math.max(0, Math.ceil(filtered.length / 30) - 1));
            list.replaceChildren(n('h3', `${filtered.length} saha işi`));
            for (const job of filtered.slice(page * 30, (page + 1) * 30)) {
                const s = F.status(doc, job.ref), b = button(undefined, () => {
                    selected = job.ref;
                    render();
                    detail.scrollIntoView({ block: 'nearest' });
                });
                b.className = 'field-job';
                b.append(n('strong', job.name), n('span', s.label));
                b.title = job.name;
                b.setAttribute('aria-pressed', String(selected?.id === job.ref.id && selected.kind === job.ref.kind));
                list.append(b);
            }
            if (filtered.length > 30) {
                const prev = button('Önceki işler', () => {
                    page--;
                    render();
                }), next = button('Sonraki işler', () => {
                    page++;
                    render();
                });
                prev.disabled = page === 0;
                next.disabled = (page + 1) * 30 >= filtered.length;
                list.append(prev, n('span', ` ${page + 1}/${Math.ceil(filtered.length / 30)} `), next);
            }
            detail.replaceChildren();
            if (!selected) {
                const empty = n('div');
                empty.className = 'product-empty';
                empty.append(n('h3', 'Saha kaydı'), n('p', 'İşlem adımlarını ve kayıt geçmişini görmek için listeden bir cihaz veya hat seçin.'));
                detail.append(empty);
                return;
            }
            const state = F.status(doc, selected);
            detail.append(n('h3', jobs.find(j => j.ref.id === selected.id && j.ref.kind === selected.kind)?.name || selected.id), n('p', state.label));
            if (state.label === 'Kanıt doğrulaması gerekli')
                detail.append(button('Test kanıtını doğrula', () => run(async () => {
                    for (const id of state.latest.test.event.evidenceIds)
                        await R.FieldEvidence.get(doc.evidenceRefs.find(e => e.id === id));
                })));
            if (R.WorkflowViews.canEdit() && state.label !== 'Nesne kaldırıldı') {
                const form = n('form');
                const field = (text, input) => {
                    const label = n('label', text);
                    input.setAttribute('aria-label', text);
                    label.append(input);
                    form.append(label);
                    return input;
                };
                const kind = field('Saha adımı', n('select'));
                for (const [value, text] of Object.entries(F.labels))
                    kind.append(new Option(text, value));
                kind.value = !state.installed ? 'installed' : !state.labeled ? 'labeled' : 'test';
                const result = field('Sonuç', n('select'));
                for (const [value, text] of Object.entries(F.results))
                    result.append(new Option(text, value));
                result.value = 'pass';
                const technician = field('Teknisyen', n('input'));
                technician.required = true;
                technician.maxLength = 200;
                const date = field('İşlem tarihi', n('input'));
                date.type = 'datetime-local';
                date.required = true;
                date.value = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                const note = field('Saha notu', n('textarea'));
                note.maxLength = 4000;
                const correction = field('Son kaydı gerekçeyle düzelt', n('input'));
                correction.type = 'checkbox';
                const reason = field('Düzeltme gerekçesi', n('textarea'));
                reason.maxLength = 2000;
                const files = field('Fotoğraf veya test dosyası', n('input'));
                files.type = 'file';
                files.multiple = true;
                files.accept = 'image/jpeg,image/png,image/webp,application/pdf,text/plain,text/csv,application/json';
                form.append(n('small', 'En fazla 8 ek; her ek 20 MB, toplam 40 MB. Başarılı test için ek gerekir.'));
                const submit = n('button', 'Saha kaydını sakla');
                submit.type = 'submit';
                form.append(submit);
                form.addEventListener('submit', e => {
                    e.preventDefault();
                    const previous = state.latest[kind.value]?.event;
                    const input = {
                        entityRef: selected, kind: kind.value, result: result.value, technician: technician.value, recordedAt: date.value ? new Date(date.value).toISOString() : '', note: note.value, ...(correction.checked ? { parentEventId: previous?.id, reason: reason.value } : {})
                    };
                    if (correction.checked && !previous) {
                        message.textContent = 'Düzeltilecek kayıt bulunamadı.';
                        return;
                    }
                    run(() => F.record(input, files.files));
                });
                detail.append(form);
            }
            detail.append(n('h4', `${state.rows.length} geçmiş kaydı`));
            for (const e of state.rows.slice(-50).reverse()) {
                const card = n('article');
                card.className = 'field-event';
                card.append(n('strong', `${F.labels[e.kind] || e.kind} · ${F.results[e.result] || e.result || 'Sonuç yok'}`), n('p', `${e.technician || 'Teknisyen belirtilmedi'} · ${e.recordedAt ? new Date(e.recordedAt).toLocaleString('tr-TR') : 'Tarih belirtilmedi'} · revizyon ${e.expectedRevision ?? 'belirsiz'}`));
                if (e.fieldEventVersion !== 1)
                    card.append(n('p', 'Eski kayıt: kapsamı doğrulanmadığı için tamamlanma sayılmaz.'));
                if (e.note)
                    card.append(n('p', e.note));
                if (e.parentEventId)
                    card.append(n('p', 'Düzeltme gerekçesi: ' + e.reason));
                for (const id of e.evidenceIds || []) {
                    const attachment = doc.evidenceRefs.find(r => r.id === id);
                    if (!attachment)
                        continue;
                    card.append(button('Eki indir: ' + attachment.filename, () => run(async () => {
                        const blob = await R.FieldEvidence.get(attachment);
                        check();
                        const url = URL.createObjectURL(blob), a = n('a');
                        a.href = url;
                        a.download = attachment.filename || 'Ek';
                        a.click();
                        setTimeout(() => URL.revokeObjectURL(url), 10000);
                    })));
                }
                detail.append(card);
            }
            if (state.rows.length > 50)
                detail.append(n('p', 'Son 50 kayıt gösteriliyor; bütün geçmiş proje yedeğinde korunur.'));
        }
        rack.addEventListener('change', () => {
            page = 0;
            render();
        });
        search.addEventListener('input', () => {
            page = 0;
            render();
        });
        dialog.addEventListener('cancel', e => {
            if (busy)
                e.preventDefault();
        });
        dialog.addEventListener('close', () => {
            dialog.remove();
            opener?.focus();
        });
        render();
        dialog.showModal();
    }
    R.FieldWorkflowUI = Object.freeze({ open });
    const init = () => document.getElementById('btn-field-workflow')?.addEventListener('click', () => open());
    if (document.readyState === 'loading')
        document.addEventListener('DOMContentLoaded', init);
    else
        init();
})();
