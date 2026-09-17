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

function getActiveOrganizers(activeRack) {
  if (!activeRack || !activeRack.devices) return [];
  return activeRack.devices.filter(dev => {
    const cat = HARDWARE_CATALOG[dev.catalogKey];
    return cat && (
      dev.catalogKey.includes('organizer') ||
      (cat.modelTag && (cat.modelTag.includes('D-RING') || cat.modelTag.includes('ORGANIZER') || cat.modelTag.includes('DUCT') || cat.modelTag.includes('BRUSH'))) ||
      (cat.name && (cat.name.toLowerCase().includes('organizer') || cat.name.toLowerCase().includes('d-ring')))
    );
  });
}

function findDeviceOrganizer(activeRack, dev) {
  const orgs = getActiveOrganizers(activeRack);
  if (!orgs.length || !dev) return null;
  const devTop = Number(dev.topU);
  const devBot = devTop - Number(dev.uHeight || 1) + 1;

  // 1. Directly adjacent below
  const directlyBelow = orgs.find(org => Number(org.topU) === devBot - 1);
  if (directlyBelow) return directlyBelow;

  // 2. Directly adjacent above
  const directlyAbove = orgs.find(org => Number(org.topU) === devTop + 1);
  if (directlyAbove) return directlyAbove;

  // 3. Nearest organizer within 3U
  let nearest = null;
  let minDiff = Infinity;
  orgs.forEach(org => {
    const orgTop = Number(org.topU);
    const diff = Math.min(Math.abs(orgTop - devTop), Math.abs(orgTop - devBot));
    if (diff < minDiff && diff <= 3) {
      minDiff = diff;
      nearest = org;
    }
  });
  return nearest;
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
  const drings = getActiveOrganizers(activeRack).filter(dev => {
    const cat = HARDWARE_CATALOG[dev.catalogKey];
    return dev.catalogKey === 'organizer-dring-1u' || (cat && cat.modelTag && cat.modelTag.includes('D-RING')) || (cat && cat.name && cat.name.toLowerCase().includes('d-ring'));
  });
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

      // Left vertical pillar of D-Ring hoop
      const leftPillar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      leftPillar.setAttribute('x', loopX);
      leftPillar.setAttribute('y', loopY);
      leftPillar.setAttribute('width', '5.5');
      leftPillar.setAttribute('height', loopH);
      leftPillar.setAttribute('rx', '2.5');
      leftPillar.setAttribute('fill', 'url(#dring-front-grad)');
      leftPillar.setAttribute('filter', 'drop-shadow(0 3px 5px rgba(0,0,0,0.85))');
      g.appendChild(leftPillar);

      // Right vertical pillar of D-Ring hoop
      const rightPillar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rightPillar.setAttribute('x', loopX + loopW - 5.5);
      rightPillar.setAttribute('y', loopY);
      rightPillar.setAttribute('width', '5.5');
      rightPillar.setAttribute('height', loopH);
      rightPillar.setAttribute('rx', '2.5');
      rightPillar.setAttribute('fill', 'url(#dring-front-grad)');
      rightPillar.setAttribute('filter', 'drop-shadow(0 3px 5px rgba(0,0,0,0.85))');
      g.appendChild(rightPillar);

      // Top retention clip
      const clip = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      clip.setAttribute('x', loopX + 14);
      clip.setAttribute('y', loopY - 1.5);
      clip.setAttribute('width', '10');
      clip.setAttribute('height', '2.5');
      clip.setAttribute('rx', '1');
      clip.setAttribute('fill', 'url(#dring-clip-grad)');
      g.appendChild(clip);

      // Subtle metallic highlight across top
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

      if (instA === instB) {
        // Same device loopback
        const loopSide = x1 > 300 ? 12 : -12;
        pathD = `M ${x1} ${y1} C ${x1 + loopSide} ${y1}, ${x2 + loopSide} ${y2}, ${x2} ${y2}`;
      } else {
        // Structured datacenter cabling:
        // 1. Port A drops/rises vertically to Organizer A level
        // 2. Traverses horizontally through Organizer A to closest side rail
        // 3. Runs vertically in side rail duct to Organizer B level
        // 4. Traverses horizontally through Organizer B from side rail to Port B column
        // 5. Connects vertically into Port B

        const orgA = findDeviceOrganizer(activeRack, devA);
        const orgB = findDeviceOrganizer(activeRack, devB);

        const getOrgY = (org, fallbackY, otherY) => {
          if (org) {
            const orgEl = document.getElementById(org.instanceId);
            if (orgEl) {
              const r = orgEl.getBoundingClientRect();
              return (r.top + r.height / 2 - (contRect.top + 8 * curScale)) / curScale;
            }
          }
          return fallbackY + (otherY >= fallbackY ? 14 : -14);
        };

        let trayYA = getOrgY(orgA, y1, y2);
        let trayYB = getOrgY(orgB, y2, y1);

        // If both devices share the exact same organizer between them, split into upper and lower lanes
        if (orgA && orgB && orgA.instanceId === orgB.instanceId) {
          const orgCenterY = trayYA;
          const isATop = Number(devA?.topU || 0) >= Number(devB?.topU || 0);
          trayYA = orgCenterY + (isATop ? -6 : 6);
          trayYB = orgCenterY + (isATop ? 6 : -6);
        }

        // Side rail selection: left rail if on left half, right rail if on right half
        const avgX = (x1 + x2) / 2;
        const useRightChannel = (x1 >= 309 && x2 >= 309) || (avgX >= 309);
        const channelBase = useRightChannel ? 595 : 23;
        const bundleIdx = useRightChannel ? rightChannelUsage++ : leftChannelUsage++;

        // Space parallel cables neatly within vertical rail duct (44px rail width)
        const railOffset = ((bundleIdx % 7) - 3) * 2.8;
        const channelX = channelBase + railOffset;

        // Minor vertical jitter inside horizontal tray to form parallel wire bundles
        const trayOffsetA = ((bundleIdx % 5) - 2) * 1.5;
        const trayOffsetB = ((bundleIdx % 5) - 2) * 1.5;
        const actualTrayYA = trayYA + trayOffsetA;
        const actualTrayYB = trayYB + trayOffsetB;

        // 1. Vertical from (x1, y1) to (x1, actualTrayYA), then turn towards channelX
        const dirY1 = actualTrayYA >= y1 ? 1 : -1;
        const dirX1 = channelX >= x1 ? 1 : -1;
        const r1 = Math.min(8, Math.abs(channelX - x1) / 2, Math.abs(actualTrayYA - y1) / 2);

        // 2. From (channelX, actualTrayYA) turn into vertical side rail towards actualTrayYB
        const dirY_rail = actualTrayYB >= actualTrayYA ? 1 : -1;
        const distRailY = Math.abs(actualTrayYB - actualTrayYA);
        const rRail1 = Math.min(10, Math.abs(channelX - x1) / 2, distRailY / 2 || 6);

        // 3. From side rail at actualTrayYB, turn towards x2
        const dirX2 = x2 >= channelX ? 1 : -1;
        const rRail2 = Math.min(10, Math.abs(x2 - channelX) / 2, distRailY / 2 || 6);

        // 4. From actualTrayYB at x2, turn towards y2
        const dirY2 = y2 >= actualTrayYB ? 1 : -1;
        const r2 = Math.min(8, Math.abs(x2 - channelX) / 2, Math.abs(y2 - actualTrayYB) / 2);

        pathD = `M ${x1} ${y1} ` +
                `L ${x1} ${actualTrayYA - dirY1 * r1} ` +
                `Q ${x1} ${actualTrayYA} ${x1 + dirX1 * r1} ${actualTrayYA} ` +
                `L ${channelX - dirX1 * rRail1} ${actualTrayYA} ` +
                `Q ${channelX} ${actualTrayYA} ${channelX} ${actualTrayYA + dirY_rail * rRail1} ` +
                `L ${channelX} ${actualTrayYB - dirY_rail * rRail2} ` +
                `Q ${channelX} ${actualTrayYB} ${channelX + dirX2 * rRail2} ${actualTrayYB} ` +
                `L ${x2 - dirX2 * r2} ${actualTrayYB} ` +
                `Q ${x2} ${actualTrayYB} ${x2} ${actualTrayYB + dirY2 * r2} ` +
                `L ${x2} ${y2}`;
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
      showCableQuickHud(cable.id, e.clientX, e.clientY);
    });

    path.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      highlightCable(cable.id);
      showCableContextMenu(cable.id, e.clientX, e.clientY);
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
      showCableQuickHud(cable.id, e.clientX, e.clientY);
    });

    labelGroup.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      highlightCable(cable.id);
      showCableContextMenu(cable.id, e.clientX, e.clientY);
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
      bootA.style.cursor = 'pointer';
      bootA.addEventListener('click', (e) => {
        e.stopPropagation();
        highlightCable(cable.id);
        showCableQuickHud(cable.id, e.clientX, e.clientY);
      });

      const bootB = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      bootB.setAttribute('cx', x2);
      bootB.setAttribute('cy', y2);
      bootB.setAttribute('r', '3');
      bootB.setAttribute('fill', '#0c101a');
      bootB.setAttribute('stroke', cable.color);
      bootB.setAttribute('stroke-width', '1.6');
      bootB.setAttribute('class', 'cable-boot');
      bootB.style.cursor = 'pointer';
      bootB.addEventListener('click', (e) => {
        e.stopPropagation();
        highlightCable(cable.id);
        showCableQuickHud(cable.id, e.clientX, e.clientY);
      });

      dom.connectorsGroup.appendChild(bootA);
      dom.connectorsGroup.appendChild(bootB);
    }
  });

  renderDRingOverlays(activeRack, contRect, curScale);
}

