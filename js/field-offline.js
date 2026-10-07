(function () {
    'use strict';
    const R = window.RackStudio;
    let registration, busy = false, info = { ready: false, message: 'Çevrimdışı hazırlık yapılmadı.' };
    const supported = () => ['http:', 'https:'].includes(location.protocol) && isSecureContext && 'serviceWorker' in navigator;
    const announce = () => document.dispatchEvent(new CustomEvent('rackstudio:offline'));
    function ask(worker, type) {
        return new Promise((resolve, reject) => {
            if (!worker)
                return reject(new Error('Saha önbelleği hazır değil.'));
            const channel = new MessageChannel(), timer = setTimeout(() => reject(new Error('Önbellek yanıt vermedi; bağlantıyla yeniden hazırlayın.')), 15000);
            channel.port1.onmessage = e => {
                clearTimeout(timer);
                channel.port1.close();
                resolve(e.data);
            };
            worker.postMessage({ type }, [channel.port2]);
        });
    }
    async function inspect() {
        if (!supported()) {
            info = { ready: false, message: 'Dosyadan açılışta yerel kayıt çalışır. Uygulama önbelleği için HTTPS veya localhost kullanın.' };
            announce();
            return info;
        }
        registration = await navigator.serviceWorker.getRegistration(new URL('./field-sw.js', document.baseURI).href);
        if (!registration?.active)
            return info;
        const result = await ask(registration.active, 'FIELD_STATUS');
        info = { ...result, message: result.ready ? 'Uygulama dosyaları çevrimdışı kullanım için doğrulandı.' : 'Önbellek eksik; bağlantıyla yeniden hazırlayın.', update: !!registration.waiting };
        announce();
        return info;
    }
    async function prepare() {
        if (busy)
            throw new Error('Hazırlık sürüyor.');
        if (!supported())
            return inspect();
        busy = true;
        info = { ready: false, message: 'Uygulama dosyaları saklanıyor…' };
        announce();
        try {
            await R.saveProjectNow();
            registration = await navigator.serviceWorker.register(new URL('./field-sw.js', document.baseURI), { updateViaCache: 'none' });
            await registration.update();
            await Promise.race([navigator.serviceWorker.ready, new Promise((_, reject) => setTimeout(() => reject(new Error('Önbellek hazırlanamadı. Bağlantı ve depolama alanını kontrol edin.')), 45000))]);
            if (registration.installing)
                await new Promise((resolve, reject) => {
                    const worker = registration.installing;
                    worker.addEventListener('statechange', () => {
                        if (['installed', 'activated'].includes(worker.state))
                            resolve();
                        if (worker.state === 'redundant')
                            reject(new Error('Yeni önbellek kurulamadı; önceki sürüm korunuyor.'));
                    });
                });
            registration.addEventListener('updatefound', () => {
                const worker = registration.installing;
                worker?.addEventListener('statechange', () => {
                    if (worker.state === 'installed')
                        inspect().catch(() => {
                        });
                });
            });
            return await inspect();
        }
        catch (e) {
            info = { ready: false, message: e.message };
            announce();
            throw e;
        }
        finally {
            busy = false;
        }
    }
    async function update() {
        if (busy)
            throw new Error('Hazırlık sürüyor.');
        busy = true;
        try {
            await inspect();
            if (!registration?.waiting)
                throw new Error('Bekleyen güncelleme yok.');
            if ([...document.querySelectorAll('dialog[open]')].some(d => d.id !== 'field-offline-dialog') || document.querySelector('[aria-busy=true]'))
                throw new Error('Açık saha/form işlemini tamamlayıp güncellemeyi tekrar deneyin.');
            const expected = R.ProjectManagement.prepare();
            await R.saveProjectNow();
            const guard = () => {
                const d = R.ProjectDocument.capture(R.STATE);
                if (d.projectId !== expected.projectId || R.ProjectCommands.domainKey(d) !== expected.expectedContent)
                    throw new Error('Kaydetme sırasında çalışma değişti; tekrar deneyin.');
            };
            guard();
            let changed;
            const transition = new Promise(resolve => changed = resolve);
            navigator.serviceWorker.addEventListener('controllerchange', changed, { once: true });
            try {
                const reply = await ask(registration.waiting, 'ACTIVATE_FIELD_UPDATE');
                if (!reply.accepted)
                    throw new Error(reply.reason);
                await Promise.race([transition, new Promise((_, reject) => setTimeout(() => reject(new Error('Güncelleme geçişi tamamlanmadı; tekrar açın.')), 15000))]);
                guard();
                await R.ProjectRepository.release(expected.projectId);
                guard();
                location.reload();
            }
            finally {
                navigator.serviceWorker.removeEventListener('controllerchange', changed);
            }
        }
        finally {
            busy = false;
        }
    }
    function open() {
        if (document.getElementById('field-offline-dialog')?.open)
            return;
        const dialog = document.createElement('dialog');
        dialog.id = 'field-offline-dialog';
        dialog.className = 'field-workflow-dialog';
        dialog.setAttribute('aria-label', 'Çevrimdışı saha');
        const heading = document.createElement('h2');
        heading.textContent = 'Çevrimdışı saha';
        const status = document.createElement('p');
        status.setAttribute('role', 'status');
        const note = document.createElement('p');
        note.textContent = 'Bu tarayıcıdaki proje ve ekler yerel depodadır. Uygulama önbelleği proje yedeği değildir; diğer cihazlara veya farklı adreslere kayıt taşımaz.';
        const button = (text, action) => {
            const el = document.createElement('button');
            el.type = 'button';
            el.textContent = text;
            el.onclick = async () => {
                el.disabled = true;
                try {
                    await action();
                }
                catch (e) {
                    status.textContent = e.message;
                }
                finally {
                    el.disabled = false;
                }
            };
            return el;
        };
        const render = () => {
            status.textContent = (navigator.onLine ? 'Bağlantı var. ' : 'Ağ bağlantısı yok. ') + info.message + (info.update ? ' Yeni sürüm hazır; kaydederek yeniden açabilirsiniz.' : '');
        };
        document.addEventListener('rackstudio:offline', render);
        dialog.addEventListener('close', () => {
            document.removeEventListener('rackstudio:offline', render);
            dialog.remove();
        });
        dialog.append(heading, note, status, button('Çevrimdışı hazırla', prepare), button('Durumu doğrula', inspect), button('Güncellemeyi kaydet ve yeniden aç', update), button('Kapat', () => dialog.close()));
        document.body.append(dialog);
        render();
        dialog.showModal();
        inspect().catch(e => status.textContent = e.message);
    }
    R.FieldOffline = Object.freeze({
        prepare, inspect, update, open, get status() {
            return { ...info };
        }
    });
    const init = () => {
        document.getElementById('btn-field-offline')?.addEventListener('click', open);
        if (supported())
            inspect().catch(() => {
            });
    };
    if (document.readyState === 'loading')
        document.addEventListener('DOMContentLoaded', init);
    else
        init();
    for (const type of ['online', 'offline'])
        window.addEventListener(type, announce);
})();
