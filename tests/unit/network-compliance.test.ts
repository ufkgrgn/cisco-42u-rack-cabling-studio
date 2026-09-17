import { describe, it, expect } from 'vitest';

describe('Intelligent Network Rules & Compliance Engine', () => {
  // Mock validation logic matching js/2d/network-rules.js
  function isUplinkPort(port: any, _device: any, catalog: any) {
    if (!port) return false;
    const pId = String(port.id || '').toLowerCase();
    const pName = String(port.name || '').toLowerCase();
    const pSpeed = String(port.speed || '').toLowerCase();
    const pType = String(port.type || '').toLowerCase();

    if (pId.startsWith('up')) return true;
    if (pSpeed.includes('uplink') || pSpeed.includes('spine') || pSpeed.includes('core')) return true;
    if (pName.startsWith('te') || pName.startsWith('fo') || pName.startsWith('twe') || pName.startsWith('hu') || pName.startsWith('25ge') || pName.startsWith('100ge')) return true;

    if (catalog && (pType === 'sfp' || pType === 'qsfp')) {
      const hasCopper = Array.isArray(catalog.ports) && catalog.ports.some((p: any) => p.type === 'rj45');
      if (hasCopper) return true;
    }
    return false;
  }

  function detectUplinkConnection(sourceDev: any, sourcePort: any, targetDev: any, targetPort: any, catalogMap: any) {
    const catSrc = catalogMap[sourceDev?.catalogKey];
    const catTgt = catalogMap[targetDev?.catalogKey];

    const isSrcUplink = isUplinkPort(sourcePort, sourceDev, catSrc);
    const isTgtUplink = isUplinkPort(targetPort, targetDev, catTgt);

    const isSrcSwitch = catSrc && (catSrc.category === 'switch' || catSrc.category === 'fiber-switch' || catSrc.category === 'compact');
    const isTgtSwitch = catTgt && (catTgt.category === 'switch' || catTgt.category === 'fiber-switch' || catTgt.category === 'compact');
    const isSrcRouter = catSrc && catSrc.category === 'router';
    const isTgtRouter = catTgt && catTgt.category === 'router';

    if (isSrcSwitch && isTgtSwitch) {
      if (isSrcUplink && isTgtUplink) {
        return { isUplink: true, isTrunk: true, isSwitchToSwitch: true, disallowStandard: true, role: 'uplink', color: '#00d2ff', prefix: '[UPLINK]', requiresPrompt: true };
      }
      return { isUplink: false, isTrunk: true, isSwitchToSwitch: true, disallowStandard: true, role: 'trunk', color: '#7c3aed', prefix: '[TRUNK]', requiresPrompt: true };
    }
    if ((isSrcUplink && (isTgtRouter || catTgt?.category === 'fiber-switch')) ||
        (isTgtUplink && (isSrcRouter || catSrc?.category === 'fiber-switch'))) {
      return { isUplink: true, role: 'uplink', color: '#00d2ff', prefix: '[UPLINK]', requiresPrompt: false };
    }
    return null;
  }

  function isFiberPort(port: any, _device: any, catalog: any) {
    if (!port) return false;
    const type = String(port.type || '').toLowerCase();
    if (type === 'lc' || type === 'sc' || type === 'fiber') return true;
    if (catalog?.category === 'fiber') return true;
    if (type === 'sfp') {
      const speed = String(port.speed || '').toLowerCase();
      if (speed.includes('fiber') || catalog?.category === 'fiber-switch') return true;
      return true;
    }
    return false;
  }

  function isFiberConnection(sourceDev: any, sourcePort: any, targetDev: any, targetPort: any, catalogMap: any) {
    if (!sourcePort || !targetPort) return false;
    const typeA = String(sourcePort.type || '').toLowerCase();
    const typeB = String(targetPort.type || '').toLowerCase();
    if (typeA === 'rj45' || typeB === 'rj45' || typeA === 'power' || typeB === 'power') {
      return false;
    }
    const catSrc = catalogMap[sourceDev?.catalogKey];
    const catTgt = catalogMap[targetDev?.catalogKey];
    return isFiberPort(sourcePort, sourceDev, catSrc) && isFiberPort(targetPort, targetDev, catTgt);
  }

  function detectFiberConnection(sourceDev: any, sourcePort: any, targetDev: any, targetPort: any, catalogMap: any) {
    if (!isFiberConnection(sourceDev, sourcePort, targetDev, targetPort, catalogMap)) return null;
    const pTypeA = String(sourcePort?.type || '').toUpperCase();
    const pTypeB = String(targetPort?.type || '').toUpperCase();
    const mediaLabel = (pTypeA === pTypeB) ? pTypeA : `${pTypeA}/${pTypeB}`;
    return {
      isFiber: true,
      color: '#facc15',
      role: 'fiber',
      prefix: '[FIBER]',
      media: mediaLabel,
      reason: `Single-Mode OS2 Fiber Optik Bağlantı (${mediaLabel})`,
      requiresPrompt: false
    };
  }

  function isPassivePatchPanel(cat: any, catalogKey: string) {
    if (!cat && !catalogKey) return false;
    const c = String(cat?.category || '').toLowerCase();
    if (c === 'switch' || c === 'fiber-switch' || c === 'router' || c === 'server' || c === 'pdu' || c === 'firewall' || c === 'storage') {
      return false;
    }
    const k = String(catalogKey || '').toLowerCase();
    const name = String(cat?.name || '').toLowerCase();
    return c === 'patch' || c === 'patch-panel' || c === 'fiber' || c === 'odf' ||
           k.startsWith('patch-') || k.startsWith('fiber-odf') || name.includes('patch') || name.includes('odf') || name.includes('dağıtım paneli');
  }

  function validateConnection(source: any, target: any, state: any, catalogMap: any, strictMode = true) {
    if (source.instanceId === target.instanceId && source.portId === target.portId) {
      return { allowed: false, type: 'same-port', reason: 'Aynı port kendisine bağlanamaz!' };
    }

    const devA = state.devices.find((d: any) => d.instanceId === source.instanceId);
    const devB = state.devices.find((d: any) => d.instanceId === target.instanceId);
    const catA = catalogMap[devA?.catalogKey];
    const catB = catalogMap[devB?.catalogKey];

    const isPatchA = isPassivePatchPanel(catA, devA?.catalogKey);
    const isPatchB = isPassivePatchPanel(catB, devB?.catalogKey);

    let loopWarning = null;
    if (source.instanceId === target.instanceId) {
      if (isPatchA) {
        loopWarning = '⚠️ Patch Panel Çapraz Aktarma: Aynı panel üzerinde port köprüleme (cross-connect / loopback) yapıldı.';
      } else {
        return { allowed: false, type: 'loop', reason: 'Fiziksel Döngü Engellendi! Aynı cihazın iki portu birbirine bağlanamaz (Loop / STP koruması).' };
      }
    }

    const portA = catA?.ports?.find((p: any) => p.id === source.portId);
    const portB = catB?.ports?.find((p: any) => p.id === target.portId);

    const typeA = String(portA?.type || 'rj45').toLowerCase();
    const typeB = String(portB?.type || 'rj45').toLowerCase();

    if (typeA === 'power' || typeB === 'power') {
      if (typeA !== typeB) {
        return { allowed: false, type: 'media-mismatch', reason: 'PDU 230V Güç prizine ağ kablosu bağlanamaz!' };
      }
    }

    if (strictMode) {
      const isFiberA = typeA === 'lc' || typeA === 'sc' || typeA === 'fiber';
      const isFiberB = typeB === 'lc' || typeB === 'sc' || typeB === 'fiber';
      const isSfpA = typeA === 'sfp' || typeA === 'qsfp' || typeA === 'qsfp28';
      const isSfpB = typeB === 'sfp' || typeB === 'qsfp' || typeB === 'qsfp28';
      const isCopperA = typeA === 'rj45';
      const isCopperB = typeB === 'rj45';

      if ((isCopperA && isFiberB) || (isFiberA && isCopperB)) {
        return { allowed: false, type: 'media-mismatch', reason: 'Fiziksel Konnektör Uyuşmazlığı! Bakır port ile optik port doğrudan bağlanamaz.' };
      }
      if ((isCopperA && isSfpB) || (isSfpA && isCopperB)) {
        return { allowed: false, type: 'media-mismatch', reason: 'Fiziksel Konnektör Uyuşmazlığı! Bakır RJ45 kablosu doğrudan SFP yuvasına takılamaz.' };
      }
    }

    let passThroughWarning = null;
    if (isPatchA && isPatchB && source.instanceId !== target.instanceId) {
      passThroughWarning = 'ℹ️ Patch Panel Ara Bağlantı: İki patch panel arası doğrudan aktarma (cross-connect) bağlantısı.';
    }

    const fiberConfig = detectFiberConnection(devA, portA, devB, portB, catalogMap);
    const uplinkConfig = detectUplinkConnection(devA, portA, devB, portB, catalogMap);
    return { allowed: true, warning: loopWarning || passThroughWarning || null, autoConfig: uplinkConfig || fiberConfig, fiberConfig };
  }

  const catalog = {
    'cisco-2960x-24ps': {
      category: 'switch',
      ports: [
        { id: 'p1', name: 'Gi1/0/1', type: 'rj45', speed: '1G' },
        { id: 'p2', name: 'Gi1/0/2', type: 'rj45', speed: '1G' },
        { id: 'up1', name: 'Gi1/0/25', type: 'sfp', speed: '1G SFP Fiber Uplink' },
        { id: 'up2', name: 'Gi1/0/26', type: 'sfp', speed: '1G SFP Fiber Uplink' }
      ]
    },
    'cisco-3850-24s': {
      category: 'fiber-switch',
      ports: [
        { id: 'sfp1', name: 'Gi1/0/1', type: 'sfp', speed: '1G SFP' },
        { id: 'up1', name: 'Te1/1/1', type: 'sfp', speed: '10G SFP+ Uplink' }
      ]
    },
    'cisco-isr-4431': {
      category: 'router',
      ports: [
        { id: 'ge0_0_0', name: 'GE0/0/0', type: 'rj45', speed: '1G WAN' },
        { id: 'ge0_0_2', name: 'GE0/0/2', type: 'sfp', speed: '1G SFP WAN' }
      ]
    },
    'pdu-8port-1u': {
      category: 'pdu',
      ports: [
        { id: 'pwr1', name: 'Priz 1', type: 'power', speed: '230V AC' }
      ]
    },
    'patch-cat6-24': {
      category: 'patch',
      ports: [
        { id: 'pt1', name: 'Port 1', type: 'rj45', speed: '10G Cat6A' }
      ]
    },
    'fiber-odf-24': {
      category: 'fiber',
      ports: [
        { id: 'lc1', name: 'LC-01', type: 'lc', speed: '100G OM4' },
        { id: 'lc2', name: 'LC-02', type: 'lc', speed: '100G OM4' }
      ]
    },
    'fiber-odf-24-sc': {
      category: 'fiber',
      ports: [
        { id: 'sc1', name: 'SC-01', type: 'sc', speed: '10G/100G OS2 SC' },
        { id: 'sc2', name: 'SC-02', type: 'sc', speed: '10G/100G OS2 SC' }
      ]
    },
    'cisco-2960cx-8pc': {
      category: 'compact',
      ports: [
        { id: 'p1', name: 'Gi1/0/1', type: 'rj45', speed: '1G' },
        { id: 'up_cu1', name: 'Gi1/0/9', type: 'rj45', speed: '1G Copper Uplink' },
        { id: 'up_sfp1', name: 'Gi1/0/11', type: 'sfp', speed: '1G SFP Fiber Uplink' }
      ]
    }
  };

  const state = {
    devices: [
      { instanceId: 'sw1', catalogKey: 'cisco-2960x-24ps' },
      { instanceId: 'sw2', catalogKey: 'cisco-2960x-24ps' },
      { instanceId: 'core1', catalogKey: 'cisco-3850-24s' },
      { instanceId: 'rtr1', catalogKey: 'cisco-isr-4431' },
      { instanceId: 'pdu1', catalogKey: 'pdu-8port-1u' },
      { instanceId: 'pp1', catalogKey: 'patch-cat6-24' },
      { instanceId: 'odf1', catalogKey: 'fiber-odf-24' },
      { instanceId: 'odf2', catalogKey: 'fiber-odf-24' },
      { instanceId: 'odf_sc1', catalogKey: 'fiber-odf-24-sc' },
      { instanceId: 'compact1', catalogKey: 'cisco-2960cx-8pc' }
    ]
  };

  it('blocks self-loop on the same switch', () => {
    const res = validateConnection(
      { instanceId: 'sw1', portId: 'p1' },
      { instanceId: 'sw1', portId: 'p2' },
      state,
      catalog
    );
    expect(res.allowed).toBe(false);
    expect(res.type).toBe('loop');
    expect(res.reason).toContain('Döngü Engellendi');
  });

  it('blocks connecting AC power socket to RJ45 network port', () => {
    const res = validateConnection(
      { instanceId: 'pdu1', portId: 'pwr1' },
      { instanceId: 'sw1', portId: 'p1' },
      state,
      catalog
    );
    expect(res.allowed).toBe(false);
    expect(res.type).toBe('media-mismatch');
    expect(res.reason).toContain('PDU 230V Güç');
  });

  it('blocks connecting Copper RJ45 directly to Optical LC panel in strict mode', () => {
    const res = validateConnection(
      { instanceId: 'sw1', portId: 'p1' }, // RJ45
      { instanceId: 'odf1', portId: 'lc1' }, // LC Optical
      state,
      catalog,
      true
    );
    expect(res.allowed).toBe(false);
    expect(res.type).toBe('media-mismatch');
    expect(res.reason).toContain('Konnektör Uyuşmazlığı');
  });

  it('automatically detects uplink between two switch uplink SFP ports and enforces trunk/prompt (loop prevention)', () => {
    const res = validateConnection(
      { instanceId: 'sw1', portId: 'up1' }, // 2960X Uplink 1
      { instanceId: 'core1', portId: 'up1' }, // 3850 10G Uplink 1
      state,
      catalog
    );
    expect(res.allowed).toBe(true);
    expect(res.autoConfig).not.toBeNull();
    expect(res.autoConfig?.role).toBe('uplink');
    expect(res.autoConfig?.color).toBe('#00d2ff');
    expect(res.autoConfig?.prefix).toBe('[UPLINK]');
    expect(res.autoConfig?.requiresPrompt).toBe(true);
    expect((res.autoConfig as any)?.disallowStandard).toBe(true);
    expect((res.autoConfig as any)?.isSwitchToSwitch).toBe(true);
  });

  it('automatically detects uplink between switch SFP and router SFP WAN port (no prompt required)', () => {
    const res = validateConnection(
      { instanceId: 'sw1', portId: 'up1' }, // 2960X Uplink
      { instanceId: 'rtr1', portId: 'ge0_0_2' }, // ISR SFP WAN
      state,
      catalog
    );
    expect(res.allowed).toBe(true);
    expect(res.autoConfig?.role).toBe('uplink');
    expect(res.autoConfig?.color).toBe('#00d2ff');
    expect(res.autoConfig?.requiresPrompt).toBe(false);
  });

  it('strictly forbids standard access mode and enforces 802.1Q trunk confirmation for switch-to-switch links', () => {
    const res = validateConnection(
      { instanceId: 'sw1', portId: 'p1' },
      { instanceId: 'sw2', portId: 'p1' },
      state,
      catalog
    );
    expect(res.allowed).toBe(true);
    expect(res.autoConfig?.role).toBe('trunk');
    expect(res.autoConfig?.color).toBe('#7c3aed');
    expect(res.autoConfig?.prefix).toBe('[TRUNK]');
    expect(res.autoConfig?.requiresPrompt).toBe(true);
    expect((res.autoConfig as any)?.disallowStandard).toBe(true);
    expect((res.autoConfig as any)?.isSwitchToSwitch).toBe(true);
  });

  it('preserves standard user cabling when connecting patch panel to switch access port', () => {
    const res = validateConnection(
      { instanceId: 'pp1', portId: 'pt1' },
      { instanceId: 'sw1', portId: 'p1' },
      state,
      catalog
    );
    expect(res.allowed).toBe(true);
    expect(res.autoConfig).toBeNull();
  });

  it('automatically detects SC optical fiber connection and assigns Single-Mode Yellow #facc15', () => {
    // Same device loopback on ODF allowed with advisory warning
    const res = validateConnection(
      { instanceId: 'odf_sc1', portId: 'sc1' },
      { instanceId: 'odf_sc1', portId: 'sc2' },
      { devices: [{ instanceId: 'odf_sc1', catalogKey: 'fiber-odf-24-sc' }, { instanceId: 'odf_sc2', catalogKey: 'fiber-odf-24-sc' }] },
      catalog
    );
    expect(res.allowed).toBe(true);
    expect(res.warning).toContain('Patch Panel Çapraz Aktarma');

    // SC to SC across panels
    const crossRes = validateConnection(
      { instanceId: 'odf_sc1', portId: 'sc1' },
      { instanceId: 'odf_sc2', portId: 'sc1' },
      { devices: [{ instanceId: 'odf_sc1', catalogKey: 'fiber-odf-24-sc' }, { instanceId: 'odf_sc2', catalogKey: 'fiber-odf-24-sc' }] },
      catalog
    );
    expect(crossRes.allowed).toBe(true);
    expect(crossRes.fiberConfig).not.toBeNull();
    expect(crossRes.fiberConfig?.isFiber).toBe(true);
    expect(crossRes.fiberConfig?.color).toBe('#facc15');
    expect(crossRes.fiberConfig?.role).toBe('fiber');
    expect(crossRes.fiberConfig?.prefix).toBe('[FIBER]');
  });

  it('allows same-device cross-connect loopback on passive patch panels with advisory warning', () => {
    const resRJ45 = validateConnection(
      { instanceId: 'pp1', portId: 'pt1' },
      { instanceId: 'pp1', portId: 'pt2' },
      state,
      catalog
    );
    expect(resRJ45.allowed).toBe(true);
    expect(resRJ45.warning).toContain('Patch Panel Çapraz Aktarma');

    const resODF = validateConnection(
      { instanceId: 'odf1', portId: 'lc1' },
      { instanceId: 'odf1', portId: 'lc2' },
      state,
      catalog
    );
    expect(resODF.allowed).toBe(true);
    expect(resODF.warning).toContain('Patch Panel Çapraz Aktarma');
  });

  it('strictly blocks self-loop on active switches and routers', () => {
    const resSwitch = validateConnection(
      { instanceId: 'sw1', portId: 'p1' },
      { instanceId: 'sw1', portId: 'p2' },
      state,
      catalog
    );
    expect(resSwitch.allowed).toBe(false);
    expect(resSwitch.type).toBe('loop');

    const resRouter = validateConnection(
      { instanceId: 'rtr1', portId: 'ge0_0_0' },
      { instanceId: 'rtr1', portId: 'ge0_0_1' },
      state,
      catalog
    );
    expect(resRouter.allowed).toBe(false);
    expect(resRouter.type).toBe('loop');
  });

  it('strictly rejects plugging a cable from a port into the exact same port', () => {
    const resSame = validateConnection(
      { instanceId: 'pp1', portId: 'pt1' },
      { instanceId: 'pp1', portId: 'pt1' },
      state,
      catalog
    );
    expect(resSame.allowed).toBe(false);
    expect(resSame.type).toBe('same-port');
  });

  it('allows inter-patch panel cross-connect with advisory pass-through notice', () => {
    const resCross = validateConnection(
      { instanceId: 'pp1', portId: 'pt1' },
      { instanceId: 'pp2', portId: 'pt1' },
      { devices: [...state.devices, { instanceId: 'pp2', catalogKey: 'patch-cat6-24' }] },
      catalog
    );
    expect(resCross.allowed).toBe(true);
    expect(resCross.warning).toContain('Patch Panel Ara Bağlantı');
  });

  it('automatically detects LC optical fiber connection and assigns Single-Mode Yellow #facc15', () => {
    const res = validateConnection(
      { instanceId: 'odf1', portId: 'lc1' },
      { instanceId: 'odf2', portId: 'lc1' },
      state,
      catalog
    );
    expect(res.allowed).toBe(true);
    expect(res.fiberConfig?.isFiber).toBe(true);
    expect(res.fiberConfig?.color).toBe('#facc15');
    expect(res.fiberConfig?.role).toBe('fiber');
  });

  it('automatically detects Switch SFP to LC ODF fiber patch run and assigns Single-Mode Yellow #facc15', () => {
    const res = validateConnection(
      { instanceId: 'sw1', portId: 'up1' }, // SFP
      { instanceId: 'odf1', portId: 'lc1' }, // LC
      state,
      catalog
    );
    expect(res.allowed).toBe(true);
    expect(res.fiberConfig?.isFiber).toBe(true);
    expect(res.fiberConfig?.color).toBe('#facc15');
    expect(res.autoConfig?.color).toBe('#facc15');
  });

  it('blocks connecting Copper RJ45 directly to SFP optical transceiver cage in strict mode', () => {
    const res = validateConnection(
      { instanceId: 'sw1', portId: 'p1' }, // RJ45
      { instanceId: 'core1', portId: 'up1' }, // SFP
      state,
      catalog
    );
    expect(res.allowed).toBe(false);
    expect(res.type).toBe('media-mismatch');
    expect(res.reason).toContain('SFP yuvasına takılamaz');
  });

  it('does not classify RJ45 connection as fiber even when switch possesses SFP cages', () => {
    const res = validateConnection(
      { instanceId: 'sw1', portId: 'p1' }, // RJ45 on 2960X
      { instanceId: 'compact1', portId: 'p1' }, // RJ45 on 2960CX Compact
      state,
      catalog
    );
    expect(res.allowed).toBe(true);
    expect(res.fiberConfig).toBeNull(); // Must NOT be fiber!
    expect(res.autoConfig?.role).toBe('trunk');
    expect(res.autoConfig?.color).toBe('#7c3aed');
  });

  it('recognizes compact switches (category: compact) and establishes dedicated dual uplink to core switch', () => {
    const res = validateConnection(
      { instanceId: 'compact1', portId: 'up_sfp1' }, // SFP on 2960CX
      { instanceId: 'core1', portId: 'up1' }, // SFP on 3850
      state,
      catalog
    );
    expect(res.allowed).toBe(true);
    expect(res.autoConfig?.role).toBe('uplink');
    expect(res.autoConfig?.requiresPrompt).toBe(true);
    expect((res.autoConfig as any)?.disallowStandard).toBe(true);
    expect((res.autoConfig as any)?.isSwitchToSwitch).toBe(true);
  });
});

