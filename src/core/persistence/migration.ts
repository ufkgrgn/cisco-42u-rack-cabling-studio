import { ProjectV3, ProjectSchemaV3, DeviceCatalogItem } from './schemas';

export interface LegacyProjectV1 {
  version?: string; // '2.0-enterprise'
  timestamp?: string;
  devices?: Array<{
    instanceId: string;
    catalogKey: string;
    topU: number;
    uHeight: number;
    [key: string]: any;
  }>;
  cables?: Array<{
    id: string;
    from: { instanceId: string; portId: string; [key: string]: any };
    to: { instanceId: string; portId: string; [key: string]: any };
    color?: string;
    lengthMeters?: number;
    [key: string]: any;
  }>;
  heightU?: number;
  [key: string]: any;
}

export interface LegacyProjectV2 {
  version?: string; // '4.0-studio' or unversioned
  timestamp?: string;
  activeRackId?: string;
  rackCounter?: number;
  cableCounter?: number;
  customCatalog?: Record<string, any>;
  racks?: Array<{
    id: string;
    name: string;
    heightU?: number;
    totalU?: number;
    units?: any[];
    devices: Array<{
      instanceId: string;
      catalogKey?: string;
      catalogId?: string;
      topU?: number;
      startU?: number;
      uHeight?: number;
      u?: number;
      face?: string;
      customLabel?: string;
      [key: string]: any;
    }>;
    [key: string]: any;
  }>;
  cables?: Array<{
    id: string;
    from: { rackId?: string; instanceId?: string; deviceInstanceId?: string; portId: string; face?: string; [key: string]: any };
    to: { rackId?: string; instanceId?: string; deviceInstanceId?: string; portId: string; face?: string; [key: string]: any };
    color?: string;
    category?: 'copper' | 'fiber' | 'dac' | 'power';
    routingStyle?: 'structured' | 'direct';
    lengthMeters?: number;
    notes?: string;
    [key: string]: any;
  }>;
  meta?: {
    projectName?: string;
    createdAt?: string;
    updatedAt?: string;
    author?: string;
    [key: string]: any;
  };
  name?: string;
  id?: string;
  [key: string]: any;
}

export function detectProjectVersion(data: unknown): 1 | 2 | 3 {
  if (!data || typeof data !== 'object') {
    throw new Error('Geçersiz proje verisi: Veri bir nesne olmalıdır.');
  }
  const obj = data as Record<string, any>;
  if (obj.schemaVersion === 3) {
    return 3;
  }
  if (Array.isArray(obj.racks)) {
    return 2;
  }
  if (Array.isArray(obj.devices) && !obj.racks) {
    return 1;
  }
  if (obj.version === '2.0-enterprise') {
    return 1;
  }
  if (obj.version === '4.0-studio') {
    return 2;
  }
  return 2; // Default to v2 migration attempt
}

/**
 * Normalizes legacy catalog category names to canonical V3 enum.
 */
export function normalizeCategory(cat?: string): 'router' | 'switch' | 'server' | 'patch-panel' | 'pdu' | 'organizer' | 'accessory' | 'blank' {
  if (!cat) return 'accessory';
  switch (cat.toLowerCase()) {
    case 'fiber-switch':
    case 'compact':
      return 'switch';
    case 'patch':
    case 'fiber':
      return 'patch-panel';
    case 'router':
    case 'switch':
    case 'server':
    case 'pdu':
    case 'organizer':
    case 'accessory':
    case 'blank':
      return cat.toLowerCase() as any;
    default:
      return 'accessory';
  }
}

/**
 * Infers cable category from port ID naming conventions.
 */
export function inferCableCategory(portId?: string): 'copper' | 'fiber' | 'dac' | 'power' {
  if (!portId) return 'copper';
  const p = portId.toLowerCase();
  if (p.startsWith('lc') || p.startsWith('sfp') || p.startsWith('up') || p.includes('fiber')) {
    return 'fiber';
  }
  if (p.startsWith('c13') || p.startsWith('c14') || p.includes('power')) {
    return 'power';
  }
  if (p.includes('qsfp') || p.includes('dac')) {
    return 'dac';
  }
  return 'copper';
}

