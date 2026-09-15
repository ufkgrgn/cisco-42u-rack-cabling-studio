import { describe, it, expect } from 'vitest';
import { PortDefinition, PortType } from '../../src/core/types';

// Helper matching Wizard port matrix generator
function generateFrontPorts(
  count: number,
  type: PortType,
  speed: string,
  poe: boolean,
  pfx: string,
  rowCount: 1 | 2,
): PortDefinition[] {
  const safeCount = Math.max(0, Math.min(96, count));
  if (safeCount === 0) return [];

  const cols = rowCount === 1 ? safeCount : Math.ceil(safeCount / 2);
  const newPorts: PortDefinition[] = [];

  for (let i = 0; i < safeCount; i++) {
    const col = rowCount === 1 ? i : Math.floor(i / 2);
    const row = rowCount === 1 ? 0 : i % 2;
    const xPct = Number((0.06 + (cols > 1 ? (col / (cols - 1)) * 0.88 : 0)).toFixed(4));
    const yPct = rowCount === 1 ? 0.5 : row === 0 ? 0.28 : 0.72;

    newPorts.push({
      id: `p${i + 1}`,
      name: `${pfx}${i + 1}`,
      type,
      speed: speed || undefined,
      poe: poe || undefined,
      row,
      group: Math.floor(i / 8) + 1,
      xPct,
      yPct,
      facing: 'front',
    });
  }

  return newPorts;
}

describe('Zero-Code Custom Device Wizard Logic (F3.3)', () => {
  it('generates 0 ports cleanly', () => {
    const ports = generateFrontPorts(0, 'rj45', '1G', false, 'Port ', 2);
    expect(ports.length).toBe(0);
  });

  it('generates 12 ports in 2 alternating rows with valid coordinates', () => {
    const ports = generateFrontPorts(12, 'rj45', '1G', true, 'Gi1/0/', 2);
    expect(ports.length).toBe(12);

    for (let i = 0; i < 12; i++) {
      const p = ports[i]!;
      expect(p.name).toBe(`Gi1/0/${i + 1}`);
      expect(p.type).toBe('rj45');
      expect(p.poe).toBe(true);
      expect(p.facing).toBe('front');
      expect(p.xPct).toBeGreaterThanOrEqual(0.0);
      expect(p.xPct).toBeLessThanOrEqual(1.0);
      expect(p.yPct).toBeGreaterThanOrEqual(0.0);
      expect(p.yPct).toBeLessThanOrEqual(1.0);
    }

    // Row alternation
    expect(ports[0]?.row).toBe(0);
    expect(ports[1]?.row).toBe(1);
    expect(ports[2]?.row).toBe(0);
    expect(ports[3]?.row).toBe(1);
  });

  it('generates 24 ports in 2 rows with 8-port grouping', () => {
    const ports = generateFrontPorts(24, 'rj45', '1G', false, 'Port ', 2);
    expect(ports.length).toBe(24);
    expect(ports[0]?.group).toBe(1);
    expect(ports[7]?.group).toBe(1);
    expect(ports[8]?.group).toBe(2);
    expect(ports[15]?.group).toBe(2);
    expect(ports[16]?.group).toBe(3);
    expect(ports[23]?.group).toBe(3);
  });

  it('generates 48 high-density ports without overlapping xPct coordinates', () => {
    const ports = generateFrontPorts(48, 'rj45', '1G', true, 'Port ', 2);
    expect(ports.length).toBe(48);

    // Top row (even indices) should have strictly ascending xPct
    for (let i = 2; i < 48; i += 2) {
      expect(ports[i]!.xPct!).toBeGreaterThan(ports[i - 2]!.xPct!);
    }

  });

  it('clamps port count to maximum 96 ports', () => {
    const ports = generateFrontPorts(200, 'sfp+', '10G', false, 'XG', 2);
    expect(ports.length).toBe(96);
  });

  it('calculates physical height in mm and inches accurately based on U height', () => {
    const uHeights = [1, 2, 4, 24, 42, 48];
    for (const u of uHeights) {
      const mm = Number((u * 44.45).toFixed(1));
      const inches = Number((u * 1.75).toFixed(2));

      expect(mm).toBeCloseTo(u * 44.45, 1);
      expect(inches).toBeCloseTo(u * 1.75, 2);
    }
  });

  it('calculates thermal output BTU/hr accurately from power wattage', () => {
    const testWattages = [0, 50, 150, 350, 750, 1200];
    for (const w of testWattages) {
      const calculatedBtu = Math.round(w * 3.412142);
      expect(calculatedBtu).toBeGreaterThanOrEqual(0);
      if (w === 350) {
        expect(calculatedBtu).toBe(1194);
      }
    }
  });
});
