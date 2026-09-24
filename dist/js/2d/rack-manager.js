/**
 * Cisco Enterprise Rack & Cabling Studio - Multi-Rack Tab Management
 */
(function () {
  'use strict';

  const RS = window.RackStudio = window.RackStudio || {};

  function getRackClusters() {
    const racks = RS.STATE.racks || [];
    const cables = RS.STATE.cables || [];
    if (racks.length <= 1 || cables.length === 0) return [];

    const adj = new Map();
    const cableCounts = new Map();
    racks.forEach(r => adj.set(r.id, new Set()));

    cables.forEach(c => {
      const fromRack = c.from?.rackId;
      const toRack = c.to?.rackId;
      if (fromRack && toRack && fromRack !== toRack && adj.has(fromRack) && adj.has(toRack)) {
        adj.get(fromRack).add(toRack);
        adj.get(toRack).add(fromRack);
        const pairKey = [fromRack, toRack].sort().join('--');
        cableCounts.set(pairKey, (cableCounts.get(pairKey) || 0) + 1);
      }
    });

    const visited = new Set();
    const clusters = [];

    racks.forEach(r => {
      if (!visited.has(r.id)) {
        const clusterRacks = [];
        const queue = [r.id];
        visited.add(r.id);

        while (queue.length > 0) {
          const curr = queue.shift();
          const rackObj = racks.find(x => x.id === curr);
          if (rackObj) clusterRacks.push(rackObj);
          const neighbors = adj.get(curr) || [];
          neighbors.forEach(nbr => {
            if (!visited.has(nbr)) {
              visited.add(nbr);
              queue.push(nbr);
            }
          });
        }

        if (clusterRacks.length > 1) {
          let totalCables = 0;
          for (let i = 0; i < clusterRacks.length; i++) {
            for (let j = i + 1; j < clusterRacks.length; j++) {
              const pairKey = [clusterRacks[i].id, clusterRacks[j].id].sort().join('--');
              totalCables += (cableCounts.get(pairKey) || 0);
            }
          }
          clusters.push({
            id: clusterRacks.map(x => x.id).join('+'),
            name: clusterRacks.map(x => x.name).join(' + '),
            rackIds: clusterRacks.map(x => x.id),
            racks: clusterRacks,
            cableCount: totalCables
          });
        }
      }
    });

    return clusters;
  }

  function toggleRackDropdown() {
    const dropdown = RS.dom?.rackSelectorDropdown || document.getElementById('rack-selector-dropdown');
    const trigger = RS.dom?.btnRackSelector || document.getElementById('btn-rack-selector');
    if (!dropdown) return;
    const isHidden = dropdown.style.display === 'none' || !dropdown.style.display;
    if (isHidden) {
      dropdown.style.display = 'flex';
      trigger?.setAttribute('aria-expanded', 'true');
    } else {
      dropdown.style.display = 'none';
      trigger?.setAttribute('aria-expanded', 'false');
    }
  }

  function closeRackDropdown() {
    const dropdown = RS.dom?.rackSelectorDropdown || document.getElementById('rack-selector-dropdown');
    const trigger = RS.dom?.btnRackSelector || document.getElementById('btn-rack-selector');
    if (dropdown) dropdown.style.display = 'none';
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
  }

  document.addEventListener('click', (e) => {
    const wrapper = document.getElementById('rack-selector-wrapper');
    if (wrapper && !wrapper.contains(e.target)) {
      closeRackDropdown();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeRackDropdown();
  });

  function renderRackTabs() {
    const activeRack = RS.getActiveRack ? RS.getActiveRack() : (RS.STATE.racks[0] || null);

    // Update Header Selector Trigger Label & Badge
    if (RS.dom?.rackSelectorName && activeRack) {
      RS.dom.rackSelectorName.textContent = activeRack.name;
    }
    if (RS.dom?.rackSelectorBadge && activeRack) {
      const devCount = activeRack.devices ? activeRack.devices.length : 0;
      RS.dom.rackSelectorBadge.textContent = `${activeRack.heightU || 42}U • ${devCount} cihaz`;
    }

    // Populate dropdown contents
    const dropdownContent = document.getElementById('rack-selector-dropdown-content');
    if (dropdownContent) {
      dropdownContent.innerHTML = '';

      const clusters = getRackClusters();
      if (clusters.length > 0) {
        const clusterSection = document.createElement('div');
        clusterSection.className = 'rack-dropdown-section';
        clusterSection.innerHTML = `<div class="rack-dropdown-group-title">🔗 BAĞLANTILI KÜMELER</div>`;
        
        clusters.forEach(cluster => {
          const item = document.createElement('div');
          item.className = 'rack-dropdown-cluster-item';
          item.innerHTML = `
            <span class="cluster-icon">🔗</span>
            <div class="cluster-body">
              <span class="cluster-name">${RS.escapeHtml(cluster.name)}</span>
              <span class="cluster-meta">${cluster.racks.length} kabin • ${cluster.cableCount} bağlantı</span>
            </div>
            <button type="button" class="cluster-btn-open" title="Kümeyi yan yana aç">Aç</button>
          `;
          item.addEventListener('click', () => {
            if (RS.setViewMode) RS.setViewMode('multi');
            else RS.STATE.viewMode = 'multi';
            switchActiveRack(cluster.rackIds[0]);
            closeRackDropdown();
            requestAnimationFrame(() => {
              if (RS.fitRackToScreen) RS.fitRackToScreen(true);
            });
          });
          clusterSection.appendChild(item);
        });
        dropdownContent.appendChild(clusterSection);
      }

      // Individual Cabinets Section
      const racksSection = document.createElement('div');
      racksSection.className = 'rack-dropdown-section';
      racksSection.innerHTML = `<div class="rack-dropdown-group-title">🗄️ KABİNLER</div>`;

      RS.STATE.racks.forEach((rack, idx) => {
        const item = document.createElement('div');
        const isActive = rack.id === RS.STATE.activeRackId;
        item.className = `rack-dropdown-item rack-tab ${isActive ? 'active' : ''}`;
        item.dataset.rackId = rack.id;

        const extCables = (RS.STATE.cables || []).filter(c => 
          (c.from.rackId === rack.id && c.to.rackId !== rack.id) ||
          (c.to.rackId === rack.id && c.from.rackId !== rack.id)
        ).length;

        const devCount = rack.devices ? rack.devices.length : 0;
        const indexLabel = String(idx + 1).padStart(2, '0');
        const canDelete = RS.STATE.racks.length > 1;

        item.innerHTML = `
          <span class="rack-item-index">${indexLabel}</span>
          <div class="rack-item-body">
            <span class="rack-item-name">${RS.escapeHtml(rack.name)}</span>
            <span class="rack-item-meta">${rack.heightU || 42}U • ${devCount} cihaz${extCables > 0 ? ` • 🔗 ${extCables} dış bağlantı` : ''}</span>
          </div>
          ${canDelete ? `<button type="button" class="rack-item-del-btn" data-rack-id="${rack.id}" title="Kabini Sil">✕</button>` : ''}
        `;

        item.addEventListener('click', (e) => {
          const delBtn = e.target.closest('.rack-item-del-btn');
          if (delBtn) {
            e.stopPropagation();
            deleteRack(rack.id);
            return;
          }
          switchActiveRack(rack.id);
          closeRackDropdown();
        });

        racksSection.appendChild(item);
      });
      dropdownContent.appendChild(racksSection);
    }

    // Keep #rack-tabs-list populated for test queries
    if (RS.dom?.rackTabsList) {
      RS.dom.rackTabsList.innerHTML = '';
      RS.STATE.racks.forEach((rack, idx) => {
        const tab = document.createElement('button');
        tab.type = 'button';
        tab.className = `rack-tab ${rack.id === RS.STATE.activeRackId ? 'active' : ''}`;
        tab.dataset.rackId = rack.id;
        tab.setAttribute('aria-pressed', rack.id === RS.STATE.activeRackId ? 'true' : 'false');
        tab.innerHTML = `<span class="rack-tab-name">${RS.escapeHtml(rack.name)}</span>`;
        tab.addEventListener('click', () => switchActiveRack(rack.id));
        RS.dom.rackTabsList.appendChild(tab);
      });
    }

    const isMulti = RS.STATE.viewMode === 'multi';
    RS.dom.btnViewModeSingle?.classList.toggle('active', !isMulti);
    RS.dom.btnViewModeMulti?.classList.toggle('active', isMulti);
    RS.dom.btnViewModeSingle?.setAttribute('aria-pressed', !isMulti ? 'true' : 'false');
    RS.dom.btnViewModeMulti?.setAttribute('aria-pressed', isMulti ? 'true' : 'false');
  }

  function switchActiveRack(rackId, options = {}) {
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
      if (options.smoothFocus !== false && RS.focusOnRack) {
        RS.focusOnRack(rackId);
      }
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
    document.dispatchEvent(new CustomEvent('rackstudio:change', { bubbles: true, detail: { immediate: true } }));
    requestAnimationFrame(() => {
      if (RS.fitRackToScreen) RS.fitRackToScreen(false);
      requestAnimationFrame(() => {
        if (RS.invalidatePixiCableGeometry) RS.invalidatePixiCableGeometry();
        if (RS.renderAllCables) RS.renderAllCables();
      });
    });
    return newRack;
  }

  function renameActiveRack() {
    const activeRack = RS.getActiveRack ? RS.getActiveRack() : null;
    if (!activeRack) return;
    const currentName = activeRack.name;
    const newName = prompt("Kabin Adını Düzenle:", currentName);
    if (newName && newName.trim() && newName.trim() !== currentName) {
      activeRack.name = newName.trim();
      renderRackTabs();
      if (RS.renderScheduleTable) RS.renderScheduleTable();
      document.dispatchEvent(new CustomEvent('rackstudio:change', { bubbles: true, detail: { immediate: true } }));
    }
  }

  function deleteRack(rackId) {
    if (RS.STATE.racks.length <= 1) {
      alert("En az bir kabin bulunmalıdır!");
      return;
    }
    const rackToDelete = RS.STATE.racks.find(r => r.id === rackId);
    if (!rackToDelete) return;

    const deviceCount = rackToDelete.devices ? rackToDelete.devices.length : 0;
    const cableCount = RS.STATE.cables
      ? RS.STATE.cables.filter(c => c.from.rackId === rackId || c.to.rackId === rackId).length
      : 0;

    let confirmMsg = `"${rackToDelete.name}" kabinini silmek istediğinize emin misiniz?`;
    if (deviceCount > 0 || cableCount > 0) {
      const parts = [];
      if (deviceCount > 0) parts.push(`${deviceCount} cihaz`);
      if (cableCount > 0) parts.push(`${cableCount} kablo bağlantısı`);
      confirmMsg += `\n\n⚠️ Bu kabinde ${parts.join(' ve ')} bulunmaktadır. Bunların tamamı silinecektir.`;
    }

    if (confirm(confirmMsg)) {
      const shouldRefit = !!RS.ZOOM_STATE?.isFit;
      // Remove cables attached to this rack
      RS.STATE.cables = RS.STATE.cables.filter(c => c.from.rackId !== rackId && c.to.rackId !== rackId);
      // Clean up Pixi scene and registry for removed rack
      rackToDelete.devices?.forEach(d => RS.DeviceSceneRegistry?.pruneDevice?.(d.instanceId));
      RS.PixiDeviceScene?.destroyDeviceRackScene?.(rackId);
      // Remove the rack itself
      RS.STATE.racks = RS.STATE.racks.filter(r => r.id !== rackId);
      if (RS.rebuildStateIndexes) RS.rebuildStateIndexes();
      // Switch active rack if we just deleted it
      if (RS.STATE.activeRackId === rackId) {
        RS.STATE.activeRackId = RS.STATE.racks[0].id;
      }
      // If only 1 rack remains, ensure viewMode is single or handles it cleanly
      const switchingToSingle = RS.STATE.racks.length <= 1 && RS.STATE.viewMode === 'multi';
      if (switchingToSingle && RS.setViewMode) {
        // setViewMode owns the structural/device/cable render. Running the same
        // sequence again used to replace/move the Pixi canvas a second time.
        RS.setViewMode('single');
      } else {
        if (switchingToSingle) RS.STATE.viewMode = 'single';
        // Full re-render sequence: rails must come first to rebuild DOM, then devices
        if (RS.renderRackRailsAndSlots) RS.renderRackRailsAndSlots();
        if (RS.renderMountedDevices) RS.renderMountedDevices();
        if (RS.renderAllCables) RS.renderAllCables();
      }
      renderRackTabs();
      if (RS.renderScheduleTable) RS.renderScheduleTable();
      document.dispatchEvent(new CustomEvent('rackstudio:change', { bubbles: true, detail: { immediate: true } }));
      requestAnimationFrame(() => {
        if (shouldRefit || switchingToSingle) RS.fitRackToScreen?.(false);
        requestAnimationFrame(() => {
          RS.invalidatePixiCableGeometry?.();
          RS.renderAllCables?.();
        });
      });
    }
  }

  /**
   * Resizes a rack's height in U units.
   * Ensures devices are not clipped; returns false if occupied slots would be cut off.
   */
  function resizeRackHeight(rackId, newHeightU) {
    const rack = RS.STATE.racks.find(r => r.id === rackId);
    if (!rack) return false;
    newHeightU = Math.max(12, Math.min(60, Math.round(newHeightU)));
    if (newHeightU === rack.heightU) return true;

    // Check if any device would be cut off (devices are placed from 1 to topU)
    // Note: in this studio, topU is the top unit of device.
    // If shrinking, cannot shrink below the highest occupied slot or lowest occupied slot depending on coordinate system.
    // In our system, slot 1 is bottom, slot heightU is top.
    // So shrinking from 42U to 30U cuts off slots 31-42.
    // Therefore, any device with topU > newHeightU would be cut off.
    const highestOccupiedU = rack.devices.reduce((max, d) => Math.max(max, d.topU), 0);
    if (newHeightU < highestOccupiedU) {
      if (RS.showTemporaryTooltip) {
        RS.showTemporaryTooltip(window.innerWidth / 2, window.innerHeight / 2, `⚠️ Kabin U${highestOccupiedU} seviyesindeki cihazdan daha aşağıya küçültülemez.`);
      }
      return false;
    }

    rack.heightU = newHeightU;
    rack.units = Array(newHeightU + 1).fill(null);
    rack.devices.forEach(d => {
      for (let u = d.topU - d.uHeight + 1; u <= d.topU; u++) {
        if (u <= newHeightU) rack.units[u] = d.instanceId;
      }
    });

    if (RS.renderRackRailsAndSlots) RS.renderRackRailsAndSlots();
    renderRackTabs();
    if (RS.renderMountedDevices) RS.renderMountedDevices();
    if (RS.renderScheduleTable) RS.renderScheduleTable();
    if (RS.renderAllCables) RS.renderAllCables();
    document.dispatchEvent(new CustomEvent('rackstudio:change', { bubbles: true, detail: { immediate: true } }));
    return true;
  }

  /**
   * Move a rack left (-1) or right (+1) in the visual ordering
   */
  function moveRackOrder(rackId, direction) {
    const idx = RS.STATE.racks.findIndex(r => r.id === rackId);
    if (idx === -1) return;
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= RS.STATE.racks.length) return;

    const [moved] = RS.STATE.racks.splice(idx, 1);
    RS.STATE.racks.splice(targetIdx, 0, moved);

    if (RS.renderRackRailsAndSlots) RS.renderRackRailsAndSlots();
    renderRackTabs();
    if (RS.renderMountedDevices) RS.renderMountedDevices();
    if (RS.renderScheduleTable) RS.renderScheduleTable();
    if (RS.renderAllCables) RS.renderAllCables();
    document.dispatchEvent(new CustomEvent('rackstudio:change', { bubbles: true, detail: { immediate: true } }));
  }

  /**
   * Duplicate a rack and all of its mounted devices (without cables)
   */
  function duplicateRack(rackId) {
    const srcRack = RS.STATE.racks.find(r => r.id === rackId);
    if (!srcRack) return null;

    do { RS.STATE.rackCounter++; } while (RS.STATE.racks.some(r => r.id === `rack-${RS.STATE.rackCounter}`));
    const newId = `rack-${RS.STATE.rackCounter}`;
    const newName = `${srcRack.name} (Kopya)`;
    const newRack = {
      id: newId,
      name: newName,
      heightU: srcRack.heightU || 42,
      units: Array((srcRack.heightU || 42) + 1).fill(null),
      devices: []
    };

    RS.STATE.racks.push(newRack);
    RS.STATE.activeRackId = newId;

    // Duplicate devices with fresh instance IDs
    if (srcRack.devices && srcRack.devices.length > 0) {
      srcRack.devices.forEach(dev => {
        if (RS.mountDeviceAt) {
          RS.mountDeviceAt(dev.catalogKey, dev.topU, newId);
        }
      });
    }

    if (RS.STATE.viewMode !== 'multi') {
      if (RS.setViewMode) RS.setViewMode('multi');
      else RS.STATE.viewMode = 'multi';
    } else {
      if (RS.renderRackRailsAndSlots) RS.renderRackRailsAndSlots();
      renderRackTabs();
      if (RS.renderMountedDevices) RS.renderMountedDevices();
      if (RS.renderScheduleTable) RS.renderScheduleTable();
      if (RS.renderAllCables) RS.renderAllCables();
    }

    document.dispatchEvent(new CustomEvent('rackstudio:change', { bubbles: true, detail: { immediate: true } }));
    requestAnimationFrame(() => {
      if (RS.fitRackToScreen) RS.fitRackToScreen(false);
      requestAnimationFrame(() => {
        if (RS.invalidatePixiCableGeometry) RS.invalidatePixiCableGeometry();
        if (RS.renderAllCables) RS.renderAllCables();
      });
    });
    return newRack;
  }

  RS.renderRackTabs = renderRackTabs;
  RS.switchActiveRack = switchActiveRack;
  RS.addNewRack = addNewRack;
  RS.renameActiveRack = renameActiveRack;
  RS.deleteRack = deleteRack;
  RS.resizeRackHeight = resizeRackHeight;
  RS.moveRackOrder = moveRackOrder;
  RS.duplicateRack = duplicateRack;
  RS.toggleRackDropdown = toggleRackDropdown;
  RS.closeRackDropdown = closeRackDropdown;
  RS.getRackClusters = getRackClusters;
})();
