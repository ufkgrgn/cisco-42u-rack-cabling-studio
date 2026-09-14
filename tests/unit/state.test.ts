import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useProjectStore } from '../../src/core/state/projectStore';
import { useSelectionStore } from '../../src/core/state/selectionStore';
import { useHistoryStore } from '../../src/core/state/historyStore';
import { engineBridge } from '../../src/engine/bridge/EngineBridge';
import { PlaceDeviceCommand } from '../../src/core/history/commands/PlaceDeviceCommand';

describe('Milestone M1: State Management & EngineBridge Suite', () => {
  beforeEach(() => {
    useProjectStore.getState().reset();
    useSelectionStore.getState().clearSelection();
    useHistoryStore.getState().clearHistory();
    engineBridge.clear?.();
  });

  describe('ProjectStore', () => {
    it('initializes with default project and mutates immutably', () => {
      const state = useProjectStore.getState();
      expect(state.project.racks.length).toBe(1);
      expect(state.project.activeRackId).toBe('rack-1');

      // Mutate
      state.mutate((draft) => {
        draft.racks[0]!.name = 'Updated MDF Frame';
      });

      const updated = useProjectStore.getState();
      expect(updated.project.racks[0]?.name).toBe('Updated MDF Frame');
      expect(updated.isDirty).toBe(true);
      expect(updated.revision).toBe(state.revision + 1);
    });

    it('handles loadProjectFromData with automatic legacy migration', () => {
      const legacyData = {
        version: '2.0-enterprise',
        devices: [{ instanceId: 'legacy-sw', catalogKey: 'cisco-catalyst-9300', topU: 24, uHeight: 1 }]
      };

      useProjectStore.getState().loadProjectFromData(legacyData);

      const state = useProjectStore.getState();
      expect(state.project.schemaVersion).toBe(3);
      expect(state.project.racks[0]?.devices[0]?.catalogId).toBe('cisco-catalyst-9300');
      expect(state.project.racks[0]?.devices[0]?.startU).toBe(24);
    });
  });

  describe('SelectionStore', () => {
    it('manages transient UI selection and connection staging', () => {
      const selection = useSelectionStore.getState();

      selection.select('device', 'dev-1');
      expect(useSelectionStore.getState().selectedId).toBe('dev-1');
      expect(useSelectionStore.getState().selectedType).toBe('device');

      selection.startConnection({
        rackId: 'rack-1',
        deviceInstanceId: 'dev-1',
        portId: 'port-1',
        face: 'front'
      }, '#10b981');

      const pending = useSelectionStore.getState().pendingConnection;
      expect(pending?.fromEndpoint.portId).toBe('port-1');
      expect(pending?.tempCableColor).toBe('#10b981');

      selection.cancelConnection();
      expect(useSelectionStore.getState().pendingConnection).toBeNull();
    });
  });

  describe('EngineBridge', () => {
    it('routes engine events and allows listeners to unsubscribe', () => {
      const callback = vi.fn();
      const unsub = engineBridge.on('viewport:change', callback);

      engineBridge.emit('viewport:change', { zoom: 1.5, panX: 100, panY: 200 });
      expect(callback).toHaveBeenCalledWith({ zoom: 1.5, panX: 100, panY: 200 });

      unsub();
      engineBridge.emit('viewport:change', { zoom: 2.0, panX: 0, panY: 0 });
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('connects fine-grained store updates directly to canvas engine without React renders', () => {
      const onRacksChanged = vi.fn();
      const onCablesChanged = vi.fn();
      const onSelectionChanged = vi.fn();

      const disconnect = engineBridge.connectEngine({
        onRacksChanged,
        onCablesChanged,
        onSelectionChanged
      });

      // Dispatch command through engineBridge
      engineBridge.dispatchCommand(new PlaceDeviceCommand({
        rackId: 'rack-1',
        catalogId: 'cisco-catalyst-9300',
        startU: 1,
        instanceId: 'dev-bridge-test'
      }));

      expect(onRacksChanged).toHaveBeenCalled();

      disconnect();
    });
  });
});