let quickHudEl = null;
let contextMenuEl = null;

export function hideCableQuickHud() {
  if (quickHudEl) {
    quickHudEl.remove();
    quickHudEl = null;
  }
}

export function hideCableContextMenu() {
  if (contextMenuEl) {
    contextMenuEl.remove();
    contextMenuEl = null;
  }
}

export function disconnectCable(cableId) {
  if (!cableId) return;
  const cable = STATE.cables.find(c => c.id === cableId);
  if (!cable) return;

  STATE.cables = STATE.cables.filter(c => c.id !== cableId);
  if (STATE.highlightedCableId === cableId) {
    STATE.highlightedCableId = null;
  }
  hideCableQuickHud();
  hideCableContextMenu();

  if (typeof window.RackStudio?.renderMountedDevices === 'function') {
    window.RackStudio.renderMountedDevices();
  }
  if (typeof window.RackStudio?.renderScheduleTable === 'function') {
    window.RackStudio.renderScheduleTable();
  }
  renderAllCables();

  if (dom.connectionStatusHint) {
    dom.connectionStatusHint.innerHTML = `<span style="color:#f87171; font-weight:700;">✂️ ${cable.name || cable.id} söküldü.</span>`;
    setTimeout(() => {
      if (dom.connectionStatusHint && !STATE.pendingConnection) {
        dom.connectionStatusHint.innerHTML = 'Bağlamak için <b>Kaynak Porta</b> tıklayın';
      }
    }, 2500);
  }

  if (window.__STUDIO3D__ && typeof window.__STUDIO3D__.removeCable === 'function') {
    window.__STUDIO3D__.removeCable(cableId);
  }
  window.dispatchEvent(new CustomEvent('rackstudio:refresh'));
}

