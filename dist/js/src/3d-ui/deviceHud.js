/**
 * Floating 3D Device HUD & Context Menu
 */
export function initDeviceHud(studio) {
    // 6e. Floating 3D Device HUD Action Wiring
    document.getElementById('btn-hud-focus')?.addEventListener('click', () => {
      if (studio.selectedDeviceId) studio.focusDevice(studio.selectedDeviceId);
    });
    document.getElementById('btn-hud-config')?.addEventListener('click', () => {
      if (studio.selectedDeviceId) {
        window.DeviceMetadataEditor?.open3D(studio.selectedDeviceId);
      }
    });
    document.getElementById('btn-hud-dismount')?.addEventListener('click', () => {
      if (studio.selectedDeviceId) {
        const dev = studio.state.devices.find(d => d.id === studio.selectedDeviceId);
        const name = dev ? dev.name : 'Cihaz';
        studio.removeDevice(studio.selectedDeviceId);
        studio.showToast(`🗑️ "${name}" kabinden söküldü.`);
        renderInstalledDevicesList();
        renderCatalog(searchInput ? searchInput.value : '');
      }
    });
    document.getElementById('btn-hud-close')?.addEventListener('click', () => {
      studio.deselectDevice();
    });


    // 9. 3D DEVICE CONTEXT FLOATING MENU
    const devContext = document.getElementById('device-context-menu');
    const devCtxTitle = document.getElementById('dev-ctx-title');
    const btnDevMoveUp = document.getElementById('btn-dev-move-up');
    const btnDevMoveDown = document.getElementById('btn-dev-move-down');
    const btnDevRemove = document.getElementById('btn-dev-remove');

    let activeContextDevId = null;

    window.openDeviceContext = function (devId, clientX, clientY) {
      const dev = studio.state.devices.find(d => d.id === devId);
      if (!dev || !devContext) return;

      activeContextDevId = devId;
      devCtxTitle.textContent = `${dev.name} (U${dev.startU} - ${dev.uHeight}U)`;

      const posX = Math.min(clientX + 8, window.innerWidth - 220);
      const posY = Math.min(clientY + 8, window.innerHeight - 150);

      devContext.style.left = posX + 'px';
      devContext.style.top = posY + 'px';
      devContext.style.display = 'block';
    };

    window.addEventListener('click', (e) => {
      if (devContext && !devContext.contains(e.target)) {
        devContext.style.display = 'none';
      }
    });

    if (btnDevMoveUp) {
      btnDevMoveUp.addEventListener('click', () => {
        if (activeContextDevId) {
          studio.moveDevice(activeContextDevId, 1);
          devContext.style.display = 'none';
          renderCatalog(searchInput ? searchInput.value : '');
        }
      });
    }

    if (btnDevMoveDown) {
      btnDevMoveDown.addEventListener('click', () => {
        if (activeContextDevId) {
          studio.moveDevice(activeContextDevId, -1);
          devContext.style.display = 'none';
          renderCatalog(searchInput ? searchInput.value : '');
        }
      });
    }

    if (btnDevRemove) {
      btnDevRemove.addEventListener('click', () => {
        if (activeContextDevId) {
          const dev = studio.state.devices.find(d => d.id === activeContextDevId);
          if (confirm(`"${dev ? dev.name : 'Bu cihaz'}" kabinden sökülsün mü? (Bağlı kablolar da sökülecektir)`)) {
            studio.removeDevice(activeContextDevId);
            devContext.style.display = 'none';
            studio.showToast('Cihaz kabinden söküldü.');
            renderCatalog(searchInput ? searchInput.value : '');
          }
        }
      });
    }

    // 9b. Device Hostname & IP Edit Modal
    const btnDevEditConfig = document.getElementById('btn-dev-edit-config');
    const modalDeviceEdit = document.getElementById('modal-device-edit');
    const btnCloseDeviceEdit = document.getElementById('btn-close-device-edit');
    const btnCancelDeviceEdit = document.getElementById('btn-cancel-device-edit');
    const btnSaveDeviceEdit = document.getElementById('btn-save-device-edit');
    const devEditHostname = document.getElementById('dev-edit-hostname');
    const devEditIp = document.getElementById('dev-edit-ip');
    const devEditMac = document.getElementById('dev-edit-mac');
    const devEditSerial = document.getElementById('dev-edit-serial');
    const devEditPanelLabel = document.getElementById('dev-edit-panel-label');
    const modalDevEditTitle = document.getElementById('modal-dev-edit-title');

    if (btnDevEditConfig && modalDeviceEdit) {
      btnDevEditConfig.addEventListener('click', () => {
        if (!activeContextDevId) return;
        const dev = studio.state.devices.find(d => d.id === activeContextDevId);
        if (!dev) return;

        devContext.style.display = 'none';
        window.DeviceMetadataEditor?.open3D(dev.id);
      });

      const closeDevEdit = () => { modalDeviceEdit.style.display = 'none'; modalDeviceEdit.dataset.source = ''; };
      if (btnCloseDeviceEdit) btnCloseDeviceEdit.addEventListener('click', closeDevEdit);
      if (btnCancelDeviceEdit) btnCancelDeviceEdit.addEventListener('click', closeDevEdit);

      if (btnSaveDeviceEdit) {
        btnSaveDeviceEdit.addEventListener('click', () => {
          if (!activeContextDevId) return;
          const newHostname = devEditHostname ? devEditHostname.value.trim() : '';
          const newIp = devEditIp ? devEditIp.value.trim() : '';
          const newMac = devEditMac ? devEditMac.value.trim() : '';
          const newSerial = devEditSerial ? devEditSerial.value.trim() : '';
          const newPanelLabel = devEditPanelLabel ? devEditPanelLabel.value.trim() : '';
          studio.updateDeviceMetadata(activeContextDevId, {
            name: newHostname,
            ipAddress: newIp,
            macAddress: newMac,
            serialNumber: newSerial,
            panelLabel: newPanelLabel
          });
          renderInstalledDevicesList();
          if (typeof window.sync3Dto2D === 'function') window.sync3Dto2D();
          modalDeviceEdit.dataset.source = '';
          modalDeviceEdit.style.display = 'none';
        });
      }
    }

}
