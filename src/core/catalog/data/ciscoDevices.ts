import { DeviceCatalogItem, PortDefinition } from '../../types';

// Helper to generate normalized 2-row port layout
function make2RowPorts(
  count: number,
  prefix: string,
  type: PortDefinition['type'],
  options: {
    startIdx?: number;
    speed?: string;
    poe?: boolean;
    xStart?: number;
    xEnd?: number;
    idPrefix?: string;
  } = {}
): PortDefinition[] {
  const {
    startIdx = 1,
    speed,
    poe = false,
    xStart = 0.06,
    xEnd = 0.76,
    idPrefix = 'port_'
  } = options;

  const cols = Math.ceil(count / 2);
  const ports: PortDefinition[] = [];

  for (let i = 0; i < count; i++) {
    const col = Math.floor(i / 2);
    const row = i % 2; // 0: top row, 1: bottom row
    const xPct = Number((xStart + (cols > 1 ? (col / (cols - 1)) * (xEnd - xStart) : 0)).toFixed(4));
    const yPct = row === 0 ? 0.28 : 0.72;
    const num = startIdx + i;

    ports.push({
      id: `${idPrefix}${num}`,
      name: `${prefix}${num}`,
      type,
      row,
      group: Math.floor(i / 8) + 1,
      speed,
      poe,
      xPct,
      yPct,
      facing: 'front'
    });
  }

  return ports;
}

function makeUplinkPorts(
  count: number,
  prefix: string,
  type: PortDefinition['type'],
  options: {
    startIdx?: number;
    speed?: string;
    xStart?: number;
    xEnd?: number;
    idPrefix?: string;
  } = {}
): PortDefinition[] {
  const {
    startIdx = 1,
    speed,
    xStart = 0.82,
    xEnd = 0.94,
    idPrefix = 'uplink_'
  } = options;

  const ports: PortDefinition[] = [];
  for (let i = 0; i < count; i++) {
    const xPct = Number((xStart + (count > 1 ? (i / (count - 1)) * (xEnd - xStart) : 0)).toFixed(4));
    ports.push({
      id: `${idPrefix}${startIdx + i}`,
      name: `${prefix}${startIdx + i}`,
      type,
      speed,
      xPct,
      yPct: 0.50,
      facing: 'front'
    });
  }
  return ports;
}

function calcBtu(watts: number): number {
  return Math.round(watts * 3.412142);
}