export function showCableQuickHud(cableId, clientX, clientY) {
  hideCableQuickHud();
  hideCableContextMenu();

  const cable = STATE.cables.find(c => c.id === cableId);
  if (!cable) return;

  const hud = document.createElement('div');
  hud.className = 'cable-quick-hud';
  hud.id = 'cable-quick-hud';
  const left = Math.max(80, Math.min(window.innerWidth - 80, clientX));
  const isNearTop = clientY < 85;
  const top = isNearTop ? Math.max(70, clientY + 30) : clientY;
  if (isNearTop) {
    hud.style.transform = 'translate(-50%, 0)';
  }
  hud.style.left = `${left}px`;
  hud.style.top = `${top}px`;

  hud.innerHTML = `
    <span class="hud-title"><span style="color:${cable.color};">●</span> ${cable.name || cable.id}</span>
    <button type="button" class="hud-btn-disconnect" title="Kabloyu Sök (Delete Tuşu)">✂️ Sök</button>
    <button type="button" class="hud-btn-color" title="Kablo Rengini Değiştir">🎨</button>
    <button type="button" class="hud-btn-close" title="Kapat">✕</button>
  `;

  hud.querySelector('.hud-btn-disconnect').addEventListener('click', (e) => {
    e.stopPropagation();
    disconnectCable(cableId);
  });

  hud.querySelector('.hud-btn-color').addEventListener('click', (e) => {
    e.stopPropagation();
    const colors = ['#0070d2', '#00d2ff', '#10b981', '#f59e0b', '#ef4444', '#a855f7', '#ec4899', '#ffffff'];
    const currentIdx = colors.indexOf(cable.color);
    cable.color = colors[(currentIdx + 1) % colors.length];
    renderAllCables();
    if (typeof window.RackStudio?.renderScheduleTable === 'function') window.RackStudio.renderScheduleTable();
    showCableQuickHud(cableId, left, top);
  });

  hud.querySelector('.hud-btn-close').addEventListener('click', (e) => {
    e.stopPropagation();
    hideCableQuickHud();
    if (STATE.highlightedCableId === cableId) {
      highlightCable(cableId);
    }
  });

  document.body.appendChild(hud);
  quickHudEl = hud;
}

