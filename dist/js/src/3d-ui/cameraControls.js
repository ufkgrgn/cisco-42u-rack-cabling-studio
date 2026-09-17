/**
 * 3D Camera Controls, Lighting, Door & D-Pad
 */
export function initCameraControls(studio) {
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
      btnDoor.innerHTML = studio.state.doorOpen ? '🚪 Kapak: Açık' : '🚪 Kapak: Kapalı';
      btnDoor.addEventListener('click', () => {
        const next = !studio.state.doorOpen;
        studio.setDoorOpen(next);
        btnDoor.classList.toggle('active', next);
        btnDoor.innerHTML = next ? '🚪 Kapak: Açık' : '🚪 Kapak: Kapalı';
        studio.showToast(next ? 'Kabin Cam Kapağı Açıldı' : 'Kabin Cam Kapağı Kapatıldı');
      });
    }

    // 3. Routing Mode Toggle (Catenary vs Structured)
    const btnRouting = document.getElementById('btn-routing-toggle');
    if (btnRouting) {
      btnRouting.addEventListener('click', () => {
        const next = studio.state.cableRoutingMode === 'catenary' ? 'structured' : 'catenary';
        studio.state.cableRoutingMode = next;
        studio.rebuildAllCables();
        btnRouting.innerHTML = next === 'catenary' ? '〰️ Catenary Fizik' : '🔲 Yapısal Kanal';
        studio.showToast(next === 'catenary' ? 'Kablolama: Yerçekimi Sarkma Fiziği (Catenary)' : 'Kablolama: 90° Yapısal Yan Kanal');
      });
    }

    // 3b. Lighting Mode Toggle (Studio vs Datacenter vs Cyberpunk)
    const btnLighting = document.getElementById('btn-lighting-toggle');
    if (btnLighting) {
      const modes = ['studio', 'datacenter', 'cyberpunk'];
      const labels = {
        studio: '💡 Stüdyo Işığı (Net)',
        datacenter: '🏢 Veri Merkezi',
        cyberpunk: '⚡ Cyberpunk Neon'
      };
      let currentIdx = 0;
      btnLighting.addEventListener('click', () => {
        currentIdx = (currentIdx + 1) % modes.length;
        const mode = modes[currentIdx];
        studio.setLightingMode(mode);
        btnLighting.innerHTML = labels[mode];
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
      uSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        if (uDisplay) uDisplay.textContent = val + 'U';
        studio.setRackHeight(val);
        if (rackNavSlider) rackNavSlider.max = val;
      });
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