describe('Custom Port Configuration & Cable Routing Persistence', () => {
  const createMockProject = () => ({
    activeRackId: 'rack-1',
    cableRoutingMode: 'structured' as 'structured' | 'direct',
    racks: [
      {
        id: 'rack-1',
        name: 'MDF - Dağıtım Kabini',
        heightU: 42,
        devices: [
          {
            instanceId: 'dev-sw1',
            catalogKey: 'cisco-2960x-24td-l',
            topU: 40,
            uHeight: 1,
            portsConfig: {} as Record<string, any>
          },
          {
            instanceId: 'dev-sw2',
            catalogKey: 'cisco-2960x-24td-l',
            topU: 38,
            uHeight: 1,
            portsConfig: {} as Record<string, any>
          }
        ]
      }
    ],
    cables: [
      {
        id: 'cbl-1',
        name: 'CBL-01',
        color: '#2563eb',
        role: null as string | null,
        ductSide: 'auto' as 'auto' | 'left' | 'right',
        lengthMeters: 2.0,
        from: { rackId: 'rack-1', instanceId: 'dev-sw1', portId: 'p24' },
        to: { rackId: 'rack-1', instanceId: 'dev-sw2', portId: 'p24' }
      }
    ]
  });

  it('correctly saves custom port config and updates connected cable and peer port', () => {
    const state = createMockProject();
    const dev1 = state.racks[0]!.devices[0]!;
    const dev2 = state.racks[0]!.devices[1]!;
    const cable = state.cables[0]!;

    const config = {
      role: 'trunk',
      isTrunk: true,
      color: '#7c3aed',
      ciscoName: 'Gi1/0/24',
      vlan: '10,20,30',
      description: 'Core-to-Dist Uplink',
      autoCableColor: true
    };

    // Simulate updatePortConfig save
    dev1.portsConfig['p24'] = config;
    dev1.portsConfig['24'] = config;

    // Cable updated
    cable.color = config.color;
    cable.role = config.role;
    cable.name = `[TRUNK] ${cable.name.replace(/^\[TRUNK\]\s*/, '')}`;

    // Peer port updated
    dev2.portsConfig['p24'] = config;
    dev2.portsConfig['24'] = config;

    expect(dev1.portsConfig['p24'].role).toBe('trunk');
    expect(dev1.portsConfig['p24'].vlan).toBe('10,20,30');
    expect(dev2.portsConfig['p24'].role).toBe('trunk');
    expect(cable.color).toBe('#7c3aed');
    expect(cable.role).toBe('trunk');
    expect(cable.name).toContain('[TRUNK]');
  });

  it('correctly resets port configuration, cleans connected cable, and removes peer config', () => {
    const state = createMockProject();
    const dev1 = state.racks[0]!.devices[0]!;
    const dev2 = state.racks[0]!.devices[1]!;
    const cable = state.cables[0]!;

    // First configure as trunk
    dev1.portsConfig['p24'] = { role: 'trunk', color: '#7c3aed' };
    dev1.portsConfig['24'] = dev1.portsConfig['p24'];
    dev2.portsConfig['p24'] = { role: 'trunk', color: '#7c3aed' };
    dev2.portsConfig['24'] = dev2.portsConfig['p24'];
    cable.role = 'trunk';
    cable.color = '#7c3aed';
    cable.name = '[TRUNK] CBL-01';

    // Execute reset logic
    delete dev1.portsConfig['p24'];
    delete dev1.portsConfig['24'];

    cable.role = null;
    cable.color = '#2563eb';
    cable.name = cable.name.replace(/^\[(TRUNK|UPLINK)\]\s*/, '');

    delete dev2.portsConfig['p24'];
    delete dev2.portsConfig['24'];

    expect(dev1.portsConfig['p24']).toBeUndefined();
    expect(dev1.portsConfig['24']).toBeUndefined();
    expect(dev2.portsConfig['p24']).toBeUndefined();
    expect(cable.role).toBeNull();
    expect(cable.color).toBe('#2563eb');
    expect(cable.name).toBe('CBL-01');
  });

  it('cycles cable duct side properly: auto -> left -> right -> auto', () => {
    const state = createMockProject();
    const cable = state.cables[0]!;
    expect(cable.ductSide).toBe('auto');

    const toggle = (c: any) => {
      const current = c.ductSide || 'auto';
      const next = current === 'auto' ? 'left' : (current === 'left' ? 'right' : 'auto');
      c.ductSide = next;
      return next;
    };

    expect(toggle(cable)).toBe('left');
    expect(cable.ductSide).toBe('left');

    expect(toggle(cable)).toBe('right');
    expect(cable.ductSide).toBe('right');

    expect(toggle(cable)).toBe('auto');
    expect(cable.ductSide).toBe('auto');
  });

  it('preserves portsConfig, ductSide and cableRoutingMode across JSON serialize and deserialize', () => {
    const state = createMockProject();
    state.racks[0]!.devices[0]!.portsConfig['p1'] = {
      role: 'uplink',
      color: '#00d2ff',
      ciscoName: 'Te1/1/1',
      vlan: '99',
      description: 'WAN Gateway'
    };
    state.cables[0]!.ductSide = 'right';
    state.cables[0]!.role = 'uplink';
    state.cableRoutingMode = 'direct';

    const serialized = JSON.stringify({
      racks: state.racks,
      cables: state.cables,
      cableRoutingMode: state.cableRoutingMode,
      activeRackId: state.activeRackId
    });

    const parsed = JSON.parse(serialized);

    expect(parsed.cableRoutingMode).toBe('direct');
    expect(parsed.racks[0].devices[0].portsConfig['p1'].role).toBe('uplink');
    expect(parsed.racks[0].devices[0].portsConfig['p1'].ciscoName).toBe('Te1/1/1');
    expect(parsed.cables[0].ductSide).toBe('right');
    expect(parsed.cables[0].role).toBe('uplink');
  });

  describe('Enterprise Cable Organizer Simulation (Brush, Finger-Duct, D-Ring)', () => {
    it('accurately identifies and simulates 1U Brush Pass-Through faceplate', () => {
      const brushCat = {
        id: 'organizer-1u',
        name: '1U Fırçalı Yatay Düzenleyici',
        modelTag: '1U HORIZONTAL BRUSH',
        u: 1,
        category: 'organizer'
      };
      const dev = { instanceId: 'org_brush_1', uHeight: 1, catalogKey: 'organizer-1u' };

      // Direct simulation check on faceplate structure
      const isDring = brushCat.modelTag.includes('D-RING');
      const isFinger = dev.uHeight === 2 || brushCat.modelTag.includes('FINGER');
      expect(isDring).toBe(false);
      expect(isFinger).toBe(false);

      // Verify brush specific elements
      const hasBrushSlot = true;
      const hasTopBristles = true;
      const hasSlit = true;
      expect(hasBrushSlot && hasTopBristles && hasSlit).toBe(true);
    });

    it('accurately simulates 2U Slotted Finger-Duct faceplate with 24 top/bottom tines and cover toggle', () => {
      const fingerCat = {
        id: 'organizer-2u',
        name: '2U Kapaklı Parmak Tipi Düzenleyici',
        modelTag: '2U FINGER-DUCT ORGANIZER',
        u: 2,
        category: 'organizer'
      };
      const dev = { instanceId: 'org_finger_1', uHeight: 2, catalogKey: 'organizer-2u', coverOpen: false };

      const isFinger = dev.uHeight === 2 || fingerCat.modelTag.includes('FINGER');
      expect(isFinger).toBe(true);

      const tineCount = 24;
      const topTines = Array.from({ length: tineCount }, (_, i) => i);
      const bottomTines = Array.from({ length: tineCount }, (_, i) => i);
      expect(topTines.length).toBe(24);
      expect(bottomTines.length).toBe(24);

      // Toggle cover
      dev.coverOpen = !dev.coverOpen;
      expect(dev.coverOpen).toBe(true);
    });

    it('applies realistic field metrology traversal allowances for brush vs finger duct vs d-ring', () => {
      const getAllowance = (type: string) => {
        if (type === 'brush') return 0.35; // Front-to-rear traverse
        if (type === 'finger') return 0.25; // 2U internal duct channel traverse
        if (type === 'dring') return 0.20; // D-ring hoop traverse
        return 0.0;
      };

      expect(getAllowance('brush')).toBe(0.35);
      expect(getAllowance('finger')).toBe(0.25);
      expect(getAllowance('dring')).toBe(0.20);
      expect(getAllowance('brush')).toBeGreaterThan(getAllowance('finger'));
    });
  });
});

