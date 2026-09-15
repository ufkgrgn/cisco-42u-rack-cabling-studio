import { describe, it, expect } from 'vitest';
import { BUILT_IN_CATALOG } from '../../src/core/catalog';
import {
  DeviceCatalogItemSchema,
  PortDefinitionSchema,
  CabinetModelSchema,
} from '../../src/core/persistence/schemas';
import { ESTAP_CABINETS } from '../../src/core/catalog/data/cabinetModels';

describe('Unified Catalog Schema & Physical Invariants (F3.2)', () => {
  it('validates every built-in catalog device against DeviceCatalogItemSchema with zero errors', () => {
    for (const item of BUILT_IN_CATALOG) {
      const result = DeviceCatalogItemSchema.safeParse(item);
      expect(
        result.success,
        `Device ${item.id} failed schema validation: ${result.success ? '' : JSON.stringify(result.error.issues)}`,
      ).toBe(true);
    }
  });

  it('validates every cabinet against CabinetModelSchema with zero errors', () => {
    for (const cabinet of ESTAP_CABINETS) {
      const result = CabinetModelSchema.safeParse(cabinet);
      expect(
        result.success,
        `Cabinet ${cabinet.id} failed schema validation: ${result.success ? '' : JSON.stringify(result.error.issues)}`,
      ).toBe(true);
    }
  });

  it('enforces normalized port coordinates in [0.0, 1.0] across all catalog devices', () => {
    for (const item of BUILT_IN_CATALOG) {
      for (const port of item.ports) {
        expect(
          port.xPct,
          `Port ${port.id} on ${item.id} xPct (${port.xPct}) must be >= 0.0`,
        ).toBeGreaterThanOrEqual(0.0);
        expect(
          port.xPct,
          `Port ${port.id} on ${item.id} xPct (${port.xPct}) must be <= 1.0`,
        ).toBeLessThanOrEqual(1.0);
        expect(
          port.yPct,
          `Port ${port.id} on ${item.id} yPct (${port.yPct}) must be >= 0.0`,
        ).toBeGreaterThanOrEqual(0.0);
        expect(
          port.yPct,
          `Port ${port.id} on ${item.id} yPct (${port.yPct}) must be <= 1.0`,
        ).toBeLessThanOrEqual(1.0);
      }
    }
  });

  it('enforces unique port IDs within each catalog item', () => {
    for (const item of BUILT_IN_CATALOG) {
      const seenIds = new Set<string>();
      for (const port of item.ports) {
        expect(
          seenIds.has(port.id),
          `Duplicate port ID "${port.id}" found in device "${item.id}"`,
        ).toBe(false);
        seenIds.add(port.id);
      }
    }
  });

  it('verifies thermal heat BTU formula: round(powerWatts * 3.412142)', () => {
    for (const item of BUILT_IN_CATALOG) {
      if (item.category !== 'pdu' && item.powerWatts !== undefined && item.heatBtuPerHour !== undefined) {
        const expectedBtu = Math.round(item.powerWatts * 3.412142);
        expect(
          item.heatBtuPerHour,
          `Device ${item.id} heatBtuPerHour (${item.heatBtuPerHour}) should equal calculated BTU (${expectedBtu})`,
        ).toBe(expectedBtu);
      }
    }
  });

  it('preserves backward compatibility for legacy minimal port definitions', () => {
    const legacyPort = {
      id: 'port-1',
      name: 'Gi0/1',
      type: 'rj45',
      xPct: 0.1,
      yPct: 0.5,
    };

    const parsed = PortDefinitionSchema.safeParse(legacyPort);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.facing).toBeUndefined(); // optional when omitted
    }
  });


  it('preserves backward compatibility for legacy minimal catalog items', () => {
    const legacyItem = {
      id: 'legacy-switch-48',
      name: 'Legacy 48 Switch',
      manufacturer: 'Cisco',
      category: 'switch',
      u: 1,
      depthMm: 450,
      ports: [],
    };


    const parsed = DeviceCatalogItemSchema.safeParse(legacyItem);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.powerWatts).toBe(0); // default
      expect(parsed.data.heatBtuPerHour).toBeUndefined();
    }
  });


  it('correctly parses extended port definition attributes', () => {
    const modernPort = {
      id: 'ge-combo-1',
      name: 'GigabitEthernet1/0/1',
      type: 'sfp',
      facing: 'rear',
      connectorGender: 'female',
      isCombo: true,
      comboPeerPortId: 'rj45-combo-1',
      xPct: 0.85,
      yPct: 0.5,
    };

    const parsed = PortDefinitionSchema.safeParse(modernPort);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.facing).toBe('rear');
      expect(parsed.data.connectorGender).toBe('female');
      expect(parsed.data.isCombo).toBe(true);
      expect(parsed.data.comboPeerPortId).toBe('rj45-combo-1');
    }
  });
});
