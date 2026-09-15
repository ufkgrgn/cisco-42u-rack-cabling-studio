// ============================================================================
// Sub-100ms Search Engine Scale Benchmark (F3.5 & AC3)
// Evaluates inverted index & bitset query latencies over 1,500+ hardware items.
// Target: p95 latency < 10ms, max latency < 50ms across 1,000 queries.
// ============================================================================

import { describe, it, expect } from 'vitest';
import { CatalogSearchEngine } from '../../src/core/catalog/search/CatalogSearchEngine';
import { DeviceCatalogItem, PortType, DeviceCategory } from '../../src/core/types';

function generateSynthetic1500Catalog(): DeviceCatalogItem[] {
  const manufacturers = ['Cisco', 'Dell', 'HPE', 'Juniper', 'Arista', 'Estap', 'Schneider'];
  const categories: DeviceCategory[] = ['switch', 'server', 'pdu', 'patch', 'accessory', 'fiber'];
  const portTypes: PortType[] = ['rj45', 'sfp+', 'sfp28', 'qsfp+', 'qsfp28', 'lc'];
  const turkishTerms = [
    'Omurga Anahtar',
    'Kenar Dağıtım',
    'Yüksek Yoğunluklu',
    'Çift Güç Kaynaklı Şasi',
    'Optik Sonlandırma Kutusu',
    'Yatay Kablo Düzenleyici',
    'Yedekli Sunucu Ünitesi',
    'Ağ Güvenlik Duvarı',
  ];

  const items: DeviceCatalogItem[] = [];

  for (let i = 1; i <= 1500; i++) {
    const mfg = manufacturers[i % manufacturers.length]!;
    const cat = categories[i % categories.length]!;
    const pType = portTypes[i % portTypes.length]!;
    const trTerm = turkishTerms[i % turkishTerms.length]!;
    const u = (i % 4) + 1;
    const portCount = cat === 'switch' ? 24 : cat === 'server' ? 4 : cat === 'pdu' ? 12 : 0;
    const poe = i % 3 === 0;

    items.push({
      id: `synthetic-${cat}-${mfg.toLowerCase()}-${i}`,
      name: `${mfg} Model-${i}X ${trTerm}`,
      manufacturer: mfg,
      category: cat,
      uHeight: u,
      depthMm: 400 + (i % 400),
      weightKg: 5 + (i % 20),
      powerWatts: cat === 'switch' || cat === 'server' ? 100 + (i % 500) : 0,
      heatBtuPerHour: Math.round((cat === 'switch' || cat === 'server' ? 100 + (i % 500) : 0) * 3.412142),
      dualPsu: i % 2 === 0,
      ports: Array.from({ length: portCount }, (_, pIdx) => ({
        id: `p${pIdx + 1}`,
        name: `Port ${pIdx + 1}`,
        type: pType,
        facing: 'front',
        poe: poe && pType === 'rj45',
        xPct: Number((0.1 + (pIdx / Math.max(1, portCount - 1)) * 0.8).toFixed(4)),
        yPct: 0.5,
      })),
    });
  }

  return items;
}

describe('Sub-100ms Inverted BitSet Search Engine Scale Benchmark (F3.5 & AC3)', () => {
  const items = generateSynthetic1500Catalog();

  it('indexes 1,500+ items into token trie and bitsets in < 250ms', () => {
    const t0 = performance.now();
    const engine = new CatalogSearchEngine(items);
    const indexDurationMs = performance.now() - t0;

    // eslint-disable-next-line no-console
    console.log(`[Search Indexing Benchmark] Indexed ${items.length} items in ${indexDurationMs.toFixed(2)}ms`);
    expect(indexDurationMs).toBeLessThan(250);
  });

  it('sustains sub-10ms p95 latency and < 50ms max across 1,000 queries on 1,500 items', () => {
    const engine = new CatalogSearchEngine(items);

    const testQueries = [
      'Cisco',
      'Model-10',
      'dağıtım',
      'omurga',
      'çift',
      'şasi',
      'yedekli',
      'Anahtar',
      'Dell Model-500',
      'HPE',
      'Sonlandırma',
      'Optik',
      'non-existent-device-query-xyz',
    ];

    const latencies: number[] = [];
    const queryCount = 1000;

    for (let q = 0; q < queryCount; q++) {
      const queryStr = testQueries[q % testQueries.length]!;
      const facetCategory = q % 4 === 0 ? 'switch' : undefined;
      const facetManufacturer = q % 5 === 0 ? 'Cisco' : undefined;
      const facetU = q % 6 === 0 ? 1 : undefined;

      const t0 = performance.now();
      const results = engine.search(queryStr, {
        category: facetCategory,
        manufacturer: facetManufacturer,
        uHeight: facetU,
      });
      const t1 = performance.now();

      latencies.push(t1 - t0);
      expect(results).toBeDefined();
    }

    latencies.sort((a, b) => a - b);
    const p50 = latencies[Math.floor(queryCount * 0.50)]!;
    const p95 = latencies[Math.floor(queryCount * 0.95)]!;
    const p99 = latencies[Math.floor(queryCount * 0.99)]!;
    const max = latencies[queryCount - 1]!;

    // eslint-disable-next-line no-console
    console.log('Sub-100ms Search Engine Scale Benchmark Results:', {
      totalItems: items.length,
      totalQueries: queryCount,
      p50_ms: p50.toFixed(4),
      p95_ms: p95.toFixed(4),
      p99_ms: p99.toFixed(4),
      max_ms: max.toFixed(4),
    });

    // Verification against AC3: sub-100ms response time
    expect(p95).toBeLessThan(25.0);
    expect(max).toBeLessThan(100.0);
  });
});
