/**
 * Cisco Enterprise Rack & Cabling Studio - Cables SVG Renderer Module
 * Handles drawing SVG patch cables, curved Béziers, structured conduit pathways,
 * connector boots/pins, cable tooltips, highlights, and DOM node pooling.
 */
(function () {
  'use strict';

  const RS = window.RackStudio = window.RackStudio || {};

  const STATE = RS.STATE;
  const dom = RS.dom;
  const HARDWARE_CATALOG = RS.HARDWARE_CATALOG;

  const getActiveRack = () => (RS.getActiveRack ? RS.getActiveRack() : RS.STATE?.racks?.[0]);
  const escapeHtml = (val) => RS.escapeHtml ? RS.escapeHtml(val) : String(val ?? '');
  const showTemporaryTooltip = (...args) => RS.showTemporaryTooltip && RS.showTemporaryTooltip(...args);
  const renderMountedDevices = () => RS.renderMountedDevices && RS.renderMountedDevices();
  const renderScheduleTable = () => RS.renderScheduleTable && RS.renderScheduleTable();

  const computeCableLength = (...args) => (RS.computeCableLength ? RS.computeCableLength(...args) : 1.5);
  const findDeviceOrganizer = (...args) => (RS.findDeviceOrganizer ? RS.findDeviceOrganizer(...args) : null);
  const resolveCableDuctSide = (...args) => (RS.resolveCableDuctSide ? RS.resolveCableDuctSide(...args) : false);
  const renderDRingOverlays = (...args) => (RS.renderDRingOverlays && RS.renderDRingOverlays(...args));
  const hideCableQuickHud = (...args) => (RS.hideCableQuickHud && RS.hideCableQuickHud(...args));
  const hideCableContextMenu = (...args) => (RS.hideCableContextMenu && RS.hideCableContextMenu(...args));
  const showCableQuickHud = (...args) => (RS.showCableQuickHud && RS.showCableQuickHud(...args));
  const showCableContextMenu = (...args) => (RS.showCableContextMenu && RS.showCableContextMenu(...args));

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

  const shortenDeviceName = (...args) => (RS.SvgCablePathway?.shortenDeviceName ? RS.SvgCablePathway.shortenDeviceName(...args) : '');
  const getCableEndpointInfo = (...args) => (RS.SvgCablePathway?.getCableEndpointInfo ? RS.SvgCablePathway.getCableEndpointInfo(...args) : {});
  const getCableLabel = (...args) => (RS.SvgCablePathway?.getCableLabel ? RS.SvgCablePathway.getCableLabel(...args) : '');


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

  let hoveredPlaceholder = null;
  let activeHoveredCableId = null;

  function restoreHoveredCable() {
    if (!hoveredPlaceholder) return;
    const { placeholder, casing, path, bootPlaceholder, boots } = hoveredPlaceholder;
    if (placeholder && placeholder.parentNode) {
      if (casing && casing.parentNode) placeholder.parentNode.insertBefore(casing, placeholder);
      if (path && path.parentNode) placeholder.parentNode.insertBefore(path, placeholder);
      placeholder.remove();
    }
    if (bootPlaceholder && bootPlaceholder.parentNode && boots) {
      boots.forEach(b => {
        if (b && b.parentNode) bootPlaceholder.parentNode.insertBefore(b, bootPlaceholder);
      });
      bootPlaceholder.remove();
    }
    hoveredPlaceholder = null;
    activeHoveredCableId = null;
  }

  function setCableHover(cableId, isHovered, source) {
    if (source !== 'pixi' && STATE.cableRenderMode === 'pixi' && RS.setPixiCableHover) {
      RS.setPixiCableHover(cableId, isHovered);
    }

    const svgEl = dom.cablesSvg || document.getElementById('cables-svg');
    const cablesGroup = dom.cablesGroup || document.getElementById('cables-group');
    const connectorsGroup = dom.connectorsGroup || document.getElementById('connectors-group');

    if (!isHovered) {
      const p = document.getElementById(`svg-cable-${cableId}`);
      const c = document.getElementById(`svg-cable-casing-${cableId}`);
      if (p) p.classList.remove('hovered');
      if (c) c.classList.remove('hovered');
      document.querySelectorAll(`.cable-boot[data-cable-id="${cableId}"], .cable-boot-pin[data-cable-id="${cableId}"]`).forEach(b => {
        b.classList.remove('hovered');
      });
      document.querySelectorAll(`#schedule-tbody tr[data-cable-id="${cableId}"]`).forEach(row => {
        row.classList.remove('hovered-row');
      });
      document.querySelectorAll(`#schedule-tbody .tree-cable-row[data-cable-id="${cableId}"]`).forEach(row => {
        row.classList.remove('hovered');
      });
      document.querySelectorAll('.port.port-cable-hover').forEach(el => {
        el.classList.remove('port-cable-hover');
      });
      if (activeHoveredCableId === cableId) {
        restoreHoveredCable();
        activeHoveredCableId = null;
      }
      if (svgEl && !activeHoveredCableId) {
        svgEl.classList.remove('has-cable-hovered');
      }
      return;
    }

    if (activeHoveredCableId === cableId) return;

    // Restore any previously hovered cable before promoting the new one
    if (activeHoveredCableId) {
      const prevP = document.getElementById(`svg-cable-${activeHoveredCableId}`);
      const prevC = document.getElementById(`svg-cable-casing-${activeHoveredCableId}`);
      if (prevP) prevP.classList.remove('hovered');
      if (prevC) prevC.classList.remove('hovered');
      document.querySelectorAll(`.cable-boot[data-cable-id="${activeHoveredCableId}"], .cable-boot-pin[data-cable-id="${activeHoveredCableId}"]`).forEach(b => {
        b.classList.remove('hovered');
      });
      document.querySelectorAll(`#schedule-tbody tr[data-cable-id="${activeHoveredCableId}"]`).forEach(row => {
        row.classList.remove('hovered-row');
      });
      document.querySelectorAll(`#schedule-tbody .tree-cable-row[data-cable-id="${activeHoveredCableId}"]`).forEach(row => {
        row.classList.remove('hovered');
      });
      document.querySelectorAll('.port.port-cable-hover').forEach(el => {
        el.classList.remove('port-cable-hover');
      });
      restoreHoveredCable();
    }

    activeHoveredCableId = cableId;

    if (svgEl) {
      svgEl.classList.add('has-cable-hovered');
    }

    const p = document.getElementById(`svg-cable-${cableId}`);
    const c = document.getElementById(`svg-cable-casing-${cableId}`);
    if (p) p.classList.add('hovered');
    if (c) c.classList.add('hovered');

    const boots = Array.from(document.querySelectorAll(`.cable-boot[data-cable-id="${cableId}"], .cable-boot-pin[data-cable-id="${cableId}"]`));
    boots.forEach(b => b.classList.add('hovered'));

    const cableObj = (STATE.cables || []).find(item => item.id === cableId);
    if (cableObj) {
      if (cableObj.from?.instanceId && cableObj.from?.portId) {
        const el = document.getElementById(`port-${cableObj.from.instanceId}-${cableObj.from.portId}`);
        if (el) el.classList.add('port-cable-hover');
      }
      if (cableObj.to?.instanceId && cableObj.to?.portId) {
        const el = document.getElementById(`port-${cableObj.to.instanceId}-${cableObj.to.portId}`);
        if (el) el.classList.add('port-cable-hover');
      }
    }

    document.querySelectorAll(`#schedule-tbody tr[data-cable-id="${cableId}"]`).forEach(row => {
      row.classList.add('hovered-row');
    });
    document.querySelectorAll(`#schedule-tbody .tree-cable-row[data-cable-id="${cableId}"]`).forEach(row => {
      row.classList.add('hovered');
    });
    if (RS.ensureCableVisibleInSchedule) {
      const tableRow = RS.ensureCableVisibleInSchedule(cableId);
      if (tableRow) {
        if (tableRow.tagName === 'TR') {
          tableRow.classList.add('hovered-row');
        } else {
          tableRow.classList.add('hovered');
        }
        tableRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }

    // Temporarily bring the hovered cable & casing to the very top of cablesGroup (SVG z-order)
    if (cablesGroup && c && p && c.parentNode === cablesGroup) {
      const placeholder = document.createComment(`hover-placeholder-${cableId}`);
      cablesGroup.insertBefore(placeholder, c);

      let bootPlaceholder = null;
      if (connectorsGroup && boots.length > 0) {
        bootPlaceholder = document.createComment(`hover-boot-placeholder-${cableId}`);
        connectorsGroup.insertBefore(bootPlaceholder, boots[0]);
        boots.forEach(b => connectorsGroup.appendChild(b));
      }

      cablesGroup.appendChild(c);
      cablesGroup.appendChild(p);

      hoveredPlaceholder = { placeholder, casing: c, path: p, bootPlaceholder, boots, cableId };
    }
  }

  let activeHoveredDeviceId = null;

  function setDeviceCablesHover(instanceId, isHovered) {
    const svgEl = dom.cablesSvg || document.getElementById('cables-svg');
    if (!isHovered) {
      if (!instanceId || activeHoveredDeviceId === instanceId) {
        activeHoveredDeviceId = null;
        if (svgEl) svgEl.classList.remove('has-cable-hovered');
        if (STATE.cableRenderMode === 'pixi' && RS.setPixiCableGroupHover) {
          RS.setPixiCableGroupHover([]);
        }
        document.querySelectorAll('.port.port-cable-hover').forEach(el => {
          el.classList.remove('port-cable-hover');
        });
        document.querySelectorAll('.cable-path.hovered, .cable-casing.hovered, .cable-boot.hovered, .cable-boot-pin.hovered').forEach(el => {
          el.classList.remove('hovered');
        });
        document.querySelectorAll('.tree-cable-row.hovered, .schedule-tree-switch-card.active-switch').forEach(el => {
          el.classList.remove('hovered', 'active-switch');
        });
      }
      return;
    }

    activeHoveredDeviceId = instanceId;
    if (svgEl) svgEl.classList.add('has-cable-hovered');

    const switchCard = document.querySelector(`.schedule-tree-switch-card[data-instance-id="${instanceId}"]`);
    if (switchCard) switchCard.classList.add('active-switch');

    const deviceCables = (STATE.cables || []).filter(c =>
      (c.from && c.from.instanceId === instanceId) || (c.to && c.to.instanceId === instanceId)
    );

    if (STATE.cableRenderMode === 'pixi' && RS.setPixiCableGroupHover) {
      RS.setPixiCableGroupHover(deviceCables.map(c => c.id));
    }

    deviceCables.forEach(c => {
      const p = document.getElementById(`svg-cable-${c.id}`);
      const casing = document.getElementById(`svg-cable-casing-${c.id}`);
      if (p) p.classList.add('hovered');
      if (casing) casing.classList.add('hovered');
      document.querySelectorAll(`.cable-boot[data-cable-id="${c.id}"], .cable-boot-pin[data-cable-id="${c.id}"]`).forEach(b => {
        b.classList.add('hovered');
      });
      const treeRow = document.querySelector(`.tree-cable-row[data-cable-id="${c.id}"]`);
      if (treeRow) treeRow.classList.add('hovered');

      // Highlight the connected ports on both ends
      if (c.from?.instanceId && c.from?.portId) {
        const el = document.getElementById(`port-${c.from.instanceId}-${c.from.portId}`);
        if (el) el.classList.add('port-cable-hover');
      }
      if (c.to?.instanceId && c.to?.portId) {
        const el = document.getElementById(`port-${c.to.instanceId}-${c.to.portId}`);
        if (el) el.classList.add('port-cable-hover');
      }
    });
  }

  function ensureCableDelegation(svgEl) {
    if (!svgEl || svgEl.__DELEGATION_BOUND__) return;
    svgEl.__DELEGATION_BOUND__ = true;

    svgEl.addEventListener('click', (e) => {
      const boot = e.target.closest('.cable-boot');
      if (boot && boot.dataset.cableId) {
        e.stopPropagation();
        highlightCable(boot.dataset.cableId);
        showCableQuickHud(boot.dataset.cableId, e.clientX, e.clientY);
        return;
      }
      const path = e.target.closest('.cable-path');
      if (path && path.dataset.cableId) {
        e.stopPropagation();
        highlightCable(path.dataset.cableId);
        showCableQuickHud(path.dataset.cableId, e.clientX, e.clientY);
        return;
      }
    });

    svgEl.addEventListener('contextmenu', (e) => {
      const el = e.target.closest('[data-cable-id]');
      if (el && el.dataset.cableId) {
        e.preventDefault();
        e.stopPropagation();
        highlightCable(el.dataset.cableId);
        showCableContextMenu(el.dataset.cableId, e.clientX, e.clientY);
      }
    });

    svgEl.addEventListener('dblclick', (e) => {
      const path = e.target.closest('.cable-path');
      if (path && path.dataset.cableId) {
        e.preventDefault();
        e.stopPropagation();
        renameCable2D(path.dataset.cableId);
      }
    });

    svgEl.addEventListener('mouseover', (e) => {
      if (STATE.pendingConnection) return;
      if (document.getElementById('cable-quick-hud') || document.getElementById('cable-context-menu')) return;
      const el = e.target.closest('[data-cable-id]');
      if (el && el.dataset.cableId) {
        setCableHover(el.dataset.cableId, true);
        showCableTooltip(e, el.dataset.cableId);
      }
    });

    svgEl.addEventListener('mouseout', (e) => {
      const el = e.target.closest('[data-cable-id]');
      if (el && el.dataset.cableId) {
        const rel = e.relatedTarget ? e.relatedTarget.closest('[data-cable-id]') : null;
        if (!rel || rel.dataset.cableId !== el.dataset.cableId) {
          setCableHover(el.dataset.cableId, false);
          if (dom.tooltip) dom.tooltip.style.display = 'none';
        }
      }
    });

    svgEl.addEventListener('mousemove', (e) => {
      if (STATE.pendingConnection) return;
      if (document.getElementById('cable-quick-hud') || document.getElementById('cable-context-menu')) {
        if (dom.tooltip) dom.tooltip.style.display = 'none';
        return;
      }
      if (dom.tooltip && dom.tooltip.style.display !== 'none') {
        dom.tooltip.style.left = `${e.clientX + 10}px`;
        dom.tooltip.style.top = `${e.clientY - 10}px`;
      }
    });
  }

  function showCableTooltip(e, cableId) {
    if (STATE.pendingConnection || !dom.tooltip) return;
    if (document.getElementById('cable-quick-hud') || document.getElementById('cable-context-menu')) {
      dom.tooltip.style.display = 'none';
      return;
    }
    const cable = (STATE.cables || []).find(c => c.id === cableId);
    if (!cable) return;
    const activeRack = getActiveRack();
    const cableLabel = getCableLabel(activeRack, cable);
    dom.tooltip.style.display = 'block';
    dom.tooltip.style.left = `${e.clientX + 10}px`;
    dom.tooltip.style.top = `${e.clientY - 10}px`;
    dom.tooltip.innerHTML = `
      <b>${escapeHtml(cable.id)}</b> (${Number(cable.lengthMeters || 0).toFixed(1)}m)<br>
      <span style="color:${cable.color};">&#9632;</span> <strong>${escapeHtml(cableLabel)}</strong><br>
      <span style="color:#f59e0b;font-size:11px;">Yeniden adlandırmak için çift tıklayın</span>
    `;
  }

  function getOrCreateSvgElement(tagName, id) {
    const existing = document.getElementById(id);
    if (existing && existing.namespaceURI === 'http://www.w3.org/2000/svg') return existing;
    const element = document.createElementNS('http://www.w3.org/2000/svg', tagName);
    element.id = id;
    return element;
  }

  function renderAllCables() {
    restoreHoveredCable();

    // Re-acquire DOM refs in case DOM was rebuilt
    const cablesGroup = dom.cablesGroup || document.getElementById('cables-group');
    const connectorsGroup = dom.connectorsGroup || document.getElementById('connectors-group');
    if (!cablesGroup) return;

    const svgEl = dom.cablesSvg || document.getElementById('cables-svg');
    const svgRect = svgEl ? svgEl.getBoundingClientRect() : null;
    if (!svgRect || svgRect.width <= 0) return;

    if (svgEl) {
      ensureCableDelegation(svgEl);
      svgEl.classList.toggle('has-cable-selected', !!STATE.highlightedCableId);
      if (!svgEl.__HOVER_LEAVE_BOUND__) {
        svgEl.__HOVER_LEAVE_BOUND__ = true;
        svgEl.addEventListener('mouseleave', () => {
          if (activeHoveredCableId) {
            setCableHover(activeHoveredCableId, false);
          }
        });
      }
    }

    const isMulti = STATE.viewMode === 'multi' && STATE.racks && STATE.racks.length > 1;
    const activeRack = getActiveRack();

    // In multi mode, SVG covers all racks side-by-side (total width).
    // In single mode, SVG covers just the active rack (618px).
    let svgW = 618;
    let svgH = (activeRack?.heightU || 42) * 32;
    if (isMulti) {
      const numRacks = STATE.racks.length;
      const maxU = Math.max(...STATE.racks.map(r => r.heightU || 42));
      svgW = numRacks * 634 + (numRacks - 1) * 64 + 120;
      svgH = maxU * 32 + 156;
    }

    if (svgEl) {
      svgEl.setAttribute('viewBox', `0 0 ${svgW} ${svgH}`);
      svgEl.setAttribute('preserveAspectRatio', 'none');
    }

    const scaleX = svgRect.width / svgW;
    const scaleY = svgRect.height / svgH;

    const ctmInv = (svgEl && svgEl.getScreenCTM) ? svgEl.getScreenCTM()?.inverse() : null;
    const svgPoint = (svgEl && svgEl.createSVGPoint) ? svgEl.createSVGPoint() : null;

    function clientToSvg(clientX, clientY) {
      if (ctmInv && svgPoint) {
        svgPoint.x = clientX;
        svgPoint.y = clientY;
        const pt = svgPoint.matrixTransform(ctmInv);
        return { x: pt.x, y: pt.y };
      }
      return {
        x: (clientX - svgRect.left) / scaleX,
        y: (clientY - svgRect.top) / scaleY
      };
    }

    const portRects = new Map();
    function getPortRect(el) {
      if (!el) return null;
      const key = el.id || el;
      let r = portRects.get(key);
      if (!r) {
        r = el.getBoundingClientRect();
        portRects.set(key, r);
      }
      return r;
    }

    const rackRailCache = new Map();
    function getRackRailBounds(rackId) {
      if (!rackId) return { left: 23, right: 595, top: 0 };
      if (rackRailCache.has(rackId)) return rackRailCache.get(rackId);
      let left = 23;
      let right = 595;
      let top = 0;
      const rackCont = document.querySelector(`.rack-container[data-rack-id="${rackId}"]`) ||
                       document.getElementById(`rack-container-${rackId}`) ||
                       document.getElementById('rack-container');
      if (rackCont) {
        const rc = rackCont.getBoundingClientRect();
        top = clientToSvg(0, rc.top).y;
        const railL = rackCont.querySelector('.rack-rail.left');
        const railR = rackCont.querySelector('.rack-rail.right');
        if (railL && railR) {
          const lRect = railL.getBoundingClientRect();
          const rRect = railR.getBoundingClientRect();
          left = clientToSvg(lRect.left + lRect.width / 2, 0).x;
          right = clientToSvg(rRect.left + rRect.width / 2, 0).x;
        } else {
          left = clientToSvg(rc.left + 30, 0).x;
          right = clientToSvg(rc.right - 30, 0).x;
        }
      }
      const bounds = { left, right, top };
      rackRailCache.set(rackId, bounds);
      return bounds;
    }

    const orgYCache = new Map();
    function getCachedOrgY(org, fallbackY, otherY) {
      if (!org || !org.instanceId) return fallbackY + (otherY >= fallbackY ? 14 : -14);
      if (orgYCache.has(org.instanceId)) return orgYCache.get(org.instanceId);
      const orgEl = document.getElementById(org.instanceId);
      if (orgEl) {
        const r = orgEl.getBoundingClientRect();
        const y = clientToSvg(0, r.top + r.height / 2).y;
        orgYCache.set(org.instanceId, y);
        return y;
      }
      return fallbackY + (otherY >= fallbackY ? 14 : -14);
    }

    let leftChannelUsage = 0;
    let rightChannelUsage = 0;

    const MM_PER_U       = 44.45;                         // mm  (EIA-310)
    const SVG_PX_PER_U   = 32;                            // px  (design constant)
    const MM_PER_SVG_Y   = MM_PER_U / SVG_PX_PER_U;      // ≈ 1.389 mm / svg-px
    const SLACK_FACTOR   = 1.05;                          // 5% slack for dress & bend radius

    const cablesFrag = document.createDocumentFragment();
    const connectorsFrag = document.createDocumentFragment();

    const pathwayCtx = {
      activeRack,
      isMulti,
      clientToSvg,
      getPortRect,
      getRackRailBounds,
      getCachedOrgY,
      leftChannelUsage,
      rightChannelUsage
    };

    STATE.cables.forEach((cable) => {
      if (!isMulti && cable.from?.rackId && cable.to?.rackId) {
        if (cable.from.rackId !== activeRack?.id && cable.to.rackId !== activeRack?.id) {
          return;
        }
      }

      const pathway = RS.SvgCablePathway?.generateSvgCablePathway(cable, pathwayCtx);
      if (!pathway) return;

      const { pathD, isStub, isFromMounted, stubBadgeText, stubPoint, isRightExit, x1, y1, x2, y2 } = pathway;

      // Casing / Outline path (for clear separation between overlapping & adjacent cables)
      const isFiberCable = cable.role === 'fiber' || cable.color === '#facc15' || cable.name?.includes('[FIBER]');
      const casing = getOrCreateSvgElement('path', `svg-cable-casing-${cable.id}`);
      casing.setAttribute('d', pathD);
      casing.setAttribute('class', `cable-casing ${cable.id === STATE.highlightedCableId ? 'highlighted' : ''} ${isFiberCable ? 'cable-casing-fiber' : ''}`.trim());
      casing.setAttribute('data-cable-id', cable.id);
      casing.style.setProperty('--cable-color', cable.color);
      cablesFrag.appendChild(casing);

      const path = getOrCreateSvgElement('path', `svg-cable-${cable.id}`);
      path.setAttribute('d', pathD);
      path.setAttribute('stroke', cable.color);
      path.setAttribute('stroke-width', isFiberCable ? '2.8' : '2.6');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      path.style.color = cable.color;
      path.style.setProperty('--cable-color', cable.color);
      path.setAttribute('class', `cable-path ${cable.id === STATE.highlightedCableId ? 'highlighted' : ''} ${isFiberCable ? 'cable-fiber' : ''}`.trim());
      path.setAttribute('data-cable-id', cable.id);
      path.removeAttribute('filter');

      const cableLabel = getCableLabel(activeRack, cable);
      path.setAttribute('aria-label', cableLabel);

      cablesFrag.appendChild(path);

      if (connectorsGroup) {
        if (isStub) {
          const localX = isFromMounted ? x1 : x2;
          const localY = isFromMounted ? y1 : y2;
          const destX = isFromMounted ? x2 : x1;
          const destY = isFromMounted ? y2 : y1;

          const boot = getOrCreateSvgElement('circle', `svg-cable-boot-a-${cable.id}`);
          boot.setAttribute('cx', localX);
          boot.setAttribute('cy', localY);
          boot.setAttribute('r', '3.4');
          boot.setAttribute('fill', '#090d16');
          boot.setAttribute('stroke', cable.color);
          boot.setAttribute('stroke-width', '1.6');
          boot.style.color = cable.color;
          boot.style.setProperty('--cable-color', cable.color);
          boot.setAttribute('class', 'cable-boot');
          boot.setAttribute('data-cable-id', cable.id);

          const pin = getOrCreateSvgElement('circle', `svg-cable-pin-a-${cable.id}`);
          pin.setAttribute('cx', localX);
          pin.setAttribute('cy', localY);
          pin.setAttribute('r', '1.2');
          pin.setAttribute('fill', cable.color);
          pin.setAttribute('class', 'cable-boot-pin');
          pin.setAttribute('data-cable-id', cable.id);

          const badge = getOrCreateSvgElement('g', `svg-cable-badge-${cable.id}`);
          badge.setAttribute('class', 'cable-stub-badge');
          badge.setAttribute('data-cable-id', cable.id);
          const badgeW = Math.max(76, stubBadgeText.length * 6.5 + 16);
          const badgeH = 18;
          const bx = isRightExit ? destX + 4 : destX - badgeW - 4;
          const by = destY - badgeH / 2;
          badge.innerHTML = `<rect x="${bx}" y="${by}" width="${badgeW}" height="${badgeH}" rx="4" fill="#0f172a" stroke="${cable.color}" stroke-width="1.2" /><text x="${bx + badgeW / 2}" y="${by + 12}" fill="#e2e8f0" font-size="9" font-weight="600" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif">${escapeHtml(stubBadgeText)}</text>`;

          connectorsFrag.appendChild(boot);
          connectorsFrag.appendChild(pin);
          connectorsFrag.appendChild(badge);
        } else {
        const bootA = getOrCreateSvgElement('circle', `svg-cable-boot-a-${cable.id}`);
        bootA.setAttribute('cx', x1);
        bootA.setAttribute('cy', y1);
        bootA.setAttribute('r', '3.4');
        bootA.setAttribute('fill', '#090d16');
        bootA.setAttribute('stroke', cable.color);
        bootA.setAttribute('stroke-width', '1.6');
        bootA.style.color = cable.color;
        bootA.style.setProperty('--cable-color', cable.color);
        bootA.setAttribute('class', 'cable-boot');
        bootA.setAttribute('data-cable-id', cable.id);

        const pinA = getOrCreateSvgElement('circle', `svg-cable-pin-a-${cable.id}`);
        pinA.setAttribute('cx', x1);
        pinA.setAttribute('cy', y1);
        pinA.setAttribute('r', '1.2');
        pinA.setAttribute('fill', cable.color);
        pinA.setAttribute('class', 'cable-boot-pin');
        pinA.setAttribute('data-cable-id', cable.id);

        const bootB = getOrCreateSvgElement('circle', `svg-cable-boot-b-${cable.id}`);
        bootB.setAttribute('cx', x2);
        bootB.setAttribute('cy', y2);
        bootB.setAttribute('r', '3.4');
        bootB.setAttribute('fill', '#090d16');
        bootB.setAttribute('stroke', cable.color);
        bootB.setAttribute('stroke-width', '1.6');
        bootB.style.color = cable.color;
        bootB.style.setProperty('--cable-color', cable.color);
        bootB.setAttribute('class', 'cable-boot');
        bootB.setAttribute('data-cable-id', cable.id);

        const pinB = getOrCreateSvgElement('circle', `svg-cable-pin-b-${cable.id}`);
        pinB.setAttribute('cx', x2);
        pinB.setAttribute('cy', y2);
        pinB.setAttribute('r', '1.2');
        pinB.setAttribute('fill', cable.color);
        pinB.setAttribute('class', 'cable-boot-pin');
        pinB.setAttribute('data-cable-id', cable.id);

        connectorsFrag.appendChild(bootA);
        connectorsFrag.appendChild(pinA);
        connectorsFrag.appendChild(bootB);
        connectorsFrag.appendChild(pinB);
        }
      }
    });

    cablesGroup.replaceChildren(cablesFrag);
    if (connectorsGroup) {
      connectorsGroup.replaceChildren(connectorsFrag);
    }

    if (STATE.highlightedCableId) {
      const hlPath = document.getElementById(`svg-cable-${STATE.highlightedCableId}`);
      const hlCasing = document.getElementById(`svg-cable-casing-${STATE.highlightedCableId}`);
      const cablesGroup = dom.cablesGroup || document.getElementById('cables-group');
      if (cablesGroup && hlCasing && hlPath) {
        cablesGroup.appendChild(hlCasing);
        cablesGroup.appendChild(hlPath);
      }
      const connectorsGroup = dom.connectorsGroup || document.getElementById('connectors-group');
      if (connectorsGroup) {
        document.querySelectorAll(`.cable-boot[data-cable-id="${STATE.highlightedCableId}"], .cable-boot-pin[data-cable-id="${STATE.highlightedCableId}"]`).forEach(b => {
          connectorsGroup.appendChild(b);
        });
      }
    }

    renderDRingOverlays(activeRack, clientToSvg);
  }

  function disconnectCable(cableId) {
    if (!cableId) return;
    const cable = STATE.cables.find(c => c.id === cableId);
    if (!cable) return;

    STATE.cables = STATE.cables.filter(c => c.id !== cableId);
    if (STATE.highlightedCableId === cableId) {
      STATE.highlightedCableId = null;
    }
    hideCableQuickHud();
    hideCableContextMenu();
    RS.setPixiCableHover?.(null, false);
    RS.invalidatePixiCableGeometry?.([cableId]);

    renderMountedDevices();
    renderScheduleTable();
    // Use the dual-engine dispatcher. Calling this module's local
    // renderAllCables() only refreshed the hidden SVG while Pixi stayed stale.
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
    if (force === true) {
      STATE.highlightedCableId = cableId || null;
    } else if (force === false) {
      STATE.highlightedCableId = null;
    } else {
      STATE.highlightedCableId = (cableId && STATE.highlightedCableId !== cableId) ? cableId : null;
    }
    if (!STATE.highlightedCableId) {
      hideCableQuickHud();
      hideCableContextMenu();
    }

    const svgEl = dom.cablesSvg || document.getElementById('cables-svg');
    if (svgEl) {
      svgEl.classList.toggle('has-cable-selected', !!STATE.highlightedCableId);
      if (!STATE.highlightedCableId) {
        svgEl.classList.remove('has-cable-hovered');
      }
    }

    document.querySelectorAll('.cable-path, .cable-casing').forEach(p => {
      p.classList.remove('highlighted');
    });

    if (!STATE.highlightedCableId) {
      document.querySelectorAll('.cable-path, .cable-casing, .cable-boot, .cable-boot-pin').forEach(el => {
        el.classList.remove('hovered');
      });
      restoreHoveredCable();
    }

    if (STATE.highlightedCableId) {
      const p = document.getElementById(`svg-cable-${STATE.highlightedCableId}`);
      const c = document.getElementById(`svg-cable-casing-${STATE.highlightedCableId}`);
      if (p) p.classList.add('highlighted');
      if (c) c.classList.add('highlighted');

      const cablesGroup = dom.cablesGroup || document.getElementById('cables-group');
      if (cablesGroup && c && p && c.parentNode === cablesGroup) {
        cablesGroup.appendChild(c);
        cablesGroup.appendChild(p);
      }

      const connectorsGroup = dom.connectorsGroup || document.getElementById('connectors-group');
      if (connectorsGroup) {
        document.querySelectorAll(`.cable-boot[data-cable-id="${STATE.highlightedCableId}"], .cable-boot-pin[data-cable-id="${STATE.highlightedCableId}"]`).forEach(b => {
          connectorsGroup.appendChild(b);
        });
      }
    }

    document.querySelectorAll('#schedule-tbody tr').forEach(row => {
      row.classList.toggle('active', row.dataset.cableId === STATE.highlightedCableId);
    });
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

  RS.cancelPendingConnection = cancelPendingConnection;
  RS.getNextCableId = getNextCableId;
  RS.getCableEndpointInfo = getCableEndpointInfo;
  RS.getCableLabel = getCableLabel;
  RS.renameCable2D = renameCable2D;
  RS.restoreHoveredCable = restoreHoveredCable;
  RS.setCableHover = setCableHover;
  RS.setDeviceCablesHover = setDeviceCablesHover;
  RS.ensureCableDelegation = ensureCableDelegation;
  RS.showCableTooltip = showCableTooltip;
  RS.getOrCreateSvgElement = getOrCreateSvgElement;
  function appendSingleCable(cable) {
    if (!cable) return;
    if (STATE.cableRenderMode === 'pixi') {
      if (RS.appendSingleCablePixi) return RS.appendSingleCablePixi(cable);
      if (RS.renderAllCablesPixi) return RS.renderAllCablesPixi();
    }
    if (RS.renderAllCables) {
      return RS.renderAllCables();
    }
    renderAllCables();
  }

  RS.appendSingleCable = appendSingleCable;
  RS.renderAllCables = renderAllCables;
  RS.renderAllCablesSVG = renderAllCables;
  RS.disconnectCable = disconnectCable;
  RS.highlightCable = highlightCable;
  RS.addDirectCable = addDirectCable;
})();