/**
 * Migration Step 1: V1 (Flat Single Rack) -> V2 (Multi-Rack intermediate)
 */
export function migrateV1ToV2(v1: LegacyProjectV1): LegacyProjectV2 {
  const defaultHeight = v1.heightU || 42;
  const rackId = 'rack-1';

  const racks = [
    {
      id: rackId,
      name: 'MDF - Ana Dağıtım Kabini',
      heightU: defaultHeight,
      units: [],
      devices: (v1.devices || []).map(d => ({ ...d }))
    }
  ];

  const cables = (v1.cables || []).map(c => ({
    ...c,
    from: {
      rackId,
      instanceId: c.from.instanceId,
      portId: c.from.portId
    },
    to: {
      rackId,
      instanceId: c.to.instanceId,
      portId: c.to.portId
    }
  }));

  const { devices, heightU, ...rest } = v1;

  return {
    version: '4.0-studio',
    timestamp: v1.timestamp || new Date().toISOString(),
    activeRackId: rackId,
    racks,
    cables,
    customCatalog: {},
    ...rest
  };
}

/**
 * Migration Step 2: V2 -> Canonical ProjectSchemaV3
 */
export function migrateV2ToV3(v2: LegacyProjectV2): ProjectV3 {
  const now = new Date().toISOString();
  const legacyExtensions: Record<string, any> = {};

  // Extract non-standard properties for lossless storage
  for (const [key, val] of Object.entries(v2)) {
    if (!['schemaVersion', 'id', 'name', 'metadata', 'activeRackId', 'racks', 'cables', 'customCatalog', 'checksum'].includes(key)) {
      legacyExtensions[key] = val;
    }
  }

  // Normalize Custom Catalog
  const customCatalog: Record<string, DeviceCatalogItem> = {};
  if (v2.customCatalog && typeof v2.customCatalog === 'object') {
    for (const [catKey, catItem] of Object.entries(v2.customCatalog)) {
      customCatalog[catKey] = {
        id: catItem.id || catKey,
        name: catItem.name || catKey,
        category: normalizeCategory(catItem.category),
        u: Number.isInteger(catItem.u) && catItem.u >= 1 ? catItem.u : 1,
        manufacturer: catItem.manufacturer || 'Custom',
        depthMm: catItem.depthMm || 400,
        powerWatts: catItem.powerWatts || 0,
        ports: Array.isArray(catItem.ports) ? catItem.ports : [],
        rearPorts: Array.isArray(catItem.rearPorts) ? catItem.rearPorts : [],
        isCustom: true,
        modelTag: catItem.modelTag || 'CUSTOM',
        desc: catItem.desc || 'Kullanıcı tanımlı özel donanım'
      };
    }
  }

  // Normalize Racks & Devices
  const sourceRacks = Array.isArray(v2.racks) && v2.racks.length > 0
    ? v2.racks
    : [{ id: 'rack-1', name: 'MDF - Dağıtım Kabini', heightU: 42, devices: [] }];

  const racks = sourceRacks.map((r, rIdx) => {
    const rawTotalU = r.heightU || r.totalU || 42;
    const totalU = Number.isInteger(rawTotalU) && rawTotalU >= 1 && rawTotalU <= 60 ? rawTotalU : 42;
    const rackId = r.id || `rack-${rIdx + 1}`;

    const devices = (r.devices || []).map((d, dIdx) => {
      const uHeight = Number.isInteger(d.uHeight || d.u) && (d.uHeight || d.u)! >= 1 ? (d.uHeight || d.u)! : 1;
      
      let startU: number;
      if (d.startU !== undefined && Number.isInteger(d.startU)) {
        startU = d.startU;
      } else {
        const topU = Number.isInteger(d.topU) ? d.topU! : (uHeight);
        startU = Math.max(1, topU - uHeight + 1);
      }
      startU = Math.max(1, Math.min(totalU - uHeight + 1, startU));

      const rawId = d.instanceId || `dev-${rIdx + 1}-${dIdx + 1}`;
      const instanceId = rawId.startsWith('dev-') ? rawId : `dev-${rawId}`;

      return {
        instanceId,
        catalogId: d.catalogId || d.catalogKey || 'cisco-catalyst-9300',
        rackId,
        startU,
        uHeight,
        face: (d.face === 'rear' ? 'rear' : 'front') as 'front' | 'rear',
        customLabel: d.customLabel || d.label || undefined,
        powerWatts: d.powerWatts || undefined
      };
    });

    return {
      id: rackId,
      name: r.name || `Kabin ${rIdx + 1}`,
      totalU,
      widthMm: r.widthMm || 600,
      depthMm: r.depthMm || 1000,
      maxLoadKg: r.maxLoadKg || 1000,
      positionX: r.positionX ?? (rIdx * 750),
      devices
    };
  });

  const activeRackId = racks.some(r => r.id === v2.activeRackId) ? v2.activeRackId! : racks[0]!.id;

  // Normalize Cables
  const cables = (v2.cables || []).map((c, cIdx) => {
    const fromRack = c.from?.rackId || activeRackId;
    const toRack = c.to?.rackId || activeRackId;
    const rawFromInst = c.from?.deviceInstanceId || c.from?.instanceId || 'dev-unknown';
    const rawToInst = c.to?.deviceInstanceId || c.to?.instanceId || 'dev-unknown';
    const fromInst = rawFromInst.startsWith('dev-') ? rawFromInst : `dev-${rawFromInst}`;
    const toInst = rawToInst.startsWith('dev-') ? rawToInst : `dev-${rawToInst}`;

    const color = (c.color && /^#[0-9a-fA-F]{6}$/.test(c.color)) ? c.color : '#2563eb';
    const lengthMeters = typeof c.lengthMeters === 'number' && c.lengthMeters > 0 ? c.lengthMeters : 1.5;

    return {
      id: c.id || `CBL-${String(cIdx + 1).padStart(3, '0')}`,
      from: {
        rackId: fromRack,
        deviceInstanceId: fromInst,
        portId: c.from?.portId || 'p1',
        face: (c.from?.face === 'rear' ? 'rear' : 'front') as 'front' | 'rear'
      },
      to: {
        rackId: toRack,
        deviceInstanceId: toInst,
        portId: c.to?.portId || 'p2',
        face: (c.to?.face === 'rear' ? 'rear' : 'front') as 'front' | 'rear'
      },
      color,
      category: c.category || inferCableCategory(c.from?.portId),
      routingStyle: (c.routingStyle === 'direct' ? 'direct' : 'structured') as 'structured' | 'direct',
      lengthMeters,
      notes: c.notes || undefined
    };
  });

  const projectName = v2.name || v2.meta?.projectName || 'Migrated Enterprise Topology';
  const createdAt = v2.timestamp || v2.meta?.createdAt || now;

  const projectV3: ProjectV3 = {
    schemaVersion: 3,
    id: v2.id || `proj-${Date.now()}`,
    name: projectName,
    metadata: {
      createdAt,
      updatedAt: now,
      author: v2.meta?.author || 'Migration Engine',
      generator: 'Cisco 42U Rack & Cabling Studio v3 (Migration Engine)'
    },
    activeRackId,
    racks,
    cables,
    customCatalog,
    legacyExtensions
  };

  return ProjectSchemaV3.parse(projectV3);
}

/**
 * Full Lossless Migration Pipeline Entrypoint
 */
export function migrateToV3(data: unknown): ProjectV3 {
  const version = detectProjectVersion(data);
  switch (version) {
    case 3:
      return ProjectSchemaV3.parse(data);
    case 2:
      return migrateV2ToV3(data as LegacyProjectV2);
    case 1: {
      const v2 = migrateV1ToV2(data as LegacyProjectV1);
      return migrateV2ToV3(v2);
    }
  }
}
