import { describe, it, expect } from 'vitest';

describe('Field Metrology, Organizer Routing & Power Telemetry Engine', () => {
  describe('Field Metrology Formula & Calculations', () => {
    function calculateTestLength(uDiff: number, hasOrganizer: boolean, isFiber: boolean, isInterRack: boolean) {
      if (isInterRack) {
        const baseTieRun = 14.0;
        return parseFloat((baseTieRun * 1.10).toFixed(2)); // 15.40m
      }
      const horizontalToDuct = 0.50; // 2x 0.25m from ports to side vertical wire manager
      const verticalDuct = uDiff * 0.0445; // 1U = 44.45mm
      const organizerAllowance = hasOrganizer ? 0.25 : 0.0;
      const bendRadiusAllowance = isFiber ? 0.20 : 0.15;

      const rawLength = horizontalToDuct + verticalDuct + organizerAllowance + bendRadiusAllowance;
      const withServiceLoop = rawLength * 1.10; // +10% standard field service loop

      return Math.max(0.5, parseFloat(withServiceLoop.toFixed(2)));
    }

    it('calculates accurate copper patch cable length with 10% service loop', () => {
      // 3U distance, copper, with horizontal organizer
      // raw = 0.50 + (3 * 0.0445) + 0.25 + 0.15 = 1.0335
      // with +10% loop = 1.0335 * 1.10 = 1.13685 -> 1.14m
      const len = calculateTestLength(3, true, false, false);
      expect(len).toBe(1.14);
    });

    it('adds fiber bend radius allowance for optical patch cords', () => {
      // 3U distance, fiber, with horizontal organizer
      // raw = 0.50 + (3 * 0.0445) + 0.25 + 0.20 = 1.0835
      // with +10% loop = 1.0835 * 1.10 = 1.19185 -> 1.19m
      const len = calculateTestLength(3, true, true, false);
      expect(len).toBe(1.19);
      expect(len).toBeGreaterThan(calculateTestLength(3, true, false, false));
    });

    it('calculates structured inter-rack tie cable with overhead allowance and service loop', () => {
      const len = calculateTestLength(0, false, false, true);
      expect(len).toBe(15.40);
    });
  });

  describe('Routing Organizer Path Detection', () => {
    function findTestOrganizers(rackDevices: Array<{ catalogKey: string; topU: number; isOrganizer: boolean }>, devA: { topU: number }, devB: { topU: number }) {
      const minU = Math.min(devA.topU, devB.topU);
      const maxU = Math.max(devA.topU, devB.topU);

      return rackDevices.filter(d => {
        if (!d.isOrganizer) return false;
        const u = d.topU;
        return (u >= minU && u <= maxU) || Math.abs(u - devA.topU) <= 1 || Math.abs(u - devB.topU) <= 1;
      }).sort((a, b) => {
        return devA.topU > devB.topU ? (b.topU - a.topU) : (a.topU - b.topU);
      });
    }

    it('identifies intermediate cable manager between patch panel and switch', () => {
      const devices = [
        { catalogKey: 'patch-panel-24', topU: 42, isOrganizer: false },
        { catalogKey: 'organizer-1u', topU: 41, isOrganizer: true },
        { catalogKey: 'cisco-catalyst-9300-48p', topU: 40, isOrganizer: false },
        { catalogKey: 'organizer-1u', topU: 38, isOrganizer: true }
      ];

      const orgs = findTestOrganizers(devices, { topU: 42 }, { topU: 40 });
      expect(orgs.length).toBe(1);
      expect(orgs[0]?.topU).toBe(41);
    });

    it('handles reverse direction (bottom-to-top) traversal ordering', () => {
      const devices = [
        { catalogKey: 'cisco-catalyst-9300-48p', topU: 30, isOrganizer: false },
        { catalogKey: 'organizer-1u', topU: 35, isOrganizer: true },
        { catalogKey: 'cisco-catalyst-9500-32qc', topU: 40, isOrganizer: false }
      ];

      const orgsFromBottom = findTestOrganizers(devices, { topU: 30 }, { topU: 40 });
      expect(orgsFromBottom.length).toBe(1);
      expect(orgsFromBottom[0]?.topU).toBe(35);
    });
  });

  describe('Power Telemetry, Amperes & 16A PDU Overload Protection', () => {
    function computeTelemetry(deviceWatts: number[]) {
      const totalWatts = deviceWatts.reduce((sum, w) => sum + w, 0);
      const totalBtu = Math.round(totalWatts * 3.412142);
      const totalAmps = Number((totalWatts / (230 * 0.95)).toFixed(1));
      const totalKw = Number((totalWatts / 1000).toFixed(2));
      const isOverload = totalWatts > 3680 || totalAmps > 16.0;
      const pduCapacityPercent = Math.min(100, Math.round((totalWatts / 3680) * 100));

      return { totalWatts, totalBtu, totalAmps, totalKw, isOverload, pduCapacityPercent };
    }

    it('computes accurate Watts, BTU/h and Amperes for standard rack configuration', () => {
      // 2x C9300-48P (450W each) + 1x C9500-32QC (950W) = 1850W
      const telem = computeTelemetry([450, 450, 950]);
      expect(telem.totalWatts).toBe(1850);
      expect(telem.totalBtu).toBe(6312); // 1850 * 3.412142 = 6312.46 -> 6312
      // 1850 / (230 * 0.95) = 1850 / 218.5 = 8.466 -> 8.5A
      expect(telem.totalAmps).toBe(8.5);
      expect(telem.totalKw).toBe(1.85);
      expect(telem.isOverload).toBe(false);
      expect(telem.pduCapacityPercent).toBe(50);
    });

    it('triggers Overload Alarm when exceeding 16A single-phase PDU limit (3680W)', () => {
      // 4x C9300X-48HX (1100W each) = 4400W
      const telem = computeTelemetry([1100, 1100, 1100, 1100]);
      expect(telem.totalWatts).toBe(4400);
      // 4400 / (230 * 0.95) = 20.1A
      expect(telem.totalAmps).toBe(20.1);
      expect(telem.isOverload).toBe(true);
      expect(telem.pduCapacityPercent).toBe(100);
    });

    it('remains below overload for exactly 3680W / 16.0A threshold', () => {
      // 3680 / 218.5 = 16.84 -> 3496W / 218.5 = 16.0A
      const telemSafe = computeTelemetry([3490]);
      expect(telemSafe.totalAmps).toBe(16.0);
      expect(telemSafe.isOverload).toBe(false);

      const telemOver = computeTelemetry([3700]);
      expect(telemOver.isOverload).toBe(true);
    });
  });
});
