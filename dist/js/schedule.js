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

  STATE.cables.forEach(c => {
    const devA = STATE.devices.find(d => d.instanceId === c.from.instanceId);
    const devB = STATE.devices.find(d => d.instanceId === c.to.instanceId);
    if (!devA || !devB) return;

    const catA = HARDWARE_CATALOG[devA.catalogKey];
    const catB = HARDWARE_CATALOG[devB.catalogKey];
    const portA = catA.ports.find(p => p.id === c.from.portId);
    const portB = catB.ports.find(p => p.id === c.to.portId);

    const tr = document.createElement('tr');
    tr.dataset.cableId = c.id;
    if (c.id === STATE.highlightedCableId) tr.className = 'active';

    tr.innerHTML = `
      <td>
        <span class="cable-color-dot" style="background:${c.color};"></span>
        <b>${c.id}</b>
      </td>
      <td>U${devA.topU} - ${portA.name}</td>
      <td>U${devB.topU} - ${portB.name}</td>
      <td>${c.lengthMeters}m</td>
      <td>
        <button class="del-cable-btn" data-cable-id="${c.id}" title="Kabloyu Sil">&#10005;</button>
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
