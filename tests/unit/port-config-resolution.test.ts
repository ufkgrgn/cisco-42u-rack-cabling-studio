import { describe, it, expect } from 'vitest';

describe('Port Configuration & Alias Resolution Engine', () => {
  function getPortAliases(portId: string | number) {
    const pIdStr = String(portId || '');
    const numMatch = pIdStr.match(/\d+$/);
    const num = numMatch ? numMatch[0] : '';
    const aliases = new Set([pIdStr]);
    if (!num) return Array.from(aliases);

    if (/^up/i.test(pIdStr)) {
      aliases.add('up' + num);
      aliases.add('uplink' + num);
      aliases.add('uplink-' + num);
    } else if (/^sfp/i.test(pIdStr)) {
      aliases.add('sfp' + num);
      aliases.add('sfp-' + num);
    } else if (/^pt/i.test(pIdStr)) {
      aliases.add('pt' + num);
      aliases.add('pt-' + num);
    } else if (/^lc/i.test(pIdStr)) {
      aliases.add('lc' + num);
      aliases.add('lc-' + num);
    } else if (/^sc/i.test(pIdStr)) {
      aliases.add('sc' + num);
      aliases.add('sc-' + num);
    } else if (/^mgmt/i.test(pIdStr)) {
      aliases.add('mgmt' + num);
      aliases.add('mgmt-' + num);
    } else {
      aliases.add(num);
      aliases.add('p' + num);
      aliases.add('port' + num);
      aliases.add('port-' + num);
    }
    return Array.from(aliases);
  }

  function resolvePortRoleColor(dev: any, portId: string | number) {
    if (!dev?.portsConfig) return null;
    const pIdStr = String(portId || '');
    let cfg = dev.portsConfig[pIdStr];
    if (cfg === undefined) {
      const aliases = getPortAliases(portId);
      for (const a of aliases) {
        if (dev.portsConfig[a] !== undefined) {
          cfg = dev.portsConfig[a];
          break;
        }
      }
    }
    if (!cfg) return null;
    return cfg.color || (cfg.role === 'trunk' ? '#7c3aed' : '#38bdf8');
  }

  it('prevents cross-contamination between uplink ports (up1) and access ports (p1)', () => {
    const upAliases = getPortAliases('up1');
    const pAliases = getPortAliases('p1');

    expect(upAliases).toContain('up1');
    expect(upAliases).toContain('uplink1');
    expect(upAliases).not.toContain('p1');
    expect(upAliases).not.toContain('1');
    expect(upAliases).not.toContain('pt1');

    expect(pAliases).toContain('p1');
    expect(pAliases).toContain('1');
    expect(pAliases).toContain('port1');
    expect(pAliases).not.toContain('up1');
    expect(pAliases).not.toContain('uplink1');
  });

  it('isolates patch panel ports (pt1) and SFP ports (sfp1)', () => {
    const ptAliases = getPortAliases('pt1');
    const sfpAliases = getPortAliases('sfp1');

    expect(ptAliases).toContain('pt1');
    expect(ptAliases).not.toContain('p1');
    expect(ptAliases).not.toContain('up1');

    expect(sfpAliases).toContain('sfp1');
    expect(sfpAliases).not.toContain('p1');
    expect(sfpAliases).not.toContain('up1');
  });

  it('correctly resolves distinct port configurations on the same device without collision', () => {
    const device: any = {
      instanceId: 'dev-sw-1',
      portsConfig: {}
    };

    // Configure port 1 (access port)
    const p1Config = { role: 'trunk', color: '#7c3aed', vlan: '10' };
    const p1Aliases = getPortAliases('p1');
    device.portsConfig['p1'] = p1Config;
    p1Aliases.forEach(a => { device.portsConfig[a] = p1Config; });

    // Configure uplink 1 (up1)
    const up1Config = { role: 'uplink', color: '#00d2ff', vlan: '99' };
    const up1Aliases = getPortAliases('up1');
    device.portsConfig['up1'] = up1Config;
    up1Aliases.forEach(a => { device.portsConfig[a] = up1Config; });

    // Port 1 must remain trunk (#7c3aed)
    const p1ResolvedColor = resolvePortRoleColor(device, 'p1');
    expect(p1ResolvedColor).toBe('#7c3aed');

    // Uplink 1 must remain uplink (#00d2ff)
    const up1ResolvedColor = resolvePortRoleColor(device, 'up1');
    expect(up1ResolvedColor).toBe('#00d2ff');

    // Unconfigured port 2 should be null
    expect(resolvePortRoleColor(device, 'p2')).toBeNull();
    expect(resolvePortRoleColor(device, 'up2')).toBeNull();
  });

  it('safely resets port 1 without wiping or corrupting uplink 1', () => {
    const device: any = {
      instanceId: 'dev-sw-1',
      portsConfig: {}
    };

    const p1Config = { role: 'trunk', color: '#7c3aed' };
    const up1Config = { role: 'uplink', color: '#00d2ff' };

    getPortAliases('p1').forEach(a => { device.portsConfig[a] = p1Config; });
    getPortAliases('up1').forEach(a => { device.portsConfig[a] = up1Config; });

    // Reset p1
    getPortAliases('p1').forEach(a => { delete device.portsConfig[a]; });
    delete device.portsConfig['p1'];

    // p1 should now have no role color
    expect(resolvePortRoleColor(device, 'p1')).toBeNull();

    // up1 must still retain its uplink configuration
    expect(resolvePortRoleColor(device, 'up1')).toBe('#00d2ff');
  });

  it('correctly matches catalog port items avoiding wildcard digit confusion', () => {
    const catalogPorts = [
      { id: 'p1', name: 'GigabitEthernet1/0/1', type: 'rj45' },
      { id: 'p2', name: 'GigabitEthernet1/0/2', type: 'rj45' },
      { id: 'up1', name: 'TenGigabitEthernet1/1/1', type: 'sfp' },
      { id: 'up2', name: 'TenGigabitEthernet1/1/2', type: 'sfp' }
    ];

    function findCatalogPort(query: string | number) {
      // 1. Exact ID or Name match
      let found = catalogPorts.find(p => p.id === query || p.name === query);
      if (!found && query) {
        const aliases = getPortAliases(query);
        found = catalogPorts.find(p => aliases.includes(p.id) || (p.name && aliases.includes(p.name)));
      }
      return found || null;
    }

    // Querying 'up1' MUST return up1 (TenGigabitEthernet1/1/1), NOT p1!
    const up1Result = findCatalogPort('up1');
    expect(up1Result).not.toBeNull();
    expect(up1Result?.id).toBe('up1');
    expect(up1Result?.name).toBe('TenGigabitEthernet1/1/1');

    // Querying 'p1' MUST return p1
    const p1Result = findCatalogPort('p1');
    expect(p1Result).not.toBeNull();
    expect(p1Result?.id).toBe('p1');
    expect(p1Result?.name).toBe('GigabitEthernet1/0/1');

    // Querying numeric 1 should resolve to p1
    const num1Result = findCatalogPort('1');
    expect(num1Result?.id).toBe('p1');
  });
});