export const CISCO_DEVICES: DeviceCatalogItem[] = [
  // 1. Cisco ISR 4431
  {
    id: 'cisco-isr-4431',
    name: 'Cisco ISR 4431/K9 Router',
    category: 'router',
    u: 1,
    manufacturer: 'Cisco',
    depthMm: 470,
    weightKg: 9.4,
    powerWatts: 250,
    dualPsu: true,
    heatBtu: calcBtu(250),
    heatBtuPerHour: calcBtu(250),
    modelTag: 'ISR-4431',
    desc: 'Cisco 4431 Integrated Services Router modüler şasi with 4 GE routed ports, dual power supplies and high throughput.',
    ports: [
      { id: 'ge0_0_0', name: 'GE 0/0/0', type: 'rj45', speed: '1G', xPct: 0.08, yPct: 0.40, facing: 'front' },
      { id: 'ge0_0_1', name: 'GE 0/0/1', type: 'rj45', speed: '1G', xPct: 0.16, yPct: 0.40, facing: 'front' },
      { id: 'sfp0_0_2', name: 'SFP 0/0/2', type: 'sfp', speed: '1G', xPct: 0.24, yPct: 0.40, facing: 'front' },
      { id: 'sfp0_0_3', name: 'SFP 0/0/3', type: 'sfp', speed: '1G', xPct: 0.32, yPct: 0.40, facing: 'front' },
      { id: 'mgmt_0', name: 'MGMT', type: 'rj45', speed: '100M', xPct: 0.42, yPct: 0.40, facing: 'front' },
      { id: 'console', name: 'Console', type: 'rj45', xPct: 0.50, yPct: 0.40, facing: 'front' }
    ],
    rearPorts: [
      { id: 'psu_1', name: 'PSU 1 (AC C14)', type: 'c14', xPct: 0.80, yPct: 0.50, facing: 'rear' },
      { id: 'psu_2', name: 'PSU 2 (AC C14)', type: 'c14', xPct: 0.90, yPct: 0.50, facing: 'rear' }
    ]
  },

  // 2. Cisco ASR 1001-X
  {
    id: 'cisco-asr-1001x',
    name: 'Cisco ASR 1001-X Router',
    category: 'router',
    u: 1,
    manufacturer: 'Cisco',
    depthMm: 462,
    weightKg: 11.3,
    powerWatts: 250,
    dualPsu: true,
    heatBtu: calcBtu(250),
    heatBtuPerHour: calcBtu(250),
    modelTag: 'ASR-1001-X',
    desc: 'Cisco ASR 1001-X Aggregation Services Router with 6x 1G SFP and 2x 10G SFP+ uplinks.',
    ports: [
      ...Array.from({ length: 6 }, (_, i) => ({
        id: `sfp_${i + 1}`,
        name: `SFP 0/0/${i}`,
        type: 'sfp' as const,
        speed: '1G',
        xPct: Number((0.08 + i * 0.08).toFixed(4)),
        yPct: 0.45,
        facing: 'front' as const
      })),
      { id: 'sfp10g_1', name: 'TenGig 0/1/0', type: 'sfp+', speed: '10G', xPct: 0.65, yPct: 0.45, facing: 'front' },
      { id: 'sfp10g_2', name: 'TenGig 0/1/1', type: 'sfp+', speed: '10G', xPct: 0.75, yPct: 0.45, facing: 'front' },
      { id: 'mgmt', name: 'MGMT', type: 'rj45', speed: '1G', xPct: 0.85, yPct: 0.45, facing: 'front' }
    ],
    rearPorts: [
      { id: 'psu_1', name: 'PSU 1 (C14)', type: 'c14', xPct: 0.82, yPct: 0.50, facing: 'rear' },
      { id: 'psu_2', name: 'PSU 2 (C14)', type: 'c14', xPct: 0.92, yPct: 0.50, facing: 'rear' }
    ]
  },

  // 3. Cisco Catalyst 3850-24S
  {
    id: 'cisco-catalyst-3850-24s',
    name: 'Cisco Catalyst 3850-24S-S',
    category: 'fiber-switch',
    u: 1,
    manufacturer: 'Cisco',
    depthMm: 450,
    weightKg: 7.2,
    powerWatts: 350,
    dualPsu: true,
    heatBtu: calcBtu(350),
    heatBtuPerHour: calcBtu(350),
    modelTag: 'WS-C3850-24S',
    desc: '24-Port 1G SFP fiber aggregation switch with 4x 10G SFP+ network module slots.',
    ports: [
      ...make2RowPorts(24, 'SFP ', 'sfp', { speed: '1G', xStart: 0.06, xEnd: 0.72, idPrefix: 'sfp_' }),
      ...makeUplinkPorts(4, 'TenGig 1/1/', 'sfp+', { startIdx: 1, speed: '10G', xStart: 0.80, xEnd: 0.94, idPrefix: 'te_' })
    ],
    rearPorts: [
      { id: 'psu_1', name: 'PSU 1 (C14)', type: 'c14', xPct: 0.80, yPct: 0.50, facing: 'rear' },
      { id: 'psu_2', name: 'PSU 2 (C14)', type: 'c14', xPct: 0.90, yPct: 0.50, facing: 'rear' },
      { id: 'mgmt', name: 'MGMT', type: 'rj45', xPct: 0.15, yPct: 0.50, facing: 'rear' }
    ]
  },

  // 4. Cisco Nexus 93180YC-FX
  {
    id: 'cisco-nexus-93180yc',
    name: 'Cisco Nexus 93180YC-FX',
    category: 'switch',
    u: 1,
    manufacturer: 'Cisco',
    depthMm: 571,
    weightKg: 9.5,
    powerWatts: 500,
    dualPsu: true,
    heatBtu: calcBtu(500),
    heatBtuPerHour: calcBtu(500),
    modelTag: 'N9K-C93180YC-FX',
    desc: 'High-density Top-of-Rack data center switch with 48x 10/25G SFP28 and 6x 100G QSFP28 uplinks.',
    ports: [
      ...make2RowPorts(48, 'SFP28 ', 'sfp28', { speed: '25G', xStart: 0.05, xEnd: 0.70, idPrefix: 'port_' }),
      ...makeUplinkPorts(6, 'QSFP28 ', 'qsfp28', { startIdx: 49, speed: '100G', xStart: 0.76, xEnd: 0.95, idPrefix: 'qsfp_' })
    ],
    rearPorts: [
      { id: 'psu_1', name: 'PSU 1 (C14)', type: 'c14', xPct: 0.78, yPct: 0.50, facing: 'rear' },
      { id: 'psu_2', name: 'PSU 2 (C14)', type: 'c14', xPct: 0.88, yPct: 0.50, facing: 'rear' },
      { id: 'mgmt0', name: 'mgmt0', type: 'rj45', xPct: 0.10, yPct: 0.50, facing: 'rear' },
      { id: 'console', name: 'Console', type: 'rj45', xPct: 0.18, yPct: 0.50, facing: 'rear' }
    ]
  },

  // 5. Cisco Catalyst 9500-24Y4C
  {
    id: 'cisco-catalyst-9500-24y4c',
    name: 'Cisco Catalyst 9500-24Y4C',
    category: 'switch',
    u: 1,
    manufacturer: 'Cisco',
    depthMm: 457,
    weightKg: 8.8,
    powerWatts: 650,
    dualPsu: true,
    heatBtu: calcBtu(650),
    heatBtuPerHour: calcBtu(650),
    modelTag: 'C9500-24Y4C',
    desc: 'Campus core omurga anahtar switch offering 24 ports of 25G SFP28 and 4 ports of 100G QSFP28 uplink.',
    ports: [
      ...make2RowPorts(24, '25G ', 'sfp28', { speed: '25G', xStart: 0.06, xEnd: 0.68, idPrefix: 'port_' }),
      ...makeUplinkPorts(4, '100G ', 'qsfp28', { startIdx: 25, speed: '100G', xStart: 0.76, xEnd: 0.94, idPrefix: 'qsfp_' })
    ],
    rearPorts: [
      { id: 'psu_1', name: 'PSU 1 (C14)', type: 'c14', xPct: 0.80, yPct: 0.50, facing: 'rear' },
      { id: 'psu_2', name: 'PSU 2 (C14)', type: 'c14', xPct: 0.90, yPct: 0.50, facing: 'rear' }
    ]
  },

  // 6. Cisco Catalyst 9300X-48HX
  {
    id: 'cisco-catalyst-9300x-48hx',
    name: 'Cisco Catalyst 9300X-48HX',
    category: 'switch',
    u: 1,
    manufacturer: 'Cisco',
    depthMm: 488,
    weightKg: 7.9,
    powerWatts: 1100,
    dualPsu: true,
    heatBtu: calcBtu(1100),
    heatBtuPerHour: calcBtu(1100),
    modelTag: 'C9300X-48HX',
    desc: '48-Port mGig multigigabit switch kurumsal dağıtım anahtarı with 90W Cisco UPOE+ and 4x 25G SFP28 modular uplinks.',
    ports: [
      ...make2RowPorts(48, 'mGig ', 'rj45', { speed: '10G', poe: true, xStart: 0.05, xEnd: 0.74, idPrefix: 'mgig_' }),
      ...makeUplinkPorts(4, '25G ', 'sfp28', { startIdx: 49, speed: '25G', xStart: 0.80, xEnd: 0.94, idPrefix: 'uplink_' })
    ],
    rearPorts: [
      { id: 'psu_1', name: 'PSU 1 (C16)', type: 'c14', xPct: 0.80, yPct: 0.50, facing: 'rear' },
      { id: 'psu_2', name: 'PSU 2 (C16)', type: 'c14', xPct: 0.90, yPct: 0.50, facing: 'rear' }
    ]
  },

  // 7. Cisco Catalyst 9300L-24P
  {
    id: 'cisco-catalyst-9300l-24p',
    name: 'Cisco Catalyst 9300L-24P-4X',
    category: 'switch',
    u: 1,
    manufacturer: 'Cisco',
    depthMm: 409,
    weightKg: 6.8,
    powerWatts: 505,
    dualPsu: true,
    heatBtu: calcBtu(505),
    heatBtuPerHour: calcBtu(505),
    modelTag: 'C9300L-24P-4X',
    desc: '24-Port Gigabit PoE+ (505W budget) enterprise switch with 4 fixed 10G SFP+ uplinks.',
    ports: [
      ...make2RowPorts(24, 'GE ', 'rj45', { speed: '1G', poe: true, xStart: 0.06, xEnd: 0.72, idPrefix: 'ge_' }),
      ...makeUplinkPorts(4, '10G ', 'sfp+', { startIdx: 25, speed: '10G', xStart: 0.78, xEnd: 0.94, idPrefix: 'te_' })
    ],
    rearPorts: [
      { id: 'psu_1', name: 'PSU 1 (C14)', type: 'c14', xPct: 0.80, yPct: 0.50, facing: 'rear' },
      { id: 'psu_2', name: 'PSU 2 (C14)', type: 'c14', xPct: 0.90, yPct: 0.50, facing: 'rear' }
    ]
  },

  // 8. Cisco Catalyst 9300-48P
  {
    id: 'cisco-catalyst-9300-48p',
    name: 'Cisco Catalyst 9300-48P',
    category: 'switch',
    u: 1,
    manufacturer: 'Cisco',
    depthMm: 445,
    weightKg: 7.6,
    powerWatts: 715,
    dualPsu: true,
    heatBtu: calcBtu(715),
    heatBtuPerHour: calcBtu(715),
    modelTag: 'C9300-48P',
    desc: '48-Port 1G PoE+ (715W budget) enterprise switch with 4x 10G SFP+ modular uplinks.',
    ports: [
      ...make2RowPorts(48, 'GE ', 'rj45', { speed: '1G', poe: true, xStart: 0.05, xEnd: 0.74, idPrefix: 'port_' }),
      ...makeUplinkPorts(4, '10G ', 'sfp+', { startIdx: 49, speed: '10G', xStart: 0.80, xEnd: 0.94, idPrefix: 'uplink_' })
    ],
    rearPorts: [
      { id: 'psu_1', name: 'PSU 1 (C14)', type: 'c14', xPct: 0.80, yPct: 0.50, facing: 'rear' },
      { id: 'psu_2', name: 'PSU 2 (C14)', type: 'c14', xPct: 0.90, yPct: 0.50, facing: 'rear' }
    ]
  },

  // 9. Cisco Catalyst 9200L-24P
  {
    id: 'cisco-catalyst-9200l-24p',
    name: 'Cisco Catalyst 9200L-24P-4X',
    category: 'switch',
    u: 1,
    manufacturer: 'Cisco',
    depthMm: 288,
    weightKg: 4.5,
    powerWatts: 370,
    dualPsu: false,
    heatBtu: calcBtu(370),
    heatBtuPerHour: calcBtu(370),
    modelTag: 'C9200L-24P-4X',
    desc: '24-Port 1G PoE+ (370W) fixed uplink switch with 4x 10G SFP+ ports.',
    ports: [
      ...make2RowPorts(24, 'GE ', 'rj45', { speed: '1G', poe: true, xStart: 0.06, xEnd: 0.72, idPrefix: 'ge_' }),
      ...makeUplinkPorts(4, '10G ', 'sfp+', { startIdx: 25, speed: '10G', xStart: 0.78, xEnd: 0.94, idPrefix: 'te_' })
    ],
    rearPorts: [
      { id: 'psu_1', name: 'PSU (C14)', type: 'c14', xPct: 0.85, yPct: 0.50, facing: 'rear' }
    ]
  },

  // 10. Cisco Catalyst 9200-48P
  {
    id: 'cisco-catalyst-9200-48p',
    name: 'Cisco Catalyst 9200-48P-4G',
    category: 'switch',
    u: 1,
    manufacturer: 'Cisco',
    depthMm: 350,
    weightKg: 5.5,
    powerWatts: 740,
    dualPsu: true,
    heatBtu: calcBtu(740),
    heatBtuPerHour: calcBtu(740),
    modelTag: 'C9200-48P-4G',
    desc: '48-Port 1G PoE+ enterprise switch with 4x 1G SFP uplinks and dual power supply support.',
    ports: [
      ...make2RowPorts(48, 'GE ', 'rj45', { speed: '1G', poe: true, xStart: 0.05, xEnd: 0.74, idPrefix: 'port_' }),
      ...makeUplinkPorts(4, '1G ', 'sfp', { startIdx: 49, speed: '1G', xStart: 0.80, xEnd: 0.94, idPrefix: 'sfp_' })
    ],
    rearPorts: [
      { id: 'psu_1', name: 'PSU 1 (C14)', type: 'c14', xPct: 0.80, yPct: 0.50, facing: 'rear' },
      { id: 'psu_2', name: 'PSU 2 (C14)', type: 'c14', xPct: 0.90, yPct: 0.50, facing: 'rear' }
    ]
  },

  // 11. Cisco Catalyst 1000-24P
  {
    id: 'cisco-catalyst-1000-24p',
    name: 'Cisco Catalyst 1000-24P-4G-L',
    category: 'switch',
    u: 1,
    manufacturer: 'Cisco',
    depthMm: 299,
    weightKg: 3.8,
    powerWatts: 195,
    dualPsu: false,
    heatBtu: calcBtu(195),
    heatBtuPerHour: calcBtu(195),
    modelTag: 'C1000-24P-4G-L',
    desc: '24-Port 1G PoE+ (195W) compact enterprise access switch with 4x 1G SFP uplinks.',
    ports: [
      ...make2RowPorts(24, 'GE ', 'rj45', { speed: '1G', poe: true, xStart: 0.06, xEnd: 0.72, idPrefix: 'ge_' }),
      ...makeUplinkPorts(4, 'SFP ', 'sfp', { startIdx: 25, speed: '1G', xStart: 0.78, xEnd: 0.94, idPrefix: 'sfp_' })
    ],
    rearPorts: [
      { id: 'psu_1', name: 'PSU (C14)', type: 'c14', xPct: 0.85, yPct: 0.50, facing: 'rear' }
    ]
  },

  // 12. Cisco Catalyst 1000-48P
  {
    id: 'cisco-catalyst-1000-48p',
    name: 'Cisco Catalyst 1000-48P-4G-L',
    category: 'switch',
    u: 1,
    manufacturer: 'Cisco',
    depthMm: 339,
    weightKg: 5.4,
    powerWatts: 370,
    dualPsu: false,
    heatBtu: calcBtu(370),
    heatBtuPerHour: calcBtu(370),
    modelTag: 'C1000-48P-4G-L',
    desc: '48-Port 1G PoE+ (370W) enterprise access switch with 4x 1G SFP uplinks.',
    ports: [
      ...make2RowPorts(48, 'GE ', 'rj45', { speed: '1G', poe: true, xStart: 0.05, xEnd: 0.74, idPrefix: 'port_' }),
      ...makeUplinkPorts(4, 'SFP ', 'sfp', { startIdx: 49, speed: '1G', xStart: 0.80, xEnd: 0.94, idPrefix: 'sfp_' })
    ],
    rearPorts: [
      { id: 'psu_1', name: 'PSU (C14)', type: 'c14', xPct: 0.85, yPct: 0.50, facing: 'rear' }
    ]
  },

  // 13. Cisco Catalyst 2960X-24PS
  {
    id: 'cisco-catalyst-2960x-24ps',
    name: 'Cisco Catalyst 2960X-24PS-L',
    category: 'switch',
    u: 1,
    manufacturer: 'Cisco',
    depthMm: 368,
    weightKg: 5.8,
    powerWatts: 370,
    dualPsu: false,
    heatBtu: calcBtu(370),
    heatBtuPerHour: calcBtu(370),
    modelTag: 'WS-C2960X-24PS-L',
    desc: '24-Port 1G PoE+ (370W) Layer 2 switch with 4x 1G SFP uplinks and FlexStack support.',
    ports: [
      ...make2RowPorts(24, 'Gi1/0/', 'rj45', { speed: '1G', poe: true, xStart: 0.06, xEnd: 0.72, idPrefix: 'ge_' }),
      ...makeUplinkPorts(4, 'Te1/0/', 'sfp', { startIdx: 25, speed: '1G', xStart: 0.78, xEnd: 0.94, idPrefix: 'sfp_' })
    ],
    rearPorts: [
      { id: 'psu_1', name: 'PSU (C14)', type: 'c14', xPct: 0.85, yPct: 0.50, facing: 'rear' }
    ]
  },

  // 14. Cisco Catalyst 2960XR-24PS
  {
    id: 'cisco-catalyst-2960xr-24ps',
    name: 'Cisco Catalyst 2960XR-24PS-I',
    category: 'switch',
    u: 1,
    manufacturer: 'Cisco',
    depthMm: 408,
    weightKg: 6.2,
    powerWatts: 370,
    dualPsu: true,
    heatBtu: calcBtu(370),
    heatBtuPerHour: calcBtu(370),
    modelTag: 'WS-C2960XR-24PS-I',
    desc: '24-Port 1G PoE+ Layer 3 routing switch with dual hot-swap power supplies and 2x 10G SFP+.',
    ports: [
      ...make2RowPorts(24, 'Gi1/0/', 'rj45', { speed: '1G', poe: true, xStart: 0.06, xEnd: 0.72, idPrefix: 'ge_' }),
      ...makeUplinkPorts(2, 'Te1/0/', 'sfp+', { startIdx: 25, speed: '10G', xStart: 0.82, xEnd: 0.92, idPrefix: 'te_' })
    ],
    rearPorts: [
      { id: 'psu_1', name: 'PSU 1 (C14)', type: 'c14', xPct: 0.80, yPct: 0.50, facing: 'rear' },
      { id: 'psu_2', name: 'PSU 2 (C14)', type: 'c14', xPct: 0.90, yPct: 0.50, facing: 'rear' }
    ]
  },

  // 15. Cisco Catalyst 2960X-24TS
  {
    id: 'cisco-catalyst-2960x-24ts',
    name: 'Cisco Catalyst 2960-X 24TS-L',
    category: 'switch',
    u: 1,
    manufacturer: 'Cisco',
    depthMm: 279,
    weightKg: 4.0,
    powerWatts: 45,
    dualPsu: false,
    heatBtu: calcBtu(45),
    heatBtuPerHour: calcBtu(45),
    modelTag: 'WS-C2960X-24TS-L',
    desc: '24-Port 1G Data switch with 4x 1G SFP uplinks and low power consumption.',
    ports: [
      ...make2RowPorts(24, 'Gi1/0/', 'rj45', { speed: '1G', poe: false, xStart: 0.06, xEnd: 0.72, idPrefix: 'ge_' }),
      ...makeUplinkPorts(4, 'Te1/0/', 'sfp', { startIdx: 25, speed: '1G', xStart: 0.78, xEnd: 0.94, idPrefix: 'sfp_' })
    ],
    rearPorts: [
      { id: 'psu_1', name: 'PSU (C14)', type: 'c14', xPct: 0.85, yPct: 0.50, facing: 'rear' }
    ]
  },

  // 16. Cisco Catalyst 2960-24PC
  {
    id: 'cisco-catalyst-2960-24pc',
    name: 'Cisco Catalyst 2960-24PC-L',
    category: 'switch',
    u: 1,
    manufacturer: 'Cisco',
    depthMm: 332,
    weightKg: 5.4,
    powerWatts: 370,
    dualPsu: false,
    heatBtu: calcBtu(370),
    heatBtuPerHour: calcBtu(370),
    modelTag: 'WS-C2960-24PC-L',
    desc: 'Classic 24-Port 10/100 PoE Fast Ethernet switch with 2 dual-purpose 10/100/1000 or SFP uplinks.',
    ports: [
      ...make2RowPorts(24, 'Fa0/', 'rj45', { speed: '100M', poe: true, xStart: 0.06, xEnd: 0.74, idPrefix: 'fa_' }),
      ...makeUplinkPorts(2, 'Dual GE ', 'rj45', { startIdx: 1, speed: '1G', xStart: 0.80, xEnd: 0.90, idPrefix: 'up_' })
    ],
    rearPorts: [
      { id: 'psu_1', name: 'PSU (C14)', type: 'c14', xPct: 0.85, yPct: 0.50, facing: 'rear' }
    ]
  },

  // 17. Cisco Catalyst 2960-24TC
  {
    id: 'cisco-catalyst-2960-24tc',
    name: 'Cisco Catalyst 2960-24TC-L',
    category: 'switch',
    u: 1,
    manufacturer: 'Cisco',
    depthMm: 236,
    weightKg: 3.6,
    powerWatts: 30,
    dualPsu: false,
    heatBtu: calcBtu(30),
    heatBtuPerHour: calcBtu(30),
    modelTag: 'WS-C2960-24TC-L',
    desc: 'Classic 24-Port 10/100 Data switch with 2 dual-purpose Gigabit / SFP uplink ports.',
    ports: [
      ...make2RowPorts(24, 'Fa0/', 'rj45', { speed: '100M', poe: false, xStart: 0.06, xEnd: 0.74, idPrefix: 'fa_' }),
      ...makeUplinkPorts(2, 'GE/SFP ', 'rj45', { startIdx: 1, speed: '1G', xStart: 0.80, xEnd: 0.90, idPrefix: 'up_' })
    ],
    rearPorts: [
      { id: 'psu_1', name: 'PSU (C14)', type: 'c14', xPct: 0.85, yPct: 0.50, facing: 'rear' }
    ]
  },

  // 18. Cisco Catalyst 2960-48TC
  {
    id: 'cisco-catalyst-2960-48tc',
    name: 'Cisco Catalyst 2960-48TC-L',
    category: 'switch',
    u: 1,
    manufacturer: 'Cisco',
    depthMm: 236,
    weightKg: 4.1,
    powerWatts: 45,
    dualPsu: false,
    heatBtu: calcBtu(45),
    heatBtuPerHour: calcBtu(45),
    modelTag: 'WS-C2960-48TC-L',
    desc: '48-Port 10/100 Fast Ethernet data switch with 2x 1G RJ45 and 2x 1G SFP uplinks.',
    ports: [
      ...make2RowPorts(48, 'Fa0/', 'rj45', { speed: '100M', poe: false, xStart: 0.05, xEnd: 0.74, idPrefix: 'fa_' }),
      ...makeUplinkPorts(2, 'GE ', 'rj45', { startIdx: 1, speed: '1G', xStart: 0.78, xEnd: 0.84, idPrefix: 'ge_' }),
      ...makeUplinkPorts(2, 'SFP ', 'sfp', { startIdx: 1, speed: '1G', xStart: 0.88, xEnd: 0.94, idPrefix: 'sfp_' })
    ],
    rearPorts: [
      { id: 'psu_1', name: 'PSU (C14)', type: 'c14', xPct: 0.85, yPct: 0.50, facing: 'rear' }
    ]
  },

  // 19. Cisco Catalyst 3560X-24T
  {
    id: 'cisco-catalyst-3560x-24t',
    name: 'Cisco Catalyst 3560X-24T-S',
    category: 'switch',
    u: 1,
    manufacturer: 'Cisco',
    depthMm: 460,
    weightKg: 7.0,
    powerWatts: 350,
    dualPsu: true,
    heatBtu: calcBtu(350),
    heatBtuPerHour: calcBtu(350),
    modelTag: 'WS-C3560X-24T-S',
    desc: '24-Port 1G enterprise routing switch with redundant power supplies and modular uplinks.',
    ports: [
      ...make2RowPorts(24, 'Gi0/', 'rj45', { speed: '1G', poe: false, xStart: 0.06, xEnd: 0.72, idPrefix: 'ge_' }),
      ...makeUplinkPorts(4, 'SFP+ ', 'sfp+', { startIdx: 1, speed: '10G', xStart: 0.78, xEnd: 0.94, idPrefix: 'sfp_' })
    ],
    rearPorts: [
      { id: 'psu_1', name: 'PSU 1 (C14)', type: 'c14', xPct: 0.80, yPct: 0.50, facing: 'rear' },
      { id: 'psu_2', name: 'PSU 2 (C14)', type: 'c14', xPct: 0.90, yPct: 0.50, facing: 'rear' }
    ]
  },

  // 20. Cisco Catalyst 3560-8PC (Compact)
  {
    id: 'cisco-catalyst-3560-8pc',
    name: 'Cisco Catalyst 3560-8PC-S',
    category: 'compact',
    u: 1,
    manufacturer: 'Cisco',
    depthMm: 231,
    weightKg: 2.3,
    powerWatts: 123,
    dualPsu: false,
    heatBtu: calcBtu(123),
    heatBtuPerHour: calcBtu(123),
    modelTag: 'WS-C3560-8PC-S',
    desc: 'Compact fanless 8-port 10/100 PoE switch with 1 dual-purpose 10/100/1000 or SFP uplink.',
    ports: [
      ...Array.from({ length: 8 }, (_, i) => ({
        id: `fa_${i + 1}`,
        name: `Fa0/${i + 1}`,
        type: 'rj45' as const,
        speed: '100M',
        poe: true,
        xPct: Number((0.15 + i * 0.07).toFixed(4)),
        yPct: 0.50,
        facing: 'front' as const
      })),
      { id: 'uplink_1', name: 'GE/SFP', type: 'rj45', speed: '1G', xPct: 0.82, yPct: 0.50, facing: 'front' }
    ],
    rearPorts: [
      { id: 'psu', name: 'PSU (C14)', type: 'c14', xPct: 0.85, yPct: 0.50, facing: 'rear' }
    ]
  },

  // 21. Cisco Catalyst 2960CX-8PC (Compact)
  {
    id: 'cisco-catalyst-2960cx-8pc',
    name: 'Cisco Catalyst 2960CX-8PC-L',
    category: 'compact',
    u: 1,
    manufacturer: 'Cisco',
    depthMm: 269,
    weightKg: 2.7,
    powerWatts: 240,
    dualPsu: false,
    heatBtu: calcBtu(240),
    heatBtuPerHour: calcBtu(240),
    modelTag: 'WS-C2960CX-8PC-L',
    desc: 'Compact quiet 8-port 1G PoE+ switch with 2 copper and 2 SFP uplinks.',
    ports: [
      ...Array.from({ length: 8 }, (_, i) => ({
        id: `ge_${i + 1}`,
        name: `Gi0/${i + 1}`,
        type: 'rj45' as const,
        speed: '1G',
        poe: true,
        xPct: Number((0.12 + i * 0.07).toFixed(4)),
        yPct: 0.50,
        facing: 'front' as const
      })),
      { id: 'up_cu_1', name: 'Gi0/9 (Cu)', type: 'rj45', speed: '1G', xPct: 0.74, yPct: 0.50, facing: 'front' },
      { id: 'up_cu_2', name: 'Gi0/10 (Cu)', type: 'rj45', speed: '1G', xPct: 0.80, yPct: 0.50, facing: 'front' },
      { id: 'up_sfp_1', name: 'Gi0/11 (SFP)', type: 'sfp', speed: '1G', xPct: 0.88, yPct: 0.50, facing: 'front' },
      { id: 'up_sfp_2', name: 'Gi0/12 (SFP)', type: 'sfp', speed: '1G', xPct: 0.94, yPct: 0.50, facing: 'front' }
    ],
    rearPorts: [
      { id: 'psu', name: 'PSU (C14)', type: 'c14', xPct: 0.85, yPct: 0.50, facing: 'rear' }
    ]
  },

  // 22. Cisco Catalyst 2960G-8TC (Compact Data)
  {
    id: 'cisco-catalyst-2960g-8tc',
    name: 'Cisco Catalyst 2960G-8TC-L',
    category: 'compact',
    u: 1,
    manufacturer: 'Cisco',
    depthMm: 204,
    weightKg: 2.1,
    powerWatts: 30,
    dualPsu: false,
    heatBtu: calcBtu(30),
    heatBtuPerHour: calcBtu(30),
    modelTag: 'WS-C2960G-8TC-L',
    desc: 'Compact fanless 8-port 1G data switch with 1 dual-purpose Gigabit/SFP uplink.',
    ports: [
      ...Array.from({ length: 7 }, (_, i) => ({
        id: `ge_${i + 1}`,
        name: `Gi0/${i + 1}`,
        type: 'rj45' as const,
        speed: '1G',
        xPct: Number((0.15 + i * 0.08).toFixed(4)),
        yPct: 0.50,
        facing: 'front' as const
      })),
      { id: 'dual_uplink', name: 'Gi0/8 (Dual GE/SFP)', type: 'rj45', speed: '1G', xPct: 0.82, yPct: 0.50, facing: 'front' }
    ],
    rearPorts: [
      { id: 'psu', name: 'PSU (C14)', type: 'c14', xPct: 0.85, yPct: 0.50, facing: 'rear' }
    ]
  }
];
