/**
 * Cisco Enterprise Rack & Cabling Studio - Port Role Cycling Module
 * Handles empty port double-click role progression (access, trunk, uplink, routed, poe, etc.)
 * and user toast notifications.
 */
(function () {
  'use strict';

  const RS = window.RackStudio = window.RackStudio || {};
  const STATE = RS.STATE;

  const escapeHtml = (val) => RS.escapeHtml ? RS.escapeHtml(val) : String(val ?? '');
  const renderMountedDevices = () => RS.renderMountedDevices && RS.renderMountedDevices();
  const renderAllCables = () => RS.renderAllCables && RS.renderAllCables();

  // --- PORT ROLE CYCLE on EMPTY PORT double-click ---
  // Copper/generic cycle: none → access → trunk → uplink → routed → poe → management → console → none
  // Fiber-type cycle   : none → fiber → none
  const PORT_ROLE_CYCLES = {
    copper: [null, 'access', 'trunk', 'uplink', 'routed', 'poe', 'management', 'console'],
    fiber:  [null, 'fiber'],
  };
  const PORT_ROLE_META = {
    null:       { label: 'Boş (Rol Yok)',   icon: '⚪', color: '#475569' },
    access:     { label: 'Access',           icon: '🔵', color: '#38bdf8' },
    trunk:      { label: 'Trunk 802.1Q',     icon: '🟣', color: '#7c3aed' },
    uplink:     { label: 'Uplink ▲',         icon: '🔷', color: '#00d2ff' },
    routed:     { label: 'Routed (L3)',      icon: '🔴', color: '#b91c1c' },
    poe:        { label: 'PoE ⚡',           icon: '🟡', color: '#f59e0b' },
    management: { label: 'Management',       icon: '🟢', color: '#059669' },
    console:    { label: 'Console',          icon: '🔵', color: '#00bceb' },
    fiber:      { label: 'Fiber',            icon: '🟡', color: '#facc15' },
  };

  function getPortAliases(portId) {
    const pIdStr = String(portId || '');
    const numMatch = pIdStr.match(/\d+$/);
    const num = numMatch ? numMatch[0] : '';
    const aliases = new Set([pIdStr]);
    if (num) {
      aliases.add(num);
      aliases.add('p' + num);
      aliases.add('pt' + num);
      aliases.add('port' + num);
      aliases.add('port-' + num);
      aliases.add('lc' + num);
      aliases.add('sc' + num);
    }
    return Array.from(aliases);
  }

  function cyclePortRole(instanceId, portId, portType) {
    const isFiber = ['lc', 'sc', 'sfp', 'sfp+', 'qsfp28'].includes((portType || '').toLowerCase());
    const cycle = isFiber ? PORT_ROLE_CYCLES.fiber : PORT_ROLE_CYCLES.copper;

    // Find device across all racks
    const devRack = STATE.racks.find(r => r.devices.some(d => d.instanceId === instanceId));
    if (!devRack) return;
    const dev = devRack.devices.find(d => d.instanceId === instanceId);
    if (!dev) return;

    // Ensure portsConfig exists
    if (!dev.portsConfig) dev.portsConfig = {};

    const canonicalKey = String(portId || '');
    const aliases = getPortAliases(portId);

    // Resolve existing config from canonical key or any alias
    let currentCfg = dev.portsConfig[canonicalKey];
    if (currentCfg === undefined) {
      for (const a of aliases) {
        if (dev.portsConfig[a] !== undefined) {
          currentCfg = dev.portsConfig[a];
          break;
        }
      }
    }

    const currentRole = currentCfg?.role || null;

    // Purge numeric/prefix aliases completely
    aliases.forEach(a => {
      delete dev.portsConfig[a];
    });

    // Find current index in cycle
    const idx = cycle.indexOf(currentRole);
    const nextRole = cycle[(idx + 1) % cycle.length];

    if (nextRole !== null) {
      const meta = PORT_ROLE_META[nextRole] || {};
      dev.portsConfig[canonicalKey] = {
        ...(currentCfg || {}),
        role: nextRole,
        color: meta.color,
      };
    }

    // Persist & re-render
    renderMountedDevices();
    renderAllCables();
    document.dispatchEvent(new CustomEvent('rackstudio:change', { bubbles: true, detail: { immediate: true } }));
    window.dispatchEvent(new CustomEvent('rackstudio:refresh'));

    // Show mini toast feedback
    const meta = PORT_ROLE_META[nextRole] || PORT_ROLE_META['null'];
    showPortRoleCycleToast(portId, nextRole, meta);
  }

  function showPortRoleCycleToast(portId, role, meta) {
    let toast = document.getElementById('port-role-cycle-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'port-role-cycle-toast';
      toast.style.cssText = [
        'position:fixed', 'bottom:80px', 'left:50%', 'transform:translateX(-50%)',
        'background:rgba(15,23,42,0.96)', 'border:1px solid #334155',
        'border-radius:8px', 'padding:8px 18px',
        'font-size:0.78rem', 'font-family:monospace', 'font-weight:600',
        'color:#f8fafc', 'z-index:99999',
        'box-shadow:0 4px 24px rgba(0,0,0,0.5)',
        'pointer-events:none', 'transition:opacity 0.25s',
      ].join(';');
      document.body.appendChild(toast);
    }
    const label = meta.label || role || 'Boş';
    const color = meta.color || '#94a3b8';
    toast.innerHTML = `${meta.icon || '⚪'} <span style="color:#94a3b8">Port ${escapeHtml(portId)}:</span> <span style="color:${color}">${escapeHtml(label)}</span>`;
    toast.style.opacity = '1';
    clearTimeout(toast.__hideTimer);
    toast.__hideTimer = setTimeout(() => { toast.style.opacity = '0'; }, 1800);
  }

  RS.PORT_ROLE_CYCLES = PORT_ROLE_CYCLES;
  RS.PORT_ROLE_META = PORT_ROLE_META;
  RS.getPortAliases = getPortAliases;
  RS.cyclePortRole = cyclePortRole;
  RS.showPortRoleCycleToast = showPortRoleCycleToast;
})();
