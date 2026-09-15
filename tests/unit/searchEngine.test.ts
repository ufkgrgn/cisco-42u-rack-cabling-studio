import { describe, it, expect, beforeEach } from 'vitest';
import { FastBitSet } from '../../src/core/catalog/search/FastBitSet';
import {
  foldTurkish,
  tokenizeDoc,
  tokenizeQuery,
} from '../../src/core/catalog/search/turkishNormalizer';
import { CatalogSearchEngine } from '../../src/core/catalog/search/CatalogSearchEngine';
import { BUILT_IN_CATALOG } from '../../src/core/catalog';
import { DeviceCatalogItem } from '../../src/core/types';

describe('FastBitSet Unit Operations', () => {
  it('correctly sets, checks, clears bits, and returns correct count', () => {
    const bs = new FastBitSet();
    expect(bs.count()).toBe(0);

    bs.set(5);
    bs.set(31);
    bs.set(32);
    bs.set(100);

    expect(bs.has(5)).toBe(true);
    expect(bs.has(31)).toBe(true);
    expect(bs.has(32)).toBe(true);
    expect(bs.has(100)).toBe(true);
    expect(bs.has(0)).toBe(false);
    expect(bs.has(64)).toBe(false);
    expect(bs.count()).toBe(4);

    bs.clear(31);
    expect(bs.has(31)).toBe(false);
    expect(bs.count()).toBe(3);

    expect(bs.toArray()).toEqual([5, 32, 100]);
  });

  it('performs bitwise AND, OR, and NOT operations correctly', () => {
    const a = new FastBitSet();
    a.set(1);
    a.set(10);
    a.set(50);

    const b = new FastBitSet();
    b.set(10);
    b.set(20);
    b.set(50);

    // AND
    const andResult = a.clone().and(b);
    expect(andResult.toArray()).toEqual([10, 50]);

    // OR
    const orResult = a.clone().or(b);
    expect(orResult.toArray()).toEqual([1, 10, 20, 50]);

    // NOT (relative complement: a AND NOT b)
    const notResult = a.clone().andNot(b);
    expect(notResult.toArray()).toEqual([1]);
  });
});

describe('Turkish Diacritic Folding & Normalization (F3.5 & AC3)', () => {
  it('folds Turkish diacritics to ASCII equivalents', () => {
    expect(foldTurkish('Çanta')).toBe('canta');
    expect(foldTurkish('AĞAÇ')).toBe('agac');
    expect(foldTurkish('Şekil')).toBe('sekil');
    expect(foldTurkish('Öğretmen')).toBe('ogretmen');
    expect(foldTurkish('Üzüm')).toBe('uzum');
  });

  it('handles Turkish dotted İ and dotless ı precisely', () => {
    expect(foldTurkish('İSTANBUL')).toBe('istanbul');
    expect(foldTurkish('ışık')).toBe('isik');
    expect(foldTurkish('Ilık')).toBe('ilik');
    expect(foldTurkish('İSR-4431')).toBe('isr-4431');
  });

  it('tokenizes compound strings into primary and compact tokens', () => {
    const docTokens = tokenizeDoc('Cisco Catalyst C9300-48P 10GbE Switch');
    expect(docTokens).toContain('cisco');
    expect(docTokens).toContain('catalyst');
    expect(docTokens).toContain('c9300');
    expect(docTokens).toContain('48p');
    expect(docTokens).toContain('c930048p');
    expect(docTokens).toContain('10gbe');
    expect(docTokens).toContain('switch');
  });

  it('tokenizes search queries with Turkish folding', () => {
    const queryTokens = tokenizeQuery('Çift Güç Kaynağı');
    expect(queryTokens).toContain('cift');
    expect(queryTokens).toContain('guc');
    expect(queryTokens).toContain('kaynagi');
  });
});