export function showCableContextMenu(cableId, clientX, clientY) {
  hideCableQuickHud();
  hideCableContextMenu();

  const cable = STATE.cables.find(c => c.id === cableId);
  if (!cable) return;

  const menu = document.createElement('div');
  menu.className = 'cable-context-menu';
  menu.id = 'cable-context-menu';
  const left = Math.max(10, Math.min(window.innerWidth - 180, clientX));
  const top = Math.max(10, Math.min(window.innerHeight - 150, clientY));
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;

  menu.innerHTML = `
    <div style="padding: 4px 8px; font-size: 0.7rem; color: #94a3b8; font-weight: 700; border-bottom: 1px solid #1e293b;">
      <span style="color:${cable.color};">●</span> ${cable.name || cable.id} (${cable.lengthMeters || 1.5}m)
    </div>
    <div class="menu-item danger" id="ctx-disconnect">
      ✂️ Kabloyu Sök (Delete)
    </div>
    <div class="menu-item" id="ctx-rename">
      ✏️ Yeniden Adlandır
    </div>
    <div class="menu-item" id="ctx-change-color">
      🎨 Renk Değiştir
    </div>
    <div class="menu-divider"></div>
    <div class="menu-item" id="ctx-cancel">
      ✕ Kapat
    </div>
  `;

  menu.querySelector('#ctx-disconnect').addEventListener('click', (e) => {
    e.stopPropagation();
    disconnectCable(cableId);
  });

  menu.querySelector('#ctx-rename').addEventListener('click', (e) => {
    e.stopPropagation();
    hideCableContextMenu();
    const nextName = prompt('Kablo Adı / Etiketi:', cable.name || cable.id);
    if (nextName !== null && nextName.trim()) {
      cable.name = nextName.trim();
      renderAllCables();
      if (typeof window.RackStudio?.renderScheduleTable === 'function') window.RackStudio.renderScheduleTable();
    }
  });

  menu.querySelector('#ctx-change-color').addEventListener('click', (e) => {
    e.stopPropagation();
    const colors = ['#0070d2', '#00d2ff', '#10b981', '#f59e0b', '#ef4444', '#a855f7', '#ec4899', '#ffffff'];
    const currentIdx = colors.indexOf(cable.color);
    cable.color = colors[(currentIdx + 1) % colors.length];
    renderAllCables();
    if (typeof window.RackStudio?.renderScheduleTable === 'function') window.RackStudio.renderScheduleTable();
    hideCableContextMenu();
  });

  menu.querySelector('#ctx-cancel').addEventListener('click', (e) => {
    e.stopPropagation();
    hideCableContextMenu();
  });

  document.body.appendChild(menu);
  contextMenuEl = menu;
}

// Global keydown and click listeners for keyboard shortcuts & auto-dismiss
if (typeof window !== 'undefined' && !window.__CABLE_INTERACTIONS_BOUND__) {
  window.__CABLE_INTERACTIONS_BOUND__ = true;

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#cable-quick-hud') && !e.target.closest('#cable-context-menu')) {
      hideCableQuickHud();
      hideCableContextMenu();
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      const activeEl = document.activeElement;
      const isEditing = activeEl && (
        activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA' ||
        activeEl.isContentEditable
      );
      if (isEditing) return;

      if (STATE.highlightedCableId) {
        e.preventDefault();
        disconnectCable(STATE.highlightedCableId);
      }
    }
  });
}

export function highlightCable(cableId) {
  STATE.highlightedCableId = (STATE.highlightedCableId === cableId) ? null : cableId;
  if (!STATE.highlightedCableId) {
    hideCableQuickHud();
    hideCableContextMenu();
  }

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
