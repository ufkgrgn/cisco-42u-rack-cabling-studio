import { describe, it, expect } from 'vitest';
import {
  migrateToV3,
  detectProjectVersion,
  LegacyProjectV1,
  LegacyProjectV2
} from '../../src/core/persistence/migration';

describe('Milestone M1: Lossless Migration Pipeline Tests', () => {
  it('correctly detects format versions', () => {
    expect(detectProjectVersion({ schemaVersion: 3 })).toBe(3);
    expect(detectProjectVersion({ version: '4.0-studio', racks: [] })).toBe(2);
    expect(detectProjectVersion({ version: '2.0-enterprise', devices: [] })).toBe(1);
    expect(detectProjectVersion({ devices: [] })).toBe(1);
  });

  it('correctly migrates Legacy Generation 1 (single-rack flat) to V3', () => {
    const legacyV1: LegacyProjectV1 = {
      version: '2.0-enterprise',
      timestamp: '2026-01-01T12:00:00Z',
      devices: [
        { instanceId: 'dev-1', catalogKey: 'cisco-isr-4431', topU: 40, uHeight: 1 },
        { instanceId: 'dev-2', catalogKey: 'cable-organizer-1u', topU: 38, uHeight: 2 }
      ],
      cables: [
        {
          id: 'CBL-001',
          from: { instanceId: 'dev-1', portId: 'ge0_0_0' },
          to: { instanceId: 'dev-2', portId: 'pt1' },
          color: '#06b6d4',
          lengthMeters: 1.5
        }
      ],
      customUnmappedProperty: 'legacy-data-to-preserve'
    };

    const migrated = migrateToV3(legacyV1);
    expect(migrated.schemaVersion).toBe(3);
    expect(migrated.racks.length).toBe(1);
    expect(migrated.racks[0]?.id).toBe('rack-1');
    expect(migrated.racks[0]?.totalU).toBe(42);

    // Verify coordinate transformation: topU -> startU
    const dev1 = migrated.racks[0]?.devices.find(d => d.instanceId === 'dev-1')!;
    expect(dev1.startU).toBe(40); // 40 - 1 + 1 = 40

    const dev2 = migrated.racks[0]?.devices.find(d => d.instanceId === 'dev-2')!;
    expect(dev2.startU).toBe(37); // topU 38, 2U -> 38 - 2 + 1 = 37

    // Verify cable endpoint references
    expect(migrated.cables[0]?.from.rackId).toBe('rack-1');
    expect(migrated.cables[0]?.from.deviceInstanceId).toBe('dev-1');
    expect(migrated.cables[0]?.from.face).toBe('front');

    // Verify unmapped keys preserved in legacyExtensions
    expect(migrated.legacyExtensions?.customUnmappedProperty).toBe('legacy-data-to-preserve');
  });

  it('migrates Legacy Generation 2 (multi-rack 4.0-studio) with custom catalog without data loss', () => {
    const legacyV2: LegacyProjectV2 = {
      version: '4.0-studio',
      activeRackId: 'rack-b',
      rackCounter: 2,
      customCatalog: {
        'custom-storage': {
          name: 'Custom NAS Storage 4U',
          u: 4,
          category: 'server',
          ports: [{ id: 'eth0', name: 'NIC 1', type: 'rj45' }]
        }
      },
      racks: [
        {
          id: 'rack-a',
          name: 'Core MDF',
          heightU: 48,
          devices: [{ instanceId: 'dev-storage', catalogKey: 'custom-storage', topU: 48, uHeight: 4 }]
        },
        {
          id: 'rack-b',
          name: 'Edge IDF',
          heightU: 24,
          devices: []
        }
      ],
      cables: []
    };

    const migrated = migrateToV3(legacyV2);
    expect(migrated.schemaVersion).toBe(3);
    expect(migrated.activeRackId).toBe('rack-b');
    expect(migrated.racks.length).toBe(2);
    expect(migrated.racks[0]?.totalU).toBe(48);
    expect(migrated.racks[1]?.totalU).toBe(24);

    // Verify Custom Catalog preserved and normalized
    expect(migrated.customCatalog['custom-storage']).toBeDefined();
    expect(migrated.customCatalog['custom-storage']?.manufacturer).toBe('Custom');

    // Verify device startU calculation
    const storage = migrated.racks[0]?.devices[0]!;
    expect(storage.startU).toBe(45); // 48 - 4 + 1 = 45
  });
});
