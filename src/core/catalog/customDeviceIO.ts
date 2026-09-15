import { z } from 'zod';
import { DeviceCatalogItem } from '../types';
import { DeviceCatalogItemSchema, PortDefinitionSchema } from '../persistence/schemas';
import { safeYamlStringify, safeYamlParse } from './yamlUtils';

export interface CustomDeviceIssue {
  path: string;
  message: string;
}

export interface CustomDeviceImportResult {
  success: boolean;
  devices: DeviceCatalogItem[];
  errors?: CustomDeviceIssue[];
}

const PROHIBITED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Recursively asserts that an object contains no prototype pollution keys.
 */
export function assertNoCustomDevicePollution(obj: unknown, path = ''): void {
  if (!obj || typeof obj !== 'object') return;

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      assertNoCustomDevicePollution(obj[i], `${path}[${i}]`);
    }
    return;
  }

  const record = obj as Record<string, unknown>;
  const keys = Object.getOwnPropertyNames(record);
  for (const key of keys) {
    if (PROHIBITED_KEYS.has(key)) {
      throw new Error(`Prototype pollution attempt detected via prohibited key: "${key}" at path: "${path}"`);
    }
    assertNoCustomDevicePollution(record[key], path ? `${path}.${key}` : key);
  }
}


/**
 * Sanitizes metadata text: removes executable scripts / HTML tags while preserving
 * unicode diacritics (Turkish, European) and UTF-8 emojis.
 */
