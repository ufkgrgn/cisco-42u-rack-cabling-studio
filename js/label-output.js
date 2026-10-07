(function () {
    'use strict';
    const R = window.RackStudio;
    function render(model, input) { const labels = R.LabelModel.build(model, input), o = labels.options, cols = Math.floor((210 - 2 * o.marginMm) / o.widthMm), escape = R.ReportOutput.escape, css = '@page{size:A4;margin:' + o.marginMm + 'mm}body{margin:0;font-family:Arial,sans-serif}.labels{font-family:Arial,sans-serif;display:grid;grid-template-columns:repeat(' + cols + ',' + o.widthMm + 'mm);gap:0}.label{box-sizing:border-box;border:0.2mm solid #8a969e;width:' + o.widthMm + 'mm;height:' + o.heightMm + 'mm;padding:2mm;break-inside:avoid;display:grid;grid-template-columns:minmax(0,1fr) 23mm;grid-template-rows:auto 1fr auto;column-gap:1mm;overflow:hidden}.label h2{grid-column:1/-1;font-size:' + o.fontPt + 'pt;line-height:1.1;margin:0 0 1mm;white-space:nowrap;overflow:hidden}.label p{font-size:7pt;margin:0;line-height:1.15;overflow-wrap:anywhere}.label img{width:22mm;height:22mm;align-self:center}.identity{grid-column:1/-1;font-size:6pt;overflow-wrap:anywhere}.screen-note{font-size:12px;padding:8px}@media print{.screen-note{display:none}}'; return '<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src data:"><title>Etiketler · revizyon ' + labels.revision + '</title><style>' + css + '</style></head><body><p class="screen-note">A4 · ' + o.widthMm + ' × ' + o.heightMm + ' mm · %100 / gerçek boyutta yazdırın; yazıcı kenar boşluğunu kontrol edin. Ekran ölçeği fiziksel baskı kanıtı değildir.</p><main class="labels">' + labels.items.map(item => { const available = Math.max(5, Math.floor((o.widthMm - 5) / (o.fontPt * .22))), name = R.LabelModel.short(item.name, available), local = R.LabelModel.short(item.local, Math.max(8, Math.floor((o.widthMm - 29) / 1.5))), remote = R.LabelModel.short(item.remote, Math.max(8, Math.floor((o.widthMm - 29) / 1.5))); return '<article class="label" data-id="' + escape(item.id) + '" data-side="' + item.side + '" title="' + escape(item.name + ' · ' + item.local + ' → ' + item.remote) + '"><h2>' + escape(item.side + ' · ' + name) + '</h2><p>Burada: ' + escape(local) + '<br>Karşı: ' + escape(remote || '—') + '</p><img alt="Nesne QR kodu" src="' + R.FieldQR.canvas(item.qr).toDataURL('image/png') + '"><div class="identity">' + escape(item.id) + ' · R' + labels.revision + '</div></article>'; }).join('') + '</main></body></html>'; }
    function html(model, input) {
        const result = render(model, input), host = document.createElement('div');
        host.style.cssText = 'position:absolute;left:-100000px;top:0;visibility:hidden;width:210mm';
        const shadow = host.attachShadow({ mode: 'closed' }), parsed = new DOMParser().parseFromString(result, 'text/html');
        shadow.append(parsed.querySelector('style').cloneNode(true), parsed.querySelector('.labels').cloneNode(true));
        document.body.append(host);
        try {
            for (const label of shadow.querySelectorAll('.label'))
                if (label.scrollHeight > label.clientHeight + 1 || label.scrollWidth > label.clientWidth + 1)
                    throw new Error('Etiket metni bu ölçüye sığmıyor. Yüksekliği/genişliği artırın veya puntoyu azaltın.');
        }
        finally {
            host.remove();
        }
        return result;
    }
    R.LabelOutput = Object.freeze({ html });
})();
