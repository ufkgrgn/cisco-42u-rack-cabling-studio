import { ProjectV3, ProjectSchemaV3 } from './schemas';
import { migrateToV3 } from './migration';

export interface ImportIssue {
  path: string;
  message: string;
  code: string;
}

export interface ImportResult {
  success: boolean;
  project?: ProjectV3;
  errors?: ImportIssue[];
}

/**
 * Deterministic SHA-256 hash using Web Crypto API with FNV-1a fallback.
 */
export async function calculateChecksum(content: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(content);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Fall through to fallback
    }
  }
  // Deterministic FNV-1a 64-bit hex hash fallback
  let h1 = 0x811c9dc5;
  for (let i = 0; i < content.length; i++) {
    h1 ^= content.charCodeAt(i);
    h1 += (h1 << 1) + (h1 << 4) + (h1 << 7) + (h1 << 8) + (h1 << 24);
  }
  return (h1 >>> 0).toString(16).padStart(8, '0');
}

/**
 * Prototype Pollution Guard: Inspects nested keys.
 */
export function assertNoPrototypePollution(obj: any): void {
  if (!obj || typeof obj !== 'object') return;
  const forbidden = ['__proto__', 'constructor', 'prototype'];
  for (const key of Object.keys(obj)) {
    if (forbidden.includes(key)) {
      throw new Error(`Güvenlik Uyarısı: Proje dosyasında yasaklı prototip anahtarı tespit edildi: '${key}'`);
    }
    assertNoPrototypePollution(obj[key]);
  }
}

/**
 * Exports a project to a signed, formatted JSON string.
 */
export async function exportProjectToJson(project: ProjectV3): Promise<string> {
  // Validate schema before export
  const validated = ProjectSchemaV3.parse(project);

  // Exclude existing checksum to compute canonical payload hash
  const { checksum: _, ...payloadWithoutChecksum } = validated;
  payloadWithoutChecksum.metadata.updatedAt = new Date().toISOString();

  const canonicalJson = JSON.stringify(payloadWithoutChecksum, null, 2);
  const checksum = await calculateChecksum(canonicalJson);

  const finalExport: ProjectV3 = {
    ...payloadWithoutChecksum,
    checksum
  };

  return JSON.stringify(finalExport, null, 2);
}

/**
 * Imports and validates a project JSON string with atomic safety.
 */
export async function importProjectFromJson(jsonString: string): Promise<ImportResult> {
  // 1. File Size Guard (50MB)
  if (jsonString.length > 50 * 1024 * 1024) {
    return {
      success: false,
      errors: [{ path: 'root', message: 'Dosya boyutu çok büyük (>50MB).', code: 'FILE_TOO_LARGE' }]
    };
  }

  // 2. Safe JSON Parsing with Prototype Pollution Guard
  let parsed: any;
  try {
    parsed = JSON.parse(jsonString, (key, value) => {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        throw new Error(`Güvenlik Uyarısı: Proje dosyasında yasaklı prototip anahtarı tespit edildi: '${key}'`);
      }
      return value;
    });
  } catch (err: any) {
    if (err.message.includes('Güvenlik Uyarısı')) {
      return {
        success: false,
        errors: [{ path: 'root', message: err.message, code: 'SECURITY_VIOLATION' }]
      };
    }
    return {
      success: false,
      errors: [{ path: 'root', message: `Bozuk JSON biçimi: ${err.message}`, code: 'JSON_SYNTAX_ERROR' }]
    };
  }

  // 4. Migration & Schema Parsing
  let migratedProject: ProjectV3;
  try {
    migratedProject = migrateToV3(parsed);
  } catch (err: any) {
    return {
      success: false,
      errors: [{ path: 'migration', message: `Veri dönüştürme hatası: ${err.message}`, code: 'MIGRATION_FAILED' }]
    };
  }

  // 5. Strict Zod Validation & Error Diagnostics
  const zodResult = ProjectSchemaV3.safeParse(migratedProject);
  if (!zodResult.success) {
    const formattedErrors: ImportIssue[] = zodResult.error.issues.map(issue => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code
    }));
    return {
      success: false,
      errors: formattedErrors
    };
  }

  return {
    success: true,
    project: zodResult.data
  };
}
