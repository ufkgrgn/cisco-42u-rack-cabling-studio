/**
 * Cisco Enterprise Rack & Cabling Studio - Cisco Nexus, Core & Legacy Hardware Catalog
 * Catalyst 2960 Plus, 3850/3750/3560, Compact/SMB, and Nexus 9000/3000 series.
 */
(function () {
  'use strict';

  const RS = window.RackStudio = window.RackStudio || {};
  const buildPorts = RS.buildCatalogPorts || function (spec) {
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
  };

  const NEXUS_ROUTER_MODELS = [
    // =========================================================================
    // 4. CATALYST 2960 / 2960-PLUS (FAST ETHERNET EN YAYGIN SAHA MODELLERİ)
    // =========================================================================
    {
      id: 'cisco-m-2960-24pc',
      name: 'Cisco Catalyst 2960-24PC-L',
      modelTag: 'WS-C2960-24PC-L',
      series: 'cat2960',
      generation: 'legacy',
      category: 'switch',
      u: 1,
      poeBudget: '370W PoE (15.4W)',
      uplinkSummary: '2x Dual-Purpose 1G (RJ45/SFP)',
      desc: 'Sahada en çok kurulu olan 24x 10/100 Mbps PoE FastEthernet switch (Fa0/1 - Fa0/24), 2x Dual-Purpose 1G Gigabit/SFP.',
      ports: buildPorts({
        accessCount: 24,
        accessPrefix: 'Fa0/',
        accessSpeed: '10/100 Mbps FastEthernet PoE (15.4W)',
        uplinks: [
          { count: 2, startIndex: 1, namePattern: 'Gi0/{n} (RJ45)', idPrefix: 'up_cu', type: 'rj45', speed: '10/100/1000 Gigabit RJ45' },
          { count: 2, startIndex: 1, namePattern: 'Gi0/{n} (SFP)', idPrefix: 'up_sfp', type: 'sfp', speed: '1G SFP Fiber' }
        ]
      })
    },
    {
      id: 'cisco-m-2960-24tc',
      name: 'Cisco Catalyst 2960-24TC-L',
      modelTag: 'WS-C2960-24TC-L',
      series: 'cat2960',
      generation: 'legacy',
      category: 'switch',
      u: 1,
      poeBudget: 'PoE Yok (Data Only)',
      uplinkSummary: '2x Dual-Purpose 1G (RJ45/SFP)',
      desc: '24x 10/100 Mbps Data FastEthernet switch (Fa0/1 - Fa0/24), 2x Dual-Purpose 1G Gigabit/SFP uplink.',
      ports: buildPorts({
        accessCount: 24,
        accessPrefix: 'Fa0/',
        accessSpeed: '10/100 Mbps 100Base-TX Data',
        uplinks: [
          { count: 2, startIndex: 1, namePattern: 'Gi0/{n} (RJ45)', idPrefix: 'up_cu', type: 'rj45', speed: '10/100/1000 Gigabit RJ45' },
          { count: 2, startIndex: 1, namePattern: 'Gi0/{n} (SFP)', idPrefix: 'up_sfp', type: 'sfp', speed: '1G SFP Fiber' }
        ]
      })
    },
    {
      id: 'cisco-m-2960-48tc',
      name: 'Cisco Catalyst 2960-48TC-L',
      modelTag: 'WS-C2960-48TC-L',
      series: 'cat2960',
      generation: 'legacy',
      category: 'switch',
      u: 1,
      poeBudget: 'PoE Yok (Data Only)',
      uplinkSummary: '2x 1G RJ45 + 2x 1G SFP',
      desc: '48x 10/100 Mbps FastEthernet switch (Fa0/1 - Fa0/48), 2x 1G Gigabit RJ45 (Gi0/1 - Gi0/2) ve 2x 1G SFP (Gi0/3 - Gi0/4).',
      ports: buildPorts({
        accessCount: 48,
        accessPrefix: 'Fa0/',
        accessSpeed: '10/100 Mbps 100Base-TX Data',
        uplinks: [
          { count: 2, startIndex: 1, namePattern: 'Gi0/{n}', idPrefix: 'up_cu', type: 'rj45', speed: '10/100/1000 Gigabit RJ45' },
          { count: 2, startIndex: 3, namePattern: 'Gi0/{n}', idPrefix: 'up_sfp', type: 'sfp', speed: '1G SFP Fiber' }
        ]
      })
    },
    {
      id: 'cisco-m-2960-48pst',
      name: 'Cisco Catalyst 2960-48PST-L',
      modelTag: 'WS-C2960-48PST-L',
      series: 'cat2960',
      generation: 'legacy',
      category: 'switch',
      u: 1,
      poeBudget: '370W PoE',
      uplinkSummary: '2x 1G RJ45 + 2x 1G SFP',
      desc: '48x 10/100 Mbps FastEthernet PoE (370W, Fa0/1 - Fa0/48), 2x 1G Gigabit RJ45 ve 2x 1G SFP uplink.',
      ports: buildPorts({
        accessCount: 48,
        accessPrefix: 'Fa0/',
        accessSpeed: '10/100 Mbps FastEthernet PoE (15.4W)',
        uplinks: [
          { count: 2, startIndex: 1, namePattern: 'Gi0/{n}', idPrefix: 'up_cu', type: 'rj45', speed: '10/100/1000 Gigabit RJ45' },
          { count: 2, startIndex: 3, namePattern: 'Gi0/{n}', idPrefix: 'up_sfp', type: 'sfp', speed: '1G SFP Fiber' }
        ]
      })
    },
    {
      id: 'cisco-m-2960g-24tc',
      name: 'Cisco Catalyst 2960G-24TC-L',
      modelTag: 'WS-C2960G-24TC-L',
      series: 'cat2960',
      generation: 'legacy',
      category: 'switch',
      u: 1,
      poeBudget: 'PoE Yok (Gigabit Data)',
      uplinkSummary: '4x Dual-Purpose SFP',
      desc: '20x 10/100/1000 Gigabit RJ45 + 4x Dual-Purpose 1G Gigabit/SFP fiber uplink.',
      ports: buildPorts({
        accessCount: 20,
        accessPrefix: 'Gi0/',
        accessSpeed: '10/100/1000 Gigabit Data',
        uplinks: [
          { count: 4, startIndex: 21, namePattern: 'Gi0/{n} (Cu)', idPrefix: 'up_cu', type: 'rj45', speed: '1G Gigabit RJ45' },
          { count: 4, startIndex: 21, namePattern: 'Gi0/{n} (SFP)', idPrefix: 'up_sfp', type: 'sfp', speed: '1G SFP Fiber' }
        ]
      })
    },

    // =========================================================================
    // 5. CATALYST 3850 / 3750 / 3560 SERIES (CORE, DISTRIBUTION & MULTILAYER)
    // =========================================================================
    {
      id: 'cisco-m-3850-24s',
      name: 'Cisco Catalyst 3850-24S-S',
      modelTag: 'WS-C3850-24S-S',
      series: 'cat3k',
      generation: 'legacy',
      category: 'fiber-switch',
      u: 1,
      poeBudget: 'PoE Yok (Fiber Omurga)',
      uplinkSummary: '4x 10G SFP+ Modüler (C3850-NM-4-10G)',
      desc: '24 Port SFP 1G Fiber Omurga/Toplama Switchi (Gi1/0/1 - Gi1/0/24), 4x 10G SFP+ Modüler Ağ Modülü (Te1/1/1 - Te1/1/4).',
      ports: buildPorts({
        accessCount: 24,
        accessPrefix: 'Gi1/0/',
        accessType: 'sfp',
        accessSpeed: '1G SFP Fiber (IDF Toplama)',
        uplinks: [{ count: 4, startIndex: 1, namePattern: 'Te1/1/{n}', idPrefix: 'up', type: 'sfp', speed: '10G SFP+ 10Gbps Uplink' }]
      })
    },
    {
      id: 'cisco-m-3850-12s',
      name: 'Cisco Catalyst 3850-12S-S',
      modelTag: 'WS-C3850-12S-S',
      series: 'cat3k',
      generation: 'legacy',
      category: 'fiber-switch',
      u: 1,
      poeBudget: 'PoE Yok (Fiber Omurga)',
      uplinkSummary: '4x 10G SFP+ Modüler',
      desc: '12 Port SFP 1G Fiber Omurga Switchi (Gi1/0/1 - Gi1/0/12), 4x 10G SFP+ modüler uplink.',
      ports: buildPorts({
        accessCount: 12,
        accessPrefix: 'Gi1/0/',
        accessType: 'sfp',
        accessSpeed: '1G SFP Fiber',
        uplinks: [{ count: 4, startIndex: 1, namePattern: 'Te1/1/{n}', idPrefix: 'up', type: 'sfp', speed: '10G SFP+ 10Gbps' }]
      })
    },
    {
      id: 'cisco-m-3850-24p',
      name: 'Cisco Catalyst 3850-24P-S',
      modelTag: 'WS-C3850-24P-S',
      series: 'cat3k',
      generation: 'legacy',
      category: 'switch',
      u: 1,
      poeBudget: '435W PoE+',
      uplinkSummary: '4x 10G SFP+ Modüler',
      desc: '24x 10/100/1000 Gigabit PoE+ (435W), 4x 10G SFP+ modüler uplink, StackWise-480 omurga.',
      ports: buildPorts({
        accessCount: 24,
        accessPrefix: 'Gi1/0/',
        accessSpeed: '10/100/1000 Gigabit PoE+ (30W)',
        uplinks: [{ count: 4, startIndex: 1, namePattern: 'Te1/1/{n}', idPrefix: 'up', type: 'sfp', speed: '10G SFP+ 10Gbps' }]
      })
    },
    {
      id: 'cisco-m-3850-48p',
      name: 'Cisco Catalyst 3850-48P-S',
      modelTag: 'WS-C3850-48P-S',
      series: 'cat3k',
      generation: 'legacy',
      category: 'switch',
      u: 1,
      poeBudget: '715W PoE+',
      uplinkSummary: '4x 10G SFP+ Modüler',
      desc: '48x 10/100/1000 Gigabit PoE+ (715W), 4x 10G SFP+ modüler uplink, kurumsal kat dağıtımı.',
      ports: buildPorts({
        accessCount: 48,
        accessPrefix: 'Gi1/0/',
        accessSpeed: '10/100/1000 Gigabit PoE+ (30W)',
        uplinks: [{ count: 4, startIndex: 1, namePattern: 'Te1/1/{n}', idPrefix: 'up', type: 'sfp', speed: '10G SFP+ 10Gbps' }]
      })
    },
    {
      id: 'cisco-m-3750x-24t',
      name: 'Cisco Catalyst 3750X-24T-S',
      modelTag: 'WS-C3750X-24T-S',
      series: 'cat3k',
      generation: 'legacy',
      category: 'switch',
      u: 1,
      poeBudget: 'PoE Yok (Data Only)',
      uplinkSummary: '4x 1G veya 2x 10G SFP+ Modüler (C3KX-NM-10G)',
      desc: '24x 10/100/1000 Gigabit Data (Gi1/0/1 - Gi1/0/24), modüler ağ yuvası (2x 10G SFP+ veya 4x 1G SFP), StackWise Plus.',
      ports: buildPorts({
        accessCount: 24,
        accessPrefix: 'Gi1/0/',
        accessSpeed: '10/100/1000 Gigabit Data',
        uplinks: [{ count: 2, startIndex: 1, namePattern: 'Te1/1/{n}', idPrefix: 'up', type: 'sfp', speed: '10G SFP+ Modüler' }]
      })
    },
    {
      id: 'cisco-m-3750x-48p',
      name: 'Cisco Catalyst 3750X-48P-S',
      modelTag: 'WS-C3750X-48P-S',
      series: 'cat3k',
      generation: 'legacy',
      category: 'switch',
      u: 1,
      poeBudget: '715W PoE+',
      uplinkSummary: '4x 1G veya 2x 10G SFP+ Modüler (C3KX-NM-10G)',
      desc: '48x 10/100/1000 Gigabit PoE+ (715W), modüler ağ yuvası (2x 10G SFP+), çift yedekli güç kaynağı.',
      ports: buildPorts({
        accessCount: 48,
        accessPrefix: 'Gi1/0/',
        accessSpeed: '10/100/1000 Gigabit PoE+ (30W)',
        uplinks: [{ count: 2, startIndex: 1, namePattern: 'Te1/1/{n}', idPrefix: 'up', type: 'sfp', speed: '10G SFP+ Modüler' }]
      })
    },
    {
      id: 'cisco-m-3560x-24t',
      name: 'Cisco Catalyst 3560X-24T-S',
      modelTag: 'WS-C3560X-24T-S',
      series: 'cat3k',
      generation: 'legacy',
      category: 'switch',
      u: 1,
      poeBudget: 'PoE Yok (Data Only)',
      uplinkSummary: '4x 10G/1G SFP+ Modüler',
      desc: '24x Gigabit 10/100/1000 RJ45 (Gi1/0/1 - Gi1/0/24), Modüler Ağ Modülü (4x 10G/1G SFP+ Te1/1/1 - Te1/1/4).',
      ports: buildPorts({
        accessCount: 24,
        accessPrefix: 'Gi1/0/',
        accessSpeed: '10/100/1000 Gigabit RJ45',
        uplinks: [{ count: 4, startIndex: 1, namePattern: 'Te1/1/{n}', idPrefix: 'up', type: 'sfp', speed: '10G SFP+ Modüler' }]
      })
    },
    {
      id: 'cisco-m-3560x-48pf',
      name: 'Cisco Catalyst 3560X-48PF-S',
      modelTag: 'WS-C3560X-48PF-S',
      series: 'cat3k',
      generation: 'legacy',
      category: 'switch',
      u: 1,
      poeBudget: '800W Full PoE+',
      uplinkSummary: '4x 10G/1G SFP+ Modüler',
      desc: '48x Gigabit 10/100/1000 PoE+ Full (800W, Gi1/0/1 - Gi1/0/48), Modüler Ağ Modülü (4x 10G/1G SFP+).',
      ports: buildPorts({
        accessCount: 48,
        accessPrefix: 'Gi1/0/',
        accessSpeed: '10/100/1000 Gigabit PoE+ (30W Full)',
        uplinks: [{ count: 4, startIndex: 1, namePattern: 'Te1/1/{n}', idPrefix: 'up', type: 'sfp', speed: '10G SFP+ Modüler' }]
      })
    },

    // =========================================================================
    // 6. COMPACT & CBS SWITCHES (MASAÜSTÜ & SAHA KOMPAKT DAĞITICILAR)
    // =========================================================================
    {
      id: 'cisco-m-3560cx-8pc',
      name: 'Cisco Catalyst 3560-CX 8PC-S',
      modelTag: 'WS-C3560CX-8PC-S',
      series: 'compact',
      generation: 'legacy',
      category: 'compact',
      u: 1,
      poeBudget: '240W PoE+',
      uplinkSummary: '2x 1G Copper + 2x 1G SFP',
      desc: 'Kompakt fansız 8 Port Gigabit PoE+ (240W), 2x 1G RJ45 ve 2x 1G SFP uplink. Ofis ve saha kabinleri için ideal.',
      ports: buildPorts({
        accessCount: 8,
        accessPrefix: 'Gi0/',
        accessSpeed: '10/100/1000 Gigabit PoE+ (30W)',
        uplinks: [
          { count: 2, startIndex: 9, namePattern: 'Gi0/{n} (Cu)', idPrefix: 'up_cu', type: 'rj45', speed: '1G Gigabit RJ45' },
          { count: 2, startIndex: 11, namePattern: 'Gi0/{n} (SFP)', idPrefix: 'up_sfp', type: 'sfp', speed: '1G SFP Fiber' }
        ]
      })
    },
    {
      id: 'cisco-m-3560cx-12pc',
      name: 'Cisco Catalyst 3560-CX 12PC-S',
      modelTag: 'WS-C3560CX-12PC-S',
      series: 'compact',
      generation: 'legacy',
      category: 'compact',
      u: 1,
      poeBudget: '240W PoE+',
      uplinkSummary: '2x 1G Copper + 2x 10G SFP+',
      desc: 'Kompakt 12 Port Gigabit PoE+ (240W), 2x 1G RJ45 ve 2x 10G SFP+ yüksek hızlı uplink.',
      ports: buildPorts({
        accessCount: 12,
        accessPrefix: 'Gi0/',
        accessSpeed: '10/100/1000 Gigabit PoE+ (30W)',
        uplinks: [
          { count: 2, startIndex: 13, namePattern: 'Gi0/{n} (Cu)', idPrefix: 'up_cu', type: 'rj45', speed: '1G Gigabit RJ45' },
          { count: 2, startIndex: 1, namePattern: 'Te0/1/{n}', idPrefix: 'up_te', type: 'sfp', speed: '10G SFP+ 10Gbps' }
        ]
      })
    },
    {
      id: 'cisco-m-2960cx-8pc',
      name: 'Cisco Catalyst 2960-CX 8PC-L',
      modelTag: 'WS-C2960CX-8PC-L',
      series: 'compact',
      generation: 'legacy',
      category: 'compact',
      u: 1,
      poeBudget: '124W PoE+',
      uplinkSummary: '2x 1G Copper + 2x 1G SFP',
      desc: 'Kompakt 8 Port Gigabit PoE+ (124W), 2x 1G RJ45 ve 2x 1G SFP uplink, sessiz fansız masaüstü/duvar tipi.',
      ports: buildPorts({
        accessCount: 8,
        accessPrefix: 'Gi0/',
        accessSpeed: '10/100/1000 Gigabit PoE+ (30W)',
        uplinks: [
          { count: 2, startIndex: 9, namePattern: 'Gi0/{n} (Cu)', idPrefix: 'up_cu', type: 'rj45', speed: '1G Gigabit RJ45' },
          { count: 2, startIndex: 11, namePattern: 'Gi0/{n} (SFP)', idPrefix: 'up_sfp', type: 'sfp', speed: '1G SFP Fiber' }
        ]
      })
    },
    {
      id: 'cisco-m-cbs350-24p',
      name: 'Cisco Business 350-24P-4G',
      modelTag: 'CBS350-24P-4G',
      series: 'cbs',
      generation: 'current',
      category: 'switch',
      u: 1,
      poeBudget: '195W PoE+',
      uplinkSummary: '4x 1G SFP Sabit',
      desc: '24x Gigabit PoE+ (195W), 4x 1G SFP uplink, KOBİ ve küçük işletmeler için Cisco Business yönetimli anahtar.',
      ports: buildPorts({
        accessCount: 24,
        accessPrefix: 'GE',
        accessSpeed: '10/100/1000 Gigabit PoE+ (195W)',
        uplinks: [{ count: 4, startIndex: 1, namePattern: 'SFP{n}', idPrefix: 'up', type: 'sfp', speed: '1G SFP Fiber' }]
      })
    },
    {
      id: 'cisco-m-cbs350-48p',
      name: 'Cisco Business 350-48P-4G',
      modelTag: 'CBS350-48P-4G',
      series: 'cbs',
      generation: 'current',
      category: 'switch',
      u: 1,
      poeBudget: '370W PoE+',
      uplinkSummary: '4x 1G SFP Sabit',
      desc: '48x Gigabit PoE+ (370W), 4x 1G SFP uplink, Cisco Business serisi 48 portlu kenar dağıtıcı.',
      ports: buildPorts({
        accessCount: 48,
        accessPrefix: 'GE',
        accessSpeed: '10/100/1000 Gigabit PoE+ (370W)',
        uplinks: [{ count: 4, startIndex: 1, namePattern: 'SFP{n}', idPrefix: 'up', type: 'sfp', speed: '1G SFP Fiber' }]
      })
    },

    // =========================================================================
    // 7. CISCO NEXUS DATA CENTER (TOP-OF-RACK & SPARK SPINE)
    // =========================================================================
    {
      id: 'cisco-m-nexus-93180yc',
      name: 'Cisco Nexus 93180YC-FX',
      modelTag: 'N9K-C93180YC-FX',
      series: 'nexus',
      generation: 'current',
      category: 'switch',
      u: 1,
      poeBudget: 'PoE Yok (Data Center ToR)',
      uplinkSummary: '6x 40/100G QSFP28 Spine',
      desc: '48x 10/25G SFP28 (Eth1/1 - Eth1/48) ve 6x 40/100G QSFP28 omurga portu (Eth1/49 - Eth1/54), düşük gecikmeli ToR.',
      ports: buildPorts({
        accessCount: 48,
        accessPrefix: 'Eth1/',
        accessType: 'sfp',
        accessSpeed: '25G/10G SFP28 ToR Server',
        uplinks: [{ count: 6, startIndex: 49, namePattern: 'Eth1/{n}', idPrefix: 'qsfp', type: 'sfp', speed: '100G QSFP28 Spine Uplink' }]
      })
    },
    {
      id: 'cisco-m-nexus-3064pq',
      name: 'Cisco Nexus 3064PQ-10GE',
      modelTag: 'N3K-C3064PQ-10GE',
      series: 'nexus',
      generation: 'legacy',
      category: 'switch',
      u: 1,
      poeBudget: 'PoE Yok (Data Center ToR)',
      uplinkSummary: '4x 40G QSFP+ Spine',
      desc: '48x 1/10G SFP+ (Eth1/1 - Eth1/48) ve 4x 40G QSFP+ uplink (Eth1/49 - Eth1/52), ultra düşük gecikme ToR.',
      ports: buildPorts({
        accessCount: 48,
        accessPrefix: 'Eth1/',
        accessType: 'sfp',
        accessSpeed: '10G/1G SFP+ 10Gbps Server',
        uplinks: [{ count: 4, startIndex: 49, namePattern: 'Eth1/{n}', idPrefix: 'qsfp', type: 'sfp', speed: '40G QSFP+ Spine Uplink' }]
      })
    }
  ];

  RS.CISCO_NEXUS_ROUTER_MODELS = NEXUS_ROUTER_MODELS;
})();
