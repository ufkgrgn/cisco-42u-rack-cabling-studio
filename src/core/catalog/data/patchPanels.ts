import { DeviceCatalogItem, PortDefinition } from '../../types';

function makePatchPorts(
  count: number,
  prefix: string,
  type: PortDefinition['type'],
  rows: 1 | 2 = 1
): PortDefinition[] {
  const ports: PortDefinition[] = [];
  const cols = rows === 1 ? count : Math.ceil(count / 2);

  for (let i = 0; i < count; i++) {
    const col = rows === 1 ? i : Math.floor(i / 2);
    const row = rows === 1 ? 0 : i % 2;
    const xPct = Number((0.06 + (cols > 1 ? (col / (cols - 1)) * 0.88 : 0)).toFixed(4));
    const yPct = rows === 1 ? 0.50 : (row === 0 ? 0.28 : 0.72);

    ports.push({
      id: `pt_${i + 1}`,
      name: `${prefix} ${i + 1}`,
      type,
      row,
      group: Math.floor(i / 6) + 1,
      xPct,
      yPct,
      facing: 'front'
    });
  }

  return ports;
}

export const PATCH_PANELS: DeviceCatalogItem[] = [
  // 1. Cat6A 24-Port STP Shielded Patch Panel (alias patch-panel-24, patch-cat6-24)
  {
    id: 'patch-cat6a-24-stp',
    name: 'Cat6A 24-Port STP Shielded Patch Panel',
    category: 'patch-panel',
    u: 1,
    manufacturer: 'Generic',
    depthMm: 150,
    weightKg: 1.2,
    powerWatts: 0,
    heatBtu: 0,
    heatBtuPerHour: 0,
    modelTag: 'CAT6A-STP-24P',
    desc: '1U 19" 24-Port shielded RJ45 Category 6A patch panel rated for 10GBASE-T applications.',
    ports: makePatchPorts(24, 'P', 'rj45', 1),
    rearPorts: Array.from({ length: 24 }, (_, i) => ({
      id: `rear_pt_${i + 1}`,
      name: `Punchdown ${i + 1}`,
      type: 'rj45' as const,
      xPct: Number((0.06 + (i / 23) * 0.88).toFixed(4)),
      yPct: 0.50,
      facing: 'rear' as const
    }))
  },

  // 2. Cat6 48-Port High-Density Patch Panel
  {
    id: 'patch-cat6-48-hd',
    name: 'Cat6 48-Port 1U High-Density Patch Panel',
    category: 'patch-panel',
    u: 1,
    manufacturer: 'Generic',
    depthMm: 160,
    weightKg: 1.6,
    powerWatts: 0,
    heatBtu: 0,
    heatBtuPerHour: 0,
    modelTag: 'CAT6-HD-48P',
    desc: '1U 19" 48-Port high-density RJ45 patch panel arranged in 2 staggered rows of 24 ports.',
    ports: makePatchPorts(48, 'P', 'rj45', 2),
    rearPorts: Array.from({ length: 48 }, (_, i) => ({
      id: `rear_pt_${i + 1}`,
      name: `Punchdown ${i + 1}`,
      type: 'rj45' as const,
      row: i % 2,
      xPct: Number((0.06 + (Math.floor(i / 2) / 23) * 0.88).toFixed(4)),
      yPct: i % 2 === 0 ? 0.28 : 0.72,
      facing: 'rear' as const
    }))
  },

  // 3. 24-Port OM4 LC Duplex Fiber ODF (alias fiber-odf-24)
  {
    id: 'fiber-odf-24-om4',
    name: '24-Port OM4 LC-Duplex Fiber ODF Tray (48 Cores)',
    category: 'patch-panel',
    u: 1,
    manufacturer: 'Generic',
    depthMm: 240,
    weightKg: 2.5,
    powerWatts: 0,
    heatBtu: 0,
    heatBtuPerHour: 0,
    modelTag: 'ODF-OM4-24LC',
    desc: '1U 19" sliding fiber optic distribution frame with 24 aqua LC-Duplex adapters (48 multimode OM4 cores).',
    ports: makePatchPorts(24, 'ODF LC', 'lc', 1),
    rearPorts: [
      { id: 'cable_entry_left', name: 'Cable Gland Left', type: 'terminal', xPct: 0.15, yPct: 0.50, facing: 'rear' },
      { id: 'cable_entry_right', name: 'Cable Gland Right', type: 'terminal', xPct: 0.85, yPct: 0.50, facing: 'rear' }
    ]
  },

  // 4. 48-Port OM4 LC Duplex Fiber ODF (alias fiber-odf-48)
  {
    id: 'fiber-odf-48-om4',
    name: '48-Port OM4 LC-Duplex High-Density Fiber ODF (96 Cores)',
    category: 'patch-panel',
    u: 1,
    manufacturer: 'Generic',
    depthMm: 280,
    weightKg: 3.2,
    powerWatts: 0,
    heatBtu: 0,
    heatBtuPerHour: 0,
    modelTag: 'ODF-OM4-48LC',
    desc: '1U 19" high-density fiber tray featuring 48 LC-Duplex adapters (96 multimode OM4 cores).',
    ports: makePatchPorts(48, 'ODF LC', 'lc', 2),
    rearPorts: [
      { id: 'cable_entry_left', name: 'Cable Gland Left', type: 'terminal', xPct: 0.15, yPct: 0.50, facing: 'rear' },
      { id: 'cable_entry_right', name: 'Cable Gland Right', type: 'terminal', xPct: 0.85, yPct: 0.50, facing: 'rear' }
    ]
  },

  // 5. 24-Port OS2 Singlemode Fiber ODF
  {
    id: 'fiber-odf-24-os2',
    name: '24-Port OS2 Singlemode LC-Duplex Fiber ODF (48 Cores)',
    category: 'patch-panel',
    u: 1,
    manufacturer: 'Generic',
    depthMm: 240,
    weightKg: 2.5,
    powerWatts: 0,
    heatBtu: 0,
    heatBtuPerHour: 0,
    modelTag: 'ODF-OS2-24LC',
    desc: '1U 19" singlemode distribution panel with 24 blue LC-Duplex adapters for campus backbones and WAN links.',
    ports: makePatchPorts(24, 'OS2 LC', 'lc', 1),
    rearPorts: [
      { id: 'cable_entry_left', name: 'Cable Gland Left', type: 'terminal', xPct: 0.15, yPct: 0.50, facing: 'rear' },
      { id: 'cable_entry_right', name: 'Cable Gland Right', type: 'terminal', xPct: 0.85, yPct: 0.50, facing: 'rear' }
    ]
  }
];
