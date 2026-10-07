(function () {
    'use strict';
    const R = window.RackStudio, valid = id => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,160}$/.test(id);
    function payload(kind, id) {
        const doc = R.ProjectDocument.capture(R.STATE);
        return 'RSQR1:' + encodeURIComponent(JSON.stringify({ v: 1, projectId: doc.projectId, kind, id }));
    }
    function resolve(text) {
        if (typeof text !== 'string' || text.length > 2048 || !text.startsWith('RSQR1:'))
            throw new Error('Rack Studio QR kimliği geçersiz.');
        let data;
        try {
            data = JSON.parse(decodeURIComponent(text.slice(6)));
        }
        catch {
            throw new Error('QR içeriği okunamadı.');
        }
        if (!data || data.v !== 1 || !['project', 'rack', 'device', 'cable'].includes(data.kind) || !valid(data.id) || !valid(data.projectId))
            throw new Error('QR sürümü veya nesne kimliği geçersiz.');
        const doc = R.ProjectDocument.capture(R.STATE);
        if (data.projectId !== doc.projectId)
            throw new Error('QR başka projeye ait. İlgili yerel projeyi açıp tekrar deneyin.');
        const found = data.kind === 'project' ? data.id === doc.projectId : data.kind === 'rack' ? doc.topology.racks.some(r => r.id === data.id) : data.kind === 'device' ? doc.topology.racks.some(r => r.devices.some(d => d.instanceId === data.id)) : doc.topology.cables.some(c => c.id === data.id);
        if (!found)
            throw new Error('QR nesnesi açık projede bulunamadı; kaldırılmış olabilir.');
        return data;
    }
    function canvas(text) {
        const qr = window.qrcode(0, 'M');
        qr.addData(text, 'Byte');
        qr.make();
        const count = qr.getModuleCount(), el = document.createElement('canvas'), cell = 6;
        el.width = el.height = (count + 8) * cell;
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, el.width, el.height);
        ctx.fillStyle = '#000';
        for (let y = 0; y < count; y++)
            for (let x = 0; x < count; x++)
                if (qr.isDark(y, x))
                    ctx.fillRect((x + 4) * cell, (y + 4) * cell, cell, cell);
        el.setAttribute('aria-label', 'Saha QR kodu');
        return el;
    }
    function decode(source) {
        const c = document.createElement('canvas'), w = source.videoWidth || source.width, h = source.videoHeight || source.height;
        if (!w || !h)
            throw new Error('QR görüntüsü hazır değil.');
        const scale = Math.min(1, 1536 / Math.max(w, h));
        c.width = Math.round(w * scale);
        c.height = Math.round(h * scale);
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(source, 0, 0, c.width, c.height);
        const data = ctx.getImageData(0, 0, c.width, c.height), result = window.jsQR(data.data, c.width, c.height);
        if (!result)
            throw new Error('Görüntüde QR bulunamadı.');
        return result.data;
    }
    function visit(text) {
        const data = resolve(text);
        if (data.kind === 'rack')
            R.FieldWorkflowUI.open(undefined, { rackId: data.id });
        else
            R.FieldWorkflowUI.open(['device', 'cable'].includes(data.kind) ? { kind: data.kind, id: data.id } : undefined);
        return data;
    }
    R.FieldQR = Object.freeze({
        payload, resolve, canvas, decode, visit
    });
})();
