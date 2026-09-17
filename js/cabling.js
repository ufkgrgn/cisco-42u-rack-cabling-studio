import { STATE, ZOOM_STATE, dom, getActiveRack } from './state.js';
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

function getActiveDRingOrganizers(activeRack) {
  if (!activeRack || !activeRack.devices) return [];
  return activeRack.devices.filter(dev => {
    const cat = HARDWARE_CATALOG[dev.catalogKey];
    return cat && (dev.catalogKey === 'organizer-dring-1u' || (cat.modelTag && cat.modelTag.includes('D-RING')) || (cat.name && cat.name.toLowerCase().includes('d-ring')));
  });
}

function findInterveningDRing(activeRack, devA, devB) {
  const drings = getActiveDRingOrganizers(activeRack);
  if (!drings.length || !devA || !devB) return null;

  const topA = Number(devA.topU);
  const botA = topA - Number(devA.uHeight || 1) + 1;
  const topB = Number(devB.topU);
  const botB = topB - Number(devB.uHeight || 1) + 1;

  const minU = Math.min(botA, botB);
  const maxU = Math.max(topA, topB);

  const between = drings.find(org => {
    const orgTop = Number(org.topU);
    return orgTop < maxU && orgTop >= minU;
  });
  if (between) return between;

  const higherDev = topA >= topB ? devA : devB;
  const directlyBelow = drings.find(org => Number(org.topU) === Number(higherDev.topU) - Number(higherDev.uHeight || 1));
  if (directlyBelow) return directlyBelow;

  return null;
}

function getDRingBracketCoords(organizer, contRect, curScale) {
  const el = document.getElementById(organizer.instanceId);
  if (!el) return [];
  const brackets = el.querySelectorAll('.dring-bracket');
  if (!brackets || !brackets.length) return [];
  const coords = [];
  brackets.forEach((bEl, idx) => {
    const rect = bEl.getBoundingClientRect();
    coords.push({
      index: idx,
      x: (rect.left + rect.width / 2 - (contRect.left + 8 * curScale)) / curScale,
      y: (rect.top + rect.height / 2 - (contRect.top + 8 * curScale)) / curScale,
      width: rect.width / curScale,
      height: rect.height / curScale
    });
  });
  return coords;
}

