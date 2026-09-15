import { STATE } from './state.js';
import { HARDWARE_CATALOG } from './catalog.js';
import { renderMountedDevices } from './rack.js';
import { renderScheduleTable } from './schedule.js';
import { renderAllCables } from './cabling.js';

export function exportVisioSvg() {
  const totalWidth = 700;
  const totalHeight = 42 * 32 + 80;

  let svgContent = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg xmlns="http://www.w3.org/2000/svg" 
     xmlns:v="http://schemas.microsoft.com/visio/2003/SVGExtensions/" 
     width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}">
  
  <style>
    .v-rack-post { fill: #1c202a; stroke: #333a47; stroke-width: 1; }
    .v-u-label { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; fill: #64748b; font-weight: bold; }
    .v-hole { fill: #0d1117; stroke: #3b4252; stroke-width: 0.5; }
    .v-device-body { fill: #1e2430; stroke: #475569; stroke-width: 1; }
    .v-device-text { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9px; fill: #38bdf8; font-weight: bold; }
    .v-cable { fill: none; stroke-linecap: round; filter: drop-shadow(0px 2px 2px rgba(0,0,0,0.5)); }
  </style>

  <!-- LAYER 1: 42U RACK CABINET FRAME & RAILS -->
  <g v:groupContext="layer" v:layerMember="Rack_Cabinet">
    <rect x="40" y="20" width="620" height="${42 * 32}" fill="#11141b" stroke="#2d3340" stroke-width="4"/>
    <rect x="40" y="20" width="44" height="${42 * 32}" class="v-rack-post"/>
    <rect x="616" y="20" width="44" height="${42 * 32}" class="v-rack-post"/>
`;

  for (let u = 42; u >= 1; u--) {
    const y = 20 + (42 - u) * 32;
    svgContent += `
      <line x1="40" y1="${y}" x2="660" y2="${y}" stroke="#1f2430" stroke-width="0.5" stroke-dasharray="2,2"/>
      <text x="62" y="${y + 20}" text-anchor="middle" class="v-u-label">${u}</text>
      <text x="638" y="${y + 20}" text-anchor="middle" class="v-u-label">${u}</text>
      <rect x="48" y="${y + 6}" width="4" height="4" class="v-hole"/>
      <rect x="48" y="${y + 14}" width="4" height="4" class="v-hole"/>
      <rect x="48" y="${y + 22}" width="4" height="4" class="v-hole"/>
      <rect x="648" y="${y + 6}" width="4" height="4" class="v-hole"/>
      <rect x="648" y="${y + 14}" width="4" height="4" class="v-hole"/>
      <rect x="648" y="${y + 22}" width="4" height="4" class="v-hole"/>
    `;
  }
  svgContent += `  </g>\n`;

  svgContent += `  <!-- LAYER 2: CISCO & NETWORK HARDWARE -->\n  <g v:groupContext="layer" v:layerMember="Network_Devices">\n`;
  STATE.devices.forEach(dev => {
    const cat = HARDWARE_CATALOG[dev.catalogKey];
    const y = 20 + (42 - dev.topU) * 32;
    const height = dev.uHeight * 32;

    svgContent += `
      <g v:groupContext="shape" v:mID="${dev.instanceId}">
        <rect x="84" y="${y}" width="532" height="${height}" class="v-device-body"/>
        <text x="96" y="${y + 18}" class="v-device-text">${cat.name} (U${dev.topU})</text>
        <rect x="96" y="${y + 22}" width="6" height="4" fill="#22c55e"/>
        <rect x="104" y="${y + 22}" width="6" height="4" fill="#38bdf8"/>
      </g>
    `;
  });
  svgContent += `  </g>\n`;

  svgContent += `  <!-- LAYER 3: CABLING RUN SCHEDULE & CONNECTIONS -->\n  <g v:groupContext="layer" v:layerMember="Patch_Cables" transform="translate(40, 20)">\n`;
  const svgLayer = document.getElementById('cables-svg');
  if (svgLayer) {
    const paths = svgLayer.querySelectorAll('.cable-path');
    paths.forEach((p, idx) => {
      const d = p.getAttribute('d');
      const stroke = p.getAttribute('stroke');
      const cable = STATE.cables[idx] || { id: 'CBL' };
      svgContent += `
        <path d="${d}" stroke="${stroke}" stroke-width="2.8" class="v-cable" v:groupContext="shape">
          <title>${cable.id} (${cable.lengthMeters}m)</title>
        </path>
      `;
    });
  }
  svgContent += `  </g>\n</svg>`;

  const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const dlLink = document.createElement('a');
  dlLink.href = url;
  dlLink.download = `cisco-enterprise-42u-visio-${new Date().toISOString().slice(0,10)}.svg`;
  document.body.appendChild(dlLink);
  dlLink.click();
  dlLink.remove();
  URL.revokeObjectURL(url);
}

export function exportJson() {
  const exportData = {
    version: '2.0-enterprise',
    timestamp: new Date().toISOString(),
    devices: STATE.devices,
    cables: STATE.cables
  };
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
  const dlAnchor = document.createElement('a');
  dlAnchor.setAttribute("href", dataStr);
  dlAnchor.setAttribute("download", `cisco-rack-topology-${new Date().toISOString().slice(0,10)}.json`);
  document.body.appendChild(dlAnchor);
  dlAnchor.click();
  dlAnchor.remove();
}

export function loadCustomTopology(data) {
  STATE.rackUnits = Array(43).fill(null);
  STATE.devices = data.devices || [];
  STATE.cables = data.cables || [];

  STATE.devices.forEach(dev => {
    const cat = HARDWARE_CATALOG[dev.catalogKey];
    if (cat) {
      const endU = dev.topU - dev.uHeight + 1;
      for (let u = endU; u <= dev.topU; u++) {
        STATE.rackUnits[u] = dev.instanceId;
      }
    }
  });

  renderMountedDevices();
  renderScheduleTable();
  setTimeout(renderAllCables, 50);
}
