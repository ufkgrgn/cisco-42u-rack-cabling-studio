/* Local camera bookmarks. Views contain presentation state only, never rack data. */
(() => {
  'use strict';
  const RS = window.RackStudio = window.RackStudio || {};
  const key = 'rack-studio-saved-views-v1';
  const maxViews = 20;
  const read = () => {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(value) ? value.filter(v => v && typeof v.name === 'string').slice(0, maxViews) : [];
    } catch (_) { return []; }
  };
  const write = views => localStorage.setItem(key, JSON.stringify(views.slice(0, maxViews)));

  function capture(name) {
    const label = String(name || '').trim().slice(0, 60);
    if (!label) throw new Error('Görünüm adı girin.');
    const view = { id: crypto.randomUUID(), name: label, mode: window.is3DMode ? '3d' : '2d', rackId: RS.STATE?.activeRackId || '', createdAt: Date.now() };
    if (view.mode === '3d') {
      const studio = window.__STUDIO3D__;
      if (!studio?.camera || !studio?.controls) throw new Error('3D görünümü henüz hazır değil.');
      view.position = studio.camera.position.toArray();
      view.target = studio.controls.target.toArray();
    } else {
      const zoom = RS.ZOOM_STATE;
      if (!zoom) throw new Error('2D görünümü henüz hazır değil.');
      view.scale = zoom.scale;
      view.panX = zoom.panX;
      view.panY = zoom.panY;
    }
    write([view, ...read()]);
    return view;
  }

  async function restore(view) {
    if (!view || !['2d', '3d'].includes(view.mode)) return false;
    if ((view.mode === '3d') !== Boolean(window.is3DMode)) {
      document.getElementById(view.mode === '3d' ? 'btn-view-3d' : 'btn-view-2d')?.click();
    }
    if (view.rackId && RS.STATE?.racks?.some(rack => rack.id === view.rackId)) RS.switchActiveRack?.(view.rackId, { smoothFocus: false });
    if (view.mode === '2d') {
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      if (![view.scale, view.panX, view.panY].every(Number.isFinite)) return false;
      RS.cancelCameraAnimation?.();
      RS.ZOOM_STATE.scale = Math.max(0.15, Math.min(4, view.scale));
      RS.ZOOM_STATE.panX = view.panX;
      RS.ZOOM_STATE.panY = view.panY;
      RS.updateStageTransform?.(false);
      return true;
    }
    for (let attempt = 0; attempt < 30 && !window.__STUDIO3D__?.camera; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    const studio = window.__STUDIO3D__;
    if (!studio?.camera || !studio?.controls || !Array.isArray(view.position) || !Array.isArray(view.target) || view.position.length !== 3 || view.target.length !== 3 || !view.position.every(Number.isFinite) || !view.target.every(Number.isFinite)) return false;
    studio.camera.position.fromArray(view.position);
    studio.controls.target.fromArray(view.target);
    studio.controls.update();
    return true;
  }

  function open() {
    let dialog = document.getElementById('saved-views-dialog');
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.id = 'saved-views-dialog';
      dialog.className = 'instrument-dialog';
      dialog.innerHTML = '<form method="dialog" class="instrument-dialog-head"><h2>Kayıtlı görünümler</h2><button type="submit" aria-label="Kapat">×</button></form><p>Bu cihazda kabin ve kamera konumlarını saklayın.</p><div class="saved-view-create"><label>Görünüm adı <input id="saved-view-name" maxlength="60" placeholder="Örn. MDF ön görünüm"></label><button type="button" id="saved-view-create">Geçerli görünümü kaydet</button></div><div id="saved-view-list"></div>';
      document.body.appendChild(dialog);
      dialog.querySelector('#saved-view-create').addEventListener('click', () => {
        try {
          capture(dialog.querySelector('#saved-view-name').value);
          dialog.querySelector('#saved-view-name').value = '';
          render();
        } catch (error) { RS.showToast?.(error.message); }
      });
      dialog.querySelector('#saved-view-list').addEventListener('click', async event => {
        const button = event.target.closest('button[data-id]');
        if (!button) return;
        const views = read();
        const view = views.find(item => item.id === button.dataset.id);
        if (button.dataset.action === 'delete') { write(views.filter(item => item.id !== button.dataset.id)); render(); return; }
        dialog.close();
        if (!await restore(view)) RS.showToast?.('Görünüm açılamadı.');
      });
    }
    function render() {
      const list = dialog.querySelector('#saved-view-list');
      list.replaceChildren();
      const views = read();
      if (!views.length) { list.textContent = 'Henüz kayıtlı görünüm yok.'; return; }
      for (const view of views) {
        const row = document.createElement('div');
        row.className = 'saved-view-row';
        const label = document.createElement('span');
        label.textContent = `${view.name} · ${view.mode.toUpperCase()}`;
        const openButton = document.createElement('button');
        openButton.type = 'button'; openButton.textContent = 'Aç'; openButton.dataset.id = view.id; openButton.dataset.action = 'open';
        const deleteButton = document.createElement('button');
        deleteButton.type = 'button'; deleteButton.textContent = 'Sil'; deleteButton.dataset.id = view.id; deleteButton.dataset.action = 'delete';
        row.append(label, openButton, deleteButton);
        list.appendChild(row);
      }
    }
    render();
    dialog.showModal();
    dialog.querySelector('#saved-view-name').focus();
  }

  RS.SavedViews = { open, capture, restore, list: read };
  document.getElementById('btn-saved-views')?.addEventListener('click', open);
})();
