import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve('js/2d/network-rules.js'), 'utf8');

describe('active 2D network rules', () => {
  let rules: any;
  const catalog = {
    switch: { category: 'switch', ports: [{ id: 'p1', type: 'rj45' }, { id: 'p2', type: 'rj45' }] },
    fiber: { category: 'fiber', ports: [{ id: 'lc1', type: 'lc' }] },
  };
  const state = { devices: [
    { instanceId: 'sw1', catalogKey: 'switch' },
    { instanceId: 'sw2', catalogKey: 'switch' },
    { instanceId: 'odf', catalogKey: 'fiber' },
  ] };

  beforeEach(() => {
    (window as any).RackStudio = { HARDWARE_CATALOG: catalog, STATE: state };
    window.eval(source);
    rules = (window as any).RackStudio.NetworkRules;
  });

  it('rejects a cable connected to the same port', () => {
    expect(rules.validateConnection(
      { instanceId: 'sw1', portId: 'p1' },
      { instanceId: 'sw1', portId: 'p1' }, state, catalog
    )).toMatchObject({ allowed: false, type: 'same-port' });
  });

  it('rejects an active-device loop in strict mode', () => {
    expect(rules.validateConnection(
      { instanceId: 'sw1', portId: 'p1' },
      { instanceId: 'sw1', portId: 'p2' }, state, catalog
    )).toMatchObject({ allowed: false, type: 'loop' });
  });

  it('rejects copper to optical media mismatch and accepts a copper link', () => {
    expect(rules.validateConnection(
      { instanceId: 'sw1', portId: 'p1' },
      { instanceId: 'odf', portId: 'lc1' }, state, catalog
    )).toMatchObject({ allowed: false, type: 'media-mismatch' });
    expect(rules.validateConnection(
      { instanceId: 'sw1', portId: 'p1' },
      { instanceId: 'sw2', portId: 'p1' }, state, catalog
    ).allowed).toBe(true);
  });
});
