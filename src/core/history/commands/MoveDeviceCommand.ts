import { ICommand, CommandContext, CommandExecutionResult } from '../types';
import { DeviceInstance, RackModel, CableRun } from '../../types';
import { validatePlacement } from '../../placement';

export interface MoveDevicePayload {
  instanceId: string;
  targetRackId: string;
  targetStartU: number;
  targetFace?: 'front' | 'rear';
}

export class MoveDeviceCommand implements ICommand {
  readonly id: string;
  readonly name = 'Move Device';
  readonly timestamp: number;
  readonly description: string;

  private _instanceId: string;
  private _targetRackId: string;
  private _targetStartU: number;
  private _targetFace?: 'front' | 'rear';

  // Snapshot deltas captured during initial execution
  private _sourceRackId!: string;
  private _sourceStartU!: number;
  private _sourceFace!: 'front' | 'rear';
  private _uHeight!: number;
  private _affectedCableIds: string[] = [];
  private _executed = false;

  constructor(payload: MoveDevicePayload) {
    this.id = `cmd-move-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    this.timestamp = Date.now();
    this._instanceId = payload.instanceId;
    this._targetRackId = payload.targetRackId;
    this._targetStartU = payload.targetStartU;
    this._targetFace = payload.targetFace;
    this.description = `Move device ${payload.instanceId} to rack ${payload.targetRackId} U${payload.targetStartU}`;
  }

  execute(context: CommandContext): CommandExecutionResult {
    const project = context.projectStore.getState();

    // 1. Locate source device
    const sourceRack = project.racks.find((r: RackModel) => r.devices.some((d: DeviceInstance) => d.instanceId === this._instanceId));
    if (!sourceRack) return { success: false, error: `Device '${this._instanceId}' not found in any rack.` };
    const device = sourceRack.devices.find((d: DeviceInstance) => d.instanceId === this._instanceId)!;

    // Cache source state for inversion
    this._sourceRackId = sourceRack.id;
    this._sourceStartU = device.startU;
    this._sourceFace = device.face;
    this._uHeight = device.uHeight;
    const finalFace = this._targetFace || device.face;

    // 2. Validate target rack
    const targetRack = project.racks.find((r: RackModel) => r.id === this._targetRackId);
    if (!targetRack) return { success: false, error: `Target rack '${this._targetRackId}' not found.` };

    // 3. Centralized placement validation (bounds, collision with self-exemption and face isolation)
    const validation = validatePlacement(
      targetRack,
      {
        instanceId: this._instanceId,
        catalogId: device.catalogId,
        startU: this._targetStartU,
        uHeight: this._uHeight,
        face: finalFace,
      },
      this._targetStartU,
      finalFace
    );

    if (!validation.valid) {
      if (validation.reason === 'COLLISION') {
        return { success: false, error: `Collision at U${this._targetStartU} with '${validation.conflictingInstanceId}'.` };
      }
      const endU = this._targetStartU + this._uHeight - 1;
      return { success: false, error: `Target position U${this._targetStartU}-U${endU} out of bounds for rack ${targetRack.id} (total U: ${targetRack.totalU}).` };
    }

    // 4. Forward Delta: Update device and attached cable endpoints (both intra-rack and inter-rack)
    this._affectedCableIds = [];

    context.projectStore.setState((state: any) => {
      const srcR = state.racks.find((r: RackModel) => r.id === this._sourceRackId)!;
      const tgtR = state.racks.find((r: RackModel) => r.id === this._targetRackId)!;

      const devIdx = srcR.devices.findIndex((d: DeviceInstance) => d.instanceId === this._instanceId);
      const [devObj] = srcR.devices.splice(devIdx, 1);

      devObj.rackId = this._targetRackId;
      devObj.startU = this._targetStartU;
      devObj.face = finalFace;
      tgtR.devices.push(devObj);

      // Preserve cabling topology across racks and slot moves
      if (state.cables) {
        state.cables.forEach((c: CableRun) => {
          let touched = false;
          if (c.from.deviceInstanceId === this._instanceId) {
            c.from.rackId = this._targetRackId;
            c.from.face = finalFace;
            touched = true;
          }
          if (c.to.deviceInstanceId === this._instanceId) {
            c.to.rackId = this._targetRackId;
            c.to.face = finalFace;
            touched = true;
          }
          if (touched) this._affectedCableIds.push(c.id);
        });
        this._affectedCableIds = Array.from(new Set(this._affectedCableIds));
      }
    });

    if (context.selectionStore?.setState) {
      context.selectionStore.setState((s: any) => {
        s.selectedType = 'device';
        s.selectedId = this._instanceId;
        s.activeRackId = this._targetRackId;
      });
    }

    this._executed = true;
    return {
      success: true,
      affectedRackIds: Array.from(new Set([this._sourceRackId, this._targetRackId])),
      affectedDeviceIds: [this._instanceId],
      affectedCableIds: this._affectedCableIds
    };
  }

  undo(context: CommandContext): CommandExecutionResult {
    if (!this._executed) return { success: false, error: 'Command not executed.' };

    context.projectStore.setState((state: any) => {
      const tgtR = state.racks.find((r: RackModel) => r.id === this._targetRackId)!;
      const srcR = state.racks.find((r: RackModel) => r.id === this._sourceRackId)!;

      const devIdx = tgtR.devices.findIndex((d: DeviceInstance) => d.instanceId === this._instanceId);
      const [devObj] = tgtR.devices.splice(devIdx, 1);

      devObj.rackId = this._sourceRackId;
      devObj.startU = this._sourceStartU;
      devObj.face = this._sourceFace;
      srcR.devices.push(devObj);

      // Invert cable endpoints cleanly for all attached cables
      if (state.cables) {
        state.cables.forEach((c: CableRun) => {
          if (c.from.deviceInstanceId === this._instanceId) {
            c.from.rackId = this._sourceRackId;
            c.from.face = this._sourceFace;
          }
          if (c.to.deviceInstanceId === this._instanceId) {
            c.to.rackId = this._sourceRackId;
            c.to.face = this._sourceFace;
          }
        });
      }
    });

    if (context.selectionStore?.setState) {
      context.selectionStore.setState((s: any) => {
        s.selectedType = 'device';
        s.selectedId = this._instanceId;
        s.activeRackId = this._sourceRackId;
      });
    }

    this._executed = false;
    return {
      success: true,
      affectedRackIds: Array.from(new Set([this._sourceRackId, this._targetRackId])),
      affectedDeviceIds: [this._instanceId],
      affectedCableIds: this._affectedCableIds
    };
  }

  redo(context: CommandContext): CommandExecutionResult {
    return this.execute(context);
  }

  canUndo(): boolean {
    return this._executed;
  }

  canRedo(): boolean {
    return !this._executed;
  }
}
