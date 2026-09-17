import { describe, it, expect } from 'vitest';

describe('Intelligent Cable Load Balancing & User Duct Control', () => {
  function resolveCableDuctSide(cable: any, x1: number, x2: number, rackCenterLine: number, leftUsage: number, rightUsage: number): boolean {
    // 1. Explicit User Override
    if (cable.ductSide === 'left') return false;
    if (cable.ductSide === 'right') return true;

    // 2. Extract port index or uplink nature
    const getPortWeight = (endpoint: any) => {
      const pId = String(endpoint?.portId || '').toLowerCase();
      if (pId.startsWith('up') || pId.includes('te') || pId.includes('fo') || pId.includes('100ge')) {
        return 1.0;
      }
      const numMatch = pId.match(/\d+/);
      const num = numMatch ? parseInt(numMatch[0], 10) : null;
      if (num !== null) {
        if (num <= 12) return -1.0;
        if (num > 12) return 1.0;
      }
      return 0.0;
    };

    const wFrom = getPortWeight(cable.from);
    const wTo = getPortWeight(cable.to);
    const combinedWeight = wFrom + wTo;

    if (combinedWeight > 0.5) return true;
    if (combinedWeight < -0.5) return false;

    const avgX = (x1 + x2) / 2;
    const isGeometricRight = avgX > rackCenterLine;

    if (isGeometricRight && (rightUsage - leftUsage >= 4)) {
      return false;
    }
    if (!isGeometricRight && (leftUsage - rightUsage >= 4)) {
      return true;
    }

    return isGeometricRight;
  }

  function toggleCableDuctSide(cable: any) {
    const current = cable.ductSide || 'auto';
    const next = current === 'auto' ? 'left' : (current === 'left' ? 'right' : 'auto');
    cable.ductSide = next;
    return next;
  }

  it('routes ports 1-12 to the left vertical duct by default', () => {
    const cable = { from: { portId: 'p3' }, to: { portId: 'p5' }, ductSide: 'auto' };
    const useRight = resolveCableDuctSide(cable, 150, 180, 309, 0, 0);
    expect(useRight).toBe(false); // Left duct
  });

  it('routes ports 13-24 to the right vertical duct by default', () => {
    const cable = { from: { portId: 'p17' }, to: { portId: 'p19' }, ductSide: 'auto' };
    const useRight = resolveCableDuctSide(cable, 250, 270, 309, 0, 0);
    expect(useRight).toBe(true); // Right duct
  });

  it('routes uplink ports to the right vertical duct by default', () => {
    const cable = { from: { portId: 'up1' }, to: { portId: 'up2' }, ductSide: 'auto' };
    const useRight = resolveCableDuctSide(cable, 450, 480, 309, 0, 0);
    expect(useRight).toBe(true); // Right duct
  });

  it('respects explicit user override for left duct even when port is in right block', () => {
    const cable = { from: { portId: 'p20' }, to: { portId: 'p22' }, ductSide: 'left' };
    const useRight = resolveCableDuctSide(cable, 400, 420, 309, 0, 0);
    expect(useRight).toBe(false); // Forced left
  });

  it('respects explicit user override for right duct even when port is in left block', () => {
    const cable = { from: { portId: 'p2' }, to: { portId: 'p4' }, ductSide: 'right' };
    const useRight = resolveCableDuctSide(cable, 120, 140, 309, 0, 0);
    expect(useRight).toBe(true); // Forced right
  });

  it('spills cables to right duct when left duct is heavily saturated (+4)', () => {
    // Port 12 is near the boundary, left usage is 10, right usage is 2
    const cable = { from: { portId: 'p12' }, to: { portId: 'p13' }, ductSide: 'auto' };
    const useRight = resolveCableDuctSide(cable, 220, 230, 309, 10, 2);
    expect(useRight).toBe(true); // Balanced over to right duct
  });

  it('cycles toggleCableDuctSide through auto -> left -> right -> auto', () => {
    const cable: any = { id: 'cbl-1', ductSide: 'auto' };
    expect(toggleCableDuctSide(cable)).toBe('left');
    expect(cable.ductSide).toBe('left');

    expect(toggleCableDuctSide(cable)).toBe('right');
    expect(cable.ductSide).toBe('right');

    expect(toggleCableDuctSide(cable)).toBe('auto');
    expect(cable.ductSide).toBe('auto');
  });
});
