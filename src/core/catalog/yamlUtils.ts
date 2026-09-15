/**
 * Safe, zero-dependency YAML serialization and parsing utility
 * Tailored for Digital Rack Cabin Studio custom hardware specifications.
 * Enforces strict prototype pollution guards (__proto__, constructor, prototype).
 */

const POLLUTED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export function assertNoYamlPollution(key: string): void {
  if (POLLUTED_KEYS.has(key)) {
    throw new Error(`Prototype pollution attempt detected via prohibited YAML key: "${key}"`);
  }
}

/**
 * Escapes YAML scalar string value if needed.
 */
function formatYamlScalar(val: unknown): string {
  if (val === null || val === undefined) return 'null';
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'number') return String(val);

  const str = String(val);
  if (str === '') return '""';

  // If string contains newlines, colons, hashes, brackets or quotes, quote it safely
  if (/[\n:#\[\]{},'"&*!|>]/.test(str) || str.trim() !== str || str === 'true' || str === 'false' || str === 'null') {
    return JSON.stringify(str);
  }

  return str;
}

/**
 * Recursively stringifies an object or array into formatted YAML.
 */
export function safeYamlStringify(data: unknown, indent = 0): string {
  const pad = '  '.repeat(indent);

  if (data === null || data === undefined) {
    return `${pad}null`;
  }

  if (typeof data !== 'object') {
    return `${pad}${formatYamlScalar(data)}`;
  }

  if (Array.isArray(data)) {
    if (data.length === 0) return `${pad}[]`;
    const lines: string[] = [];
    for (const item of data) {
      if (typeof item === 'object' && item !== null) {
        const itemStr = safeYamlStringify(item, indent + 1).trimStart();
        lines.push(`${pad}- ${itemStr}`);
      } else {
        lines.push(`${pad}- ${formatYamlScalar(item)}`);
      }
    }
    return lines.join('\n');
  }

  const obj = data as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length === 0) return `${pad}{}`;

  const lines: string[] = [];
  for (const key of keys) {
    assertNoYamlPollution(key);
    const val = obj[key];

    if (val === undefined) continue;

    if (typeof val === 'object' && val !== null) {
      if (Array.isArray(val)) {
        if (val.length === 0) {
          lines.push(`${pad}${key}: []`);
        } else {
          lines.push(`${pad}${key}:\n${safeYamlStringify(val, indent + 1)}`);
        }
      } else {
        const subKeys = Object.keys(val as object);
        if (subKeys.length === 0) {
          lines.push(`${pad}${key}: {}`);
        } else {
          lines.push(`${pad}${key}:\n${safeYamlStringify(val, indent + 1)}`);
        }
      }
    } else {
      lines.push(`${pad}${key}: ${formatYamlScalar(val)}`);
    }
  }

  return lines.join('\n');
}

interface ParsedLine {
  indent: number;
  lineNum: number;
  raw: string;
  isListItem: boolean;
  content: string;
}

/**
 * Parses scalar string token into boolean, number, or string.
 */
function parseScalar(token: string): unknown {
  const trimmed = token.trim();
  if (trimmed === 'null' || trimmed === '~' || trimmed === '') return null;
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;

  // Quoted string check
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    try {
      if (trimmed.startsWith('"')) {
        return JSON.parse(trimmed);
      }
      return trimmed.slice(1, -1).replace(/''/g, "'");
    } catch {
      return trimmed.slice(1, -1);
    }
  }

  // Number check
  if (/^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/.test(trimmed)) {
    const num = Number(trimmed);
    if (!isNaN(num)) return num;
  }

  return trimmed;
}

/**
 * Safe, zero-dependency YAML parser.
 * Supports basic key-value mappings, list items (-), and nested hierarchies.
 */
