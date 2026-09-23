/**
 * Cisco Enterprise Rack & Cabling Studio - Faceplate Port Renderer Module
 * Handles individual port DOM markup generation, port type classes (RJ45, SFP, LC, SC, power),
 * port role badges (Trunk, Uplink, PoE, VLAN, Routed, Fiber), and dynamic contrast colors.
 */
(function () {
  'use strict';

  const RS = window.RackStudio = window.RackStudio || {};
  const STATE = RS.STATE;

  const escapeHtml = (val) => RS.escapeHtml ? RS.escapeHtml(val) : String(val ?? '');
  const portKey = (instanceId, portId) => (RS.portKey ? RS.portKey(instanceId, portId) : JSON.stringify([instanceId, portId]));

  function getContrastColor(hexColor) {
    if (!hexColor || typeof hexColor !== 'string') return '#ffffff';
    let hex = hexColor.trim().replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    if (hex.length !== 6) return '#ffffff';
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return '#ffffff';
    // ITU-R BT.709 perceived luminance
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return lum > 0.52 ? '#020617' : '#ffffff';
  }

  function renderPortIcon(instanceId, port) {
    const occupiedPortKeys = RS.occupiedPortKeys || new Set();
    let typeClass = 'port-rj45';
    let inner = '';
    if (port.type === 'sfp') {
      typeClass = 'port-sfp';
    } else if (port.type === 'lc') {
      typeClass = 'port-lc';
      inner = '<div class="port-lc-inner"><span class="lc-ferrule"></span></div><div class="port-lc-inner"><span class="lc-ferrule"></span></div>';
    } else if (port.type === 'sc') {
      typeClass = 'port-sc';
      inner = '<div class="port-sc-inner"><span class="sc-ferrule"></span></div><div class="port-sc-inner"><span class="sc-ferrule"></span></div>';
    } else if (port.type === 'power') {
      typeClass = 'port-power';
      inner = '<div class="port-power-pin"></div><div class="port-power-pin"></div>';
    }

    const isConnected = occupiedPortKeys.has(portKey(instanceId, port.id));
    const allDevices = STATE.racks ? STATE.racks.flatMap(r => r.devices || []) : [];
    const dev = allDevices.find(d => d.instanceId === instanceId);
    const pIdStr = String(port.id || '');
    const pNumStr = pIdStr.replace(/\D+/g, '');
    let portCfg = dev && dev.portsConfig && (
      dev.portsConfig[port.id] ||
      (pNumStr && dev.portsConfig[pNumStr]) ||
      (pNumStr && dev.portsConfig['p' + pNumStr]) ||
      (pNumStr && dev.portsConfig['pt' + pNumStr]) ||
      (pNumStr && dev.portsConfig['lc' + pNumStr]) ||
      (pNumStr && dev.portsConfig['sc' + pNumStr]) ||
      dev.portsConfig[port.name]
    );

    // Fallback: If port is connected but dev.portsConfig has no role set, derive from connected cable or remote endpoint
    if (!portCfg && isConnected && Array.isArray(STATE.cables)) {
      const connCable = STATE.cables.find(c => {
        const fromMatch = c.from && c.from.instanceId === instanceId && (
          c.from.portId === port.id ||
          (pNumStr && String(c.from.portId).replace(/\D+/g, '') === pNumStr)
        );
        const toMatch = c.to && c.to.instanceId === instanceId && (
          c.to.portId === port.id ||
          (pNumStr && String(c.to.portId).replace(/\D+/g, '') === pNumStr)
        );
        return fromMatch || toMatch;
      });
      if (connCable) {
        // Inspect remote connected endpoint's portsConfig to inherit VLAN / role badges bidirectionally
        const isFromMe = connCable.from && connCable.from.instanceId === instanceId;
        const remoteEndpoint = isFromMe ? connCable.to : connCable.from;
        const remoteDev = remoteEndpoint ? allDevices.find(d => d.instanceId === remoteEndpoint.instanceId) : null;
        let remoteCfg = null;
        if (remoteDev && remoteDev.portsConfig && remoteEndpoint.portId) {
          const remId = String(remoteEndpoint.portId);
          const remNum = remId.replace(/\D+/g, '');
          remoteCfg = remoteDev.portsConfig[remId] ||
                      (remNum && remoteDev.portsConfig[remNum]) ||
                      (remNum && remoteDev.portsConfig['p' + remNum]) ||
                      (remNum && remoteDev.portsConfig['pt' + remNum]) ||
                      (remNum && remoteDev.portsConfig['lc' + remNum]) ||
                      (remNum && remoteDev.portsConfig['sc' + remNum]);
        }

        if (remoteCfg && (remoteCfg.vlan || remoteCfg.role || remoteCfg.color || remoteCfg.isTrunk)) {
          portCfg = { ...remoteCfg };
        } else if (connCable.color === '#facc15' || connCable.name?.includes('[FIBER]') || connCable.role === 'fiber' || port.type === 'sfp' || port.type === 'lc' || port.type === 'sc') {
          portCfg = { role: 'fiber', color: '#facc15' };
        } else if (connCable.role) {
          portCfg = { role: connCable.role, color: connCable.color };
        } else if (connCable.name?.includes('[UPLINK]')) {
          portCfg = { role: 'uplink', color: connCable.color || '#00d2ff' };
        } else if (connCable.name?.includes('[TRUNK]')) {
          portCfg = { role: 'trunk', color: connCable.color || '#7c3aed' };
        }
      }
    }

    let specialClass = '';
    let specialStyle = '';

    if (portCfg) {
      const role = (portCfg.role || (portCfg.isTrunk ? 'trunk' : '')).toLowerCase();
      const hasVlan = Boolean(portCfg.vlan);
      const customColor = portCfg.color;

      if (role === 'trunk' || portCfg.isTrunk) {
        const color = customColor || '#7c3aed';
        const badgeColor = getContrastColor(color);
        specialClass = 'port-special port-trunk';
        specialStyle = `style="--port-role-color: ${color}; --custom-color: ${color}; --trunk-color: ${color}; --port-badge-text: 'T'; --port-badge-color: ${badgeColor};"`;
      } else if (role === 'uplink') {
        const color = customColor || '#00d2ff';
        const badgeColor = getContrastColor(color);
        specialClass = 'port-special port-uplink';
        specialStyle = `style="--port-role-color: ${color}; --custom-color: ${color}; --port-badge-text: '▲'; --port-badge-color: ${badgeColor};"`;
      } else if (role === 'trunk-ap') {
        const color = customColor || '#ec4899';
        const badgeColor = getContrastColor(color);
        specialClass = 'port-special port-trunk-ap';
        specialStyle = `style="--port-role-color: ${color}; --custom-color: ${color}; --port-badge-text: 'W'; --port-badge-color: ${badgeColor};"`;
      } else if (role === 'routed') {
        const color = customColor || '#b91c1c';
        const badgeColor = getContrastColor(color);
        specialClass = 'port-special port-routed';
        specialStyle = `style="--port-role-color: ${color}; --custom-color: ${color}; --port-badge-text: 'R'; --port-badge-color: ${badgeColor};"`;
      } else if (role === 'poe') {
        const color = customColor || '#f59e0b';
        const badgeColor = getContrastColor(color);
        specialClass = 'port-special port-poe';
        specialStyle = `style="--port-role-color: ${color}; --custom-color: ${color}; --port-badge-text: '⚡'; --port-badge-color: ${badgeColor};"`;
      } else if (role === 'management' || role === 'mgmt') {
        const color = customColor || '#059669';
        const badgeColor = getContrastColor(color);
        specialClass = 'port-special port-mgmt';
        specialStyle = `style="--port-role-color: ${color}; --custom-color: ${color}; --port-badge-text: 'M'; --port-badge-color: ${badgeColor};"`;
      } else if (role === 'console') {
        const color = customColor || '#00bceb';
        const badgeColor = getContrastColor(color);
        specialClass = 'port-special port-console';
        specialStyle = `style="--port-role-color: ${color}; --custom-color: ${color}; --port-badge-text: 'C'; --port-badge-color: ${badgeColor};"`;
      } else if (role === 'fiber') {
        const color = customColor || '#facc15';
        const badgeColor = getContrastColor(color);
        specialClass = 'port-special port-fiber';
        specialStyle = `style="--port-role-color: ${color}; --custom-color: ${color}; --port-badge-text: 'F'; --port-badge-color: ${badgeColor};"`;
      } else if (hasVlan || (role === 'access' && hasVlan)) {
        const color = customColor || '#38bdf8';
        const badgeColor = getContrastColor(color);
        const vlanLabel = String(portCfg.vlan).trim().split(/[, ]+/)[0];
        const badgeText = vlanLabel ? `V${vlanLabel.slice(0, 3)}` : 'V';
        specialClass = 'port-special port-vlan';
        specialStyle = `style="--port-role-color: ${color}; --custom-color: ${color}; --port-badge-text: '${badgeText}'; --port-badge-color: ${badgeColor};"`;
      } else if (customColor) {
        const badgeColor = getContrastColor(customColor);
        specialClass = 'port-special';
        specialStyle = `style="--port-role-color: ${customColor}; --custom-color: ${customColor}; --port-badge-text: '●'; --port-badge-color: ${badgeColor};"`;
      }

      if (portCfg.poeState === 'never') {
        specialClass += ' port-poe-disabled';
      }
    }

    return `
      <div class="port ${typeClass} ${isConnected ? 'connected' : ''} ${specialClass}" 
           ${specialStyle}
           data-instance-id="${instanceId}" 
           data-port-id="${port.id}"
           data-port-name="${escapeHtml(port.name)}"
           data-port-type="${escapeHtml(port.type)}"
           data-port-speed="${escapeHtml(port.speed)}"
           id="port-${instanceId}-${port.id}">
        ${inner}
      </div>
    `;
  }

  RS.getContrastColor = getContrastColor;
  RS.renderPortIcon = renderPortIcon;
})();
