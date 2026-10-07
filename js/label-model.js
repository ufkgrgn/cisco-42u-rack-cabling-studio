(function () {
    'use strict';
    const R = window.RackStudio, short = (text, size = 48) => String(text).length > size ? String(text).slice(0, size - 1) + '…' : String(text);
    function settings(input = {}) { const value = { widthMm: input.widthMm ?? 90, heightMm: input.heightMm ?? 45, fontPt: input.fontPt ?? 8, marginMm: input.marginMm ?? 10 }; if (Object.values(value).some(n => typeof n !== 'number' || !Number.isFinite(n)) || value.widthMm < 50 || value.widthMm > 190 || value.heightMm < 35 || value.heightMm > 277 || value.fontPt < 6 || value.fontPt > 14 || value.marginMm < 0 || value.marginMm > 20 || value.widthMm > 210 - 2 * value.marginMm || value.heightMm > 297 - 2 * value.marginMm)
        throw new Error('Etiket ölçüsü/punto/kenar boşluğu A4 sınırlarına uymuyor.'); return value; }
    const qr = (projectId, kind, id) => 'RSQR1:' + encodeURIComponent(JSON.stringify({ v: 1, projectId, kind, id }));
    function build(model, input = {}) { const options = settings(input), items = []; for (const r of model.document.topology.racks)
        items.push({ kind: 'rack', id: r.id, side: 'rack', name: r.name, shortName: short(r.name), local: r.name, remote: '', qr: qr(model.document.projectId, 'rack', r.id) }); for (const c of model.cables)
        for (const [side, local, remote] of [['A', c.from, c.to], ['B', c.to, c.from]])
            items.push({ kind: 'cable', id: c.id, side, name: c.name, shortName: short(c.name), local: local.label, remote: remote.label, localShort: short(local.label), remoteShort: short(remote.label), qr: qr(model.document.projectId, 'cable', c.id) }); return R.ReportModel.freeze({ projectId: model.document.projectId, revision: model.document.revision, options, items }); }
    R.LabelModel = Object.freeze({ build, settings, short, qr });
})();
