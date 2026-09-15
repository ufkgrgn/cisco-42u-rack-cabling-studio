import { describe, it, expect } from 'vitest';
import {
  exportCustomDeviceToJson,
  exportCustomDeviceToYaml,
  importCustomDeviceFromString,
} from '../../src/core/catalog/customDeviceIO';
import { safeParseYaml } from '../../src/core/catalog/yamlUtils';
import { DeviceCatalogItem } from '../../src/core/types';

describe('Portable Custom Device Import/Export & Security (F3.4)', () => {
  const sampleDevice: DeviceCatalogItem = {
    id: 'custom-router-x10',
    name: 'Enterprise Edge Router X10',
    manufacturer: 'Acme Networks',
    category: 'switch',
    u: 2,
    depthMm: 450,
    weightKg: 7.2,
    powerWatts: 120,
    heatBtuPerHour: 409,
    dualPsu: true,
    ports: [
      {
        id: 'p1',
        name: 'WAN1',
        type: 'sfp+',
        facing: 'front',
        xPct: 0.2,
        yPct: 0.5,
      },
      {
        id: 'p2',
        name: 'LAN1',
        type: 'rj45',
        facing: 'front',
        poe: true,
        xPct: 0.4,
        yPct: 0.5,
      },
    ],
  };

  it('exports and imports device losslessly via JSON', () => {
    const jsonStr = exportCustomDeviceToJson(sampleDevice);
    expect(jsonStr).toContain('custom-router-x10');
    expect(jsonStr).toContain('Acme Networks');

    const imported = importCustomDeviceFromString(jsonStr);
    expect(imported).toBeDefined();
    expect(imported.id).toBe('custom-router-x10');
    expect(imported.name).toBe('Enterprise Edge Router X10');
    expect(imported.u).toBe(2);
    expect(imported.ports.length).toBe(2);
    expect(imported.ports[0]?.type).toBe('sfp+');
    expect(imported.ports[1]?.poe).toBe(true);
  });

  it('exports and imports device losslessly via YAML', () => {
    const yamlStr = exportCustomDeviceToYaml(sampleDevice);
    expect(yamlStr).toContain('id: custom-router-x10');
    expect(yamlStr).toContain('manufacturer: Acme Networks');

    const imported = importCustomDeviceFromString(yamlStr);
    expect(imported).toBeDefined();
    expect(imported.id).toBe('custom-router-x10');
    expect(imported.name).toBe('Enterprise Edge Router X10');
    expect(imported.u).toBe(2);
    expect(imported.ports.length).toBe(2);
  });

  it('rejects prototype pollution attempts in YAML parser by throwing error', () => {
    const maliciousYaml = `
__proto__:
  polluted: true
id: safe-device
name: Test
category: switch
u: 1
depthMm: 400
ports: []
`;
    expect(() => safeParseYaml(maliciousYaml)).toThrow();
  });

  it('rejects prototype pollution attempts in JSON parser by throwing error', () => {
    const maliciousJson = '{"__proto__": {"polluted": true}, "id": "hacked-device", "name": "Hacked", "category": "switch", "u": 1, "depthMm": 400, "ports": []}';
    expect(() => importCustomDeviceFromString(maliciousJson)).toThrow();
  });


  it('sanitizes XSS vectors while preserving Turkish diacritics and emojis', () => {
    const attackPayload = JSON.stringify({
      id: 'xss-device-1',
      name: '<script>alert("pwned")</script>Özel Ağ Dağıtım Cihazı 🚀',
      manufacturer: '<img src=x onerror=alert(1)>Cisco & Dell ⚡',
      category: 'switch',
      u: 1,
      depthMm: 400,
      ports: [
        {
          id: 'p1',
          name: '<b onmouseover=evil()>Port 1</b>',
          type: 'rj45',
          facing: 'front',
          xPct: 0.1,
          yPct: 0.5,
        },
      ],
    });

    const imported = importCustomDeviceFromString(attackPayload);
    // XSS scripts stripped
    expect(imported.name).not.toContain('<script>');
    expect(imported.name).not.toContain('alert');
    expect(imported.manufacturer).not.toContain('<img');

    // Turkish diacritics and emojis preserved
    expect(imported.name).toContain('Özel Ağ Dağıtım Cihazı');
    expect(imported.name).toContain('🚀');
    expect(imported.manufacturer).toContain('Cisco & Dell');
    expect(imported.manufacturer).toContain('⚡');
  });

  it('rejects out-of-bounds rack height (U < 1 or U > 60)', () => {
    const invalidZeroU = JSON.stringify({
      id: 'inv-1',
      name: 'Invalid 0U',
      category: 'switch',
      u: 0,
      depthMm: 400,
      ports: [],
    });

    expect(() => importCustomDeviceFromString(invalidZeroU)).toThrow();

    const invalidHugeU = JSON.stringify({
      id: 'inv-2',
      name: 'Invalid 61U',
      category: 'switch',
      u: 61,
      depthMm: 400,
      ports: [],
    });

    expect(() => importCustomDeviceFromString(invalidHugeU)).toThrow();
  });

  it('rejects more than 96 ports', () => {
    const ports = [];
    for (let i = 0; i < 97; i++) {
      ports.push({
        id: `p${i}`,
        name: `p${i}`,
        type: 'rj45',
        xPct: 0.5,
        yPct: 0.5,
      });
    }

    const invalidPorts = JSON.stringify({
      id: 'inv-ports',
      name: 'Invalid 97 ports',
      category: 'switch',
      u: 4,
      depthMm: 400,
      ports,
    });

    expect(() => importCustomDeviceFromString(invalidPorts)).toThrow();
  });

  it('rejects malformed syntax string input', () => {
    expect(() => importCustomDeviceFromString(':::INVALID YAML / JSON {{{')).toThrow();
  });
});
