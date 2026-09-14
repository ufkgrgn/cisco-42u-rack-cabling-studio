// ============================================================================
// Digital Rack Cabin Studio - Core Domain Types
// Interface contracts matching PROJECT.md § 4
// ============================================================================

// ---------------------------------------------------------------------------
// 1. Port & Hardware Catalog Types (M1 <-> M2)
// ---------------------------------------------------------------------------
export type PortType = 
  | 'rj45' 
  | 'sfp' 
  | 'sfp+' 
  | 'qsfp28' 
  | 'lc' 
  | 'sc' 
  | 'dac' 
  | 'c13' 
  | 'c14' 
  | 'terminal';

export interface PortDefinition {
  id: string;
  name: string;
  type: PortType;
  group?: string | number;
  row?: number;
  speed?: string;
  poe?: boolean;
  xPct?: number; // Normalized 0..1 coordinate on facia
  yPct?: number;
}

export type DeviceCategory = 
  | 'router' 
  | 'switch' 
  | 'server' 
  | 'patch-panel' 
  | 'pdu' 
  | 'organizer' 
  | 'accessory' 
  | 'blank';

export interface DeviceCatalogItem {
  id: string;
  name: string;
  category: DeviceCategory;
  u: number;
  manufacturer: string;
  depthMm?: number;
  powerWatts?: number;
  ports: PortDefinition[];
  rearPorts?: PortDefinition[];
  isCustom?: boolean;
  logo?: string;
  modelTag?: string;
  desc?: string;
}

// ---------------------------------------------------------------------------
// 2. Placement & Rack Twin Types (M1 / M2 <-> M3)
// ---------------------------------------------------------------------------
export interface DeviceInstance {
  instanceId: string;
  catalogId: string;
  rackId: string;
  startU: number; // 1-indexed bottom unit (EIA-310-D standard)
  uHeight: number;
  face: 'front' | 'rear';
  customLabel?: string;
  powerWatts?: number;
  assetTag?: string;
  serialNumber?: string;
  notes?: string;
}

export interface RackModel {
  id: string;
  name: string;
  totalU: number; // 1..60
  widthMm: number;
  depthMm: number;
  maxLoadKg: number;
  positionX: number; // World spatial coordinate
  devices: DeviceInstance[];
}

export interface PlacementValidationResult {
  valid: boolean;
  conflictingInstanceId?: string;
  reason?: 'COLLISION' | 'OUT_OF_BOUNDS' | 'SHRINKAGE_OCCUPIED';
}

// ---------------------------------------------------------------------------
// 3. Cabling & Connectivity Types (M3 / M4 <-> M5)
// ---------------------------------------------------------------------------
export interface CableEndpoint {
  rackId: string;
  deviceInstanceId: string;
  portId: string;
  face: 'front' | 'rear';
}

export type CableColor = 
  | 'Blue' 
  | 'Green' 
  | 'Yellow' 
  | 'Red' 
  | 'Orange' 
  | 'Purple' 
  | 'Black' 
  | 'White'
  | string;

export type CableCategory = 'copper' | 'fiber' | 'dac' | 'power';
export type CableRoutingStyle = 'structured' | 'direct';

export interface CableRun {
  id: string;
  from: CableEndpoint;
  to: CableEndpoint;
  color: string;
  category: CableCategory;
  routingStyle: CableRoutingStyle;
  lengthMeters?: number;
  notes?: string;
}

export interface CableGeometry {
  pathPoints: { x: number; y: number }[];
  bezierControlPoints?: { cp1x: number; cp1y: number; cp2x: number; cp2y: number };
  lengthMeters: number;
  isInterRack: boolean;
}

// ---------------------------------------------------------------------------
// 4. Project Master Model & Persistence
// ---------------------------------------------------------------------------
export interface ProjectMetadata {
  id?: string;
  name?: string;
  projectName?: string;
  createdAt: string;
  updatedAt: string;
  author?: string;
  company?: string;
  notes?: string;
  generator?: string;
  schemaVersion?: string | number;
}

export interface ProjectModel {
  schemaVersion: 3;
  id: string;
  name: string;
  metadata: ProjectMetadata;
  activeRackId: string;
  racks: RackModel[];
  cables: CableRun[];
  customCatalog: Record<string, DeviceCatalogItem>;
  checksum?: string;
  legacyExtensions?: Record<string, any>;
}

// ---------------------------------------------------------------------------
// 5. Engine Bridge & Coordinate Contracts (M3 <-> M4)
// ---------------------------------------------------------------------------
export interface EngineBridgeEvents {
  'camera:pan': { dx: number; dy: number };
  'camera:zoom': { factor: number; screenAnchorX: number; screenAnchorY: number };
  'device:drag-start': { catalogId: string; sourceRackId?: string; instanceId?: string };
  'device:drag-move': { screenX?: number; screenY?: number; worldX?: number; worldY?: number; snappedU?: number; targetRackId?: string; isValid?: boolean };
  'device:drag-end': { screenX?: number; screenY?: number; instanceId?: string; targetRackId?: string; targetU?: number };
  'selection:change': { selectedId?: string | null; type?: 'rack' | 'device' | 'cable' | 'port' | null };
  'port:hover': { endpoint: CableEndpoint | null };
  'viewport:change': { zoom: number; panX: number; panY: number };
}

export interface WorldCoordinate {
  x: number;
  y: number;
}
