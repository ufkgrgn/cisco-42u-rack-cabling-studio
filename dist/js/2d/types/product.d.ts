export type EntityKind = 'project' | 'location' | 'rack' | 'device' | 'cable';
declare global { interface Window { is3DMode?: boolean; } }
export interface EntityRef { kind: EntityKind; id: string; }
export interface ProjectRecord {
  id: string;
  projectId?: string;
  name?: string;
  note?: string;
  entityRef?: EntityRef;
  recordedAt?: string;
  collectedAt?: string;
  createdAt?: string;
  [extension: string]: unknown;
}
export interface LocationRecord extends ProjectRecord {
  kind?: 'site' | 'building' | 'floor' | 'room';
  parentId?: string | null;
}
export interface Observation extends ProjectRecord {
  observationVersion?: 1;
  receivedAt?: string;
  contentHash?: string;
  subject?: { kind: 'device' | 'port' | 'cable'; portId?: string };
  mapping?: { status: 'matched' | 'ambiguous' | 'unmatched'; candidateIds: string[]; reason?: string };
  parentObservationId?: string;
  source?: string | Record<string, unknown>;
  raw?: Record<string, unknown>;
  normalized?: Record<string, unknown>;
}
export interface FieldEvent extends ProjectRecord {
  fieldEventVersion?: 1;
  technician?: string;
  receivedAt?: string;
  scope?: Record<string, unknown>;
  parentEventId?: string;
  reason?: string;
  kind?: string;
  result?: 'unknown' | 'pass' | 'fail' | 'partial' | 'not-tested';
  expectedRevision?: number;
  evidenceIds?: string[];
}
export interface EvidenceRef extends ProjectRecord {
  blobId?: string;
  filename?: string;
  bytes?: number;
  mime?: string;
  sha256?: string;
}
export interface HandoverRecord extends ProjectRecord { revision?: number; status?: string; }
export interface IntegrationMapping extends ProjectRecord { sourceSystem?: string; sourceInstance?: string; externalId?: string; }
export interface CableEndpoint { rackId: string; instanceId: string; portId: string; face?: 'front' | 'rear'; [extension: string]: unknown; }
export interface DeviceRecord { instanceId: string; catalogKey: string; topU: number; uHeight: number; [extension: string]: unknown; }
export interface RackRecord { id: string; name: string; heightU: number; devices: DeviceRecord[]; [extension: string]: unknown; }
export interface CableRecord {
  id: string; from: CableEndpoint; to: CableEndpoint;
  lengthMeters?: number;
  estimatedLengthMeters?: number | null;
  measuredLengthMeters?: number | null;
  purchaseLengthMeters?: number | null;
  [extension: string]: unknown;
}
export interface ProjectTopology { racks: RackRecord[]; cables: CableRecord[]; customCatalog?: Record<string, unknown>; portGeometryOverrides?: Record<string, unknown>; [extension: string]: unknown; }
export interface ProjectDocument {
  schemaVersion: 1;
  projectId: string;
  revision: number;
  metadata: Record<string, unknown>;
  locations: LocationRecord[];
  topology: ProjectTopology;
  catalogContext: Record<string, unknown>;
  observations: Observation[];
  fieldEvents: FieldEvent[];
  evidenceRefs: EvidenceRef[];
  handoverRecords: HandoverRecord[];
  integrationMappings: IntegrationMapping[];
  extensions: Record<string, unknown>;
  [extension: string]: unknown;
}
export interface CommandEnvelope { commandId: string; projectId: string; expectedRevision: number; expectedContent: string; }
export interface CommandReceipt { commandId: string; fingerprint: string; revision: number; }
export type ProjectCommand = CommandEnvelope & (
  { type: 'ImportObservations'; payload: { observations: Observation[]; mappings?: IntegrationMapping[] } } |
  { type: 'ApplyObservationDifferences'; payload: { observationId: string; fields: string[]; allowStale?: boolean } } |
  { type: 'MoveDevice'; payload: { deviceId: string; targetRackId: string; moves: { deviceId: string; topU: number }[] } } |
  { type: 'ConnectCable'; payload: { cable: CableRecord; portConfigs?: { deviceId: string; portsConfig: Record<string, unknown> }[] } } |
  { type: 'ApplyTopology'; payload: { topology: ProjectTopology } } |
  { type: 'ApplyEngineeringChange'; payload: { topology: ProjectTopology; catalogContext: ProjectDocument['catalogContext']; ackUnknown: boolean } } |
  { type: 'RestoreProjectDocument'; payload: { document: ProjectDocument } } |
  { type: 'UpdateProjectDetails'; payload: { metadata: Record<string, unknown>; locations: LocationRecord[]; rackLocations: { rackId: string; locationId: string | null }[] } }
);
