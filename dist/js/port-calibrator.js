/* Local calibration of model port anchors. A local edit is never vendor verified. */
(() => {
  'use strict';
  const RS = window.RackStudio;
  if (!RS) return;
  const catalog = RS.HARDWARE_CATALOG || {};
  const clamp = value => Math.max(0, Math.min(1, Number(value) || 0));
  let dialog;
  let draft;
  let selectedId;

  function makeLabel(text, control) {
    const label = document.createElement('label');
    label.textContent = text;
    label.append(control);
    return label;
  }

  function ensure() {
    if (dialog) return;
    dialog = document.createElement('dialog');
    dialog.id = 'port-calibrator-dialog';
    dialog.className = 'port-calibrator-dialog';
    dialog.setAttribute('aria-label', 'Port kalibrasyonu');
    dialog.innerHTML = `<div class="port-calibrator-head"><h2>Port kalibrasyonu</h2><button type="button" data-cal-action="close">Kapat</button></div>
      <p>Portu seçin, çizim üzerindeki merkezine tıklayın. Değişiklikler yalnızca bu bilgisayardaki katalogda kullanılır.</p>
      <div class="port-calibrator-controls"></div>
      <div class="port-calibrator-stage" aria-label="Model ön yüzü"></div>
      <div class="port-calibrator-values"></div>
      <div class="port-calibrator-actions"><button type="button" data-cal-action="save">Yerel kalibrasyonu kaydet</button></div>`;
    document.body.append(dialog);
    dialog.addEventListener('click', event => {
      event.stopPropagation();
      const action = event.target.closest('[data-cal-action]')?.dataset.calAction;
      if (action === 'close') dialog.close();
      if (action === 'save') save();
    });
    dialog.addEventListener('close', () => { draft = null; });
  }

  function render() {
    const model = catalog[dialog.querySelector('#cal-model').value];
    if (!model?.portGeometry) return;
    draft = structuredClone(model.portGeometry);
    selectedId = draft.ports[0]?.id;
    const ports = document.createElement('select');
    ports.id = 'cal-port';
    ports.setAttribute('aria-label', 'Kalibre edilecek port');
    model.ports.forEach(port => {
      const option = document.createElement('option');
      option.value = port.id;
      option.textContent = `${port.name || port.id} (${port.id})`;
      ports.append(option);
    });
    ports.addEventListener('change', () => { selectedId = ports.value; draw(); });
    dialog.querySelector('.port-calibrator-controls').replaceChildren(dialog.querySelector('#cal-model'), makeLabel('Port', ports));
    draw();
  }

  function draw() {
    if (!draft) return;
    const stage = dialog.querySelector('.port-calibrator-stage');
    stage.replaceChildren();
    const model = catalog[dialog.querySelector('#cal-model').value];
    const image = document.createElement('img');
    image.alt = `${model.name} ön yüz çizimi`;
    image.src = `assets/stencils/${encodeURIComponent(model.faceplate?.stencil || `${model.modelTag}_Front.svg`)}`;
    image.onerror = () => { image.alt = 'Bu model için tam eşleşen çizim bulunamadı; konumlar yaklaşık şema üzerindedir.'; image.removeAttribute('src'); };
    stage.append(image);
    draft.ports.forEach(port => {
      const marker = document.createElement('span');
      marker.className = 'port-calibrator-marker' + (port.id === selectedId ? ' selected' : '');
      marker.style.left = `${port.x * 100}%`;
      marker.style.top = `${port.y * 100}%`;
      marker.title = port.id;
      stage.append(marker);
    });
    stage.onclick = event => {
      const rect = stage.getBoundingClientRect();
      const port = draft.ports.find(item => item.id === selectedId);
      if (!port || !rect.width || !rect.height) return;
      port.x = clamp((event.clientX - rect.left) / rect.width);
      port.y = clamp((event.clientY - rect.top) / rect.height);
      draw();
    };
    const values = dialog.querySelector('.port-calibrator-values');
    values.replaceChildren();
    const port = draft.ports.find(item => item.id === selectedId);
    if (!port) return;
    for (const [key, label] of [['x', 'X'], ['y', 'Y'], ['width', 'Genişlik'], ['height', 'Yükseklik']]) {
      const input = document.createElement('input');
      input.type = 'number'; input.min = '0'; input.max = '1'; input.step = '0.001'; input.value = String(port[key]);
      input.addEventListener('change', () => { port[key] = clamp(input.value); draw(); });
      values.append(makeLabel(label, input));
    }
  }

  function save() {
    const id = dialog.querySelector('#cal-model')?.value;
    const model = catalog[id];
    if (!draft || !model || draft.ports.length !== model.ports.length) return;
    const ids = new Set(model.ports.map(port => port.id));
    if (draft.ports.some(port => !ids.has(port.id) || !['x', 'y', 'width', 'height'].every(key => Number.isFinite(port[key]) && port[key] >= 0 && port[key] <= 1))) return;
    const payload = { ...draft, verification: 'calibrated-local', version: 1 };
    try {
      const overrides = JSON.parse(localStorage.getItem('rack-studio-port-geometry-v1') || '{}');
      overrides[id] = payload;
      localStorage.setItem('rack-studio-port-geometry-v1', JSON.stringify(overrides));
    } catch (_) { return; }
    model.portGeometry = payload;
    RS.DeviceSceneRegistry?.invalidate({ templates: true });
    RS.refresh?.();
    dialog.close();
  }

  function open() {
    ensure();
    const models = Object.values(catalog).filter(model => model.portGeometry);
    const select = document.createElement('select');
    select.id = 'cal-model';
    select.setAttribute('aria-label', 'Kalibre edilecek model');
    models.forEach(model => {
      const option = document.createElement('option');
      option.value = model.id;
      option.textContent = `${model.modelTag || model.name} · ${model.portGeometry.verification}`;
      select.append(option);
    });
    select.addEventListener('change', render);
    dialog.querySelector('.port-calibrator-controls').replaceChildren(select);
    dialog.showModal();
    render();
  }
  document.getElementById('btn-port-calibrator')?.addEventListener('click', open);
  RS.PortCalibrator = { open };
})();
