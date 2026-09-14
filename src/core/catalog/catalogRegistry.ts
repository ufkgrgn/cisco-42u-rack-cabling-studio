import { DeviceCatalogItem } from '../types';

export const BUILT_IN_CATALOG: DeviceCatalogItem[] = [
  {
    id: 'cisco-isr-4431',
    name: 'Cisco ISR 4431/K9 Router',
    category: 'router',
    u: 1,
    manufacturer: 'Cisco',
    depthMm: 470,
    powerWatts: 250,
    ports: [
      { id: 'ge0_0_0', name: 'GE 0/0/0', type: 'rj45' },
      { id: 'ge0_0_1', name: 'GE 0/0/1', type: 'rj45' },
      { id: 'sfp0_0_2', name: 'SFP 0/0/2', type: 'sfp' },
      { id: 'sfp0_0_3', name: 'SFP 0/0/3', type: 'sfp' }
    ]
  },
  {
    id: 'cisco-catalyst-3850-24s',
    name: 'Cisco Catalyst 3850-24S-S',
    category: 'switch',
    u: 1,
    manufacturer: 'Cisco',
    depthMm: 450,
    powerWatts: 350,
    ports: Array.from({ length: 24 }, (_, i) => ({
      id: `sfp_${i + 1}`,
      name: `SFP ${i + 1}`,
      type: 'sfp' as const
    }))
  },
  {
    id: 'cisco-catalyst-9300',
    name: 'Cisco Catalyst 9300-48P',
    category: 'switch',
    u: 1,
    manufacturer: 'Cisco',
    depthMm: 445,
    powerWatts: 715,
    ports: Array.from({ length: 48 }, (_, i) => ({
      id: `port_${i + 1}`,
      name: `GE ${i + 1}`,
      type: 'rj45' as const,
      poe: true
    }))
  },
  {
    id: 'patch-panel-24',
    name: 'Cat6 24-Port Patch Panel',
    category: 'patch-panel',
    u: 1,
    manufacturer: 'Generic',
    depthMm: 150,
    ports: Array.from({ length: 24 }, (_, i) => ({
      id: `pt_${i + 1}`,
      name: `P ${i + 1}`,
      type: 'rj45' as const
    }))
  },
  {
    id: 'cable-organizer-1u',
    name: '1U Horizontal Cable Organizer',
    category: 'organizer',
    u: 1,
    manufacturer: 'Estap',
    depthMm: 80,
    ports: []
  },
  {
    id: 'server-dell-r740',
    name: 'Dell PowerEdge R740 2U',
    category: 'server',
    u: 2,
    manufacturer: 'Dell',
    depthMm: 700,
    powerWatts: 750,
    ports: [
      { id: 'nic_1', name: 'NIC 1', type: 'rj45' },
      { id: 'nic_2', name: 'NIC 2', type: 'rj45' },
      { id: 'sfp_1', name: 'SFP+ 1', type: 'sfp+' },
      { id: 'sfp_2', name: 'SFP+ 2', type: 'sfp+' }
    ]
  }
];

export const catalogRegistry = new Map<string, DeviceCatalogItem>();
for (const item of BUILT_IN_CATALOG) {
  catalogRegistry.set(item.id, item);
}
