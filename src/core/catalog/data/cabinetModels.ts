import { DeviceCatalogItem } from '../../types';

export interface CabinetCatalogItem extends DeviceCatalogItem {
  heightMm: number;
  widthMm: number;
  depthMm: number;
  maxLoadKg: number;
  doorPerforationPct: number;
}

export const CABINET_MODELS: CabinetCatalogItem[] = [

  {
    id: 'estap-servermax-26u',
    name: 'Estap ServerMax 26U Server Rack',
    category: 'accessory',
    u: 26,
    manufacturer: 'Estap',
    heightMm: 1309,
    widthMm: 800,
    depthMm: 1000,
    maxLoadKg: 1000,
    doorPerforationPct: 80,
    weightKg: 85,
    powerWatts: 0,
    heatBtu: 0,
    heatBtuPerHour: 0,
    modelTag: 'ServerMax-26U',
    desc: 'Estap ServerMax 26U 19" heavy-duty server rack cabinet with 80% perforated curved front door and split rear doors.',
    ports: []
  },
  {
    id: 'estap-servermax-36u',
    name: 'Estap ServerMax 36U Server Rack',
    category: 'accessory',
    u: 36,
    manufacturer: 'Estap',
    heightMm: 1754,
    widthMm: 800,
    depthMm: 1000,
    maxLoadKg: 1000,
    doorPerforationPct: 80,
    weightKg: 110,
    powerWatts: 0,
    heatBtu: 0,
    heatBtuPerHour: 0,
    modelTag: 'ServerMax-36U',
    desc: 'Estap ServerMax 36U 19" heavy-duty server rack cabinet with 80% perforated curved front door and split rear doors.',
    ports: []
  },
  {
    id: 'estap-servermax-42u',
    name: 'Estap ServerMax 42U Server Rack',
    category: 'accessory',
    u: 42,
    manufacturer: 'Estap',
    heightMm: 2002,
    widthMm: 800,
    depthMm: 1000,
    maxLoadKg: 1000,
    doorPerforationPct: 80,
    weightKg: 125,
    powerWatts: 0,
    heatBtu: 0,
    heatBtuPerHour: 0,
    modelTag: 'ServerMax-42U',
    desc: 'Estap ServerMax 42U 19" industry-standard datacenter cabinet with 1,000 kg static load capacity and multi-entry cable glands.',
    ports: []
  },
  {
    id: 'estap-servermax-47u',
    name: 'Estap ServerMax 47U Server Rack',
    category: 'accessory',
    u: 47,
    manufacturer: 'Estap',
    heightMm: 2224,
    widthMm: 800,
    depthMm: 1000,
    maxLoadKg: 1000,
    doorPerforationPct: 80,
    weightKg: 140,
    powerWatts: 0,
    heatBtu: 0,
    heatBtuPerHour: 0,
    modelTag: 'ServerMax-47U',
    desc: 'Estap ServerMax 47U 19" ultra-high capacity server rack cabinet for high-density compute and storage clustering.',
    ports: []
  }
];

export const ESTAP_CABINETS = CABINET_MODELS;
