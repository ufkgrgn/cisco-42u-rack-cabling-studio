import { DeviceCatalogItem } from '../../types';

function calcBtu(watts: number): number {
  return Math.round(watts * 3.412142);
}

export const SERVER_DEVICES: DeviceCatalogItem[] = [
  // 1. Dell PowerEdge R650 (1U)
  {
    id: 'server-dell-r650',
    name: 'Dell PowerEdge R650 1U',
    category: 'server',
    u: 1,
    manufacturer: 'Dell',
    depthMm: 751,
    weightKg: 21.9,
    powerWatts: 800,
    dualPsu: true,
    heatBtu: calcBtu(800),
    heatBtuPerHour: calcBtu(800),
    modelTag: 'PowerEdge-R650',
    desc: 'Dell PowerEdge R650 1U 2-socket enterprise rack server with dual redundant PSUs and high-density compute.',
    ports: [
      { id: 'vga_front', name: 'Front VGA', type: 'terminal', xPct: 0.12, yPct: 0.50, facing: 'front' },
      { id: 'idrac_direct', name: 'iDRAC Direct', type: 'terminal', xPct: 0.20, yPct: 0.50, facing: 'front' }
    ],
    rearPorts: [
      { id: 'idrac_mgmt', name: 'iDRAC9 MGMT', type: 'rj45', speed: '1G', xPct: 0.12, yPct: 0.50, facing: 'rear' },
      { id: 'nic_1', name: 'NIC 1 (Base-T)', type: 'rj45', speed: '1G', xPct: 0.24, yPct: 0.35, facing: 'rear' },
      { id: 'nic_2', name: 'NIC 2 (Base-T)', type: 'rj45', speed: '1G', xPct: 0.32, yPct: 0.35, facing: 'rear' },
      { id: 'nic_3', name: 'NIC 3 (Base-T)', type: 'rj45', speed: '1G', xPct: 0.24, yPct: 0.65, facing: 'rear' },
      { id: 'nic_4', name: 'NIC 4 (Base-T)', type: 'rj45', speed: '1G', xPct: 0.32, yPct: 0.65, facing: 'rear' },
      { id: 'sfp_1', name: '10G SFP+ 1', type: 'sfp+', speed: '10G', xPct: 0.44, yPct: 0.50, facing: 'rear' },
      { id: 'sfp_2', name: '10G SFP+ 2', type: 'sfp+', speed: '10G', xPct: 0.52, yPct: 0.50, facing: 'rear' },
      { id: 'psu_1', name: 'PSU 1 (800W C14)', type: 'c14', xPct: 0.80, yPct: 0.50, facing: 'rear' },
      { id: 'psu_2', name: 'PSU 2 (800W C14)', type: 'c14', xPct: 0.90, yPct: 0.50, facing: 'rear' }
    ]
  },

  // 2. Dell PowerEdge R750 (2U) [alias server-dell-r740]
  {
    id: 'server-dell-r750',
    name: 'Dell PowerEdge R750 2U',
    category: 'server',
    u: 2,
    manufacturer: 'Dell',
    depthMm: 758,
    weightKg: 28.6,
    powerWatts: 1400,
    dualPsu: true,
    heatBtu: calcBtu(1400),
    heatBtuPerHour: calcBtu(1400),
    modelTag: 'PowerEdge-R750',
    desc: 'Dell PowerEdge R750 2U 2-socket rack server optimized for application performance and storage acceleration.',
    ports: [
      { id: 'vga_front', name: 'Front VGA', type: 'terminal', xPct: 0.10, yPct: 0.40, facing: 'front' },
      { id: 'idrac_direct', name: 'iDRAC Direct', type: 'terminal', xPct: 0.18, yPct: 0.40, facing: 'front' }
    ],
    rearPorts: [
      { id: 'idrac_mgmt', name: 'iDRAC9 MGMT', type: 'rj45', speed: '1G', xPct: 0.10, yPct: 0.50, facing: 'rear' },
      { id: 'nic_1', name: 'NIC 1 (10G Base-T)', type: 'rj45', speed: '10G', xPct: 0.22, yPct: 0.40, facing: 'rear' },
      { id: 'nic_2', name: 'NIC 2 (10G Base-T)', type: 'rj45', speed: '10G', xPct: 0.30, yPct: 0.40, facing: 'rear' },
      { id: 'sfp_1', name: '25G SFP28 1', type: 'sfp28', speed: '25G', xPct: 0.42, yPct: 0.40, facing: 'rear' },
      { id: 'sfp_2', name: '25G SFP28 2', type: 'sfp28', speed: '25G', xPct: 0.50, yPct: 0.40, facing: 'rear' },
      { id: 'psu_1', name: 'PSU 1 (1400W C14)', type: 'c14', xPct: 0.80, yPct: 0.50, facing: 'rear' },
      { id: 'psu_2', name: 'PSU 2 (1400W C14)', type: 'c14', xPct: 0.90, yPct: 0.50, facing: 'rear' }
    ]
  },

  // 3. HPE ProLiant DL360 Gen10 (1U)
  {
    id: 'server-hpe-dl360-gen10',
    name: 'HPE ProLiant DL360 Gen10 1U',
    category: 'server',
    u: 1,
    manufacturer: 'HPE',
    depthMm: 750,
    weightKg: 16.3,
    powerWatts: 800,
    dualPsu: true,
    heatBtu: calcBtu(800),
    heatBtuPerHour: calcBtu(800),
    modelTag: 'ProLiant-DL360-Gen10',
    desc: 'HPE ProLiant DL360 Gen10 1U rack server delivering security, agility and flexibility without compromise.',
    ports: [
      { id: 'dp_front', name: 'Front DP', type: 'terminal', xPct: 0.12, yPct: 0.50, facing: 'front' }
    ],
    rearPorts: [
      { id: 'ilo_mgmt', name: 'iLO 5 MGMT', type: 'rj45', speed: '1G', xPct: 0.10, yPct: 0.50, facing: 'rear' },
      { id: 'nic_1', name: 'NIC 1', type: 'rj45', speed: '1G', xPct: 0.22, yPct: 0.35, facing: 'rear' },
      { id: 'nic_2', name: 'NIC 2', type: 'rj45', speed: '1G', xPct: 0.30, yPct: 0.35, facing: 'rear' },
      { id: 'nic_3', name: 'NIC 3', type: 'rj45', speed: '1G', xPct: 0.22, yPct: 0.65, facing: 'rear' },
      { id: 'nic_4', name: 'NIC 4', type: 'rj45', speed: '1G', xPct: 0.30, yPct: 0.65, facing: 'rear' },
      { id: 'sfp_1', name: '10G SFP+ 1', type: 'sfp+', speed: '10G', xPct: 0.42, yPct: 0.50, facing: 'rear' },
      { id: 'sfp_2', name: '10G SFP+ 2', type: 'sfp+', speed: '10G', xPct: 0.50, yPct: 0.50, facing: 'rear' },
      { id: 'psu_1', name: 'Flex Slot PSU 1 (C14)', type: 'c14', xPct: 0.80, yPct: 0.50, facing: 'rear' },
      { id: 'psu_2', name: 'Flex Slot PSU 2 (C14)', type: 'c14', xPct: 0.90, yPct: 0.50, facing: 'rear' }
    ]
  },

  // 4. HPE ProLiant DL380 Gen10 (2U)
  {
    id: 'server-hpe-dl380-gen10',
    name: 'HPE ProLiant DL380 Gen10 2U',
    category: 'server',
    u: 2,
    manufacturer: 'HPE',
    depthMm: 730,
    weightKg: 24.6,
    powerWatts: 1600,
    dualPsu: true,
    heatBtu: calcBtu(1600),
    heatBtuPerHour: calcBtu(1600),
    modelTag: 'ProLiant-DL380-Gen10',
    desc: 'HPE ProLiant DL380 Gen10 2U industry-leading 2P server for multi-workload compute and storage resilience.',
    ports: [
      { id: 'dp_front', name: 'Front DP', type: 'terminal', xPct: 0.10, yPct: 0.35, facing: 'front' }
    ],
    rearPorts: [
      { id: 'ilo_mgmt', name: 'iLO 5 MGMT', type: 'rj45', speed: '1G', xPct: 0.10, yPct: 0.50, facing: 'rear' },
      { id: 'nic_1', name: 'NIC 1', type: 'rj45', speed: '1G', xPct: 0.22, yPct: 0.35, facing: 'rear' },
      { id: 'nic_2', name: 'NIC 2', type: 'rj45', speed: '1G', xPct: 0.30, yPct: 0.35, facing: 'rear' },
      { id: 'nic_3', name: 'NIC 3', type: 'rj45', speed: '1G', xPct: 0.22, yPct: 0.65, facing: 'rear' },
      { id: 'nic_4', name: 'NIC 4', type: 'rj45', speed: '1G', xPct: 0.30, yPct: 0.65, facing: 'rear' },
      { id: 'sfp_1', name: '10G SFP+ 1', type: 'sfp+', speed: '10G', xPct: 0.42, yPct: 0.35, facing: 'rear' },
      { id: 'sfp_2', name: '10G SFP+ 2', type: 'sfp+', speed: '10G', xPct: 0.50, yPct: 0.35, facing: 'rear' },
      { id: 'sfp_3', name: '10G SFP+ 3', type: 'sfp+', speed: '10G', xPct: 0.42, yPct: 0.65, facing: 'rear' },
      { id: 'sfp_4', name: '10G SFP+ 4', type: 'sfp+', speed: '10G', xPct: 0.50, yPct: 0.65, facing: 'rear' },
      { id: 'psu_1', name: 'Flex Slot PSU 1 (C14)', type: 'c14', xPct: 0.80, yPct: 0.50, facing: 'rear' },
      { id: 'psu_2', name: 'Flex Slot PSU 2 (C14)', type: 'c14', xPct: 0.90, yPct: 0.50, facing: 'rear' }
    ]
  }
];
