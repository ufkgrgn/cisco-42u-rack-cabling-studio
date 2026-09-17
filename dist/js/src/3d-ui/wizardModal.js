/**
 * Custom 3D Hardware Wizard Modal
 */
export function initWizardModal(studio) {
    // 12. Custom Device Wizard Modal
    const btnWizard = document.getElementById('btn-3d-wizard-modal');
    const wizardModal = document.getElementById('modal-wizard');
    const btnCloseWizard = document.getElementById('btn-close-wizard');
    const btnCreateDevice = document.getElementById('btn-create-custom-device');

    if (btnWizard && wizardModal) {
      btnWizard.addEventListener('click', () => wizardModal.style.display = 'flex');
      if (btnCloseWizard) btnCloseWizard.addEventListener('click', () => wizardModal.style.display = 'none');
      if (btnCreateDevice) {
        btnCreateDevice.addEventListener('click', () => {
          const name = document.getElementById('wiz-name').value.trim() || 'Özel Donanım';
          const manufacturer = document.getElementById('wiz-manuf').value.trim() || 'Özel Üretim';
          const category = document.getElementById('wiz-cat').value;
          const uHeight = parseInt(document.getElementById('wiz-u').value) || 1;
          const depthMm = parseInt(document.getElementById('wiz-depth').value) || 450;
          const portsCount = parseInt(document.getElementById('wiz-ports').value) || 0;
          const portType = document.getElementById('wiz-port-type').value;

          const customId = 'custom-' + Math.random().toString(36).substr(2, 7);
          const newItem = {
            id: customId,
            name: name,
            manufacturer: manufacturer,
            category: category,
            u: uHeight,
            depthMm: depthMm,
            powerWatts: 350,
            color: 0x334155,
            portsCount: portsCount,
            portType: portType,
            uplinks: 0,
            desc: `${uHeight}U Özel Tasarım ${manufacturer} ${name}`
          };

          window.CATALOG_3D.unshift(newItem);
          renderCatalog();
          wizardModal.style.display = 'none';
          studio.showToast(`Yeni Donanım Eklendi: ${name}`);
        });
      }
    }

}
