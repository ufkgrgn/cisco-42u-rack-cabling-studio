import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore } from '../../src/core/state/projectStore';
import { useSelectionStore } from '../../src/core/state/selectionStore';
import { useHistoryStore, getCommandContext } from '../../src/core/state/historyStore';
import { PlaceDeviceCommand } from '../../src/core/history/commands/PlaceDeviceCommand';
import { MoveDeviceCommand } from '../../src/core/history/commands/MoveDeviceCommand';
import { RemoveDeviceCommand } from '../../src/core/history/commands/RemoveDeviceCommand';
import { ResizeRackCommand } from '../../src/core/history/commands/ResizeRackCommand';
import { AddCableCommand } from '../../src/core/history/commands/AddCableCommand';
import { RemoveCableCommand } from '../../src/core/history/commands/RemoveCableCommand';
import { MacroCommand } from '../../src/core/history/MacroCommand';
import { ProjectV3 } from '../../src/core/persistence/schemas';

describe('Milestone M1: Invertible Delta Command Suite', () => {
  const initialProject: ProjectV3 = {
    schemaVersion: 3,
    id: 'proj-cmd-test',
    name: 'Command Architecture Studio',
    metadata: { createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', author: 'Test Engineer', generator: 'Test' },
    activeRackId: 'rack-1',
    racks: [
      {
        id: 'rack-1',
        name: 'MDF Rack 1',
        totalU: 42,
        widthMm: 600,
        depthMm: 1000,
        maxLoadKg: 1000,
        positionX: 0,
        devices: []
      },
      {
        id: 'rack-2',
        name: 'IDF Rack 2',
        totalU: 42,
        widthMm: 600,
        depthMm: 1000,
        maxLoadKg: 1000,
        positionX: 750,
        devices: []
      }
    ],
    cables: [],
    customCatalog: {}
  };

  beforeEach(() => {
    useProjectStore.getState().setProject(initialProject);
    useSelectionStore.getState().clearSelection();
    useHistoryStore.getState().clearHistory();
  });

  describe('PlaceDeviceCommand', () => {
    it('executes placement, detects collisions and reverses via undo/redo', () => {
      const history = useHistoryStore.getState();

      const cmd1 = new PlaceDeviceCommand({
        rackId: 'rack-1',
        catalogId: 'cisco-catalyst-9300',
        startU: 10,
        face: 'front',
        instanceId: 'dev-sw-10'
      });

      const res1 = history.executeCommand(cmd1);
      expect(res1.success).toBe(true);

      const rack = useProjectStore.getState().project.racks[0]!;
      expect(rack.devices.length).toBe(1);
      expect(rack.devices[0]?.startU).toBe(10);
      expect(rack.devices[0]?.instanceId).toBe('dev-sw-10');

      // Collision rejection at same U slot
      const cmdCollision = new PlaceDeviceCommand({
        rackId: 'rack-1',
        catalogId: 'cisco-isr-4431',
        startU: 10,
        face: 'front',
        instanceId: 'dev-router-10'
      });
      const resCol = history.executeCommand(cmdCollision);
      expect(resCol.success).toBe(false);
      expect(resCol.error).toContain('Collision');

      // Undo reverts state
      const undoRes = history.undo();
      expect(undoRes.success).toBe(true);
      expect(useProjectStore.getState().project.racks[0]?.devices.length).toBe(0);

      // Redo restores state
      const redoRes = history.redo();
      expect(redoRes.success).toBe(true);
      expect(useProjectStore.getState().project.racks[0]?.devices.length).toBe(1);
    });

    it('rejects placement out of rack bounds', () => {
      const history = useHistoryStore.getState();
      const cmdOob = new PlaceDeviceCommand({
        rackId: 'rack-1',
        catalogId: 'server-dell-r740', // 2U
        startU: 42, // spans 42..43 in 42U rack
        face: 'front'
      });
      const res = history.executeCommand(cmdOob);
      expect(res.success).toBe(false);
      expect(res.error).toContain('out of bounds');
    });
  });

  describe('MoveDeviceCommand', () => {
    it('moves a device across racks, preserves cabling topology, and reverses losslessly', () => {
      const history = useHistoryStore.getState();

      // 1. Mount device in rack-1 and another in rack-2
      history.executeCommand(new PlaceDeviceCommand({
        rackId: 'rack-1',
        catalogId: 'cisco-catalyst-9300',
        startU: 10,
        instanceId: 'dev-1'
      }));

      history.executeCommand(new PlaceDeviceCommand({
        rackId: 'rack-2',
        catalogId: 'patch-panel-24',
        startU: 20,
        instanceId: 'dev-2'
      }));

      // 2. Connect cable between dev-1 and dev-2
      history.executeCommand(new AddCableCommand({
        id: 'cbl-1',
        from: { rackId: 'rack-1', deviceInstanceId: 'dev-1', portId: 'port_1', face: 'front' },
        to: { rackId: 'rack-2', deviceInstanceId: 'dev-2', portId: 'pt_1', face: 'front' },
        color: '#2563eb',
        category: 'copper',
        routingStyle: 'structured'
      }));

      // 3. Move dev-1 from rack-1 to rack-2 at U30
      const moveCmd = new MoveDeviceCommand({
        instanceId: 'dev-1',
        targetRackId: 'rack-2',
        targetStartU: 30
      });
      const moveRes = history.executeCommand(moveCmd);
      expect(moveRes.success).toBe(true);

      const project = useProjectStore.getState().project;
      const r1 = project.racks.find(r => r.id === 'rack-1')!;
      const r2 = project.racks.find(r => r.id === 'rack-2')!;

      expect(r1.devices.some(d => d.instanceId === 'dev-1')).toBe(false);
      expect(r2.devices.some(d => d.instanceId === 'dev-1')).toBe(true);

      // Verify cable endpoint updated to rack-2
      const cable = project.cables.find(c => c.id === 'cbl-1')!;
      expect(cable.from.rackId).toBe('rack-2');

      // 4. Undo move
      history.undo();
      const projectUndone = useProjectStore.getState().project;
      const r1Undone = projectUndone.racks.find(r => r.id === 'rack-1')!;
      expect(r1Undone.devices.some(d => d.instanceId === 'dev-1')).toBe(true);
      expect(projectUndone.cables[0]?.from.rackId).toBe('rack-1');
    });
  });

  describe('RemoveDeviceCommand', () => {
    it('cascades connected cable removal and restores both losslessly on undo', () => {
      const history = useHistoryStore.getState();

      history.executeCommand(new PlaceDeviceCommand({
        rackId: 'rack-1',
        catalogId: 'cisco-catalyst-9300',
        startU: 10,
        instanceId: 'dev-1'
      }));

      history.executeCommand(new PlaceDeviceCommand({
        rackId: 'rack-1',
        catalogId: 'patch-panel-24',
        startU: 20,
        instanceId: 'dev-2'
      }));

      history.executeCommand(new AddCableCommand({
        id: 'cbl-1',
        from: { rackId: 'rack-1', deviceInstanceId: 'dev-1', portId: 'port_1', face: 'front' },
        to: { rackId: 'rack-1', deviceInstanceId: 'dev-2', portId: 'pt_1', face: 'front' },
        color: '#10b981',
        category: 'copper',
        routingStyle: 'structured'
      }));

      expect(useProjectStore.getState().project.cables.length).toBe(1);

      // Remove dev-1
      const remCmd = new RemoveDeviceCommand('dev-1');
      const remRes = history.executeCommand(remCmd);
      expect(remRes.success).toBe(true);

      // Dev-1 and connected cable are removed
      expect(useProjectStore.getState().project.racks[0]?.devices.some(d => d.instanceId === 'dev-1')).toBe(false);
      expect(useProjectStore.getState().project.cables.length).toBe(0);

      // Undo restores both device and cable!
      history.undo();
      const restored = useProjectStore.getState().project;
      expect(restored.racks[0]?.devices.some(d => d.instanceId === 'dev-1')).toBe(true);
      expect(restored.cables.length).toBe(1);
      expect(restored.cables[0]?.id).toBe('cbl-1');
      expect(restored.cables[0]?.color).toBe('#10b981');
    });
  });

  describe('ResizeRackCommand & Shrinkage Prohibition Guard', () => {
    it('resizes rack and prohibits shrinking below highest occupied unit', () => {
      const history = useHistoryStore.getState();

      // Mount device at U38 (1U)
      history.executeCommand(new PlaceDeviceCommand({
        rackId: 'rack-1',
        catalogId: 'cisco-isr-4431',
        startU: 38,
        instanceId: 'dev-high'
      }));

      // Shrinking to 30U must be blocked (AC4)
      const shrinkCmd = new ResizeRackCommand('rack-1', 30);
      const shrinkRes = history.executeCommand(shrinkCmd);
      expect(shrinkRes.success).toBe(false);
      expect(shrinkRes.error).toContain('Cannot shrink rack');
      expect(useProjectStore.getState().project.racks[0]?.totalU).toBe(42);

      // Expanding to 48U must succeed
      const expandCmd = new ResizeRackCommand('rack-1', 48);
      const expandRes = history.executeCommand(expandCmd);
      expect(expandRes.success).toBe(true);
      expect(useProjectStore.getState().project.racks[0]?.totalU).toBe(48);

      // Undo restores 42U
      history.undo();
      expect(useProjectStore.getState().project.racks[0]?.totalU).toBe(42);
    });
  });

  describe('AddCableCommand & RemoveCableCommand', () => {
    it('enforces port mutual exclusion and handles undo/redo', () => {
      const history = useHistoryStore.getState();

      history.executeCommand(new PlaceDeviceCommand({
        rackId: 'rack-1',
        catalogId: 'cisco-catalyst-9300',
        startU: 1,
        instanceId: 'dev-sw-1'
      }));

      history.executeCommand(new PlaceDeviceCommand({
        rackId: 'rack-1',
        catalogId: 'patch-panel-24',
        startU: 5,
        instanceId: 'dev-pp-1'
      }));

      const cableCmd1 = new AddCableCommand({
        id: 'cbl-1',
        from: { rackId: 'rack-1', deviceInstanceId: 'dev-sw-1', portId: 'port_1', face: 'front' },
        to: { rackId: 'rack-1', deviceInstanceId: 'dev-pp-1', portId: 'pt_1', face: 'front' },
        color: '#2563eb',
        category: 'copper',
        routingStyle: 'structured'
      });
      expect(history.executeCommand(cableCmd1).success).toBe(true);

      // Attempt to connect another cable to port_1 on sw-1 (Port Conflict)
      const cableConflict = new AddCableCommand({
        id: 'cbl-2',
        from: { rackId: 'rack-1', deviceInstanceId: 'dev-sw-1', portId: 'port_1', face: 'front' },
        to: { rackId: 'rack-1', deviceInstanceId: 'dev-pp-1', portId: 'pt_2', face: 'front' },
        color: '#ef4444',
        category: 'copper',
        routingStyle: 'structured'
      });
      const conflictRes = history.executeCommand(cableConflict);
      expect(conflictRes.success).toBe(false);
      expect(conflictRes.error).toContain('already have an attached cable');

      // Remove cable
      const remCableCmd = new RemoveCableCommand('cbl-1');
      expect(history.executeCommand(remCableCmd).success).toBe(true);
      expect(useProjectStore.getState().project.cables.length).toBe(0);

      // Undo restores cable
      history.undo();
      expect(useProjectStore.getState().project.cables.length).toBe(1);
    });
  });

  describe('MacroCommand & Atomic Transactions', () => {
    it('commits atomic multi-command batch and rolls back completely on intermediate failure', () => {
      const history = useHistoryStore.getState();

      // Transaction that succeeds
      history.beginTransaction('Mount Switch & Patch', 'Atomic provision');
      history.executeCommand(new PlaceDeviceCommand({
        rackId: 'rack-1',
        catalogId: 'cisco-catalyst-9300',
        startU: 10,
        instanceId: 'dev-tx-1'
      }));
      history.executeCommand(new PlaceDeviceCommand({
        rackId: 'rack-1',
        catalogId: 'patch-panel-24',
        startU: 12,
        instanceId: 'dev-tx-2'
      }));
      const commitRes = history.commitTransaction();
      expect(commitRes.success).toBe(true);

      expect(useProjectStore.getState().project.racks[0]?.devices.length).toBe(2);

      // Single undo reverses both devices atomically!
      history.undo();
      expect(useProjectStore.getState().project.racks[0]?.devices.length).toBe(0);

      // Single redo restores both devices atomically!
      history.redo();
      expect(useProjectStore.getState().project.racks[0]?.devices.length).toBe(2);
    });

    it('rolls back atomic MacroCommand when an intermediate sub-command fails', () => {
      const context = getCommandContext();
      const macro = new MacroCommand('Failing Batch');

      macro.add(new PlaceDeviceCommand({
        rackId: 'rack-1',
        catalogId: 'cisco-isr-4431',
        startU: 15,
        instanceId: 'dev-ok'
      }));

      // Sub-command that fails (out of bounds at U65)
      macro.add(new PlaceDeviceCommand({
        rackId: 'rack-1',
        catalogId: 'cisco-isr-4431',
        startU: 65,
        instanceId: 'dev-fail'
      }));

      const res = macro.execute(context);
      expect(res.success).toBe(false);
      expect(res.error).toContain('failed during');

      // Verify that dev-ok was rolled back and is NOT in the rack
      const rack = useProjectStore.getState().project.racks[0]!;
      expect(rack.devices.some(d => d.instanceId === 'dev-ok')).toBe(false);
    });
  });
});
