/**
 * Cable actions that are not a viewport painter.
 * Live cables are drawn by the Pixi cabling path. This module keeps ids,
 * disconnect, hover rows, tooltips, and schedule selection in sync.
 */
(function () {
  'use strict';

  const RS = window.RackStudio = window.RackStudio || {};
  const STATE = RS.STATE;
  const dom = RS.dom;

  const getActiveRack = () => (RS.getActiveRack ? RS.getActiveRack() : RS.STATE?.racks?.[0]);
  const escapeHtml = (val) => RS.escapeHtml ? RS.escapeHtml(val) : String(val ?? '');
  const showTemporaryTooltip = (...args) => RS.showTemporaryTooltip && RS.showTemporaryTooltip(...args);
  const renderMountedDevices = () => RS.renderMountedDevices && RS.renderMountedDevices();
  const renderScheduleTable = () => RS.renderScheduleTable && RS.renderScheduleTable();
  const getCableLabel = (...args) => (RS.SvgCablePathway?.getCableLabel ? RS.SvgCablePathway.getCableLabel(...args) : '');
  const hideCableQuickHud = (...args) => (RS.hideCableQuickHud && RS.hideCableQuickHud(...args));
  const hideCableContextMenu = (...args) => (RS.hideCableContextMenu && RS.hideCableContextMenu(...args));

  function cancelPendingConnection() {
    if (STATE.pendingConnection && STATE.pendingConnection.element) {
      STATE.pendingConnection.element.classList.remove('selected');
    }
    STATE.pendingConnection = null;
    if (dom.connectionStatusHint) {
      dom.connectionStatusHint.innerHTML = 'Bağlamak için <b>Kaynak Porta</b> tıklayın';
    }
  }

  function getNextCableId() {
    STATE.cableCounter++;
    return 'CBL-' + String(STATE.cableCounter).padStart(3, '0');
  }

  function renameCable2D(cableId) {
    const cable = STATE.cables.find(item => item.id === cableId);
    if (!cable) return;
    const nextName = prompt('Kablo Adı / Etiketi:', cable.name || cable.id);
    if (nextName === null) return;
    const normalizedName = nextName.trim();
    if (!normalizedName) {
      showTemporaryTooltip(window.innerWidth / 2, 80, 'Kablo adı boş bırakılamaz.');
      return;
    }
    cable.name = normalizedName;
    renderScheduleTable();
    RS.renderAllCables?.();
    window.dispatchEvent(new CustomEvent('rackstudio:refresh'));
  }

  function paintScheduleHover(cableId, hovered) {
    document.querySelectorAll(`#schedule-tbody tr[data-cable-id="${cableId}"]`).forEach(row => {
      row.classList.toggle('hovered-row', hovered);
    });
    document.querySelectorAll(`#schedule-tbody .tree-cable-row[data-cable-id="${cableId}"]`).forEach(row => {
      row.classList.toggle('hovered', hovered);
    });
  }

  function setCableHover(cableId, isHovered, source) {
    if (source !== 'pixi' && RS.setPixiCableHover) RS.setPixiCableHover(cableId, isHovered);
    if (!isHovered) {
      paintScheduleHover(cableId, false);
      return;
    }
    paintScheduleHover(cableId, true);
    if (RS.ensureCableVisibleInSchedule) {
      const tableRow = RS.ensureCableVisibleInSchedule(cableId);
      if (tableRow) {
        tableRow.classList.add(tableRow.tagName === 'TR' ? 'hovered-row' : 'hovered');
        tableRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }

  let activeHoveredDeviceId = null;

  function setDeviceCablesHover(instanceId, isHovered) {
    if (!isHovered) {
      if (!instanceId || activeHoveredDeviceId === instanceId) {
        activeHoveredDeviceId = null;
        RS.setPixiCableGroupHover?.([]);
        document.querySelectorAll('.tree-cable-row.hovered, .schedule-tree-switch-card.active-switch').forEach(el => {
          el.classList.remove('hovered', 'active-switch');
        });
      }
      return;
    }
    activeHoveredDeviceId = instanceId;
    const switchCard = document.querySelector(`.schedule-tree-switch-card[data-instance-id="${instanceId}"]`);
    if (switchCard) switchCard.classList.add('active-switch');
    const deviceCables = (STATE.cables || []).filter(cable =>
      (cable.from && cable.from.instanceId === instanceId) || (cable.to && cable.to.instanceId === instanceId)
    );
    RS.setPixiCableGroupHover?.(deviceCables.map(cable => cable.id));
    deviceCables.forEach(cable => {
      const treeRow = document.querySelector(`.tree-cable-row[data-cable-id="${cable.id}"]`);
      if (treeRow) treeRow.classList.add('hovered');
    });
  }

  function showCableTooltip(e, cableId) {
    if (STATE.pendingConnection || !dom.tooltip) return;
    if (document.getElementById('cable-quick-hud') || document.getElementById('cable-context-menu')) {
      dom.tooltip.style.display = 'none';
      return;
    }
    const cable = (STATE.cables || []).find(item => item.id === cableId);
    if (!cable) return;
    const cableLabel = getCableLabel(getActiveRack(), cable);
    dom.tooltip.style.display = 'block';
    dom.tooltip.style.left = `${e.clientX + 10}px`;
    dom.tooltip.style.top = `${e.clientY - 10}px`;
    dom.tooltip.innerHTML = `
      <b>${escapeHtml(cable.id)}</b> (${Number(cable.lengthMeters || 0).toFixed(1)}m)<br>
      <span style="color:${cable.color};">&#9632;</span> <strong>${escapeHtml(cableLabel)}</strong><br>
      <span style="color:#f59e0b;font-size:11px;">Yeniden adlandırmak için çift tıklayın</span>
    `;
  }

  function disconnectCable(cableId) {
    if (!cableId) return;
    const cable = STATE.cables.find(item => item.id === cableId);
    if (!cable) return;
    STATE.cables = STATE.cables.filter(item => item.id !== cableId);
    if (STATE.highlightedCableId === cableId) STATE.highlightedCableId = null;
    hideCableQuickHud();
    hideCableContextMenu();
    RS.setPixiCableHover?.(null, false);
    RS.invalidatePixiCableGeometry?.([cableId]);
    renderMountedDevices();
    renderScheduleTable();
    RS.renderAllCables?.();
    if (dom.connectionStatusHint) {
      dom.connectionStatusHint.innerHTML = `<span style="color:#f87171; font-weight:700;">✂️ ${escapeHtml(cable.name || cable.id)} söküldü.</span>`;
      setTimeout(() => {
        if (dom.connectionStatusHint && !STATE.pendingConnection) {
          dom.connectionStatusHint.innerHTML = 'Bağlamak için <b>Kaynak Porta</b> tıklayın';
        }
      }, 2500);
    }
    if (window.__STUDIO3D__ && window.is3DMode && typeof window.__STUDIO3D__.removeCable === 'function') {
      window.__STUDIO3D__.removeCable(cableId);
    }
    window.dispatchEvent(new CustomEvent('rackstudio:refresh'));
  }

  function highlightCable(cableId, force = null) {
    if (force === true) STATE.highlightedCableId = cableId || null;
    else if (force === false) STATE.highlightedCableId = null;
    else STATE.highlightedCableId = (cableId && STATE.highlightedCableId !== cableId) ? cableId : null;
    if (!STATE.highlightedCableId) {
      hideCableQuickHud();
      hideCableContextMenu();
    }
    document.querySelectorAll('#schedule-tbody tr').forEach(row => {
      row.classList.toggle('active', row.dataset.cableId === STATE.highlightedCableId);
    });
    RS.syncPixiCableSelection?.();
  }

  function addDirectCable(rackA, instA, portA, rackB, instB, portB, color, lengthMeters) {
    const cableId = getNextCableId();
    STATE.cables.push({
      id: cableId,
      name: cableId,
      from: { rackId: rackA, instanceId: instA, portId: portA },
      to: { rackId: rackB, instanceId: instB, portId: portB },
      color: color || '#2563eb',
      lengthMeters: lengthMeters || 1.5
    });
  }

  function appendSingleCable(cable) {
    if (!cable) return;
    if (RS.appendSingleCablePixi) return RS.appendSingleCablePixi(cable);
    return RS.renderAllCablesPixi?.() || RS.renderAllCables?.();
  }

  RS.cancelPendingConnection = cancelPendingConnection;
  RS.getNextCableId = getNextCableId;
  RS.getCableEndpointInfo = (...args) => (RS.SvgCablePathway?.getCableEndpointInfo ? RS.SvgCablePathway.getCableEndpointInfo(...args) : {});
  RS.getCableLabel = getCableLabel;
  RS.renameCable2D = renameCable2D;
  RS.setCableHover = setCableHover;
  RS.setDeviceCablesHover = setDeviceCablesHover;
  RS.showCableTooltip = showCableTooltip;
  RS.appendSingleCable = appendSingleCable;
  RS.disconnectCable = disconnectCable;
  RS.highlightCable = highlightCable;
  RS.addDirectCable = addDirectCable;
})();
