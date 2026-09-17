import { STATE, dom } from './state.js';
import { HARDWARE_CATALOG } from './catalog.js';
import { highlightCable, renderAllCables } from './cabling.js';
import { renderMountedDevices } from './rack.js';

export function renderScheduleTable() {
  if (!dom.scheduleTbody) return;
  dom.scheduleTbody.innerHTML = '';
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

  function escapeHtml(str) {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  STATE.cables.forEach(c => {
    const rackA = STATE.racks?.find(r => r.id === c.from.rackId) || { id: 'rack-1', name: 'MDF', devices: STATE.devices || [] };
    const rackB = STATE.racks?.find(r => r.id === c.to.rackId) || { id: 'rack-1', name: 'MDF', devices: STATE.devices || [] };
    const devA = rackA.devices?.find(d => d.instanceId === c.from.instanceId) || STATE.devices?.find(d => d.instanceId === c.from.instanceId);
    const devB = rackB.devices?.find(d => d.instanceId === c.to.instanceId) || STATE.devices?.find(d => d.instanceId === c.to.instanceId);
    if (!devA || !devB) return;

    const catA = HARDWARE_CATALOG[devA.catalogKey];
    const catB = HARDWARE_CATALOG[devB.catalogKey];
    const portA = catA ? catA.ports.find(p => p.id === c.from.portId) : null;
    const portB = catB ? catB.ports.find(p => p.id === c.to.portId) : null;

    const isInterRack = c.from.rackId && c.to.rackId && c.from.rackId !== c.to.rackId;
    const rackShortA = rackA.name ? (rackA.name.length > 10 ? rackA.name.slice(0, 10) + '…' : rackA.name) : 'Kabin';
    const rackShortB = rackB.name ? (rackB.name.length > 10 ? rackB.name.slice(0, 10) + '…' : rackB.name) : 'Kabin';

    let roleBadge = '';
    const portRole = (c.role || (portA && portA.role) || (portB && portB.role) || '').toLowerCase();
    if (portRole === 'trunk') {
      roleBadge = '<span class="role-pill trunk">TRUNK</span>';
    } else if (portRole === 'poe') {
      roleBadge = '<span class="role-pill poe">PoE</span>';
    } else if (portRole === 'uplink') {
      roleBadge = '<span class="role-pill uplink">UPLINK</span>';
    }

    const portTypeA = portA?.type === 'fiber' || portA?.type === 'lc' || portA?.type === 'sfp' ? 'fiber' : 'copper';
    const portTypeB = portB?.type === 'fiber' || portB?.type === 'lc' || portB?.type === 'sfp' ? 'fiber' : 'copper';

    const tr = document.createElement('tr');
    tr.dataset.cableId = c.id;
    if (c.id === STATE.highlightedCableId) tr.className = 'active';

    tr.innerHTML = `
      <td>
        <div class="cable-pill-cell">
          <span class="cable-color-dot" style="background:${c.color};box-shadow:0 0 6px ${c.color};"></span>
          <span class="cable-id-badge">${escapeHtml(c.name || c.id)}</span>
          ${roleBadge}
        </div>
      </td>
      <td>
        <div class="endpoint-cell">
          ${isInterRack ? `<span class="inter-rack-badge" title="${escapeHtml(rackA.name)}">${escapeHtml(rackShortA)}</span>` : ''}
          <div class="endpoint-badge" title="${escapeHtml(catA ? catA.name : '')} - ${escapeHtml(portA ? portA.name : '')}">
            <span class="badge-u">U${devA ? devA.topU : '?'}</span>
            <span class="badge-port ${portTypeA}">${escapeHtml(portA ? portA.name : c.from.portId)}</span>
          </div>
        </div>
      </td>
      <td>
        <div class="endpoint-cell">
          <span class="endpoint-arrow" aria-hidden="true">→</span>
          ${isInterRack ? `<span class="inter-rack-badge" title="${escapeHtml(rackB.name)}">${escapeHtml(rackShortB)}</span>` : ''}
          <div class="endpoint-badge" title="${escapeHtml(catB ? catB.name : '')} - ${escapeHtml(portB ? portB.name : '')}">
            <span class="badge-u">U${devB ? devB.topU : '?'}</span>
            <span class="badge-port ${portTypeB}">${escapeHtml(portB ? portB.name : c.to.portId)}</span>
          </div>
        </div>
      </td>
      <td><span class="metraj-badge">${c.lengthMeters}m</span></td>
      <td>
        <button class="del-cable-btn" data-cable-id="${c.id}" title="Kabloyu Sök (Delete)">✂️</button>
      </td>
    `;

    tr.addEventListener('click', (e) => {
      if (e.target.closest('.del-cable-btn')) return;
      highlightCable(c.id);
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
