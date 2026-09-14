import { z } from 'zod';

/**
 * Valid port physical connector types.
 * Expands legacy 'rj45', 'sfp', 'lc' with standard data center interfaces.
 */
export const PortTypeSchema = z.enum([
  'rj45',
  'sfp',
  'sfp+',
  'qsfp28',
  'lc',
  'sc',
  'dac',
  'c13',
  'c14',
  'terminal'
]);
export type PortType = z.infer<typeof PortTypeSchema>;

/**
 * Port definition on a physical faceplate.
 */
export const PortDefinitionSchema = z.object({
  id: z.string().min(1).regex(/^[a-zA-Z0-9_.-]+$/, 'Port ID must be alphanumeric, dot, hyphen, or underscore'),
  name: z.string().min(1),
  type: PortTypeSchema,
  group: z.union([z.number().int().nonnegative(), z.string()]).optional(),
  row: z.number().int().nonnegative().optional(),
  speed: z.string().optional(),
  poe: z.boolean().optional(),
  xPct: z.number().min(0).max(1).optional(), // 0..1 normalized horizontal coordinate
  yPct: z.number().min(0).max(1).optional()  // 0..1 normalized vertical coordinate
});
export type PortDefinition = z.infer<typeof PortDefinitionSchema>;

/**
 * Hardware Catalog Categories.
 */
export const DeviceCategorySchema = z.enum([
  'router',
  'switch',
  'server',
  'patch-panel',
  'pdu',
  'organizer',
  'accessory',
  'blank'
]);
export type DeviceCategory = z.infer<typeof DeviceCategorySchema>;

/**
 * Hardware catalog item definition (Built-in or Custom).
 */
export const DeviceCatalogItemSchema = z.object({
  id: z.string().min(1).regex(/^[a-zA-Z0-9_-]+$/),
  name: z.string().min(1).max(150),
  category: DeviceCategorySchema,
  u: z.number().int().min(1).max(60),
  manufacturer: z.string().min(1).default('Cisco'),
  depthMm: z.number().positive().optional().default(400),
  powerWatts: z.number().nonnegative().optional().default(0),
  ports: z.array(PortDefinitionSchema).default([]),
  rearPorts: z.array(PortDefinitionSchema).optional().default([]),
  isCustom: z.boolean().optional().default(false),
  logo: z.string().optional(),
  modelTag: z.string().optional(),
  desc: z.string().optional()
});
export type DeviceCatalogItem = z.infer<typeof DeviceCatalogItemSchema>;

/**
 * Device instance placed within a rack cabinet.
 */
export const DeviceInstanceSchema = z.object({
  instanceId: z.string().min(1).regex(/^dev-[a-zA-Z0-9_-]+$/, 'Instance ID must start with dev-'),
  catalogId: z.string().min(1),
  rackId: z.string().min(1),
  startU: z.number().int().min(1).max(60), // 1-indexed bottom unit (EIA-310-D standard)
  uHeight: z.number().int().min(1).max(60),
  face: z.enum(['front', 'rear']).default('front'),
  customLabel: z.string().max(100).optional(),
  powerWatts: z.number().nonnegative().optional(),
  assetTag: z.string().optional(),
  serialNumber: z.string().optional(),
  notes: z.string().optional()
}).refine(
  dev => dev.startU + dev.uHeight - 1 <= 60,
  dev => ({ message: `Device spans from U${dev.startU} to U${dev.startU + dev.uHeight - 1}, exceeding the 60U maximum rack boundary.` })
);
export type DeviceInstance = z.infer<typeof DeviceInstanceSchema>;

/**
 * EIA-310-D Rack Model.
 */
export const RackModelSchema = z.object({
  id: z.string().min(1).regex(/^[a-zA-Z0-9_-]+$/),
  name: z.string().min(1).max(100),
  totalU: z.number().int().min(1).max(60),
  widthMm: z.number().positive().default(600),
  depthMm: z.number().positive().default(1000),
  maxLoadKg: z.number().positive().default(1000),
  positionX: z.number().default(0), // World spatial coordinate
  devices: z.array(DeviceInstanceSchema).default([])
}).refine(
  rack => {
    // 1. Boundary check: All devices must fit within rack.totalU
    for (const dev of rack.devices) {
      if (dev.startU + dev.uHeight - 1 > rack.totalU) {
        return false;
      }
    }
    return true;
  },
  rack => ({ message: `Rack '${rack.id}' has devices placed beyond total height U${rack.totalU}.` })
).refine(
  rack => {
    // 2. Physical Collision check: No overlapping U units on the same face
    const faces = ['front', 'rear'] as const;
    for (const face of faces) {
      const faceDevices = rack.devices.filter(d => d.face === face);
      for (let i = 0; i < faceDevices.length; i++) {
        const a = faceDevices[i]!;
        const aTop = a.startU + a.uHeight - 1;
        for (let j = i + 1; j < faceDevices.length; j++) {
          const b = faceDevices[j]!;
          const bTop = b.startU + b.uHeight - 1;
          // Interval overlap: [a.startU, aTop] intersects [b.startU, bTop]
          if (Math.max(a.startU, b.startU) <= Math.min(aTop, bTop)) {
            return false;
          }
        }
      }
    }
    return true;
  },
  rack => ({ message: `Rack '${rack.id}' contains physically overlapping devices on the same mounting face.` })
);
export type RackModel = z.infer<typeof RackModelSchema>;

