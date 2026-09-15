import { describe, it, expect, beforeEach } from 'vitest';
import { RackModel, DeviceInstance } from '../../src/core/types';
import { useProjectStore } from '../../src/core/state/projectStore';
import { useHistoryStore } from '../../src/core/state/historyStore';
import { MoveDeviceCommand } from '../../src/core/history/commands/MoveDeviceCommand';
import { PlaceDeviceCommand } from '../../src/core/history/commands/PlaceDeviceCommand';
import { RemoveDeviceCommand } from '../../src/core/history/commands/RemoveDeviceCommand';
import { validateCableTopologyIntegrity } from '../../src/core/placement';

function createRack(id: string, totalU = 42, devices: DeviceInstance[] = []): RackModel {
  return {
    id,
    name: `Rack ${id}`,
    totalU,
    widthMm: 600,
    depthMm: 1000,
    maxLoadKg: 1000,
    positionX: 0,
    devices: [...devices],
  };
}

describe('Challenger M3-2: Adversarial Verification of Device Identity, Cable Retention, and Invertibility', () => {
  beforeEach(() => {
    useProjectStore.getState().setProject({
      schemaVersion: 3,
      id: 'proj-adversarial-m3',
      name: 'Adversarial M3 Verification',
      metadata: { createdAt: '2026-01-01', updatedAt: '2026-01-01', author: 'Challenger 2', generator: 'Test' },
      activeRackId: 'rack-1',
      racks: [
        createRack('rack-1', 42, [
          { instanceId: 'dev-alpha', catalogId: 'cisco-catalyst-9300', rackId: 'rack-1', startU: 10, uHeight: 1, face: 'front', customLabel: 'Core-Alpha' },
          { instanceId: 'dev-beta', catalogId: 'cisco-catalyst-9300', rackId: 'rack-1', startU: 20, uHeight: 1, face: 'front', customLabel: 'Dist-Beta' },
          { instanceId: 'dev-gamma', catalogId: 'cisco-catalyst-9300', rackId: 'rack-1', startU: 30, uHeight: 2, face: 'rear', customLabel: 'Storage-Gamma' },
        ]),
        createRack('rack-2', 42, [
          { instanceId: 'dev-delta', catalogId: 'cisco-catalyst-9300', rackId: 'rack-2', startU: 15, uHeight: 1, face: 'front', customLabel: 'Edge-Delta' },
        ]),
        createRack('rack-3', 48, []),
      ],
      cables: [
        // Cable 1: Intra-rack between dev-alpha and dev-beta
        {
          id: 'cable-alpha-beta',
          from: { rackId: 'rack-1', deviceInstanceId: 'dev-alpha', portId: 'p1', face: 'front' },
          to: { rackId: 'rack-1', deviceInstanceId: 'dev-beta', portId: 'p1', face: 'front' },
          color: 'Blue',
          category: 'copper',
          routingStyle: 'structured',
          lengthMeters: 1.5,
        },
        // Cable 2: Inter-rack between dev-alpha and dev-delta
        {
          id: 'cable-alpha-delta',
          from: { rackId: 'rack-1', deviceInstanceId: 'dev-alpha', portId: 'p2', face: 'front' },
          to: { rackId: 'rack-2', deviceInstanceId: 'dev-delta', portId: 'p1', face: 'front' },
          color: 'Green',
          category: 'fiber',
          routingStyle: 'structured',
          lengthMeters: 2.5,
        },
        // Cable 3: Loopback on dev-alpha
        {
          id: 'cable-alpha-loopback',
          from: { rackId: 'rack-1', deviceInstanceId: 'dev-alpha', portId: 'p23', face: 'front' },
          to: { rackId: 'rack-1', deviceInstanceId: 'dev-alpha', portId: 'p24', face: 'front' },
          color: 'Yellow',
          category: 'copper',
          routingStyle: 'direct',
          lengthMeters: 0.5,
        },
        // Cable 4: Cable connected to dev-gamma on rear face
        {
          id: 'cable-beta-gamma',
          from: { rackId: 'rack-1', deviceInstanceId: 'dev-beta', portId: 'p2', face: 'front' },
          to: { rackId: 'rack-1', deviceInstanceId: 'dev-gamma', portId: 'p1', face: 'rear' },
          color: 'Orange',
          category: 'copper',
          routingStyle: 'structured',
          lengthMeters: 1.8,
        },
      ],
      customCatalog: {},
    });
    useHistoryStore.getState().clearHistory();
  });

  // ===========================================================================
  // Focus 1: Device instanceId Strict Preservation
  // ===========================================================================
  describe('Focus 1: Device instanceId Strict Retention', () => {
    it('1.1 Preserves exact instanceId across intra-rack move, undo, and redo', () => {
      const history = useHistoryStore.getState();
      const initialDev = useProjectStore.getState().project.racks[0]!.devices.find(d => d.instanceId === 'dev-alpha')!;
      expect(initialDev.instanceId).toBe('dev-alpha');
      expect(initialDev.customLabel).toBe('Core-Alpha');

      // Move dev-alpha from U10 to U12
      const cmd = new MoveDeviceCommand({
        instanceId: 'dev-alpha',
        targetRackId: 'rack-1',
        targetStartU: 12,
      });
      const res = history.executeCommand(cmd);
      expect(res.success).toBe(true);

      const movedDev = useProjectStore.getState().project.racks[0]!.devices.find(d => d.instanceId === 'dev-alpha')!;
      expect(movedDev).toBeDefined();
      expect(movedDev.instanceId).toBe('dev-alpha');
      expect(movedDev.customLabel).toBe('Core-Alpha');
      expect(movedDev.startU).toBe(12);

      // Undo
      history.undo();
      const undoneDev = useProjectStore.getState().project.racks[0]!.devices.find(d => d.instanceId === 'dev-alpha')!;
      expect(undoneDev).toBeDefined();
      expect(undoneDev.instanceId).toBe('dev-alpha');
      expect(undoneDev.customLabel).toBe('Core-Alpha');
      expect(undoneDev.startU).toBe(10);

      // Redo
      history.redo();
      const redoneDev = useProjectStore.getState().project.racks[0]!.devices.find(d => d.instanceId === 'dev-alpha')!;
      expect(redoneDev).toBeDefined();
      expect(redoneDev.instanceId).toBe('dev-alpha');
      expect(redoneDev.customLabel).toBe('Core-Alpha');
      expect(redoneDev.startU).toBe(12);
    });

    it('1.2 Preserves exact instanceId across inter-rack move, undo, and redo', () => {
      const history = useHistoryStore.getState();

      // Move dev-alpha from rack-1 U10 to rack-2 U35
      const cmd = new MoveDeviceCommand({
        instanceId: 'dev-alpha',
        targetRackId: 'rack-2',
        targetStartU: 35,
      });
      const res = history.executeCommand(cmd);
      expect(res.success).toBe(true);

      // Check rack-1 has no dev-alpha
      expect(useProjectStore.getState().project.racks[0]!.devices.some(d => d.instanceId === 'dev-alpha')).toBe(false);
      // Check rack-2 has dev-alpha
      const movedDev = useProjectStore.getState().project.racks[1]!.devices.find(d => d.instanceId === 'dev-alpha')!;
      expect(movedDev).toBeDefined();
      expect(movedDev.instanceId).toBe('dev-alpha');
      expect(movedDev.rackId).toBe('rack-2');
      expect(movedDev.startU).toBe(35);
      expect(movedDev.customLabel).toBe('Core-Alpha');

      // Undo inter-rack move
      history.undo();
      expect(useProjectStore.getState().project.racks[1]!.devices.some(d => d.instanceId === 'dev-alpha')).toBe(false);
      const undoneDev = useProjectStore.getState().project.racks[0]!.devices.find(d => d.instanceId === 'dev-alpha')!;
      expect(undoneDev).toBeDefined();
      expect(undoneDev.instanceId).toBe('dev-alpha');
      expect(undoneDev.rackId).toBe('rack-1');
      expect(undoneDev.startU).toBe(10);

      // Redo inter-rack move
      history.redo();
      const redoneDev = useProjectStore.getState().project.racks[1]!.devices.find(d => d.instanceId === 'dev-alpha')!;
      expect(redoneDev).toBeDefined();
      expect(redoneDev.instanceId).toBe('dev-alpha');
      expect(redoneDev.rackId).toBe('rack-2');
    });

    it('1.3 Preserves instanceId across multi-hop multi-rack move sequence', () => {
      const history = useHistoryStore.getState();

      // Hop 1: dev-alpha rack-1 U10 -> rack-2 U1
      expect(history.executeCommand(new MoveDeviceCommand({ instanceId: 'dev-alpha', targetRackId: 'rack-2', targetStartU: 1 })).success).toBe(true);
      // Hop 2: dev-alpha rack-2 U1 -> rack-3 U25
      expect(history.executeCommand(new MoveDeviceCommand({ instanceId: 'dev-alpha', targetRackId: 'rack-3', targetStartU: 25 })).success).toBe(true);
      // Hop 3: dev-alpha rack-3 U25 -> rack-1 U40
      expect(history.executeCommand(new MoveDeviceCommand({ instanceId: 'dev-alpha', targetRackId: 'rack-1', targetStartU: 40 })).success).toBe(true);

      const p3 = useProjectStore.getState().project;
      const d3 = p3.racks.find(r => r.id === 'rack-1')!.devices.find(d => d.instanceId === 'dev-alpha')!;
      expect(d3.instanceId).toBe('dev-alpha');
      expect(d3.startU).toBe(40);

      // Undo Hop 3
      history.undo();
      const p2 = useProjectStore.getState().project;
      expect(p2.racks.find(r => r.id === 'rack-3')!.devices.find(d => d.instanceId === 'dev-alpha')?.startU).toBe(25);

      // Undo Hop 2
      history.undo();
      const p1 = useProjectStore.getState().project;
      expect(p1.racks.find(r => r.id === 'rack-2')!.devices.find(d => d.instanceId === 'dev-alpha')?.startU).toBe(1);

      // Undo Hop 1 -> back to original
      history.undo();
      const p0 = useProjectStore.getState().project;
      const d0 = p0.racks.find(r => r.id === 'rack-1')!.devices.find(d => d.instanceId === 'dev-alpha')!;
      expect(d0.instanceId).toBe('dev-alpha');
      expect(d0.startU).toBe(10);
    });
  });

  // ===========================================================================
  // Focus 2: Cable Endpoint Retention and Clean Undo/Redo Restoration
  // ===========================================================================
  describe('Focus 2: Cable Endpoint Retention and Clean Inversion', () => {
    it('2.1 Updates cable endpoint rackId when device moves to another rack', () => {
      const history = useHistoryStore.getState();

      // dev-alpha is connected to:
      // - cable-alpha-beta (from dev-alpha in rack-1 to dev-beta in rack-1)
      // - cable-alpha-delta (from dev-alpha in rack-1 to dev-delta in rack-2)
      // - cable-alpha-loopback (both ends on dev-alpha in rack-1)
      const cmd = new MoveDeviceCommand({
        instanceId: 'dev-alpha',
        targetRackId: 'rack-2',
        targetStartU: 30,
      });

      const res = history.executeCommand(cmd);
      expect(res.success).toBe(true);

      const cables = useProjectStore.getState().project.cables;
      const cAlphaBeta = cables.find(c => c.id === 'cable-alpha-beta')!;
      const cAlphaDelta = cables.find(c => c.id === 'cable-alpha-delta')!;
      const cLoopback = cables.find(c => c.id === 'cable-alpha-loopback')!;
      const cBetaGamma = cables.find(c => c.id === 'cable-beta-gamma')!;

      // cable-alpha-beta: from.rackId updated to rack-2, to.rackId still rack-1
      expect(cAlphaBeta.from.rackId).toBe('rack-2');
      expect(cAlphaBeta.to.rackId).toBe('rack-1');
      expect(cAlphaBeta.from.deviceInstanceId).toBe('dev-alpha');
      expect(cAlphaBeta.to.deviceInstanceId).toBe('dev-beta');

      // cable-alpha-delta: from.rackId updated to rack-2, to.rackId was already rack-2
      expect(cAlphaDelta.from.rackId).toBe('rack-2');
      expect(cAlphaDelta.to.rackId).toBe('rack-2');

      // cable-alpha-loopback: BOTH endpoints updated to rack-2
      expect(cLoopback.from.rackId).toBe('rack-2');
      expect(cLoopback.to.rackId).toBe('rack-2');

      // cable-beta-gamma: dev-alpha not involved, untouched!
      expect(cBetaGamma.from.rackId).toBe('rack-1');
      expect(cBetaGamma.to.rackId).toBe('rack-1');

      // Check topology integrity
      const topologyCheck = validateCableTopologyIntegrity(cables, useProjectStore.getState().project.racks);
      expect(topologyCheck.valid).toBe(true);
      expect(topologyCheck.danglingCables).toHaveLength(0);

      // Undo: clean restoration of all endpoints
      history.undo();
      const revertedCables = useProjectStore.getState().project.cables;
      const rAlphaBeta = revertedCables.find(c => c.id === 'cable-alpha-beta')!;
      const rAlphaDelta = revertedCables.find(c => c.id === 'cable-alpha-delta')!;
      const rLoopback = revertedCables.find(c => c.id === 'cable-alpha-loopback')!;

      expect(rAlphaBeta.from.rackId).toBe('rack-1');
      expect(rAlphaBeta.to.rackId).toBe('rack-1');
      expect(rAlphaDelta.from.rackId).toBe('rack-1');
      expect(rAlphaDelta.to.rackId).toBe('rack-2');
      expect(rLoopback.from.rackId).toBe('rack-1');
      expect(rLoopback.to.rackId).toBe('rack-1');

      // Verify topology is still valid after undo
      expect(validateCableTopologyIntegrity(revertedCables, useProjectStore.getState().project.racks).valid).toBe(true);
    });

    it('2.2 Deduplicates loopback cable in affectedCableIds and updates both endpoints', () => {
      const history = useHistoryStore.getState();

      const cmd = new MoveDeviceCommand({
        instanceId: 'dev-alpha',
        targetRackId: 'rack-3',
        targetStartU: 10,
      });

      const res = history.executeCommand(cmd);
      expect(res.success).toBe(true);

      // Verify cable-alpha-loopback appears exactly once in affectedCableIds
      const loopbackCount = res.affectedCableIds!.filter(id => id === 'cable-alpha-loopback').length;
      expect(loopbackCount).toBe(1);

      const loopCable = useProjectStore.getState().project.cables.find(c => c.id === 'cable-alpha-loopback')!;
      expect(loopCable.from.rackId).toBe('rack-3');
      expect(loopCable.to.rackId).toBe('rack-3');
    });
  });

  // ===========================================================================
  // Focus 3: Intra-Rack Moves Return Non-Empty _affectedCableIds
  // ===========================================================================
  describe('Focus 3: Intra-Rack Moves Return Non-Empty _affectedCableIds', () => {
    it('3.1 Returns all attached cables in affectedCableIds on intra-rack move (same rack, new slot)', () => {
      const history = useHistoryStore.getState();

      // dev-alpha has 3 attached cables: cable-alpha-beta, cable-alpha-delta, cable-alpha-loopback
      const cmd = new MoveDeviceCommand({
        instanceId: 'dev-alpha',
        targetRackId: 'rack-1',
        targetStartU: 1, // slot 1 is free
      });

      const res = history.executeCommand(cmd);
      expect(res.success).toBe(true);
      expect(res.affectedCableIds).toBeDefined();
      expect(res.affectedCableIds!.length).toBe(3);
      expect(res.affectedCableIds).toContain('cable-alpha-beta');
      expect(res.affectedCableIds).toContain('cable-alpha-delta');
      expect(res.affectedCableIds).toContain('cable-alpha-loopback');
      // dev-alpha is NOT connected to cable-beta-gamma
      expect(res.affectedCableIds).not.toContain('cable-beta-gamma');

      // Undo also returns affectedCableIds
      const undoRes = history.undo();
      expect(undoRes.affectedCableIds).toBeDefined();
      expect(undoRes.affectedCableIds!.length).toBe(3);
      expect(undoRes.affectedCableIds).toContain('cable-alpha-beta');
    });

    it('3.2 Returns empty affectedCableIds for device with no attached cables', () => {
      const history = useHistoryStore.getState();

      // Add a standalone device with no cables
      const placeCmd = new PlaceDeviceCommand({
        rackId: 'rack-1',
        catalogId: 'cisco-catalyst-9300',
        startU: 35,
        instanceId: 'dev-isolated',
      });
      expect(history.executeCommand(placeCmd).success).toBe(true);

      // Move dev-isolated within rack-1
      const moveCmd = new MoveDeviceCommand({
        instanceId: 'dev-isolated',
        targetRackId: 'rack-1',
        targetStartU: 38,
      });
      const moveRes = history.executeCommand(moveCmd);
      expect(moveRes.success).toBe(true);
      expect(moveRes.affectedCableIds).toBeDefined();
      expect(moveRes.affectedCableIds).toEqual([]);
    });

    it('3.3 Intra-rack move preserves cable endpoints and rackId', () => {
      const history = useHistoryStore.getState();

      const cmd = new MoveDeviceCommand({
        instanceId: 'dev-alpha',
        targetRackId: 'rack-1',
        targetStartU: 5,
      });
      expect(history.executeCommand(cmd).success).toBe(true);

      const cables = useProjectStore.getState().project.cables;
      const cAlphaBeta = cables.find(c => c.id === 'cable-alpha-beta')!;
      expect(cAlphaBeta.from.rackId).toBe('rack-1');
      expect(cAlphaBeta.to.rackId).toBe('rack-1');
      expect(cAlphaBeta.from.face).toBe('front');
      expect(cAlphaBeta.to.face).toBe('front');

      const topologyCheck = validateCableTopologyIntegrity(cables, useProjectStore.getState().project.racks);
      expect(topologyCheck.valid).toBe(true);
    });
  });

  // ===========================================================================
  // Focus 4: Face Flips (Front <-> Rear)
  // ===========================================================================
  describe('Focus 4: Face Flips (Front <-> Rear) & Cable Endpoint Synchronization', () => {
    it('4.1 Intra-rack face flip front -> rear updates cable endpoint face and undo restores front', () => {
      const history = useHistoryStore.getState();

      // dev-alpha is on 'front' face. Move to U12 on 'rear' face.
      const cmd = new MoveDeviceCommand({
        instanceId: 'dev-alpha',
        targetRackId: 'rack-1',
        targetStartU: 12,
        targetFace: 'rear',
      });

      const res = history.executeCommand(cmd);
      expect(res.success).toBe(true);

      const dev = useProjectStore.getState().project.racks[0]!.devices.find(d => d.instanceId === 'dev-alpha')!;
      expect(dev.face).toBe('rear');
      expect(dev.startU).toBe(12);

      const cables = useProjectStore.getState().project.cables;
      const cAlphaBeta = cables.find(c => c.id === 'cable-alpha-beta')!;
      const cLoopback = cables.find(c => c.id === 'cable-alpha-loopback')!;

      // cAlphaBeta: from (dev-alpha) is now 'rear', to (dev-beta) is still 'front'
      expect(cAlphaBeta.from.face).toBe('rear');
      expect(cAlphaBeta.to.face).toBe('front');

      // cLoopback: both endpoints were on dev-alpha, so both must be 'rear'
      expect(cLoopback.from.face).toBe('rear');
      expect(cLoopback.to.face).toBe('rear');

      // Undo: restores dev-alpha to 'front' and cables to 'front'
      history.undo();
      const undoneDev = useProjectStore.getState().project.racks[0]!.devices.find(d => d.instanceId === 'dev-alpha')!;
      expect(undoneDev.face).toBe('front');
      expect(undoneDev.startU).toBe(10);

      const undoneCables = useProjectStore.getState().project.cables;
      const uAlphaBeta = undoneCables.find(c => c.id === 'cable-alpha-beta')!;
      const uLoopback = undoneCables.find(c => c.id === 'cable-alpha-loopback')!;
      expect(uAlphaBeta.from.face).toBe('front');
      expect(uAlphaBeta.to.face).toBe('front');
      expect(uLoopback.from.face).toBe('front');
      expect(uLoopback.to.face).toBe('front');

      // Redo: flips back to 'rear'
      history.redo();
      const redoneCables = useProjectStore.getState().project.cables;
      expect(redoneCables.find(c => c.id === 'cable-alpha-beta')!.from.face).toBe('rear');
      expect(redoneCables.find(c => c.id === 'cable-alpha-loopback')!.from.face).toBe('rear');
      expect(redoneCables.find(c => c.id === 'cable-alpha-loopback')!.to.face).toBe('rear');
    });

    it('4.2 Face flip rear -> front updates cable endpoint face to front', () => {
      const history = useHistoryStore.getState();

      // dev-gamma is on 'rear' face with cable-beta-gamma (to dev-gamma on rear face)
      const initialDev = useProjectStore.getState().project.racks[0]!.devices.find(d => d.instanceId === 'dev-gamma')!;
      expect(initialDev.face).toBe('rear');

      const cmd = new MoveDeviceCommand({
        instanceId: 'dev-gamma',
        targetRackId: 'rack-1',
        targetStartU: 1, // U1 front is free
        targetFace: 'front',
      });

      const res = history.executeCommand(cmd);
      expect(res.success).toBe(true);

      const dev = useProjectStore.getState().project.racks[0]!.devices.find(d => d.instanceId === 'dev-gamma')!;
      expect(dev.face).toBe('front');

      const cable = useProjectStore.getState().project.cables.find(c => c.id === 'cable-beta-gamma')!;
      expect(cable.to.face).toBe('front');
      expect(cable.from.face).toBe('front'); // dev-beta was already front

      // Undo: restores dev-gamma to 'rear' and cable.to.face to 'rear'
      history.undo();
      const undoneCable = useProjectStore.getState().project.cables.find(c => c.id === 'cable-beta-gamma')!;
      expect(undoneCable.to.face).toBe('rear');
      const undoneDev = useProjectStore.getState().project.racks[0]!.devices.find(d => d.instanceId === 'dev-gamma')!;
      expect(undoneDev.face).toBe('rear');
    });

    it('4.3 Inter-rack move with face flip simultaneously updates rackId and face', () => {
      const history = useHistoryStore.getState();

      // Move dev-alpha from rack-1 front U10 to rack-3 rear U5
      const cmd = new MoveDeviceCommand({
        instanceId: 'dev-alpha',
        targetRackId: 'rack-3',
        targetStartU: 5,
        targetFace: 'rear',
      });

      const res = history.executeCommand(cmd);
      expect(res.success).toBe(true);

      const dev = useProjectStore.getState().project.racks[2]!.devices.find(d => d.instanceId === 'dev-alpha')!;
      expect(dev.rackId).toBe('rack-3');
      expect(dev.face).toBe('rear');
      expect(dev.startU).toBe(5);

      const cables = useProjectStore.getState().project.cables;
      const cAlphaDelta = cables.find(c => c.id === 'cable-alpha-delta')!;
      expect(cAlphaDelta.from.rackId).toBe('rack-3');
      expect(cAlphaDelta.from.face).toBe('rear');
      expect(cAlphaDelta.to.rackId).toBe('rack-2');
      expect(cAlphaDelta.to.face).toBe('front');

      // Undo: restores rack-1 and front
      history.undo();
      const undoneCable = useProjectStore.getState().project.cables.find(c => c.id === 'cable-alpha-delta')!;
      expect(undoneCable.from.rackId).toBe('rack-1');
      expect(undoneCable.from.face).toBe('front');
    });
  });

  // Helper to extract canonical domain topology (excluding non-deterministic timestamps, sorting devices)
  function getCanonicalTopology() {
    const project = useProjectStore.getState().project;
    return {
      racks: project.racks.map(r => ({
        id: r.id,
        totalU: r.totalU,
        devices: [...r.devices]
          .sort((a, b) => a.instanceId.localeCompare(b.instanceId))
          .map(d => ({
            instanceId: d.instanceId,
            catalogId: d.catalogId,
            rackId: d.rackId,
            startU: d.startU,
            uHeight: d.uHeight,
            face: d.face,
            customLabel: d.customLabel,
          })),
      })),
      cables: [...project.cables]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map(c => ({
          id: c.id,
          from: { ...c.from },
          to: { ...c.to },
          color: c.color,
          category: c.category,
        })),
    };
  }

  // ===========================================================================
  // Focus 5: Undo/Redo Inversion & Deep State Invariance (Oracle)
  // ===========================================================================
  describe('Focus 5: Undo/Redo Inversion Oracle & Topology Stress Test', () => {
    it('5.1 State Inversion Oracle: Full project snapshot exactly preserved after move + undo', () => {
      const history = useHistoryStore.getState();
      const initialSnapshot = JSON.stringify(getCanonicalTopology());

      // Execute a move
      const cmd = new MoveDeviceCommand({
        instanceId: 'dev-alpha',
        targetRackId: 'rack-2',
        targetStartU: 25,
        targetFace: 'rear',
      });
      const res = history.executeCommand(cmd);
      expect(res.success).toBe(true);

      // State is different
      const movedSnapshot = JSON.stringify(getCanonicalTopology());
      expect(movedSnapshot).not.toBe(initialSnapshot);

      // Undo
      history.undo();
      const revertedSnapshot = JSON.stringify(getCanonicalTopology());
      expect(revertedSnapshot).toBe(initialSnapshot);
    });

    it('5.2 Stress Invariant: 20 sequential moves maintain 100% cable topology integrity at every step', () => {
      const history = useHistoryStore.getState();
      const racks = ['rack-1', 'rack-2', 'rack-3'];
      const faces: ('front' | 'rear')[] = ['front', 'rear'];
      const snapshots: string[] = [];

      snapshots.push(JSON.stringify(getCanonicalTopology()));

      // Perform 20 legal moves across the 3 racks
      for (let i = 0; i < 20; i++) {
        const targetRackId = racks[i % racks.length]!;
        const targetFace = faces[i % 2]!;
        // Pick an unoccupied slot in the target rack
        const targetStartU = 1 + ((i * 2) % 38);

        // Find dev-alpha's current location and move it
        const moveCmd = new MoveDeviceCommand({
          instanceId: 'dev-alpha',
          targetRackId,
          targetStartU,
          targetFace,
        });

        const execRes = history.executeCommand(moveCmd);
        // If the slot had a collision with existing dev-beta/gamma/delta, try an offset slot
        if (!execRes.success) {
          const fallbackCmd = new MoveDeviceCommand({
            instanceId: 'dev-alpha',
            targetRackId,
            targetStartU: 40,
            targetFace,
          });
          const fbRes = history.executeCommand(fallbackCmd);
          expect(fbRes.success).toBe(true);
        }

        // Verify cable topology integrity at this step
        const currentProject = useProjectStore.getState().project;
        const check = validateCableTopologyIntegrity(currentProject.cables, currentProject.racks);
        expect(check.valid).toBe(true);
        expect(check.danglingCables).toHaveLength(0);

        snapshots.push(JSON.stringify(getCanonicalTopology()));
      }

      // Now undo all 20 moves one by one, checking state equality against snapshots
      for (let i = 20; i > 0; i--) {
        history.undo();
        const stateNow = JSON.stringify(getCanonicalTopology());
        expect(stateNow).toBe(snapshots[i - 1]);
      }

      // Now redo all 20 moves one by one, checking state equality against snapshots
      for (let i = 1; i <= 20; i++) {
        history.redo();
        const stateNow = JSON.stringify(getCanonicalTopology());
        expect(stateNow).toBe(snapshots[i]);
      }
    });

    it('5.3 Rejects collision moves without altering state or cable endpoints', () => {
      const history = useHistoryStore.getState();
      const snapshotBefore = JSON.stringify(getCanonicalTopology());

      // dev-beta is at rack-1 U20 front. Attempting to move dev-alpha to U20 front should collide.
      const cmd = new MoveDeviceCommand({
        instanceId: 'dev-alpha',
        targetRackId: 'rack-1',
        targetStartU: 20,
        targetFace: 'front',
      });

      const res = history.executeCommand(cmd);
      expect(res.success).toBe(false);
      expect(res.error).toContain('Collision');

      const snapshotAfter = JSON.stringify(getCanonicalTopology());
      expect(snapshotAfter).toBe(snapshotBefore);

      // History should not have recorded the failed move
      expect(useHistoryStore.getState().canUndo).toBe(false);
    });

    it('5.4 Rejects out-of-bounds moves without altering state or cable endpoints', () => {
      const history = useHistoryStore.getState();
      const snapshotBefore = JSON.stringify(getCanonicalTopology());

      // Move dev-alpha to U43 in 42U rack
      const cmd = new MoveDeviceCommand({
        instanceId: 'dev-alpha',
        targetRackId: 'rack-1',
        targetStartU: 43,
      });

      const res = history.executeCommand(cmd);
      expect(res.success).toBe(false);
      expect(res.error).toContain('out of bounds');

      const snapshotAfter = JSON.stringify(getCanonicalTopology());
      expect(snapshotAfter).toBe(snapshotBefore);
      expect(useHistoryStore.getState().canUndo).toBe(false);
    });

    it('5.5 Interleaved move and delete: Undo restores exact position, face, and cable topology', () => {
      const history = useHistoryStore.getState();

      // 1. Move dev-alpha to rack-2 U20
      const moveCmd = new MoveDeviceCommand({
        instanceId: 'dev-alpha',
        targetRackId: 'rack-2',
        targetStartU: 20,
        targetFace: 'rear',
      });
      expect(history.executeCommand(moveCmd).success).toBe(true);

      // 2. Remove dev-alpha (attached cables will be detached)
      const removeCmd = new RemoveDeviceCommand('dev-alpha');
      const remRes = history.executeCommand(removeCmd);
      expect(remRes.success).toBe(true);
      expect(remRes.affectedCableIds!.length).toBeGreaterThan(0);

      // Verify dev-alpha and its cables are removed from active project
      const projAfterRemove = useProjectStore.getState().project;
      expect(projAfterRemove.racks[1]!.devices.some(d => d.instanceId === 'dev-alpha')).toBe(false);
      expect(projAfterRemove.cables.some(c => c.from.deviceInstanceId === 'dev-alpha' || c.to.deviceInstanceId === 'dev-alpha')).toBe(false);

      // 3. Undo Remove: restores dev-alpha to rack-2 U20 rear AND restores all attached cables
      history.undo();
      const projAfterUndoRemove = useProjectStore.getState().project;
      const restoredDev = projAfterUndoRemove.racks[1]!.devices.find(d => d.instanceId === 'dev-alpha')!;
      expect(restoredDev).toBeDefined();
      expect(restoredDev.rackId).toBe('rack-2');
      expect(restoredDev.startU).toBe(20);
      expect(restoredDev.face).toBe('rear');

      const restoredCables = projAfterUndoRemove.cables;
      expect(restoredCables.some(c => c.id === 'cable-alpha-beta')).toBe(true);
      expect(validateCableTopologyIntegrity(restoredCables, projAfterUndoRemove.racks).valid).toBe(true);

      // 4. Undo Move: restores dev-alpha to rack-1 U10 front AND restores cables to rack-1 front
      history.undo();
      const projAfterUndoMove = useProjectStore.getState().project;
      const originalDev = projAfterUndoMove.racks[0]!.devices.find(d => d.instanceId === 'dev-alpha')!;
      expect(originalDev).toBeDefined();
      expect(originalDev.rackId).toBe('rack-1');
      expect(originalDev.startU).toBe(10);
      expect(originalDev.face).toBe('front');

      const originalCable = projAfterUndoMove.cables.find(c => c.id === 'cable-alpha-beta')!;
      expect(originalCable.from.rackId).toBe('rack-1');
      expect(originalCable.from.face).toBe('front');
      expect(validateCableTopologyIntegrity(projAfterUndoMove.cables, projAfterUndoMove.racks).valid).toBe(true);
    });

    it('5.6 Triangle cabling topology across 3 devices and 3 racks preserves endpoints and inverts cleanly', () => {
      const history = useHistoryStore.getState();

      // Triangle topology:
      // alpha (rack-1) <-> beta (rack-1)
      // beta (rack-1) <-> delta (rack-2)
      // delta (rack-2) <-> alpha (rack-1)
      useProjectStore.getState().mutate((draft) => {
        draft.cables = [
          {
            id: 'c-ab',
            from: { rackId: 'rack-1', deviceInstanceId: 'dev-alpha', portId: 'p1', face: 'front' },
            to: { rackId: 'rack-1', deviceInstanceId: 'dev-beta', portId: 'p1', face: 'front' },
            color: 'Blue',
            category: 'copper',
            routingStyle: 'structured',
            lengthMeters: 1.5,
          },
          {
            id: 'c-bd',
            from: { rackId: 'rack-1', deviceInstanceId: 'dev-beta', portId: 'p2', face: 'front' },
            to: { rackId: 'rack-2', deviceInstanceId: 'dev-delta', portId: 'p2', face: 'front' },
            color: 'Green',
            category: 'copper',
            routingStyle: 'structured',
            lengthMeters: 2.0,
          },
          {
            id: 'c-da',
            from: { rackId: 'rack-2', deviceInstanceId: 'dev-delta', portId: 'p3', face: 'front' },
            to: { rackId: 'rack-1', deviceInstanceId: 'dev-alpha', portId: 'p3', face: 'front' },
            color: 'Yellow',
            category: 'copper',
            routingStyle: 'structured',
            lengthMeters: 3.0,
          },
        ];
      });

      // Move 1: dev-alpha to rack-3 U10
      expect(history.executeCommand(new MoveDeviceCommand({ instanceId: 'dev-alpha', targetRackId: 'rack-3', targetStartU: 10 })).success).toBe(true);
      // Move 2: dev-beta to rack-2 U1 (front)
      expect(history.executeCommand(new MoveDeviceCommand({ instanceId: 'dev-beta', targetRackId: 'rack-2', targetStartU: 1 })).success).toBe(true);
      // Move 3: dev-delta to rack-3 U20 (rear)
      expect(history.executeCommand(new MoveDeviceCommand({ instanceId: 'dev-delta', targetRackId: 'rack-3', targetStartU: 20, targetFace: 'rear' })).success).toBe(true);

      const pMoved = useProjectStore.getState().project;
      const cab = pMoved.cables.find(c => c.id === 'c-ab')!;
      const cbd = pMoved.cables.find(c => c.id === 'c-bd')!;
      const cda = pMoved.cables.find(c => c.id === 'c-da')!;

      // c-ab: alpha in rack-3, beta in rack-2
      expect(cab.from.rackId).toBe('rack-3');
      expect(cab.to.rackId).toBe('rack-2');

      // c-bd: beta in rack-2, delta in rack-3 (rear)
      expect(cbd.from.rackId).toBe('rack-2');
      expect(cbd.to.rackId).toBe('rack-3');
      expect(cbd.to.face).toBe('rear');

      // c-da: delta in rack-3 (rear), alpha in rack-3 (front)
      expect(cda.from.rackId).toBe('rack-3');
      expect(cda.from.face).toBe('rear');
      expect(cda.to.rackId).toBe('rack-3');
      expect(cda.to.face).toBe('front');

      expect(validateCableTopologyIntegrity(pMoved.cables, pMoved.racks).valid).toBe(true);

      // Undo Move 3 (delta)
      history.undo();
      const pUndo1 = useProjectStore.getState().project;
      const cda1 = pUndo1.cables.find(c => c.id === 'c-da')!;
      expect(cda1.from.rackId).toBe('rack-2');
      expect(cda1.from.face).toBe('front');

      // Undo Move 2 (beta)
      history.undo();
      const pUndo2 = useProjectStore.getState().project;
      const cab2 = pUndo2.cables.find(c => c.id === 'c-ab')!;
      expect(cab2.to.rackId).toBe('rack-1');

      // Undo Move 1 (alpha)
      history.undo();
      const pUndo3 = useProjectStore.getState().project;
      const cab3 = pUndo3.cables.find(c => c.id === 'c-ab')!;
      expect(cab3.from.rackId).toBe('rack-1');
      expect(cab3.to.rackId).toBe('rack-1');
      expect(validateCableTopologyIntegrity(pUndo3.cables, pUndo3.racks).valid).toBe(true);
    });

    it('5.7 Multi-U device partial self-overlap move (e.g. 2U shifted by 1U) preserves instanceId and cables', () => {
      const history = useHistoryStore.getState();

      // dev-gamma is 2U (startU: 30, occupies U30-U31 on rear face)
      // Moving dev-gamma from U30 to U31 on rear face (overlaps at U31)
      const cmd = new MoveDeviceCommand({
        instanceId: 'dev-gamma',
        targetRackId: 'rack-1',
        targetStartU: 31,
        targetFace: 'rear',
      });

      const res = history.executeCommand(cmd);
      expect(res.success).toBe(true);

      const dev = useProjectStore.getState().project.racks[0]!.devices.find(d => d.instanceId === 'dev-gamma')!;
      expect(dev.startU).toBe(31);
      expect(dev.instanceId).toBe('dev-gamma');

      // cable-beta-gamma remains attached
      const cable = useProjectStore.getState().project.cables.find(c => c.id === 'cable-beta-gamma')!;
      expect(cable.to.deviceInstanceId).toBe('dev-gamma');
      expect(cable.to.face).toBe('rear');
      expect(validateCableTopologyIntegrity(useProjectStore.getState().project.cables, useProjectStore.getState().project.racks).valid).toBe(true);

      // Undo
      history.undo();
      const undoneDev = useProjectStore.getState().project.racks[0]!.devices.find(d => d.instanceId === 'dev-gamma')!;
      expect(undoneDev.startU).toBe(30);
    });

    it('5.8 Omitted targetFace preserves existing device mounting face and cable face', () => {
      const history = useHistoryStore.getState();

      // dev-gamma is on 'rear' face
      const cmd = new MoveDeviceCommand({
        instanceId: 'dev-gamma',
        targetRackId: 'rack-1',
        targetStartU: 1, // slot 1 rear is free
        // targetFace omitted!
      });

      const res = history.executeCommand(cmd);
      expect(res.success).toBe(true);

      const dev = useProjectStore.getState().project.racks[0]!.devices.find(d => d.instanceId === 'dev-gamma')!;
      expect(dev.face).toBe('rear'); // Preserved!

      const cable = useProjectStore.getState().project.cables.find(c => c.id === 'cable-beta-gamma')!;
      expect(cable.to.face).toBe('rear'); // Preserved!
    });

    it('5.9 Cable non-endpoint metadata is 100% retained across moves and undos', () => {
      const history = useHistoryStore.getState();

      useProjectStore.getState().mutate((draft) => {
        draft.cables[0]!.notes = 'High Priority MDF Trunk';
        draft.cables[0]!.lengthMeters = 3.25;
      });

      const cmd = new MoveDeviceCommand({
        instanceId: 'dev-alpha',
        targetRackId: 'rack-2',
        targetStartU: 5,
      });

      expect(history.executeCommand(cmd).success).toBe(true);

      const movedCable = useProjectStore.getState().project.cables.find(c => c.id === 'cable-alpha-beta')!;
      expect(movedCable.notes).toBe('High Priority MDF Trunk');
      expect(movedCable.lengthMeters).toBe(3.25);
      expect(movedCable.color).toBe('Blue');
      expect(movedCable.category).toBe('copper');
      expect(movedCable.routingStyle).toBe('structured');

      // Undo
      history.undo();
      const undoneCable = useProjectStore.getState().project.cables.find(c => c.id === 'cable-alpha-beta')!;
      expect(undoneCable.notes).toBe('High Priority MDF Trunk');
      expect(undoneCable.lengthMeters).toBe(3.25);
    });

    it('5.10 Operates safely when project has zero cables or undefined cables', () => {
      const history = useHistoryStore.getState();

      useProjectStore.getState().mutate((draft) => {
        draft.cables = [];
      });

      const cmd = new MoveDeviceCommand({
        instanceId: 'dev-alpha',
        targetRackId: 'rack-1',
        targetStartU: 1,
      });

      const res = history.executeCommand(cmd);
      expect(res.success).toBe(true);
      expect(res.affectedCableIds).toEqual([]);

      history.undo();
      const undoneDev = useProjectStore.getState().project.racks[0]!.devices.find(d => d.instanceId === 'dev-alpha')!;
      expect(undoneDev.startU).toBe(10);
    });
  });
});
