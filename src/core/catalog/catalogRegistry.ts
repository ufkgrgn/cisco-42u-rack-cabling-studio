import { DeviceCatalogItem } from '../types';
import { CISCO_DEVICES } from './data/ciscoDevices';
import { SERVER_DEVICES } from './data/serverDevices';
import { CABINET_MODELS } from './data/cabinetModels';
import { ACCESSORIES } from './data/accessories';
import { PDU_DEVICES } from './data/pduDevices';
import { PATCH_PANELS } from './data/patchPanels';
import { TRANSCEIVERS } from './data/transceivers';
import { CatalogSearchEngine } from './search/CatalogSearchEngine';

export { TRANSCEIVERS };

// Master built-in catalog list containing all authoritative hardware definitions
export const BUILT_IN_CATALOG: DeviceCatalogItem[] = [
  ...CISCO_DEVICES,
  ...SERVER_DEVICES,
  ...CABINET_MODELS,
  ...ACCESSORIES,
  ...PDU_DEVICES,
  ...PATCH_PANELS
];

// Legacy alias map to guarantee 100% backward compatibility
export const CATALOG_ALIASES: Record<string, string> = {
  'cisco-3850-24s': 'cisco-catalyst-3850-24s',
  'cisco-c9300-48p': 'cisco-catalyst-9300-48p',
  'cisco-9300-48p': 'cisco-catalyst-9300-48p',
  'cisco-catalyst-9300': 'cisco-catalyst-9300-48p',
  'cisco-9300-48u': 'cisco-catalyst-9300-48p',
  'cisco-asr-1001-x': 'cisco-asr-1001x',
  'nexus-93180yc': 'cisco-nexus-93180yc',
  'cisco-9500-24y4c': 'cisco-catalyst-9500-24y4c',
  'cisco-9300x-48hx': 'cisco-catalyst-9300x-48hx',
  'cisco-9300l-24p': 'cisco-catalyst-9300l-24p',
  'cisco-9200l-24p': 'cisco-catalyst-9200l-24p',
  'cisco-9200-48p': 'cisco-catalyst-9200-48p',
  'cisco-1000-24p': 'cisco-catalyst-1000-24p',
  'cisco-1000-48p': 'cisco-catalyst-1000-48p',
  'cisco-2960x-24ps': 'cisco-catalyst-2960x-24ps',
  'cisco-2960xr-24ps': 'cisco-catalyst-2960xr-24ps',
  'cisco-2960x-24ts': 'cisco-catalyst-2960x-24ts',
  'cisco-2960-24pc': 'cisco-catalyst-2960-24pc',
  'cisco-2960-24tc': 'cisco-catalyst-2960-24tc',
  'cisco-2960-48tc': 'cisco-catalyst-2960-48tc',
  'cisco-3560x-24t': 'cisco-catalyst-3560x-24t',
  'cisco-3560-8pc': 'cisco-catalyst-3560-8pc',
  'cisco-2960cx-8pc': 'cisco-catalyst-2960cx-8pc',
  'cisco-2960g-8tc': 'cisco-catalyst-2960g-8tc',
  'patch-panel-24': 'patch-cat6a-24-stp',
  'patch-cat6-24': 'patch-cat6a-24-stp',
  'cable-organizer-1u': 'brush-panel-1u',
  'organizer-1u': 'brush-panel-1u',
  'organizer-2u': 'organizer-2u-5ring',
  'server-dell-r740': 'server-dell-r750',
  'fiber-odf-24': 'fiber-odf-24-om4',
  'fiber-odf-48': 'fiber-odf-48-om4',
  'pdu-8port-1u': 'pdu-1u-basic-8c13'
};

// Singleton master registry map
export const catalogRegistry = new Map<string, DeviceCatalogItem>();

function initBuiltInRegistry(): void {
  // Register canonical items
  for (const item of BUILT_IN_CATALOG) {
    catalogRegistry.set(item.id, item);
  }

  // Register legacy aliases pointing to target items
  for (const [aliasId, canonicalId] of Object.entries(CATALOG_ALIASES)) {
    const canonicalItem = catalogRegistry.get(canonicalId);
    if (canonicalItem && !catalogRegistry.has(aliasId)) {
      catalogRegistry.set(aliasId, {
        ...canonicalItem,
        id: aliasId // Keep alias ID so tests checking dev.catalogId get exact match
      });
    }
  }
}

initBuiltInRegistry();

// Search Engine Singleton
export const catalogSearchEngine = new CatalogSearchEngine(BUILT_IN_CATALOG);

/**
 * Resolves a catalog item by ID or alias.
 */
export function getCatalogItem(id: string): DeviceCatalogItem | undefined {
  if (!id) return undefined;
  if (catalogRegistry.has(id)) {
    return catalogRegistry.get(id);
  }
  const canonicalId = CATALOG_ALIASES[id];
  if (canonicalId && catalogRegistry.has(canonicalId)) {
    return catalogRegistry.get(canonicalId);
  }
  return undefined;
}

/**
 * Returns all active catalog items (built-in and custom).
 */
export function getAllCatalogItems(): DeviceCatalogItem[] {
  return Array.from(catalogRegistry.values());
}

/**
 * Registers a user-defined custom device definition into the active registry.
 */
export function registerCustomDevice(device: DeviceCatalogItem): void {
  const customItem: DeviceCatalogItem = {
    ...device,
    isCustom: true
  };
  catalogRegistry.set(customItem.id, customItem);
  catalogSearchEngine.addCustomItem(customItem);
}

/**
 * Synchronizes runtime custom devices from project state into catalog registry.
 */
export function syncCustomCatalog(customCatalog?: Record<string, DeviceCatalogItem> | DeviceCatalogItem[]): void {
  // Clear any existing custom devices
  for (const [key, item] of catalogRegistry.entries()) {
    if (item.isCustom) {
      catalogRegistry.delete(key);
    }
  }

  // Re-register active custom items
  if (customCatalog) {
    const items = Array.isArray(customCatalog) ? customCatalog : Object.values(customCatalog);
    for (const item of items) {
      const customItem: DeviceCatalogItem = {
        ...item,
        isCustom: true
      };
      catalogRegistry.set(customItem.id, customItem);
      catalogSearchEngine.addCustomItem(customItem);
    }
  }
}

