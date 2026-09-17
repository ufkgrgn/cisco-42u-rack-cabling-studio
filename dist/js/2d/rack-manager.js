/**
 * Cisco Enterprise Rack & Cabling Studio - Multi-Rack Tab Management
 */
(function () {
  'use strict';

  const RS = window.RackStudio = window.RackStudio || {};

  function renderRackTabs() {
    if (!RS.dom?.rackTabsList) return;
    RS.dom.rackTabsList.innerHTML = '';

    RS.STATE.racks.forEach((rack, idx) => {
      const tab = document.createElement('div');
      tab.className = `rack-tab ${rack.id === RS.STATE.activeRackId ? 'active' : ''}`;
      tab.dataset.rackId = rack.id;

      const deviceCount = rack.devices.length;
      const canDelete = RS.STATE.racks.length > 1;

      tab.innerHTML = `
        <svg width="13" height="13" fill="currentColor" viewBox="0 0 16 16"><path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v1.077a2.5 2.5 0 0 1-.95 1.956L4.5 6.786V14.5a.5.5 0 0 0 .5.5h6a.5.5 0 0 0 .5-.5V6.786l-1.55-1.253A2.5 2.5 0 0 1 9 3.577V2.5A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v11a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 13.5v-11z"/></svg>
        <span>${RS.escapeHtml(rack.name)}</span>
        <span class="rack-tab-badge">${deviceCount} Cihaz</span>
        ${canDelete ? `<span class="rack-tab-close" data-rack-id="${rack.id}" title="Kabini Sil">✕</span>` : ''}
      `;

      tab.addEventListener('click', (e) => {
        const closeBtn = e.target.closest('.rack-tab-close');
        if (closeBtn) {
          e.stopPropagation();
          deleteRack(rack.id);
          return;
        }
        switchActiveRack(rack.id);
      });

      RS.dom.rackTabsList.appendChild(tab);
    });
  }

  function switchActiveRack(rackId) {
    if (RS.STATE.activeRackId === rackId) return;
    RS.STATE.activeRackId = rackId;

    if (RS.STATE.viewMode === 'multi') {
      document.querySelectorAll('.rack-container').forEach(container => {
        const cRackId = container.dataset.rackId;
        const isNowActive = cRackId === rackId;
        container.classList.toggle('active-rack-target', isNowActive);
      });

      renderRackTabs();
      if (RS.renderScheduleTable) RS.renderScheduleTable();
      if (RS.renderAllCables) RS.renderAllCables();
    } else {
      if (RS.renderRackRailsAndSlots) RS.renderRackRailsAndSlots();
      renderRackTabs();
      if (RS.renderMountedDevices) RS.renderMountedDevices();
      if (RS.renderScheduleTable) RS.renderScheduleTable();
      if (RS.renderAllCables) RS.renderAllCables();
      requestAnimationFrame(() => {
        if (RS.fitRackToScreen) RS.fitRackToScreen(false);
      });
    }
  }

  function addNewRack(customName) {
    do { RS.STATE.rackCounter++; } while (RS.STATE.racks.some(r => r.id === `rack-${RS.STATE.rackCounter}`));
    const newId = `rack-${RS.STATE.rackCounter}`;
    const newName = customName || `Kabin ${RS.STATE.rackCounter} - IDF Kenar`;
    const newRack = {
      id: newId,
      name: newName,
      heightU: 42,
      units: Array(43).fill(null),
      devices: []
    };
    RS.STATE.racks.push(newRack);
    RS.STATE.activeRackId = newId;
    if (RS.renderRackRailsAndSlots) RS.renderRackRailsAndSlots();
    renderRackTabs();
    if (RS.renderMountedDevices) RS.renderMountedDevices();
    if (RS.renderScheduleTable) RS.renderScheduleTable();
    if (RS.renderAllCables) RS.renderAllCables();
    requestAnimationFrame(() => {
      if (RS.fitRackToScreen) RS.fitRackToScreen(false);
    });
    return newRack;
  }

  function renameActiveRack() {
    const activeRack = RS.getActiveRack ? RS.getActiveRack() : null;
    if (!activeRack) return;
    const currentName = activeRack.name;
    const newName = prompt("Kabin adını girin:", currentName);
    if (newName && newName.trim()) {
      activeRack.name = newName.trim();
      renderRackTabs();
      if (RS.renderScheduleTable) RS.renderScheduleTable();
    }
  }

  function deleteRack(rackId) {
    if (RS.STATE.racks.length <= 1) {
      alert("En az bir kabin bulunmalıdır!");
      return;
    }
    const rackToDelete = RS.STATE.racks.find(r => r.id === rackId);
    if (!rackToDelete) return;
    if (confirm(`"${rackToDelete.name}" kabinini ve içindeki tüm cihazları silmek istediğinize emin misiniz?`)) {
      // Remove cables attached to this rack
      RS.STATE.cables = RS.STATE.cables.filter(c => c.from.rackId !== rackId && c.to.rackId !== rackId);
      RS.STATE.racks = RS.STATE.racks.filter(r => r.id !== rackId);
      if (RS.STATE.activeRackId === rackId) {
        RS.STATE.activeRackId = RS.STATE.racks[0].id;
      }
      renderRackTabs();
      if (RS.renderMountedDevices) RS.renderMountedDevices();
      if (RS.renderScheduleTable) RS.renderScheduleTable();
      if (RS.renderAllCables) RS.renderAllCables();
    }
  }

  RS.renderRackTabs = renderRackTabs;
  RS.switchActiveRack = switchActiveRack;
  RS.addNewRack = addNewRack;
  RS.renameActiveRack = renameActiveRack;
  RS.deleteRack = deleteRack;
})();