export function sanitizeCustomDeviceText(text: string): string {
  if (!text) return '';
  return text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:[^"']*/gi, '')
    .replace(/<[^>]*>/g, '')
    .trim();
}


/**
 * Strict schema for portable custom devices with bounds enforcement.
 */
export const PortableDeviceSchema = DeviceCatalogItemSchema.extend({
  id: z.string().min(1).regex(/^[a-zA-Z0-9_.-]+$/, 'Device ID must be alphanumeric with underscores, hyphens, or dots'),
  name: z.string().min(1).max(150),
  u: z.number().int().min(1).max(60),
  ports: z.array(PortDefinitionSchema).min(0).max(96),
  rearPorts: z.array(PortDefinitionSchema).min(0).max(96).optional().default([]),
  desc: z.string().max(1000).optional()
});

/**
 * Sanitizes all text fields within a device catalog item.
 */
function sanitizeDevice(item: DeviceCatalogItem): DeviceCatalogItem {
  return {
    ...item,
    manufacturer: sanitizeCustomDeviceText(item.manufacturer || 'Custom'),
    depthMm: item.depthMm ?? 400,
    powerWatts: item.powerWatts ?? 0,
    ports: (item.ports || []).map(p => ({
      ...p,
      name: sanitizeCustomDeviceText(p.name)
    })),
    rearPorts: (item.rearPorts || []).map(p => ({
      ...p,
      name: sanitizeCustomDeviceText(p.name)
    })),
    name: sanitizeCustomDeviceText(item.name),
    desc: item.desc ? sanitizeCustomDeviceText(item.desc) : undefined,
    modelTag: item.modelTag ? sanitizeCustomDeviceText(item.modelTag) : undefined,
    isCustom: true
  };
}



/**
 * Exports a single custom device as formatted JSON.
 */
export function exportCustomDeviceToJson(device: DeviceCatalogItem): string {
  return JSON.stringify(sanitizeDevice(device), null, 2);
}

/**
 * Exports a single custom device as formatted YAML.
 */
export function exportCustomDeviceToYaml(device: DeviceCatalogItem): string {
  return safeYamlStringify(sanitizeDevice(device));
}

/**
 * Exports multiple custom devices as formatted JSON.
 */
export function exportCustomCatalogToJson(customCatalog: Record<string, DeviceCatalogItem>): string {
  const sanitized: Record<string, DeviceCatalogItem> = {};
  for (const [key, item] of Object.entries(customCatalog)) {
    sanitized[key] = sanitizeDevice(item);
  }
  return JSON.stringify({ schemaVersion: 3, customCatalog: sanitized }, null, 2);
}

/**
 * Exports multiple custom devices as formatted YAML.
 */
export function exportCustomCatalogToYaml(customCatalog: Record<string, DeviceCatalogItem>): string {
  const sanitized: Record<string, DeviceCatalogItem> = {};
  for (const [key, item] of Object.entries(customCatalog)) {
    sanitized[key] = sanitizeDevice(item);
  }
  return safeYamlStringify({ schemaVersion: 3, customCatalog: sanitized });
}

/**
 * Parses and validates raw input object/array into an array of DeviceCatalogItem.
 */
function validateRawDeviceData(rawData: unknown): CustomDeviceImportResult {
  try {
    assertNoCustomDevicePollution(rawData);
  } catch (err) {
    return {
      success: false,
      devices: [],
      errors: [{ path: 'root', message: (err as Error).message }]
    };
  }

  if (!rawData || typeof rawData !== 'object') {
    return {
      success: false,
      devices: [],
      errors: [{ path: 'root', message: 'Input data is not a valid object or array.' }]
    };
  }

  // Handle case where root contains { customCatalog: { ... } } or { devices: [ ... ] }
  const record = rawData as Record<string, unknown>;
  let candidates: unknown[] = [];

  if (Array.isArray(rawData)) {
    candidates = rawData;
  } else if (record.customCatalog && typeof record.customCatalog === 'object') {
    candidates = Object.values(record.customCatalog as Record<string, unknown>);
  } else if (record.devices && Array.isArray(record.devices)) {
    candidates = record.devices;
  } else if (record.id && record.name) {
    // Single device object
    candidates = [record];
  } else {
    // Map of key -> device object
    candidates = Object.values(record);
  }

  const validDevices: DeviceCatalogItem[] = [];
  const errors: CustomDeviceIssue[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const parseResult = PortableDeviceSchema.safeParse(candidate);

    if (parseResult.success) {
      const sanitized = sanitizeDevice(parseResult.data as DeviceCatalogItem);
      // Auto-compute heatBtu if powerWatts is present but heatBtu missing
      if (sanitized.powerWatts && !sanitized.heatBtu && !sanitized.heatBtuPerHour) {
        const btu = Math.round(sanitized.powerWatts * 3.412142);
        sanitized.heatBtu = btu;
        sanitized.heatBtuPerHour = btu;
      }
      validDevices.push(sanitized);
    } else {
      for (const issue of parseResult.error.issues) {
        errors.push({
          path: `devices[${i}].${issue.path.join('.')}`,
          message: issue.message
        });
      }
    }
  }

  return {
    success: validDevices.length > 0 && errors.length === 0,
    devices: validDevices,
    errors: errors.length > 0 ? errors : undefined
  };
}

/**
 * Imports custom device(s) from JSON string.
 */
export function importCustomDeviceFromJson(jsonStr: string): CustomDeviceImportResult {
  try {
    if (/"__proto__"\s*:|"constructor"\s*:|"prototype"\s*:/i.test(jsonStr)) {
      return {
        success: false,
        devices: [],
        errors: [{ path: 'json', message: 'Prototype pollution attempt detected in JSON input' }]
      };
    }
    const parsed = JSON.parse(jsonStr);
    return validateRawDeviceData(parsed);

  } catch (err) {
    return {
      success: false,
      devices: [],
      errors: [{ path: 'json', message: `Invalid JSON syntax: ${(err as Error).message}` }]
    };
  }
}

/**
 * Imports custom device(s) from YAML string.
 */
export function importCustomDeviceFromYaml(yamlStr: string): CustomDeviceImportResult {
  try {
    const parsed = safeYamlParse(yamlStr);
    return validateRawDeviceData(parsed);
  } catch (err) {
    return {
      success: false,
      devices: [],
      errors: [{ path: 'yaml', message: `Invalid YAML syntax: ${(err as Error).message}` }]
    };
  }
}

/**
 * Automatically detects whether content is JSON or YAML and imports devices safely.
 */
export function importCustomDeviceAuto(content: string): CustomDeviceImportResult {
  const trimmed = content.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return importCustomDeviceFromJson(trimmed);
  }
  return importCustomDeviceFromYaml(trimmed);
}

/**
 * Imports a single custom device from JSON or YAML string, throwing an Error on validation failure.
 */
export function importCustomDeviceFromString(content: string): DeviceCatalogItem {
  const result = importCustomDeviceAuto(content);
  if (!result.success || !result.devices[0]) {
    const errorMsg = result.errors?.map(e => `${e.path}: ${e.message}`).join(', ') || 'Validation error';
    throw new Error(`Failed to import custom device: ${errorMsg}`);
  }
  return result.devices[0];
}

