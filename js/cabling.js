import { STATE, ZOOM_STATE, dom } from './state.js';
import { HARDWARE_CATALOG } from './catalog.js';

export function cancelPendingConnection() {
  if (STATE.pendingConnection && STATE.pendingConnection.element) {
    STATE.pendingConnection.element.classList.remove('selected');
  }
  STATE.pendingConnection = null;
  if (dom.connectionStatusHint) {
    dom.connectionStatusHint.innerHTML = 'Bağlamak için <b>Kaynak Porta</b> tıklayın';
  }
}

export function renderAllCables() {
  if (!dom.cablesGroup) return;
  dom.cablesGroup.innerHTML = '';
  if (dom.connectorsGroup) dom.connectorsGroup.innerHTML = '';

  const contRect = dom.rackContainer.getBoundingClientRect();
  const curScale = ZOOM_STATE.scale || 1.0;

  // Counters to space parallel cables in left and right vertical channels
  let leftChannelUsage = 0;
  let rightChannelUsage = 0;

  STATE.cables.forEach((cable) => {
    const instA = cable.from.instanceId || cable.from.deviceId;
    const instB = cable.to.instanceId || cable.to.deviceId;
    const portIdA = cable.from.portId || ('p' + cable.from.portIdx);
    const portIdB = cable.to.portId || ('p' + cable.to.portIdx);

    let portFromEl = document.getElementById(`port-${instA}-${portIdA}`);
    let portToEl = document.getElementById(`port-${instB}-${portIdB}`);

    if (!portFromEl) {
      portFromEl = document.querySelector(`.port[data-instance-id="${instA}"][data-port-id="${portIdA}"]`) ||
                   document.querySelector(`.port[data-instance-id="${instA}"]`);
    }
    if (!portToEl) {
      portToEl = document.querySelector(`.port[data-instance-id="${instB}"][data-port-id="${portIdB}"]`) ||
                 document.querySelector(`.port[data-instance-id="${instB}"]`);
    }

    if (!portFromEl || !portToEl) return;

    const rectA = portFromEl.getBoundingClientRect();
    const rectB = portToEl.getBoundingClientRect();

    // 8px is rack-container outer border
    const x1 = (rectA.left + rectA.width / 2 - (contRect.left + 8 * curScale)) / curScale;
    const y1 = (rectA.top + rectA.height / 2 - (contRect.top + 8 * curScale)) / curScale;
    const x2 = (rectB.left + rectB.width / 2 - (contRect.left + 8 * curScale)) / curScale;
    const y2 = (rectB.top + rectB.height / 2 - (contRect.top + 8 * curScale)) / curScale;

    const dy = Math.abs(y2 - y1);
    const dx = Math.abs(x2 - x1);

    let pathD = '';

    if (STATE.cableRoutingMode === 'structured') {
      // STRUCTURED ENTERPRISE CABLING
      // 1. Adjacent / near units (<= 45px vertical delta, within ~1U/2U):
      if (dy <= 45) {
        const ymid = (y1 + y2) / 2;
        if (dx < 10) {
          // Same vertical column: neat outward side loop
          const loopSide = x1 > 300 ? 12 : -12;
          pathD = `M ${x1} ${y1} C ${x1 + loopSide} ${y1}, ${x2 + loopSide} ${y2}, ${x2} ${y2}`;
        } else {
          // Clean tight S-curve patch strictly between the two device slots (no droop!)
          pathD = `M ${x1} ${y1} C ${x1} ${ymid}, ${x2} ${ymid}, ${x2} ${y2}`;
        }
      } else {
        // 2. Inter-U distant run: route through Left or Right vertical cable management channel
        const useRightChannel = ((x1 + x2) / 2) > 309;
        const channelBase = useRightChannel ? 595 : 23;
        const bundleIdx = useRightChannel ? rightChannelUsage++ : leftChannelUsage++;
        // Parallel bundle offset
        const channelX = channelBase + ((bundleIdx % 6) - 2.5) * 3.4;

        const r = 12; // smooth 90deg corner bend radius
        const isY1Top = y1 <= y2;
        const topY = isY1Top ? y1 : y2;
        const botY = isY1Top ? y2 : y1;
        const topX = isY1Top ? x1 : x2;
        const botX = isY1Top ? x2 : x1;

        if (useRightChannel) {
          pathD = `M ${topX} ${topY} ` +
                  `L ${channelX - r} ${topY} ` +
                  `Q ${channelX} ${topY} ${channelX} ${topY + r} ` +
                  `L ${channelX} ${botY - r} ` +
                  `Q ${channelX} ${botY} ${channelX - r} ${botY} ` +
                  `L ${botX} ${botY}`;
        } else {
          pathD = `M ${topX} ${topY} ` +
                  `L ${channelX + r} ${topY} ` +
                  `Q ${channelX} ${topY} ${channelX} ${topY + r} ` +
                  `L ${channelX} ${botY - r} ` +
                  `Q ${channelX} ${botY} ${channelX + r} ${botY} ` +
                  `L ${botX} ${botY}`;
        }
      }
    } else {
      // DIRECT TIGHT MODE:
      // Low-sag disciplined catenary (strictly bounded, never 180px sag)
      const ymid = (y1 + y2) / 2;
      const tightSag = Math.min(22, Math.max(8, dy * 0.12));
      const cp1x = x1 + (x2 - x1) * 0.25;
      const cp1y = ymid + (y2 >= y1 ? tightSag : -tightSag);
      const cp2x = x1 + (x2 - x1) * 0.75;
      const cp2y = ymid + (y2 >= y1 ? tightSag : -tightSag);
      pathD = `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;
    }

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathD);
    path.setAttribute('stroke', cable.color);
    path.setAttribute('stroke-width', '2.6');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    path.setAttribute('class', `cable-path ${cable.id === STATE.highlightedCableId ? 'highlighted' : ''}`);
    path.setAttribute('id', `svg-cable-${cable.id}`);
    path.setAttribute('filter', 'url(#cable-shadow)');

    path.addEventListener('click', (e) => {
      e.stopPropagation();
      highlightCable(cable.id);
    });

    path.addEventListener('mouseenter', (e) => {
      const devA = STATE.devices.find(d => d.instanceId === cable.from.instanceId);
      const devB = STATE.devices.find(d => d.instanceId === cable.to.instanceId);
      if (!devA || !devB) return;
      const catA = HARDWARE_CATALOG[devA.catalogKey];
      const catB = HARDWARE_CATALOG[devB.catalogKey];
      const pA = catA.ports.find(p => p.id === cable.from.portId);
      const pB = catB.ports.find(p => p.id === cable.to.portId);

      dom.tooltip.style.display = 'block';
      dom.tooltip.style.left = `${e.clientX + 10}px`;
      dom.tooltip.style.top = `${e.clientY - 10}px`;
      dom.tooltip.innerHTML = `
        <b>${cable.id}</b> (${cable.lengthMeters}m)<br>
        <span style="color:${cable.color};">&#9632;</span> ${catA.modelTag} [${pA.name}] &harr; ${catB.modelTag} [${pB.name}]
      `;
    });

    path.addEventListener('mouseleave', () => {
      dom.tooltip.style.display = 'none';
    });

    dom.cablesGroup.appendChild(path);

    // Render realistic connector terminal plugs at port jacks
    if (dom.connectorsGroup) {
      const bootA = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      bootA.setAttribute('cx', x1);
      bootA.setAttribute('cy', y1);
      bootA.setAttribute('r', '3');
      bootA.setAttribute('fill', '#0c101a');
      bootA.setAttribute('stroke', cable.color);
      bootA.setAttribute('stroke-width', '1.6');
      bootA.setAttribute('class', 'cable-boot');

      const bootB = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      bootB.setAttribute('cx', x2);
      bootB.setAttribute('cy', y2);
      bootB.setAttribute('r', '3');
      bootB.setAttribute('fill', '#0c101a');
      bootB.setAttribute('stroke', cable.color);
      bootB.setAttribute('stroke-width', '1.6');
      bootB.setAttribute('class', 'cable-boot');

      dom.connectorsGroup.appendChild(bootA);
      dom.connectorsGroup.appendChild(bootB);
    }
  });
}

export function highlightCable(cableId) {
  STATE.highlightedCableId = (STATE.highlightedCableId === cableId) ? null : cableId;

  document.querySelectorAll('.cable-path').forEach(p => {
    p.classList.remove('highlighted');
  });
  if (STATE.highlightedCableId) {
    const p = document.getElementById(`svg-cable-${STATE.highlightedCableId}`);
    if (p) p.classList.add('highlighted');
  }

  document.querySelectorAll('#schedule-tbody tr').forEach(row => {
    row.classList.toggle('active', row.dataset.cableId === STATE.highlightedCableId);
  });
}

export function addDirectCable(instA, portA, instB, portB, color, lengthMeters) {
  STATE.cables.push({
    id: 'CBL-' + String(STATE.cables.length + 1).padStart(3, '0'),
    from: { instanceId: instA, portId: portA },
    to: { instanceId: instB, portId: portB },
    color: color || '#2563eb',
    lengthMeters: lengthMeters || 1.5
  });
}