/**
 * Cable Endpoint Reference.
 */
export const CableEndpointSchema = z.object({
  rackId: z.string().min(1),
  deviceInstanceId: z.string().min(1),
  portId: z.string().min(1),
  face: z.enum(['front', 'rear']).default('front')
});
export type CableEndpoint = z.infer<typeof CableEndpointSchema>;

/**
 * Standard Cable Run.
 */
export const CableRunSchema = z.object({
  id: z.string().min(1).regex(/^[a-zA-Z0-9_-]+$/),
  from: CableEndpointSchema,
  to: CableEndpointSchema,
  color: z.string(),
  category: z.enum(['copper', 'fiber', 'dac', 'power']).default('copper'),
  routingStyle: z.enum(['structured', 'direct']).default('structured'),
  lengthMeters: z.number().positive('Cable length must be greater than zero').optional().default(1.5),
  notes: z.string().optional()
}).refine(
  c => !(c.from.rackId === c.to.rackId && c.from.deviceInstanceId === c.to.deviceInstanceId && c.from.portId === c.to.portId),
  { message: 'A cable cannot connect a port to itself.' }
);
export type CableRun = z.infer<typeof CableRunSchema>;

/**
 * Project Metadata.
 */
export const ProjectMetadataSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  projectName: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  author: z.string().optional().default('Network Engineer'),
  company: z.string().optional(),
  notes: z.string().optional(),
  generator: z.string().default('Cisco 42U Rack & Cabling Studio v3'),
  schemaVersion: z.union([z.string(), z.number()]).optional()
});
export type ProjectMetadata = z.infer<typeof ProjectMetadataSchema>;

/**
 * Master Project Schema V3.
 */
export const ProjectSchemaV3 = z.object({
  schemaVersion: z.literal(3),
  id: z.string().min(1),
  name: z.string().min(1).max(150),
  metadata: ProjectMetadataSchema,
  activeRackId: z.string().min(1),
  racks: z.array(RackModelSchema).min(1, 'Project must contain at least one rack cabinet'),
  cables: z.array(CableRunSchema).default([]),
  customCatalog: z.record(z.string(), DeviceCatalogItemSchema).default({}),
  checksum: z.string().optional(),
  legacyExtensions: z.record(z.string(), z.any()).optional()
}).refine(
  p => p.racks.some(r => r.id === p.activeRackId),
  p => ({ message: `Active rack ID '${p.activeRackId}' does not exist in the project rack collection.` })
).refine(
  p => {
    // Unique device instance IDs across entire multi-rack project
    const instanceIds = new Set<string>();
    for (const r of p.racks) {
      for (const d of r.devices) {
        if (instanceIds.has(d.instanceId)) return false;
        instanceIds.add(d.instanceId);
      }
    }
    return true;
  },
  { message: 'Duplicate device instance ID found across racks.' }
).refine(
  p => {
    // Unique rack IDs
    const rackIds = new Set<string>();
    for (const r of p.racks) {
      if (rackIds.has(r.id)) return false;
      rackIds.add(r.id);
    }
    return true;
  },
  { message: 'Duplicate rack ID found.' }
).refine(
  p => {
    // Port Mutual Exclusion: Each physical port can connect at most ONE cable endpoint
    const portUsage = new Set<string>();
    for (const c of p.cables) {
      const fromKey = `${c.from.rackId}:${c.from.deviceInstanceId}:${c.from.face}:${c.from.portId}`;
      const toKey = `${c.to.rackId}:${c.to.deviceInstanceId}:${c.to.face}:${c.to.portId}`;
      if (portUsage.has(fromKey) || portUsage.has(toKey)) {
        return false;
      }
      portUsage.add(fromKey);
      portUsage.add(toKey);
    }
    return true;
  },
  { message: 'Port collision: One or more ports are connected to multiple cables.' }
);

export type ProjectV3 = z.infer<typeof ProjectSchemaV3>;
