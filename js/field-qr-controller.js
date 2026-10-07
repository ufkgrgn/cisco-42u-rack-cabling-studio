(function () {
    'use strict';
    const R = window.RackStudio, Q = R.FieldQR, n = (tag, text) => {
        const e = document.createElement(tag);
        if (text !== undefined)
            e.textContent = text;
        return e;
    }, button = (text, fn) => {
        const e = n('button', text);
        e.type = 'button';
        e.addEventListener('click', fn);
        return e;
    };
    function open(ref) {
        if (document.getElementById('field-qr-dialog')?.open)
            return;
        const projectId = R.STATE.projectDocument.projectId, opener = document.activeElement, dialog = n('dialog');
        dialog.id = 'field-qr-dialog';
        dialog.className = 'field-workflow-dialog field-qr-dialog';
        dialog.setAttribute('aria-label', 'QR ile saha erişimi');
        let stream, timer, closed = false, scanning = false, cameraEpoch = 0;
        const stop = () => {
            cameraEpoch++;
            scanning = false;
            clearTimeout(timer);
            stream?.getTracks().forEach(t => t.stop());
            stream = null;
            if (typeof video !== 'undefined') { video.srcObject = null; delete video.dataset.active; }
        };
        const guard = () => {
            if (closed || projectId !== R.STATE.projectDocument.projectId)
                throw new Error('Proje veya QR ekranı değişti; yeniden açın.');
        };
        const header = n('header');
        header.append(n('h2', 'QR ile saha erişimi'), button('Kapat', () => dialog.close()));
        const status = n('p');
        status.setAttribute('role', 'status');
        const doc = R.ProjectDocument.capture(R.STATE), target = n('select');
        target.setAttribute('aria-label', 'QR hedefi');
        const choices = [{ kind: 'project', id: doc.projectId, label: 'Proje · ' + (doc.metadata.name || 'Adsız') }];
        for (const r of doc.topology.racks) {
            choices.push({ kind: 'rack', id: r.id, label: 'Kabin · ' + r.name });
            for (const d of r.devices)
                if (choices.length < 500)
                    choices.push({ kind: 'device', id: d.instanceId, label: 'Cihaz · ' + (d.hostname || d.name || d.instanceId) });
        }
        for (const c of doc.topology.cables)
            if (choices.length < 500)
                choices.push({ kind: 'cable', id: c.id, label: 'Hat · ' + (c.name || c.id) });
        if (ref && !choices.some(c => c.kind === ref.kind && c.id === ref.id))
            choices.push({ ...ref, label: ref.id });
        for (const c of choices)
            target.append(new Option(c.label, JSON.stringify({ kind: c.kind, id: c.id })));
        if (ref)
            target.value = JSON.stringify({ kind: ref.kind, id: ref.id });
        const output = n('section'), text = n('textarea');
        output.className = 'qr-output';
        text.setAttribute('aria-label', 'QR kimliği');
        text.readOnly = true;
        const draw = () => {
            try {
                guard();
                const item = JSON.parse(target.value), raw = Q.payload(item.kind, item.id);
                Q.resolve(raw);
                output.replaceChildren(Q.canvas(raw));
                text.value = raw;
            }
            catch (e) {
                status.textContent = e.message;
            }
        };
        target.addEventListener('change', draw);
        const manual = n('textarea');
        manual.setAttribute('aria-label', 'QR kimliğini elle gir');
        manual.placeholder = 'RSQR1:…';
        const navigate = raw => {
            guard();
            Q.resolve(raw);
            stop();
            dialog.close();
            Q.visit(raw);
        };
        const file = n('input');
        file.type = 'file';
        file.accept = 'image/png,image/jpeg,image/webp';
        file.setAttribute('aria-label', 'QR fotoğrafı seç');
        file.addEventListener('change', async () => {
            let image;
            try {
                guard();
                const f = file.files[0];
                if (!f || f.size > 20 * 1024 * 1024)
                    throw new Error('QR fotoğrafı en fazla 20 MB olmalı.');
                image = await createImageBitmap(f);
                guard();
                navigate(Q.decode(image));
            }
            catch (e) {
                status.textContent = e.message;
            }
            finally {
                image?.close();
                file.value = '';
            }
        });
        const video = n('video');
        video.muted = true;
        video.autoplay = true;
        video.playsInline = true;
        video.setAttribute('aria-label', 'QR kamera görüntüsü');
        const scan = async () => {
            if (scanning || closed)
                return;
            stop();
            const epoch = cameraEpoch;
            try {
                guard();
                if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)
                    throw new Error('Kamera kullanılamıyor. Elle giriş veya QR fotoğrafı kullanın.');
                scanning = true;
                const acquired = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
                if (closed || projectId !== R.STATE.projectDocument.projectId || !scanning || epoch !== cameraEpoch) {
                    acquired.getTracks().forEach(t => t.stop());
                    return;
                }
                stream = acquired;
                video.srcObject = stream;
                video.dataset.active = 'true';
                await video.play();
                guard();
                status.textContent = 'QR kodunu kameraya gösterin.';
                const frame = () => {
                    if (!scanning || closed)
                        return;
                    let raw;
                    try {
                        raw = Q.decode(video);
                    }
                    catch {
                    }
                    if (raw) {
                        try {
                            navigate(raw);
                        }
                        catch (e) {
                            stop();
                            status.textContent = e.message;
                        }
                        return;
                    }
                    timer = setTimeout(frame, 350);
                };
                frame();
            }
            catch (e) {
                if (epoch !== cameraEpoch)
                    return;
                stop();
                status.textContent = e.name === 'NotAllowedError' ? 'Kamera izni verilmedi. Elle giriş veya QR fotoğrafı kullanın.' : e.message;
            }
        };
        const layout = n('div'), generate = n('section'), reader = n('section'), rawDetails = n('details');
        layout.className = 'qr-layout';
        rawDetails.append(n('summary', 'Kimlik metnini göster'), text);
        generate.append(n('h3', 'QR oluştur'), target, output, rawDetails, button('QR PNG indir', () => {
            try {
                guard();
                const a = n('a');
                a.download = 'rack-studio-qr.png';
                a.href = output.querySelector('canvas').toDataURL('image/png');
                a.click();
            }
            catch (e) {
                status.textContent = e.message;
            }
        }));
        reader.append(n('h3', 'QR oku'), n('p', 'Kimliği yapıştırın, bir QR fotoğrafı seçin veya kamerayı kullanın.'), manual, button('Kimliği aç', () => {
            try {
                navigate(manual.value.trim());
            }
            catch (e) {
                status.textContent = e.message;
            }
        }), file, button('Kamerayı aç', scan), button('Kamerayı durdur', stop), video);
        layout.append(generate, reader);
        dialog.append(header, n('p', 'QR kimliği yalnızca açık yerel projede çözülür. Hedefi seçerek cihaz, kabin veya hat için kod oluşturabilirsiniz.'), layout, status);
        dialog.addEventListener('close', () => {
            closed = true;
            stop();
            dialog.remove();
            opener?.focus();
        });
        document.body.append(dialog);
        draw();
        dialog.showModal();
    }
    R.FieldQRUI = Object.freeze({ open });
    const init = () => document.getElementById('btn-field-qr')?.addEventListener('click', () => open());
    if (document.readyState === 'loading')
        document.addEventListener('DOMContentLoaded', init);
    else
        init();
})();
