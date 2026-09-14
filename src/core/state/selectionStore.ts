import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { CableEndpoint } from '../types';

export type SelectionType = 'rack' | 'device' | 'cable' | 'port' | null;

export interface PendingConnection {
  fromEndpoint: CableEndpoint;
  tempCableColor: string;
}

export interface SelectionState {
  selectedType: SelectionType;
  selectedId: string | null;
  activeRackId: string;
  hoveredPort: CableEndpoint | null;
  pendingConnection: PendingConnection | null;

  // Actions
  select: (type: SelectionType, id: string | null) => void;
  clearSelection: () => void;
  setActiveRack: (rackId: string) => void;
  setHoveredPort: (endpoint: CableEndpoint | null) => void;
  startConnection: (from: CableEndpoint, color?: string) => void;
  cancelConnection: () => void;
  mutate: (updater: (draft: SelectionState) => void) => void;
}

export const useSelectionStore = create<SelectionState>()(
  subscribeWithSelector((set) => ({
    selectedType: null,
    selectedId: null,
    activeRackId: 'rack-1',
    hoveredPort: null,
    pendingConnection: null,

    select: (type, id) => set({ selectedType: type, selectedId: id }),
    clearSelection: () => set({ selectedType: null, selectedId: null }),
    setActiveRack: (rackId) => set({ activeRackId: rackId }),
    setHoveredPort: (endpoint) => set({ hoveredPort: endpoint }),
    startConnection: (from, color = '#2563eb') =>
      set({ pendingConnection: { fromEndpoint: from, tempCableColor: color } }),
    cancelConnection: () => set({ pendingConnection: null }),
    mutate: (updater) =>
      set((state) => {
        const copy = { ...state };
        updater(copy);
        return copy;
      })
  }))
);