function renderDRingOverlays(activeRack, contRect, curScale) {
  if (!dom.dringOverlayGroup) return;
  dom.dringOverlayGroup.innerHTML = '';
  const drings = getActiveDRingOrganizers(activeRack);
  if (!drings.length) return;

  drings.forEach(org => {
    const coords = getDRingBracketCoords(org, contRect, curScale);
    coords.forEach(bracket => {
      const loopW = 38;
      const loopH = 27;
      const loopX = bracket.x - loopW / 2;
      const loopY = bracket.y - loopH / 2;

      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', 'dring-svg-bracket');
      g.setAttribute('style', 'pointer-events:none;');

      const rectLoop = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rectLoop.setAttribute('x', loopX);
      rectLoop.setAttribute('y', loopY);
      rectLoop.setAttribute('width', loopW);
      rectLoop.setAttribute('height', loopH);
      rectLoop.setAttribute('rx', '5');
      rectLoop.setAttribute('fill', 'none');
      rectLoop.setAttribute('stroke', 'url(#dring-front-grad)');
      rectLoop.setAttribute('stroke-width', '4.5');
      rectLoop.setAttribute('filter', 'drop-shadow(0 4px 6px rgba(0,0,0,0.85))');
      g.appendChild(rectLoop);

      const clip = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      clip.setAttribute('x', loopX + 14);
      clip.setAttribute('y', loopY - 1.5);
      clip.setAttribute('width', '10');
      clip.setAttribute('height', '2.5');
      clip.setAttribute('rx', '1');
      clip.setAttribute('fill', 'url(#dring-clip-grad)');
      g.appendChild(clip);

      const highlight = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      highlight.setAttribute('x', loopX + 2);
      highlight.setAttribute('y', loopY);
      highlight.setAttribute('width', loopW - 4);
      highlight.setAttribute('height', '1.2');
      highlight.setAttribute('rx', '0.6');
      highlight.setAttribute('fill', 'rgba(255, 255, 255, 0.55)');
      g.appendChild(highlight);

      dom.dringOverlayGroup.appendChild(g);
    });
  });
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
  const dringUsageMap = new Map();
  const activeRack = getActiveRack ? getActiveRack() : (STATE.racks && STATE.racks[0]);

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
    if (!rectA || !rectB) return;
    if (rectA.width === 0 && rectA.height === 0 && rectB.width === 0 && rectB.height === 0) return;

    // 8px is rack-container outer border
    const x1 = (rectA.left + rectA.width / 2 - (contRect.left + 8 * curScale)) / curScale;
    const y1 = (rectA.top + rectA.height / 2 - (contRect.top + 8 * curScale)) / curScale;
    const x2 = (rectB.left + rectB.width / 2 - (contRect.left + 8 * curScale)) / curScale;
    const y2 = (rectB.top + rectB.height / 2 - (contRect.top + 8 * curScale)) / curScale;

    const dy = Math.abs(y2 - y1);
    const dx = Math.abs(x2 - x1);

    let pathD = '';

    if (STATE.cableRoutingMode === 'structured') {
      const devA = activeRack?.devices.find(d => d.instanceId === instA);
      const devB = activeRack?.devices.find(d => d.instanceId === instB);
      const dringOrg = findInterveningDRing(activeRack, devA, devB);
      const brackets = dringOrg ? getDRingBracketCoords(dringOrg, contRect, curScale) : [];

      if (brackets.length) {
        const targetX = (x1 + x2) / 2;
        let closestBracket = brackets[0];
        let minDist = Math.abs(brackets[0].x - targetX);
        brackets.forEach(b => {
          const dist = Math.abs(b.x - targetX);
          if (dist < minDist) {
            minDist = dist;
            closestBracket = b;
          }
        });

        const ringKey = `${dringOrg.instanceId}_${closestBracket.index}`;
        if (!dringUsageMap.has(ringKey)) dringUsageMap.set(ringKey, 0);
        const usageIdx = dringUsageMap.get(ringKey);
        dringUsageMap.set(ringKey, usageIdx + 1);
        const bundleSpread = ((usageIdx % 5) - 2) * 2.2;

        const rx = closestBracket.x + bundleSpread;
        const ry = closestBracket.y;

        const isY1Top = y1 <= y2;
        const topX = isY1Top ? x1 : x2;
        const topY = isY1Top ? y1 : y2;
        const botX = isY1Top ? x2 : x1;
        const botY = isY1Top ? y2 : y1;

        const dyTop = Math.abs(ry - topY);
        const dyBot = Math.abs(botY - ry);

        pathD = `M ${topX} ${topY} ` +
                `C ${topX} ${topY + dyTop * 0.45}, ${rx} ${ry - dyTop * 0.45}, ${rx} ${ry} ` +
                `C ${rx} ${ry + dyBot * 0.45}, ${botX} ${botY - dyBot * 0.45}, ${botX} ${botY}`;
      } else if (dy <= 45) {
        // 1. Adjacent / near units (<= 45px vertical delta, within ~1U/2U):
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

    // Calculate mid-span position for Cable Labeling
    let midX = (x1 + x2) / 2;
    let midY = (y1 + y2) / 2;
    try {
      if (typeof path.getTotalLength === 'function') {
        const totalLen = path.getTotalLength();
        if (totalLen > 0) {
          const pt = path.getPointAtLength(totalLen / 2);
          midX = pt.x;
          midY = pt.y;
        }
      }
    } catch (_) {}

    // Cable Label Group (Crisp 2D Label Badge)
    const labelGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    labelGroup.setAttribute('class', `cable-label-group ${cable.id === STATE.highlightedCableId ? 'highlighted' : ''}`);
    labelGroup.setAttribute('id', `svg-cable-label-${cable.id}`);
    labelGroup.setAttribute('transform', `translate(${midX}, ${midY})`);

    const labelTextStr = cable.name || cable.id;
    const labelWidth = Math.max(46, labelTextStr.length * 6.5 + 12);
    const labelHeight = 15;

    const labelBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    labelBg.setAttribute('x', -labelWidth / 2);
    labelBg.setAttribute('y', -labelHeight / 2);
    labelBg.setAttribute('width', labelWidth);
    labelBg.setAttribute('height', labelHeight);
    labelBg.setAttribute('rx', '3');
    labelBg.setAttribute('ry', '3');
    labelBg.setAttribute('class', 'cable-label-bg');
    labelBg.setAttribute('stroke', cable.color);

    const labelText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    labelText.setAttribute('class', 'cable-label-text');
    labelText.setAttribute('text-anchor', 'middle');
    labelText.setAttribute('dominant-baseline', 'central');
    labelText.setAttribute('y', '0.5');
    labelText.textContent = labelTextStr;

    labelGroup.appendChild(labelBg);
    labelGroup.appendChild(labelText);

    labelGroup.addEventListener('click', (e) => {
      e.stopPropagation();
      highlightCable(cable.id);
    });

    labelGroup.addEventListener('mouseenter', (e) => {
      const devA = STATE.devices.find(d => d.instanceId === cable.from.instanceId);
      const devB = STATE.devices.find(d => d.instanceId === cable.to.instanceId);
      if (!devA || !devB) return;
      const catA = HARDWARE_CATALOG[devA.catalogKey];
      const catB = HARDWARE_CATALOG[devB.catalogKey];
      const pA = catA?.ports?.find(p => p.id === cable.from.portId);
      const pB = catB?.ports?.find(p => p.id === cable.to.portId);

      dom.tooltip.style.display = 'block';
      dom.tooltip.style.left = `${e.clientX + 10}px`;
      dom.tooltip.style.top = `${e.clientY - 10}px`;
      dom.tooltip.innerHTML = `
        <b>${cable.id}</b> ${cable.name ? `(${cable.name})` : ''} - ${cable.lengthMeters}m<br>
        <span style="color:${cable.color};">&#9632;</span> ${catA?.modelTag || 'Dev'} [${pA?.name || cable.from.portId}] &harr; ${catB?.modelTag || 'Dev'} [${pB?.name || cable.to.portId}]
      `;
    });

    labelGroup.addEventListener('mouseleave', () => {
      dom.tooltip.style.display = 'none';
    });

    dom.cablesGroup.appendChild(labelGroup);

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

  renderDRingOverlays(activeRack, contRect, curScale);
}

export function highlightCable(cableId) {
  STATE.highlightedCableId = (STATE.highlightedCableId === cableId) ? null : cableId;

  document.querySelectorAll('.cable-path').forEach(p => {
    p.classList.remove('highlighted');
  });
  document.querySelectorAll('.cable-label-group').forEach(lg => {
    lg.classList.remove('highlighted');
  });

  if (STATE.highlightedCableId) {
    const p = document.getElementById(`svg-cable-${STATE.highlightedCableId}`);
    if (p) p.classList.add('highlighted');
    const lg = document.getElementById(`svg-cable-label-${STATE.highlightedCableId}`);
    if (lg) lg.classList.add('highlighted');
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
