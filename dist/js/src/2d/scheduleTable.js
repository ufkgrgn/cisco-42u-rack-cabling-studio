/**
 * Cable Schedule Table Module
 */
import { STATE, dom } from './state.js';
import { HARDWARE_CATALOG } from './catalogData.js';
import { escapeHtml } from './utils.js';
import { renderAllCables, highlightCable, disconnectCable, renameCable2D } from './cablingEngine.js';
import { renderMountedDevices } from './rackRenderer.js';

// --- SCHEDULE TABLE MODULE ---
  function setConnectionRole(cableId, newRole) {
    const cable = STATE.cables.find(c => c.id === cableId);
    if (!cable) return;

    const ROLE_COLORS = {
      trunk: '#a855f7',
      uplink: '#00d2ff',
      poe: '#f59e0b',
      mgmt: '#10b981',
      management: '#10b981',
      standard: STATE.selectedCableColor || '#2563eb'
    };

    const isStandard = !newRole || newRole === 'standard' || newRole === 'access';
    const roleKey = isStandard ? null : newRole.toLowerCase();
    const resolvedColor = isStandard ? (STATE.selectedCableColor || '#2563eb') : (ROLE_COLORS[roleKey] || '#a855f7');

    cable.role = roleKey;
    cable.color = resolvedColor;

    if (roleKey === 'trunk') {
      if (!cable.name.startsWith('[TRUNK]')) {
        cable.name = `[TRUNK] ${cable.id}`;
      }
    } else {
      cable.name = (cable.name || '').replace(/^\[TRUNK\]\s*/i, '');
    }

    let devA = null, devB = null;
    (STATE.racks || []).forEach(r => {
      if (!devA) devA = r.devices?.find(d => d.instanceId === cable.from.instanceId);
      if (!devB) devB = r.devices?.find(d => d.instanceId === cable.to.instanceId);
    });

    if (devA) {
      if (!devA.portsConfig) devA.portsConfig = {};
      const pIdA = cable.from.portId;
      const pNumA = String(pIdA).replace('p', '');
      if (isStandard) {
        delete devA.portsConfig[pIdA];
        delete devA.portsConfig[pNumA];
      } else {
        const cfg = { role: roleKey, isTrunk: roleKey === 'trunk', color: resolvedColor, autoCableColor: true };
        devA.portsConfig[pIdA] = cfg;
        devA.portsConfig[pNumA] = cfg;
      }
    }

    if (devB) {
      if (!devB.portsConfig) devB.portsConfig = {};
      const pIdB = cable.to.portId;
      const pNumB = String(pIdB).replace('p', '');
      if (isStandard) {
        delete devB.portsConfig[pIdB];
        delete devB.portsConfig[pNumB];
      } else {
        const cfg = { role: roleKey, isTrunk: roleKey === 'trunk', color: resolvedColor, autoCableColor: true };
        devB.portsConfig[pIdB] = cfg;
        devB.portsConfig[pNumB] = cfg;
      }
    }

    if (window.__STUDIO3D__ && window.__STUDIO3D__.updatePortConfig) {
      try {
        const portIdxA = parseInt(String(cable.from.portId).replace('p', ''), 10) || 1;
        const portIdxB = parseInt(String(cable.to.portId).replace('p', ''), 10) || 1;
        const dev3DA = devA?.id || devA?.instanceId;
        const dev3DB = devB?.id || devB?.instanceId;
        if (dev3DA) window.__STUDIO3D__.updatePortConfig(dev3DA, portIdxA, isStandard ? null : { role: roleKey, isTrunk: roleKey === 'trunk', color: resolvedColor });
        if (dev3DB) window.__STUDIO3D__.updatePortConfig(dev3DB, portIdxB, isStandard ? null : { role: roleKey, isTrunk: roleKey === 'trunk', color: resolvedColor });
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
    window.dispatchEvent(new CustomEvent('rackstudio:refresh'));
  }

  function showRolePickerPopover(triggerBtn, cableId, currentRole) {
    document.querySelectorAll('.role-picker-popover').forEach(p => p.remove());

    const popover = document.createElement('div');
    popover.className = 'role-picker-popover';
    popover.innerHTML = `
      <div class="role-picker-title">Bağlantı Rolü &amp; Renk</div>
      <div class="role-picker-item ${currentRole === 'trunk' ? 'active' : ''}" data-role="trunk">
        <span class="role-badge-preview trunk">T</span>
        <div class="role-text-group">
          <span class="role-label">TRUNK (802.1Q)</span>
          <span class="role-hint">Mor (#a855f7) · VLAN Omurga</span>
        </div>
      </div>
      <div class="role-picker-item ${currentRole === 'uplink' ? 'active' : ''}" data-role="uplink">
        <span class="role-badge-preview uplink">▲</span>
        <div class="role-text-group">
          <span class="role-label">UPLINK (Core/Dist)</span>
          <span class="role-hint">Cyan (#00d2ff) · Üst Çıkış</span>
        </div>
      </div>
      <div class="role-picker-item ${currentRole === 'poe' ? 'active' : ''}" data-role="poe">
        <span class="role-badge-preview poe">⚡</span>
        <div class="role-text-group">
          <span class="role-label">PoE (802.3af/at)</span>
          <span class="role-hint">Kehribar (#f59e0b) · Güç</span>
        </div>
      </div>
      <div class="role-picker-item ${currentRole === 'mgmt' || currentRole === 'management' ? 'active' : ''}" data-role="mgmt">
        <span class="role-badge-preview mgmt">M</span>
        <div class="role-text-group">
          <span class="role-label">MGMT (Yönetim)</span>
          <span class="role-hint">Yeşil (#10b981) · OOB Portu</span>
        </div>
      </div>
      <div class="role-picker-sep"></div>
      <div class="role-picker-item ${!currentRole || currentRole === 'standard' ? 'active' : ''}" data-role="standard">
        <span class="role-badge-preview standard">—</span>
        <div class="role-text-group">
          <span class="role-label">Standart Bağlantı</span>
          <span class="role-hint">Özel Rolü Sıfırla · Standart Mavi</span>
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

  let schedulePage = 0;
  const SCHEDULE_PAGE_SIZE = 100;
  function renderScheduleTable() {
    if (!dom.scheduleTbody) return;
    dom.scheduleTbody.innerHTML = '';
    let pager = document.getElementById('schedule-pagination');
    if (!pager) {
      pager = document.createElement('div'); pager.id = 'schedule-pagination';
      pager.style.cssText = 'display:flex;gap:8px;align-items:center;padding:8px;font-size:12px;';
      const previous = document.createElement('button'); previous.type = 'button'; previous.textContent = '← Önceki';
      const label = document.createElement('span'); label.className = 'schedule-page-label'; label.setAttribute('aria-live','polite');
      const next = document.createElement('button'); next.type = 'button'; next.textContent = 'Sonraki →';
      previous.addEventListener('click', () => { schedulePage--; renderScheduleTable(); });
      next.addEventListener('click', () => { schedulePage++; renderScheduleTable(); });
      pager.append(previous,label,next);
      dom.scheduleTbody.closest('table').before(pager);
    }
    const pages = Math.max(1, Math.ceil(STATE.cables.length / SCHEDULE_PAGE_SIZE));
    schedulePage = Math.max(0, Math.min(schedulePage, pages - 1));
    pager.querySelector('.schedule-page-label').textContent = (schedulePage + 1) + ' / ' + pages + ' · ' + STATE.cables.length + ' bağlantı';
    pager.firstElementChild.disabled = schedulePage === 0;
    pager.lastElementChild.disabled = schedulePage === pages - 1;
    if (dom.cableCountLabel) {
      dom.cableCountLabel.textContent = `${STATE.cables.length} Bağlantı Yapıldı`;
    }

    if (STATE.cables.length === 0) {
      dom.scheduleTbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center; color:#64748b; padding:20px;">
            Henüz kablo bağlantısı yapılmadı.
          </td>
        </tr>
      `;
      return;
    }

    STATE.cables.slice(schedulePage * SCHEDULE_PAGE_SIZE, (schedulePage + 1) * SCHEDULE_PAGE_SIZE).forEach(c => {
      const rackA = STATE.racks.find(r => r.id === c.from.rackId);
      const rackB = STATE.racks.find(r => r.id === c.to.rackId);
      const devA = rackA ? rackA.devices.find(d => d.instanceId === c.from.instanceId) : null;
      const devB = rackB ? rackB.devices.find(d => d.instanceId === c.to.instanceId) : null;

      const catA = devA ? HARDWARE_CATALOG[devA.catalogKey] : null;
      const catB = devB ? HARDWARE_CATALOG[devB.catalogKey] : null;
      const portA = catA ? catA.ports.find(p => p.id === c.from.portId) : null;
      const portB = catB ? catB.ports.find(p => p.id === c.to.portId) : null;

      const isInterRack = c.from.rackId !== c.to.rackId;

      const tr = document.createElement('tr');
      tr.dataset.cableId = c.id;
      if (c.id === STATE.highlightedCableId) tr.className = 'active';

      const rackShortA = rackA ? (rackA.name.length > 10 ? rackA.name.slice(0, 10) + '…' : rackA.name) : 'Kabin';
      const rackShortB = rackB ? (rackB.name.length > 10 ? rackB.name.slice(0, 10) + '…' : rackB.name) : 'Kabin';

      const sourcePortCfg = devA?.portsConfig && (devA.portsConfig[c.from.portId] || devA.portsConfig[String(c.from.portId).replace('p', '')]);
      const targetPortCfg = devB?.portsConfig && (devB.portsConfig[c.to.portId] || devB.portsConfig[String(c.to.portId).replace('p', '')]);
      const portRole = (c.role || (sourcePortCfg && sourcePortCfg.role) || (targetPortCfg && targetPortCfg.role) || (portA && portA.role) || (portB && portB.role) || '').toLowerCase();

      let roleTriggerHtml = '';
      if (portRole === 'trunk') {
        roleTriggerHtml = `<button type="button" class="role-select-trigger trunk" data-cable-id="${c.id}" title="Bağlantı Rolünü Değiştir"><span class="role-tag">T</span>TRUNK ▾</button>`;
      } else if (portRole === 'uplink') {
        roleTriggerHtml = `<button type="button" class="role-select-trigger uplink" data-cable-id="${c.id}" title="Bağlantı Rolünü Değiştir"><span class="role-tag">▲</span>UPLINK ▾</button>`;
      } else if (portRole === 'poe') {
        roleTriggerHtml = `<button type="button" class="role-select-trigger poe" data-cable-id="${c.id}" title="Bağlantı Rolünü Değiştir"><span class="role-tag">⚡</span>PoE ▾</button>`;
      } else if (portRole === 'mgmt' || portRole === 'management') {
        roleTriggerHtml = `<button type="button" class="role-select-trigger mgmt" data-cable-id="${c.id}" title="Bağlantı Rolünü Değiştir"><span class="role-tag">M</span>MGMT ▾</button>`;
      } else {
        roleTriggerHtml = `<button type="button" class="role-select-trigger standard" data-cable-id="${c.id}" title="Özel Rol Tanımla"><span class="role-tag">+</span>Rol Ata ▾</button>`;
      }

      const portTypeA = portA?.type === 'fiber' || portA?.type === 'lc' || portA?.type === 'sfp' ? 'fiber' : 'copper';
      const portTypeB = portB?.type === 'fiber' || portB?.type === 'lc' || portB?.type === 'sfp' ? 'fiber' : 'copper';

      const displayName = (c.name && !c.name.includes('→')) ? c.name : (c.id || c.name || 'CBL');

      tr.innerHTML = `
        <td>
          <div class="cable-pill-cell">
            <span class="cable-color-dot" style="background:${c.color};box-shadow:0 0 6px ${c.color};"></span>
            <span class="cable-id-badge" title="${escapeHtml(c.name || c.id)}">${escapeHtml(displayName)}</span>
          </div>
        </td>
        <td>
          <div class="route-flow-cell" title="${escapeHtml(catA ? catA.name : '')} (${escapeHtml(portA ? portA.name : c.from.portId)}) ➔ ${escapeHtml(catB ? catB.name : '')} (${escapeHtml(portB ? portB.name : c.to.portId)})">
            <div class="endpoint-badge clickable-endpoint" data-instance-id="${c.from.instanceId}" data-port-id="${c.from.portId}" title="Kaynak Port Ayarları / Odaklan">
              ${isInterRack && rackA ? `<span class="inter-rack-tag" title="${escapeHtml(rackA.name)}">${escapeHtml(rackShortA)}</span>` : ''}
              <span class="badge-u">U${devA ? devA.topU : '?'}</span>
              <span class="badge-port ${portTypeA}">${escapeHtml(portA ? portA.name : c.from.portId)}</span>
            </div>
            <span class="route-arrow" aria-hidden="true">➔</span>
            <div class="endpoint-badge clickable-endpoint" data-instance-id="${c.to.instanceId}" data-port-id="${c.to.portId}" title="Hedef Port Ayarları / Odaklan">
              ${isInterRack && rackB ? `<span class="inter-rack-tag" title="${escapeHtml(rackB.name)}">${escapeHtml(rackShortB)}</span>` : ''}
              <span class="badge-u">U${devB ? devB.topU : '?'}</span>
              <span class="badge-port ${portTypeB}">${escapeHtml(portB ? portB.name : c.to.portId)}</span>
            </div>
          </div>
        </td>
        <td>
          ${roleTriggerHtml}
        </td>
        <td><span class="metraj-badge">${c.lengthMeters}m</span></td>
        <td>
          <button class="del-cable-btn" data-cable-id="${c.id}" title="Kabloyu Sök (Delete)">✂️</button>
        </td>
      `;

      tr.addEventListener('click', (e) => {
        if (e.target.closest('.del-cable-btn') || e.target.closest('.role-select-trigger') || e.target.closest('.clickable-endpoint')) return;
        highlightCable(c.id);
      });

      tr.addEventListener('dblclick', (e) => {
        if (e.target.closest('.del-cable-btn') || e.target.closest('.role-select-trigger') || e.target.closest('.clickable-endpoint')) return;
        e.preventDefault();
        renameCable2D(c.id);
      });

      const roleBtn = tr.querySelector('.role-select-trigger');
      if (roleBtn) {
        roleBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          showRolePickerPopover(roleBtn, c.id, portRole);
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
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        STATE.cables = STATE.cables.filter(item => item.id !== c.id);
        if (STATE.highlightedCableId === c.id) STATE.highlightedCableId = null;
        renderMountedDevices();
        renderScheduleTable();
        renderAllCables();
      });

      dom.scheduleTbody.appendChild(tr);
    });
  }

export {
  setConnectionRole,
  showRolePickerPopover,
  renderScheduleTable
};
