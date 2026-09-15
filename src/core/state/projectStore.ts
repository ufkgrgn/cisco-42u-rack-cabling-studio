import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { ProjectV3, ProjectSchemaV3, DeviceCatalogItem } from '../persistence/schemas';
import { migrateToV3 } from '../persistence/migration';
import { RackModel } from '../types';
import { syncCustomCatalog } from '../catalog/catalogRegistry';

export interface ProjectState {
  project: ProjectV3;
  isDirty: boolean;
  revision: number;

  // Actions
  setProject: (project: ProjectV3) => void;
  loadProjectFromData: (data: unknown) => void;
  setActiveRack: (rackId: string) => void;
  updateMetadata: (updates: Partial<ProjectV3['metadata']>) => void;
  mutate: (updater: (draft: ProjectV3) => void) => void;
  markSaved: () => void;
  reset: () => void;

  // Custom Device Catalog Actions
  addCustomDevice: (device: DeviceCatalogItem) => void;
  updateCustomDevice: (id: string, updates: Partial<DeviceCatalogItem>) => void;
  removeCustomDevice: (id: string) => void;
  importCustomDevices: (devices: DeviceCatalogItem[]) => void;
}

export const DEFAULT_INITIAL_PROJECT: ProjectV3 = {
  schemaVersion: 3,
  id: 'proj-default',
  name: 'MDF - 42U Ana Veri Merkezi',
  metadata: {
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    author: 'Network Engineer',
    generator: 'Cisco 42U Rack & Cabling Studio v3'
  },
  activeRackId: 'rack-1',
  racks: [
    {
      id: 'rack-1',
      name: 'MDF - 42U Omurga Kabini',
      totalU: 42,
      widthMm: 600,
      depthMm: 1000,
      maxLoadKg: 1000,
      positionX: 0,
      devices: []
    }
  ],
  cables: [],
  customCatalog: {}
};

function normalizeCustomItem(device: Partial<DeviceCatalogItem> & { id: string; name: string; category: any; u: number }): DeviceCatalogItem {
  return {
    ...device,
    manufacturer: device.manufacturer || 'Custom',
    depthMm: device.depthMm ?? 400,
    powerWatts: device.powerWatts ?? 0,
    ports: Array.isArray(device.ports) ? device.ports : [],
    rearPorts: Array.isArray(device.rearPorts) ? device.rearPorts : [],
    isCustom: true
  };
}

export const useProjectStore = create<ProjectState>()(
  subscribeWithSelector((set) => ({
    project: DEFAULT_INITIAL_PROJECT,
    isDirty: false,
    revision: 0,

    setProject: (project) => {
      const parsed = ProjectSchemaV3.parse(project);
      syncCustomCatalog(parsed.customCatalog);
      set((state) => ({
        project: parsed,
        isDirty: false,
        revision: state.revision + 1
      }));
    },

    loadProjectFromData: (data) => {
      const migrated = migrateToV3(data);
      syncCustomCatalog(migrated.customCatalog);
      set((state) => ({
        project: migrated,
        isDirty: false,
        revision: state.revision + 1
      }));
    },

    setActiveRack: (rackId) =>
      set((state) => {
        if (!state.project.racks.some((r: RackModel) => r.id === rackId)) {
          return state;
        }
        return {
          project: {
            ...state.project,
            activeRackId: rackId,
            metadata: {
              ...state.project.metadata,
              updatedAt: new Date().toISOString()
            }
          },
          isDirty: true,
          revision: state.revision + 1
        };
      }),

    updateMetadata: (updates) =>
      set((state) => ({
        project: {
          ...state.project,
          metadata: {
            ...state.project.metadata,
            ...updates,
            updatedAt: new Date().toISOString()
          }
        },
        isDirty: true,
        revision: state.revision + 1
      })),

    mutate: (updater) =>
      set((state) => {
        // Deep clone project draft
        const draft: ProjectV3 = JSON.parse(JSON.stringify(state.project));
        updater(draft);
        draft.metadata.updatedAt = new Date().toISOString();
        if (draft.customCatalog) {
          syncCustomCatalog(draft.customCatalog);
        }
        return {
          project: draft,
          isDirty: true,
          revision: state.revision + 1
        };
      }),

    markSaved: () => set({ isDirty: false }),

    reset: () => {
      syncCustomCatalog({});
      set((state) => ({
        project: {
          ...DEFAULT_INITIAL_PROJECT,
          id: `proj-${Date.now()}`,
          metadata: {
            ...DEFAULT_INITIAL_PROJECT.metadata,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        },
        isDirty: false,
        revision: state.revision + 1
      }));
    },

    addCustomDevice: (device) =>
      set((state) => {
        const customItem = normalizeCustomItem(device);
        const updatedCustom: Record<string, DeviceCatalogItem> = {
          ...state.project.customCatalog,
          [device.id]: customItem
        };
        syncCustomCatalog(updatedCustom);
        return {
          project: {
            ...state.project,
            customCatalog: updatedCustom,
            metadata: {
              ...state.project.metadata,
              updatedAt: new Date().toISOString()
            }
          },
          isDirty: true,
          revision: state.revision + 1
        };
      }),

    updateCustomDevice: (id, updates) =>
      set((state) => {
        const existing = state.project.customCatalog[id];
        if (!existing) return state;
        const updatedItem = normalizeCustomItem({
          ...existing,
          ...updates,
          id
        });
        const updatedCustom: Record<string, DeviceCatalogItem> = {
          ...state.project.customCatalog,
          [id]: updatedItem
        };
        syncCustomCatalog(updatedCustom);
        return {
          project: {
            ...state.project,
            customCatalog: updatedCustom,
            metadata: {
              ...state.project.metadata,
              updatedAt: new Date().toISOString()
            }
          },
          isDirty: true,
          revision: state.revision + 1
        };
      }),

    removeCustomDevice: (id) =>
      set((state) => {
        const updatedCustom: Record<string, DeviceCatalogItem> = { ...state.project.customCatalog };
        delete updatedCustom[id];
        syncCustomCatalog(updatedCustom);
        return {
          project: {
            ...state.project,
            customCatalog: updatedCustom,
            metadata: {
              ...state.project.metadata,
              updatedAt: new Date().toISOString()
            }
          },
          isDirty: true,
          revision: state.revision + 1
        };
      }),

    importCustomDevices: (devices) =>
      set((state) => {
        const updatedCustom: Record<string, DeviceCatalogItem> = { ...state.project.customCatalog };
        for (const d of devices) {
          updatedCustom[d.id] = normalizeCustomItem(d);
        }
        syncCustomCatalog(updatedCustom);
        return {
          project: {
            ...state.project,
            customCatalog: updatedCustom,
            metadata: {
              ...state.project.metadata,
              updatedAt: new Date().toISOString()
            }
          },
          isDirty: true,
          revision: state.revision + 1
        };
      })
  }))
);
