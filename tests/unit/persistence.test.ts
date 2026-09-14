import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  ProjectSchemaV3
} from '../../src/core/persistence/schemas';
import {
  exportProjectToJson,
  importProjectFromJson
} from '../../src/core/persistence/export-import';
import { IndexedDBStorageEngine } from '../../src/core/persistence/indexeddb';

describe('Milestone M1: Persistence & Schema Invariant Tests', () => {

  describe('Zod ProjectSchemaV3 Validation Rules', () => {
    it('validates a correct 42U rack project with dual-sided mounting and cables', () => {
      const validProject = {
        schemaVersion: 3,
        id: 'proj-enterprise-01',
        name: 'Datacenter Room A - Spine Rack',
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          generator: 'Cisco 42U Studio'
        },
        activeRackId: 'rack-01',
        racks: [
          {
            id: 'rack-01',
            name: 'MDF Spine',
            totalU: 42,
            widthMm: 600,
            depthMm: 1000,
            maxLoadKg: 1200,
            positionX: 0,
            devices: [
              {
                instanceId: 'dev-leaf-1',
                catalogId: 'cisco-catalyst-9300',
                rackId: 'rack-01',
                startU: 40,
                uHeight: 1,
                face: 'front'
              },
              {
                instanceId: 'dev-pdu-1',
                catalogId: 'cable-organizer-1u',
                rackId: 'rack-01',
                startU: 40,
                uHeight: 1,
                face: 'rear' // Dual-sided rear mount shares same U without collision
              }
            ]
          }
        ],
        cables: [],
        customCatalog: {}
      };

      const result = ProjectSchemaV3.safeParse(validProject);
      expect(result.success).toBe(true);
    });

    it('rejects physical collision on the same mounting face', () => {
      const collisionProject = {
        schemaVersion: 3,
        id: 'proj-collision',
        name: 'Collision Test',
        metadata: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), generator: 'Test' },
        activeRackId: 'rack-01',
        racks: [
          {
            id: 'rack-01',
            name: 'Cabinet 1',
            totalU: 42,
            devices: [
              { instanceId: 'dev-sw-1', catalogId: 'cisco-catalyst-3850-24s', rackId: 'rack-01', startU: 20, uHeight: 2, face: 'front' },
              { instanceId: 'dev-sw-2', catalogId: 'cisco-catalyst-9300', rackId: 'rack-01', startU: 21, uHeight: 1, face: 'front' }
            ]
          }
        ],
        cables: [],
        customCatalog: {}
      };

      const result = ProjectSchemaV3.safeParse(collisionProject);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toContain('overlapping devices');
    });

    it('rejects devices mounted beyond rack totalU boundary', () => {
      const outOfBoundsProject = {
        schemaVersion: 3,
        id: 'proj-oob',
        name: 'OOB Test',
        metadata: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), generator: 'Test' },
        activeRackId: 'rack-01',
        racks: [
          {
            id: 'rack-01',
            name: 'Cabinet 1',
            totalU: 24, // 24U rack
            devices: [
              { instanceId: 'dev-sw-1', catalogId: 'server-dell-r740', rackId: 'rack-01', startU: 24, uHeight: 2, face: 'front' } // spans 24..25
            ]
          }
        ],
        cables: [],
        customCatalog: {}
      };

      const result = ProjectSchemaV3.safeParse(outOfBoundsProject);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toContain('beyond total height');
    });

    it('rejects duplicate port cable connections (Mutual Exclusion)', () => {
      const portConflictProject = {
        schemaVersion: 3,
        id: 'proj-cable-conflict',
        name: 'Cable Conflict Test',
        metadata: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), generator: 'Test' },
        activeRackId: 'rack-01',
        racks: [
          {
            id: 'rack-01',
            name: 'Cabinet 1',
            totalU: 42,
            devices: [
              { instanceId: 'dev-sw-1', catalogId: 'cisco-catalyst-9300', rackId: 'rack-01', startU: 10, uHeight: 1, face: 'front' },
              { instanceId: 'dev-patch-1', catalogId: 'patch-panel-24', rackId: 'rack-01', startU: 12, uHeight: 1, face: 'front' }
            ]
          }
        ],
        cables: [
          {
            id: 'cbl-1',
            from: { rackId: 'rack-01', deviceInstanceId: 'dev-sw-1', portId: 'p1', face: 'front' },
            to: { rackId: 'rack-01', deviceInstanceId: 'dev-patch-1', portId: 'pt1', face: 'front' },
            color: '#2563eb',
            category: 'copper',
            routingStyle: 'structured',
            lengthMeters: 1.0
          },
          {
            id: 'cbl-2',
            from: { rackId: 'rack-01', deviceInstanceId: 'dev-sw-1', portId: 'p1', face: 'front' }, // Duplicate p1!
            to: { rackId: 'rack-01', deviceInstanceId: 'dev-patch-1', portId: 'pt2', face: 'front' },
            color: '#ef4444',
            category: 'copper',
            routingStyle: 'structured',
            lengthMeters: 1.0
          }
        ],
        customCatalog: {}
      };

      const result = ProjectSchemaV3.safeParse(portConflictProject);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toContain('connected to multiple cables');
    });
  });

  describe('Export / Import Pipeline & Integrity Tests', () => {
    it('produces deterministic checksums on project export and re-imports losslessly', async () => {
      const project: any = {
        schemaVersion: 3,
        id: 'proj-01',
        name: 'Export Test',
        metadata: { createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', generator: 'Test' },
        activeRackId: 'rack-1',
        racks: [{ id: 'rack-1', name: 'Test Rack', totalU: 42, widthMm: 600, depthMm: 1000, maxLoadKg: 1000, positionX: 0, devices: [] }],
        cables: [],
        customCatalog: {}
      };

      const exportedJson = await exportProjectToJson(project);
      expect(exportedJson).toContain('"checksum":');

      const parsed = JSON.parse(exportedJson);
      expect(parsed.checksum.length).toBeGreaterThan(0);

      // Verify round-trip import
      const imported = await importProjectFromJson(exportedJson);
      expect(imported.success).toBe(true);
      expect(imported.project?.name).toBe('Export Test');
    });

    it('rejects corrupted JSON with clean error diagnostics', async () => {
      const result = await importProjectFromJson('{ "schemaVersion": 3, "racks": [ invalid json ...');
      expect(result.success).toBe(false);
      expect(result.errors?.[0]?.code).toBe('JSON_SYNTAX_ERROR');
    });

    it('rejects prototype pollution payloads cleanly', async () => {
      const maliciousPayload = JSON.stringify({
        schemaVersion: 3,
        id: 'hack',
        name: 'Malicious Project',
        ['__proto__']: { isAdmin: true },
        racks: []
      });

      const result = await importProjectFromJson(maliciousPayload);
      expect(result.success).toBe(false);
      expect(result.errors?.[0]?.code).toBe('SECURITY_VIOLATION');
    });

    it('rejects oversized files exceeding 50MB', async () => {
      const hugeString = ' '.repeat(51 * 1024 * 1024);
      const result = await importProjectFromJson(hugeString);
      expect(result.success).toBe(false);
      expect(result.errors?.[0]?.code).toBe('FILE_TOO_LARGE');
    });
  });

  describe('IndexedDBStorageEngine with WAL and Crash Recovery', () => {
    let storage: IndexedDBStorageEngine;

    const baseProject: any = {
      schemaVersion: 3,
      id: 'proj-wal-test',
      name: 'WAL Test Studio',
      metadata: { createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', generator: 'Test' },
      activeRackId: 'rack-1',
      racks: [{ id: 'rack-1', name: 'MDF Rack', totalU: 42, widthMm: 600, depthMm: 1000, maxLoadKg: 1000, positionX: 0, devices: [] }],
      cables: [],
      customCatalog: {}
    };

    beforeEach(() => {
      storage = new IndexedDBStorageEngine(`proj-${Math.random().toString(36).substring(2, 7)}`);
    });

    it('logs actions to WAL and performs crash recovery on startup', async () => {
      // 1. Initial checkpoint
      await storage.forceCheckpoint(baseProject);

      // 2. Append WAL mutations without committing snapshot (simulating crash before checkpoint)
      await storage.logAction('DEVICE_MOUNT', {
        rackId: 'rack-1',
        device: {
          instanceId: 'dev-crash-1',
          catalogId: 'cisco-catalyst-9300',
          rackId: 'rack-1',
          startU: 10,
          uHeight: 1,
          face: 'front'
        }
      }, baseProject);

      await storage.logAction('RACK_RESIZE', {
        rackId: 'rack-1',
        newTotalU: 48
      }, baseProject);

      // 3. Crash recovery simulation on startup
      const recovery = await storage.recoverOnStartup(baseProject);

      expect(recovery.recovered).toBe(true);
      expect(recovery.replayedCount).toBe(2);
      expect(recovery.project.racks[0]?.totalU).toBe(48);
      expect(recovery.project.racks[0]?.devices.some(d => d.instanceId === 'dev-crash-1')).toBe(true);

      storage.close();
    });
  });
});
