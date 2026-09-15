import { describe, it, expect, beforeEach } from 'vitest';
import { BUILT_IN_CATALOG } from '../../src/core/catalog';
import {
  getCatalogItem,
  getAllCatalogItems,
  registerCustomDevice,
  syncCustomCatalog,
  CATALOG_ALIASES,
} from '../../src/core/catalog/catalogRegistry';
import { DeviceCatalogItem } from '../../src/core/types';

describe('Hardware Catalog Engine (F3.1)', () => {
  beforeEach(() => {
    // Reset custom catalog registry
    syncCustomCatalog([]);
  });

  it('contains at least 60 authoritative built-in enterprise catalog items', () => {
    expect(BUILT_IN_CATALOG.length).toBeGreaterThanOrEqual(60);
  });

  it('covers all required device categories', () => {
    const categories = new Set(BUILT_IN_CATALOG.map((item: DeviceCatalogItem) => item.category));
    expect(categories.has('switch')).toBe(true);
    expect(categories.has('router')).toBe(true);
    expect(categories.has('server')).toBe(true);
    expect(categories.has('accessory')).toBe(true);
    expect(categories.has('pdu')).toBe(true);
    expect(categories.has('patch-panel')).toBe(true);
  });

  it('resolves authoritative built-in devices by primary ID', () => {
    const c9300 = getCatalogItem('cisco-catalyst-9300-48p');
    expect(c9300).toBeDefined();
    expect(c9300?.manufacturer).toBe('Cisco');
    expect(c9300?.u).toBe(1);
    expect(c9300?.ports.length).toBe(52); // 48 access ports + 4 SFP+ uplinks

    const dellR650 = getCatalogItem('server-dell-r650');
    expect(dellR650).toBeDefined();
    expect(dellR650?.manufacturer).toBe('Dell');
    expect(dellR650?.u).toBe(1);

    const blank1u = getCatalogItem('blank-panel-1u');
    expect(blank1u).toBeDefined();
    expect(blank1u?.category).toBe('blank');
    expect(blank1u?.ports.length).toBe(0);
  });

  it('resolves legacy aliases without breaking backward compatibility', () => {
    // Legacy switch alias
    const switchAlias = getCatalogItem('cisco-3850-24s');
    expect(switchAlias).toBeDefined();
    expect(switchAlias?.name).toContain('3850');
    expect(switchAlias?.manufacturer).toBe('Cisco');

    // Legacy patch panel alias
    const patchAlias = getCatalogItem('patch-panel-24');
    expect(patchAlias).toBeDefined();
    expect(patchAlias?.name).toContain('Patch Panel');

    // Legacy cable organizer alias
    const organizerAlias = getCatalogItem('cable-organizer-1u');
    expect(organizerAlias).toBeDefined();
    expect(organizerAlias?.name).toContain('Brush Panel');

    // Legacy server alias
    const serverAlias = getCatalogItem('server-dell-r740');
    expect(serverAlias).toBeDefined();
    expect(serverAlias?.name).toContain('R750');
  });


  it('maintains 100% integrity of CATALOG_ALIASES targets in BUILT_IN_CATALOG', () => {
    const catalogIds = new Set(BUILT_IN_CATALOG.map((item: DeviceCatalogItem) => item.id));
    for (const [alias, targetId] of Object.entries(CATALOG_ALIASES)) {
      expect(
        catalogIds.has(targetId),
        `Alias "${alias}" targets "${targetId}" which is missing in BUILT_IN_CATALOG`,
      ).toBe(true);
    }
  });

  it('registers and retrieves custom user-defined devices', () => {
    const customDev: DeviceCatalogItem = {
      id: 'custom-firewall-test-1',
      name: 'Custom NGFW 1000',
      manufacturer: 'Fortinet',
      category: 'switch',
      u: 2,
      depthMm: 500,
      weightKg: 8.5,
      powerWatts: 150,
      heatBtuPerHour: 512,
      ports: [
        {
          id: 'p1',
          name: 'port1',
          type: 'rj45',
          facing: 'front',
          xPct: 0.1,
          yPct: 0.5,
        },
      ],
    };

    registerCustomDevice(customDev);

    const retrieved = getCatalogItem('custom-firewall-test-1');
    expect(retrieved).toBeDefined();
    expect(retrieved?.name).toBe('Custom NGFW 1000');
    expect(retrieved?.ports.length).toBe(1);

    const all = getAllCatalogItems();
    expect(all.some((d) => d.id === 'custom-firewall-test-1')).toBe(true);
  });

  it('syncs custom catalog items seamlessly with store updates', () => {
    const customList: DeviceCatalogItem[] = [
      {
        id: 'cust-1',
        name: 'Device A',
        manufacturer: 'Custom',
        category: 'custom',
        u: 1,
        depthMm: 400,
        weightKg: 5,
        powerWatts: 50,
        heatBtuPerHour: 171,
        ports: [],
      },
      {
        id: 'cust-2',
        name: 'Device B',
        manufacturer: 'Custom',
        category: 'custom',
        u: 3,
        depthMm: 600,
        weightKg: 15,
        powerWatts: 200,
        heatBtuPerHour: 682,
        ports: [],
      },
    ];

    syncCustomCatalog(customList);
    expect(getCatalogItem('cust-1')).toBeDefined();
    expect(getCatalogItem('cust-2')).toBeDefined();

    // Re-sync with only 1 item
    syncCustomCatalog([customList[0]!]);
    expect(getCatalogItem('cust-1')).toBeDefined();
    expect(getCatalogItem('cust-2')).toBeUndefined();
  });
});
