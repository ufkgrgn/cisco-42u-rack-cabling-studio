/**
 * Cisco Enterprise Rack & Cabling Studio - Schedule Role Picker Module
 * Handles setting cable connection roles (trunk, uplink, routed, access, fiber, console)
 * and rendering the role picker popover menu from cable schedule rows.
 */
(function () {
  'use strict';

  const RS = window.RackStudio = window.RackStudio || {};
  const STATE = RS.STATE;

  const renderMountedDevices = () => RS.renderMountedDevices && RS.renderMountedDevices();
  const renderScheduleTable = () => RS.renderScheduleTable && RS.renderScheduleTable();
  const renderAllCables = () => RS.renderAllCables && RS.renderAllCables();

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
      const pNumA = String(pIdA).replace(/\D+/g, '');
      if (isStandard) {
        delete devA.portsConfig[pIdA];
        if (pNumA) {
          delete devA.portsConfig[pNumA];
          delete devA.portsConfig['p' + pNumA];
          delete devA.portsConfig['pt' + pNumA];
          delete devA.portsConfig['lc' + pNumA];
          delete devA.portsConfig['sc' + pNumA];
        }
        delete devA.portsConfig['p' + pIdA];
      } else {
        const existingA = devA.portsConfig[pIdA] || (pNumA && devA.portsConfig[pNumA]) || {};
        const cfg = {
          ...existingA,
          role: roleKey,
          isTrunk: isTrunkRole,
          color: resolvedColor,
          autoCableColor: true
        };
        delete devA.portsConfig['p' + pIdA];
        devA.portsConfig[pIdA] = cfg;
        if (pNumA) {
          devA.portsConfig[pNumA] = cfg;
          devA.portsConfig['p' + pNumA] = cfg;
          if (String(pIdA).startsWith('pt')) devA.portsConfig['pt' + pNumA] = cfg;
          if (String(pIdA).startsWith('lc')) devA.portsConfig['lc' + pNumA] = cfg;
          if (String(pIdA).startsWith('sc')) devA.portsConfig['sc' + pNumA] = cfg;
        }
      }
    }

    if (devB) {
      if (!devB.portsConfig) devB.portsConfig = {};
      const pIdB = cable.to.portId;
      const pNumB = String(pIdB).replace(/\D+/g, '');
      if (isStandard) {
        delete devB.portsConfig[pIdB];
        if (pNumB) {
          delete devB.portsConfig[pNumB];
          delete devB.portsConfig['p' + pNumB];
          delete devB.portsConfig['pt' + pNumB];
          delete devB.portsConfig['lc' + pNumB];
          delete devB.portsConfig['sc' + pNumB];
        }
        delete devB.portsConfig['p' + pIdB];
      } else {
        const existingB = devB.portsConfig[pIdB] || (pNumB && devB.portsConfig[pNumB]) || {};
        const cfg = {
          ...existingB,
          role: roleKey,
          isTrunk: isTrunkRole,
          color: resolvedColor,
          autoCableColor: true
        };
        delete devB.portsConfig['p' + pIdB];
        devB.portsConfig[pIdB] = cfg;
        if (pNumB) {
          devB.portsConfig[pNumB] = cfg;
          devB.portsConfig['p' + pNumB] = cfg;
          if (String(pIdB).startsWith('pt')) devB.portsConfig['pt' + pNumB] = cfg;
          if (String(pIdB).startsWith('lc')) devB.portsConfig['lc' + pNumB] = cfg;
          if (String(pIdB).startsWith('sc')) devB.portsConfig['sc' + pNumB] = cfg;
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

  RS.setConnectionRole = setConnectionRole;
  RS.showRolePickerPopover = showRolePickerPopover;
})();
