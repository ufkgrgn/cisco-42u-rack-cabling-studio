(function () {
    'use strict';
    const R = window.RackStudio, valid = n => typeof n === 'number' && Number.isFinite(n) && n >= 0;
    function settings(input = {}) { const waste = input.wastePercent ?? 0, sizes = input.standardLengths ?? [0.5, 1, 2, 3, 5, 10, 15, 20, 30, 50], prices = input.prices || {}; if (!/^[A-Z]{3}$/.test(input.currency || 'TRY') || !valid(waste) || waste > 100 || !Array.isArray(sizes) || sizes.length > 64 || sizes.some(n => !valid(n) || n === 0) || typeof prices !== 'object' || Array.isArray(prices) || Object.values(prices).some(n => !valid(n)))
        throw new Error('Fire, standart boy veya birim fiyat geçersiz.'); return { wastePercent: waste, standardLengths: [...new Set(sizes)].sort((a, b) => a - b), prices: { ...prices }, currency: input.currency || 'TRY' }; }
    function build(model, input = {}) {
        const options = settings(input), groups = new Map(), unknown = [], lengths = [];
        const add = (kind, key, name, quantity, sourceId, details = {}) => { if (!valid(quantity)) {
            unknown.push({ kind, name, sourceIds: [sourceId], reason: 'Miktar belirtilmedi' });
            return;
        } const full = kind + ':' + key, row = groups.get(full) || { key: full, kind, name, quantity: 0, sourceIds: [], ...details }; row.quantity += quantity; row.sourceIds.push(sourceId); groups.set(full, row); };
        for (const rack of model.document.topology.racks)
            for (const d of rack.devices) {
                add('device', d.catalogKey, model.catalog[d.catalogKey]?.name || 'Bilinmeyen model · ' + d.catalogKey, 1, d.instanceId);
                for (const [kind, items] of [['accessory', d.accessories || []], ['transceiver', d.transceivers || []]]) {
                    if (!Array.isArray(items))
                        throw new Error('Aksesuar/transceiver kayıtları liste olmalı.');
                    for (const a of items) {
                        const name = a.model || a.sku || a.name || 'Bilinmeyen kalem';
                        add(kind, name, name, a.quantity, d.instanceId, { declared: true });
                    }
                }
                for (const [portId, cfg] of Object.entries(d.portsConfig || {})) {
                    const a = cfg.transceiver;
                    if (!(d.transceivers || []).some(t => t.portId === portId) && a && typeof a === 'object')
                        add('transceiver', a.model || a.sku || 'Bilinmeyen transceiver', a.model || a.sku || 'Bilinmeyen transceiver', a.quantity, d.instanceId + ':' + portId, { declared: true });
                }
            }
        const seen = new Set();
        for (const c of model.cables) {
            if (seen.has(c.id))
                throw new Error('BOM içinde tekrar eden kablo kimliği.');
            seen.add(c.id);
            const measured = valid(c.measured) ? c.measured : null, estimated = valid(c.estimated) ? c.estimated : null, purchase = valid(c.purchase) ? c.purchase : null, base = measured ?? estimated, source = measured !== null ? 'measured' : estimated !== null ? 'estimated' : 'unknown', required = base === null ? null : base * (1 + options.wastePercent / 100), suggested = required === null ? null : required === 0 ? 0 : options.standardLengths.find(n => n >= required) ?? required;
            lengths.push({ id: c.id, estimated, measured, purchase, legacy: valid(c.legacy) ? c.legacy : null, source, required, suggested, customLength: required !== null && suggested === required && !options.standardLengths.includes(required) });
            const stock = purchase ?? suggested;
            add('cable', (c.medium || 'unknown') + ':' + (stock ?? 'unknown'), (c.medium || 'Bilinmeyen ortam') + ' · ' + (stock === null ? 'boy bilinmiyor' : stock + ' m'), 1, c.id, { stockLength: stock, purchaseSource: purchase !== null ? 'purchase' : source });
            if (stock === null)
                unknown.push({ kind: 'length', name: c.name, sourceIds: [c.id], reason: 'Metraj bilinmiyor; kesin toplama eklenmedi' });
        }
        const rows = [...groups.values()].map(r => ({ ...r, unitPrice: options.prices[r.key] ?? null, totalPrice: options.prices[r.key] === undefined ? null : r.quantity * options.prices[r.key] }));
        const totals = {};
        for (const key of ['estimated', 'measured', 'purchase'])
            totals[key] = { meters: lengths.reduce((n, c) => n + (c[key] ?? 0), 0), known: lengths.filter(c => c[key] !== null).length, unknown: lengths.filter(c => c[key] === null).length };
        return R.ReportModel.freeze({ options, rows, unknown, lengths, totals, totalPrice: rows.reduce((n, r) => n + (r.totalPrice ?? 0), 0), unpricedRows: rows.filter(r => r.unitPrice === null).length, notes: ['Yalnızca kaydedilmiş aksesuar/transceiver miktarları sayılır.', 'Eski lengthMeters tahmin/ölçüm/satın alma alanlarına otomatik atanmaz.', 'Birim fiyat kullanıcı girdisidir; güncel piyasa fiyatı değildir.'] });
    }
    R.BOM = Object.freeze({ build, settings });
})();
