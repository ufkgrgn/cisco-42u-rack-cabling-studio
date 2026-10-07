/**
 * 3D Camera Controls, Lighting, Door & D-Pad
 */
export function initCameraControls(studio) {
    const mobileControls = document.querySelector('.mobile-3d-controls');
    mobileControls?.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button) return;
      const view = button.dataset.cameraView;
      if (view) {
        studio.setCameraView(view);
        mobileControls.querySelectorAll('[data-camera-view]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
        mobileControls.querySelector('details')?.removeAttribute('open');
        return;
      }
      const action = button.dataset.cameraAction;
      if (action === 'zoom-in') studio.zoomCamera(2.2);
      else if (action === 'zoom-out') studio.zoomCamera(-2.2);
      else if (action === 'door') document.getElementById('btn-door-toggle')?.click();
      else if (action === 'lighting') document.getElementById('btn-lighting-toggle')?.click();
    });
    const mobileQuality = document.getElementById('mobile-3d-quality');
    const desktopQuality = document.getElementById('performance-mode');
    if (mobileQuality && desktopQuality) {
      mobileQuality.value = desktopQuality.value;
      mobileQuality.addEventListener('change', () => {
        desktopQuality.value = mobileQuality.value;
        desktopQuality.dispatchEvent(new Event('change', { bubbles: true }));
      });
      desktopQuality.addEventListener('change', () => { mobileQuality.value = desktopQuality.value; });
    }
    // 1. Camera Buttons
    const camButtons = {
      'cam-iso': 'iso',
      'cam-front': 'front',
      'cam-rear': 'rear',
      'cam-top': 'top',
      'cam-focus': 'focus'
    };
    Object.entries(camButtons).forEach(([btnId, mode]) => {
      const btn = document.getElementById(btnId);
      if (btn) {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.cam-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          studio.setCameraView(mode);
        });
      }
    });

    // 2. Door Toggle
    const btnDoor = document.getElementById('btn-door-toggle');
    if (btnDoor) {
      btnDoor.classList.toggle('active', studio.state.doorOpen);
      btnDoor.textContent = studio.state.doorOpen ? 'Kapak: Açık' : 'Kapak: Kapalı';
      btnDoor.addEventListener('click', () => {
        const next = !studio.state.doorOpen;
        studio.setDoorOpen(next);
        btnDoor.classList.toggle('active', next);
        btnDoor.textContent = next ? 'Kapak: Açık' : 'Kapak: Kapalı';
        studio.showToast(next ? 'Kabin Cam Kapağı Açıldı' : 'Kabin Cam Kapağı Kapatıldı');
      });
    }

    // 3. Routing Mode Toggle (Catenary vs Structured)
    const btnRouting = document.getElementById('btn-routing-toggle');
    const btn3dRouting = document.getElementById('btn-3d-routing-toggle');

    function syncRoutingButtons(mode) {
      const isStructured = mode === 'structured';
      if (btnRouting) {
        btnRouting.textContent = isStructured ? 'Kablo kanalı' : 'Serbest kablo';
        btnRouting.classList.toggle('active', isStructured);
      }
      if (btn3dRouting) {
        const txt = btn3dRouting.querySelector('.btn-text');
        if (txt) txt.textContent = isStructured ? 'Yapısal Kanal' : 'Serbest Sarkma';
        else btn3dRouting.textContent = isStructured ? 'Yapısal Kanal' : 'Serbest Sarkma';
        btn3dRouting.classList.toggle('active', isStructured);
        btn3dRouting.setAttribute('aria-pressed', String(isStructured));
        btn3dRouting.title = isStructured
          ? 'Kablo Düzeni: 90° Yapısal Yan Kanal (Tıkla: Serbest Sarkma)'
          : 'Kablo Düzeni: Serbest Sarkma Fiziği (Tıkla: Yapısal Yan Kanal)';
      }
    }
    window.sync3dRoutingButtons = syncRoutingButtons;

    function toggleRoutingMode() {
      const next = studio.state.cableRoutingMode === 'catenary' ? 'structured' : 'catenary';
      studio.state.cableRoutingMode = next;
      studio.rebuildAllCables();
      syncRoutingButtons(next);
      studio.showToast(next === 'catenary' ? 'Kablolama: Yerçekimi Sarkma Fiziği (Catenary)' : 'Kablolama: 90° Yapısal Yan Kanal');
      if (window.RackStudio?.STATE) {
        window.RackStudio.STATE.cableRoutingMode = next === 'catenary' ? 'direct' : 'structured';
        window.RackStudio.invalidatePixiCableGeometry?.();
      }
    }

    if (btnRouting && !btnRouting.__wired) {
      btnRouting.__wired = true;
      btnRouting.addEventListener('click', toggleRoutingMode);
    }
    if (btn3dRouting && !btn3dRouting.__wired) {
      btn3dRouting.__wired = true;
      btn3dRouting.addEventListener('click', toggleRoutingMode);
    }
    syncRoutingButtons(studio.state.cableRoutingMode || 'structured');


    // 3b. Lighting Mode Toggle
    const btnLighting = document.getElementById('btn-lighting-toggle');
    if (btnLighting) {
      const modes = ['studio', 'datacenter'];
      const labels = {
        studio: 'Işık: İnceleme',
        datacenter: 'Işık: Veri merkezi'
      };
      let currentIdx = 0;
      btnLighting.addEventListener('click', () => {
        currentIdx = (currentIdx + 1) % modes.length;
        const mode = modes[currentIdx];
        studio.setLightingMode(mode);
        btnLighting.textContent = labels[mode];
        studio.showToast(`Işık Modu: ${labels[mode]}`);
      });
    }

    // 4. Rack U Height Slider & Display
    const uSlider = document.getElementById('rack-u-slider');
    const uDisplay = document.getElementById('rack-u-val');
    const rackNavSlider = document.getElementById('rack-nav-slider');

    if (uSlider) {
      uSlider.value = studio.state.rackHeightU;
      if (uDisplay) uDisplay.textContent = studio.state.rackHeightU + 'U';
      // The shared topbar owns the live resize transaction and its undo boundary.
      uSlider.addEventListener('change', () => { if (rackNavSlider) rackNavSlider.max = studio.state.rackHeightU; });
    }

    // 5. On-Screen Navigation D-Pad & Zoom Controls
    const dpadUp = document.getElementById('dpad-up');
    const dpadDown = document.getElementById('dpad-down');
    const dpadLeft = document.getElementById('dpad-left');
    const dpadRight = document.getElementById('dpad-right');
    const dpadReset = document.getElementById('dpad-reset');
    const navZoomIn = document.getElementById('btn-nav-zoom-in');
    const navZoomOut = document.getElementById('btn-nav-zoom-out');

    if (dpadUp) dpadUp.addEventListener('click', () => studio.panCamera(0, 1.4));
    if (dpadDown) dpadDown.addEventListener('click', () => studio.panCamera(0, -1.4));
    if (dpadLeft) dpadLeft.addEventListener('click', () => studio.panCamera(-1.4, 0));
    if (dpadRight) dpadRight.addEventListener('click', () => studio.panCamera(1.4, 0));
    if (dpadReset) dpadReset.addEventListener('click', () => studio.setCameraView('iso'));
    if (navZoomIn) navZoomIn.addEventListener('click', () => studio.zoomCamera(2.2));
    if (navZoomOut) navZoomOut.addEventListener('click', () => studio.zoomCamera(-2.2));

    if (rackNavSlider) {
      rackNavSlider.max = studio.state.rackHeightU;
      rackNavSlider.value = Math.floor(studio.state.rackHeightU / 2);
      rackNavSlider.addEventListener('input', (e) => {
        const targetU = parseInt(e.target.value);
        studio.scrollRackToU(targetU);
      });
    }

}
