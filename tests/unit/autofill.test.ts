import { describe, it, expect, beforeEach } from 'vitest';

describe('Switch-Based Smart Auto-Fill (Auto-Patch Engine)', () => {
  interface Port {
    id: string;
    name: string;
    type: 'rj45' | 'sfp' | 'lc' | 'sc' | 'power';
    speed?: string;
  }

  interface Device {
    instanceId: string;
    catalogKey: string;
    name?: string;
    hostname?: string;
    panelLabel?: string;
    uSlot: number;
    portsConfig?: Record<string, any>;
  }

  interface CatalogItem {
    category: 'switch' | 'patch' | 'fiber' | 'router' | 'organizer';
    modelTag: string;
    name: string;
    ports: Port[];
  }

  interface Cable {
    id: string;
    batchId?: string;
    from: { instanceId: string; portId: string };
    to: { instanceId: string; portId: string };
    color: string;
    role: string;
    isTrunk?: boolean;
  }

  let catalog: Record<string, CatalogItem>;
  let devices: Device[];
  let cables: Cable[];

  beforeEach(() => {
    catalog = {
      'cisco-9300-24p': {
        category: 'switch',
        modelTag: 'C9300-24P',
        name: 'Cisco Catalyst 9300 24-Port PoE+',
        ports: [
          ...Array.from({ length: 24 }, (_, i) => ({
            id: `p${i + 1}`,
            name: `Gi1/0/${i + 1}`,
            type: 'rj45' as const
          })),
          ...Array.from({ length: 4 }, (_, i) => ({
            id: `up${i + 1}`,
            name: `Te1/1/${i + 1}`,
            type: 'sfp' as const,
            speed: '10G Uplink'
          }))
        ]
      },
      'patch-cat6-24': {
        category: 'patch',
        modelTag: 'CAT6-24P',
        name: 'Cat6 24-Port Patch Panel',
        ports: Array.from({ length: 24 }, (_, i) => ({
          id: `pt${i + 1}`,
          name: `Port ${i + 1}`,
          type: 'rj45' as const
        }))
      },
      'fiber-odf-24': {
        category: 'fiber',
        modelTag: 'ODF-24LC',
        name: '24-Port OS2 LC ODF',
        ports: Array.from({ length: 24 }, (_, i) => ({
          id: `lc${i + 1}`,
          name: `LC-${i + 1}`,
          type: 'lc' as const
        }))
      }
    };

    devices = [
      {
        instanceId: 'sw-1',
        catalogKey: 'cisco-9300-24p',
        name: 'SW-CORE-01',
        uSlot: 20
      },
      {
        instanceId: 'patch-near',
        catalogKey: 'patch-cat6-24',
        panelLabel: 'PP-01',
        uSlot: 22 // Distance = 2U
      },
      {
        instanceId: 'patch-far',
        catalogKey: 'patch-cat6-24',
        panelLabel: 'PP-02',
        uSlot: 35 // Distance = 15U
      },
      {
        instanceId: 'fiber-panel',
        catalogKey: 'fiber-odf-24',
        panelLabel: 'ODF-01',
        uSlot: 21 // Distance = 1U
      }
    ];

    cables = [];
  });

  function getOccupiedKeys(cableList: Cable[]): Set<string> {
    const set = new Set<string>();
    cableList.forEach(c => {
      set.add(`${c.from.instanceId}::${c.from.portId}`);
      set.add(`${c.to.instanceId}::${c.to.portId}`);
    });
    return set;
  }

  function findBestPatchPanel(swDev: Device, _excludeUplinks: boolean = true) {
    const swCat = catalog[swDev.catalogKey]!;
    const swU = swDev.uSlot;
    const occupied = getOccupiedKeys(cables);

    const hasCopper = swCat.ports.some(p => p.type === 'rj45');

    const candidates = devices
      .filter(d => d.instanceId !== swDev.instanceId)
      .map(pDev => {
        const pCat = catalog[pDev.catalogKey];
        if (!pCat) return null;
        if (hasCopper && pCat.category !== 'patch') return null;
        if (!hasCopper && pCat.category !== 'fiber') return null;

        const distanceU = Math.abs(swU - pDev.uSlot);
        const freePorts = pCat.ports.filter(p => !occupied.has(`${pDev.instanceId}::${p.id}`));
        return {
          device: pDev,
          catalog: pCat,
          distanceU,
          freePorts
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);

    candidates.sort((a, b) => {
      const aHas = a.freePorts.length > 0 ? 1 : 0;
      const bHas = b.freePorts.length > 0 ? 1 : 0;
      if (aHas !== bHas) return bHas - aHas;
      return a.distanceU - b.distanceU;
    });

    return candidates[0] || null;
  }

  it('selects the closest copper patch panel for a copper switch, skipping fiber ODF', () => {
    const best = findBestPatchPanel(devices[0]!); // sw-1 at U20
    expect(best).not.toBeNull();
    // patch-near is at U22 (distance 2), patch-far is at U35 (distance 15), fiber is at U21 (fiber category)
    expect(best!.device.instanceId).toBe('patch-near');
    expect(best!.distanceU).toBe(2);
    expect(best!.freePorts.length).toBe(24);
  });

  it('generates 24 1:1 port pairs excluding SFP uplink ports by default', () => {
    const sw = devices[0]!;
    const best = findBestPatchPanel(sw)!;
    const occupied = getOccupiedKeys(cables);

    const swCat = catalog[sw.catalogKey]!;
    // Exclude uplinks: keep only rj45 ports
    const swFreePorts = swCat.ports.filter(p => p.type === 'rj45' && !occupied.has(`${sw.instanceId}::${p.id}`));
    const panelFreePorts = best.freePorts;

    const count = Math.min(swFreePorts.length, panelFreePorts.length);
    expect(count).toBe(24);

    const batchId = 'autofill-test-1';
    for (let i = 0; i < count; i++) {
      cables.push({
        id: `CBL-${i + 1}`,
        batchId,
        from: { instanceId: sw.instanceId, portId: swFreePorts[i]!.id },
        to: { instanceId: best.device.instanceId, portId: panelFreePorts[i]!.id },
        color: '#0070d2',
        role: 'access'
      });
    }

    expect(cables.length).toBe(24);
    // All 24 RJ45 ports are occupied
    const newOccupied = getOccupiedKeys(cables);
    expect(newOccupied.has('sw-1::p1')).toBe(true);
    expect(newOccupied.has('sw-1::p24')).toBe(true);
    expect(newOccupied.has('patch-near::pt1')).toBe(true);
    // Uplink ports are untouched
    expect(newOccupied.has('sw-1::up1')).toBe(false);
  });

  it('correctly skips already occupied ports on partial switch filling', () => {
    // Manually pre-occupy ports 1, 2, 3 on switch and ports 1, 2 on panel
    cables.push(
      { id: 'CBL-PRE-1', from: { instanceId: 'sw-1', portId: 'p1' }, to: { instanceId: 'other', portId: 'x1' }, color: '#fff', role: 'access' },
      { id: 'CBL-PRE-2', from: { instanceId: 'sw-1', portId: 'p2' }, to: { instanceId: 'other', portId: 'x2' }, color: '#fff', role: 'access' },
      { id: 'CBL-PRE-3', from: { instanceId: 'patch-near', portId: 'pt1' }, to: { instanceId: 'other', portId: 'x3' }, color: '#fff', role: 'access' }
    );

    const sw = devices[0]!;
    const best = findBestPatchPanel(sw)!;
    const occupied = getOccupiedKeys(cables);

    const swCat = catalog[sw.catalogKey]!;
    const swFreePorts = swCat.ports.filter(p => p.type === 'rj45' && !occupied.has(`${sw.instanceId}::${p.id}`));
    const panelFreePorts = best.freePorts;

    expect(swFreePorts.length).toBe(22); // 24 - 2
    expect(panelFreePorts.length).toBe(23); // 24 - 1
    expect(swFreePorts[0]!.id).toBe('p3');
    expect(panelFreePorts[0]!.id).toBe('pt2');

    const count = Math.min(swFreePorts.length, panelFreePorts.length);
    expect(count).toBe(22);
  });

  it('supports atomic batch undo by removing only cables belonging to the specific batchId', () => {
    // Add 1 standard cable
    cables.push({
      id: 'CBL-MANUAL',
      from: { instanceId: 'sw-1', portId: 'up1' },
      to: { instanceId: 'router-1', portId: 'ge0_0_1' },
      color: '#7c3aed',
      role: 'uplink'
    });

    // Add 24 autofill cables
    const batchId = 'autofill-batch-99';
    for (let i = 1; i <= 24; i++) {
      cables.push({
        id: `CBL-AUTO-${i}`,
        batchId,
        from: { instanceId: 'sw-1', portId: `p${i}` },
        to: { instanceId: 'patch-near', portId: `pt${i}` },
        color: '#0070d2',
        role: 'access'
      });
    }

    expect(cables.length).toBe(25);

    // Undo the autofill batch
    cables = cables.filter(c => c.batchId !== batchId);

    expect(cables.length).toBe(1);
    expect(cables[0]!.id).toBe('CBL-MANUAL');
  });
});
