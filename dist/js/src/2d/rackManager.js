/**
 * Multi-Rack Tab Management
 */
import { STATE, dom, getActiveRack, initDomReferences } from './state.js';
import { escapeHtml } from './utils.js';
import { renderMountedDevices, renderRackRailsAndSlots } from './rackRenderer.js';
import { renderScheduleTable } from './scheduleTable.js';
import { renderAllCables, cancelPendingConnection } from './cablingEngine.js';
import { fitRackToScreen } from './zoomManager.js';

// --- MULTI-RACK TAB MANAGEMENT ---
  function renderRackTabs() {
    if (!dom.rackTabsList) return;
    dom.rackTabsList.innerHTML = '';

    STATE.racks.forEach((rack, idx) => {
      const tab = document.createElement('div');
      tab.className = `rack-tab ${rack.id === STATE.activeRackId ? 'active' : ''}`;
      tab.dataset.rackId = rack.id;

      const deviceCount = rack.devices.length;
      const canDelete = STATE.racks.length > 1;

      tab.innerHTML = `
        <svg width="13" height="13" fill="currentColor" viewBox="0 0 16 16"><path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v1.077a2.5 2.5 0 0 1-.95 1.956L4.5 6.786V14.5a.5.5 0 0 0 .5.5h6a.5.5 0 0 0 .5-.5V6.786l-1.55-1.253A2.5 2.5 0 0 1 9 3.577V2.5A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v11a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 13.5v-11z"/></svg>
        <span>${escapeHtml(rack.name)}</span>
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

      dom.rackTabsList.appendChild(tab);
    });
  }

  function switchActiveRack(rackId) {
    if (STATE.activeRackId === rackId) return;
    STATE.activeRackId = rackId;

    if (STATE.viewMode === 'multi') {
      // In multi mode: just swap active classes and reassign canonical IDs without full DOM rebuild
      document.querySelectorAll('.rack-container').forEach(container => {
        const cRackId = container.dataset.rackId;
        const isNowActive = cRackId === rackId;
        container.classList.toggle('active-rack', isNowActive);
        container.classList.toggle('inactive-rack', !isNowActive);

        // Move canonical IDs to the newly active rack's elements
        const rackSpace = container.querySelector('[id^="rack-space"], .rack-space');
        const railLeft = container.querySelector('[id^="rail-left"], .rack-rail-left');
        const railRight = container.querySelector('[id^="rail-right"], .rack-rail-right');

        if (rackSpace) rackSpace.id = isNowActive ? 'rack-space' : `rack-${cRackId}-space`;
        if (railLeft) railLeft.id = isNowActive ? 'rail-left' : `rack-${cRackId}-rail-left`;
        if (railRight) railRight.id = isNowActive ? 'rail-right' : `rack-${cRackId}-rail-right`;

        // Re-map slot IDs
        const slots = container.querySelectorAll('[id^="rack-slot-u"], [id^="rack-"]');
        slots.forEach(slot => {
          const uMatch = slot.id.match(/u(\d+)$/);
          if (!uMatch) return;
          const u = uMatch[1];
          slot.id = isNowActive ? `rack-slot-u${u}` : `rack-${cRackId}-slot-u${u}`;
        });
      });

      initDomReferences();
      renderRackTabs();
      renderMountedDevices();
      renderScheduleTable();
      renderAllCables();
    } else {
      renderRackRailsAndSlots();
      renderRackTabs();
      renderMountedDevices();
      renderScheduleTable();
      renderAllCables();
      requestAnimationFrame(() => fitRackToScreen(false));
    }
  }

  function addNewRack(customName) {
    do { STATE.rackCounter++; } while (STATE.racks.some(r => r.id === `rack-${STATE.rackCounter}`));
    const newId = `rack-${STATE.rackCounter}`;
    const newName = customName || `Kabin ${STATE.rackCounter} - IDF Kenar`;
    const newRack = {
      id: newId,
      name: newName,
      heightU: 42,
        units: Array(43).fill(null),
      devices: []
    };
    STATE.racks.push(newRack);
    STATE.activeRackId = newId;
    renderRackRailsAndSlots();
    renderRackTabs();
    renderMountedDevices();
    renderScheduleTable();
    renderAllCables();
    requestAnimationFrame(() => fitRackToScreen(false));
    return newRack;
  }

  function renameActiveRack() {
    const activeRack = getActiveRack();
    if (!activeRack) return;
    const currentName = activeRack.name;
    const newName = prompt("Kabin adını girin:", currentName);
    if (newName && newName.trim()) {
      activeRack.name = newName.trim();
      renderRackTabs();
      renderScheduleTable();
    }
  }

  function deleteRack(rackId) {
    if (STATE.racks.length <= 1) {
      alert("En az bir kabin bulunmalıdır!");
      return;
    }
    const rackToDelete = STATE.racks.find(r => r.id === rackId);
    if (!rackToDelete) return;
    if (confirm(`"${rackToDelete.name}" kabinini ve içindeki tüm cihazları silmek istediğinize emin misiniz?`)) {
      // Remove cables attached to this rack
      STATE.cables = STATE.cables.filter(c => c.from.rackId !== rackId && c.to.rackId !== rackId);
      STATE.racks = STATE.racks.filter(r => r.id !== rackId);
      if (STATE.activeRackId === rackId) {
        STATE.activeRackId = STATE.racks[0].id;
      }
      renderRackTabs();
      renderMountedDevices();
      renderScheduleTable();
      renderAllCables();
    }
  }

export {
  renderRackTabs,
  switchActiveRack,
  addNewRack,
  renameActiveRack,
  deleteRack
};
