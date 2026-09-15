import { DeviceCatalogItem } from '../../types';

function calcBtu(watts: number): number {
  return Math.round(watts * 3.412142);
}

export const PDU_DEVICES: DeviceCatalogItem[] = [
  // 1. 1U Horizontal Basic PDU (8x C13)
  {
    id: 'pdu-1u-basic-8c13',
    name: '1U Horizontal Basic PDU (8x C13)',
    category: 'pdu',
    u: 1,
    manufacturer: 'Estap',
    depthMm: 90,
    weightKg: 1.8,
    powerWatts: 3680,
    dualPsu: false,
    heatBtu: calcBtu(25), // internal dissipation
    heatBtuPerHour: calcBtu(25),
    modelTag: 'PDU-1U-8C13',
    desc: '1U 19" rack-mount basic power distribution unit with 8 rear IEC C13 outlets and illuminated switch.',
    ports: [
      { id: 'switch', name: 'Power Switch', type: 'terminal', xPct: 0.12, yPct: 0.50, facing: 'front' },
      { id: 'breaker', name: '16A Breaker', type: 'terminal', xPct: 0.22, yPct: 0.50, facing: 'front' }
    ],
    rearPorts: [
      ...Array.from({ length: 8 }, (_, i) => ({
        id: `out_c13_${i + 1}`,
        name: `Outlet ${i + 1} (C13)`,
        type: 'c13' as const,
        xPct: Number((0.15 + i * 0.08).toFixed(4)),
        yPct: 0.50,
        facing: 'rear' as const
      })),
      { id: 'inlet_c20', name: 'Mains In (C20 16A)', type: 'c20', xPct: 0.88, yPct: 0.50, facing: 'rear' }
    ]
  },

  // 2. 2U Horizontal HD Switched PDU (12x C13 + 4x C19)
  {
    id: 'pdu-2u-hd-12c13-4c19',
    name: '2U High-Density Switched PDU (12x C13 + 4x C19)',
    category: 'pdu',
    u: 2,
    manufacturer: 'Estap',
    depthMm: 220,
    weightKg: 4.5,
    powerWatts: 7360,
    dualPsu: false,
    heatBtu: calcBtu(60),
    heatBtuPerHour: calcBtu(60),
    modelTag: 'PDU-2U-HD-SW',
    desc: '2U high-density switched and metered PDU with per-outlet control, OLED display, and Ethernet management.',
    ports: [
      { id: 'mgmt_eth', name: 'MGMT (RJ45)', type: 'rj45', speed: '100M', xPct: 0.12, yPct: 0.40, facing: 'front' },
      { id: 'sensor_env', name: 'Sensor Port', type: 'terminal', xPct: 0.20, yPct: 0.40, facing: 'front' },
      { id: 'display', name: 'OLED Display', type: 'terminal', xPct: 0.32, yPct: 0.40, facing: 'front' }
    ],
    rearPorts: [
      ...Array.from({ length: 12 }, (_, i) => ({
        id: `out_c13_${i + 1}`,
        name: `C13 #${i + 1}`,
        type: 'c13' as const,
        row: i % 2,
        xPct: Number((0.10 + Math.floor(i / 2) * 0.09).toFixed(4)),
        yPct: i % 2 === 0 ? 0.30 : 0.70,
        facing: 'rear' as const
      })),
      ...Array.from({ length: 4 }, (_, i) => ({
        id: `out_c19_${i + 1}`,
        name: `C19 #${i + 1}`,
        type: 'c19' as const,
        row: i % 2,
        xPct: Number((0.68 + Math.floor(i / 2) * 0.10).toFixed(4)),
        yPct: i % 2 === 0 ? 0.30 : 0.70,
        facing: 'rear' as const
      })),
      { id: 'mains_inlet', name: 'Mains In (IEC 309 32A)', type: 'c20', xPct: 0.92, yPct: 0.50, facing: 'rear' }
    ]
  },

  // 3. 0U Vertical Intelligent Metered PDU (24 Port)
  {
    id: 'pdu-0u-vert-24port',
    name: '0U Vertical Intelligent Metered PDU (24 Port)',
    category: 'pdu',
    u: 1, // Mounts vertically in 0U cable channel
    manufacturer: 'Estap',
    depthMm: 55,
    weightKg: 5.6,
    powerWatts: 22000,
    dualPsu: false,
    heatBtu: calcBtu(90),
    heatBtuPerHour: calcBtu(90),
    modelTag: 'PDU-0U-24P-3P',
    desc: '0U toolless vertical PDU with 20x C13 + 4x C19 outlets, 3-phase 32A power metering, and environmental monitoring.',
    ports: [
      { id: 'mgmt_eth', name: 'MGMT', type: 'rj45', speed: '1G', xPct: 0.15, yPct: 0.50, facing: 'front' },
      { id: 'sensor', name: 'Temp/Humidity', type: 'terminal', xPct: 0.25, yPct: 0.50, facing: 'front' }
    ],
    rearPorts: [
      ...Array.from({ length: 20 }, (_, i) => ({
        id: `c13_${i + 1}`,
        name: `C13 #${i + 1}`,
        type: 'c13' as const,
        xPct: Number((0.05 + i * 0.04).toFixed(4)),
        yPct: 0.40,
        facing: 'rear' as const
      })),
      ...Array.from({ length: 4 }, (_, i) => ({
        id: `c19_${i + 1}`,
        name: `C19 #${i + 1}`,
        type: 'c19' as const,
        xPct: Number((0.86 + i * 0.03).toFixed(4)),
        yPct: 0.60,
        facing: 'rear' as const
      })),
      { id: 'feed_3p', name: '3-Phase 32A Feed', type: 'c20', xPct: 0.98, yPct: 0.50, facing: 'rear' }
    ]
  },

  // 4. 1U Automatic Transfer Switch (ATS)
  {
    id: 'ats-1u-dual-input',
    name: '1U Dual-Input Automatic Transfer Switch (ATS)',
    category: 'pdu',
    u: 1,
    manufacturer: 'Estap',
    depthMm: 236,
    weightKg: 4.8,
    powerWatts: 3680,
    dualPsu: true,
    heatBtu: calcBtu(40),
    heatBtuPerHour: calcBtu(40),
    modelTag: 'ATS-1U-16A',
    desc: '1U 16A Automatic Transfer Switch providing seamless redundant power switching (<=10ms) across dual feeds.',
    ports: [
      { id: 'status_a', name: 'Source A Active', type: 'terminal', xPct: 0.10, yPct: 0.50, facing: 'front' },
      { id: 'status_b', name: 'Source B Active', type: 'terminal', xPct: 0.18, yPct: 0.50, facing: 'front' },
      { id: 'mgmt_eth', name: 'MGMT', type: 'rj45', speed: '100M', xPct: 0.28, yPct: 0.50, facing: 'front' }
    ],
    rearPorts: [
      { id: 'feed_a', name: 'Source Feed A (C20)', type: 'c20', xPct: 0.10, yPct: 0.50, facing: 'rear' },
      { id: 'feed_b', name: 'Source Feed B (C20)', type: 'c20', xPct: 0.20, yPct: 0.50, facing: 'rear' },
      ...Array.from({ length: 8 }, (_, i) => ({
        id: `out_c13_${i + 1}`,
        name: `C13 #${i + 1}`,
        type: 'c13' as const,
        xPct: Number((0.35 + i * 0.06).toFixed(4)),
        yPct: 0.50,
        facing: 'rear' as const
      })),
      { id: 'out_c19_1', name: 'C19 #1', type: 'c19', xPct: 0.88, yPct: 0.50, facing: 'rear' }
    ]
  }
];
