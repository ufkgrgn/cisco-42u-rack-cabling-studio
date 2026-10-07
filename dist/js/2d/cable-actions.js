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
    RS.refreshPixiPortHighlights?.();
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
    if (cableId && !(STATE.cables || []).some(c => c.id === cableId)) cableId = null;
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
    renderHighlightedCableInspector();
    if(!window.is3DMode)document.dispatchEvent(new CustomEvent('rackstudio:selection',{detail:{kind:'cable',id:STATE.highlightedCableId,source:'2d'}}));
    RS.syncPixiCableSelection?.();
    if (window.is3DMode && window.__STUDIO3D__?.selectCable) {
      window.__STUDIO3D__.selectCable(STATE.highlightedCableId);
    }
  }

  function renderHighlightedCableInspector() {
    if (!dom.inspectorInfo) return;
    const cable = (STATE.cables || []).find(c => c.id === STATE.highlightedCableId);
    if (!cable) {
      dom.inspectorInfo.textContent = 'Bir porta veya kabloya geldiğinizde uçlar, rol ve metraj burada görünür.';
      return;
    }
    const rack = getActiveRack();
    const info = RS.SvgCablePathway?.getCableEndpointInfo;
    const from = info ? info(rack, cable.from) : { deviceName: 'Kaynak', portName: cable.from?.portId || '' };
    const to = info ? info(rack, cable.to) : { deviceName: 'Hedef', portName: cable.to?.portId || '' };
    const meters = cable.lengthMeters != null ? `${cable.lengthMeters} m` : '—';
    const color = cable.color || '#2563eb';
    const describe = endpoint => {
      const endpointRack = STATE.racks.find(r => r.id === endpoint?.rackId || r.devices.some(d => d.instanceId === endpoint?.instanceId));
      const device = endpointRack?.devices.find(d => d.instanceId === endpoint?.instanceId);
      return { rack: endpointRack?.name || 'Kabin', unit: `U${device?.topU ?? '?'}` };
    };
    const fromLocation = describe(cable.from);
    const toLocation = describe(cable.to);
    const roleText = cable.role || 'standart';
    const mediumText = cable.medium || 'Belirtilmedi';
    const estText = cable.estimatedLengthMeters != null ? `${cable.estimatedLengthMeters} m` : 'Belirtilmedi';
    const measText = cable.measuredLengthMeters != null ? `${cable.measuredLengthMeters} m` : 'Belirtilmedi';
    const noteText = cable.note || 'Belirtilmedi';
    const titleText = cable.name && cable.name !== cable.id ? `${cable.id} · ${cable.name}` : (cable.id || 'Kablo');

    dom.inspectorInfo.innerHTML = `
      <div class="inspector-summary">
        <span class="inspector-kicker">Seçili kablo</span>
        <span class="inspector-cable-id" title="${escapeHtml(titleText)}">${escapeHtml(titleText)}</span>
        <span class="inspector-meter">${escapeHtml(meters)}</span>
      </div>
      <div class="inspector-route" aria-label="Kablo uçları">
        <div class="inspector-end"><span class="inspector-end-marker" style="--cable-color:${escapeHtml(color)}"></span><div class="inspector-end-copy"><span class="inspector-end-label">Kaynak · ${escapeHtml(fromLocation.unit)}</span><strong title="${escapeHtml(from.deviceName)}">${escapeHtml(from.deviceName)}</strong><small>${escapeHtml(fromLocation.rack)} · ${escapeHtml(from.portName)}</small></div></div>
        <div class="inspector-route-line" aria-hidden="true"></div>
        <div class="inspector-end"><span class="inspector-end-marker" style="--cable-color:${escapeHtml(color)}"></span><div class="inspector-end-copy"><span class="inspector-end-label">Hedef · ${escapeHtml(toLocation.unit)}</span><strong title="${escapeHtml(to.deviceName)}">${escapeHtml(to.deviceName)}</strong><small>${escapeHtml(toLocation.rack)} · ${escapeHtml(to.portName)}</small></div></div>
      </div>
      <div class="inspector-specs-grid" aria-label="Kablo teknik detayları">
        <div class="inspector-spec-item"><span class="spec-k">Rol</span><span class="spec-v">${escapeHtml(roleText)}</span></div>
        <div class="inspector-spec-item"><span class="spec-k">Tür</span><span class="spec-v">${escapeHtml(mediumText)}</span></div>
        <div class="inspector-spec-item"><span class="spec-k">Planlanan</span><span class="spec-v">${escapeHtml(estText)}</span></div>
        <div class="inspector-spec-item"><span class="spec-k">Ölçülen</span><span class="spec-v">${escapeHtml(measText)}</span></div>
        ${noteText !== 'Belirtilmedi' ? `<div class="inspector-spec-item spec-full"><span class="spec-k">Not</span><span class="spec-v">${escapeHtml(noteText)}</span></div>` : ''}
      </div>
      <div class="inspector-actions" role="group" aria-label="Kablo görünümü">
        <button type="button" data-cable-focus="from" title="Kaynak cihazı ekranın ortasına getir"><span aria-hidden="true">↖</span> Kaynak</button>
        <button type="button" data-cable-focus="to" title="Hedef cihazı ekranın ortasına getir"><span aria-hidden="true">↘</span> Hedef</button>
        <button type="button" data-cable-focus="both" title="Kablonun iki ucunu aynı kadraja sığdır"><span aria-hidden="true">⤢</span> İki uç</button>
        <button type="button" data-cable-focus="trace" title="Kabloyu ve tanımlı panel iç geçişlerini göster"><span aria-hidden="true">⌁</span> Devre izi</button>
      </div>
      <div class="inspector-field-actions" role="group" aria-label="Saha işlemleri">
        <button type="button" class="btn-inspector-sub" data-cable-action="qr" title="Saha QR Kodu"><span aria-hidden="true">▦</span> Saha QR</button>
        <button type="button" class="btn-inspector-sub" data-cable-action="workflow" title="Saha Uygulama ve Test Kaydı"><span aria-hidden="true">✓</span> Saha Kaydı</button>
        <button type="button" class="btn-inspector-sub" data-cable-action="obs" title="Saha Gözlem Geçmişi"><span aria-hidden="true">⏱</span> Gözlem</button>
      </div>
    `;
  }

  // The module loads before app.init() populates RS.dom; bind to the existing
  // panel element directly so the delegated buttons remain actionable.
  document.getElementById('inspector-info')?.addEventListener('click', event => {
    const focusBtn = event.target.closest('[data-cable-focus]');
    const actionBtn = event.target.closest('[data-cable-action]');
    const cable = STATE.cables.find(c => c.id === STATE.highlightedCableId);
    if (!cable) return;
    if (focusBtn) {
      const action = focusBtn.dataset.cableFocus;
      event.stopPropagation();
      if (action === 'trace') RS.CircuitTrace?.open(cable.id);
      else if (action === 'both') {
        const differentRacks = cable.from?.rackId && cable.to?.rackId && cable.from.rackId !== cable.to.rackId;
        if (differentRacks && STATE.viewMode !== 'multi') {
          RS.setViewMode?.('multi', true);
          requestAnimationFrame(() => RS.focusOnCable?.(cable.id));
        } else RS.focusOnCable?.(cable.id);
      } else RS.focusOnDevice?.(cable[action]?.instanceId);
    } else if (actionBtn) {
      const action = actionBtn.dataset.cableAction;
      event.stopPropagation();
      if (action === 'qr') RS.FieldQRUI?.open({ kind: 'cable', id: cable.id });
      else if (action === 'workflow') RS.FieldWorkflowUI?.open({ kind: 'cable', id: cable.id });
      else if (action === 'obs') RS.FieldObservationUI?.open({ kind: 'cable', id: cable.id });
    }
  });

  function addDirectCable(rackA, instA, portA, rackB, instB, portB, color, lengthMeters) {
    const cableId = getNextCableId();
    STATE.cables.push({
      id: cableId,
      name: cableId,
      from: { rackId: rackA, instanceId: instA, portId: portA },
      to: { rackId: rackB, instanceId: instB, portId: portB },
      color: color || '#2563eb',
      medium: '',
      role: '',
      lengthMeters: lengthMeters || 1.5
    });
  }

  function bringCableToFront(cableId) {
    if (!cableId || !STATE.cables) return;
    const index = STATE.cables.findIndex(c => c.id === cableId);
    if (index < 0 || index === STATE.cables.length - 1) return;
    const [cable] = STATE.cables.splice(index, 1);
    STATE.cables.push(cable);
    RS.takeHistorySnapshot?.();
    renderScheduleTable();
    RS.renderAllCables?.();
    document.dispatchEvent(new CustomEvent('rackstudio:change', { bubbles: true }));
    window.dispatchEvent(new CustomEvent('rackstudio:refresh'));
  }

  function sendCableToBack(cableId) {
    if (!cableId || !STATE.cables) return;
    const index = STATE.cables.findIndex(c => c.id === cableId);
    if (index <= 0) return;
    const [cable] = STATE.cables.splice(index, 1);
    STATE.cables.unshift(cable);
    RS.takeHistorySnapshot?.();
    renderScheduleTable();
    RS.renderAllCables?.();
    document.dispatchEvent(new CustomEvent('rackstudio:change', { bubbles: true }));
    window.dispatchEvent(new CustomEvent('rackstudio:refresh'));
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
  RS.bringCableToFront = bringCableToFront;
  RS.sendCableToBack = sendCableToBack;
})();