describe('CatalogSearchEngine Inverted Index & Facets', () => {
  let engine: CatalogSearchEngine;

  beforeEach(() => {
    engine = new CatalogSearchEngine(BUILT_IN_CATALOG);
  });

  it('finds items by exact name, model, and SKU token', () => {
    const results = engine.search('C9300');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((item) => item.id.includes('9300') || item.modelTag?.includes('C9300'))).toBe(true);
  });

  it('performs prefix matching on partial tokens', () => {
    const results = engine.search('cata');
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((item) => item.name.toLowerCase().includes('cat') || item.id.includes('cat'))).toBe(true);
  });

  it('finds items using Turkish queries with diacritics', () => {
    // Search with Turkish diacritic "dağıtım" should match "dagitim" in description/name
    const results = engine.search('omurga');
    expect(results.length).toBeGreaterThanOrEqual(1);

    // Search with "şasi" or "sasi"
    const resultsSasi = engine.search('şasi');
    const resultsSasiAscii = engine.search('sasi');
    expect(resultsSasi.length).toBe(resultsSasiAscii.length);
  });

  it('filters results by category', () => {
    const switches = engine.search('', { category: 'switch' });
    expect(switches.length).toBeGreaterThan(0);
    expect(switches.every((item) => item.category === 'switch')).toBe(true);

    const servers = engine.search('', { category: 'server' });
    expect(servers.length).toBeGreaterThan(0);
    expect(servers.every((item) => item.category === 'server')).toBe(true);
  });

  it('filters results by manufacturer', () => {
    const ciscoDevices = engine.search('', { manufacturer: 'Cisco' });
    expect(ciscoDevices.length).toBeGreaterThan(0);
    expect(ciscoDevices.every((item) => item.manufacturer === 'Cisco')).toBe(true);

    const dellDevices = engine.search('', { manufacturer: 'Dell' });
    expect(dellDevices.length).toBeGreaterThan(0);
    expect(dellDevices.every((item) => item.manufacturer === 'Dell')).toBe(true);
  });

  it('filters results by rack unit height (u)', () => {
    const oneU = engine.search('', { uHeight: 1 });
    expect(oneU.length).toBeGreaterThan(0);
    expect(oneU.every((item) => item.u === 1)).toBe(true);

    const twoU = engine.search('', { uHeight: 2 });
    expect(twoU.length).toBeGreaterThan(0);
    expect(twoU.every((item) => item.u === 2)).toBe(true);
  });

  it('filters results by portType', () => {
    const rj45Only = engine.search('', { portType: 'rj45' });
    expect(rj45Only.length).toBeGreaterThan(0);
    expect(rj45Only.every((item) => [...item.ports, ...(item.rearPorts || [])].some((p) => p.type === 'rj45'))).toBe(true);
  });

  it('filters results by PoE capability', () => {
    const poeOnly = engine.search('', { poeOnly: true });
    expect(poeOnly.length).toBeGreaterThan(0);
    expect(poeOnly.every((item) => item.ports.some((p) => p.poe === true))).toBe(true);
  });

  it('filters results by favorites set', () => {
    const favSet = new Set<string>(['cisco-catalyst-9300-48p', 'server-dell-r650']);
    const favsOnly = engine.search('', { favoritesOnly: true }, favSet);
    expect(favsOnly.length).toBe(2);
    expect(favsOnly.map((d) => d.id).sort()).toEqual(['cisco-catalyst-9300-48p', 'server-dell-r650'].sort());
  });


  it('handles regex special metacharacters without crashing or throwing', () => {
    expect(() => engine.search('.*')).not.toThrow();
    expect(() => engine.search('[a-z]+')).not.toThrow();
    expect(() => engine.search('(test|dev)')).not.toThrow();
    expect(() => engine.search('?+*^$#@!~`{}[]()|\\/')).not.toThrow();
  });

  it('handles whitespace-only queries gracefully by returning all items matching facets', () => {
    const all = engine.search('');
    const whitespace = engine.search('    \t  \n  ');
    expect(whitespace.length).toBe(all.length);
  });

  it('dynamically registers and unregisters custom devices into search index', () => {
    const customItem: DeviceCatalogItem = {
      id: 'custom-switch-99',
      name: 'SuperCustom 99X Fiber Switch',
      manufacturer: 'Acme',
      category: 'switch',
      u: 1,
      depthMm: 350,
      weightKg: 4,
      powerWatts: 80,
      heatBtuPerHour: 273,
      ports: [
        {
          id: 'p1',
          name: '100G-1',
          type: 'qsfp28',
          facing: 'front',
          xPct: 0.5,
          yPct: 0.5,
        },
      ],
    };

    engine.addCustomDevice(customItem);

    const found = engine.search('SuperCustom');
    expect(found.length).toBe(1);
    expect(found[0]?.id).toBe('custom-switch-99');

    // Remove
    engine.removeCustomDevice('custom-switch-99');
    const notFound = engine.search('SuperCustom');
    expect(notFound.length).toBe(0);
  });
});