export function safeYamlParse(yamlStr: string): unknown {
  if (!yamlStr || typeof yamlStr !== 'string') return null;

  const rawLines = yamlStr.split(/\r?\n/);
  const parsedLines: ParsedLine[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i] ?? '';
    // Strip comments
    let stripped = raw;
    const commentIdx = stripped.indexOf('#');
    if (commentIdx >= 0) {
      // Check if comment is inside quotes
      const beforeComment = stripped.slice(0, commentIdx);
      const quoteCount = (beforeComment.match(/["']/g) || []).length;
      if (quoteCount % 2 === 0) {
        stripped = beforeComment;
      }
    }

    if (stripped.trim().length === 0) continue;

    const indentMatch = stripped.match(/^[ \t]*/);
    const indent = indentMatch ? indentMatch[0].length : 0;
    const trimmed = stripped.trim();
    const isListItem = trimmed.startsWith('- ');
    const content = isListItem ? trimmed.slice(2).trim() : trimmed;

    parsedLines.push({
      indent,
      lineNum: i + 1,
      raw,
      isListItem,
      content
    });
  }

  if (parsedLines.length === 0) return null;

  let lineIdx = 0;

  function parseBlock(currentIndent: number): unknown {
    if (lineIdx >= parsedLines.length) return null;

    const first = parsedLines[lineIdx];
    if (!first || first.indent < currentIndent) return null;

    if (first.isListItem) {
      const arr: unknown[] = [];
      while (lineIdx < parsedLines.length) {
        const line = parsedLines[lineIdx];
        if (!line || line.indent < currentIndent) break;
        if (!line.isListItem && line.indent === currentIndent) break;

        lineIdx++;

        if (line.content === '') {
          // Empty item or sub-block
          const sub = parseBlock(line.indent + 2);
          arr.push(sub);
        } else if (line.content.includes(':')) {
          // List item with inline key-value
          const colonIdx = line.content.indexOf(':');
          const k = line.content.slice(0, colonIdx).trim();
          assertNoYamlPollution(k);
          const vPart = line.content.slice(colonIdx + 1).trim();

          const itemObj: Record<string, unknown> = {};
          if (vPart === '') {
            itemObj[k] = parseBlock(line.indent + 2);
          } else {
            itemObj[k] = parseScalar(vPart);
          }

          // Parse any additional lines at deeper indentation belonging to this object
          while (lineIdx < parsedLines.length) {
            const nextL = parsedLines[lineIdx];
            if (!nextL || nextL.indent <= line.indent || nextL.isListItem) break;
            lineIdx++;
            if (nextL.content.includes(':')) {
              const subColon = nextL.content.indexOf(':');
              const subK = nextL.content.slice(0, subColon).trim();
              assertNoYamlPollution(subK);
              const subV = nextL.content.slice(subColon + 1).trim();
              if (subV === '') {
                itemObj[subK] = parseBlock(nextL.indent + 2);
              } else {
                itemObj[subK] = parseScalar(subV);
              }
            }
          }

          arr.push(itemObj);
        } else {
          arr.push(parseScalar(line.content));
        }
      }
      return arr;
    } else {
      const obj: Record<string, unknown> = {};
      while (lineIdx < parsedLines.length) {
        const line = parsedLines[lineIdx];
        if (!line || line.indent < currentIndent) break;
        if (line.isListItem) break;

        lineIdx++;

        const colonIdx = line.content.indexOf(':');
        if (colonIdx === -1) {
          // Line without colon in object context
          continue;
        }

        const key = line.content.slice(0, colonIdx).trim();
        assertNoYamlPollution(key);
        const valuePart = line.content.slice(colonIdx + 1).trim();

        if (valuePart === '') {
          // Block value on following lines
          obj[key] = parseBlock(line.indent + 2);
        } else if (valuePart === '[]') {
          obj[key] = [];
        } else if (valuePart === '{}') {
          obj[key] = {};
        } else {
          obj[key] = parseScalar(valuePart);
        }
      }
      return obj;
    }
  }

  return parseBlock(0);
}

export const safeParseYaml = safeYamlParse;
export const safeStringifyYaml = safeYamlStringify;

