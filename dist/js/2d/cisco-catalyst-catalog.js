/**
 * Cisco Enterprise Rack & Cabling Studio - Cisco Catalyst Hardware Catalog
 * Comprehensive database of Catalyst 9000, 1000, and 2960-X/XR/S enterprise models.
 */
(function () {
  'use strict';

  const RS = window.RackStudio = window.RackStudio || {};

  function buildPorts(spec) {
    const ports = [];
    const {
      accessCount,
      accessPrefix = 'Gi1/0/',
      accessType = 'rj45',
      accessSpeed = '10/100/1000 Gigabit',
      accessRowOffset = 0,
      uplinks = []
    } = spec;

    for (let i = 0; i < accessCount; i++) {
      const portNum = i + 1;
      const group = Math.floor(i / 12) + accessRowOffset;
      const row = (i % 2 === 0) ? 0 : 1;
      ports.push({
        id: `p${portNum}`,
        name: `${accessPrefix}${portNum}`,
        type: accessType,
        group,
        row,
        speed: accessSpeed
      });
    }

    let currentUplinkGroup = Math.ceil(accessCount / 12) + accessRowOffset;
    uplinks.forEach((up, idx) => {
      const upCount = up.count || 1;
      for (let j = 0; j < upCount; j++) {
        const uNum = (up.startIndex || 1) + j;
        const portId = up.idPrefix ? `${up.idPrefix}${uNum}` : `up_${idx + 1}_${j + 1}`;
        const name = up.namePattern ? up.namePattern.replace('{n}', uNum) : `Uplink-${uNum}`;
        const row = (j % 2 === 0) ? 0 : 1;
        ports.push({
          id: portId,
          name,
          type: up.type || 'sfp',
          group: currentUplinkGroup,
          row,
          speed: up.speed || '10G SFP+'
        });
      }
      currentUplinkGroup++;
    });

    return ports;
  }
  RS.buildCatalogPorts = buildPorts;

  const CATALYST_MODELS = [
    // =========================================================================
    // 1. CATALYST 9000 SERIES (CURRENT ENTERPRISE ACCESS / DISTRIBUTION / CORE)
    // =========================================================================
    {
      id: 'cisco-m-c9200l-24p-4g',
      name: 'Cisco Catalyst 9200L-24P-4G',
      modelTag: 'C9200L-24P-4G',
      series: 'cat9k',
      generation: 'current',
      category: 'switch',
      u: 1,
      poeBudget: '370W PoE+',
      uplinkSummary: '4x 1G SFP Sabit',
      desc: '24x 10/100/1000 Gigabit PoE+ (370W), 4x 1G SFP sabit uplink, sanallaştırılmış kurumsal kenar.',
      ports: buildPorts({
        accessCount: 24,
        accessPrefix: 'Gi1/0/',
        accessSpeed: '10/100/1000 Gigabit PoE+ (30W)',
        uplinks: [{ count: 4, startIndex: 1, namePattern: 'Gi1/1/{n}', idPrefix: 'up', type: 'sfp', speed: '1G SFP Fiber' }]
      })
    },
    {
      id: 'cisco-m-c9200l-24p-4x',
      name: 'Cisco Catalyst 9200L-24P-4X',
      modelTag: 'C9200L-24P-4X',
      series: 'cat9k',
      generation: 'current',
      category: 'switch',
      u: 1,
      poeBudget: '370W PoE+',
      uplinkSummary: '4x 10G SFP+ Sabit',
      desc: '24x 10/100/1000 Gigabit PoE+ (370W), 4x 10G SFP+ sabit yüksek hızlı omurga uplink.',
      ports: buildPorts({
        accessCount: 24,
        accessPrefix: 'Gi1/0/',
        accessSpeed: '10/100/1000 Gigabit PoE+ (30W)',
        uplinks: [{ count: 4, startIndex: 1, namePattern: 'Te1/1/{n}', idPrefix: 'up', type: 'sfp', speed: '10G SFP+ 10Gbps' }]
      })
    },
    {
      id: 'cisco-m-c9200l-48p-4g',
      name: 'Cisco Catalyst 9200L-48P-4G',
      modelTag: 'C9200L-48P-4G',
      series: 'cat9k',
      generation: 'current',
      category: 'switch',
      u: 1,
      poeBudget: '740W PoE+',
      uplinkSummary: '4x 1G SFP Sabit',
      desc: '48x 10/100/1000 Gigabit PoE+ (740W yüksek bütçe), 4x 1G SFP sabit uplink portu.',
      ports: buildPorts({
        accessCount: 48,
        accessPrefix: 'Gi1/0/',
        accessSpeed: '10/100/1000 Gigabit PoE+ (30W)',
        uplinks: [{ count: 4, startIndex: 1, namePattern: 'Gi1/1/{n}', idPrefix: 'up', type: 'sfp', speed: '1G SFP Fiber' }]
      })
    },
    {
      id: 'cisco-m-c9200l-48p-4x',
      name: 'Cisco Catalyst 9200L-48P-4X',
      modelTag: 'C9200L-48P-4X',
      series: 'cat9k',
      generation: 'current',
      category: 'switch',
      u: 1,
      poeBudget: '740W PoE+',
      uplinkSummary: '4x 10G SFP+ Sabit',
      desc: '48x 10/100/1000 Gigabit PoE+ (740W tam bütçe), 4x 10G SFP+ sabit yüksek hızlı uplink.',
      ports: buildPorts({
        accessCount: 48,
        accessPrefix: 'Gi1/0/',
        accessSpeed: '10/100/1000 Gigabit PoE+ (30W)',
        uplinks: [{ count: 4, startIndex: 1, namePattern: 'Te1/1/{n}', idPrefix: 'up', type: 'sfp', speed: '10G SFP+ 10Gbps' }]
      })
    },
    {
      id: 'cisco-m-c9200-24p',
      name: 'Cisco Catalyst 9200-24P',
      modelTag: 'C9200-24P',
      series: 'cat9k',
      generation: 'current',
      category: 'switch',
      u: 1,
      poeBudget: '370W / 740W PoE+',
      uplinkSummary: '4x 10G SFP+ Modüler',
      desc: '24x 10/100/1000 Gigabit PoE+, modüler ağ modülü (4x 10G SFP+), çift yedekli güç kaynağı & StackWise-160.',
      ports: buildPorts({
        accessCount: 24,
        accessPrefix: 'Gi1/0/',
        accessSpeed: '10/100/1000 Gigabit PoE+ (30W)',
        uplinks: [{ count: 4, startIndex: 1, namePattern: 'Te1/1/{n}', idPrefix: 'up', type: 'sfp', speed: '10G SFP+ Modüler' }]
      })
    },
    {
      id: 'cisco-m-c9200-48p',
      name: 'Cisco Catalyst 9200-48P',
      modelTag: 'C9200-48P',
      series: 'cat9k',
      generation: 'current',
      category: 'switch',
      u: 1,
      poeBudget: '740W / 1440W PoE+',
      uplinkSummary: '4x 10G SFP+ Modüler',
      desc: '48x 10/100/1000 Gigabit PoE+, modüler ağ modülü (4x 10G SFP+), StackWise-160 destekli omurga bağlantısı.',
      ports: buildPorts({
        accessCount: 48,
        accessPrefix: 'Gi1/0/',
        accessSpeed: '10/100/1000 Gigabit PoE+ (30W)',
        uplinks: [{ count: 4, startIndex: 1, namePattern: 'Te1/1/{n}', idPrefix: 'up', type: 'sfp', speed: '10G SFP+ Modüler' }]
      })
    },
    {
      id: 'cisco-m-c9200-24t',
      name: 'Cisco Catalyst 9200-24T',
      modelTag: 'C9200-24T',
      series: 'cat9k',
      generation: 'current',
      category: 'switch',
      u: 1,
      poeBudget: 'PoE Yok (Data Only)',
      uplinkSummary: '4x 10G SFP+ Modüler',
      desc: '24x 10/100/1000 Gigabit Data RJ45 portu, modüler 4x 10G SFP+ uplink, çift güç kaynağı desteği.',
      ports: buildPorts({
        accessCount: 24,
        accessPrefix: 'Gi1/0/',
        accessSpeed: '10/100/1000 Gigabit Data',
        uplinks: [{ count: 4, startIndex: 1, namePattern: 'Te1/1/{n}', idPrefix: 'up', type: 'sfp', speed: '10G SFP+ Modüler' }]
      })
    },
    {
      id: 'cisco-m-c9200-48t',
      name: 'Cisco Catalyst 9200-48T',
      modelTag: 'C9200-48T',
      series: 'cat9k',
      generation: 'current',
      category: 'switch',
      u: 1,
      poeBudget: 'PoE Yok (Data Only)',
      uplinkSummary: '4x 10G SFP+ Modüler',
      desc: '48x 10/100/1000 Gigabit Data RJ45 portu, modüler 4x 10G SFP+ uplink, kurumsal kenar data dağıtımı.',
      ports: buildPorts({
        accessCount: 48,
        accessPrefix: 'Gi1/0/',
        accessSpeed: '10/100/1000 Gigabit Data',
        uplinks: [{ count: 4, startIndex: 1, namePattern: 'Te1/1/{n}', idPrefix: 'up', type: 'sfp', speed: '10G SFP+ Modüler' }]
      })
    },
    {
      id: 'cisco-m-c9300l-24p-4x',
      name: 'Cisco Catalyst 9300L-24P-4X',
      modelTag: 'C9300L-24P-4X',
      series: 'cat9k',
      generation: 'current',
      category: 'switch',
      u: 1,
      poeBudget: '505W PoE+',
      uplinkSummary: '4x 10G SFP+ Sabit',
      desc: '24x 10/100/1000 Gigabit PoE+ (505W bütçe), 4x 10G SFP+ sabit uplink, StackWise-320 mimarisi.',
      ports: buildPorts({
        accessCount: 24,
        accessPrefix: 'Gi1/0/',
        accessSpeed: '10/100/1000 Gigabit PoE+ (30W)',
        uplinks: [{ count: 4, startIndex: 1, namePattern: 'Te1/1/{n}', idPrefix: 'up', type: 'sfp', speed: '10G SFP+ 10Gbps' }]
      })
    },
    {
      id: 'cisco-m-c9300l-48p-4x',
      name: 'Cisco Catalyst 9300L-48P-4X',
      modelTag: 'C9300L-48P-4X',
      series: 'cat9k',
      generation: 'current',
      category: 'switch',
      u: 1,
      poeBudget: '740W PoE+',
      uplinkSummary: '4x 10G SFP+ Sabit',
      desc: '48x 10/100/1000 Gigabit PoE+ (740W bütçe), 4x 10G SFP+ sabit uplink, StackWise-320 yüksek yoğunluklu kenar.',
      ports: buildPorts({
        accessCount: 48,
        accessPrefix: 'Gi1/0/',
        accessSpeed: '10/100/1000 Gigabit PoE+ (30W)',
        uplinks: [{ count: 4, startIndex: 1, namePattern: 'Te1/1/{n}', idPrefix: 'up', type: 'sfp', speed: '10G SFP+ 10Gbps' }]
      })
    },
    {
      id: 'cisco-m-c9300-24p',
      name: 'Cisco Catalyst 9300-24P',
      modelTag: 'C9300-24P',
      series: 'cat9k',
      generation: 'current',
      category: 'switch',
      u: 1,
      poeBudget: '445W PoE+',
      uplinkSummary: '4x 10G SFP+ Modüler (C9300-NM-4G/8X)',
      desc: 'StackWise-480, 24x 1G PoE+ (445W), modüler ağ modülü yuvası (4x 10G SFP+), Cisco DNA & Encrypted Traffic Analytics.',
      ports: buildPorts({
        accessCount: 24,
        accessPrefix: 'Gi1/0/',
        accessSpeed: '10/100/1000 Gigabit PoE+ (30W)',
        uplinks: [{ count: 4, startIndex: 1, namePattern: 'Te1/1/{n}', idPrefix: 'up', type: 'sfp', speed: '10G SFP+ Modüler' }]
      })
    },
    {
      id: 'cisco-m-c9300-48p',
      name: 'Cisco Catalyst 9300-48P',
      modelTag: 'C9300-48P',
      series: 'cat9k',
      generation: 'current',
      category: 'switch',
      u: 1,
      poeBudget: '715W PoE+',
      uplinkSummary: '4x 10G SFP+ Modüler (C9300-NM-8X)',
      desc: 'StackWise-480, 48x 1G PoE+ (715W), modüler ağ modülü yuvası (4x 10G SFP+), kurumsal amiral gemisi erişim switchi.',
      ports: buildPorts({
        accessCount: 48,
        accessPrefix: 'Gi1/0/',
        accessSpeed: '10/100/1000 Gigabit PoE+ (30W)',
        uplinks: [{ count: 4, startIndex: 1, namePattern: 'Te1/1/{n}', idPrefix: 'up', type: 'sfp', speed: '10G SFP+ Modüler' }]
      })
    },
    {
      id: 'cisco-m-c9300-24u',
      name: 'Cisco Catalyst 9300-24U UPOE',
      modelTag: 'C9300-24U',
      series: 'cat9k',
      generation: 'current',
      category: 'switch',
      u: 1,
      poeBudget: '830W UPOE (60W/Port)',
      uplinkSummary: '4x 10G SFP+ Modüler',
      desc: '24x Gigabit Cisco UPOE (Port başına 60W, 830W toplam), Wi-Fi 6 AP ve video konferans sistemleri için özel güç.',
      ports: buildPorts({
        accessCount: 24,
        accessPrefix: 'Gi1/0/',
        accessSpeed: '10/100/1000 Gigabit UPOE (60W)',
        uplinks: [{ count: 4, startIndex: 1, namePattern: 'Te1/1/{n}', idPrefix: 'up', type: 'sfp', speed: '10G SFP+ Modüler' }]
      })
    },
    {
      id: 'cisco-m-c9300-48u',
      name: 'Cisco Catalyst 9300-48U UPOE',
      modelTag: 'C9300-48U',
      series: 'cat9k',
      generation: 'current',
      category: 'switch',
      u: 1,
      poeBudget: '1440W UPOE (60W/Port)',
      uplinkSummary: '4x 10G SFP+ Modüler',
      desc: '48x Gigabit Cisco UPOE (Port başına 60W, 1440W toplam çift PSU ile), akıllı bina ve yüksek güç kenar.',
      ports: buildPorts({
        accessCount: 48,
        accessPrefix: 'Gi1/0/',
        accessSpeed: '10/100/1000 Gigabit UPOE (60W)',
        uplinks: [{ count: 4, startIndex: 1, namePattern: 'Te1/1/{n}', idPrefix: 'up', type: 'sfp', speed: '10G SFP+ Modüler' }]
      })
    },
    {
      id: 'cisco-m-c9300x-48hx',
      name: 'Cisco Catalyst 9300X-48HX UPOE+',
      modelTag: 'C9300X-48HX',
      series: 'cat9k',
      generation: 'current',
      category: 'switch',
      u: 1,
      poeBudget: '1900W UPOE+ (90W/Port)',
      uplinkSummary: '4x 25G SFP28 Modüler (C9300X-NM-4Y)',
      desc: 'StackWise-1T, 48x Multigigabit 10G UPOE+ (Port başına 90W), 4x 25G SFP28 omurga modülü, Wi-Fi 6E/7 hazır.',
      ports: buildPorts({
        accessCount: 48,
        accessPrefix: 'Te1/0/',
        accessSpeed: '100M/1G/2.5G/5G/10G mGig UPOE+ (90W)',
        uplinks: [{ count: 4, startIndex: 1, namePattern: 'Twe1/1/{n}', idPrefix: 'up', type: 'sfp', speed: '25G SFP28 Core Uplink' }]
      })
    },
    {
      id: 'cisco-m-c9300x-24y',
      name: 'Cisco Catalyst 9300X-24Y Fiber',
      modelTag: 'C9300X-24Y',
      series: 'cat9k',
      generation: 'current',
      category: 'fiber-switch',
      u: 1,
      poeBudget: 'PoE Yok (Fiber)',
      uplinkSummary: '2x 100G QSFP28 / 4x 25G',
      desc: '24x 1/10/25G SFP28 optik fiber dağıtım switchi, modüler 2x 100G QSFP28 omurga çıkış yuvası.',
      ports: buildPorts({
        accessCount: 24,
        accessPrefix: 'Twe1/0/',
        accessType: 'sfp',
        accessSpeed: '25G/10G/1G SFP28 Fiber',
        uplinks: [{ count: 2, startIndex: 1, namePattern: 'Hu1/1/{n}', idPrefix: 'up', type: 'sfp', speed: '100G QSFP28 Spine Uplink' }]
      })
    },
    {
      id: 'cisco-m-c9500-16x',
      name: 'Cisco Catalyst 9500-16X Core',
      modelTag: 'C9500-16X',
      series: 'cat9k',
      generation: 'current',
      category: 'fiber-switch',
      u: 1,
      poeBudget: 'PoE Yok (Core Omurga)',
      uplinkSummary: '2x 40G QSFP+ Sabit',
      desc: '16x 1/10G SFP+ kampüs omurga çekirdek switchi, 2x 40G QSFP+ yüksek kapasiteli uplink.',
      ports: buildPorts({
        accessCount: 16,
        accessPrefix: 'Te1/0/',
        accessType: 'sfp',
        accessSpeed: '10G/1G SFP+ 10Gbps',
        uplinks: [{ count: 2, startIndex: 1, namePattern: 'Fo1/0/{n}', idPrefix: 'up', type: 'sfp', speed: '40G QSFP+ Core Uplink' }]
      })
    },
    {
      id: 'cisco-m-c9500-40x',
      name: 'Cisco Catalyst 9500-40X Core',
      modelTag: 'C9500-40X',
      series: 'cat9k',
      generation: 'current',
      category: 'fiber-switch',
      u: 1,
      poeBudget: 'PoE Yok (Core Omurga)',
      uplinkSummary: '2x 40G QSFP+ Sabit',
      desc: '40x 1/10G SFP+ kampüs dağıtım ve veri merkezi omurgası, 2x 40G QSFP+ omurga uplink.',
      ports: buildPorts({
        accessCount: 40,
        accessPrefix: 'Te1/0/',
        accessType: 'sfp',
        accessSpeed: '10G/1G SFP+ 10Gbps',
        uplinks: [{ count: 2, startIndex: 1, namePattern: 'Fo1/0/{n}', idPrefix: 'up', type: 'sfp', speed: '40G QSFP+ Core Uplink' }]
      })
    },
    {
      id: 'cisco-m-c9500-24y4c',
      name: 'Cisco Catalyst 9500-24Y4C Core',
      modelTag: 'C9500-24Y4C',
      series: 'cat9k',
      generation: 'current',
      category: 'fiber-switch',
      u: 1,
      poeBudget: 'PoE Yok (Core Omurga)',
      uplinkSummary: '4x 100G QSFP28 Sabit',
      desc: '24x 1/10/25G SFP28, 4x 40/100G QSFP28 omurga portu, kurumsal kampüs çekirdek anahtarı.',
      ports: buildPorts({
        accessCount: 24,
        accessPrefix: '25GE1/0/',
        accessType: 'sfp',
        accessSpeed: '25G/10G/1G SFP28 Core',
        uplinks: [{ count: 4, startIndex: 25, namePattern: '100GE1/0/{n}', idPrefix: 'up', type: 'sfp', speed: '100G QSFP28 Core Spine' }]
      })
    },
    {
      id: 'cisco-m-c9500-48y4c',
      name: 'Cisco Catalyst 9500-48Y4C Core',
      modelTag: 'C9500-48Y4C',
      series: 'cat9k',
      generation: 'current',
      category: 'fiber-switch',
      u: 1,
      poeBudget: 'PoE Yok (Core Omurga)',
      uplinkSummary: '4x 100G QSFP28 Sabit',
      desc: '48x 1/10/25G SFP28 yüksek yoğunluklu kampüs çekirdek switchi, 4x 100G QSFP28 uplink.',
      ports: buildPorts({
        accessCount: 48,
        accessPrefix: '25GE1/0/',
        accessType: 'sfp',
        accessSpeed: '25G/10G/1G SFP28 Core',
        uplinks: [{ count: 4, startIndex: 49, namePattern: '100GE1/0/{n}', idPrefix: 'up', type: 'sfp', speed: '100G QSFP28 Core Spine' }]
      })
    },

    // =========================================================================
    // 2. CATALYST 1000 SERIES (CURRENT BRANCH & SMB ACCESS)
    // =========================================================================
    {
      id: 'cisco-m-c1000-8p-2g-l',
      name: 'Cisco Catalyst 1000-8P-2G-L',
      modelTag: 'C1000-8P-2G-L',
      series: 'cat1k',
      generation: 'current',
      category: 'compact',
      u: 1,
      poeBudget: '67W PoE+',
      uplinkSummary: '2x Dual-Purpose (RJ45/SFP)',
      desc: '8x 10/100/1000 Gigabit PoE+ (67W), 2x Combo Gigabit RJ45 veya SFP uplink, sessiz fansız kompakt kasa.',
      ports: buildPorts({
        accessCount: 8,
        accessPrefix: 'Gi1/0/',
        accessSpeed: '10/100/1000 Gigabit PoE+ (30W)',
        uplinks: [
          { count: 2, startIndex: 9, namePattern: 'Gi1/0/{n} (Cu)', idPrefix: 'up_cu', type: 'rj45', speed: '1G Gigabit RJ45' },
          { count: 2, startIndex: 9, namePattern: 'Gi1/0/{n} (SFP)', idPrefix: 'up_sfp', type: 'sfp', speed: '1G SFP Fiber' }
        ]
      })
    },
    {
      id: 'cisco-m-c1000-16p-2g-l',
      name: 'Cisco Catalyst 1000-16P-2G-L',
      modelTag: 'C1000-16P-2G-L',
      series: 'cat1k',
      generation: 'current',
      category: 'compact',
      u: 1,
      poeBudget: '120W PoE+',
      uplinkSummary: '2x 1G SFP Sabit',
      desc: '16x 10/100/1000 Gigabit PoE+ (120W), 2x 1G SFP sabit uplink, küçük şube ve ofis erişimi.',
      ports: buildPorts({
        accessCount: 16,
        accessPrefix: 'Gi1/0/',
        accessSpeed: '10/100/1000 Gigabit PoE+ (30W)',
        uplinks: [{ count: 2, startIndex: 17, namePattern: 'Gi1/0/{n}', idPrefix: 'up', type: 'sfp', speed: '1G SFP Fiber' }]
      })
    },
    {
      id: 'cisco-m-c1000-24p-4g-l',
      name: 'Cisco Catalyst 1000-24P-4G-L',
      modelTag: 'C1000-24P-4G-L',
      series: 'cat1k',
      generation: 'current',
      category: 'switch',
      u: 1,
      poeBudget: '195W PoE+',
      uplinkSummary: '4x 1G SFP Sabit',
      desc: '24x 10/100/1000 Gigabit PoE+ (195W), 4x 1G SFP sabit uplink portu, modern kompakt kenar.',
      ports: buildPorts({
        accessCount: 24,
        accessPrefix: 'Gi1/0/',
        accessSpeed: '10/100/1000 Gigabit PoE+ (195W)',
        uplinks: [{ count: 4, startIndex: 25, namePattern: 'Gi1/0/{n}', idPrefix: 'up', type: 'sfp', speed: '1G SFP Fiber' }]
      })
    },
    {
      id: 'cisco-m-c1000-48p-4g-l',
      name: 'Cisco Catalyst 1000-48P-4G-L',
      modelTag: 'C1000-48P-4G-L',
      series: 'cat1k',
      generation: 'current',
      category: 'switch',
      u: 1,
      poeBudget: '370W PoE+',
      uplinkSummary: '4x 1G SFP Sabit',
      desc: '48x 10/100/1000 Gigabit PoE+ (370W), 4x 1G SFP sabit uplink portu, güvenilir şube kenar dağıtımı.',
      ports: buildPorts({
        accessCount: 48,
        accessPrefix: 'Gi1/0/',
        accessSpeed: '10/100/1000 Gigabit PoE+ (370W)',
        uplinks: [{ count: 4, startIndex: 49, namePattern: 'Gi1/0/{n}', idPrefix: 'up', type: 'sfp', speed: '1G SFP Fiber' }]
      })
    },

    // =========================================================================
    // 3. CATALYST 2960-X / 2960-XR SERIES (LEGACY FIELD WORKHORSES)
    // =========================================================================
    {
      id: 'cisco-m-2960x-24ps',
      name: 'Cisco Catalyst 2960X-24PS-L',
      modelTag: 'WS-C2960X-24PS-L',
      series: 'cat2960x',
      generation: 'legacy',
      category: 'switch',
      u: 1,
      poeBudget: '370W PoE+',
      uplinkSummary: '4x 1G SFP Sabit',
      desc: '24x 10/100/1000 Gigabit PoE+ (370W, Gi1/0/1 - Gi1/0/24), 4x 1G SFP uplink (Gi1/0/25 - Gi1/0/28), FlexStack-Plus.',
      ports: buildPorts({
        accessCount: 24,
        accessPrefix: 'Gi1/0/',
        accessSpeed: '10/100/1000 Gigabit PoE+ (30W)',
        uplinks: [{ count: 4, startIndex: 25, namePattern: 'Gi1/0/{n}', idPrefix: 'up', type: 'sfp', speed: '1G SFP Fiber Uplink' }]
      })
    },
    {
      id: 'cisco-m-2960x-48fps',
      name: 'Cisco Catalyst 2960X-48FPS-L',
      modelTag: 'WS-C2960X-48FPS-L',
      series: 'cat2960x',
      generation: 'legacy',
      category: 'switch',
      u: 1,
      poeBudget: '740W Full PoE+',
      uplinkSummary: '4x 1G SFP Sabit',
      desc: '48x 10/100/1000 Gigabit Full PoE+ (740W, Gi1/0/1 - Gi1/0/48), 4x 1G SFP uplink (Gi1/0/49 - Gi1/0/52). Sahada en yoğun PoE switch.',
      ports: buildPorts({
        accessCount: 48,
        accessPrefix: 'Gi1/0/',
        accessSpeed: '10/100/1000 Gigabit PoE+ (30W Full)',
        uplinks: [{ count: 4, startIndex: 49, namePattern: 'Gi1/0/{n}', idPrefix: 'up', type: 'sfp', speed: '1G SFP Fiber Uplink' }]
      })
    },
    {
      id: 'cisco-m-2960x-48lps',
      name: 'Cisco Catalyst 2960X-48LPS-L',
      modelTag: 'WS-C2960X-48LPS-L',
      series: 'cat2960x',
      generation: 'legacy',
      category: 'switch',
      u: 1,
      poeBudget: '370W Low PoE+',
      uplinkSummary: '4x 1G SFP Sabit',
      desc: '48x 10/100/1000 Gigabit Low PoE+ (370W, Gi1/0/1 - Gi1/0/48), 4x 1G SFP uplink, enerji tasarruflu kenar.',
      ports: buildPorts({
        accessCount: 48,
        accessPrefix: 'Gi1/0/',
        accessSpeed: '10/100/1000 Gigabit PoE+ (370W Low)',
        uplinks: [{ count: 4, startIndex: 49, namePattern: 'Gi1/0/{n}', idPrefix: 'up', type: 'sfp', speed: '1G SFP Fiber Uplink' }]
      })
    },
    {
      id: 'cisco-m-2960x-24ts',
      name: 'Cisco Catalyst 2960X-24TS-L',
      modelTag: 'WS-C2960X-24TS-L',
      series: 'cat2960x',
      generation: 'legacy',
      category: 'switch',
      u: 1,
      poeBudget: 'PoE Yok (Data Only)',
      uplinkSummary: '4x 1G SFP Sabit',
      desc: '24x 10/100/1000 Gigabit Data (Gi1/0/1 - Gi1/0/24), 4x 1G SFP uplink (Gi1/0/25 - Gi1/0/28), düşük güç tüketimi.',
      ports: buildPorts({
        accessCount: 24,
        accessPrefix: 'Gi1/0/',
        accessSpeed: '10/100/1000 Gigabit Data',
        uplinks: [{ count: 4, startIndex: 25, namePattern: 'Gi1/0/{n}', idPrefix: 'up', type: 'sfp', speed: '1G SFP Fiber Uplink' }]
      })
    },
    {
      id: 'cisco-m-2960x-48ts',
      name: 'Cisco Catalyst 2960X-48TS-L',
      modelTag: 'WS-C2960X-48TS-L',
      series: 'cat2960x',
      generation: 'legacy',
      category: 'switch',
      u: 1,
      poeBudget: 'PoE Yok (Data Only)',
      uplinkSummary: '4x 1G SFP Sabit',
      desc: '48x 10/100/1000 Gigabit Data (Gi1/0/1 - Gi1/0/48), 4x 1G SFP uplink (Gi1/0/49 - Gi1/0/52).',
      ports: buildPorts({
        accessCount: 48,
        accessPrefix: 'Gi1/0/',
        accessSpeed: '10/100/1000 Gigabit Data',
        uplinks: [{ count: 4, startIndex: 49, namePattern: 'Gi1/0/{n}', idPrefix: 'up', type: 'sfp', speed: '1G SFP Fiber Uplink' }]
      })
    },
    {
      id: 'cisco-m-2960xr-24ps',
      name: 'Cisco Catalyst 2960XR-24PS-I',
      modelTag: 'WS-C2960XR-24PS-I',
      series: 'cat2960x',
      generation: 'legacy',
      category: 'switch',
      u: 1,
      poeBudget: '370W PoE+',
      uplinkSummary: '2x 10G SFP+ Sabit',
      desc: 'Layer 3 Kurumsal Kenar, 24x Gigabit PoE+ (370W), 2x 10G SFP+ Uplink (Te1/0/25 - Te1/0/26), Çift Yedekli Güç Kaynağı.',
      ports: buildPorts({
        accessCount: 24,
        accessPrefix: 'Gi1/0/',
        accessSpeed: '10/100/1000 Gigabit PoE+ (30W)',
        uplinks: [{ count: 2, startIndex: 25, namePattern: 'Te1/0/{n}', idPrefix: 'up', type: 'sfp', speed: '10G SFP+ 10Gbps' }]
      })
    },
    {
      id: 'cisco-m-2960xr-48fps',
      name: 'Cisco Catalyst 2960XR-48FPS-I',
      modelTag: 'WS-C2960XR-48FPS-I',
      series: 'cat2960x',
      generation: 'legacy',
      category: 'switch',
      u: 1,
      poeBudget: '740W Full PoE+',
      uplinkSummary: '4x 10G SFP+ Sabit',
      desc: 'Layer 3 Kurumsal Kenar, 48x Gigabit Full PoE+ (740W), 4x 10G SFP+ Uplink (Te1/0/49 - Te1/0/52), Çift Güç Kaynağı.',
      ports: buildPorts({
        accessCount: 48,
        accessPrefix: 'Gi1/0/',
        accessSpeed: '10/100/1000 Gigabit PoE+ (30W Full)',
        uplinks: [{ count: 4, startIndex: 49, namePattern: 'Te1/0/{n}', idPrefix: 'up', type: 'sfp', speed: '10G SFP+ 10Gbps' }]
      })
    },
    {
      id: 'cisco-m-2960s-24ps',
      name: 'Cisco Catalyst 2960S-24PS-L',
      modelTag: 'WS-C2960S-24PS-L',
      series: 'cat2960',
      generation: 'legacy',
      category: 'switch',
      u: 1,
      poeBudget: '370W PoE+',
      uplinkSummary: '2x 10G SFP+ veya 4x 1G SFP',
      desc: '24x 10/100/1000 Gigabit PoE+ (370W, Gi1/0/1 - Gi1/0/24), 4x 1G SFP veya 2x 10G SFP+ FlexStack uplink.',
      ports: buildPorts({
        accessCount: 24,
        accessPrefix: 'Gi1/0/',
        accessSpeed: '10/100/1000 Gigabit PoE+ (30W)',
        uplinks: [{ count: 4, startIndex: 25, namePattern: 'Gi1/0/{n}', idPrefix: 'up', type: 'sfp', speed: '1G SFP Fiber Uplink' }]
      })
    },
    {
      id: 'cisco-m-2960s-48fps',
      name: 'Cisco Catalyst 2960S-48FPS-L',
      modelTag: 'WS-C2960S-48FPS-L',
      series: 'cat2960',
      generation: 'legacy',
      category: 'switch',
      u: 1,
      poeBudget: '740W Full PoE+',
      uplinkSummary: '4x 1G SFP veya 2x 10G SFP+',
      desc: '48x 10/100/1000 Gigabit Full PoE+ (740W, Gi1/0/1 - Gi1/0/48), 4x 1G SFP uplink, kurumsal kenar.',
      ports: buildPorts({
        accessCount: 48,
        accessPrefix: 'Gi1/0/',
        accessSpeed: '10/100/1000 Gigabit PoE+ (30W Full)',
        uplinks: [{ count: 4, startIndex: 49, namePattern: 'Gi1/0/{n}', idPrefix: 'up', type: 'sfp', speed: '1G SFP Fiber Uplink' }]
      })
    },
  ];

  RS.CISCO_CATALYST_MODELS = CATALYST_MODELS;
})();
