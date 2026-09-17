/**
 * Cisco Enterprise Rack & Cabling Studio - Cable Schedule Table Module
 */
(function () {
  'use strict';

  const RS = window.RackStudio = window.RackStudio || {};

  const STATE = RS.STATE;
  const dom = RS.dom;
  const HARDWARE_CATALOG = RS.HARDWARE_CATALOG;

  const escapeHtml = (val) => RS.escapeHtml ? RS.escapeHtml(val) : String(val ?? '');
  const renderAllCables = () => RS.renderAllCables && RS.renderAllCables();
  const renderMountedDevices = () => RS.renderMountedDevices && RS.renderMountedDevices();
  const highlightCable = (...args) => RS.highlightCable && RS.highlightCable(...args);
  const setCableHover = (...args) => RS.setCableHover && RS.setCableHover(...args);
  const disconnectCable = (...args) => RS.disconnectCable && RS.disconnectCable(...args);
  const renameCable2D = (...args) => RS.renameCable2D && RS.renameCable2D(...args);

  function setConnectionRole(cableId, newRole) {
    const cable = STATE.cables.find(c => c.id === cableId);
    if (!cable) return;

    const ROLE_COLORS = {
      trunk: '#7c3aed',
      uplink: '#00d2ff',
      'trunk-ap': '#ec4899',
      routed: '#b91c1c',
      mgmt: '#059669',
      management: '#059669',
      access: '#38bdf8',
      poe: '#f59e0b',
      console: '#00bceb',
      fiber: '#facc15',
      standard: STATE.selectedCableColor || '#2563eb'
    };

    const isStandard = !newRole || newRole === 'standard' || newRole === 'access';
    const roleKey = isStandard ? null : newRole.toLowerCase();
    const resolvedColor = isStandard ? (STATE.selectedCableColor || '#2563eb') : (ROLE_COLORS[roleKey] || '#7c3aed');

    cable.role = roleKey;
    cable.color = resolvedColor;

    const isTrunkRole = roleKey === 'trunk' || roleKey === 'uplink' || roleKey === 'trunk-ap';

    if (roleKey === 'trunk') {
      if (!cable.name.startsWith('[TRUNK]')) {
        cable.name = `[TRUNK] ${cable.id}`;
      }
    } else if (roleKey === 'uplink') {
      if (!cable.name.startsWith('[UPLINK]')) {
        cable.name = `[UPLINK] ${cable.id}`;
      }
    } else if (roleKey === 'trunk-ap') {
      if (!cable.name.startsWith('[AP-TRUNK]')) {
        cable.name = `[AP-TRUNK] ${cable.id}`;
      }
    } else if (roleKey === 'routed') {
      if (!cable.name.startsWith('[ROUTED]')) {
        cable.name = `[ROUTED] ${cable.id}`;
      }
    } else if (roleKey === 'fiber') {
      if (!cable.name.startsWith('[FIBER]')) {
        cable.name = `[FIBER] ${cable.id}`;
      }
    } else if (roleKey === 'console') {
      if (!cable.name.startsWith('[CONSOLE]')) {
        cable.name = `[CONSOLE] ${cable.id}`;
      }
    } else {
      cable.name = (cable.name || '').replace(/^\[(TRUNK|AP-TRUNK|ROUTED|FIBER|UPLINK|CONSOLE)\]\s*/i, '');
    }

    let devA = null, devB = null;
    (STATE.racks || []).forEach(r => {
      if (!devA) devA = r.devices?.find(d => d.instanceId === cable.from.instanceId);
      if (!devB) devB = r.devices?.find(d => d.instanceId === cable.to.instanceId);
    });

    if (devA) {
      if (!devA.portsConfig) devA.portsConfig = {};
      const pIdA = cable.from.portId;
      const isNumA = /^p\d+$/i.test(String(pIdA)) || /^\d+$/.test(String(pIdA));
      const pNumA = isNumA ? String(pIdA).replace(/^p/i, '') : String(pIdA);
      if (isStandard) {
        delete devA.portsConfig[pIdA];
        if (isNumA) {
          delete devA.portsConfig[pNumA];
          delete devA.portsConfig['p' + pNumA];
        }
        delete devA.portsConfig['p' + pIdA];
      } else {
        const cfg = { role: roleKey, isTrunk: isTrunkRole, color: resolvedColor, autoCableColor: true };
        delete devA.portsConfig['p' + pIdA];
        devA.portsConfig[pIdA] = cfg;
        if (isNumA) {
          devA.portsConfig[pNumA] = cfg;
          devA.portsConfig['p' + pNumA] = cfg;
        }
      }
    }

    if (devB) {
      if (!devB.portsConfig) devB.portsConfig = {};
      const pIdB = cable.to.portId;
      const isNumB = /^p\d+$/i.test(String(pIdB)) || /^\d+$/.test(String(pIdB));
      const pNumB = isNumB ? String(pIdB).replace(/^p/i, '') : String(pIdB);
      if (isStandard) {
        delete devB.portsConfig[pIdB];
        if (isNumB) {
          delete devB.portsConfig[pNumB];
          delete devB.portsConfig['p' + pNumB];
        }
        delete devB.portsConfig['p' + pIdB];
      } else {
        const cfg = { role: roleKey, isTrunk: isTrunkRole, color: resolvedColor, autoCableColor: true };
        delete devB.portsConfig['p' + pIdB];
        devB.portsConfig[pIdB] = cfg;
        if (isNumB) {
          devB.portsConfig[pNumB] = cfg;
          devB.portsConfig['p' + pNumB] = cfg;
        }
      }
    }

    if (window.__STUDIO3D__ && window.__STUDIO3D__.updatePortConfig) {
      try {
        const portIdxA = parseInt(String(cable.from.portId).replace(/\D+/g, ''), 10) || 1;
        const portIdxB = parseInt(String(cable.to.portId).replace(/\D+/g, ''), 10) || 1;
        const dev3DA = devA?.id || devA?.instanceId;
        const dev3DB = devB?.id || devB?.instanceId;
        if (dev3DA) window.__STUDIO3D__.updatePortConfig(dev3DA, portIdxA, isStandard ? null : { role: roleKey, isTrunk: isTrunkRole, color: resolvedColor });
        if (dev3DB) window.__STUDIO3D__.updatePortConfig(dev3DB, portIdxB, isStandard ? null : { role: roleKey, isTrunk: isTrunkRole, color: resolvedColor });
      } catch (e) {
        console.warn('3D sync warning:', e);
      }
    }

    if (typeof window.sync2Dto3D === 'function') {
      try { window.sync2Dto3D(); } catch (e) {}
    }

    renderMountedDevices();
    renderScheduleTable();
    renderAllCables();
    document.dispatchEvent(new CustomEvent('rackstudio:change', { bubbles: true }));
    document.dispatchEvent(new CustomEvent('rackstudio:refresh', { bubbles: true }));
    window.dispatchEvent(new CustomEvent('rackstudio:refresh'));
  }

  function showRolePickerPopover(triggerBtn, cableId, currentRole) {
    document.querySelectorAll('.role-picker-popover').forEach(p => p.remove());

    const popover = document.createElement('div');
    popover.className = 'role-picker-popover';
    popover.innerHTML = `
      <div class="role-picker-title">802.1Q TRUNK HATLARI</div>
      <div class="role-picker-item ${currentRole === 'trunk' ? 'active' : ''}" data-role="trunk">
        <span class="role-badge-preview trunk">T</span>
        <div class="role-text-group">
          <span class="role-label">TRUNK (Switch-to-Switch)</span>
          <span class="role-hint">Elektrik Mor (#7c3aed) · Çoklu VLAN Dağıtım</span>
        </div>
      </div>
      <div class="role-picker-item ${currentRole === 'uplink' ? 'active' : ''}" data-role="uplink">
        <span class="role-badge-preview uplink">▲</span>
        <div class="role-text-group">
          <span class="role-label">TRUNK UPLINK (Core/Dist)</span>
          <span class="role-hint">Neon Cyan (#00d2ff) · Omurga / Üst Çıkış</span>
        </div>
      </div>
      <div class="role-picker-item ${currentRole === 'trunk-ap' ? 'active' : ''}" data-role="trunk-ap">
        <span class="role-badge-preview trunk-ap">W</span>
        <div class="role-text-group">
          <span class="role-label">TRUNK AP (Wi-Fi Access Point)</span>
          <span class="role-hint">Canlı Fuşya (#ec4899) · Çoklu-SSID VLAN</span>
        </div>
      </div>
      <div class="role-picker-sep"></div>
      <div class="role-picker-title">ACCESS &amp; UÇ NOKTA</div>
      <div class="role-picker-item ${!currentRole || currentRole === 'standard' || currentRole === 'access' ? 'active' : ''}" data-role="standard">
        <span class="role-badge-preview standard">A</span>
        <div class="role-text-group">
          <span class="role-label">STANDART ACCESS (Data / IP Tel)</span>
          <span class="role-hint">Standart Kablo Rengi · PoE Dahil</span>
        </div>
      </div>
      <div class="role-picker-item ${currentRole === 'mgmt' || currentRole === 'management' ? 'active' : ''}" data-role="mgmt">
        <span class="role-badge-preview mgmt">M</span>
        <div class="role-text-group">
          <span class="role-label">MGMT (OOB Yönetim)</span>
          <span class="role-hint">Zümrüt (#059669) · Dedicated Konsol/OOB</span>
        </div>
      </div>
      <div class="role-picker-item ${currentRole === 'console' ? 'active' : ''}" data-role="console">
        <span class="role-badge-preview console">C</span>
        <div class="role-text-group">
          <span class="role-label">CONSOLE (Cisco Seri Port)</span>
          <span class="role-hint">Cisco Cyan (#00bceb) · RJ45 Seri Konsol</span>
        </div>
      </div>
      <div class="role-picker-sep"></div>
      <div class="role-picker-title">LAYER 3 &amp; WAN</div>
      <div class="role-picker-item ${currentRole === 'routed' ? 'active' : ''}" data-role="routed">
        <span class="role-badge-preview routed">R</span>
        <div class="role-text-group">
          <span class="role-label">ROUTED PORT (no switchport)</span>
          <span class="role-hint">Koyu Karmin (#b91c1c) · L3 IP Noktadan Noktaya</span>
        </div>
      </div>
      <div class="role-picker-sep"></div>
      <div class="role-picker-title">FİBER OPTİK (OS2 / OM4)</div>
      <div class="role-picker-item ${currentRole === 'fiber' ? 'active' : ''}" data-role="fiber">
        <span class="role-badge-preview fiber">F</span>
        <div class="role-text-group">
          <span class="role-label">FIBER OPTİK (Single-Mode)</span>
          <span class="role-hint">Sarı (#facc15) · LC/SC Optik Hat</span>
        </div>
      </div>
    `;

    document.body.appendChild(popover);

    const rect = triggerBtn.getBoundingClientRect();
    let top = rect.bottom + 4;
    let left = rect.right - 200;

    // Only flip upwards if overflowing window bottom AND there's sufficient room on top
    if (top + 230 > window.innerHeight && rect.top > 240) {
      top = rect.top - 225;
    }
    top = Math.max(10, Math.min(top, window.innerHeight - 240));
    left = Math.max(10, Math.min(left, window.innerWidth - 220));

    popover.style.top = `${top}px`;
    popover.style.left = `${left}px`;

    popover.querySelectorAll('.role-picker-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const newRole = item.dataset.role;
        popover.remove();
        setConnectionRole(cableId, newRole);
      });
    });

    const outsideClick = (e) => {
      if (!popover.contains(e.target) && e.target !== triggerBtn) {
        popover.remove();
        document.removeEventListener('click', outsideClick);
      }
    };
    setTimeout(() => document.addEventListener('click', outsideClick), 0);
  }

  let scheduleSortMode = 'u'; // 'u' | 'panel' | 'tree'
  const collapsedSwitches = new Set();

  function getPortSortIndex(portId, portName) {
    const str = String(portName || portId || '');
    const m3 = str.match(/(\d+)\/(\d+)\/(\d+)/);
    if (m3) return parseInt(m3[1], 10) * 10000 + parseInt(m3[2], 10) * 1000 + parseInt(m3[3], 10);
    const m2 = str.match(/(\d+)\/(\d+)/);
    if (m2) return parseInt(m2[1], 10) * 1000 + parseInt(m2[2], 10);
    const m1 = str.match(/\d+/);
    if (m1) return parseInt(m1[0], 10);
    return 9999;
  }

  function renderSingleCableCard(c) {
    const rackA = STATE.racks ? STATE.racks.find(r => r.id === c.from?.rackId) : null;
    const rackB = STATE.racks ? STATE.racks.find(r => r.id === c.to?.rackId) : null;
    const devA = rackA ? rackA.devices?.find(d => d.instanceId === c.from?.instanceId) : null;
    const devB = rackB ? rackB.devices?.find(d => d.instanceId === c.to?.instanceId) : null;

    const catA = devA ? HARDWARE_CATALOG[devA.catalogKey] : null;
    const catB = devB ? HARDWARE_CATALOG[devB.catalogKey] : null;
    const portA = catA ? catA.ports?.find(p => p.id === c.from?.portId) : null;
    const portB = catB ? catB.ports?.find(p => p.id === c.to?.portId) : null;

    const isInterRack = c.from?.rackId !== c.to?.rackId;

    const tr = document.createElement('tr');
    tr.dataset.cableId = c.id;
    if (c.id === STATE.highlightedCableId) tr.className = 'active';

    const rackShortA = rackA ? (rackA.name.length > 10 ? rackA.name.slice(0, 10) + '…' : rackA.name) : 'Kabin';
    const rackShortB = rackB ? (rackB.name.length > 10 ? rackB.name.slice(0, 10) + '…' : rackB.name) : 'Kabin';

    const sourcePortCfg = devA?.portsConfig && (devA.portsConfig[c.from?.portId] || devA.portsConfig[String(c.from?.portId).replace('p', '')]);
    const targetPortCfg = devB?.portsConfig && (devB.portsConfig[c.to?.portId] || devB.portsConfig[String(c.to?.portId).replace('p', '')]);
    const portRole = (c.role || (sourcePortCfg && sourcePortCfg.role) || (targetPortCfg && targetPortCfg.role) || (portA && portA.role) || (portB && portB.role) || '').toLowerCase();

    const roleColors = {
      trunk: '#7c3aed',
      uplink: '#00d2ff',
      'trunk-ap': '#ec4899',
      poe: '#f59e0b',
      mgmt: '#059669',
      management: '#059669',
      console: '#00bceb',
      routed: '#b91c1c',
      fiber: '#facc15'
    };

    const portTypeA = portA?.type === 'fiber' || portA?.type === 'lc' || portA?.type === 'sc' || portA?.type === 'sfp' ? 'fiber' : (portA?.type === 'power' ? 'power' : 'copper');
    const portTypeB = portB?.type === 'fiber' || portB?.type === 'lc' || portB?.type === 'sc' || portB?.type === 'sfp' ? 'fiber' : (portB?.type === 'power' ? 'power' : 'copper');

    const isOpticalRun = portRole === 'fiber' ||
                         c.color === '#facc15' ||
                         (c.name && c.name.startsWith('[FIBER]')) ||
                         (portTypeA === 'fiber' && portTypeB === 'fiber');

    if (isOpticalRun) {
      if (c.color !== '#facc15') c.color = '#facc15';
      if (c.role !== 'fiber') c.role = 'fiber';
      if (c.name && c.name.startsWith('[UPLINK]')) c.name = c.name.replace('[UPLINK]', '[FIBER]');
    }

    const effectiveCardRole = isOpticalRun ? 'fiber' : (portRole || 'standard');
    const rowAccentColor = isOpticalRun ? '#facc15' : (roleColors[effectiveCardRole] || c.color || '#38bdf8');
    tr.style.setProperty('--row-accent', rowAccentColor);
    tr.classList.add('schedule-cable-card');
    if (effectiveCardRole) tr.classList.add(`role-${effectiveCardRole}`);

    let roleTagLetter = '●';
    let roleBadgeText = 'STANDART';
    if (effectiveCardRole === 'fiber') { roleBadgeText = 'FIBER'; roleTagLetter = 'F'; }
    else if (effectiveCardRole === 'trunk') { roleBadgeText = 'TRUNK'; roleTagLetter = 'T'; }
    else if (effectiveCardRole === 'uplink') { roleBadgeText = 'UPLINK'; roleTagLetter = '▲'; }
    else if (effectiveCardRole === 'trunk-ap') { roleBadgeText = 'AP-TRUNK'; roleTagLetter = 'W'; }
    else if (effectiveCardRole === 'poe') { roleBadgeText = 'PoE'; roleTagLetter = '⚡'; }
    else if (effectiveCardRole === 'mgmt' || effectiveCardRole === 'management') { roleBadgeText = 'MGMT'; roleTagLetter = 'M'; }
    else if (effectiveCardRole === 'console') { roleBadgeText = 'CONSOLE'; roleTagLetter = 'C'; }
    else if (effectiveCardRole === 'routed') { roleBadgeText = 'ROUTED'; roleTagLetter = 'R'; }

    const devLabelA = devA?.panelLabel || devA?.hostname || devA?.name || catA?.name || '';
    const devLabelB = devB?.panelLabel || devB?.hostname || devB?.name || catB?.name || '';

    const panelTagA = devA?.panelLabel
      ? `<span class="badge-panel-tag" title="Patch Panel: ${escapeHtml(devA.panelLabel)}">${escapeHtml(devA.panelLabel)}</span>`
      : (devA?.hostname && devA.hostname !== catA?.name ? `<span class="badge-dev-tag" title="Cihaz: ${escapeHtml(devA.hostname)}">${escapeHtml(devA.hostname.length > 8 ? devA.hostname.slice(0, 8) + '…' : devA.hostname)}</span>` : '');

    const panelTagB = devB?.panelLabel
      ? `<span class="badge-panel-tag" title="Patch Panel: ${escapeHtml(devB.panelLabel)}">${escapeHtml(devB.panelLabel)}</span>`
      : (devB?.hostname && devB.hostname !== catB?.name ? `<span class="badge-dev-tag" title="Cihaz: ${escapeHtml(devB.hostname)}">${escapeHtml(devB.hostname.length > 8 ? devB.hostname.slice(0, 8) + '…' : devB.hostname)}</span>` : '');

    let left = {
      rack: rackA,
      dev: devA,
      cat: catA,
      port: portA,
      portId: c.from?.portId,
      instanceId: c.from?.instanceId,
      portType: portTypeA,
      devLabel: devLabelA,
      panelTag: panelTagA,
      rackShort: rackShortA
    };

    let right = {
      rack: rackB,
      dev: devB,
      cat: catB,
      port: portB,
      portId: c.to?.portId,
      instanceId: c.to?.instanceId,
      portType: portTypeB,
      devLabel: devLabelB,
      panelTag: panelTagB,
      rackShort: rackShortB
    };

    // Standardize: Patch Panel is ALWAYS first (Left / Source), Switch is ALWAYS second (Right / Target)
    const isPatchA = catA && (catA.category === 'patch' || catA.category === 'fiber' || catA.category === 'fiber-panel' || catA.category === 'odf');
    const isPatchB = catB && (catB.category === 'patch' || catB.category === 'fiber' || catB.category === 'fiber-panel' || catB.category === 'odf');
    if (!isPatchA && isPatchB) {
      const tmp = left;
      left = right;
      right = tmp;
    }

    let displayName = (c.name && !c.name.includes('→')) ? c.name : (c.id || c.name || 'CBL');
    if (isOpticalRun && displayName.startsWith('[UPLINK]')) {
      displayName = displayName.replace('[UPLINK]', '[FIBER]');
    }

    const routingOrgs = (!isInterRack && rackA && rackA === rackB && devA && devB && RS.findRoutingOrganizers)
      ? RS.findRoutingOrganizers(rackA, devA, devB)
      : [];

    const orgPathStr = routingOrgs.length > 0
      ? ` ➔ Dikey Kanal ➔ ${routingOrgs.map(o => 'U' + o.topU + ' Düzenleyici').join(' ➔ ')} ➔ Dikey Kanal ➔ `
      : ' ➔ ';
    const flowTooltip = `Saha Güzergahı: ${left.devLabel || 'Cihaz'} (U${left.dev ? left.dev.topU : '?'}, ${left.port ? left.port.name : left.portId})${orgPathStr}${right.devLabel || 'Cihaz'} (U${right.dev ? right.dev.topU : '?'}, ${right.port ? right.port.name : right.portId}) | Gerçek Saha Metrajı: ${c.lengthMeters}m (%10 Servis Halkası Dahil)`;

    const currentDuct = c.ductSide || 'auto';
    const ductLabel = currentDuct === 'left' ? '⬅️ Sol' : (currentDuct === 'right' ? '➡️ Sağ' : '⚖️ Oto');
    const ductTooltip = `Dikey Kanal Güzergahı: ${currentDuct === 'left' ? 'Sol Dikey Tava' : (currentDuct === 'right' ? 'Sağ Dikey Tava' : 'Otomatik Dengeli')} (Değiştirmek için tıkla)`;

    tr.innerHTML = `
      <td class="schedule-card-cell" colspan="3">
        <div class="card-legend-bar">
          <div class="card-legend-left role-select-trigger" data-cable-id="${c.id}" title="Kablo Rolü Ata / Değiştir (Tıkla)">
            <span class="cable-color-dot" style="background:${isOpticalRun ? '#facc15' : c.color};box-shadow:0 0 6px ${isOpticalRun ? '#facc15' : c.color};"></span>
            <span class="cable-role-tag role-${effectiveCardRole}">${roleTagLetter} ${escapeHtml(roleBadgeText)} ▾</span>
            <span class="cable-id-badge" title="${escapeHtml(c.name || c.id)}">${escapeHtml(displayName)}</span>
          </div>
          <div class="card-legend-right">
            <button type="button" class="duct-select-trigger" data-cable-id="${c.id}" title="${escapeHtml(ductTooltip)}">${escapeHtml(ductLabel)}</button>
            <span class="metraj-badge" title="Gerçek Saha Metrajı (Servis Payı Dahil)">${c.lengthMeters}m</span>
          </div>
        </div>
        <div class="card-route-bar">
          <div class="route-split-container" title="${escapeHtml(flowTooltip)}">
            <div class="route-endpoint-box left clickable-endpoint" data-instance-id="${left.instanceId}" data-port-id="${left.portId}" title="Kaynak: ${escapeHtml(left.devLabel)} (${left.port ? left.port.name : left.portId})">
              ${isInterRack && left.rack ? `<span class="inter-rack-tag" title="${escapeHtml(left.rack.name)}">${escapeHtml(left.rackShort)}</span>` : ''}
              <span class="badge-u-prominent">U${left.dev ? left.dev.topU : '?'}</span>
              <span class="route-pipe">|</span>
              <span class="badge-port-prominent ${left.portType}">${left.panelTag ? left.panelTag + ' ' : ''}${escapeHtml(left.port ? left.port.name : left.portId)}</span>
            </div>
            <span class="route-center-sep" aria-hidden="true">➔</span>
            <div class="route-endpoint-box right clickable-endpoint" data-instance-id="${right.instanceId}" data-port-id="${right.portId}" title="Hedef: ${escapeHtml(right.devLabel)} (${right.port ? right.port.name : right.portId})">
              <span class="badge-port-prominent ${right.portType}">${right.panelTag ? right.panelTag + ' ' : ''}${escapeHtml(right.port ? right.port.name : right.portId)}</span>
              <span class="route-pipe">|</span>
              <span class="badge-u-prominent">U${right.dev ? right.dev.topU : '?'}</span>
              ${isInterRack && right.rack ? `<span class="inter-rack-tag" title="${escapeHtml(right.rack.name)}">${escapeHtml(right.rackShort)}</span>` : ''}
            </div>
          </div>
          <button class="del-cable-btn" data-cable-id="${c.id}" title="Kabloyu Sök (Delete)">✕</button>
        </div>
      </td>
    `;

    tr.addEventListener('mouseenter', () => {
      setCableHover(c.id, true);
    });

    tr.addEventListener('mouseleave', () => {
      setCableHover(c.id, false);
    });

    tr.addEventListener('click', (e) => {
      if (e.target.closest('.del-cable-btn') || e.target.closest('.role-select-trigger') || e.target.closest('.duct-select-trigger') || e.target.closest('.clickable-endpoint')) return;
      highlightCable(c.id);
    });

    tr.addEventListener('dblclick', (e) => {
      if (e.target.closest('.del-cable-btn') || e.target.closest('.role-select-trigger') || e.target.closest('.duct-select-trigger') || e.target.closest('.clickable-endpoint')) return;
      e.preventDefault();
      renameCable2D(c.id);
    });

    const roleBtn = tr.querySelector('.role-select-trigger');
    if (roleBtn) {
      roleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showRolePickerPopover(roleBtn, c.id, effectiveCardRole);
      });
    }

    const ductBtn = tr.querySelector('.duct-select-trigger');
    if (ductBtn) {
      ductBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (e.currentTarget && e.currentTarget.blur) e.currentTarget.blur();
        if (RS.toggleCableDuctSide) {
          RS.toggleCableDuctSide(c.id);
        }
      });
    }

    tr.querySelectorAll('.clickable-endpoint').forEach(ep => {
      ep.addEventListener('click', (e) => {
        e.stopPropagation();
        const instId = ep.dataset.instanceId;
        const pId = ep.dataset.portId;
        if (window.PortConfigEditor) {
          window.PortConfigEditor.open(instId, pId, '2d');
        }
      });
    });

    const delBtn = tr.querySelector('.del-cable-btn');
    if (delBtn) {
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (window.SoundFX) window.SoundFX.playCableCut();
        STATE.cables = STATE.cables.filter(item => item.id !== c.id);
        if (STATE.highlightedCableId === c.id) STATE.highlightedCableId = null;
        renderMountedDevices();
        renderScheduleTable();
        renderAllCables();
        document.dispatchEvent(new CustomEvent('rackstudio:change', { bubbles: true }));
        document.dispatchEvent(new CustomEvent('rackstudio:refresh', { bubbles: true }));
        window.dispatchEvent(new CustomEvent('rackstudio:refresh'));
      });
    }

    dom.scheduleTbody.appendChild(tr);
  }

  function renderSwitchTreeView() {
    const allDevices = STATE.racks ? STATE.racks.flatMap(r => r.devices || []) : [];
    const switches = allDevices.filter(d => {
      const cat = HARDWARE_CATALOG[d.catalogKey];
      if (!cat) return false;
      return cat.category === 'switch' || cat.category === 'fiber-switch' || cat.category === 'compact' || cat.category === 'router';
    });

    // Sort switches by highest U to lowest U
    switches.sort((a, b) => (b.topU || 0) - (a.topU || 0));

    const processedCableIds = new Set();

    switches.forEach(sw => {
      const swCat = HARDWARE_CATALOG[sw.catalogKey];
      const swShort = RS.getShortModelName ? RS.getShortModelName(swCat?.modelTag || swCat?.name || 'Switch') : (swCat?.modelTag || 'Switch');
      const isCollapsed = collapsedSwitches.has(sw.instanceId);

      const swCables = (STATE.cables || []).filter(c => c.from?.instanceId === sw.instanceId || c.to?.instanceId === sw.instanceId);
      if (swCables.length === 0) return;

      swCables.forEach(c => processedCableIds.add(c.id));

      // Sort cables by switch local port
      swCables.sort((c1, c2) => {
        const p1 = (c1.from.instanceId === sw.instanceId) ? c1.from.portId : c1.to.portId;
        const p2 = (c2.from.instanceId === sw.instanceId) ? c2.from.portId : c2.to.portId;
        const obj1 = swCat?.ports?.find(p => p.id === p1 || String(p.id).replace(/^p/i, '') === String(p1).replace(/^p/i, ''));
        const obj2 = swCat?.ports?.find(p => p.id === p2 || String(p.id).replace(/^p/i, '') === String(p2).replace(/^p/i, ''));
        return getPortSortIndex(p1, obj1?.name) - getPortSortIndex(p2, obj2?.name);
      });

      const tr = document.createElement('tr');
      tr.className = `schedule-tree-switch-card ${isCollapsed ? 'collapsed' : ''}`;
      tr.dataset.instanceId = sw.instanceId;

      let treeRowsHtml = '';
      swCables.forEach(c => {
        const isFrom = c.from.instanceId === sw.instanceId;
        const localPortId = isFrom ? c.from.portId : c.to.portId;
        const remoteInstanceId = isFrom ? c.to.instanceId : c.from.instanceId;
        const remotePortId = isFrom ? c.to.portId : c.from.portId;

        const localPortObj = swCat?.ports?.find(p => p.id === localPortId || String(p.id).replace(/^p/i, '') === String(localPortId).replace(/^p/i, ''));
        const localPortName = localPortObj?.name || localPortId;
        const isFiberPort = localPortObj?.type === 'fiber' || localPortObj?.type === 'lc' || localPortObj?.type === 'sc' || localPortObj?.type === 'sfp';

        const remoteDev = allDevices.find(d => d.instanceId === remoteInstanceId);
        const remoteCat = remoteDev ? HARDWARE_CATALOG[remoteDev.catalogKey] : null;
        const remotePortObj = remoteCat?.ports?.find(p => p.id === remotePortId || String(p.id).replace(/^p/i, '') === String(remotePortId).replace(/^p/i, ''));
        const remotePortName = remotePortObj?.name || remotePortId;
        const remoteLabel = remoteDev?.panelLabel ? `Panel ${remoteDev.panelLabel}` : (remoteDev?.hostname || remoteCat?.name || 'Cihaz');

        const isOptical = c.color === '#facc15' || c.name?.startsWith('[FIBER]') || c.role === 'fiber' || isFiberPort;
        const effRole = isOptical ? 'fiber' : (c.role || 'standard');
        const roleColors = { trunk: '#7c3aed', uplink: '#00d2ff', 'trunk-ap': '#ec4899', poe: '#f59e0b', mgmt: '#059669', console: '#00bceb', routed: '#b91c1c', fiber: '#facc15', standard: '#334155' };
        const accent = roleColors[effRole] || c.color || '#38bdf8';

        let roleTagLetter = '●';
        let roleBadgeText = 'STANDART';
        if (effRole === 'fiber') { roleBadgeText = 'FIBER'; roleTagLetter = 'F'; }
        else if (effRole === 'trunk') { roleBadgeText = 'TRUNK'; roleTagLetter = 'T'; }
        else if (effRole === 'uplink') { roleBadgeText = 'UPLINK'; roleTagLetter = '▲'; }
        else if (effRole === 'trunk-ap') { roleBadgeText = 'AP-TRUNK'; roleTagLetter = 'W'; }
        else if (effRole === 'poe') { roleBadgeText = 'PoE'; roleTagLetter = '⚡'; }
        else if (effRole === 'mgmt' || effRole === 'management') { roleBadgeText = 'MGMT'; roleTagLetter = 'M'; }
        else if (effRole === 'console') { roleBadgeText = 'CONSOLE'; roleTagLetter = 'C'; }
        else if (effRole === 'routed') { roleBadgeText = 'ROUTED'; roleTagLetter = 'R'; }

        treeRowsHtml += `
          <div class="tree-cable-row" data-cable-id="${c.id}" style="--row-accent: ${accent};">
            <div class="tree-port-left">
              <span class="tree-branch-symbol">├─</span>
              <span class="tree-src-port ${isOptical ? 'fiber' : ''}">${escapeHtml(localPortName)}</span>
              <span class="route-center-sep" style="font-size:12px;opacity:0.7;">➔</span>
              <div class="tree-dest-info">
                <span class="tree-dest-u">U${remoteDev ? remoteDev.topU : '?'}</span>
                <span>${escapeHtml(remoteLabel)} (${escapeHtml(remotePortName)})</span>
              </div>
            </div>
            <div class="tree-cable-right">
              <span class="cable-color-dot" style="background:${isOptical ? '#facc15' : c.color};box-shadow:0 0 5px ${isOptical ? '#facc15' : c.color};"></span>
              <span class="cable-role-tag role-${effRole}">${roleTagLetter} ${escapeHtml(roleBadgeText)}</span>
              <span class="metraj-badge">${c.lengthMeters}m</span>
              <button type="button" class="del-cable-btn" data-cable-id="${c.id}" title="Kabloyu Sök">✕</button>
            </div>
          </div>
        `;
      });

      tr.innerHTML = `
        <td class="schedule-card-cell" colspan="3" style="padding:0;">
          <div class="tree-switch-header">
            <div class="tree-switch-info">
              <span class="tree-toggle-icon">${isCollapsed ? '▶' : '▼'}</span>
              <span class="tree-switch-badge-u">U${sw.topU}</span>
              <span class="tree-switch-title">${escapeHtml(swShort)}</span>
              ${sw.hostname && sw.hostname !== swShort ? `<span class="tree-switch-model">(${escapeHtml(sw.hostname)})</span>` : ''}
            </div>
            <div class="tree-switch-actions">
              <button type="button" class="btn-switch-bulk-color" data-instance-id="${sw.instanceId}" title="Bu switch'e bağlı tüm kabloları renklendir">🎨 Renk</button>
              <span class="tree-switch-count">${swCables.length} Port Bağlı</span>
            </div>
          </div>
          <div class="tree-switch-body">
            ${treeRowsHtml}
          </div>
        </td>
      `;

      // Header Events: Switch Hover Highlights all its cables!
      const header = tr.querySelector('.tree-switch-header');
      header.addEventListener('mouseenter', () => {
        if (RS.setDeviceCablesHover) RS.setDeviceCablesHover(sw.instanceId, true);
      });
      header.addEventListener('mouseleave', () => {
        if (RS.setDeviceCablesHover) RS.setDeviceCablesHover(sw.instanceId, false);
      });
      header.addEventListener('click', (e) => {
        if (e.target.closest('.btn-switch-bulk-color')) return;
        if (collapsedSwitches.has(sw.instanceId)) {
          collapsedSwitches.delete(sw.instanceId);
        } else {
          collapsedSwitches.add(sw.instanceId);
        }
        renderScheduleTable();
      });

      const colorBtn = tr.querySelector('.btn-switch-bulk-color');
      if (colorBtn) {
        colorBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (RS.openSwitchBulkColorPopover) {
            RS.openSwitchBulkColorPopover(colorBtn, sw.instanceId);
          }
        });
      }

      // Child Row Events: Individual cable hover
      tr.querySelectorAll('.tree-cable-row').forEach(row => {
        const cId = row.dataset.cableId;
        row.addEventListener('mouseenter', (e) => {
          e.stopPropagation();
          setCableHover(cId, true);
        });
        row.addEventListener('mouseleave', (e) => {
          e.stopPropagation();
          setCableHover(cId, false);
        });
        row.addEventListener('click', (e) => {
          if (e.target.closest('.del-cable-btn')) return;
          e.stopPropagation();
          highlightCable(cId);
        });
        const delBtn = row.querySelector('.del-cable-btn');
        if (delBtn) {
          delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (window.SoundFX) window.SoundFX.playCableCut();
            STATE.cables = STATE.cables.filter(item => item.id !== cId);
            if (STATE.highlightedCableId === cId) STATE.highlightedCableId = null;
            renderMountedDevices();
            renderScheduleTable();
            renderAllCables();
            document.dispatchEvent(new CustomEvent('rackstudio:change', { bubbles: true }));
            document.dispatchEvent(new CustomEvent('rackstudio:refresh', { bubbles: true }));
          });
        }
      });

      dom.scheduleTbody.appendChild(tr);
    });

    // Render any remaining cables (e.g. Patch Panel to Patch Panel tie cables)
    const remainingCables = (STATE.cables || []).filter(c => !processedCableIds.has(c.id));
    if (remainingCables.length > 0) {
      remainingCables.forEach(c => renderSingleCableCard(c));
    }
  }

  function renderScheduleTable() {
    if (!dom.scheduleTbody) return;
    dom.scheduleTbody.innerHTML = '';

    // Remove legacy pagination element if present
    const oldPager = document.getElementById('schedule-pagination');
    if (oldPager) oldPager.remove();

    // Render Schedule View & Sort Toolbar
    let toolbar = document.getElementById('schedule-toolbar');
    if (!toolbar) {
      toolbar = document.createElement('div');
      toolbar.id = 'schedule-toolbar';
      const table = dom.scheduleTbody.closest('table');
      if (table) table.before(toolbar);
    }

    toolbar.innerHTML = `
      <div class="schedule-toolbar-left">
        <span class="schedule-total-badge">${STATE.cables.length} Bağlantı</span>
      </div>
      <div class="schedule-sort-group">
        <button type="button" class="sort-tab-btn ${scheduleSortMode === 'u' ? 'active' : ''}" data-sort="u" title="Kabin U Konumuna Göre Sırala">⇕ U Sırası</button>
        <button type="button" class="sort-tab-btn ${scheduleSortMode === 'panel' ? 'active' : ''}" data-sort="panel" title="Patch Panel Adına Göre Sırala (A-Z)">A-Z Panel</button>
        <button type="button" class="sort-tab-btn ${scheduleSortMode === 'tree' ? 'active' : ''}" data-sort="tree" title="Cisco Switch Port Ağacı Görünümü">🌿 Switch Ağacı</button>
      </div>
    `;

    toolbar.querySelectorAll('.sort-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        scheduleSortMode = btn.dataset.sort;
        renderScheduleTable();
      });
    });

    if (dom.cableCountLabel) {
      dom.cableCountLabel.textContent = `${STATE.cables.length} Bağlantı Yapıldı`;
    }

    if (dom.scheduleTbody && !dom.scheduleTbody.__HOVER_BOUND__) {
      dom.scheduleTbody.__HOVER_BOUND__ = true;
      dom.scheduleTbody.addEventListener('mouseleave', () => {
        const cur = RS.getActiveHoveredCableId && RS.getActiveHoveredCableId();
        if (cur) {
          setCableHover(cur, false);
        }
        if (RS.setDeviceCablesHover) {
          RS.setDeviceCablesHover(null, false);
        }
      });
    }

    if (!STATE.cables || STATE.cables.length === 0) {
      dom.scheduleTbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center; color:#64748b; padding:20px;">
            Henüz kablo bağlantısı yapılmadı.
          </td>
        </tr>
      `;
      return;
    }

    if (scheduleSortMode === 'tree') {
      renderSwitchTreeView();
      return;
    }

    // Standard list modes: Clone and sort cables
    const cablesList = [...STATE.cables];
    const allDevices = STATE.racks ? STATE.racks.flatMap(r => r.devices || []) : [];

    if (scheduleSortMode === 'u') {
      cablesList.sort((a, b) => {
        const devA1 = allDevices.find(d => d.instanceId === a.from?.instanceId);
        const devA2 = allDevices.find(d => d.instanceId === a.to?.instanceId);
        const maxUA = Math.max(devA1?.topU || 0, devA2?.topU || 0);

        const devB1 = allDevices.find(d => d.instanceId === b.from?.instanceId);
        const devB2 = allDevices.find(d => d.instanceId === b.to?.instanceId);
        const maxUB = Math.max(devB1?.topU || 0, devB2?.topU || 0);

        if (maxUB !== maxUA) return maxUB - maxUA;
        return (a.id || '').localeCompare(b.id || '');
      });
    } else if (scheduleSortMode === 'panel') {
      cablesList.sort((a, b) => {
        const devA1 = allDevices.find(d => d.instanceId === a.from?.instanceId);
        const devA2 = allDevices.find(d => d.instanceId === a.to?.instanceId);
        const panelA = devA1?.panelLabel || devA2?.panelLabel || devA1?.hostname || devA2?.hostname || '';

        const devB1 = allDevices.find(d => d.instanceId === b.from?.instanceId);
        const devB2 = allDevices.find(d => d.instanceId === b.to?.instanceId);
        const panelB = devB1?.panelLabel || devB2?.panelLabel || devB1?.hostname || devB2?.hostname || '';

        const cmp = panelA.localeCompare(panelB);
        if (cmp !== 0) return cmp;
        return (a.id || '').localeCompare(b.id || '');
      });
    }

    cablesList.forEach(c => {
      renderSingleCableCard(c);
    });
  }

  RS.ensureCableVisibleInSchedule = function(cableId) {
    if (!STATE.cables) return null;
    const cable = STATE.cables.find(c => c.id === cableId);
    if (!cable) return null;

    if (scheduleSortMode === 'tree') {
      const swId1 = cable.from?.instanceId;
      const swId2 = cable.to?.instanceId;
      if (swId1 && collapsedSwitches.has(swId1)) {
        collapsedSwitches.delete(swId1);
        renderScheduleTable();
      } else if (swId2 && collapsedSwitches.has(swId2)) {
        collapsedSwitches.delete(swId2);
        renderScheduleTable();
      }
      const treeRow = document.querySelector(`.tree-cable-row[data-cable-id="${cableId}"]`);
      if (treeRow) {
        treeRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return treeRow;
      }
    }

    const row = document.querySelector(`#schedule-tbody tr[data-cable-id="${cableId}"]`);
    if (row) {
      row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    return row;
  };

  RS.setConnectionRole = setConnectionRole;
  RS.showRolePickerPopover = showRolePickerPopover;
  RS.renderScheduleTable = renderScheduleTable;
})();
